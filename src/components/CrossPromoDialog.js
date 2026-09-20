import React, {useRef, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Linking, Image, Animated} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';

// Same-developer cross-promotion, not a paid sponsorship - the wording here
// matters: "sponsored by" or "in association with" would claim a formal
// relationship between two companies that doesn't exist. This is honestly
// just "here's another app I made", styled to match UpdateDialog/
// OnboardingDialog's own bottom-sheet pattern. Shown once ever, gated
// behind onboarding already being complete (see App.tsx) so it never
// stacks onto a brand-new user's very first launch.
//
// TicketStack isn't published on either store yet (still version 0.0.1 in
// its own package.json) - the Play Store link below will 404 until it is.
// Update TICKETSTACK_PLAY_URL once it has a real listing.
const TICKETSTACK_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.ticketstackapp';

export default function CrossPromoDialog({visible, onDismiss}) {
  const {bottom: bottomInset} = useSafeAreaInsets();
  const cardY = useRef(new Animated.Value(400)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Analytics.screen('cross_promo_ticketstack');
      cardY.setValue(400);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(cardY, {toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20}),
        Animated.timing(overlayOpacity, {toValue: 1, duration: 150, useNativeDriver: true}),
      ]).start();
    }
  }, [visible, cardY, overlayOpacity]);

  if (!visible) return null;

  const handleCheckItOut = () => {
    Analytics.crossPromoChoiceMade('ticketstack', 'check_it_out');
    Linking.openURL(TICKETSTACK_PLAY_URL);
    onDismiss();
  };

  const handleDismiss = () => {
    Analytics.crossPromoChoiceMade('ticketstack', 'dismiss');
    onDismiss();
  };

  return (
    <Animated.View style={[styles.overlay, {opacity: overlayOpacity, paddingBottom: Math.max(16, bottomInset + 16)}]}>
      <Animated.View style={[styles.card, {transform: [{translateY: cardY}]}]}>
        <Image source={require('../assets/crosspromo/ticketstack_icon.png')} style={styles.icon} />
        <Text style={styles.eyebrow}>ALSO BY THE SAME DEVELOPER</Text>
        <Text style={styles.title}>TicketStack</Text>
        <Text style={styles.body}>Keep a permanent, photo-backed record of every ticket you've collected - concerts, sport, theatre and more.</Text>
        <TouchableOpacity
          style={styles.checkBtn}
          onPress={handleCheckItOut}
          accessibilityLabel="Check out TicketStack on the Play Store"
          accessibilityRole="button">
          <Text style={styles.checkText}>CHECK IT OUT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={handleDismiss}
          accessibilityLabel="Dismiss"
          accessibilityRole="button">
          <Text style={styles.dismissText}>MAYBE LATER</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', padding: 16, paddingBottom: 16},
  card: {backgroundColor: Colors.card, borderRadius: 20, padding: 24, alignItems: 'center'},
  icon: {width: 64, height: 64, borderRadius: 14, marginBottom: 14},
  eyebrow: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4},
  title: {color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8},
  body: {color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24},
  checkBtn: {backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%', marginBottom: 10},
  checkText: {color: Colors.navy, fontSize: 13, fontWeight: '900', letterSpacing: 1},
  dismissBtn: {paddingVertical: 10},
  dismissText: {color: Colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 1},
});
