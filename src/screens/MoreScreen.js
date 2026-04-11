import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {useFocusEffect} from '@react-navigation/native';
import {Analytics} from '../utils/analytics';
import {useFeatureFlags} from '../store/featureFlags';

const pagesData = require('../assets/pages.json');

const iconMap = {
  info: 'info',
  history: 'history',
  directions_car: 'directions-car',
  eco: 'eco',
  leaderboard: 'leaderboard',
  school: 'school',
};

export default function MoreScreen({navigation}) {
  const {radio_tab, podcasts_enabled} = useFeatureFlags();
  const [pages, setPages] = useState([]);
  const scrollRef = useRef(null);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({y: 0, animated: false});
  }, []));

  useEffect(() => { Analytics.screen('more'); }, []);

  useEffect(() => {
    const parsed = (pagesData.pages || []).map(p => ({
      id: p.id || '',
      title: p.title || '',
      icon: p.icon || 'info',
      sections: (p.sections || []).map(s => ({
        type: s.type || '',
        body: s.body || '',
        url: s.url || '',
      })),
    }));
    setPages(parsed);
  }, []);

  const openPage = (page) => {
    navigation.navigate('InfoPage', {page});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MORE</Text>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{padding: 16}}>
        {/* New to BTCC */}
        <Text style={styles.sectionTitle}>NEW HERE?</Text>
        {pages.filter(p => p.id === 'new-to-btcc').map(p => (
          <MoreRow key={p.id} label={p.title} icon="school" onPress={() => { Analytics.moreItemClicked(p.id); openPage(p); }} />
        ))}

        <View style={styles.divider} />

        {/* About BTCC pages */}
        <Text style={styles.sectionTitle}>ABOUT BTCC</Text>
        {pages.filter(p => p.id !== 'new-to-btcc' && !p.id.startsWith('btcc-') && p.id !== 'championships').map(p => (
          <MoreRow key={p.id} label={p.title} icon={iconMap[p.icon] || 'info'} onPress={() => { Analytics.moreItemClicked(p.id); openPage(p); }} />
        ))}

        <View style={styles.divider} />

        {/* App section */}
        <Text style={styles.sectionTitle}>APP</Text>
        {radio_tab && <MoreRow label="Radio" icon="radio" onPress={() => { Analytics.moreItemClicked('radio'); navigation.navigate('Radio'); }} />}
        {podcasts_enabled && <MoreRow label="Podcasts & Interviews" icon="mic" onPress={() => { Analytics.moreItemClicked('podcasts'); navigation.navigate('Podcasts'); }} />}
        <MoreRow label="Settings" icon="settings" onPress={() => { Analytics.moreItemClicked('settings'); navigation.navigate('Settings'); }} />
        <MoreRow label="Feedback & Bugs" icon="bug-report" onPress={() => { Analytics.moreItemClicked('bug_report'); navigation.navigate('BugReport'); }} />

        <View style={styles.divider} />

        {/* Support */}
        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <MoreRow label="Buy me a coffee" icon="local-cafe" onPress={() => { Analytics.moreItemClicked('buy_me_a_coffee'); Linking.openURL('https://buymeacoffee.com/btcchub'); }} />
      </ScrollView>
    </View>
  );
}

function MoreRow({label, icon, onPress}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={24} color={Colors.yellow} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Icon name="chevron-right" size={24} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: Colors.background},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1},
  sectionTitle: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLabel: {flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 16},
  divider: {height: 1, backgroundColor: Colors.outline, marginVertical: 16},
});
