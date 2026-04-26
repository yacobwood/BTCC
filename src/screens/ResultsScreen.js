import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  InteractionManager,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchStandings, fetchResults} from '../api/client';
import {parseStandings, parseResults} from '../api/parsers';
import styles from './ResultsScreen.styles';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {getSeasonData} from '../assets/seasonData';
import ProgressionChart from '../components/ProgressionChart';
import SeasonTable from '../components/SeasonTable';
import {Analytics} from '../utils/analytics';
import {formatDriverName} from '../utils/driverName';
import {cacheRead, cacheWrite} from '../store/cache';

const SCREEN_WIDTH = Dimensions.get('window').width;

function computeSeasonStats(rounds) {
  const map = {};
  for (const round of rounds) {
    for (const race of round.races) {
      for (const r of race.results) {
        if (!r.driver) continue;
        if (!map[r.driver]) {
          map[r.driver] = {name: r.driver, team: r.team, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, points: 0};
        }
        const s = map[r.driver];
        s.points += r.points;
        if (r.position === 1) s.wins++;
        if (r.position >= 1 && r.position <= 3) s.podiums++;
        if (r.pole) s.poles++;
        if (r.fastestLap) s.fastestLaps++;
        if (r.position === 0) s.dnfs++;
      }
    }
  }
  return Object.values(map).sort((a, b) => b.points - a.points);
}

function computeProgression(rounds) {
  const driverPoints = {};
  const firstRound = {}; // round index when driver first appeared
  const series = {};
  const sortedRounds = [...rounds]
    .sort((a, b) => a.round - b.round)
    .filter(r => r.races.some(race => race.results.length > 0));
  sortedRounds.forEach((round, roundIdx) => {
    for (const race of round.races) {
      for (const r of race.results) {
        if (!r.driver) continue;
        driverPoints[r.driver] = (driverPoints[r.driver] || 0) + r.points;
        if (firstRound[r.driver] === undefined) firstRound[r.driver] = roundIdx;
        if (!series[r.driver]) series[r.driver] = {name: r.driver, points: []};
      }
    }
    // Snapshot after each round — null for rounds before driver's first appearance
    for (const name of Object.keys(series)) {
      series[name].points.push(roundIdx >= firstRound[name] ? (driverPoints[name] || 0) : null);
    }
  });
  return Object.values(series).sort((a, b) => (b.points[b.points.length - 1] || 0) - (a.points[a.points.length - 1] || 0));
}

// Build a driver-name → team map from race results to fill gaps in standings
function buildTeamMap(rounds) {
  const map = {};
  for (const round of rounds) {
    for (const race of round.races || []) {
      for (const r of race.results || []) {
        if (r.driver && r.team && !map[r.driver]) map[r.driver] = r.team;
      }
    }
  }
  return map;
}

export default function ResultsScreen({navigation, route}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seasonStart = new Date(2026, 3, 18); // April 18 2026 local midnight
  const seasonStarted = today >= seasonStart;

  const [year, setYear] = useState(seasonStarted ? 2026 : 2025);
  const [tab, setTab] = useState(0);
  const [driverFilter, setDriverFilter] = useState('all');
  const {isFavourite} = useFavouriteDriver();
  const [standings, setStandings] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bundledStats, setBundledStats] = useState(null);
  const [bundledProgression, setBundledProgression] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const driversListRef = useRef(null);
  const teamsListRef = useRef(null);
  const resultsListRef = useRef(null);
  const statsListRef = useRef(null);
  const chartScrollRef = useRef(null);

  useFocusEffect(useCallback(() => {
    driversListRef.current?.scrollToOffset({offset: 0, animated: false});
    teamsListRef.current?.scrollToOffset({offset: 0, animated: false});
    resultsListRef.current?.scrollToOffset({offset: 0, animated: false});
    statsListRef.current?.scrollToOffset({offset: 0, animated: false});
    chartScrollRef.current?.scrollTo({y: 0, animated: false});
  }, []));

  const TAB_WIDTH = SCREEN_WIDTH / 6;

  const goToTab = (i) => {
    setTab(i);
    setShowScrollTop(false);
    Analytics.resultsTabChanged(year, tabs[i].toLowerCase());
  };

  const onListScroll = (e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 400);

  const scrollToTop = () => {
    Analytics.scrollToTop('results');
    driversListRef.current?.scrollToOffset({offset: 0, animated: true});
    teamsListRef.current?.scrollToOffset({offset: 0, animated: true});
    resultsListRef.current?.scrollToOffset({offset: 0, animated: true});
    statsListRef.current?.scrollToOffset({offset: 0, animated: true});
    chartScrollRef.current?.scrollTo({y: 0, animated: true});
    setShowScrollTop(false);
  };

  // Synchronously apply all state for a bundled year in one batch — no flash
  const applyBundledYear = useCallback((y) => {
    const season = getSeasonData(y);
    if (season) {
      const drivers = (season.drivers || []).map((d, i) => ({
        position: d.position || i + 1,
        name: d.name || '',
        team: d.team || '',
        car: d.car || '',
        points: d.points || 0,
        wins: d.wins || 0,
        seconds: d.seconds || 0,
        thirds: d.thirds || 0,
      }));
      const teams = (season.teams || []).map((t, i) => ({
        position: t.position || i + 1,
        name: t.name || t.team || '',
        points: t.points || 0,
      }));
      setStandings({season: String(y), round: 0, venue: '', drivers, teams});
      setBundledStats(season.driverStats || null);
      setBundledProgression(season.progression || null);
      setResults(season.rounds ? season.rounds.map((r, i) => ({
        round: r.round || i + 1,
        venue: r.venue || '',
        date: r.date || '',
        polePosition: r.polePosition || null,
        races: (r.races || []).map((race, j) => ({
          label: race.label || `Race ${j + 1}`,
          date: race.date || null,
          fullRaceUrl: race.fullRaceUrl || null,
          results: (race.results || []).map(d => ({
            position: d.pos || 0,
            number: d.no || 0,
            driver: d.driver || '',
            team: d.team || '',
            laps: d.laps || 0,
            time: d.time || '',
            gap: d.gap || null,
            bestLap: d.bestLap || '',
            points: d.points || 0,
            fastestLap: d.fl || d.fastestLap || false,
            leadLap: d.l || d.leadLap || false,
            pole: d.p || d.pole || false,
            avgLapSpeed: d.avgLapSpeed || null,
          })),
        })),
      })) : []);
    } else {
      setStandings(null);
      setBundledStats(null);
      setBundledProgression(null);
      setResults([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const load = useCallback(async (y = year, forceRefresh = false) => {
    // Bundled years handled by applyBundledYear — called synchronously in button handlers
    if (y >= 2004 && y <= 2025) {
      applyBundledYear(y);
      return;
    }

    // 2026: stale-while-revalidate from cache, then fetch
    setBundledStats(null);
      setBundledProgression(null);

      if (!forceRefresh) {
        const [cachedResults, cachedStandings] = await Promise.all([
          cacheRead(`results_${y}`),
          y === 2026 && seasonStarted ? cacheRead('standings') : Promise.resolve(null),
        ]);
        if (cachedResults) {
          const parsedResults = parseResults(cachedResults);
          setResults(parsedResults);
          if (cachedStandings) {
            const s = parseStandings(cachedStandings);
            const teamMap = buildTeamMap(parsedResults);
            s.drivers = s.drivers.map(d => ({...d, team: d.team || teamMap[d.name] || ''}));
            setStandings(s);
          }
          setLoading(false);
        } else {
          setStandings(null);
          if (y === 2026) setLoading(true);
        }
      } else {
        setStandings(null);
        if (y === 2026) setLoading(true);
      }

      try {
        const resRaw = await fetchResults(y, forceRefresh);
        const parsedResults = parseResults(resRaw);
        setResults(parsedResults);
        cacheWrite(`results_${y}`, resRaw);

        if (y === 2026 && seasonStarted) {
          const raw = await fetchStandings(forceRefresh);
          const s = parseStandings(raw);
          const teamMap = buildTeamMap(parsedResults);
          s.drivers = s.drivers.map(d => ({...d, team: d.team || teamMap[d.name] || ''}));
          setStandings(s);
          cacheWrite('standings', raw);
        }
      } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [year, seasonStarted]);

  useEffect(() => { Analytics.screen('results'); }, []);

  // Auto-open a specific round when navigated here with openRound param
  useFocusEffect(useCallback(() => {
    const openRound = route?.params?.openRound;
    const openYear = route?.params?.openYear;
    if (!openRound) return;
    // If the year doesn't match, switch it — the load useEffect will reload results
    if (openYear && openYear !== year) {
      navigation.setParams({openRound: undefined, openYear: undefined});
      setYear(openYear);
      return;
    }
    if (loading || results.length === 0) return;
    const found = results.find(r => r.round === openRound);
    if (found) {
      navigation.setParams({openRound: undefined, openYear: undefined});
      navigation.navigate('RoundResults', {round: found, year, initialRace: 0});
    }
  }, [route?.params?.openRound, route?.params?.openYear, loading, results, year]));
  useEffect(() => {
    // Bundled years (2004-2025) are synchronous — load immediately to avoid flash
    if (year >= 2004 && year <= 2025) {
      load(year);
      return;
    }
    // Live year: defer until after navigation animation completes
    const task = InteractionManager.runAfterInteractions(() => { load(year); });
    return () => task.cancel();
  }, [year]);

  const onRefresh = useCallback(() => {
    Analytics.pullToRefresh('results');
    setRefreshing(true);
    load(year, true);
  }, [load, year]);

  const canGoOlder = year > 2004;
  const canGoNewer = year < 2026;

  const driverStandings = useMemo(() => {
    const all = standings?.drivers || [];
    if (driverFilter === 'all') return all;
    return all
      .filter(d => d.cls === driverFilter)
      .map((d, i) => ({...d, position: i + 1}));
  }, [standings, driverFilter]);
  const teamStandings = standings?.teams || [];
  const liveRound = standings?.round || 0;

  const seasonStats = useMemo(() => {
    if (bundledStats) {
      return bundledStats.map(s => ({
        name: s.driver || '',
        team: s.team || '',
        wins: s.wins || 0,
        podiums: s.podiums || 0,
        poles: s.poles || 0,
        fastestLaps: s.fastestLaps || 0,
        dnfs: s.dnfs || 0,
        points: 0, // not in driverStats, but we don't show points on stats tab
      }));
    }
    return computeSeasonStats(results);
  }, [results, bundledStats]);

  const progression = useMemo(() => {
    if (bundledProgression) {
      return bundledProgression.map(p => ({
        name: p.driver || '',
        points: p.cumulativePointsByRound || [],
      })).sort((a, b) => (b.points[b.points.length - 1] || 0) - (a.points[a.points.length - 1] || 0));
    }
    return computeProgression(results);
  }, [results, bundledProgression]);

  const renderDriverStanding = useCallback(({item}) => {
    const fav = isFavourite(item.name);
    return (
      <View style={[styles.standingRow, fav && {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'}]} accessibilityLabel={`Position ${item.position}, ${item.name}, ${item.points} points`}>
        <Text style={[styles.pos, item.position === 1 && {color: '#FFD700'}, item.position === 2 && {color: '#C0C0C0'}, item.position === 3 && {color: '#CD7F32'}]}>{item.position}</Text>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            {fav && <Icon name="star" size={12} color={Colors.yellow} />}
            <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>{formatDriverName(item.name)}</Text>
          </View>
          <Text style={styles.teamName}>{item.team}</Text>
        </View>
        <View style={{alignItems: 'flex-end', minWidth: 70}}>
          <Text style={{color: '#fff', fontSize: 15, fontWeight: '900'}}>{item.points} pts</Text>
          {(item.wins > 0 || item.seconds > 0 || item.thirds > 0) && (
            <View style={{flexDirection: 'row', gap: 6, marginTop: 3, alignItems: 'center'}}>
              {item.wins > 0 && (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
                  <Icon name="emoji-events" size={11} color="#FFD700" />
                  <Text style={{color: '#FFD700', fontSize: 11, fontWeight: '800'}}>{item.wins}</Text>
                </View>
              )}
              {item.seconds > 0 && (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
                  <Icon name="emoji-events" size={11} color="#C0C0C0" />
                  <Text style={{color: '#C0C0C0', fontSize: 11, fontWeight: '800'}}>{item.seconds}</Text>
                </View>
              )}
              {item.thirds > 0 && (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
                  <Icon name="emoji-events" size={11} color="#CD7F32" />
                  <Text style={{color: '#CD7F32', fontSize: 11, fontWeight: '800'}}>{item.thirds}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }, [isFavourite]);

  const renderTeamStanding = useCallback(({item}) => (
    <View style={styles.standingRow}>
      <Text style={[styles.pos, item.position === 1 && {color: '#FFD700'}, item.position === 2 && {color: '#C0C0C0'}, item.position === 3 && {color: '#CD7F32'}]}>{item.position}</Text>
      <Text style={[styles.driverName, {flex: 1}]}>{item.name}</Text>
      <View style={styles.pointsBox}>
        <Text style={styles.points}>{item.points}</Text>
        <Text style={styles.pointsLabel}>PTS</Text>
      </View>
    </View>
  ), []);

  const renderRound = useCallback(({item}) => {
    const hasResults = item.races.some(r => r.results.length > 0);
    const rStart = (item.round - 1) * 3 + 1;
    const rEnd = rStart + 2;
    return (
      <TouchableOpacity
        style={styles.roundCard}
        activeOpacity={0.8}
        disabled={!hasResults}
        onPress={() => navigation.navigate('RoundResults', {round: item, year})}
        accessibilityLabel={`Round ${rStart}–${rEnd}, ${item.venue}, ${item.date}${hasResults ? '' : ', results TBC'}`}
        accessibilityRole="button">
        <View style={{backgroundColor: 'rgba(254,189,2,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 12, borderWidth: 1, borderColor: 'rgba(254,189,2,0.3)'}}>
          <Text style={{color: Colors.yellow, fontSize: 12, fontWeight: '800'}}>R{rStart}-{rEnd}</Text>
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.roundVenue}>{item.venue}</Text>
          <Text style={styles.roundDate}>{item.date}</Text>
        </View>
        {hasResults ? (
          <Icon name="chevron-right" size={20} color={Colors.textSecondary} />
        ) : (
          <Text style={styles.tbc}>TBC</Text>
        )}
      </TouchableOpacity>
    );
  }, [navigation, year]);

  const renderStat = useCallback(({item, index}) => {
    const fav = isFavourite(item.name);
    return (
      <View style={[styles.standingRow, fav && {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'}]} accessibilityLabel={`Position ${index + 1}, ${item.name}, ${item.wins} wins`}>
        <Text style={[styles.pos, {fontSize: 16}]}>{index + 1}</Text>
        <View style={{flex: 1}}>
          <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>{formatDriverName(item.name)}</Text>
          <Text style={styles.teamName}>{item.team}</Text>
        </View>
        <Text style={[styles.statCol, {color: Colors.yellow}]}>{item.wins}</Text>
        <Text style={[styles.statCol, {color: '#fff'}]}>{item.podiums}</Text>
        <Text style={[styles.statCol, {color: '#fff'}]}>{item.poles}</Text>
        <Text style={[styles.statCol, {color: '#A855F7'}]}>{item.fastestLaps}</Text>
        <Text style={[styles.statCol, {color: '#EF4444'}]}>{item.dnfs}</Text>
      </View>
    );
  }, [isFavourite]);

  const statsHeader = () => (
    <View style={{flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center'}}>
      <View style={{width: 40}} />
      <Text style={{flex: 1, color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 1}}>DRIVER</Text>
      <Text style={styles.statColHeader}>W</Text>
      <Text style={styles.statColHeader}>POD</Text>
      <Text style={styles.statColHeader}>POL</Text>
      <Text style={styles.statColHeader}>FL</Text>
      <Text style={styles.statColHeader}>DNF</Text>
    </View>
  );

  const tabs = ['DRIVERS', 'TEAMS', 'RESULTS', 'STATS', 'TABLE', 'CHART'];
  const hasData = results.some(r => r.races.some(race => race.results.length > 0));

  const renderTabContent = (t) => {
    // Show season not started OR no live data for 2026
    if (year === 2026 && (t === 0 || t === 1 || t === 3 || t === 4 || t === 5)) {
      if (!seasonStarted) {
        return (
          <View style={styles.center}>
            <Icon name="emoji-events" size={48} color={Colors.outline} />
            <Text style={[styles.emptyText, {marginTop: 16, fontSize: 16, fontWeight: '700'}]}>2026 Season</Text>
            <Text style={[styles.emptyText, {marginTop: 8}]}>Starts 18 April 2026</Text>
            <Text style={[styles.emptyText, {marginTop: 4}]}>
              {Math.ceil((seasonStart - today) / (1000 * 60 * 60 * 24))} days to go
            </Text>
          </View>
        );
      }
      if (!loading && driverStandings.length === 0) {
        return (
          <View style={styles.center}>
            <Icon name="emoji-events" size={48} color={Colors.outline} />
            <Text style={[styles.emptyText, {marginTop: 16, fontSize: 16, fontWeight: '700'}]}>2026 Season</Text>
            <Text style={[styles.emptyText, {marginTop: 8}]}>Standings will appear once the season begins</Text>
          </View>
        );
      }
    }

    if (loading && t === 0) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.yellow} size="large" />
        </View>
      );
    }

    switch (t) {
      case 0:
        return (
          <>
            <View style={styles.filterRow}>
              {[['all', 'All'], ['M', 'Main'], ['I', 'Independents']].map(([val, label]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.filterPill, driverFilter === val && styles.filterPillActive]}
                  onPress={() => setDriverFilter(val)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${label} standings`}>
                  <Text style={[styles.filterPillText, driverFilter === val && styles.filterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <FlatList
              ref={driversListRef}
              data={driverStandings}
              keyExtractor={(item) => item.name}
              renderItem={renderDriverStanding}
              contentContainerStyle={{padding: 16, paddingBottom: 20}}
              onScroll={onListScroll}
              scrollEventThrottle={100}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />}
              ListHeaderComponent={null}
              ListEmptyComponent={<Text style={styles.emptyText}>No standings available for {year}</Text>}
            />
          </>
        );
      case 1:
        return (
          <FlatList
            ref={teamsListRef}
            data={teamStandings}
            keyExtractor={(item) => item.name}
            renderItem={renderTeamStanding}
            contentContainerStyle={{padding: 16, paddingBottom: 20}}
            onScroll={onListScroll}
            scrollEventThrottle={100}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />}
            ListEmptyComponent={<Text style={styles.emptyText}>No team standings available for {year}</Text>}
          />
        );
      case 2:
        return (
          <FlatList
            ref={resultsListRef}
            data={results}
            keyExtractor={item => String(item.round)}
            renderItem={renderRound}
            contentContainerStyle={{padding: 16, paddingBottom: 20}}
            onScroll={onListScroll}
            scrollEventThrottle={100}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />}
            ListEmptyComponent={<Text style={styles.emptyText}>No results available for {year}</Text>}
          />
        );
      case 3:
        return (
          <FlatList
            ref={statsListRef}
            data={seasonStats}
            keyExtractor={(item) => item.name}
            renderItem={renderStat}
            contentContainerStyle={{padding: 16, paddingBottom: 20}}
            onScroll={onListScroll}
            scrollEventThrottle={100}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.yellow} />}
            ListHeaderComponent={statsHeader}
            ListEmptyComponent={<Text style={styles.emptyText}>No stats available for {year}</Text>}
          />
        );
      case 4:
        return <SeasonTable results={results} />;
      case 5:
        if (!hasData) {
          return (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No chart data available for {year}</Text>
            </View>
          );
        }
        return (
          <ScrollView ref={chartScrollRef} contentContainerStyle={{padding: 16, paddingBottom: 20}} onScroll={onListScroll} scrollEventThrottle={100}>
            <ProgressionChart
              series={progression}
              roundLabels={results.filter(r => r.races.some(race => race.results.length > 0)).sort((a, b) => a.round - b.round).map(r => r.venue)}
              isFavourite={isFavourite}
            />
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HISTORY</Text>
      </View>

      <View style={styles.yearRow}>
        <TouchableOpacity
          disabled={!canGoOlder}
          onPress={() => {
            const newYear = year - 1;
            Analytics.resultsYearChanged(newYear);
            if (newYear >= 2004 && newYear <= 2025) {
              applyBundledYear(newYear);
            } else {
              setLoading(true);
            }
            setYear(newYear);
            setDriverFilter('all');
          }}
          accessibilityLabel="Previous season"
          accessibilityRole="button">
          <Icon name="chevron-left" size={28} color={canGoOlder ? '#fff' : Colors.outline} />
        </TouchableOpacity>
        <View style={{alignItems: 'center'}}>
          <Text style={styles.yearText}>{year}</Text>
          <Text style={styles.yearLabel}>SEASON</Text>
        </View>
        <TouchableOpacity
          disabled={!canGoNewer}
          onPress={() => {
            const newYear = year + 1;
            Analytics.resultsYearChanged(newYear);
            if (newYear >= 2004 && newYear <= 2025) {
              applyBundledYear(newYear);
            } else {
              setLoading(true);
            }
            setYear(newYear);
            setDriverFilter('all');
          }}
          accessibilityLabel="Next season"
          accessibilityRole="button">
          <Icon name="chevron-right" size={28} color={canGoNewer ? '#fff' : Colors.outline} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={styles.tab}
            onPress={() => goToTab(i)}
            accessibilityRole="tab"
            accessibilityLabel={`${label} tab`}>
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: TAB_WIDTH,
          height: 2,
          backgroundColor: Colors.yellow,
          transform: [{translateX: TAB_WIDTH * tab}],
        }} />
      </View>

      {renderTabContent(tab)}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopFab}
          onPress={scrollToTop}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button">
          <Icon name="keyboard-arrow-up" size={24} color={Colors.navy} />
        </TouchableOpacity>
      )}
    </View>
  );
}
