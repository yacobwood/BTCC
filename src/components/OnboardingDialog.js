import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';

export default function OnboardingDialog({visible, onAllow, onSkip}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="notifications-active" size={36} color={Colors.yellow} />
          </View>
          <Text style={styles.title}>Stay in the loop</Text>
          <Text style={styles.body}>
            BTCC Hub can send you notifications for:{'\n\n'}
            🏁 Race session start times{'\n'}
            📰 Breaking news articles{'\n'}
            🏆 Results after each round{'\n'}
            📅 Weekend preview reminders{'\n\n'}
            You can customise these anytime in Settings.
          </Text>
          <TouchableOpacity style={styles.allowBtn} onPress={onAllow} accessibilityLabel="Allow notifications" accessibilityRole="button">
            <Text style={styles.allowText}>ALLOW NOTIFICATIONS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip} accessibilityLabel="Skip for now" accessibilityRole="button">
            <Text style={styles.skipText}>MAYBE LATER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24},
  card: {backgroundColor: Colors.card, borderRadius: 20, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center'},
  iconWrap: {width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(254,189,2,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 16},
  title: {color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12},
  body: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20},
  allowBtn: {backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 14, width: '100%', alignItems: 'center'},
  allowText: {color: Colors.navy, fontSize: 13, fontWeight: '900', letterSpacing: 1},
  skipBtn: {paddingVertical: 12, width: '100%', alignItems: 'center'},
  skipText: {color: Colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1},
});
