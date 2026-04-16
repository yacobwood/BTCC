import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal, Linking} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.btccfanhub';

export default function UpdateDialog({visible, onDismiss}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Icon name="system-update" size={36} color={Colors.yellow} style={{marginBottom: 12}} />
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.body}>A new version of BTCC Hub is available on the Play Store with improvements and fixes.</Text>
          <TouchableOpacity
            style={styles.updateBtn}
            onPress={() => Linking.openURL(PLAY_STORE_URL)}
            accessibilityLabel="Update on Play Store"
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', padding: 16},
  card: {backgroundColor: Colors.card, borderRadius: 20, padding: 24, alignItems: 'center'},
  title: {color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8},
  body: {color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24},
  updateBtn: {backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%', marginBottom: 10},
  updateText: {color: Colors.navy, fontSize: 13, fontWeight: '900', letterSpacing: 1},
  dismissBtn: {paddingVertical: 10},
  dismissText: {color: Colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 1},
});
