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

const CELL_W = 32;
const CELL_H = 30;
const NAME_W = 96;
const PTS_W = 36;
const LEFT_W = NAME_W + PTS_W;
const HEADER_H = 40;
const ROW_DIVIDER = 'rgba(255,255,255,0.06)';

// Low-opacity tints — dark bg bleeds through for a modern look
function cellBg(pos, laps, time) {
  if (time === 'DSQ') return 'rgba(239,68,68,0.12)';
  if (pos === 0 && laps === 0) return null;                 // DNS
  if (pos === 0) return 'rgba(239,68,68,0.18)';             // Ret
  if (pos === 1) return 'rgba(253,224,71,0.22)';            // P1 — gold
  if (pos === 2) return 'rgba(148,163,184,0.2)';            // P2 — silver
  if (pos === 3) return 'rgba(180,120,60,0.22)';            // P3 — bronze
  if (pos <= 15) return 'rgba(34,197,94,0.18)';             // Points — green
  return null;
}

function cellLabel(pos, laps, time) {
  if (time === 'DSQ') return 'DSQ';
  if (pos === 0 && laps === 0) return 'DNS';
  if (pos === 0) return 'Ret';
  return String(pos);
}

function cellTextColor(pos, laps, time) {
  if (time === 'DSQ') return 'rgba(239,68,68,0.7)';
  if (pos === 0 && laps === 0) return 'rgba(255,255,255,0.2)'; // DNS — very faint
  if (pos === 0) return 'rgba(252,165,165,0.9)';               // Ret — soft red
  if (pos === 1) return '#FDE047';                              // P1 — yellow
  if (pos === 2) return '#CBD5E1';                              // P2 — silver
  if (pos === 3) return '#D4956A';                              // P3 — bronze
  if (pos <= 15) return '#86EFAC';                              // Points — soft green
  return 'rgba(255,255,255,0.45)';                              // Outside points — muted
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
            <Text style={[styles.headerLabel, {flex: 1, paddingLeft: 8}]}>Driver</Text>
            <Text style={[styles.headerLabel, {width: PTS_W, textAlign: 'center'}]}>Pts</Text>
          </View>
          {tableData.map((driver, i) => (
            <View
              key={driver.name}
              style={[
                styles.nameRow,
                i < tableData.length - 1 && styles.rowDivider,
              ]}>
              <Text style={styles.nameText} numberOfLines={1}>
                {formatDriverName(driver.name)}
              </Text>
              <Text style={styles.ptsText}>{driver.points}</Text>
            </View>
          ))}
        </View>

        {/* Horizontally scrollable grid */}
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header */}
            <View style={[styles.gridHeader, {flexDirection: 'row'}]}>
              {columns.map((col, ci) => (
                <View
                  key={col.round}
                  style={[
                    {width: col.races.length * CELL_W, alignItems: 'center', justifyContent: 'center'},
                    ci < columns.length - 1 && styles.colGroupBorder,
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
              <View
                key={driver.name}
                style={[
                  {flexDirection: 'row'},
                  i < tableData.length - 1 && styles.rowDivider,
                ]}>
                {columns.map((col, ci) =>
                  col.races.map(race => {
                    const key = `${col.round}_${race.label}`;
                    const cell = driver.cells[key];
                    const bg = cell ? cellBg(cell.pos, cell.laps, cell.time) : null;
                    const label = cell ? cellLabel(cell.pos, cell.laps, cell.time) : '·';
                    const color = cell
                      ? cellTextColor(cell.pos, cell.laps, cell.time)
                      : 'rgba(255,255,255,0.12)';
                    const isLastInGroup = race.label === col.races[col.races.length - 1].label;
                    return (
                      <View
                        key={key}
                        style={[
                          styles.cell,
                          bg && {backgroundColor: bg},
                          ci < columns.length - 1 && isLastInGroup && styles.colGroupBorder,
                        ]}>
                        <Text style={[styles.cellText, {color}]}>{label}</Text>
                      </View>
                    );
                  }),
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  outer: {flex: 1, backgroundColor: Colors.background},
  tableRow: {flexDirection: 'row'},

  // Left panel
  leftHeader: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  nameRow: {
    height: CELL_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  rowDivider: {borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ROW_DIVIDER},
  nameText: {flex: 1, color: '#fff', fontSize: 11, fontWeight: '600'},
  ptsText: {width: PTS_W, color: Colors.yellow, fontSize: 11, fontWeight: '800', textAlign: 'center'},

  // Grid header
  gridHeader: {
    height: HEADER_H,
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
    paddingBottom: 4,
  },
  roundLabel: {color: Colors.yellow, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2},
  raceLabel: {color: Colors.textSecondary, fontSize: 9, fontWeight: '600'},
  headerLabel: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5},

  // Group separator between rounds
  colGroupBorder: {borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)'},

  // Cell
  cell: {
    width: CELL_W,
    height: CELL_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {fontSize: 10, fontWeight: '700'},

  empty: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60},
  emptyText: {color: Colors.textSecondary, fontSize: 14},
});
