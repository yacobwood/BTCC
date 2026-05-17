import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {ASK_BTCC_AI_URL} from '../config/firebase';

export default function AskAIScreen() {
  const insets = useSafeAreaInsets();
  const [stableBottom, setStableBottom] = useState(insets.bottom);
  React.useEffect(() => {
    if (insets.bottom > 0) setStableBottom(insets.bottom);
  }, [insets.bottom]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg = {id: `u_${Date.now()}`, role: 'user', text: question};
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch(ASK_BTCC_AI_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question}),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      const aiMsg = {id: `a_${Date.now()}`, role: 'assistant', text: data.answer};
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({item}) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>C</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          {!isUser && <Text style={styles.bubbleName}>Colin</Text>}
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {messages.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyAvatar}>
            <Text style={styles.emptyAvatarText}>C</Text>
          </View>
          <Text style={styles.emptyTitle}>Ask Colin</Text>
          <Text style={styles.emptySubtitle}>Ask anything about the BTCC</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({animated: true})}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>C</Text>
          </View>
          <View style={[styles.bubble, styles.bubbleAi, styles.typingBubble]}>
            <ActivityIndicator size="small" color={Colors.yellow} />
          </View>
        </View>
      )}

      <View style={[styles.inputRow, {paddingBottom: stableBottom + 12}]}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.inputInner}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={t => { setInput(t); if (error) setError(''); }}
            placeholder="Ask a BTCC question..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={500}
            returnKeyType="default"
            editable={!loading}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || loading}
            accessibilityLabel="Send question"
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}>
            <Icon name="send" size={20} color={input.trim() && !loading ? Colors.yellow : Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.surface},

  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10},
  emptyAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.yellow,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  emptyAvatarText: {color: Colors.navy, fontSize: 24, fontWeight: '900'},
  emptyTitle: {color: '#fff', fontSize: 18, fontWeight: '800'},
  emptySubtitle: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center'},

  listContent: {padding: 12, gap: 12},

  bubbleRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8},
  bubbleRowUser: {justifyContent: 'flex-end'},
  bubbleRowAi: {justifyContent: 'flex-start'},

  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.yellow,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {color: Colors.navy, fontSize: 13, fontWeight: '900'},

  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: Colors.navy,
    borderWidth: 1,
    borderColor: Colors.yellow,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.outline,
    borderBottomLeftRadius: 4,
  },
  bubbleName: {color: Colors.yellow, fontSize: 11, fontWeight: '700', marginBottom: 4},
  bubbleText: {color: '#fff', fontSize: 14, lineHeight: 20},
  bubbleTextUser: {color: '#fff'},

  typingRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingBottom: 4},
  typingBubble: {paddingVertical: 12, paddingHorizontal: 16},

  inputRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  errorText: {color: '#ff6b6b', fontSize: 12, marginBottom: 6, paddingHorizontal: 4},
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
