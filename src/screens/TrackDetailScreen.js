import React, {useMemo, useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {fetchWeather, weatherDescription, weatherIcon} from '../utils/weather';
import CachedImage from '../components/CachedImage';
import {Analytics} from '../utils/analytics';
import {useUnits} from '../store/units';
import {useFeatureFlags} from '../store/featureFlags';

function formatDateRange(start, end) {
  if (!start || !end) return '';
  const s = new Date(start);
  const e = new Date(end);
  const day = d => d.getDate();
  const monthYear = d =>
    d.toLocaleDateString('en-GB', {month: 'short', year: 'numeric'});
  return `${day(s)} - ${day(e)} ${monthYear(e)}`;
}

function firstRaceNumber(round) {
  return (round - 1) * 3 + 1;
}

function roundLength(str) {
  if (!str) return '';
  const match = str.match(/^([\d.]+)\s*(.*)$/);
  if (!match) return str;
  const num = parseFloat(match[1]);
  return isNaN(num) ? str : `${num.toFixed(2)} ${match[2]}`.trim();
}

export default function TrackDetailScreen({route, navigation}) {
  const {track} = route.params;
  const {useKm} = useUnits();
  const {track_weather, live_updates} = useFeatureFlags();
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top || StatusBar.currentHeight || 0;
  const rStart = firstRaceNumber(track.round);
  const rEnd = rStart + 2;
  const dateRange = formatDateRange(track.startDate, track.endDate);

  const today = new Date();
  const isRaceWeekend = !!track.tslEventId && track.startDate && track.endDate
    && today >= new Date(track.startDate) && today <= new Date(track.endDate);

  const sessions = track.sessions || [];
  const [weather, setWeather] = useState(null);
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const HERO_H = track.imageUrl ? 220 : 0;
  const titlePaddingTop = scrollAnim.interpolate({inputRange: [HERO_H - 120, HERO_H], outputRange: [12, statusBarHeight + 12], extrapolate: 'clamp'});
  const titlePaddingLeft = scrollAnim.interpolate({inputRange: [HERO_H - 120, HERO_H], outputRange: [0, 46], extrapolate: 'clamp'});

  useEffect(() => { Analytics.trackDetailViewed(track.round, track.venue); }, []);

  useEffect(() => {
    if (!track_weather) return;
    if (track.lat && track.lng && track.startDate && track.endDate) {
      fetchWeather(track.lat, track.lng, track.startDate, track.endDate).then(w => {
        if (w) setWeather(w);
      });
    }
  }, [track.lat, track.lng, track.startDate, track.endDate, track_weather]);

  // Build flat list sections: hero, sticky title, then all content blocks
  const {data, stickyIndex} = useMemo(() => {
    const items = [];

    // 0: Hero image
    if (track.imageUrl) {
      items.push({type: 'hero'});
    }

    // This is the sticky header index
    const titleIdx = items.length;
    items.push({type: 'title'});

    // Stats
    items.push({type: 'stats'});

    // Live Timing button (race weekend only, feature-flagged)
    if (isRaceWeekend && live_updates) items.push({type: 'liveTiming'});

    // About
    if (track.about) items.push({type: 'about'});

    // BTCC Fact
    if (track.btccFact) items.push({type: 'fact'});

    // Lap records
    if (track.qualifyingRecord || track.raceRecord) {
      items.push({type: 'recordsHeader'});
      items.push({type: 'records'});
    }

    // Weekend schedule
    if (sessions.length > 0) {
      items.push({type: 'scheduleHeader'});
      items.push({type: 'schedule'});
    }

    // Weather forecast (feature-flagged)
    if (track_weather && weather && weather.length > 0) {
      items.push({type: 'weatherHeader'});
      items.push({type: 'weather'});
    }

    // Circuit layout (before guide)
    if (track.layoutImageUrl) {
      items.push({type: 'layoutHeader'});
      items.push({type: 'layout'});
    }

    // Circuit guide
    if (track.trackGuide?.length > 0) {
      items.push({type: 'guideHeader'});
      track.trackGuide.forEach((sector, si) => {
        items.push({type: 'sector', sector, key: `sector-${si}`});
      });
    }

    // Race photos carousel
    if (track.raceImages?.length > 0) {
      items.push({type: 'photosHeader'});
      items.push({type: 'photoCarousel'});
    }

    return {data: items, stickyIndex: titleIdx};
  }, [track, sessions, weather, isRaceWeekend, track_weather, live_updates]);

  const renderItem = ({item}) => {
    switch (item.type) {
      case 'hero':
        return (
          <View style={styles.heroWrap}>
            <CachedImage uri={track.imageUrl} style={styles.heroImg} accessibilityLabel={`${track.venue} circuit`} />
          </View>
        );

      case 'title':
        return (
          <Animated.View style={[styles.titleBlock, {paddingTop: titlePaddingTop, paddingLeft: titlePaddingLeft}]}>
            <View style={styles.titleContent}>
              <Text style={styles.roundsLabel}>ROUNDS {rStart}–{rEnd}</Text>
              <Text style={styles.venue}>{track.venue}</Text>
              {dateRange ? <Text style={styles.dateRange}>{dateRange}</Text> : null}
              <Text style={styles.location}>{track.location}</Text>
            </View>
          </Animated.View>
        );

      case 'stats':
        return (
          <View style={styles.statsRow}>
            <StatBox label="Length" value={useKm ? roundLength(track.lengthKm) : roundLength(track.lengthMiles)} />
            <StatBox label="Corners" value={String(track.corners)} />
            {track.firstBtccYear ? (
              <StatBox label="First BTCC" value={String(track.firstBtccYear)} />
            ) : null}
          </View>
        );

      case 'liveTiming':
        return (
          <TouchableOpacity
            style={styles.liveTimingBtn}
            activeOpacity={0.8}
            onPress={() => { Analytics.liveTimingOpened(track.venue); navigation.navigate('LiveTiming', {eventId: track.tslEventId}); }}
            accessibilityLabel="Open live timing"
            accessibilityRole="button">
            <View style={styles.liveDot} />
            <Text style={styles.liveTimingText}>LIVE TIMING</Text>
            <Icon name="chevron-right" size={18} color="#E3000B" />
          </TouchableOpacity>
        );

      case 'about':
        return (
          <View style={styles.card}>
            <Text style={styles.cardText}>{track.about}</Text>
          </View>
        );

      case 'fact':
        return (
          <View style={[styles.card, {borderLeftWidth: 3, borderLeftColor: Colors.yellow}]}>
            <Text style={styles.factLabel}>BTCC FACT</Text>
            <Text style={styles.cardText}>{track.btccFact}</Text>
          </View>
        );

      case 'recordsHeader':
        return <Text style={styles.sectionTitle}>LAP RECORDS</Text>;

      case 'records':
        return (
          <View style={styles.recordsRow}>
            {track.qualifyingRecord && (
              <RecordCard label="Qualifying" record={track.qualifyingRecord} useKm={useKm} />
            )}
            {track.raceRecord && (
              <RecordCard label="Race" record={track.raceRecord} useKm={useKm} />
            )}
          </View>
        );

      case 'guideHeader':
        return <Text style={styles.sectionTitle}>CIRCUIT GUIDE</Text>;

      case 'scheduleHeader':
        return <Text style={styles.sectionTitle}>WEEKEND TIMETABLE</Text>;

      case 'schedule': {
        // Group sessions by day
        const byDay = {};
        sessions.forEach(s => {
          if (!byDay[s.day]) byDay[s.day] = [];
          byDay[s.day].push(s);
        });
        const dayOrder = ['SAT', 'SUN'];
        const dayLabel = {SAT: 'Saturday', SUN: 'Sunday'};
        return (
          <View style={styles.scheduleCard}>
            {dayOrder.filter(d => byDay[d]).map(day => (
              <View key={day}>
                <Text style={styles.scheduleDay}>{dayLabel[day] || day}</Text>
                {byDay[day].map((s, i) => (
                  <View key={i} style={styles.sessionRow}>
                    <Text style={styles.sessionName}>{s.name}</Text>
                    <Text style={styles.sessionTime}>{s.time}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      }

      case 'sector':
        return (
          <View style={styles.sectorCard}>
            <Text style={styles.sectorName}>{item.sector.name}</Text>
            {item.sector.corners.map((c, ci) => (
              <View key={ci} style={styles.cornerRow}>
                <View style={styles.cornerNum}>
                  <Text style={styles.cornerNumText}>{c.number}</Text>
                </View>
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={styles.cornerName}>{c.name}</Text>
                    {c.overtaking && (
                      <View style={styles.overtakingBadge}>
                        <Text style={styles.overtakingText}>OVERTAKING</Text>
                      </View>
                    )}
                  </View>
                  {c.description ? (
                    <Text style={styles.cornerDesc}>{c.description}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        );

      case 'weatherHeader':
        return <Text style={styles.sectionTitle}>WEATHER FORECAST</Text>;

      case 'weather':
        return (
          <View style={styles.weatherRow}>
            {(weather || []).map((day, i) => {
              const d = new Date(day.date);
              const dayName = d.toLocaleDateString('en-GB', {weekday: 'short'});
              return (
                <View key={i} style={styles.weatherDay}>
                  <Text style={styles.weatherDayLabel}>{dayName}</Text>
                  <Icon name={weatherIcon(day.weatherCode)} size={26} color={Colors.yellow} />
                  <Text style={styles.weatherDesc}>{weatherDescription(day.weatherCode)}</Text>
                  <View style={styles.weatherTemps}>
                    <Text style={styles.weatherTemp}>{day.tempMax}°</Text>
                    <Text style={styles.weatherTempSep}>/</Text>
                    <Text style={styles.weatherTempLow}>{day.tempMin}°</Text>
                  </View>
                  {day.precipProb > 0 && (
                    <View style={styles.weatherStat}>
                      <Icon name="water-drop" size={11} color="#5BA3FF" />
                      <Text style={styles.weatherRain}>{day.precipProb}%</Text>
                    </View>
                  )}
                  <View style={styles.weatherStat}>
                    <Icon name="air" size={11} color={Colors.textSecondary} />
                    <Text style={styles.weatherWind}>
                      {useKm ? `${day.windMax} km/h` : `${Math.round(day.windMax * 0.621)} mph`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        );

      case 'layoutHeader':
        return <Text style={styles.sectionTitle}>CIRCUIT LAYOUT</Text>;

      case 'layout':
        return (
          <CachedImage
            uri={track.layoutImageUrl}
            style={styles.layoutImg}
            resizeMode="contain"
            accessibilityLabel="Circuit layout map"
          />
        );

      case 'photosHeader':
        return <Text style={styles.sectionTitle}>RACE PHOTOS</Text>;

      case 'photoCarousel':
        return <PhotoCarousel images={track.raceImages} />;

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.floatingBackBtn, {top: statusBarHeight + 12}]}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Go back"
        accessibilityRole="button">
        <Icon name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <FlatList
        data={data}
        keyExtractor={(item, i) => item.key || `${item.type}-${i}`}
        renderItem={renderItem}
        stickyHeaderIndices={[stickyIndex]}
        contentContainerStyle={{paddingBottom: 30, paddingHorizontal: 16}}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollAnim}}}], {useNativeDriver: false})}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function StatBox({label, value}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RecordCard({label, record, useKm}) {
  const speed = (() => {
    if (!record.speed) return '';
    const match = record.speed.match(/^([\d.]+)\s*mph$/i);
    if (!match) return record.speed;
    const mph = parseFloat(match[1]);
    return useKm ? `${(mph * 1.60934).toFixed(2)} km/h` : `${mph.toFixed(2)} mph`;
  })();
  return (
    <View style={[styles.card, {flex: 1, marginHorizontal: 4}]}>
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordTime}>{record.time}</Text>
      <Text style={styles.recordDriver}>{record.driver} ({record.year})</Text>
      <Text style={styles.recordSpeed}>Avg {speed}</Text>
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAROUSEL_WIDTH = SCREEN_WIDTH - 32; // account for paddingHorizontal 16

function PhotoCarousel({images}) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  const onScroll = React.useCallback((e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / CAROUSEL_WIDTH);
    setActiveIndex(idx);
  }, []);

  return (
    <View>
      <FlatList
        data={images}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CAROUSEL_WIDTH}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({item}) => (
          <Image
            source={{uri: item}}
            style={{width: CAROUSEL_WIDTH, height: 200, borderRadius: 10}}
            resizeMode="cover"
            accessibilityLabel="Race photo"
          />
        )}
      />
      {images.length > 1 && (
        <View style={styles.dotsRow}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},

  // Hero
  heroWrap: {height: 220, marginHorizontal: -16},
  heroImg: {width: '100%', height: '100%'},

  // Sticky title block
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  floatingBackBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContent: {flex: 1},
  roundsLabel: {
    color: Colors.yellow,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  venue: {color: '#fff', fontSize: 22, fontWeight: '900'},
  dateRange: {color: Colors.textSecondary, fontSize: 13, marginTop: 2},
  location: {color: Colors.textSecondary, fontSize: 13, marginTop: 2},

  // Stats
  statsRow: {flexDirection: 'row', marginTop: 16, gap: 8},
  statBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  statValue: {color: Colors.yellow, fontSize: 16, fontWeight: '900'},
  statLabel: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 3, letterSpacing: 0.5},

  // Cards
  card: {backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginTop: 12},
  cardText: {color: Colors.textSecondary, fontSize: 14, lineHeight: 22},
  factLabel: {color: Colors.yellow, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6},

  // Section titles
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 24,
    marginBottom: 12,
  },

  // Lap records
  recordsRow: {flexDirection: 'row', marginHorizontal: -4},
  recordLabel: {color: Colors.yellow, fontSize: 11, fontWeight: '800', letterSpacing: 1},
  recordTime: {color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4},
  recordDriver: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  recordSpeed: {color: Colors.textSecondary, fontSize: 11, marginTop: 2},

  // Track guide
  sectorCard: {backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginBottom: 10},

  // Schedule
  scheduleCard: {backgroundColor: Colors.card, borderRadius: 10, padding: 14, gap: 14},
  scheduleDay: {color: Colors.yellow, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8},
  sessionRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(42,45,68,0.4)'},
  sessionName: {color: '#fff', fontSize: 14, fontWeight: '600'},
  sessionTime: {color: Colors.textSecondary, fontSize: 14, fontWeight: '700'},
  sectorName: {color: Colors.yellow, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10},
  cornerRow: {flexDirection: 'row', marginBottom: 12},
  cornerNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cornerNumText: {color: '#fff', fontSize: 11, fontWeight: '800'},
  cornerName: {color: '#fff', fontSize: 14, fontWeight: '700'},
  overtakingBadge: {
    backgroundColor: 'rgba(254,189,2,0.15)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  overtakingText: {color: Colors.yellow, fontSize: 9, fontWeight: '800'},
  cornerDesc: {color: Colors.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18},

  // Layout & photos
  layoutImg: {width: '100%', height: 200, borderRadius: 10},

  // Weather
  weatherRow: {flexDirection: 'row', gap: 8},
  weatherDay: {flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 10, alignItems: 'center', gap: 4},
  weatherDayLabel: {color: Colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5},
  weatherDesc: {color: Colors.textSecondary, fontSize: 10, textAlign: 'center'},
  weatherTemps: {flexDirection: 'row', alignItems: 'baseline', gap: 2},
  weatherTemp: {color: '#fff', fontSize: 16, fontWeight: '800'},
  weatherTempSep: {color: Colors.textSecondary, fontSize: 12},
  weatherTempLow: {color: Colors.textSecondary, fontSize: 13},
  weatherStat: {flexDirection: 'row', alignItems: 'center', gap: 3},
  weatherRain: {color: '#5BA3FF', fontSize: 11, fontWeight: '700'},
  weatherWind: {color: Colors.textSecondary, fontSize: 11},
  racePhoto: {width: '100%', height: 200, borderRadius: 10, marginBottom: 10},

  // Carousel dots
  dotsRow: {flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.outline},
  dotActive: {backgroundColor: Colors.yellow, width: 18},

  // Live Timing button
  liveTimingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227,0,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(227,0,11,0.4)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    gap: 8,
  },
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#E3000B'},
  liveTimingText: {flex: 1, color: '#E3000B', fontSize: 13, fontWeight: '800', letterSpacing: 1},
});
