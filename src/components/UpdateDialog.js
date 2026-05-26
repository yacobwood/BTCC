import React, {useRef, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Linking, Platform, Animated} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';

export default function UpdateDialog({visible, onDismiss}) {
  const cardY = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      cardY.setValue(400);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(cardY, {toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20}),
        Animated.timing(overlayOpacity, {toValue: 1, duration: 150, useNativeDriver: true}),
      ]).start();
    }
  }, [visible, cardY, overlayOpacity]);

  if (!visible) return null;

  const storeUrl = Platform.OS === 'ios'
    ? 'https://apps.apple.com/gb/app/btcc-hub/id6762619368'
    : 'https://play.google.com/store/apps/details?id=com.btccfanhub';
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store';

  return (
    <Animated.View style={[styles.overlay, {opacity: overlayOpacity}]}>
      <Animated.View style={[styles.card, {transform: [{translateY: cardY}]}]}>
        <Icon name="system-update" size={36} color={Colors.yellow} style={{marginBottom: 12}} />
        <Text style={styles.title}>Update Available</Text>
        <Text style={styles.body}>A new version of BTCC Hub is available on the {storeName} with improvements and fixes.</Text>
        <TouchableOpacity
          style={styles.updateBtn}
          onPress={() => Linking.openURL(storeUrl)}
          accessibilityLabel={`Update on ${storeName}`}
          accessibilityRole="button">
          <Text style={styles.updateText}>UPDATE NOW</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={onDismiss}
          accessibilityLabel="Dismiss"
          accessibilityRole="button">
          <Text style={styles.dismissText}>NOT NOW</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', padding: 16},
  card: {backgroundColor: Colors.card, borderRadius: 20, padding: 24, alignItems: 'center'},
  title: {color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8},
  body: {color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24},
  updateBtn: {backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%', marginBottom: 10},
  updateText: {color: Colors.navy, fontSize: 13, fontWeight: '900', letterSpacing: 1},
  dismissBtn: {paddingVertical: 10},
  dismissText: {color: Colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 1},
});
