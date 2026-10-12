import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {shareApp} from '../utils/appShare';
import {useTabPressReset} from '../navigation/useTabPressReset';
import {CHAT_FAB_CLEARANCE} from '../utils/chatFabLayout';
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
  const [pages, setPages] = useState([]);
  const scrollRef = useRef(null);

  // Scroll to top only when the More tab bar icon is pressed (see
  // useTabPressReset in AppNavigator.js) - never on back navigation from
  // Settings/InfoPage/Merch/etc, which should preserve scroll position. This
  // also correctly handles returning from Merch (pushed deep in this stack)
  // since the reset pops the whole stack back to MoreMenu regardless of how
  // deep it was.
  useTabPressReset(navigation, useCallback(() => {
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

  const onShareApp = () => {
    Analytics.moreItemClicked('share_app');
    shareApp('more_menu');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MORE</Text>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={{padding: 16, paddingBottom: 20 + CHAT_FAB_CLEARANCE}}>
        {/* New to BTCC */}
        <Text style={styles.sectionTitle}>NEW HERE?</Text>
        {pages.filter(p => p.id === 'new-to-btcc').map(p => (
          <MoreRow key={p.id} label={p.title} icon="school" onPress={() => { Analytics.moreItemClicked(p.id); openPage(p); }} />
        ))}

        <View style={styles.divider} />

        {/* App section */}
        <Text style={styles.sectionTitle}>APP</Text>
        <MoreRow label="Listen" icon="headphones" onPress={() => { Analytics.moreItemClicked('listen'); navigation.navigate('Listen'); }} />
        <MoreRow label="Team Merch" icon="shopping-bag" onPress={() => { Analytics.moreItemClicked('merch'); navigation.navigate('Merch'); }} />
        <MoreRow label="Settings" icon="settings" onPress={() => { Analytics.moreItemClicked('settings'); navigation.navigate('Settings'); }} />

        <View style={styles.divider} />

        {/* About BTCC pages */}
        <Text style={styles.sectionTitle}>ABOUT BTCC</Text>
        {pages.filter(p => p.id !== 'new-to-btcc' && !p.id.startsWith('btcc-') && p.id !== 'championships').map(p => (
          <MoreRow key={p.id} label={p.title} icon={iconMap[p.icon] || 'info'} onPress={() => { Analytics.moreItemClicked(p.id); openPage(p); }} />
        ))}
        <MoreRow label="Partners & Sponsors" icon="business" onPress={() => { Analytics.moreItemClicked('partners'); navigation.navigate('Partners'); }} />

        <View style={styles.divider} />

        {/* Roadmap */}
        <Text style={styles.sectionTitle}>COMMUNITY</Text>
        <MoreRow label="Roadmap & Ideas" icon="rocket-launch" onPress={() => { Analytics.moreItemClicked('roadmap'); navigation.navigate('Roadmap'); }} />
        <MoreRow label="Share BTCC Hub" icon="share" onPress={onShareApp} />

        <View style={styles.divider} />

        {/* Support */}
        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <MoreRow label="Feedback & Bugs" icon="bug-report" onPress={() => { Analytics.moreItemClicked('bug_report'); navigation.navigate('BugReport'); }} />
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
