import React, {useMemo, useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Share,
  Linking,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {fetchArticleBySlug} from '../api/client';
import {parseArticle} from '../api/parsers';
import {getFCMToken} from '../utils/notifications';

const PROJECT_ID = 'btcchub-af77a';
const API_KEY = 'AIzaSyC0blgpkf9ioMa5QgkIwi9S6iCVnphSeHE';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const REACTIONS_KEY = 'article_reactions_v1';
const COMMENTER_NAME_KEY = 'commenter_name';

const BLACKLIST = require('../../data/blacklist.json');

// ─── Reactions helpers ───────────────────────────────────────────────────────

async function fetchReactions(slug) {
  try {
    const r = await fetch(`${FS_BASE}/article_reactions/${encodeURIComponent(slug)}?key=${API_KEY}`);
    if (!r.ok) return {likes: 0, dislikes: 0};
    const doc = await r.json();
    return {
      likes: parseInt(doc?.fields?.likes?.integerValue || 0, 10),
      dislikes: parseInt(doc?.fields?.dislikes?.integerValue || 0, 10),
    };
  } catch {
    return {likes: 0, dislikes: 0};
  }
}

async function submitReaction(slug, type, delta = 1) {
  const res = await fetch(`${FS_BASE}:commit?key=${API_KEY}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      writes: [{
        transform: {
          document: `projects/${PROJECT_ID}/databases/(default)/documents/article_reactions/${encodeURIComponent(slug)}`,
          fieldTransforms: [{fieldPath: type, increment: {integerValue: String(delta)}}],
        },
      }],
    }),
  });
  if (!res.ok) throw new Error('reaction failed');
}

// ─── Comments helpers ─────────────────────────────────────────────────────────

async function fetchComments(slug) {
  try {
    const res = await fetch(`${FS_BASE}:runQuery?key=${API_KEY}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        structuredQuery: {
          from: [{collectionId: 'article_comments'}],
          where: {fieldFilter: {field: {fieldPath: 'slug'}, op: 'EQUAL', value: {stringValue: slug}}},
          orderBy: [{field: {fieldPath: 'timestamp'}, direction: 'ASCENDING'}],
          limit: 200,
        },
      }),
    });
    const rows = await res.json();
    return rows
      .filter(r => r.document)
      .map(r => {
        const f = r.document.fields;
        return {
          id: r.document.name.split('/').pop(),
          text: f.text?.stringValue || '',
          authorId: f.authorId?.stringValue || '',
          authorName: f.authorName?.stringValue || 'Fan',
          timestamp: f.timestamp?.stringValue || '',
          flags: parseInt(f.flags?.integerValue || 0, 10),
          hidden: f.hidden?.booleanValue || false,
          parentId: f.parentId?.stringValue || null,
        };
      })
      .filter(c => !c.hidden);
  } catch {
    return [];
  }
}

async function postComment(slug, text, authorId, authorName, parentId) {
  const fields = {
    slug:       {stringValue: slug},
    text:       {stringValue: text},
    authorId:   {stringValue: authorId},
    authorName: {stringValue: authorName},
    timestamp:  {stringValue: new Date().toISOString()},
    flags:      {integerValue: '0'},
    hidden:     {booleanValue: false},
    parentId:   parentId ? {stringValue: parentId} : {nullValue: null},
  };
  const res = await fetch(`${FS_BASE}/article_comments?key=${API_KEY}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({fields}),
  });
  if (!res.ok) throw new Error('post failed');
  const doc = await res.json();
  return doc.name.split('/').pop(); // return new doc ID
}

async function flagComment(docId) {
  await fetch(`${FS_BASE}:commit?key=${API_KEY}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      writes: [{
        transform: {
          document: `projects/${PROJECT_ID}/databases/(default)/documents/article_comments/${docId}`,
          fieldTransforms: [{fieldPath: 'flags', increment: {integerValue: '1'}}],
        },
      }],
    }),
  });
}

async function deleteComment(docId) {
  await fetch(`${FS_BASE}/article_comments/${docId}?key=${API_KEY}`, {method: 'DELETE'});
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function containsProfanity(text) {
  const lower = text.toLowerCase();
  return BLACKLIST.some(w => lower.includes(w));
}

// ─── CommentsSheet ────────────────────────────────────────────────────────────

function CommentsSheet({visible, onClose, comments, setComments, articleSlug, myAuthorId, commenterName, setCommenterName}) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // {id, authorName}
  const [nameInput, setNameInput] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [inputError, setInputError] = useState('');
  const [nameEditing, setNameEditing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const inputRef = useRef(null);

  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) translateY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        Animated.timing(translateY, {toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true}).start(() => {
          translateY.setValue(0);
          onClose();
        });
      } else {
        Animated.spring(translateY, {toValue: 0, useNativeDriver: true, bounciness: 4}).start();
      }
    },
  })).current;

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible]);

  const topLevel = (comments || []).filter(c => !c.parentId);
  const replies = (comments || []).filter(c => c.parentId);

  const flatList = topLevel.flatMap(c => [
    {...c, isReply: false},
    ...replies.filter(r => r.parentId === c.id).map(r => ({...r, isReply: true})),
  ]);

  const saveName = async (name) => {
    const trimmed = name.trim() || `Fan #${(myAuthorId || 'xxxx').slice(-4)}`;
    setCommenterName(trimmed);
    await AsyncStorage.setItem(COMMENTER_NAME_KEY, trimmed);
    return trimmed;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (text.length > 500) { setInputError('Comment too long (max 500 characters)'); return; }
    if (containsProfanity(text)) { setInputError('Comment contains disallowed content'); return; }
    setInputError('');

    let authorName = commenterName;
    if (!authorName) {
      // First comment — show name prompt; remember the text + replyingTo context
      setPendingSubmit(true);
      setShowNamePrompt(true);
      return;
    }

    await doSubmit(text, authorName, replyingTo?.id || null);
  };

  const doSubmit = async (text, authorName, parentId) => {
    setInput('');
    setReplyingTo(null);
    setPendingSubmit(false);

    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      text,
      authorId: myAuthorId,
      authorName,
      timestamp: new Date().toISOString(),
      flags: 0,
      hidden: false,
      parentId: parentId || null,
    };
    setComments(prev => [...(prev || []), optimistic]);

    try {
      const realId = await postComment(articleSlug, text, myAuthorId, authorName, parentId);
      setComments(prev => prev.map(c => c.id === tempId ? {...c, id: realId} : c));
    } catch {
      // Keep optimistic entry — low-stakes, will disappear on reload
    }
  };

  const handleNameSet = async () => {
    const name = await saveName(nameInput);
    setShowNamePrompt(false);
    setNameEditing(false);
    if (pendingSubmit && input.trim()) {
      await doSubmit(input.trim(), name, replyingTo?.id || null);
    }
  };

  const handleNameSkip = async () => {
    const name = await saveName('');
    setShowNamePrompt(false);
    setNameEditing(false);
    if (pendingSubmit && input.trim()) {
      await doSubmit(input.trim(), name, replyingTo?.id || null);
    }
  };

  const handleFlag = async (commentId) => {
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      const newFlags = c.flags + 1;
      return {...c, flags: newFlags, hidden: newFlags >= 3};
    }).filter(c => !c.hidden));
    try { await flagComment(commentId); } catch {}
  };

  const handleDelete = (commentId) => {
    setConfirmDeleteId(commentId);
  };

  const confirmDelete = () => {
    setComments(prev => prev.filter(c => c.id !== confirmDeleteId && c.parentId !== confirmDeleteId));
    deleteComment(confirmDeleteId).catch(() => {});
    setConfirmDeleteId(null);
  };

  const renderComment = ({item}) => {
    const isOwn = item.authorId === myAuthorId;
    return (
      <View style={[styles.commentRow, item.isReply && styles.commentReply]}>
        {item.isReply && <View style={styles.replyLine} />}
        <View style={styles.commentBody}>
          <View style={styles.commentMeta}>
            <Text style={[styles.commentAuthor, isOwn && styles.commentAuthorOwn]}>{item.authorName}</Text>
            <Text style={styles.commentTime}>{timeAgo(item.timestamp)}</Text>
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
          <View style={styles.commentActions}>
            {!item.isReply && (
              <TouchableOpacity onPress={() => { setReplyingTo({id: item.id, authorName: item.authorName}); inputRef.current?.focus(); }} style={styles.commentActionBtn}>
                <Text style={styles.commentActionText}>Reply</Text>
              </TouchableOpacity>
            )}
            {!isOwn && (
              <TouchableOpacity onPress={() => handleFlag(item.id)} style={styles.commentActionBtn}>
                <Icon name="flag" size={13} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            {isOwn && (
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.commentActionBtn}>
                <Icon name="delete-outline" size={13} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetOuter}
        keyboardVerticalOffset={0}>
        <Animated.View style={[styles.sheet, {paddingBottom: insets.bottom || 16, transform: [{translateY}]}]}>
          {/* Handle — drag target */}
          <View style={styles.handleWrap} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            {nameEditing ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameEditInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Your display name"
                  placeholderTextColor={Colors.textSecondary}
                  autoFocus
                  maxLength={30}
                  returnKeyType="done"
                  onSubmitEditing={handleNameSet}
                />
                <TouchableOpacity onPress={handleNameSet} style={styles.nameEditSave}>
                  <Text style={styles.nameEditSaveText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setNameEditing(false); setNameInput(''); }}>
                  <Icon name="close" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Comments ({(comments || []).length})</Text>
                <TouchableOpacity onPress={() => { setNameInput(commenterName || ''); setNameEditing(true); }} style={styles.sheetNameBtn}>
                  <Icon name="edit" size={16} color={Colors.textSecondary} />
                  <Text style={styles.sheetNameText} numberOfLines={1}>{commenterName || 'Set name'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Icon name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Comment list */}
          {!comments ? (
            <View style={styles.commentLoading}>
              <ActivityIndicator color={Colors.yellow} />
            </View>
          ) : (
            <FlatList
              data={flatList}
              keyExtractor={item => item.id}
              renderItem={renderComment}
              style={styles.commentList}
              contentContainerStyle={flatList.length === 0 ? styles.emptyContainer : {paddingVertical: 8}}
              ListEmptyComponent={<Text style={styles.emptyText}>No comments yet. Be the first!</Text>}
            />
          )}

          {/* Replying-to indicator */}
          {replyingTo && (
            <View style={styles.replyingBar}>
              <Text style={styles.replyingText}>Replying to <Text style={{color: '#fff'}}>{replyingTo.authorName}</Text></Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Icon name="close" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Name prompt (first-time) */}
          {showNamePrompt ? (
            <View style={styles.namePrompt}>
              <Text style={styles.namePromptTitle}>Choose a display name</Text>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={`Fan #${(myAuthorId || 'xxxx').slice(-4)}`}
                placeholderTextColor={Colors.textSecondary}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={handleNameSet}
              />
              <View style={styles.namePromptBtns}>
                <TouchableOpacity onPress={handleNameSkip} style={styles.nameSkipBtn}>
                  <Text style={styles.nameSkipText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNameSet} style={styles.nameSetBtn}>
                  <Text style={styles.nameSetText}>Set name</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Input footer */
            <View style={styles.inputRow}>
              {inputError ? <Text style={styles.inputError}>{inputError}</Text> : null}
              <View style={styles.inputInner}>
                <TextInput
                  ref={inputRef}
                  style={styles.commentInput}
                  value={input}
                  onChangeText={t => { setInput(t); if (inputError) setInputError(''); }}
                  placeholder="Add a comment..."
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  maxLength={520}
                  returnKeyType="default"
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!input.trim()}
                  style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}>
                  <Icon name="send" size={20} color={input.trim() ? Colors.yellow : Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Delete confirmation */}
      <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmDeleteId(null)}>
          <Pressable style={styles.confirmBox}>
            <View style={styles.confirmYellow} />
            <Text style={styles.confirmTitle}>Delete comment</Text>
            <Text style={styles.confirmBody}>Are you sure you want to delete this comment?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={confirmDelete}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ArticleScreen({route, navigation}) {
  const {article: articleParam, slug} = route.params;
  const validParam = articleParam && articleParam.content !== undefined ? articleParam : null;
  const [article, setArticle] = useState(validParam || null);
  const webviewRef = useRef(null);
  const insets = useSafeAreaInsets();
  const topPad = insets.top || 44;

  const articleSlug = slug || (articleParam?.link ? articleParam.link.replace(/\/$/, '').split('/').pop() : null);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState(null);
  const [commenterName, setCommenterName] = useState(null);
  const myAuthorIdRef = useRef('anonymous');

  useEffect(() => {
    const needsFetch = !validParam;
    const resolvedSlug = slug || (articleParam?.link ? articleParam.link.replace(/\/$/, '').split('/').pop() : null);
    if (needsFetch && resolvedSlug) {
      fetchArticleBySlug(resolvedSlug).then(raw => {
        if (raw) setArticle(parseArticle(raw));
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (article) Analytics.screen('article:' + article.title?.substring(0, 50));
  }, [article]);

  useEffect(() => {
    if (comments && webviewRef.current) {
      webviewRef.current.injectJavaScript(`updateCommentCount(${comments.length}); true;`);
    }
  }, [comments?.length]);

  const onWebViewLoad = async () => {
    if (!articleSlug || !webviewRef.current) return;
    const [reactionsData, rawReactions, savedName, token, commentsData] = await Promise.all([
      fetchReactions(articleSlug),
      AsyncStorage.getItem(REACTIONS_KEY).catch(() => null),
      AsyncStorage.getItem(COMMENTER_NAME_KEY).catch(() => null),
      getFCMToken().catch(() => null),
      fetchComments(articleSlug),
    ]);

    // Author identity
    const myAuthorId = token ? token.slice(0, 8) : `anon_${Math.random().toString(36).slice(2, 6)}`;
    myAuthorIdRef.current = myAuthorId;
    if (savedName) {
      setCommenterName(savedName);
    }
    // Don't set commenterName yet if null — name prompt will handle it on first comment

    // Reactions
    const stored = rawReactions ? JSON.parse(rawReactions) : {};
    const mine = stored[articleSlug] || null;
    webviewRef.current.injectJavaScript(`
      updateReactions(${reactionsData.likes}, ${reactionsData.dislikes}, ${JSON.stringify(mine)});
      updateCommentCount(${commentsData.length});
      true;
    `);

    // Comments
    setComments(commentsData);
  };

  const onMessage = useCallback(async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'open_comments') {
        setCommentsOpen(true);
        return;
      }

      // Reactions persistence
      const {type, prev} = msg;
      if (prev !== 'likes' && prev !== 'dislikes' && type !== 'likes' && type !== 'dislikes') return;
      try {
        const raw = await AsyncStorage.getItem(REACTIONS_KEY).catch(() => null);
        const stored = raw ? JSON.parse(raw) : {};
        if (prev) await submitReaction(articleSlug, prev, -1);
        if (type) await submitReaction(articleSlug, type, 1);
        if (type) { stored[articleSlug] = type; } else { delete stored[articleSlug]; }
        await AsyncStorage.setItem(REACTIONS_KEY, JSON.stringify(stored));
      } catch {
        if (webviewRef.current) {
          webviewRef.current.injectJavaScript(`revertReaction(${JSON.stringify(type)}, ${JSON.stringify(prev)}); true;`);
        }
      }
    } catch {}
  }, [articleSlug]);

  const topPadRef = useRef(topPad);
  if (!html) topPadRef.current = topPad;

  const html = useMemo(
    () => article ? buildHtml(article, topPadRef.current) : null,
    [article],
  );

  const onShare = async () => {
    const s = article.link.replace(/\/$/, '').split('/').pop();
    const appLink = `https://btcchub.vercel.app/news/${s}`;
    Analytics.articleShared(article.title);
    await Share.share({message: `${article.title}\n\n${appLink}`});
  };

  const onShouldStartLoad = (request) => {
    const url = request.url;
    if (url.startsWith('data:') || url.startsWith('about:') || url === 'https://www.btcc.net' || url === 'https://www.btcc.net/') {
      return true;
    }
    Linking.openURL(url);
    return false;
  };

  if (!article || !html) {
    return (
      <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator color={Colors.yellow} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{html, baseUrl: 'https://www.btcc.net'}}
        style={styles.webview}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        mixedContentMode="never"
        onShouldStartLoadWithRequest={onShouldStartLoad}
        onMessage={onMessage}
        onLoad={onWebViewLoad}
      />
      <View style={[styles.statusBarBg, {height: topPad}]} />
      <View style={[styles.topBar, {top: topPad + 4}]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('NewsFeed')}
          accessibilityLabel="Go back"
          accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onShare} accessibilityLabel="Share article" accessibilityRole="button">
          <Icon name="share" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <CommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={comments}
        setComments={setComments}
        articleSlug={articleSlug}
        myAuthorId={myAuthorIdRef.current}
        commenterName={commenterName}
        setCommenterName={setCommenterName}
      />
    </View>
  );
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function sanitise(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\s+style='[^']*'/g, '')
    .replace(/\s+(?:width|height|srcset|sizes|loading|decoding|fetchpriority)="[^"]*"/g, '');
}

function buildHtml(article, topPad) {
  const content = sanitise(article.content || '');
  const heroSection = article.imageUrl
    ? `<div class="hero" style="background-image:url('${article.imageUrl}');">
         <div class="hero-gradient"></div>
         <div class="hero-text">
           <h1>${article.title}</h1>
           <p class="date">${article.pubDate}</p>
         </div>
       </div>`
    : `<div style="padding:${topPad + 50}px 16px 0;">
         <h1>${article.title}</h1>
         <p class="date">${article.pubDate}</p>
       </div>`;

  return `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <style>
      * { box-sizing:border-box; margin:0; padding:0; max-width:100%!important; }
      body { background:#0B0C0F; color:#fff; font-family:-apple-system,sans-serif; font-size:16px; line-height:1.7; padding-top:0; }
      .hero { position:relative; width:100%; min-height:${topPad + 300}px; padding-top:${topPad}px; background-size:cover; background-position:center; display:flex; flex-direction:column; justify-content:flex-end; }
      .hero-gradient { position:absolute; top:0;left:0;right:0;bottom:0; background:linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 30%,transparent 50%,rgba(11,12,15,0.95) 100%); }
      .hero-text { position:relative; z-index:1; padding:0 16px 20px; }
      h1 { font-size:22px; font-weight:700; margin-bottom:6px; line-height:1.3; }
      .date { font-size:13px; color:#8B949E; }
      .divider { height:2px; background:#FEBD02; margin:0 16px 20px; border-radius:2px; }
      .content { padding:0 16px 0; }
      img { width:100%!important; height:auto!important; border-radius:8px; margin:12px 0; display:block; }
      p { margin-bottom:14px; }
      a { color:#FEBD02; text-decoration:none; }
      blockquote { border-left:3px solid #FEBD02; padding-left:14px; margin:16px 0; color:#8B949E; font-style:italic; }
      ul,ol { padding-left:1.5em; background:rgba(255,255,255,0.05); border-left:3px solid #FEBD02; border-radius:6px; padding:14px 14px 14px 28px; margin:16px 0; }
      li { margin-bottom:8px; color:#ccc; }
      iframe { width:100%!important; max-width:100%!important; border:none; }
      video { width:100%!important; height:auto!important; border-radius:8px; margin:12px 0; }
      table { width:100%!important; border-collapse:collapse; margin:16px 0; font-size:14px; }
      th, td { border:1px solid #333; padding:8px 10px; text-align:left; }
      th { background:rgba(255,255,255,0.08); font-weight:700; color:#fff; }
      tr:nth-child(even) { background:rgba(255,255,255,0.03); }
      td { color:#ccc; }
      .source-line { margin-top:24px; padding-top:16px; border-top:1px solid #2A2D44; font-size:12px; color:#8B949E; word-break:break-all; }
      .source-line a { color:#8B949E; text-decoration:underline; }
      .reactions { margin:16px 16px 0; padding:16px 0; border-top:1px solid rgba(255,255,255,0.1); }
      .reactions-label { font-size:12px; font-weight:700; color:#8B949E; letter-spacing:0.5px; text-align:center; margin-bottom:16px; text-transform:uppercase; }
      .reactions-btns { display:flex; justify-content:center; gap:12px; }
      .reaction-btn { display:flex; align-items:center; justify-content:center; gap:8px; flex:1; padding:12px 0; border-radius:32px; background:rgba(255,255,255,0.08); border:none; color:#fff; font-size:15px; font-weight:700; cursor:pointer; transition:background 0.15s,color 0.15s; -webkit-tap-highlight-color:transparent; }
      .reaction-btn.active { background:#FEBD02; color:#020255; }
      .reaction-btn svg { width:20px; height:20px; fill:currentColor; flex-shrink:0; }
      .comments-btn { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:10px; padding:11px 0; border-radius:32px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#8B949E; font-size:14px; font-weight:700; cursor:pointer; letter-spacing:0.3px; -webkit-tap-highlight-color:transparent; }
    </style>
  </head><body>
    ${heroSection}
    <div class="divider"></div>
    <div class="content">
      ${content}
      ${article.sourceUrl ? `<p class="source-line">Source: <a href="${article.sourceUrl}">${article.sourceUrl}</a></p>` : ''}
    </div>
    <div class="reactions">
      <p class="reactions-label">Did you enjoy this article?</p>
      <div class="reactions-btns">
        <button id="btn-dislikes" class="reaction-btn" onclick="react('dislikes')">
          <svg viewBox="0 0 24 24"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
          <span id="count-dislikes">0</span>
        </button>
        <button id="btn-likes" class="reaction-btn" onclick="react('likes')">
          <svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
          <span id="count-likes">0</span>
        </button>
      </div>
      <button class="comments-btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'open_comments'}))">
        💬 <span id="comment-count">0</span> Comments
      </button>
    </div>
    <div style="height:24px;"></div>
    <script>
      var _mine = null;
      var _likes = 0;
      var _dislikes = 0;
      var _interacted = false;

      function updateReactions(likes, dislikes, mine) {
        if (_interacted) return;
        _likes = likes;
        _dislikes = dislikes;
        _mine = mine;
        document.getElementById('count-likes').textContent = likes;
        document.getElementById('count-dislikes').textContent = dislikes;
        document.getElementById('btn-likes').classList.toggle('active', mine === 'likes');
        document.getElementById('btn-dislikes').classList.toggle('active', mine === 'dislikes');
      }

      function updateCommentCount(n) {
        document.getElementById('comment-count').textContent = n;
      }

      function revertReaction(type, prev) {
        _mine = prev;
        if (type) {
          if (type === 'likes') { _likes = Math.max(0, _likes - 1); document.getElementById('count-likes').textContent = _likes; }
          else { _dislikes = Math.max(0, _dislikes - 1); document.getElementById('count-dislikes').textContent = _dislikes; }
        }
        if (prev) {
          if (prev === 'likes') { _likes++; document.getElementById('count-likes').textContent = _likes; }
          else { _dislikes++; document.getElementById('count-dislikes').textContent = _dislikes; }
        }
        document.getElementById('btn-likes').classList.toggle('active', _mine === 'likes');
        document.getElementById('btn-dislikes').classList.toggle('active', _mine === 'dislikes');
      }

      function react(type) {
        var prev = _mine;
        var toggling = (_mine === type);
        if (prev) {
          if (prev === 'likes') { _likes = Math.max(0, _likes - 1); document.getElementById('count-likes').textContent = _likes; }
          else { _dislikes = Math.max(0, _dislikes - 1); document.getElementById('count-dislikes').textContent = _dislikes; }
        }
        if (!toggling) {
          if (type === 'likes') { _likes++; document.getElementById('count-likes').textContent = _likes; }
          else { _dislikes++; document.getElementById('count-dislikes').textContent = _dislikes; }
        }
        _mine = toggling ? null : type;
        document.getElementById('btn-likes').classList.toggle('active', _mine === 'likes');
        document.getElementById('btn-dislikes').classList.toggle('active', _mine === 'dislikes');
        _interacted = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({type: toggling ? null : type, prev: prev}));
      }
    </script>
  </body></html>`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  webview: {flex: 1, backgroundColor: Colors.background},
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  statusBarBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },

  // Sheet
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetOuter: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.92,
    minHeight: SCREEN_HEIGHT * 0.6,
  },
  handleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.outline,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
    gap: 8,
  },
  sheetTitle: {color: '#fff', fontSize: 16, fontWeight: '800', flex: 1},
  sheetNameBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 120},
  sheetNameText: {color: Colors.textSecondary, fontSize: 12, flexShrink: 1},

  // Comments
  commentLoading: {height: 80, justifyContent: 'center', alignItems: 'center'},
  commentList: {flex: 1},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center'},
  commentRow: {paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.outline},
  commentReply: {paddingLeft: 32, flexDirection: 'row'},
  replyLine: {width: 2, backgroundColor: Colors.outline, marginRight: 12, borderRadius: 1},
  commentBody: {flex: 1},
  commentMeta: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6},
  commentAuthor: {color: Colors.textSecondary, fontSize: 14, fontWeight: '700'},
  commentAuthorOwn: {color: Colors.yellow},
  commentTime: {color: Colors.textSecondary, fontSize: 12},
  commentText: {color: '#fff', fontSize: 15, lineHeight: 22},
  commentActions: {flexDirection: 'row', gap: 14, marginTop: 6},
  commentActionBtn: {paddingVertical: 2},
  commentActionText: {color: Colors.textSecondary, fontSize: 12, fontWeight: '600'},

  // Replying bar
  replyingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.outline,
  },
  replyingText: {color: Colors.textSecondary, fontSize: 13},

  // Input
  inputRow: {
    borderTopWidth: 1, borderTopColor: Colors.outline,
    paddingTop: 8, paddingHorizontal: 12, paddingBottom: 8,
  },
  inputError: {color: '#ff6b6b', fontSize: 12, marginBottom: 6, paddingHorizontal: 4},
  inputInner: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  commentInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  sendBtn: {width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.outline},
  sendBtnDisabled: {opacity: 0.4},

  // Name prompt
  namePrompt: {
    borderTopWidth: 1, borderTopColor: Colors.outline,
    padding: 16,
  },
  namePromptTitle: {color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10},
  nameInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.outline,
    marginBottom: 10,
  },
  namePromptBtns: {flexDirection: 'row', gap: 10},
  nameSkipBtn: {flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.outline, alignItems: 'center'},
  nameSkipText: {color: Colors.textSecondary, fontSize: 14, fontWeight: '600'},
  nameSetBtn: {flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.yellow, alignItems: 'center'},
  nameSetText: {color: '#020255', fontSize: 14, fontWeight: '700'},

  // Name edit in header
  nameEditRow: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8},
  nameEditInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#fff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  nameEditSave: {backgroundColor: Colors.yellow, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6},
  nameEditSaveText: {color: '#020255', fontSize: 13, fontWeight: '700'},

  // Delete confirmation
  confirmBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32},
  confirmBox: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  confirmYellow: {height: 3, backgroundColor: Colors.yellow},
  confirmTitle: {color: '#fff', fontSize: 17, fontWeight: '800', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8},
  confirmBody: {color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, paddingBottom: 20},
  confirmBtns: {flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.outline},
  confirmCancel: {flex: 1, paddingVertical: 14, alignItems: 'center', borderRightWidth: 1, borderRightColor: Colors.outline},
  confirmCancelText: {color: Colors.textSecondary, fontSize: 15, fontWeight: '600'},
  confirmDelete: {flex: 1, paddingVertical: 14, alignItems: 'center'},
  confirmDeleteText: {color: '#ff5555', fontSize: 15, fontWeight: '700'},
});
