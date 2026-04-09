import React, {useState, useEffect, useCallback, useRef, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {fetchCalendar} from '../api/client';
import {parseCalendar} from '../api/parsers';
import {useFocusEffect} from '@react-navigation/native';
import {Analytics} from '../utils/analytics';

const RED = '#E3000B';

function formatDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const sMonth = s.toLocaleDateString('en-GB', {month: 'short'});
  const eMonth = e.toLocaleDateString('en-GB', {month: 'short'});
  const year = e.getFullYear();
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${eMonth} ${year}`;
  }
  return `${s.getDate()} ${sMonth} – ${e.getDate()} ${eMonth} ${year}`;
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function firstRaceNumber(round) {
  return (round - 1) * 3 + 1;
}

export default function CalendarScreen({navigation}) {
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef(null);

  useFocusEffect(useCallback(() => {
    flatListRef.current?.scrollToOffset({offset: 0, animated: false});
  }, []));

  const load = useCallback(async () => {
    try {
      const raw = fetchCalendar();
      setCalendar(parseCalendar(raw));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    Analytics.screen('calendar');
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    Analytics.pullToRefresh('calendar');
    setRefreshing(true);
    load();
  }, [load]);

  const rounds = calendar?.rounds || [];
  const today = new Date().toISOString().split('T')[0];

  const activeRound = useMemo(
    () => rounds.find(r => r.startDate <= today && today <= r.endDate),
    [rounds, today],
  );
  const nextRound = useMemo(
    () => (!activeRound ? rounds.find(r => r.startDate > today) : null),
    [rounds, today, activeRound],
  );

  const pastCount = useMemo(
    () => rounds.filter(r => r.endDate < today).length,
    [rounds, today],
  );
  const totalRaces = rounds.length * 3;

  const activeWeekendRaces = useMemo(() => {
    if (!activeRound?.sessions) return 0;
    const now = new Date();
    const dayOrder = {SAT: 0, SUN: 1};
    const currentDay = now.toLocaleDateString('en-US', {weekday: 'short'}).toUpperCase().slice(0, 3);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return activeRound.sessions.filter(s => {
      if (!/^Race \d+$/i.test(s.name)) return false;
      const sd = dayOrder[s.day] ?? 0;
      const cd = dayOrder[currentDay] ?? 0;
      if (sd < cd) return true;
      if (sd > cd) return false;
      return s.time <= currentTime;
    }).length;
  }, [activeRound]);

  const completedRaces = pastCount * 3 + activeWeekendRaces;
  const progress = rounds.length > 0 ? pastCount / rounds.length : 0;

  // Build list with a divider injected before the first upcoming/active item
  const listData = useMemo(() => {
    const items = [];
    let dividerAdded = false;
    rounds.forEach(round => {
      const isPast = round.endDate < today;
      if (!isPast && !dividerAdded) {
        if (pastCount > 0) {
          items.push({type: 'divider'});
        }
        dividerAdded = true;
      }
      items.push({type: 'round', round});
    });
    return items;
  }, [rounds, today, pastCount]);

  const focusRound = activeRound || nextRound;
  const focusRoundIndex = focusRound ? rounds.indexOf(focusRound) : -1;

  useEffect(() => {
    if (!loading && focusRoundIndex > 1 && flatListRef.current) {
      const dividerOffset = pastCount > 0 ? 1 : 0;
      const targetIndex = focusRoundIndex + dividerOffset;
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: Math.max(0, targetIndex - 1),
            animated: false,
          });
        } catch {}
      }, 150);
    }
  }, [loading, focusRoundIndex, pastCount]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.yellow} size="large" />
      </View>
    );
  }

  const navigate = item => {
    Analytics.raceClicked(item.round, item.venue);
    navigation.navigate('TrackDetail', {track: item});
  };

  const renderItem = ({item}) => {
    if (item.type === 'divider') {
      return (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>UPCOMING</Text>
          <View style={styles.dividerLine} />
        </View>
      );
    }

    const {round} = item;
    const rStart = firstRaceNumber(round.round);
    const rEnd = rStart + 2;
    const isPast = round.endDate < today;
    const isActive = round.startDate <= today && today <= round.endDate;
    const isNext = !activeRound && round === nextRound;

    // Race weekend in progress
    if (isActive) {
      return (
        <TouchableOpacity
          style={styles.liveCard}
          activeOpacity={0.8}
          onPress={() => navigate(round)}
          accessibilityLabel={`${round.venue} — Race Weekend`}
          accessibilityRole="button">
          <View style={styles.liveBadgeRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>RACE WEEKEND</Text>
            <Text style={styles.liveRoundsLabel}>Rds {rStart}–{rEnd}</Text>
          </View>
          <Text style={styles.liveVenue}>{round.venue}</Text>
          <View style={styles.liveFooter}>
            <Text style={styles.liveDate}>
              {formatDateRange(round.startDate, round.endDate)}
            </Text>
            <View style={styles.liveChevron}>
              <Icon name="chevron-right" size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Next upcoming race
    if (isNext) {
      const days = daysUntil(round.startDate);
      return (
        <TouchableOpacity
          style={styles.nextCard}
          activeOpacity={0.8}
          onPress={() => navigate(round)}
          accessibilityLabel={`Next race: ${round.venue}`}
          accessibilityRole="button">
          <View style={styles.nextCardInner}>
            <View style={styles.nextLeft}>
              <Text style={styles.nextBadge}>
                NEXT RACE · Rds {rStart}–{rEnd}
              </Text>
              <Text style={styles.nextVenue}>{round.venue}</Text>
              <Text style={styles.nextDate}>
                {formatDateRange(round.startDate, round.endDate)}
              </Text>
            </View>
            <View style={styles.nextCountdown}>
              {days === 0 ? (
                <Text style={styles.countdownToday}>TODAY</Text>
              ) : days === 1 ? (
                <Text style={styles.countdownToday}>TMW</Text>
              ) : (
                <>
                  <Text style={styles.countdownNum}>{days}</Text>
                  <Text style={styles.countdownUnit}>DAYS</Text>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // Past round
    if (isPast) {
      return (
        <TouchableOpacity
          style={styles.pastRow}
          activeOpacity={0.6}
          onPress={() => navigate(round)}
          accessibilityLabel={`${round.venue} — completed`}
          accessibilityRole="button">
          <Icon
            name="check-circle"
            size={15}
            color={Colors.outline}
            style={styles.pastIcon}
          />
          <View style={styles.pastContent}>
            <Text style={styles.pastVenue}>{round.venue}</Text>
            <Text style={styles.pastDate}>
              {formatDateRange(round.startDate, round.endDate)}
            </Text>
          </View>
          <Text style={styles.pastRounds}>Rds {rStart}–{rEnd}</Text>
          <Icon name="chevron-right" size={14} color={Colors.outline} />
        </TouchableOpacity>
      );
    }

    // Future round
    const futureDays = daysUntil(round.startDate);
    return (
      <TouchableOpacity
        style={styles.futureCard}
        activeOpacity={0.75}
        onPress={() => navigate(round)}
        accessibilityLabel={`${round.venue} in ${futureDays} days`}
        accessibilityRole="button">
        <View style={styles.futureLeft}>
          <Text style={styles.futureRounds}>Rounds {rStart}–{rEnd}</Text>
          <Text style={styles.futureVenue}>{round.venue}</Text>
          <Text style={styles.futureDate}>
            {formatDateRange(round.startDate, round.endDate)}
          </Text>
        </View>
        <View style={styles.futureRight}>
          <Text style={styles.futureDays}>{futureDays}d</Text>
          <Icon name="chevron-right" size={16} color={Colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  };

  const year = rounds[0]?.startDate?.substring(0, 4) || '2026';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{year} SEASON</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>
            {completedRaces} of {totalRaces} races
          </Text>
        </View>
      </View>

      {/* Season progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {width: `${Math.round(progress * 100)}%`},
          ]}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={item =>
          item.type === 'divider' ? 'divider' : String(item.round.round)
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.yellow}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSub: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  headerPill: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  headerPillText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  // Progress bar
  progressTrack: {
    height: 2,
    backgroundColor: Colors.outline,
    marginHorizontal: 16,
    borderRadius: 1,
    marginBottom: 20,
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.yellow,
    borderRadius: 1,
  },

  listContent: {paddingHorizontal: 16, paddingBottom: 24},

  // Section divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  dividerLine: {flex: 1, height: 1, backgroundColor: Colors.outline},
  dividerLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginHorizontal: 10,
  },

  // Live / active race weekend card
  liveCard: {
    backgroundColor: 'rgba(254,189,2,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(254,189,2,0.28)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    flex: 1,
  },
  liveRoundsLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  liveVenue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  liveFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  liveDate: {color: Colors.textSecondary, fontSize: 13, flex: 1},
  liveChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(254,189,2,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Next race card
  nextCard: {
    backgroundColor: 'rgba(254,189,2,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(254,189,2,0.28)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  nextCardInner: {flexDirection: 'row', alignItems: 'center'},
  nextLeft: {flex: 1},
  nextBadge: {
    color: Colors.yellow,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  nextVenue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  nextDate: {color: Colors.textSecondary, fontSize: 13, marginTop: 4},
  nextCountdown: {alignItems: 'center', marginLeft: 16, minWidth: 52},
  countdownNum: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 46,
  },
  countdownUnit: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  countdownToday: {
    color: Colors.yellow,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Past rounds
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
    opacity: 0.45,
  },
  pastIcon: {marginRight: 10},
  pastContent: {flex: 1},
  pastVenue: {color: '#fff', fontSize: 13, fontWeight: '600'},
  pastDate: {color: Colors.textSecondary, fontSize: 11, marginTop: 1},
  pastRounds: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginRight: 6,
  },

  // Future rounds
  futureCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  futureLeft: {flex: 1},
  futureRounds: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  futureVenue: {color: '#fff', fontSize: 15, fontWeight: '700'},
  futureDate: {color: Colors.textSecondary, fontSize: 12, marginTop: 2},
  futureRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  futureDays: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
