import React, {useMemo, useState, useEffect, useRef} from 'react';
import {View, Text, ScrollView, Animated, PanResponder, TouchableOpacity, StyleSheet, ActivityIndicator, InteractionManager} from 'react-native';
import {Colors} from '../theme/colors';

const RACE_LABELS = ['Qualifying Race', 'Race 1', 'Race 2', 'Race 3'];
const SHORT_LABEL = {
  'Qualifying Race': 'QR',
  'Race 1': 'R1',
  'Race 2': 'R2',
  'Race 3': 'R3',
};

const CELL_W = 40;
const CELL_H = 36;
const BADGE_W = 36;
const BADGE_H = 30;
const NAME_W = 104;
const PTS_W = 38;
const LEFT_W = NAME_W + PTS_W;
const HEADER_H = 56;

const VENUE_ABBR = {
  'Donington Park':    'DON',
  'Donington Park GP': 'DPG',
  'Donington':         'DON',
  'Brands Hatch':      'BH',
  'Brands Hatch Indy': 'BHI',
  'Brands Hatch GP':   'BHGP',
  'Snetterton':        'SNE',
  'Thruxton':          'THR',
  'Oulton Park':       'OUL',
  'Croft':             'CRO',
  'Knockhill':         'KNO',
  'Silverstone':       'SIL',
  'Rockingham':        'ROC',
  'Mondello Park':     'MON',
};

// Bold, solid colours for top positions  -  fade everything else out
function badgeStyle(pos, laps, time, status) {
  if (status === 'DQ' || time === 'DSQ') return {
    bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)',
    text: '#FCA5A5', label: 'DQ', solid: false,
  };
  if (pos === 0 && laps === 0) return {
    bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.45)',
    text: '#FCA5A5', label: 'DNS', solid: false,
  };
  if (pos === 0) return {
    bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.45)',
    text: '#FCA5A5', label: 'DNF', solid: false,
  };
  // Solid podium badges  -  stand out completely
  if (pos === 1) return {
    bg: '#FEBD02', border: null,
    text: Colors.navy, label: '1', solid: true,
  };
  if (pos === 2) return {
    bg: '#94A3B8', border: null,
    text: '#0F172A', label: '2', solid: true,
  };
  if (pos === 3) return {
    bg: '#C07840', border: null,
    text: '#1C0F00', label: '3', solid: true,
  };
  // Points P4-P15: smooth green gradient, brightest at P4 fading to P15
  if (pos <= 15) {
    const t      = (pos - 4) / 11;
    const bg     = `rgba(34,197,94,${(0.22 - t * 0.16).toFixed(3)})`;
    const border = `rgba(34,197,94,${(0.50 - t * 0.38).toFixed(3)})`;
    return {bg, border, text: '#86EFAC', label: String(pos), solid: false};
  }
  // Outside points  -  subtle border, dim text
  return {
    bg: null, border: 'rgba(255,255,255,0.1)',
    text: 'rgba(255,255,255,0.3)', label: String(pos), solid: false,
  };
}

function buildTableData(results) {
  const columns = [];
  const driverMap = {};
  const racesWithResults = new Set();

  const hasQR = results.some(r => (r.races || []).some(race => race.label === 'Qualifying Race'));
  const activeLabels = hasQR ? RACE_LABELS : RACE_LABELS.filter(l => l !== 'Qualifying Race');

  for (const round of results) {
    columns.push({
      round: round.round,
      venue: round.venue,
      races: activeLabels.map(label => ({label, short: SHORT_LABEL[label]})),
    });

    const roundRaces = (round.races || []).filter(r => RACE_LABELS.includes(r.label));
    for (const race of roundRaces) {
      const key0 = `${round.round}_${race.label}`;
      if ((race.results || []).length > 0) racesWithResults.add(key0);
      for (const entry of race.results || []) {
        if (!entry.driver) continue;
        if (!driverMap[entry.driver]) {
          driverMap[entry.driver] = {team: entry.team || '', points: 0, cells: {}};
        }
        driverMap[entry.driver].cells[key0] = {
          pos: entry.position ?? entry.pos,
          laps: entry.laps,
          time: entry.time || '',
          status: entry.status || null,
          fl: entry.fastestLap || entry.fl || false,
          lead: entry.leadLap || entry.l || false,
          pole: entry.pole || entry.p || false,
        };
        driverMap[entry.driver].points += entry.points || 0;
      }
    }
  }

  return {
    columns,
    racesWithResults,
    tableData: Object.entries(driverMap)
      .map(([name, data]) => ({name, ...data}))
      .sort((a, b) => b.points - a.points),
  };
}

// Fixed-order bonus labels
const BONUS_DOTS = [
  {key: 'pole', label: 'PP'},
  {key: 'fl',   label: 'FL'},
  {key: 'lead', label: 'LL'},
];

function bonusCount(cell) {
  if (!cell) return 0;
  return (cell.fl ? 1 : 0) + (cell.lead ? 1 : 0) + (cell.pole ? 1 : 0);
}

function Badge({cell, hasData}) {
  if (!cell) return (
    <View style={{width: CELL_W, height: CELL_H, justifyContent: 'center', alignItems: 'center'}}>
      {hasData ? (
        <View style={[styles.badge, {borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)'}]}>
          <Text style={styles.dneText}>DNE</Text>
        </View>
      ) : null}
    </View>
  );
  const s = badgeStyle(cell.pos, cell.laps, cell.time, cell.status);
  const isDNS = cell.pos === 0 && cell.laps === 0 && cell.status !== 'DQ';
  const bonus = isDNS ? 0 : bonusCount(cell);
  const bonusText = bonus > 0
    ? BONUS_DOTS.filter(({key}) => cell[key]).map(({label}) => label).join(' ')
    : null;
  return (
    <View style={{width: CELL_W, height: CELL_H, justifyContent: 'center', alignItems: 'center'}}>
      <View style={[
        styles.badge,
        bonusText && styles.badgeWithBonus,
        s.solid && styles.badgeSolid,
        !s.solid && s.bg && {backgroundColor: s.bg},
        !s.solid && s.border && {borderColor: s.border, borderWidth: 1},
        s.solid && s.bg && {backgroundColor: s.bg},
      ]}>
        <Text style={[
          styles.badgeText,
          {color: s.text},
          s.solid && styles.badgeTextSolid,
        ]}>{s.label}</Text>
        {bonusText ? (
          <Text style={[styles.bonusLabel, s.solid && {color: 'rgba(0,0,0,0.55)'}]}>{bonusText}</Text>
        ) : null}
      </View>
    </View>
  );
}

const KEY_ITEMS = [
  {label: '1', desc: 'Winner', style: badgeStyle(1, 1, '')},
  {label: '2', desc: '2nd place', style: badgeStyle(2, 1, '')},
  {label: '3', desc: '3rd place', style: badgeStyle(3, 1, '')},
  {label: '4', desc: 'Points finish', style: badgeStyle(4, 1, '')},
  {label: 'DNF', desc: 'Did not finish', style: badgeStyle(0, 1, '', null)},
  {label: 'DNS', desc: 'Did not start', style: badgeStyle(0, 0, '')},
  {label: 'DQ', desc: 'Disqualified', style: badgeStyle(0, 1, '', 'DQ')},
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
              item.style.solid && styles.badgeSolid,
              !item.style.solid && item.style.bg && {backgroundColor: item.style.bg},
              !item.style.solid && item.style.border && {borderColor: item.style.border, borderWidth: 1},
              item.style.solid && {backgroundColor: item.style.bg},
            ]}>
              <Text style={[
                styles.badgeText,
                {color: item.style.text},
                item.style.solid && styles.badgeTextSolid,
              ]}>{item.label}</Text>
            </View>
            <Text style={styles.keyDesc}>{item.desc}</Text>
          </View>
        ))}
      </View>
      {/* Bonus point label legend */}
      <View style={styles.bonusKeyWrap}>
        <Text style={styles.bonusKeyTitle}>BONUS POINTS</Text>
        <View style={styles.keyItems}>
          {BONUS_DOTS.map(({key, label}) => (
            <View key={key} style={styles.keyItem}>
              <Text style={[styles.bonusLabel, {fontSize: 9}]}>{label}</Text>
              <Text style={styles.keyDesc}>
                {key === 'pole' ? 'Pole position' : key === 'fl' ? 'Fastest lap' : 'Lead lap'}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function SeasonTable({results, standings}) {
  const [ready, setReady] = useState(false);
  const [keyExpanded, setKeyExpanded] = useState(false);

  // Animated scroll offsets - positive = scrolled right/down
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  // JS-side mirrors updated by listeners (used during PanResponder gesture)
  const offsetX = useRef(0);
  const offsetY = useRef(0);
  // Captured at gesture start so dx/dy can be applied from that baseline
  const startX = useRef(0);
  const startY = useRef(0);
  // Max scroll distances, set on grid layout
  const maxX = useRef(0);
  const maxY = useRef(0);
  // References to running decay animations so we can stop them on next touch
  const anim = useRef({x: null, y: null});

  useEffect(() => {
    const xId = scrollX.addListener(({value}) => {
      if (value < 0 || value > maxX.current) {
        anim.current.x?.stop();
        anim.current.x = null;
        const clamped = Math.max(0, Math.min(maxX.current, value));
        scrollX.setValue(clamped);
        offsetX.current = clamped;
      } else {
        offsetX.current = value;
      }
    });
    const yId = scrollY.addListener(({value}) => {
      if (value < 0 || value > maxY.current) {
        anim.current.y?.stop();
        anim.current.y = null;
        const clamped = Math.max(0, Math.min(maxY.current, value));
        scrollY.setValue(clamped);
        offsetY.current = clamped;
      } else {
        offsetY.current = value;
      }
    });
    return () => { scrollX.removeListener(xId); scrollY.removeListener(yId); };
  }, [scrollX, scrollY]);

  useEffect(() => {
    setReady(false);
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, [results]);

  const {columns, tableData, racesWithResults} = useMemo(() => {
    const base = buildTableData(results || []);
    // Override points and ordering with official standings when available
    if (standings?.drivers?.length) {
      const officialPts = {};
      const officialPos = {};
      standings.drivers.forEach(d => {
        officialPts[d.name] = d.points;
        officialPos[d.name] = d.position;
      });
      base.tableData = base.tableData
        .map(d => ({...d, points: officialPts[d.name] ?? d.points, _pos: officialPos[d.name] ?? 999}))
        .sort((a, b) => a._pos - b._pos);
    }
    return base;
  }, [results, standings]);

  const contentWidth = useMemo(
    () => columns.reduce((sum, col) => sum + col.races.length * CELL_W, 0),
    [columns],
  );
  const contentHeight = useMemo(() => tableData.length * CELL_H, [tableData]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // Stop momentum and capture the current scroll position as our baseline
      anim.current.x?.stop();
      anim.current.y?.stop();
      startX.current = offsetX.current;
      startY.current = offsetY.current;
    },
    onPanResponderMove: (_, {dx, dy}) => {
      scrollX.setValue(Math.max(0, Math.min(maxX.current, startX.current - dx)));
      scrollY.setValue(Math.max(0, Math.min(maxY.current, startY.current - dy)));
    },
    onPanResponderRelease: (_, {vx, vy}) => {
      anim.current.x = Animated.decay(scrollX, {velocity: -vx, deceleration: 0.997});
      anim.current.y = Animated.decay(scrollY, {velocity: -vy, deceleration: 0.997});
      Animated.parallel([anim.current.x, anim.current.y]).start();
    },
    onPanResponderTerminate: () => {
      anim.current.x?.stop();
      anim.current.y?.stop();
    },
  })).current;

  const onGridLayout = ({nativeEvent: {layout: {width, height}}}) => {
    maxX.current = Math.max(0, contentWidth - width);
    maxY.current = Math.max(0, contentHeight - height);
  };

  // Pre-computed negated Animated.Values for content transforms
  const negX = useMemo(() => Animated.multiply(scrollX, -1), [scrollX]);
  const negY = useMemo(() => Animated.multiply(scrollY, -1), [scrollY]);

  if (!ready) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={Colors.yellow} />
      </View>
    );
  }

  if (!tableData.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No race results available</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      {/* Sticky header - translates horizontally with the grid */}
      <View style={styles.headerRow}>
        <View style={styles.leftHeader}>
          <Text style={[styles.colLabel, {flex: 1, paddingLeft: 10}]}>Driver</Text>
          <Text style={[styles.colLabel, {width: PTS_W, textAlign: 'center'}]}>Pts</Text>
        </View>
        <View style={styles.headerClip}>
          <Animated.View style={[styles.gridHeader, {transform: [{translateX: negX}]}]}>
            {columns.map((col, ci) => (
              <View
                key={col.round}
                style={[
                  {width: col.races.length * CELL_W, alignItems: 'center', justifyContent: 'center'},
                  ci < columns.length - 1 && styles.groupDivider,
                ]}>
                <Text style={styles.roundLabel}>R{col.round}</Text>
                <Text style={styles.venueLabel}>{VENUE_ABBR[col.venue] ?? col.venue}</Text>
                <View style={{flexDirection: 'row'}}>
                  {col.races.map(race => (
                    <View key={race.label} style={{width: CELL_W, alignItems: 'center'}}>
                      <Text style={styles.raceLabel}>{race.short}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Scrollable body */}
      <View style={styles.body}>
        {/* Left column - translates vertically only */}
        <View style={styles.leftClip}>
          <Animated.View style={{transform: [{translateY: negY}]}}>
            {tableData.map((driver, i) => (
              <View key={driver.name} style={[
                styles.nameRow,
                i === 0 && styles.leaderRow,
              ]}>
                <Text style={[styles.rankText, i === 0 && {color: Colors.yellow}]}>{i + 1}</Text>
                <Text style={styles.nameText} numberOfLines={1}>
                  {driver.name.trim().split(/\s+/).slice(1).join(' ').toUpperCase()}
                </Text>
                <Text style={[styles.ptsText, i === 0 && {color: Colors.yellow}]}>{driver.points}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Grid - PanResponder captures all touches; content translates in both axes */}
        <View
          style={styles.gridClip}
          onLayout={onGridLayout}
          {...panResponder.panHandlers}
        >
          <Animated.View style={{transform: [{translateX: negX}, {translateY: negY}]}}>
            {tableData.map((driver, i) => (
              <View key={driver.name} style={[
                {flexDirection: 'row'},
                i === 0 && styles.leaderRow,
              ]}>
                {columns.map((col, ci) =>
                  col.races.map(race => {
                    const key = `${col.round}_${race.label}`;
                    const isLastInGroup = race.label === col.races[col.races.length - 1].label;
                    return (
                      <View
                        key={key}
                        style={ci < columns.length - 1 && isLastInGroup ? styles.groupDivider : null}>
                        <Badge cell={driver.cells[key]} hasData={racesWithResults.has(key)} />
                      </View>
                    );
                  }),
                )}
              </View>
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Collapsible key legend */}
      <TouchableOpacity
        style={styles.keyToggle}
        onPress={() => setKeyExpanded(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.keyToggleText}>KEY</Text>
        <Text style={styles.keyToggleChevron}>{keyExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {keyExpanded && <ScrollView style={styles.keyScroll} showsVerticalScrollIndicator={false}><KeyRow /></ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {flex: 1, backgroundColor: Colors.background},

  // Header
  headerRow: {flexDirection: 'row'},
  leftHeader: {
    width: LEFT_W,
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },
  headerClip: {flex: 1, height: HEADER_H, overflow: 'hidden'},
  gridHeader: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outline,
  },

  // Body
  body: {flex: 1, flexDirection: 'row'},
  leftClip: {width: LEFT_W, overflow: 'hidden'},
  gridClip: {flex: 1, overflow: 'hidden'},

  leaderRow: {
    backgroundColor: 'rgba(254,189,2,0.05)',
  },
  nameRow: {
    height: CELL_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rankText: {
    width: 20,
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 2,
  },
  nameText: {flex: 1, color: '#fff', fontSize: 12, fontWeight: '600'},
  ptsText: {
    width: PTS_W,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  colLabel: {color: Colors.textSecondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5},

  roundLabel: {
    color: Colors.yellow,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  venueLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  raceLabel: {color: Colors.textSecondary, fontSize: 9, fontWeight: '600'},
  groupDivider: {borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)'},

  badge: {
    width: BADGE_W,
    height: BADGE_H,
    borderRadius: 6,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  badgeWithBonus: {
    justifyContent: 'space-evenly',
    paddingVertical: 3,
  },
  dneText: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.3,
  },
  bonusLabel: {
    fontSize: 6,
    fontWeight: '900',
    color: Colors.yellow,
    letterSpacing: 0.2,
  },
  badgeSolid: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeText: {fontSize: 11, fontWeight: '800'},
  badgeTextSolid: {fontSize: 12, fontWeight: '900'},

  // Key
  keyWrap: {
    margin: 12,
    marginTop: 10,
    marginBottom: 12,
    padding: 12,
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
  bonusKeyWrap: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outline,
  },
  bonusKeyTitle: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  keyItems: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  keyItem: {flexDirection: 'row', alignItems: 'center', gap: 7},
  keyDesc: {color: Colors.textSecondary, fontSize: 12, fontWeight: '500'},

  keyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.outline,
    backgroundColor: Colors.surface,
    gap: 6,
  },
  keyToggleText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  keyToggleChevron: {
    color: Colors.textSecondary,
    fontSize: 8,
  },
  keyScroll: {maxHeight: 220},

  empty: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60},
  emptyText: {color: Colors.textSecondary, fontSize: 14},
});
