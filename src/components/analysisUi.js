import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {TEAM_COLORS} from '../theme/teamColors';
import {formatDriverName} from '../utils/driverName';

// Shared building blocks for RoundResultsScreen's session analysis tabs
// (speed traps, Perfect Lap, Lap Times, Top 5 Average, Tyres, Session Stats)
// so every ranked table reads as one family: team colour stripe, podium
// colouring for the top 3, a bar showing each value's place in the field's
// spread, and one consistent favourite-driver treatment.

export const PODIUM = ['#FEBD02', '#C9CDD6', '#D4853F'];

export function teamColor(team) {
  return TEAM_COLORS[team] || Colors.outline;
}

export function RankBadge({pos}) {
  const podium = pos >= 1 && pos <= 3;
  return (
    <Text style={[styles.rank, podium && {color: PODIUM[pos - 1]}]}>{pos}</Text>
  );
}

export function TeamStripe({team}) {
  return <View style={[styles.stripe, {backgroundColor: teamColor(team)}]} />;
}

// `fraction` 0..1 = how close this value is to the best in the field (1 =
// the best). Drawn as a thin track under the row's value so the spread is
// readable at a glance without reading every number.
export function ValueBar({fraction, fav}) {
  const f = Math.max(0.04, Math.min(1, fraction || 0));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, {width: `${f * 100}%`}, fav && styles.barFillFav]} />
    </View>
  );
}

// Maps a value onto 0.12..1 within [worst, best] - works for "higher is
// better" (speeds) and "lower is better" (lap times) alike, since best and
// worst are passed explicitly. The floor keeps the slowest car's bar a
// visible stub rather than vanishing.
export function closeness(value, best, worst) {
  if (value == null || best == null || worst == null || best === worst) return 1;
  return 0.12 + 0.88 * (1 - (value - best) / (worst - best));
}

export function DriverName({name, fav, style}) {
  return (
    <View style={styles.nameWrap}>
      {fav && <Icon name="star" size={13} color={Colors.yellow} style={styles.star} />}
      <Text style={[styles.name, fav && styles.nameFav, style]} numberOfLines={1}>{formatDriverName(name)}</Text>
    </View>
  );
}

export const favRowStyle = {
  backgroundColor: 'rgba(254,189,2,0.10)',
  borderColor: 'rgba(254,189,2,0.55)',
};

export function ColumnHeader({children, style}) {
  return <Text style={[styles.colHeader, style]}>{children}</Text>;
}

export const tableStyles = StyleSheet.create({
  card: {backgroundColor: Colors.card, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 8, marginTop: 4, marginBottom: 6},
  headerRow: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6, gap: 8},
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingRight: 6, paddingLeft: 0,
    borderRadius: 8, borderWidth: 1, borderColor: 'transparent', marginVertical: 1,
  },
  main: {flex: 1, minWidth: 0},
  value: {color: '#fff', fontSize: 12.5, fontWeight: '800', textAlign: 'right', fontVariant: ['tabular-nums']},
  sub: {color: Colors.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums']},
  footnote: {color: Colors.textSecondary, fontSize: 10.5, marginTop: 6, marginHorizontal: 6, marginBottom: 4, lineHeight: 15},
});

const styles = StyleSheet.create({
  rank: {color: '#fff', fontSize: 13, fontWeight: '900', width: 22, textAlign: 'center', fontVariant: ['tabular-nums']},
  stripe: {width: 3, alignSelf: 'stretch', borderRadius: 2},
  barTrack: {height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 5, overflow: 'hidden'},
  barFill: {height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.32)'},
  barFillFav: {backgroundColor: Colors.yellow},
  nameWrap: {flexDirection: 'row', alignItems: 'center', minWidth: 0},
  star: {marginRight: 3},
  name: {color: '#fff', fontSize: 12.5, fontWeight: '700', flexShrink: 1},
  nameFav: {color: Colors.yellow},
  colHeader: {color: Colors.textSecondary, fontSize: 9.5, fontWeight: '800', letterSpacing: 1},
});
