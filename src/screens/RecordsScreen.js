import React, {useState, useMemo, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {DRIVER_RECORDS, ALL_TIME_RECORDS} from '../assets/seasonData';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {Analytics} from '../utils/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;

const RATE_SORTS = [
  {key: 'winPct',         label: 'Win %',     format: v => (v * 100).toFixed(1) + '%', sub: item => `${item.wins}W from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
  {key: 'podiumPct',      label: 'Podium %',  format: v => (v * 100).toFixed(1) + '%', sub: item => `${item.podiums} podiums from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
  {key: 'pointsPerStart', label: 'Pts/Start', format: v => v.toFixed(2),               sub: item => `${item.points} pts from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
  {key: 'dnfPct',         label: 'DNF %',     format: v => (v * 100).toFixed(1) + '%', sub: item => `${item.dnfs} DNFs from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
];

const COUNT_SORTS = [
  {key: 'championships',    label: 'Titles',                  format: v => v.toString(), sub: item => `${item.wins} win${item.wins !== 1 ? 's' : ''} · ${item.podiums} podiums`, hideZero: true},
  {key: 'starts',           label: 'Starts',                  format: v => v.toString(), sub: item => `${item.wins} wins · ${item.podiums} podiums`},
  {key: 'wins',             label: 'Wins',                    format: v => v.toString(), sub: item => `${item.podiums} podiums · ${item.poles} poles`},
  {key: 'podiums',          label: 'Podiums',                 format: v => v.toString(), sub: item => `${item.wins} wins · ${item.poles} poles`},
  {key: 'poles',            label: 'Pole Positions',          format: v => v.toString(), sub: item => `${item.wins} wins · ${item.fastestLaps} fastest laps`},
  {key: 'fastestLaps',      label: 'Fastest Laps',            format: v => v.toString(), sub: item => `${item.wins} wins · ${item.podiums} podiums`},
  {key: 'lapsLed',          label: 'Laps Led',                format: v => v.toString(), sub: item => `${item.wins} wins · ${item.racesLed} races led`, hideZero: true},
  {key: 'racesLed',         label: 'Races Led',               format: v => v.toString(), sub: item => `${item.wins} wins · ${item.lapsLed} laps led`, hideZero: true},
  {key: 'hatTricks',        label: 'Hat Tricks',              format: v => v.toString(), sub: item => `${item.wins} wins · ${item.starts} starts`, hideZero: true},
  {key: 'winStreak',        label: 'Win Streak',              format: v => v.toString(), sub: item => `${item.wins} career wins · ${item.podiums} podiums`, hideZero: true},
  {key: 'bestSeasonWins',   label: 'Wins in a Season',        format: v => v.toString(), sub: item => `${item.wins} career wins · ${item.championships} title${item.championships !== 1 ? 's' : ''}`, hideZero: true},
  {key: 'podiumStreak',     label: 'Podium Streak',           format: v => v.toString(), sub: item => `${item.podiums} career podiums · ${item.wins} wins`, hideZero: true},
  {key: 'bestSeasonPodiums',label: 'Podiums in a Season',     format: v => v.toString(), sub: item => `${item.podiums} career podiums · ${item.wins} wins`, hideZero: true},
  {key: 'poleStreak',       label: 'Pole Streak',             format: v => v.toString(), sub: item => `${item.poles} career poles · ${item.wins} wins`, hideZero: true},
  {key: 'bestSeasonPoles',  label: 'Poles in a Season',       format: v => v.toString(), sub: item => `${item.poles} career poles · ${item.wins} wins`, hideZero: true},
  {key: 'consecutive',      label: 'Consecutive Finishes',    format: v => v.toString(), sub: item => `${item.wins} wins · ${item.podiums} podiums`, hideZero: true},
  {key: 'consecutivePoints',label: 'Consecutive Points',      format: v => v.toString(), sub: item => `${item.starts} starts · ${item.podiums} podiums`, hideZero: true},
  {key: 'dnfs',             label: 'DNFs',                    format: v => v.toString(), sub: item => `${item.starts} starts · ${item.wins} wins`, hideZero: true},
];

const SECTIONS = [
  {label: 'Rates',  sorts: RATE_SORTS,  subtitle: 'Min. 30 starts · 2004–2025', data: DRIVER_RECORDS},
  {label: 'Totals', sorts: COUNT_SORTS, data: ALL_TIME_RECORDS},
];

export default function RecordsScreen({navigation}) {
  const [section, setSection] = useState(0);
  const [tab, setTab] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showMoreTabs, setShowMoreTabs] = useState(numTabs > 4);
  const {isFavourite} = useFavouriteDriver();

  const listRef = useRef(null);
  const tabRowRef = useRef(null);

  const numTabs = SECTIONS[section].sorts.length;
  const tabWidth = SCREEN_WIDTH / Math.min(numTabs, 4);

  const goToSection = (s) => {
    setSection(s);
    setTab(0);
    tabRowRef.current?.scrollTo({x: 0, animated: false});
    setShowScrollTop(false);
    setShowMoreTabs(SECTIONS[s].sorts.length > 4);
    Analytics.navItemClicked('records_section:' + SECTIONS[s].label.toLowerCase());
  };

  const goToTab = (i) => {
    setTab(i);
    setShowScrollTop(false);
    listRef.current?.scrollToOffset({offset: 0, animated: false});
    tabRowRef.current?.scrollTo({x: Math.max(0, (i - 1) * tabWidth), animated: true});
    Analytics.navItemClicked('records_sort:' + SECTIONS[section].sorts[i].key);
  };

  const sortedData = useMemo(
    () => SECTIONS.map(sec => sec.sorts.map(s => {
      const filtered = s.hideZero ? sec.data.filter(d => d[s.key] > 0) : sec.data;
      return [...filtered].sort((a, b) => b[s.key] - a[s.key]);
    })),
    [],
  );

  const activeSorts = SECTIONS[section].sorts;
  const activeSortedData = sortedData[section];

  const renderRow = (sortDef, maxVal, data) => ({item}) => {
    const fav = isFavourite(item.driver);
    // Standard competition ranking: rank = number of entries with a strictly higher value + 1
    const rank = data.filter(d => d[sortDef.key] > item[sortDef.key]).length + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    const barWidth = item[sortDef.key] / maxVal;
    return (
      <View style={[styles.row, fav && styles.rowFav]}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
          <Text style={[styles.pos, {fontSize: medal ? 18 : 15}]}>{medal || rank}</Text>
          <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4}}>
            {fav && <Icon name="star" size={13} color={Colors.yellow} />}
            <Text style={[styles.driver, fav && {color: Colors.yellow}]}>{item.driver}</Text>
          </View>
          <Text style={styles.value}>{sortDef.format(item[sortDef.key])}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, {flex: barWidth}]} />
          <View style={{flex: 1 - barWidth}} />
        </View>
        <Text style={styles.sub}>{sortDef.sub(item)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ALL-TIME RECORDS</Text>
      </View>

      <View style={styles.sectionRow}>
        {SECTIONS.map((sec, i) => (
          <TouchableOpacity
            key={sec.label}
            style={[styles.sectionChip, section === i && styles.sectionChipActive]}
            onPress={() => goToSection(i)}
            accessibilityRole="button"
            accessibilityLabel={sec.label}>
            <Text style={[styles.sectionChipText, section === i && styles.sectionChipTextActive]}>{sec.label.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabRow}>
        <ScrollView
          ref={tabRowRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={numTabs > 4}
          contentContainerStyle={{minWidth: '100%'}}
          onScroll={e => {
            const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
            setShowMoreTabs(contentOffset.x < contentSize.width - layoutMeasurement.width - 4);
          }}
          scrollEventThrottle={16}>
          {activeSorts.map((s, i) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.tab, {width: tabWidth}]}
              onPress={() => goToTab(i)}
              accessibilityRole="tab"
              accessibilityLabel={`${s.label} tab`}>
              <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.tabIndicator, {width: tabWidth, transform: [{translateX: tabWidth * tab}]}]} />
        </ScrollView>
        {showMoreTabs && (
          <View style={styles.tabFade} pointerEvents="none">
            <Icon name="chevron-right" size={18} color={Colors.textSecondary} />
          </View>
        )}
      </View>

      {(() => {
        const s = activeSorts[tab];
        const data = activeSortedData[tab];
        const maxVal = data[0]?.[s.key] || 1;
        return (
          <FlatList
            ref={listRef}
            key={`${section}-${s.key}`}
            data={data}
            keyExtractor={item => item.driver}
            renderItem={renderRow(s, maxVal, data)}
            onScroll={e => setShowScrollTop(e.nativeEvent.contentOffset.y > 400)}
            scrollEventThrottle={100}
            contentContainerStyle={{padding: 16, paddingBottom: 20}}
            ListHeaderComponent={
              SECTIONS[section].subtitle
                ? <Text style={styles.subtitle}>{SECTIONS[section].subtitle}</Text>
                : null
            }
          />
        );
      })()}

      {showScrollTop && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Analytics.scrollToTop('records');
            listRef.current?.scrollToOffset({offset: 0, animated: true});
            setShowScrollTop(false);
          }}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button">
          <Icon name="keyboard-arrow-up" size={24} color={Colors.navy} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 12},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  sectionRow: {flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8},
  sectionChip: {paddingHorizontal: 16, height: 32, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.outline, justifyContent: 'center'},
  sectionChipActive: {backgroundColor: Colors.yellow, borderColor: Colors.yellow},
  sectionChipText: {color: Colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.5},
  sectionChipTextActive: {color: Colors.navy},
  tabRow: {flexDirection: 'row', height: 44, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.outline},
  tab: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  tabText: {color: Colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center'},
  tabTextActive: {color: Colors.yellow},
  tabIndicator: {position: 'absolute', bottom: 0, left: 0, height: 2, backgroundColor: Colors.yellow},
  tabFade: {position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: Colors.outline},
  subtitle: {color: Colors.textSecondary, fontSize: 11, marginBottom: 12},
  row: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  rowFav: {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'},
  pos: {width: 36, color: Colors.textSecondary, fontSize: 15, fontWeight: '800'},
  driver: {flex: 1, color: '#fff', fontSize: 16, fontWeight: '700'},
  value: {color: Colors.yellow, fontSize: 18, fontWeight: '900'},
  barTrack: {flexDirection: 'row', height: 4, borderRadius: 2, backgroundColor: Colors.surface, overflow: 'hidden', marginBottom: 6, marginLeft: 36},
  barFill: {backgroundColor: Colors.yellow, borderRadius: 2},
  sub: {color: Colors.textSecondary, fontSize: 12, marginLeft: 36},
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
