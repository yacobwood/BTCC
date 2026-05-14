import React, {useState, useEffect, useRef} from 'react';
import {
  TouchableOpacity, StyleSheet, Modal, View, Dimensions,
  Animated, PanResponder, Pressable, Platform, Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import database from '@react-native-firebase/database';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {useFeatureFlags} from '../store/featureFlags';
import {useSettings} from '../store/settings';
import ChatScreen from '../screens/ChatScreen';

const LAST_READ_KEY = 'chat_last_read';
const DB = database();

const FAB_SIZE = 52;
const FAB_RIGHT = 16;
const FAB_BOTTOM_OFFSET = 12;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function ChatFab({bottomOffset = 0}) {
  const {live_chat} = useFeatureFlags();
  const {settings} = useSettings();

  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const lastReadRef = useRef(Date.now());

  const translateY = useRef(new Animated.Value(0)).current;
  const sheetLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', e => {
      Animated.timing(sheetLift, {toValue: e.endCoordinates.height, duration: 250, useNativeDriver: false}).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      Animated.timing(sheetLift, {toValue: 0, duration: 250, useNativeDriver: false}).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [sheetLift]);

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
          closeChat();
        });
      } else {
        Animated.spring(translateY, {toValue: 0, useNativeDriver: true, bounciness: 4}).start();
      }
    },
  })).current;

  useEffect(() => {
    if (!live_chat || !settings.chatFab) return;

    AsyncStorage.getItem(LAST_READ_KEY).then(v => {
      if (v) lastReadRef.current = parseInt(v, 10);
    }).catch(() => {});

    const ref = DB.ref('/chat/messages');
    ref.orderByChild('timestamp').limitToLast(1).on('value', snap => {
      let latestTs = 0;
      snap.forEach(c => { latestTs = c.val()?.timestamp || 0; });
      setHasUnread(latestTs > lastReadRef.current);
    });

    return () => ref.off('value');
  }, [live_chat, settings.chatFab]);

  const openChat = () => {
    const now = Date.now();
    lastReadRef.current = now;
    AsyncStorage.setItem(LAST_READ_KEY, String(now)).catch(() => {});
    setHasUnread(false);
    translateY.setValue(0);
    setOpen(true);
  };

  const closeChat = () => {
    const now = Date.now();
    lastReadRef.current = now;
    AsyncStorage.setItem(LAST_READ_KEY, String(now)).catch(() => {});
    setHasUnread(false);
    setOpen(false);
  };

  if (!live_chat || !settings.chatFab) return null;

  const fabColor = hasUnread ? Colors.navy : Colors.yellow;

  return (
    <>
      <TouchableOpacity
        onPress={openChat}
        activeOpacity={1}
        style={[styles.fab, {bottom: bottomOffset + FAB_BOTTOM_OFFSET}, hasUnread && styles.fabUnread]}
        accessibilityLabel={hasUnread ? 'Open live chat, new messages' : 'Open live chat'}
        accessibilityRole="button">
        <Icon name="chat-bubble" size={22} color={fabColor} />
        {hasUnread && <View style={styles.badge} />}
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={closeChat}
        statusBarTranslucent>
        <SafeAreaProvider>
        <Pressable style={styles.backdrop} onPress={closeChat} />
        <Animated.View style={[styles.sheetOuter, {bottom: sheetLift}]}>
          {/* FAB above the sheet */}
          <TouchableOpacity
            onPress={closeChat}
            activeOpacity={1}
            style={[styles.fabClose, hasUnread && styles.fabUnread]}
            accessibilityLabel="Close live chat"
            accessibilityRole="button">
            <Icon name="chat-bubble" size={22} color={fabColor} />
          </TouchableOpacity>
          {/* Sheet */}
          <Animated.View style={[styles.sheet, {transform: [{translateY}]}]}>
            <View style={styles.handleWrap} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>
            <ChatScreen onClose={closeChat} />
          </Animated.View>
        </Animated.View>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: FAB_RIGHT,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabClose: {
    alignSelf: 'flex-end',
    marginRight: FAB_RIGHT,
    marginBottom: 8,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabUnread: {
    backgroundColor: Colors.yellow,
    borderColor: Colors.yellow,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935',
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
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
});
