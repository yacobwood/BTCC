import React, {useMemo} from 'react';
import {View, Text, ScrollView, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';
import {formatDriverName} from '../utils/driverName';

const RACE_LABELS = ['Qualifying Race', 'Race 1', 'Race 2', 'Race 3'];
const SHORT_LABEL = {
  'Qualifying Race': 'QR',
  'Race 1': 'R1',
  'Race 2': 'R2',
  'Race 3': 'R3',
};

const CELL_W = 36;
const CELL_H = 32;
const NAME_W = 100;
const PTS_W = 36;
const LEFT_W = NAME_W + PTS_W;
const HEADER_H = 42;
const BADGE_W = 28;
const BADGE_H = 22;

// Badge style — small rounded rectangle, stronger colours
function badgeStyle(pos, laps, time) {
  if (!pos && laps === undefined) return null; // empty cell
  if (time === 'DSQ') return {bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: 'rgba(239,68,68,0.8)', label: 'DSQ'};
  if (pos === 0 && laps === 0) return {bg: null, border: null, text: 'rgba(255,255,255,0.18)', label: 'DNS'};
  if (pos === 0) return {bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)', text: '#FCA5A5', label: 'Ret'};
  if (pos === 1) return {bg: 'rgba(253,224,71,0.15)', border: 'rgba(253,224,71,0.5)', text: '#FDE047', label: '1'};
  if (pos === 2) return {bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)', text: '#CBD5E1', label: '2'};
  if (pos === 3) return {bg: 'rgba(205,127,50,0.15)', border: 'rgba(205,127,50,0.4)', text: '#D4956A', label: '3'};
  if (pos <= 6)  return {bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#86EFAC', label: String(pos)};
  if (pos <= 15) return {bg: 'rgba(34,197,94,0.07)', border: 'rgba(34,197,94,0.15)', text: 'rgba(134,239,172,0.65)', label: String(pos)};
  return {bg: null, border: null, text: 'rgba(255,255,255,0.3)', label: String(pos)};
}

function buildTableData(results) {
  const columns = [];
  const driverMap = {};

  for (const round of results) {
    const roundRaces = (round.races || []).filter(r => RACE_LABELS.includes(r.label));
    if (roundRaces.length === 0) continue;

    columns.push({
      round: round.round,
      venue: round.venue,
      races: roundRaces.map(r => ({label: r.label, short: SHORT_LABEL[r.label] || r.label})),
    });

    for (const race of roundRaces) {
      for (const entry of race.results || []) {
        if (!entry.driver) continue;
        if (!driverMap[entry.driver]) {
          driverMap[entry.driver] = {team: entry.team || '', points: 0, cells: {}};
        }
        const key = `${round.round}_${race.label}`;
        driverMap[entry.driver].cells[key] = {
          pos: entry.position,
          laps: entry.laps,
          time: entry.time || '',
        };
        driverMap[entry.driver].points += entry.points || 0;
      }
    }
  }

  const tableData = Object.entries(driverMap)
    .map(([name, data]) => ({name, ...data}))
    .sort((a, b) => b.points - a.points);

  return {columns, tableData};
}

function Badge({cell}) {
  if (!cell) return <View style={{width: CELL_W, height: CELL_H}} />;
  const s = badgeStyle(cell.pos, cell.laps, cell.time);
  if (!s) return <View style={{width: CELL_W, height: CELL_H}} />;
  return (
    <View style={{width: CELL_W, height: CELL_H, justifyContent: 'center', alignItems: 'center'}}>
      <View style={[
        styles.badge,
        s.bg && {backgroundColor: s.bg},
        s.border && {borderColor: s.border, borderWidth: 1},
      ]}>
        <Text style={[styles.badgeText, {color: s.text}]}>{s.label}</Text>
      </View>
    </View>
  );
}

const KEY_ITEMS = [
  {label: '1', desc: 'Winner', bg: 'rgba(253,224,71,0.15)', border: 'rgba(253,224,71,0.5)', text: '#FDE047'},
  {label: '2', desc: '2nd', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.4)', text: '#CBD5E1'},
  {label: '3', desc: '3rd', bg: 'rgba(205,127,50,0.15)', border: 'rgba(205,127,50,0.4)', text: '#D4956A'},
  {label: '4', desc: 'Points', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#86EFAC'},
  {label: 'Ret', desc: 'Retired', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)', text: '#FCA5A5'},
  {label: 'DNS', desc: 'Did not start', bg: null, border: null, text: 'rgba(255,255,255,0.18)'},
  {label: 'DSQ', desc: 'Disqualified', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: 'rgba(239,68,68,0.8)'},
];

function KeyRow() {
  return (
    <View style={styles.keyWrap}>
      <Text style={styles.keyTitle}>KEY</Text>
      <View style={styles.keyItems}>
        {KEY_ITEMS.map(item => (
          <View key={item.label} style={styles.keyItem}>
            <View style={[
              styles.badge,
              item.bg && {backgroundColor: item.bg},
              item.border && {borderColor: item.border, borderWidth: 1},
            ]}>
              <Text style={[styles.badgeText, {color: item.text}]}>{item.label}</Text>
            </View>
            <Text style={styles.keyDesc}>{item.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function SeasonTable({results}) {
  const {columns, tableData} = useMemo(() => buildTableData(results || []), [results]);

  if (!tableData.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No race results available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.outer} showsVerticalScrollIndicator={false}>
      <View style={styles.tableRow}>
        {/* Fixed left panel */}
        <View style={{width: LEFT_W}}>
          <View style={styles.leftHeader}>
            <Text style={[styles.headerLabel, {flex: 1, paddingLeft: 10}]}>Driver</Text>
            <Text style={[styles.headerLabel, {width: PTS_W, textAlign: 'center'}]}>Pts</Text>
          </View>
          {tableData.map((driver, i) => (
            <View key={driver.name} style={styles.nameRow}>
              <Text style={styles.rankText}>{i + 1}</Text>
              <Text style={styles.nameText} numberOfLines={1}>
                {formatDriverName(driver.name)}
              </Text>
              <Text style={styles.ptsText}>{driver.points}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable grid */}
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header */}
            <View style={[styles.gridHeader, {flexDirection: 'row'}]}>
              {columns.map((col, ci) => (
                <View
                  key={col.round}
                  style={[
                    {width: col.races.length * CELL_W, alignItems: 'center', justifyContent: 'center'},
                    ci < columns.length - 1 && styles.groupDivider,
                  ]}>
                  <Text style={styles.roundLabel}>R{col.round}</Text>
                  <View style={{flexDirection: 'row'}}>
                    {col.races.map(race => (
                      <View key={race.label} style={{width: CELL_W, alignItems: 'center'}}>
                        <Text style={styles.raceLabel}>{race.short}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {/* Data rows */}
            {tableData.map((driver, i) => (
              <View key={driver.name} style={{flexDirection: 'row'}}>
                {columns.map((col, ci) =>
                  col.races.map(race => {
                    const key = `${col.round}_${race.label}`;
                    const isLastInGroup = race.label === col.races[col.races.length - 1].label;
                    return (
                      <View
                        key={key}
                        style={[
                          ci < columns.length - 1 && isLastInGroup && styles.groupDivider,
                        ]}>
                        <Badge cell={driver.cells[key]} />
                      </View>
                    );
                  }),
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      <KeyRow />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer: {flex: 1, backgroundColor: Colors.background},
  tableRow: {flexDirection: 'row'},

  leftHeader: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  nameRow: {
    height: CELL_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
  },
  rankText: {
    width: 18,
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 2,
  },
  nameText: {flex: 1, color: '#fff', fontSize: 11, fontWeight: '600'},
  ptsText: {
    width: PTS_W,
    color: Colors.yellow,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerLabel: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700'},

  gridHeader: {
    height: HEADER_H,
    alignItems: 'flex-end',
    paddingBottom: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  roundLabel: {
    color: Colors.yellow,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  raceLabel: {color: Colors.textSecondary, fontSize: 9, fontWeight: '600'},

  groupDivider: {borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)'},

  badge: {
    width: BADGE_W,
    height: BADGE_H,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {fontSize: 10, fontWeight: '800'},

  empty: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60},
  emptyText: {color: Colors.textSecondary, fontSize: 14},

  keyWrap: {
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 14,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  keyTitle: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  keyItems: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  keyItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  keyDesc: {color: Colors.textSecondary, fontSize: 11, fontWeight: '500'},
});
