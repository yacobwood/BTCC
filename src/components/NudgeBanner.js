import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';

// Small dismissible inline banner, shared by any lightweight re-engagement
// nudge that isn't worth a native permission-style dialog (contrast with
// OnboardingDialog/reviewPrompt.js's native InAppReview).
export default function NudgeBanner({visible, message, actionLabel, onAction, onDismiss}) {
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {!!actionLabel && (
          <TouchableOpacity onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Icon name="close" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.yellow,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  message: {flex: 1, color: '#fff', fontSize: 13, fontWeight: '600', marginRight: 12},
  actions: {flexDirection: 'row', alignItems: 'center', gap: 14},
  actionText: {color: Colors.yellow, fontSize: 13, fontWeight: '800'},
});
