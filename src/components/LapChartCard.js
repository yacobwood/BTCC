import React, {useEffect, useState, memo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Dimensions} from 'react-native';
import Svg, {Polyline, Line, Text as SvgText} from 'react-native-svg';
import {Colors} from '../theme/colors';
import {TEAM_COLORS} from '../theme/teamColors';
import {Analytics} from '../utils/analytics';
import {formatDriverName} from '../utils/driverName';

// Fallback for any team not in TEAM_COLORS (a team new to the grid this
// season, or a past-season team from a backfilled round) - same
// categorical palette ProgressionChart (the championship-points
// progression chart) already uses for a many-driver-lines-over-x-axis
// chart, reused as-is rather than redefined.
const CHART_COLORS = [
  '#FEBD02', '#5B8DEF', '#E06060', '#4CAF7D', '#D4853F',
  '#9B7ED8', '#D07AAB', '#4DA8A0', '#C9943B', '#7B80C5',
  '#4BA8C4', '#8BB44E', '#C44A6A', '#8B6BBF', '#4A9AC4',
];

const screenWidth = Dimensions.get('window').width;

// Teammates (NAPA Racing UK and Team VERTU each field 4 drivers this
// season) deliberately share the exact same team colour, not a shaded
// variant per driver - per explicit user preference, even though it means
// a team's own drivers aren't distinguishable from each other by colour
// alone (the legend's driver name is the fallback identity signal there).
function colorFor(series, si) {
  const base = series.team && TEAM_COLORS[series.team];
  return base || CHART_COLORS[si % CHART_COLORS.length];
}

// TSL's own Lap Chart reports literal start/finish-line crossing order each
// lap, not race classification - confirmed live (2026 Silverstone Race 1,
// car 27/Dan Cammish): a car can be genuinely 2 laps down yet still cross
// the line 3rd that lap, simply because of where it physically is on
// track relative to the leaders. Plotted as-is, that reads as the car's
// line randomly jumping to the front. Re-ranks each lap's own order so
// every car with fewer laps down sorts ahead of every car with more,
// preserving each group's own relative crossing order as the tie-break
// (a stable sort) - an "effective race position" rather than TSL's own
// literal reported number, per explicit user preference.
function reRankByLapsDown(order) {
  return order
    .map((row, i) => ({row, i}))
    .sort((a, b) => (a.row.lapsDown || 0) - (b.row.lapsDown || 0) || a.i - b.i)
    .map(({row}) => row);
}

// Pivots scrape_tsl.py's own per-lap "running order" shape (each lap lists
// cars in position order, see parse_lap_chart) into one per-driver series
// of {name, points: [position at each lap]} - the shape ProgressionChart's
// charting approach already expects. A car absent from a given lap's order
// (retired) gets `null` for that lap, same "gap in the line" convention
// ProgressionChart already uses for a late-joining driver.
function pivotToSeries(lapChart) {
  const reRanked = lapChart.map(l => ({...l, order: reRankByLapsDown(l.order)}));
  const nameByNo = {};
  const teamByNo = {};
  reRanked.forEach(l => l.order.forEach(r => { nameByNo[r.no] = r.driver; teamByNo[r.no] = r.team; }));
  // Driver order: by finishing position (last lap's own order) so the
  // legend reads top-to-bottom same as a real results list, with any car
  // that retired before the last lap appended after (by its own last-seen
  // position) rather than missing from the ordering entirely.
  const lastLap = reRanked[reRanked.length - 1];
  const finishOrder = lastLap.order.map(r => r.no);
  const everyNo = Object.keys(nameByNo).map(Number);
  const stillRunning = new Set(finishOrder);
  const retiredNos = everyNo.filter(no => !stillRunning.has(no));
  const orderedNos = [...finishOrder, ...retiredNos];

  return orderedNos.map(no => ({
    name: nameByNo[no],
    team: teamByNo[no],
    finishPos: finishOrder.indexOf(no) + 1 || null, // null if retired before the end
    points: reRanked.map(l => {
      const idx = l.order.findIndex(r => r.no === no);
      return idx === -1 ? null : idx + 1;
    }),
  }));
}

function LapChartCard({lapChart, roundNumber, session, isFavourite}) {
  const series = lapChart?.length ? pivotToSeries(lapChart) : [];
  const [visible, setVisible] = useState(() => {
    const m = {};
    series.forEach(s => { m[s.name] = true; });
    return m;
  });

  useEffect(() => {
    if (lapChart?.length) Analytics.lapChartShown(roundNumber, session, series.length, lapChart.length);
    const m = {};
    series.forEach(s => { m[s.name] = true; });
    setVisible(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, session, lapChart?.length]);

  if (!lapChart?.length) return null;

  const toggle = (name) => setVisible(prev => ({...prev, [name]: !prev[name]}));
  const showAll = () => {
    const m = {};
    series.forEach(s => { m[s.name] = true; });
    setVisible(m);
  };
  const hideAll = () => {
    const m = {};
    series.forEach(s => { m[s.name] = false; });
    setVisible(m);
  };

  const chartW = screenWidth - 64;
  // One label row per driver now (see startRows below), not a handful of
  // generic position ticks - needs real vertical room for a 20+ car field,
  // not a fixed height.
  const chartH = Math.max(300, 40 + series.length * 16);
  const padL = 32;
  const padR = 10;
  const padT = 10;
  const padB = 20;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const totalLaps = lapChart.length;
  const maxPos = Math.max(...series.map(s => Math.max(...s.points.filter(v => v !== null), 1)), 1);

  // The Y-axis lists drivers by their STARTING position, not generic P1/
  // P10/P20 numbers - each driver's own row is labelled with a 3-letter
  // code (same convention as on-screen driver codes in motorsport
  // broadcasts) at the lap-1 height their line actually starts from, so a
  // reader can identify a line at the left edge and then just follow it.
  // Replaces an earlier numeric-tick version that both crowded a 20+ car
  // field and hit a genuine text-rendering glitch with 2-digit labels
  // ("P10" reading as "R0" - confirmed live, never fully resolved by
  // reordering/padding/thinning alone). Falls back to a driver's first
  // non-null lap if they have none at lap 1 (defensive - a true
  // non-starter wouldn't appear in the book's lap chart at all, so this is
  // believed unreachable live).
  const startRows = series
    .map(s => ({name: s.name, pos: s.points.find(v => v !== null)}))
    .filter(r => r.pos != null);

  // Lap ticks: thinned to roughly 8 labels max regardless of race length,
  // same density ProgressionChart targets for its own round labels.
  const lapStep = Math.max(1, Math.ceil(totalLaps / 8));
  const lapTicks = [];
  for (let l = 1; l <= totalLaps; l += lapStep) lapTicks.push(l);
  if (lapTicks[lapTicks.length - 1] !== totalLaps) lapTicks.push(totalLaps);

  const x = (lapIndex) => padL + (lapIndex / (totalLaps - 1 || 1)) * plotW;
  // Position 1 (best) renders at the top (smallest y) - a direct, not
  // inverted, mapping: unlike a points chart (higher is better, needs
  // flipping), a lower position number is already "better" in the same
  // direction the SVG y-axis already runs.
  const y = (pos) => padT + ((pos - 1) / (maxPos - 1 || 1)) * plotH;

  return (
    <View>
      <View style={styles.chartContainer}>
        <Svg width={chartW} height={chartH}>
          {/* Grid lines and driver lines render first - axis labels render
              last (below) so they're never visually crossed/obscured by a
              data line passing near the left gutter, which otherwise reads
              as the label merging with the line (confirmed live). */}
          {startRows.map(r => (
            <Line key={r.name} x1={padL} y1={y(r.pos)} x2={chartW - padR} y2={y(r.pos)} stroke={Colors.outline} strokeWidth={0.5} />
          ))}
          {series.map((s, si) => {
            if (visible[s.name] === false) return null;
            const color = colorFor(s, si);
            // A null point means "no row for this car on this lap", which
            // happens two genuinely different ways: a true retirement
            // (every remaining lap is also null - the line should simply
            // stop at the last real point), or a one-off gap in TSL's own
            // source data for a car that's still racing and has real data
            // both before and after it (confirmed live, 2026 Silverstone
            // Race 1: car 27/Dan Cammish has no row at all for laps 17 and
            // 20, reappearing normally at 18 and 21) - that case should
            // draw straight through the gap, not break the line. Simply
            // dropping null points (rather than splitting into disconnected
            // segments at every null) handles both correctly with no
            // special-casing: a mid-race gap connects its neighbours
            // directly, and a trailing run of nulls just has nothing left
            // to connect to, so the line still stops exactly where a
            // retirement should.
            const pts = [];
            s.points.forEach((v, i) => {
              if (v !== null) pts.push(`${x(i)},${y(v)}`);
            });
            if (pts.length < 2) return null;
            return (
              <Polyline
                key={s.name}
                points={pts.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                opacity={0.85}
              />
            );
          })}
          {startRows.map(r => {
            const code = r.name.split(' ').pop().toUpperCase().slice(0, 3);
            return (
              <SvgText key={r.name} x={padL - 6} y={y(r.pos) + 3} fill={Colors.textSecondary} fontSize={9} textAnchor="end">{code}</SvgText>
            );
          })}
          {lapTicks.map(l => {
            const xPos = x(l - 1);
            const anchor = xPos >= chartW - padR - 4 ? 'end' : (xPos <= padL + 4 ? 'start' : 'middle');
            return (
              <SvgText key={l} x={xPos} y={chartH - 4} fill={Colors.textSecondary} fontSize={8} textAnchor={anchor}>
                {l}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      <Text style={styles.hint}>Tap a driver to show or hide their line</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity onPress={showAll} accessibilityRole="button" accessibilityLabel="Show all drivers"><Text style={styles.toggleBtn}>Show all</Text></TouchableOpacity>
        <TouchableOpacity onPress={hideAll} accessibilityRole="button" accessibilityLabel="Hide all drivers"><Text style={[styles.toggleBtn, {color: Colors.yellow}]}>Hide all</Text></TouchableOpacity>
      </View>

      <View style={styles.legendGrid}>
        {series.map((s, si) => {
          const color = colorFor(s, si);
          const on = visible[s.name] !== false;
          const fav = isFavourite(s.name);
          return (
            <TouchableOpacity
              key={s.name}
              style={[styles.legendItem, {borderColor: on ? color : Colors.outline, backgroundColor: on ? `${color}18` : 'transparent'}]}
              onPress={() => toggle(s.name)}
              accessibilityRole="button"
              accessibilityLabel={`Toggle ${s.name} on chart`}>
              <View style={[styles.legendCheck, {backgroundColor: on ? color : 'transparent', borderColor: color}]}>
                {on && <Text style={{color: '#fff', fontSize: 10, fontWeight: '900'}}>✓</Text>}
              </View>
              <View>
                <Text style={[styles.legendName, fav && {color: Colors.yellow}]} numberOfLines={1}>{formatDriverName(s.name)}</Text>
                <Text style={styles.legendPts}>{s.finishPos ? `P${s.finishPos}` : 'Retired'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },
  hint: {color: Colors.textSecondary, fontSize: 11, textAlign: 'center', marginBottom: 8},
  toggleRow: {flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 12},
  toggleBtn: {color: '#fff', fontSize: 13, fontWeight: '600'},
  legendGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '48%',
    gap: 8,
  },
  legendCheck: {width: 20, height: 20, borderRadius: 4, borderWidth: 2, justifyContent: 'center', alignItems: 'center'},
  legendName: {color: '#fff', fontSize: 12, fontWeight: '700'},
  legendPts: {color: Colors.textSecondary, fontSize: 10},
});

export default memo(LapChartCard);
