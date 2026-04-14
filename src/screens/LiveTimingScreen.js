import React, {useState, useEffect} from 'react';
import {View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Linking} from 'react-native';
import {WebView} from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {useFeatureFlags} from '../store/featureFlags';

export default function LiveTimingScreen({route, navigation}) {
  const {eventId} = route.params;
  const {live_timing_in_app} = useFeatureFlags();
  const [loading, setLoading] = useState(true);
  const url = `https://livetiming.tsl-timing.com/${eventId}`;

  useEffect(() => { Analytics.screen('live_timing:' + eventId); }, []);

  useEffect(() => {
    if (!live_timing_in_app) {
      Linking.openURL(url);
      navigation.goBack();
    }
  }, [live_timing_in_app]);

  if (!live_timing_in_app) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LIVE TIMING</Text>
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      )}
      <WebView
        source={{uri: url}}
        onLoadEnd={() => setLoading(false)}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 8},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1},
  webview: {flex: 1},
  loadingOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1},
});
