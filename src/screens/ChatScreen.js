import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import database from '@react-native-firebase/database';

const DB = database();
import {Colors} from '../theme/colors';
import {getFCMToken} from '../utils/notifications';
import {Analytics} from '../utils/analytics';
import {fetchBlacklist} from '../api/client';
import {timeAgo} from '../utils/timeAgo';
import {containsProfanity} from '../utils/profanityFilter';

const COMMENTER_NAME_KEY = 'commenter_name';
const MAX_MESSAGES = 200;

export default function ChatScreen({onClose} = {}) {
  const insets = useSafeAreaInsets();
  // Latch the first non-zero bottom inset so keyboard open/close doesn't cause a layout jump.
  const [stableBottom, setStableBottom] = useState(insets.bottom);
  useEffect(() => {
    if (insets.bottom > 0) setStableBottom(insets.bottom);
  }, [insets.bottom]);
  const [messages, setMessages] = useState(null); // null = loading
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [commenterName, setCommenterName] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameEditing, setNameEditing] = useState(false);
  const [blacklist, setBlacklist] = useState([]);
  const [flaggedIds, setFlaggedIds] = useState(new Set());
  const myAuthorIdRef = useRef('anonymous');
  const [myAuthorId, setMyAuthorId] = useState('anonymous');
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchBlacklist().then(setBlacklist).catch(() => {});
    Analytics.screen('chat');

    // Load identity
    const init = async () => {
      const [savedName, token] = await Promise.all([
        AsyncStorage.getItem(COMMENTER_NAME_KEY).catch(() => null),
        getFCMToken().catch(() => null),
      ]);
      const myId = token ? token.slice(0, 8) : `anon_${Math.random().toString(36).slice(2, 6)}`;
      myAuthorIdRef.current = myId;
      setMyAuthorId(myId);
      if (savedName) setCommenterName(savedName);
    };
    init();

    // Real-time listener
    const ref = DB.ref('/chat/messages');
    ref.orderByChild('timestamp').limitToLast(MAX_MESSAGES).on('value', snap => {
      const msgs = [];
      snap.forEach(c => msgs.push({id: c.key, ...c.val()}));
      setMessages(msgs.filter(m => !m.hidden).reverse()); // newest first for inverted list
    });

    return () => ref.off('value');
  }, []);

  useEffect(() => {
    if (myAuthorId === 'anonymous') return;
    const banRef = DB.ref(`/chat/bans/${myAuthorId}`);
    banRef.on('value', snap => {
      const ban = snap.val();
      if (!ban) { setIsBanned(false); setBanInfo(null); return; }
      const expired = ban.expiresAt !== null && ban.expiresAt < Date.now();
      setIsBanned(!expired);
      setBanInfo(expired ? null : ban);
    });
    return () => banRef.off('value');
  }, [myAuthorId]);

  const saveName = async (name) => {
    const trimmed = name.trim() || `Fan #${myAuthorIdRef.current.slice(-4)}`;
    setCommenterName(trimmed);
    await AsyncStorage.setItem(COMMENTER_NAME_KEY, trimmed);
    return trimmed;
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    if (text.length > 300) { setInputError('Message too long (max 300 characters)'); return; }
    if (containsProfanity(text, blacklist)) { setInputError('Message contains disallowed content'); return; }
    setInputError('');

    let authorName = commenterName;
    if (!authorName) {
      setShowNamePrompt(true);
      return;
    }

    setInput('');
    try {
      await DB.ref('/chat/messages').push({
        text,
        authorId: myAuthorIdRef.current,
        authorName,
        timestamp: database.ServerValue.TIMESTAMP,
        flagCount: 0,
        hidden: false,
      });
      Analytics.chatMessageSent();
    } catch (e) {
      setInputError('Failed to send. Please try again.');
      setInput(text);
    }
  }, [input, commenterName]);

  const handleNameSet = async () => {
    const name = await saveName(nameInput);
    setShowNamePrompt(false);
    setNameEditing(false);
    setNameInput('');
    // Re-trigger send with pending input if applicable
    if (input.trim()) {
      const text = input.trim();
      setInput('');
      try {
        await DB.ref('/chat/messages').push({
          text,
          authorId: myAuthorIdRef.current,
          authorName: name,
          timestamp: database.ServerValue.TIMESTAMP,
          flagCount: 0,
          hidden: false,
        });
      } catch {}
    }
  };

  const handleNameSkip = async () => {
    const name = await saveName('');
    setShowNamePrompt(false);
    setNameEditing(false);
    setNameInput('');
    if (input.trim()) {
      const text = input.trim();
      setInput('');
      try {
        await DB.ref('/chat/messages').push({
          text,
          authorId: myAuthorIdRef.current,
          authorName: name,
          timestamp: database.ServerValue.TIMESTAMP,
          flagCount: 0,
          hidden: false,
        });
      } catch {}
    }
  };

  const handleReply = useCallback((authorName) => {
    setInput(`@${authorName} `);
    inputRef.current?.focus();
  }, []);

  const handleFlag = async (msgId) => {
    if (flaggedIds.has(msgId)) return;
    setFlaggedIds(prev => new Set(prev).add(msgId));
    Analytics.chatMessageFlagged();
    try {
      const idx = messages.findIndex(m => m.id === msgId);
      const flaggedMsg = messages[idx];
      // messages is newest-first; higher indices are older
      const context = messages.slice(idx + 1, idx + 21).reverse();

      await Promise.all([
        DB.ref('/chat/reports').push({
          flaggedMessage: flaggedMsg,
          context,
          reportedAt: database.ServerValue.TIMESTAMP,
        }),
        DB.ref(`/chat/messages/${msgId}`).transaction(msg => {
          if (msg === null) return msg;
          return {...msg, flagCount: (msg.flagCount || 0) + 1};
        }),
      ]);
    } catch {}
  };

  const handleDelete = (msgId) => {
    Alert.alert('Delete message', 'Are you sure you want to delete this message?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        try { await DB.ref(`/chat/messages/${msgId}`).remove(); } catch {}
      }},
    ]);
  };

  const renderMessage = ({item}) => {
    if (item.type === 'ban_notice') {
      return (
        <View style={styles.systemMsg}>
          <Text style={styles.systemMsgText}>{item.text}</Text>
        </View>
      );
    }
    const isOwn = item.authorId === myAuthorId;
    return (
      <View style={styles.msgRow}>
        <View style={styles.msgMeta}>
          <Text style={[styles.msgAuthor, isOwn && styles.msgAuthorOwn]}>{item.authorName}</Text>
          {item.authorId ? <Text style={styles.msgAuthorId}>{` #${item.authorId.slice(-4)}`}</Text> : null}
          <Text style={styles.msgTime}>{timeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.msgText}>{item.text}</Text>
        <View style={styles.msgActions}>
          {!isOwn && (
            <TouchableOpacity onPress={() => handleReply(item.authorName)} accessibilityLabel="Reply" style={styles.msgActionBtn}>
              <Icon name="reply" size={13} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          {!isOwn && (
            <TouchableOpacity onPress={() => handleFlag(item.id)} accessibilityLabel="Flag message" style={styles.msgActionBtn}>
              <Icon name="flag" size={13} color={flaggedIds.has(item.id) ? '#E53935' : Colors.textSecondary} />
            </TouchableOpacity>
          )}
          {isOwn && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.msgActionBtn} accessibilityLabel="Delete message">
              <Icon name="delete-outline" size={13} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close chat" accessibilityRole="button">
            <Icon name="keyboard-arrow-down" size={28} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>LIVE CHAT</Text>
        <TouchableOpacity
          onPress={() => { setNameInput(commenterName || ''); setNameEditing(true); }}
          style={styles.nameBtn}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          {nameEditing ? null : <Icon name="edit" size={15} color={Colors.textSecondary} />}
          {!nameEditing && <Text style={styles.nameBtnText} numberOfLines={1}>{commenterName || 'Set name'}</Text>}
        </TouchableOpacity>
      </View>

      {/* Inline name editing in header */}
      {nameEditing && (
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
          <TouchableOpacity onPress={() => { setNameEditing(false); setNameInput(''); }} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Icon name="close" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.divider} />

      {/* Messages */}
      {messages === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.yellow} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={messages.length === 0 ? styles.emptyContainer : {paddingVertical: 8}}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Say hello! 👋</Text>}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Banned state */}
      {isBanned ? (
        <View style={[styles.inputRow, {paddingBottom: stableBottom + 12, justifyContent: 'center', alignItems: 'center'}]}>
          <Text style={styles.bannedText}>
            {banInfo?.duration === 'permanent'
              ? 'You are permanently banned from this chat.'
              : `You are banned from this chat until ${new Date(banInfo?.expiresAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})}.`}
          </Text>
        </View>
      ) : showNamePrompt ? (
        <View style={[styles.namePrompt, {paddingBottom: stableBottom + 12}]}>
          <Text style={styles.namePromptTitle}>Choose a display name</Text>
          <TextInput
            style={styles.nameInput}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder={`Fan #${myAuthorIdRef.current.slice(-4)}`}
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
            <TouchableOpacity onPress={handleNameSet} style={styles.nameSetBtn} accessibilityLabel="Set name">
              <Text style={styles.nameSetText}>Set name</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
          <View style={[styles.inputRow, {paddingBottom: stableBottom + 12}]}>
            {inputError ? <Text style={styles.inputError}>{inputError}</Text> : null}
            <View style={styles.inputInner}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={input}
                onChangeText={t => { setInput(t); if (inputError) setInputError(''); }}
                placeholder="Say something..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                maxLength={320}
                returnKeyType="default"
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim()}
                accessibilityLabel="Send message"
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}>
                <Icon name="send" size={20} color={input.trim() ? Colors.yellow : Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.surface},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  closeBtn: {padding: 4},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  nameBtn: {flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 140},
  nameBtnText: {color: Colors.textSecondary, fontSize: 12, flexShrink: 1},
  divider: {height: 1, backgroundColor: Colors.outline},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center'},

  // Messages
  msgRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  msgMeta: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  msgAuthor: {color: Colors.textSecondary, fontSize: 13, fontWeight: '700'},
  msgAuthorOwn: {color: Colors.yellow},
  msgAuthorId: {color: Colors.textSecondary, fontSize: 11, fontWeight: '400', opacity: 0.6},
  msgTime: {color: Colors.textSecondary, fontSize: 11},
  msgText: {color: '#fff', fontSize: 15, lineHeight: 22},
  msgActions: {flexDirection: 'row', gap: 14, marginTop: 6},
  msgActionBtn: {paddingVertical: 2},

  // Name editing in header
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
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

  // Name prompt
  namePrompt: {
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
    padding: 16,
    backgroundColor: Colors.surface,
  },
  namePromptTitle: {color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10},
  nameInput: {
    backgroundColor: Colors.card,
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

  // Input footer
  inputRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  inputError: {color: '#ff6b6b', fontSize: 12, marginBottom: 6, paddingHorizontal: 4},
  inputInner: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  textInput: {
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
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.outline,
  },
  sendBtnDisabled: {opacity: 0.4},

  systemMsg: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  systemMsgText: {
    color: '#E53935',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bannedText: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
