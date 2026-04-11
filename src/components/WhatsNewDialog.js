import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal, FlatList} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';

const CHANGELOG = {
  42: [
    'Podcasts — listen to BTCC radio commentary and race reviews',
    'Podcast alerts — get notified when a new episode drops',
    'Notification deep-links — tapping a race or news alert now takes you straight to the right screen',
  ],
  35: [
    'React Native rewrite — same features, cross-platform ready',
    'Improved performance and image loading',
    'Offline caching for calendar, standings, and news',
    'New championship progression chart with SVG',
    'Redesigned race results with FL/L/P badges',
    'Full accessibility labels on every screen',
  ],
};

export default function WhatsNewDialog({visible, onDismiss, versionCode = 35}) {
  const changes = CHANGELOG[versionCode] || [];
  if (changes.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>What's New</Text>
          <Text style={styles.version}>Version 2.2.0</Text>
          <FlatList
            data={changes}
            keyExtractor={(_, i) => String(i)}
            renderItem={({item}) => (
              <View style={styles.changeRow}>
                <Icon name="check-circle" size={16} color={Colors.yellow} />
                <Text style={styles.changeText}>{item}</Text>
              </View>
            )}
            style={{maxHeight: 300}}
          />
          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} accessibilityLabel="Dismiss" accessibilityRole="button">
            <Text style={styles.dismissText}>GOT IT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', padding: 16},
  card: {backgroundColor: Colors.card, borderRadius: 20, padding: 24},
  title: {color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4},
  version: {color: Colors.textSecondary, fontSize: 12, marginBottom: 16},
  changeRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12},
  changeText: {color: '#fff', fontSize: 14, lineHeight: 20, flex: 1},
  dismissBtn: {backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16},
  dismissText: {color: Colors.navy, fontSize: 13, fontWeight: '900', letterSpacing: 1},
});
