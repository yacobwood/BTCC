import React, {useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import SwipeableTabs from '../components/SwipeableTabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {useUnits} from '../store/units';
import {Analytics} from '../utils/analytics';
import {formatDriverName} from '../utils/driverName';

// Abbreviate session labels for tab display.
function shortLabel(label) {
  if (label === 'Free Practice') return 'FP';
  if (label === 'Qualifying') return 'QUAL';
  if (label === 'Qualifying Race') return 'Q RACE';
  const m = label.match(/^Race (\d)$/);
  if (m) return `R${m[1]}`;
  return label;
}

// Build a map of driver -> grid position for a given race.
// Race 1 grid = Qualifying Race finishing order.
// Race 2 grid = Race 1 finishing order.
// Race 3 grid = unknown (random reversal draw not stored).
function buildGridMap(races, raceIndex) {
  const race = races[raceIndex];
  if (!race) return null;

  let sourceLabel;
  if (race.label === 'Qualifying Race') sourceLabel = 'Qualifying';
  else if (race.label === 'Race 1') sourceLabel = 'Qualifying Race';
  else if (race.label === 'Race 2') sourceLabel = 'Race 1';
  else return null;
  const sourceRace = races.find(r => r.label === sourceLabel);
  if (!sourceRace?.results?.length) return null;
  const map = {};
  sourceRace.results.forEach((r, i) => {
    if (r.driver && r.position > 0) map[r.driver] = i + 1;
  });
  return Object.keys(map).length ? map : null;
}

export default function RoundResultsScreen({route, navigation}) {
  const {round, year, initialRace, origin} = route.params;
  const handleBack = () => origin === 'calendar' ? navigation.navigate('ResultsList') : navigation.goBack();
  const {isFavourite} = useFavouriteDriver();
  const {useKm} = useUnits();
  const races = round.races || [];

  useEffect(() => { Analytics.roundResultsViewed(year, round.round); }, []);

  const rStart = (round.round - 1) * 3 + 1;
  const rEnd = rStart + 2;

  const makeRenderResult = (gridMap) => ({item}) => {
    const isDNF = item.position === 0 || item.time === 'DNF' || item.time === 'Ret';
    const isDNS = isDNF && item.laps === 0;
    const posLabel = isDNS ? 'DNS' : isDNF ? 'DNF' : item.position;
    const fav = isFavourite(item.driver);
    const posColor = item.position === 1 ? '#FFD700'
      : item.position === 2 ? '#C0C0C0'
      : item.position === 3 ? '#CD7F32'
      : '#fff';

    const gridPos = gridMap?.[item.driver];
    const delta = (gridPos != null && !isDNF) ? gridPos - item.position : null;

    return (
      <View style={[styles.resultRow, isDNF && styles.resultRowDNF, fav && styles.resultRowFav]} accessibilityLabel={`Position ${posLabel}, ${item.driver}, ${item.points} points`}>
        <Text style={[styles.pos, {color: isDNF ? Colors.textSecondary : posColor}]}>
          {posLabel}
        </Text>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            {fav && <Icon name="star" size={11} color={Colors.yellow} />}
            <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>
              {formatDriverName(item.driver)}
            </Text>
            {item.fastestLap && <Badge text="FL" color="#A855F7" />}
            {item.leadLap && <Badge text="L" color={Colors.yellow} />}
            {item.pole && <Badge text="P" color={Colors.yellow} />}
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Text style={styles.teamName}>{item.team}</Text>
            {delta !== null && delta !== 0 && (
              <View style={styles.deltaRow}>
                <Icon
                  name={delta > 0 ? 'arrow-upward' : 'arrow-downward'}
                  size={10}
                  color={delta > 0 ? '#4ADE80' : '#F87171'}
                />
                <Text style={[styles.deltaText, {color: delta > 0 ? '#4ADE80' : '#F87171'}]}>
                  {Math.abs(delta)}
                </Text>
              </View>
            )}
            {delta === 0 && <Text style={styles.deltaFlat}>-</Text>}
          </View>
        </View>
        <View style={styles.rightCol}>
          <Text style={[styles.timeText, item.position === 1 && {color: Colors.yellow}]}>
            {item.time
              ? (item.position === 1 ? item.time : (item.gap ? `+${item.gap.replace(/^\+/, '')}` : item.time))
              : item.bestLap || ''}
          </Text>
          {item.time && item.bestLap ? (
            <Text style={styles.detailText}>BL {item.bestLap}</Text>
          ) : null}
          {item.avgLapSpeed ? (
            <Text style={styles.detailText}>
              Avg {useKm ? `${parseFloat(item.avgLapSpeed).toFixed(2)} km/h` : `${(parseFloat(item.avgLapSpeed) / 1.60934).toFixed(2)} mph`}
            </Text>
          ) : null}
          {item.points > 0 && <Text style={styles.pointsText}>+{item.points} pts</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={styles.headerTitle}>{round.venue}</Text>
          <Text style={styles.headerSub}>Rounds {rStart}–{rEnd} · {round.date}</Text>
        </View>
      </View>

      <SwipeableTabs
        tabs={races.map(r => shortLabel(r.label))}
        initialPage={initialRace ?? 0}
        pages={races.map((race, i) => {
          const gridMap = buildGridMap(races, i);
          return (
            <View style={{flex: 1}}>
              {race?.date && race.date !== round.date && (
                <Text style={styles.raceDateLabel}>{race.date}</Text>
              )}
              <FlatList
                data={race?.results || []}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={makeRenderResult(gridMap)}
                contentContainerStyle={{padding: 16, paddingBottom: 20}}
                ListHeaderComponent={race?.fullRaceUrl ? (
                  <TouchableOpacity
                    style={styles.youtubeBtn}
                    activeOpacity={0.8}
                    onPress={() => Linking.openURL(race.fullRaceUrl)}
                    accessibilityLabel="Watch full race on YouTube"
                    accessibilityRole="button">
                    <Icon name="play-circle-filled" size={16} color="#FF0000" style={{marginRight: 8}} />
                    <Text style={styles.youtubeBtnText}>Watch Full Race</Text>
                    <Icon name="open-in-new" size={14} color={Colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
                ListEmptyComponent={<Text style={styles.emptyText}>No results available</Text>}
              />
            </View>
          );
        })}
      />
    </View>
  );
}

function Badge({text, color}) {
  return (
    <View style={[styles.badge, {backgroundColor: `${color}22`}]}>
      <Text style={[styles.badgeText, {color}]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900'},
  headerSub: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  raceTabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  raceTab: {flex: 1, paddingVertical: 10, alignItems: 'center'},
  raceTabText: {color: Colors.textSecondary, fontSize: 12, fontWeight: '700'},
  raceTabTextActive: {color: Colors.yellow},
  raceDateLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  resultRowDNF: {opacity: 0.5},
  resultRowFav: {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)'},
  pos: {fontSize: 18, fontWeight: '900', width: 36, textAlign: 'center', marginRight: 8},
  driverName: {color: '#fff', fontSize: 14, fontWeight: '700'},
  teamName: {color: Colors.textSecondary, fontSize: 11},
  deltaRow: {flexDirection: 'row', alignItems: 'center', gap: 1},
  deltaText: {fontSize: 10, fontWeight: '800'},
  deltaFlat: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700'},
  rightCol: {alignItems: 'flex-end', marginLeft: 8},
  timeText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  detailText: {color: Colors.textSecondary, fontSize: 10, marginTop: 1},
  badges: {flexDirection: 'row', gap: 4, marginTop: 3},
  badge: {borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1},
  badgeText: {fontSize: 10, fontWeight: '800'},
  pointsText: {color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
  youtubeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,0,0,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,0,0.25)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  youtubeBtnText: {flex: 1, color: '#fff', fontSize: 13, fontWeight: '700'},
});
