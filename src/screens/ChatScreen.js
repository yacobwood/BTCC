import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
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
import auth from '@react-native-firebase/auth';
import {useAuth} from '../store/auth';
import {saveProfile, claimUsername, validateUsername} from '../utils/userProfile';
import {Analytics} from '../utils/analytics';
import {fetchBlacklist} from '../api/client';
import {timeAgo} from '../utils/timeAgo';
import {containsProfanity} from '../utils/profanityFilter';
import {cacheRead, cacheWrite} from '../store/cache';

const COMMENTER_NAME_KEY = 'commenter_name';
const MAX_MESSAGES = 200;
// Bridges the gap before the live RTDB listener's first snapshot arrives -
// bounded generously since the live listener always supersedes it within
// moments once it fires; this only guards against showing chat history from
// literally the last time the device was online if it's been unusually long.
const MESSAGES_CACHE_KEY = 'chat_messages';
const MESSAGES_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export default function ChatScreen({onClose} = {}) {
  const {user} = useAuth();
  const insets = useSafeAreaInsets();
  // Latch the first non-zero bottom inset so keyboard open/close doesn't cause a layout jump.
  const [stableBottom, setStableBottom] = useState(insets.bottom);
  useEffect(() => {
    if (insets.bottom > 0) setStableBottom(insets.bottom);
  }, [insets.bottom]);
  const [messages, setMessages] = useState(null); // null = loading
  // authorId -> current display name, kept live so a rename applies to that
  // author's past messages too - each message's own `authorName` field is
  // an immutable snapshot (enforced by database.rules.json) and only used
  // as a fallback for authors who've never (re)named themselves since this
  // map existed.
  const [authorNames, setAuthorNames] = useState({});
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [commenterName, setCommenterName] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameEditing, setNameEditing] = useState(false);
  const [nameError, setNameError] = useState('');
  const [blacklist, setBlacklist] = useState([]);
  const [flaggedIds, setFlaggedIds] = useState(new Set());
  const myAuthorIdRef = useRef('anonymous');
  const [myAuthorId, setMyAuthorId] = useState('anonymous');
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  // @mention autocomplete: cursorPos tracks the cursor so the mention query
  // (derived below, alongside chatParticipants) is computed relative to
  // where the user is actually typing, not just the end of the input - a
  // mention can be typed anywhere mid-message, not only at the start.
  const [cursorPos, setCursorPos] = useState(0);

  useEffect(() => {
    fetchBlacklist().then(setBlacklist).catch(() => {});
    Analytics.screen('chat');

    // Load identity
    const init = async () => {
      let savedName = await AsyncStorage.getItem(COMMENTER_NAME_KEY).catch(() => null);
      const currentUser = auth().currentUser;
      const myId = currentUser?.uid || 'anonymous';
      myAuthorIdRef.current = myId;
      setMyAuthorId(myId);

      // Migrate pre-uniqueness names: claim the name in Firestore if not yet claimed.
      // If someone else grabbed it first, clear it so the user is prompted to choose a new one.
      if (savedName && currentUser && !currentUser.isAnonymous && !savedName.startsWith('Fan #')) {
        const result = await claimUsername(currentUser.uid, savedName, null);
        if (result === 'taken') {
          await AsyncStorage.removeItem(COMMENTER_NAME_KEY).catch(() => {});
          savedName = null;
        }
      }

      if (savedName) setCommenterName(savedName);
    };
    init();

    // Instant-render bridge: unlike every other data screen in this app,
    // ChatScreen had no local cache at all - opening it always waited on a
    // live round-trip against the full MAX_MESSAGES window with a blank
    // spinner in the meantime, which is what "sometimes takes a while to
    // load" actually was (RTDB connection/latency variance, not a bug).
    // ChatFab's own listener keeps the RTDB connection warm in the
    // background, but its query (limitToLast(1)) is a different cached
    // query than this screen's, so it doesn't help here.
    cacheRead(MESSAGES_CACHE_KEY, MESSAGES_CACHE_MAX_AGE_MS).then(cached => {
      if (cached) setMessages(prev => (prev === null ? cached : prev));
    }).catch(() => {});

    // Real-time listener
    const ref = DB.ref('/chat/messages');
    ref.orderByChild('timestamp').limitToLast(MAX_MESSAGES).on('value', snap => {
      const msgs = [];
      snap.forEach(c => msgs.push({id: c.key, ...c.val()}));
      const visible = msgs.filter(m => !m.hidden).reverse(); // newest first for inverted list
      setMessages(visible);
      cacheWrite(MESSAGES_CACHE_KEY, visible);
    });

    // Live authorId -> current name map, so renames apply retroactively
    const namesRef = DB.ref('/chat/authorNames');
    namesRef.on('value', snap => { setAuthorNames(snap.val() || {}); });

    return () => { ref.off('value'); namesRef.off('value'); };
  }, []);

  // Current display name for a given message, resolved live by authorId -
  // falls back to that message's own stored snapshot for authors who
  // haven't (re)named themselves since the authorNames map existed.
  const resolveAuthorName = useCallback(
    (msg) => authorNames[msg.authorId] || msg.authorName,
    [authorNames],
  );

  // Everyone with a visible message in the currently loaded chat history,
  // by their current (live) name, alphabetically - source for the @mention
  // autocomplete list. Excludes yourself (mentioning yourself never
  // notifies anyone - see resolveMentionedAuthorIds in
  // functions/chatMentions.js) and ban_notice system messages (authorId
  // 'system' never has a real name registered).
  const chatParticipants = useMemo(() => {
    if (!messages) return [];
    const seen = new Set();
    const names = [];
    for (const msg of messages) {
      if (msg.type === 'ban_notice' || msg.authorId === myAuthorId) continue;
      const name = resolveAuthorName(msg);
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [messages, myAuthorId, resolveAuthorName]);

  // Derived synchronously during render rather than via a useEffect+setState
  // pair - the earlier version set mentionQuery/mentionStart from an effect
  // that only ran after the input-change render had already committed,
  // forcing a second render pass for every keystroke (and for the @ button
  // and Reply, which set input/cursorPos programmatically) before the
  // dropdown could appear. That extra round trip was invisible in fast dev
  // conditions but read as a real, noticeable delay on-device. Computing it
  // inline means the mention state is correct in the very same render that
  // picked up the new input/cursor position - no lag, no intermediate frame
  // where the text has updated but the mention state hasn't caught up yet.
  //
  // Finds the nearest "@" at or before the cursor with no line break since,
  // and treats everything between it and the cursor as the in-progress
  // mention query.
  const mentionMatch = useMemo(() => {
    const uptoCursor = input.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    if (atIndex === -1) return null;
    const between = uptoCursor.slice(atIndex + 1);
    if (between.includes('\n')) return null;
    return {start: atIndex, query: between};
  }, [input, cursorPos]);
  const mentionQuery = mentionMatch?.query ?? null;
  const mentionStart = mentionMatch?.start ?? null;

  // Naturally closes itself once the query no longer prefixes any candidate
  // - e.g. once a full name plus its trailing space has been typed - without
  // needing to special-case "the user just finished typing a mention".
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return chatParticipants.filter(name => name.toLowerCase().startsWith(q));
  }, [mentionQuery, chatParticipants]);

  const selectMention = useCallback((name) => {
    if (mentionStart === null) return;
    const before = input.slice(0, mentionStart);
    const after = input.slice(cursorPos);
    const mention = `@${name} `;
    const newText = `${before}${mention}${after}`;
    const newCursor = before.length + mention.length;
    setInput(newText);
    setCursorPos(newCursor);
    // No explicit "close the dropdown" step needed - mentionMatch/mentionQuery
    // recompute for the new input+cursorPos on the next render, and since the
    // inserted text always ends in a space, the new query ("Name ") no
    // longer prefixes any candidate, so mentionCandidates comes back empty
    // and the dropdown hides itself the same way it would after normal typing.
    Analytics.chatMentionSuggestionSelected();
    // Controlled `selection` isn't used on the TextInput day-to-day (it fights
    // normal typing), so the native cursor is repositioned imperatively just
    // this once, after the text it needs to land after has actually committed.
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({selection: {start: newCursor, end: newCursor}});
    });
  }, [input, mentionStart, cursorPos]);

  // Inserts "@" at the last known cursor position and focuses the input -
  // the existing mentionQuery effect picks up the new "@" on its own and
  // opens the suggestion dropdown with the full participant list, exactly
  // as if the user had typed "@" themselves.
  const insertMentionTrigger = useCallback(() => {
    const before = input.slice(0, cursorPos);
    const after = input.slice(cursorPos);
    const newText = `${before}@${after}`;
    const newCursor = cursorPos + 1;
    setInput(newText);
    setCursorPos(newCursor);
    // Deferred rather than called immediately - see the identical comment in
    // handleReply. Same root cause here: .focus() synchronously kicking off
    // the native show-keyboard animation appears to hold up the "@" actually
    // painting until that gets underway.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setNativeProps({selection: {start: newCursor, end: newCursor}});
    });
  }, [input, cursorPos]);

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

    // Validate and enforce uniqueness for non-empty names on non-anonymous accounts
    if (name.trim() && user && !user.isAnonymous) {
      const validationError = validateUsername(trimmed);
      if (validationError) {
        setNameError(validationError);
        return null;
      }
      const result = await claimUsername(user.uid, trimmed, commenterName || null);
      if (result === 'taken') {
        setNameError('That name is already taken');
        return null;
      }
      if (result === 'error') {
        setNameError('Could not save name. Please try again.');
        return null;
      }
    } else {
      await AsyncStorage.setItem(COMMENTER_NAME_KEY, trimmed);
    }

    setNameError('');
    setCommenterName(trimmed);
    // Best-effort - if this write fails (offline, rules hiccup), the new name
    // still applies to future messages via commenterName; only the retroactive
    // relabelling of past messages is missed.
    DB.ref(`/chat/authorNames/${myAuthorIdRef.current}`).set(trimmed).catch(() => {});
    return trimmed;
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    if (text.length > 500) { setInputError('Message too long (max 500 characters)'); return; }
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
    if (name === null) return; // validation or uniqueness error - nameError is set
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
    const text = `@${authorName} `;
    setInput(text);
    // Keep the derived mention state in sync with the replacement text
    // rather than whatever cursor position was left over from before this
    // full-input replacement, which could otherwise briefly reopen the
    // suggestion dropdown against a stale slice of the new text.
    setCursorPos(text.length);
    // Deferred rather than called immediately: when the input wasn't already
    // focused, .focus() kicks off the native show-keyboard animation
    // synchronously, and on this device that appears to visibly hold up the
    // text update committing until the animation gets underway - a quarter
    // to half a second of the "@Name " text seeming not to appear at all.
    // Letting the text change paint first, then focusing, decouples the two.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
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
    const authorName = resolveAuthorName(item);
    return (
      <View style={styles.msgRow}>
        <View style={styles.msgMeta}>
          <Text style={[styles.msgAuthor, isOwn && styles.msgAuthorOwn]}>{authorName}</Text>
          <Text style={styles.msgTime}>{timeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.msgText}>{item.text}</Text>
        <View style={styles.msgActions}>
          {!isOwn && (
            <TouchableOpacity onPress={() => handleFlag(item.id)} accessibilityLabel="Flag message" style={styles.msgActionBtn}>
              <Icon name="flag" size={13} color={flaggedIds.has(item.id) ? '#E53935' : Colors.textSecondary} />
            </TouchableOpacity>
          )}
          {!isOwn && (
            <TouchableOpacity onPress={() => handleReply(authorName)} accessibilityLabel="Reply" style={styles.msgActionBtn}>
              <Icon name="reply" size={13} color={Colors.textSecondary} />
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
            style={[styles.nameEditInput, nameError ? styles.nameEditInputError : null]}
            value={nameInput}
            onChangeText={v => { setNameInput(v); if (nameError) setNameError(''); }}
            placeholder="Your display name"
            placeholderTextColor={Colors.textSecondary}
            autoFocus
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={handleNameSet}
          />
          <TouchableOpacity onPress={handleNameSet} style={styles.nameEditSave}>
            <Text style={styles.nameEditSaveText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setNameEditing(false); setNameInput(''); setNameError(''); }} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <Icon name="close" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
      {nameEditing && nameError ? (
        <Text style={styles.nameErrorText}>{nameError}</Text>
      ) : null}

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
            style={[styles.nameInput, nameError ? {borderColor: '#ff6b6b'} : null]}
            value={nameInput}
            onChangeText={v => { setNameInput(v); if (nameError) setNameError(''); }}
            placeholder={`Fan #${myAuthorIdRef.current.slice(-4)}`}
            placeholderTextColor={Colors.textSecondary}
            autoFocus
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={handleNameSet}
          />
          {nameError ? <Text style={styles.nameErrorText}>{nameError}</Text> : null}
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
            {mentionQuery !== null && mentionCandidates.length > 0 && (
              <View style={styles.mentionList} testID="mention-suggestions">
                <FlatList
                  data={mentionCandidates}
                  keyExtractor={item => item}
                  keyboardShouldPersistTaps="handled"
                  style={styles.mentionListInner}
                  renderItem={({item}) => (
                    <TouchableOpacity
                      style={styles.mentionItem}
                      onPress={() => selectMention(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Mention ${item}`}>
                      <Icon name="alternate-email" size={13} color={Colors.textSecondary} />
                      <Text style={styles.mentionItemText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
            {inputError ? <Text style={styles.inputError}>{inputError}</Text> : null}
            <View style={styles.inputInner}>
              <TouchableOpacity
                onPress={insertMentionTrigger}
                accessibilityLabel="Mention someone"
                accessibilityRole="button"
                style={styles.mentionBtn}>
                <Icon name="alternate-email" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={input}
                onChangeText={t => { setInput(t); if (inputError) setInputError(''); }}
                onSelectionChange={e => setCursorPos(e.nativeEvent.selection.start)}
                placeholder="Say something..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                maxLength={520}
                returnKeyType="default"
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim()}
                accessibilityLabel="Send message"
                style={styles.sendBtn}>
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
  nameEditInputError: {borderColor: '#ff6b6b'},
  nameErrorText: {color: '#ff6b6b', fontSize: 12, paddingHorizontal: 16, paddingBottom: 6},

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

  // @mention autocomplete
  mentionList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: Colors.outline,
    borderRadius: 10,
    backgroundColor: Colors.card,
    marginBottom: 8,
    overflow: 'hidden',
  },
  mentionListInner: {flexGrow: 0},
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  mentionItemText: {color: '#fff', fontSize: 14},

  inputInner: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  mentionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.outline,
  },
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
