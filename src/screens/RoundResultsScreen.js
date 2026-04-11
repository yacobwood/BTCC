import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {useFavouriteDriver} from '../store/favouriteDriver';
import {useUnits} from '../store/units';
import {Analytics} from '../utils/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function RoundResultsScreen({route, navigation}) {
  const {round, year, initialRace} = route.params;
  const [raceIndex, setRaceIndex] = useState(initialRace ?? 0);
  const {isFavourite} = useFavouriteDriver();
  const {useKm} = useUnits();
  const races = round.races || [];

  const swipeRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const TAB_WIDTH = SCREEN_WIDTH / races.length;
  const indicatorX = scrollX.interpolate({
    inputRange: [0, SCREEN_WIDTH * (races.length - 1)],
    outputRange: [0, TAB_WIDTH * (races.length - 1)],
    extrapolate: 'clamp',
  });

  useEffect(() => { Analytics.roundResultsViewed(year, round.round); }, []);

  const rStart = (round.round - 1) * 3 + 1;
  const rEnd = rStart + 2;

  const goToRace = (i) => {
    setRaceIndex(i);
    swipeRef.current?.scrollTo({x: i * SCREEN_WIDTH, animated: true});
  };

  const renderResult = ({item}) => {
    const isDNF = item.position === 0 || item.time === 'DNF' || item.time === 'Ret';
    const fav = isFavourite(item.driver);
    const posColor = item.position === 1 ? '#FFD700'
      : item.position === 2 ? '#C0C0C0'
      : item.position === 3 ? '#CD7F32'
      : '#fff';

    return (
      <View style={[styles.resultRow, isDNF && styles.resultRowDNF, fav && styles.resultRowFav]} accessibilityLabel={`Position ${isDNF ? 'DNF' : item.position}, ${item.driver}, ${item.points} points`}>
        <Text style={[styles.pos, {color: isDNF ? Colors.textSecondary : posColor}]}>
          {isDNF ? 'DNF' : item.position}
        </Text>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            {fav && <Icon name="star" size={11} color={Colors.yellow} />}
            <Text style={[styles.driverName, fav && {color: Colors.yellow}]}>
              {item.driver}
            </Text>
            {item.fastestLap && <Badge text="FL" color="#A855F7" />}
            {item.leadLap && <Badge text="L" color={Colors.yellow} />}
            {item.pole && <Badge text="P" color={Colors.yellow} />}
          </View>
          <Text style={styles.teamName}>{item.team}</Text>
        </View>
        <View style={styles.rightCol}>
          <Text style={[styles.timeText, item.position === 1 && {color: Colors.yellow}]}>
            {item.position === 1 ? item.time : (item.gap ? `+${item.gap.replace(/^\+/, '')}` : item.time)}
          </Text>
          {item.bestLap ? (
            <Text style={styles.detailText}>BL {item.bestLap}</Text>
          ) : null}
          {item.avgLapSpeed ? (
            <Text style={styles.detailText}>
              Avg {useKm ? `${parseFloat(item.avgLapSpeed).toFixed(2)} km/h` : `${(parseFloat(item.avgLapSpeed) / 1.60934).toFixed(2)} mph`}
            </Text>
          ) : null}
          <Text style={styles.pointsText}>+{item.points} pts</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityLabel="Go back" accessibilityRole="button">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={styles.headerTitle}>{round.venue}</Text>
          <Text style={styles.headerSub}>Rounds {rStart}–{rEnd} · {round.date}</Text>
        </View>
      </View>

      {races.length > 1 && (
        <View style={styles.raceTabRow}>
          {races.map((r, i) => (
            <TouchableOpacity
              key={i}
              style={styles.raceTab}
              onPress={() => goToRace(i)}
              accessibilityRole="tab"
              accessibilityLabel={r.label}>
              <Text style={[styles.raceTabText, raceIndex === i && styles.raceTabTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
          <Animated.View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: TAB_WIDTH,
            height: 2,
            backgroundColor: Colors.yellow,
            transform: [{translateX: indicatorX}],
          }} />
        </View>
      )}

      <Animated.ScrollView
        ref={swipeRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{flex: 1}}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {x: scrollX}}}],
          {
            useNativeDriver: true,
            listener: (e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (i !== raceIndex) setRaceIndex(i);
            },
          }
        )}>
        {races.map((race, i) => {
          const results = race?.results || [];
          return (
            <View key={i} style={{width: SCREEN_WIDTH, flex: 1}}>
              {race?.date && race.date !== round.date && (
                <Text style={styles.raceDateLabel}>{race.date}</Text>
              )}
              <FlatList
                data={results}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={renderResult}
                contentContainerStyle={{padding: 16, paddingBottom: 20}}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No results available</Text>
                }
              />
            </View>
          );
        })}
      </Animated.ScrollView>
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
  teamName: {color: Colors.textSecondary, fontSize: 11, marginTop: 1},
  rightCol: {alignItems: 'flex-end', marginLeft: 8},
  timeText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  detailText: {color: Colors.textSecondary, fontSize: 10, marginTop: 1},
  badges: {flexDirection: 'row', gap: 4, marginTop: 3},
  badge: {borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1},
  badgeText: {fontSize: 10, fontWeight: '800'},
  pointsText: {color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2},
  emptyText: {color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 40},
});
