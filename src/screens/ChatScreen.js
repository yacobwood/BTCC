import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import database from '@react-native-firebase/database';

const DB = database();
import {Colors} from '../theme/colors';
import {getFCMToken} from '../utils/notifications';
import {Analytics} from '../utils/analytics';

const BLACKLIST = require('../../data/blacklist.json');
const COMMENTER_NAME_KEY = 'commenter_name';
const MAX_MESSAGES = 200;

function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function containsProfanity(text) {
  const lower = text.toLowerCase();
  return BLACKLIST.some(w => lower.includes(w));
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState(null); // null = loading
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [commenterName, setCommenterName] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameEditing, setNameEditing] = useState(false);
  const myAuthorIdRef = useRef('anonymous');
  const listRef = useRef(null);

  useEffect(() => {
    Analytics.screen('chat');

    // Load identity
    const init = async () => {
      const [savedName, token] = await Promise.all([
        AsyncStorage.getItem(COMMENTER_NAME_KEY).catch(() => null),
        getFCMToken().catch(() => null),
      ]);
      const myId = token ? token.slice(0, 8) : `anon_${Math.random().toString(36).slice(2, 6)}`;
      myAuthorIdRef.current = myId;
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
    if (containsProfanity(text)) { setInputError('Message contains disallowed content'); return; }
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
    await saveName('');
    setShowNamePrompt(false);
    setNameEditing(false);
    setNameInput('');
    handleSend();
  };

  const handleFlag = async (msgId, current) => {
    const newCount = (current.flagCount || 0) + 1;
    try {
      await DB.ref(`/chat/messages/${msgId}`).update({
        flagCount: newCount,
        hidden: newCount >= 3,
      });
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
    const isOwn = item.authorId === myAuthorIdRef.current;
    return (
      <View style={styles.msgRow}>
        <View style={styles.msgMeta}>
          <Text style={[styles.msgAuthor, isOwn && styles.msgAuthorOwn]}>{item.authorName}</Text>
          <Text style={styles.msgTime}>{timeAgo(item.timestamp)}</Text>
        </View>
        <Text style={styles.msgText}>{item.text}</Text>
        <View style={styles.msgActions}>
          {!isOwn && (
            <TouchableOpacity onPress={() => handleFlag(item.id, item)} style={styles.msgActionBtn}>
              <Icon name="flag" size={13} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          {isOwn && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.msgActionBtn}>
              <Icon name="delete-outline" size={13} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Header */}
      <View style={styles.header}>
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

      {/* Name prompt */}
      {showNamePrompt ? (
        <View style={styles.namePrompt}>
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
            <TouchableOpacity onPress={handleNameSet} style={styles.nameSetBtn}>
              <Text style={styles.nameSetText}>Set name</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.bottom}>
          <View style={[styles.inputRow, {paddingBottom: Platform.OS === 'ios' ? (insets.bottom || 12) : 12}]}>
            {inputError ? <Text style={styles.inputError}>{inputError}</Text> : null}
            <View style={styles.inputInner}>
              <TextInput
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
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}>
                <Icon name="send" size={20} color={input.trim() ? Colors.yellow : Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
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
});
