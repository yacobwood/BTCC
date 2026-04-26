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

const CELL_W = 30;
const CELL_H = 26;
const NAME_W = 92;
const PTS_W = 36;
const LEFT_W = NAME_W + PTS_W;

function cellBg(pos, laps, time) {
  if (time === 'DSQ') return '#1a1a1a';
  if (pos === 0 && laps === 0) return null;     // DNS — no bg
  if (pos === 0) return '#7F1D1D';              // Ret — dark red
  if (pos === 1) return '#78350F';              // Gold tint
  if (pos === 2) return '#374151';              // Silver tint
  if (pos === 3) return '#431407';              // Bronze tint
  if (pos <= 15) return '#14532D';              // Green — in points
  return null;                                  // Outside points
}

function cellLabel(pos, laps, time) {
  if (time === 'DSQ') return 'DSQ';
  if (pos === 0 && laps === 0) return 'DNS';
  if (pos === 0) return 'Ret';
  return String(pos);
}

function cellTextColor(pos, laps) {
  if (pos === 0 && laps === 0) return Colors.textSecondary; // DNS — muted
  return '#fff';
}

function buildTableData(results) {
  // columns: [{round, races: [{label, short}]}]
  const columns = [];
  // driverMap: name → {points, cells: {key: {pos, laps, time}}}
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
      <View style={styles.row}>
        {/* Fixed left panel: driver names + points */}
        <View style={{width: LEFT_W}}>
          {/* Header */}
          <View style={[styles.nameCell, styles.headerCell]}>
            <Text style={[styles.nameText, styles.headerText, {width: NAME_W}]}>Driver</Text>
            <Text style={[styles.ptsText, styles.headerText]}>Pts</Text>
          </View>
          {tableData.map((driver, i) => (
            <View
              key={driver.name}
              style={[styles.nameCell, i % 2 === 1 && styles.altRow]}>
              <Text style={[styles.nameText, {width: NAME_W}]} numberOfLines={1}>
                {formatDriverName(driver.name)}
              </Text>
              <Text style={styles.ptsText}>{driver.points}</Text>
            </View>
          ))}
        </View>

        {/* Horizontally scrollable grid */}
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View style={[styles.headerCell, {flexDirection: 'row'}]}>
              {columns.map((col, ci) => (
                <View
                  key={col.round}
                  style={[
                    styles.roundGroup,
                    {width: col.races.length * CELL_W},
                    ci < columns.length - 1 && styles.roundBorder,
                  ]}>
                  <Text style={styles.roundLabel} numberOfLines={1}>
                    R{col.round}
                  </Text>
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
                style={[{flexDirection: 'row'}, i % 2 === 1 && styles.altRow]}>
                {columns.map((col, ci) =>
                  col.races.map(race => {
                    const key = `${col.round}_${race.label}`;
                    const cell = driver.cells[key];
                    const bg = cell ? cellBg(cell.pos, cell.laps, cell.time) : null;
                    const label = cell ? cellLabel(cell.pos, cell.laps, cell.time) : '';
                    const textColor = cell ? cellTextColor(cell.pos, cell.laps) : Colors.textSecondary;
                    return (
                      <View
                        key={key}
                        style={[
                          styles.cell,
                          bg ? {backgroundColor: bg} : null,
                          ci < columns.length - 1 &&
                            race.label === col.races[col.races.length - 1].label &&
                            styles.roundBorder,
                        ]}>
                        <Text style={[styles.cellText, {color: textColor}]}>{label}</Text>
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
  row: {flexDirection: 'row'},
  headerCell: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  altRow: {backgroundColor: 'rgba(255,255,255,0.03)'},
  nameCell: {
    height: CELL_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  nameText: {color: '#fff', fontSize: 11, fontWeight: '600'},
  ptsText: {width: PTS_W, color: Colors.yellow, fontSize: 11, fontWeight: '800', textAlign: 'center'},
  headerText: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700'},
  roundGroup: {alignItems: 'center', paddingTop: 2},
  roundLabel: {color: Colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 0.5},
  raceLabel: {color: Colors.textSecondary, fontSize: 9, fontWeight: '600'},
  roundBorder: {borderRightWidth: 1, borderRightColor: Colors.outline},
  cell: {
    width: CELL_W,
    height: CELL_H,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cellText: {fontSize: 10, fontWeight: '700'},
  empty: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60},
  emptyText: {color: Colors.textSecondary, fontSize: 14},
});
