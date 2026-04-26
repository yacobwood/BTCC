import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';

export default function SpoilerClearedDialog({visible, onDismiss}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Icon name="notifications-active" size={36} color={Colors.yellow} style={{marginBottom: 12}} />
          <Text style={styles.title}>No Spoilers Disabled</Text>
          <Text style={styles.body}>Result notifications have been re-enabled now that you've opened the app.</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={onDismiss}
            accessibilityLabel="Got it"
            accessibilityRole="button">
            <Text style={styles.btnText}>GOT IT</Text>
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
  btn: {backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%'},
  btnText: {color: Colors.navy, fontSize: 13, fontWeight: '900', letterSpacing: 1},
});
