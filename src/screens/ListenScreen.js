import React, {useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {useFeatureFlags} from '../store/featureFlags';

const ALWAYS_ON = [
  {
    key: 'toca',
    label: 'TOCA Live Radio',
    description: 'Official live race commentary from the BTCC broadcast team',
    icon: 'sensors',
    screen: 'TocaRadio',
    flag: null,
  },
];

const OPTIONAL = [
  {
    key: 'radio',
    label: 'Online Radio',
    description: 'BTCC fan radio stations available all year round',
    icon: 'radio',
    screen: 'Radio',
    flag: 'radio_tab',
  },
  {
    key: 'podcasts',
    label: 'Podcasts & Interviews',
    description: 'Race replays, driver interviews and tin top talk',
    icon: 'mic',
    screen: 'Podcasts',
    flag: 'podcasts_enabled',
  },
];

export default function ListenScreen({navigation}) {
  const flags = useFeatureFlags();

  useEffect(() => { Analytics.screen('listen'); }, []);

  const items = [
    ...ALWAYS_ON,
    ...OPTIONAL.filter(o => flags[o.flag]),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LISTEN</Text>
      </View>

      <View style={styles.list}>
        {items.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => {
              Analytics.moreItemClicked(item.key);
              navigation.navigate(item.screen);
            }}
            accessibilityRole="button"
            accessibilityLabel={item.label}>
            <View style={styles.iconWrap}>
              <Icon name={item.icon} size={26} color={Colors.yellow} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.cardDesc}>{item.description}</Text>
            </View>
            <Icon name="chevron-right" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 16, gap: 12},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  list: {padding: 16, gap: 12},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {flex: 1},
  cardTitle: {color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 3},
  cardDesc: {color: Colors.textSecondary, fontSize: 12, lineHeight: 17},
});
