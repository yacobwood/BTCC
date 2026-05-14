import React, {useState, useMemo, useRef, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchRecords} from '../api/client';
import {cacheRead} from '../store/cache';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {Analytics} from '../utils/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MIN_STARTS = 30;

const RATE_SORTS = [
  {key: 'winPct',         label: 'Win %',     format: v => (v * 100).toFixed(1) + '%', sub: item => `${item.wins}W from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
  {key: 'podiumPct',      label: 'Podium %',  format: v => (v * 100).toFixed(1) + '%', sub: item => `${item.podiums} podiums from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
  {key: 'pointsPerStart', label: 'Pts/Start', format: v => v.toFixed(2),               sub: item => `${item.points} pts from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
  {key: 'dnfPct',         label: 'DNF %',     format: v => (v * 100).toFixed(1) + '%', sub: item => `${item.dnfs} DNFs from ${item.starts} starts · ${item.seasons} season${item.seasons !== 1 ? 's' : ''}`},
];

const COUNT_SORTS = [
  {key: 'championships', label: 'Titles', format: v => v.toString(), sub: item => `${item.wins} win${item.wins !== 1 ? 's' : ''}`, hideZero: true},
  {key: 'wins',          label: 'Wins',   format: v => v.toString(), sub: item => `${item.championships} title${item.championships !== 1 ? 's' : ''}`},
];

const SECTION_DEFS = [
  {label: 'Totals', sorts: COUNT_SORTS, subtitle: 'Source: btcc.net'},
  {label: 'Rates',  sorts: RATE_SORTS,  subtitle: 'Min. 30 starts · 2004 onwards'},
];

export default function RecordsScreen({navigation}) {
  const [section, setSection] = useState(0);
  const [tab, setTab] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [allDrivers, setAllDrivers] = useState([]);
  const {isFavourite} = useFavouriteDriver();

  const listRef = useRef(null);
  const tabRowRef = useRef(null);

  useEffect(() => {
    cacheRead('records').then(cached => {
      if (cached?.drivers?.length) setAllDrivers(cached.drivers);
    });
    fetchRecords()
      .then(data => { if (data?.drivers?.length) setAllDrivers(data.drivers); })
      .catch(() => {});
  }, []);

  const ratesData = useMemo(() => allDrivers.filter(d => d.starts >= MIN_STARTS), [allDrivers]);
  const totalsData = allDrivers;

  const numTabs = SECTION_DEFS[section].sorts.length;
  const [showMoreTabs, setShowMoreTabs] = useState(numTabs > 4);
  const tabWidth = SCREEN_WIDTH / Math.min(numTabs, 4);

  const goToSection = (s) => {
    setSection(s);
    setTab(0);
    tabRowRef.current?.scrollTo({x: 0, animated: false});
    setShowScrollTop(false);
    setShowMoreTabs(SECTION_DEFS[s].sorts.length > 4);
    Analytics.navItemClicked('records_section:' + SECTION_DEFS[s].label.toLowerCase());
  };

  const goToTab = (i) => {
    setTab(i);
    setShowScrollTop(false);
    listRef.current?.scrollToOffset({offset: 0, animated: false});
    tabRowRef.current?.scrollTo({x: Math.max(0, (i - 1) * tabWidth), animated: true});
    Analytics.navItemClicked('records_sort:' + SECTION_DEFS[section].sorts[i].key);
  };

  const HISTORICAL_TABS = new Set(['wins', 'championships']);

  const sortedData = useMemo(
    () => [ratesData, totalsData].map((sectionData, secIdx) =>
      SECTION_DEFS[secIdx].sorts.map(s => {
        let base = HISTORICAL_TABS.has(s.key) ? sectionData : sectionData.filter(d => !d.historical);
        const filtered = s.hideZero ? base.filter(d => d[s.key] > 0) : base;
        return [...filtered].sort((a, b) => b[s.key] - a[s.key]);
      })
    ),
    [ratesData, totalsData],
  );

  const activeSorts = SECTION_DEFS[section].sorts;
  const activeSortedData = sortedData[section];

  const renderRow = (sortDef, maxVal, data) => ({item}) => {
    const fav = isFavourite(item.driver);
    const rank = data.filter(d => d[sortDef.key] > item[sortDef.key]).length + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
    const barWidth = item[sortDef.key] / maxVal;
    return (
      <View style={[styles.row, fav && styles.rowFav]}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
          <Text
            style={[styles.pos, {fontSize: medal ? 18 : 15}]}
            accessibilityLabel={rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : String(rank)}>
            {medal || rank}
          </Text>
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
        {SECTION_DEFS.map((sec, i) => (
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

      {allDrivers.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.yellow} />
        </View>
      ) : (() => {
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
              SECTION_DEFS[section].subtitle
                ? <Text style={styles.subtitle}>{SECTION_DEFS[section].subtitle}</Text>
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
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center'},
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
