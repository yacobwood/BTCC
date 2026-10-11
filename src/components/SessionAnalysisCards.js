import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions} from 'react-native';
import Svg, {Polyline, Line, Circle, Text as SvgText} from 'react-native-svg';
import {Colors} from '../theme/colors';
import {TEAM_COLORS} from '../theme/teamColors';
import {Analytics} from '../utils/analytics';
import {formatDriverName} from '../utils/driverName';
import {fetchSessionAnalysis} from '../api/client';
import {mapSessionAnalysis} from '../api/parsers';

// Cards for the four reports in a session's analysis file (lap-by-lap sector
// times, tyre compounds, top-5 speed-trap average, session statistics), all
// parsed from TSL's event book by tools/scraper/book_tables.py and fetched on
// demand (fetchSessionAnalysis) rather than shipped inside results{year}.json.
// RoundResultsScreen only offers a tab when that race's `analysis` list says
// the file holds the report, so a card can assume the fetch should succeed.

const RETRY_DELAY_MS = 3000;

// Parsed files kept for the app session, so paging between these tabs (each
// mounts its own card) renders straight away instead of flashing a spinner
// while the same file is re-read from AsyncStorage.
const memo = new Map();

export function clearSessionAnalysisMemo() {
  memo.clear();
}

// Loads + maps one session's analysis file. A failure retries once on its
// own after a short delay (a blip on race-day mobile data is the usual
// cause) before showing the inline retry - per the app's standing
// preference for auto-retry over surfacing an error straight away.
export function useSessionAnalysis(year, round, session) {
  const key = `${year}_${round}_${session}`;
  const [state, setState] = useState(() => (memo.has(key) ? {status: 'ready', data: memo.get(key)} : {status: 'loading', data: null}));
  const [attempt, setAttempt] = useState(0);
  const autoRetried = useRef(false);
  const lastKey = useRef(key);
  if (lastKey.current !== key) {
    lastKey.current = key;
    autoRetried.current = false;
  }

  useEffect(() => {
    if (memo.has(key)) {
      setState({status: 'ready', data: memo.get(key)});
      return undefined;
    }
    let cancelled = false;
    let timer = null;
    setState({status: 'loading', data: null});
    fetchSessionAnalysis(year, round, session, attempt > 0)
      .then(json => {
        if (cancelled) return;
        const data = mapSessionAnalysis(json);
        if (!data) throw new Error('empty');
        memo.set(key, data);
        setState({status: 'ready', data});
        Analytics.sessionAnalysisLoaded(round, session);
      })
      .catch(e => {
        if (cancelled) return;
        if (!autoRetried.current) {
          autoRetried.current = true;
          timer = setTimeout(() => setAttempt(a => a + 1), RETRY_DELAY_MS);
          timer?.unref?.();
          return;
        }
        setState({status: 'error', data: null});
        Analytics.sessionAnalysisLoadFailed(round, session, e?.message);
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [key, attempt, year, round, session]);

  const retry = useCallback(() => {
    Analytics.sessionAnalysisRetried(round, session);
    setAttempt(a => a + 1);
  }, [round, session]);

  return {...state, retry};
}

function AnalysisGate({year, roundNumber, session, children}) {
  const {status, data, retry} = useSessionAnalysis(year, roundNumber, session);
  if (status === 'loading') {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.yellow} accessibilityLabel="Loading session analysis" />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <TouchableOpacity style={styles.card} onPress={retry} accessibilityRole="button" accessibilityLabel="Retry loading session analysis">
        <Text style={styles.muted}>Couldn't load this data. Tap to try again.</Text>
      </TouchableOpacity>
    );
  }
  return children(data);
}

// ── Shared formatting ────────────────────────────────────────────────────────

// "56.887" under a minute, "1:01.112" over - TSL's own book formatting.
export function formatLapTime(secs) {
  if (secs == null) return '-';
  if (secs < 60) return secs.toFixed(3);
  const m = Math.floor(secs / 60);
  const s = (secs - m * 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

function formatSpeed(mph, useKm) {
  return useKm ? `${(mph * 1.60934).toFixed(1)}` : mph.toFixed(1);
}

function clockTime(stamp, withSeconds = false) {
  const t = (stamp || '').split('T')[1] || '';
  return withSeconds ? t : t.slice(0, 5);
}

const CHART_COLORS = [
  '#FEBD02', '#5B8DEF', '#E06060', '#4CAF7D', '#D4853F',
  '#9B7ED8', '#D07AAB', '#4DA8A0', '#C9943B', '#7B80C5',
];

// ── Lap times ────────────────────────────────────────────────────────────────

// A lap that shows real pace: timed, not an out/in lap, not through the pit
// lane, not deleted, and within 107% of the driver's own best - which drops
// Safety Car / FCY laps and spins without hand-tuning per circuit (the 107%
// figure is the usual "representative pace" cut-off in timing analysis).
export function cleanLaps(driver) {
  const best = driver.best ?? Math.min(...driver.laps.filter(l => l.time).map(l => l.time));
  return driver.laps.filter(l =>
    l.time != null && !l.pit && !l.outLap && !l.inLap && !l.deleted && Number.isFinite(best) && l.time <= best * 1.07,
  );
}

// Mean and standard deviation of a driver's clean laps - the deviation is
// the consistency figure (lower = more metronomic).
export function lapStats(driver) {
  const times = cleanLaps(driver).map(l => l.time);
  if (!times.length) return {clean: 0, avg: null, spread: null};
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const spread = Math.sqrt(times.reduce((a, t) => a + (t - avg) ** 2, 0) / times.length);
  return {clean: times.length, avg, spread};
}

// Each sector's best time by this driver (personal best) and by anyone in
// the session (session best) - for colouring the expanded lap table.
function sectorBests(drivers) {
  const session = [];
  const personal = {};
  drivers.forEach(d => {
    personal[d.no] = [];
    d.laps.forEach(l => {
      if (l.deleted) return;
      l.sectors.forEach((s, i) => {
        if (s == null) return;
        if (personal[d.no][i] == null || s < personal[d.no][i]) personal[d.no][i] = s;
        if (session[i] == null || s < session[i]) session[i] = s;
      });
    });
  });
  return {session, personal};
}

function defaultSelection(drivers, isFavourite) {
  const favs = drivers.filter(d => isFavourite(d.driver)).map(d => d.no);
  const top = drivers.slice(0, 3).map(d => d.no);
  return new Set([...favs, ...top]);
}

const screenWidth = Dimensions.get('window').width;

function LapTimesChart({drivers, selected, colorOf}) {
  const shown = drivers.filter(d => selected.has(d.no));
  const series = shown.map(d => ({d, laps: cleanLaps(d)})).filter(s => s.laps.length);
  if (!series.length) {
    return <Text style={[styles.muted, styles.chartEmpty]}>Pick a driver below to plot their laps</Text>;
  }
  const allTimes = series.flatMap(s => s.laps.map(l => l.time));
  const maxLap = Math.max(...drivers.flatMap(d => d.laps.map(l => l.lap)), 2);
  let lo = Math.min(...allTimes);
  let hi = Math.max(...allTimes);
  if (hi - lo < 0.5) { lo -= 0.25; hi += 0.25; }

  const chartW = screenWidth - 64;
  const chartH = 220;
  const padL = 52;
  const padR = 10;
  const padT = 10;
  const padB = 20;
  const x = lap => padL + ((lap - 1) / (maxLap - 1)) * (chartW - padL - padR);
  // Faster (lower) times at the top, same direction as a position chart.
  const y = t => padT + ((t - lo) / (hi - lo)) * (chartH - padT - padB);
  const yTicks = [0, 1, 2, 3].map(i => lo + ((hi - lo) * i) / 3);
  const lapStep = Math.max(1, Math.ceil(maxLap / 8));
  const lapTicks = [];
  for (let l = 1; l <= maxLap; l += lapStep) lapTicks.push(l);

  return (
    <Svg width={chartW} height={chartH}>
      {yTicks.map(t => (
        <React.Fragment key={t}>
          <Line x1={padL} y1={y(t)} x2={chartW - padR} y2={y(t)} stroke={Colors.outline} strokeWidth={0.5} />
          <SvgText x={padL - 6} y={y(t) + 3} fill={Colors.textSecondary} fontSize={9} textAnchor="end">{formatLapTime(t)}</SvgText>
        </React.Fragment>
      ))}
      {series.map(({d, laps}) => {
        const color = colorOf(d);
        // A gap in the lap numbers (pit stop, Safety Car lap) breaks the
        // line rather than drawing a misleading straight join across it.
        const segments = [];
        laps.forEach((l, i) => {
          if (i === 0 || l.lap !== laps[i - 1].lap + 1) segments.push([]);
          segments[segments.length - 1].push(`${x(l.lap)},${y(l.time)}`);
        });
        return (
          <React.Fragment key={d.no}>
            {segments.map((pts, si) => (pts.length > 1 ? (
              <Polyline key={si} points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
            ) : null))}
            {laps.map(l => <Circle key={l.lap} cx={x(l.lap)} cy={y(l.time)} r={2} fill={color} />)}
          </React.Fragment>
        );
      })}
      {lapTicks.map(l => (
        <SvgText key={l} x={x(l)} y={chartH - 4} fill={Colors.textSecondary} fontSize={8} textAnchor="middle">{l}</SvgText>
      ))}
    </Svg>
  );
}

function LapTable({driver, bests}) {
  const pb = bests.personal[driver.no] || [];
  const sectorCount = Math.max(...driver.laps.map(l => l.sectors.length), 0);
  const tone = (s, i) => {
    if (s == null) return null;
    if (s === bests.session[i]) return styles.sectorSessionBest;
    if (s === pb[i]) return styles.sectorPersonalBest;
    return null;
  };
  return (
    <View style={styles.lapTable}>
      <View style={styles.lapTableRow}>
        <Text style={[styles.lapCellLap, styles.colHeader]}>LAP</Text>
        {Array.from({length: sectorCount}, (_, i) => (
          <Text key={i} style={[styles.lapCell, styles.colHeader]}>S{i + 1}</Text>
        ))}
        <Text style={[styles.lapCellTime, styles.colHeader]}>TIME</Text>
      </View>
      {driver.laps.map(l => {
        const note = l.deleted ? 'DEL' : l.outLap && l.inLap ? 'OUT/IN' : l.outLap ? 'OUT' : l.inLap ? 'IN' : l.pit ? 'PIT' : null;
        return (
          <View key={l.lap} style={styles.lapTableRow}>
            <Text style={styles.lapCellLap}>{l.lap}</Text>
            {Array.from({length: sectorCount}, (_, i) => (
              <Text key={i} style={[styles.lapCell, tone(l.sectors[i], i)]}>
                {l.sectors[i] == null ? '-' : formatLapTime(l.sectors[i])}
              </Text>
            ))}
            <Text style={[styles.lapCellTime, l.deleted && styles.lapDeleted, l.time === driver.best && styles.sectorPersonalBest]}>
              {formatLapTime(l.time)}{note ? ` ${note}` : ''}
            </Text>
          </View>
        );
      })}
      <View style={styles.keyRow}>
        <Text style={[styles.keyText, styles.sectorSessionBest]}>Session best</Text>
        <Text style={[styles.keyText, styles.sectorPersonalBest]}>Personal best</Text>
      </View>
    </View>
  );
}

function LapTimesBody({drivers, roundNumber, session, isFavourite}) {
  const [selected, setSelected] = useState(() => defaultSelection(drivers, isFavourite));
  const [expanded, setExpanded] = useState(null);
  const bests = useMemo(() => sectorBests(drivers), [drivers]);
  const stats = useMemo(() => Object.fromEntries(drivers.map(d => [d.no, lapStats(d)])), [drivers]);

  useEffect(() => {
    Analytics.lapTimesShown(roundNumber, session, drivers.length, drivers.reduce((n, d) => n + d.laps.length, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, session]);

  const colorOf = useCallback(d => {
    const team = TEAM_COLORS[d.team];
    if (team && [...selected].filter(no => drivers.find(x => x.no === no)?.team === d.team).length === 1) return team;
    return CHART_COLORS[[...selected].indexOf(d.no) % CHART_COLORS.length] || CHART_COLORS[0];
  }, [selected, drivers]);

  const toggle = d => {
    setSelected(prev => {
      const next = new Set(prev);
      const on = !next.has(d.no);
      if (on) next.add(d.no); else next.delete(d.no);
      Analytics.lapTimesDriverToggled(roundNumber, session, d.driver, on);
      return next;
    });
  };

  const toggleExpand = d => {
    if (expanded === d.no) {
      setExpanded(null);
      Analytics.lapTimesDriverCollapsed(roundNumber, session, d.driver);
    } else {
      setExpanded(d.no);
      Analytics.lapTimesDriverExpanded(roundNumber, session, d.driver);
    }
  };

  return (
    <View>
      <View style={styles.chartCard}>
        <LapTimesChart drivers={drivers} selected={selected} colorOf={colorOf} />
      </View>
      <Text style={styles.hint}>Representative laps only - pit, out, in and Safety Car laps are left off the chart</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.colHeader, styles.chartToggle]} />
          <Text style={[styles.colHeader, styles.flex]}>DRIVER</Text>
          <Text style={[styles.colHeader, styles.num]}>BEST</Text>
          <Text style={[styles.colHeader, styles.num]}>AVG</Text>
          <Text style={[styles.colHeader, styles.numNarrow]}>±</Text>
        </View>
        {drivers.map(d => {
          const on = selected.has(d.no);
          const fav = isFavourite(d.driver);
          const st = stats[d.no];
          return (
            <View key={d.no}>
              <View style={[styles.row, fav && styles.rowFav]}>
                <TouchableOpacity
                  onPress={() => toggle(d)}
                  style={[styles.chartToggle, styles.check, {borderColor: on ? colorOf(d) : Colors.outline, backgroundColor: on ? colorOf(d) : 'transparent'}]}
                  accessibilityRole="checkbox"
                  accessibilityState={{checked: on}}
                  accessibilityLabel={`Plot ${d.driver} on chart`}>
                  {on && <Text style={styles.checkMark}>✓</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.expandArea}
                  onPress={() => toggleExpand(d)}
                  accessibilityRole="button"
                  accessibilityState={{expanded: expanded === d.no}}
                  accessibilityLabel={`${expanded === d.no ? 'Hide' : 'Show'} every lap for ${d.driver}`}>
                  <Text style={[styles.driver, styles.flex, fav && styles.favText]} numberOfLines={1}>{formatDriverName(d.driver)}</Text>
                  <Text style={[styles.value, styles.num]}>{formatLapTime(d.best)}</Text>
                  <Text style={[styles.value, styles.num]}>{st.avg == null ? '-' : formatLapTime(st.avg)}</Text>
                  <Text style={[styles.value, styles.numNarrow]}>{st.spread == null ? '-' : st.spread.toFixed(2)}</Text>
                </TouchableOpacity>
              </View>
              {expanded === d.no && <LapTable driver={d} bests={bests} />}
            </View>
          );
        })}
        <Text style={styles.footnote}>AVG and ± (spread, seconds) are over representative laps. Tap a driver for every lap and sector.</Text>
      </View>
    </View>
  );
}

export function LapTimesCard({year, roundNumber, session, isFavourite}) {
  return (
    <AnalysisGate year={year} roundNumber={roundNumber} session={session}>
      {data => (data.laps.length ? (
        <LapTimesBody drivers={data.laps} roundNumber={roundNumber} session={session} isFavourite={isFavourite} />
      ) : <EmptyCard />)}
    </AnalysisGate>
  );
}

// ── Tyres ────────────────────────────────────────────────────────────────────

const COMPOUND_COLORS = {
  Soft: {bg: '#E5322D', fg: '#fff'},
  Medium: {bg: '#FEBD02', fg: '#111'},
  Hard: {bg: '#F2F2F2', fg: '#111'},
  Wet: {bg: '#2F7FE0', fg: '#fff'},
};

function CompoundChip({name}) {
  const c = COMPOUND_COLORS[name] || {bg: Colors.outline, fg: '#fff'};
  return (
    <View style={[styles.chip, {backgroundColor: c.bg}]}>
      <Text style={[styles.chipText, {color: c.fg}]}>{name}</Text>
    </View>
  );
}

function TyresBody({tyres, order, roundNumber, session, isFavourite}) {
  useEffect(() => {
    Analytics.tyresShown(roundNumber, session, tyres.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, session]);
  const rows = [...tyres].sort((a, b) => (order[a.no] ?? 999) - (order[b.no] ?? 999) || a.no - b.no);
  const usage = {};
  tyres.forEach(t => new Set(t.compounds).forEach(c => { usage[c] = (usage[c] || 0) + 1; }));
  return (
    <View style={styles.card}>
      <View style={styles.usageRow}>
        {Object.entries(usage).map(([c, n]) => (
          <View key={c} style={styles.usageItem}>
            <CompoundChip name={c} />
            <Text style={styles.muted}>{n} {n === 1 ? 'car' : 'cars'}</Text>
          </View>
        ))}
      </View>
      {rows.map(t => {
        const fav = isFavourite(t.driver);
        return (
          <View key={t.no} style={[styles.row, fav && styles.rowFav]}>
            <Text style={[styles.driver, styles.flex, fav && styles.favText]} numberOfLines={1}>{formatDriverName(t.driver)}</Text>
            <View style={styles.chipRow}>
              {t.compounds.map((c, i) => <CompoundChip key={i} name={c} />)}
            </View>
          </View>
        );
      })}
      <Text style={styles.footnote}>Compounds in the order each driver used them</Text>
    </View>
  );
}

export function TyresCard({year, roundNumber, session, isFavourite, results}) {
  const order = useMemo(() => Object.fromEntries((results || []).map((r, i) => [r.number ?? r.no, i])), [results]);
  return (
    <AnalysisGate year={year} roundNumber={roundNumber} session={session}>
      {data => (data.tyres.length ? (
        <TyresBody tyres={data.tyres} order={order} roundNumber={roundNumber} session={session} isFavourite={isFavourite} />
      ) : <EmptyCard />)}
    </AnalysisGate>
  );
}

// ── Top speeds ───────────────────────────────────────────────────────────────

function TopSpeedsBody({entries, trap, roundNumber, session, isFavourite, useKm}) {
  useEffect(() => {
    Analytics.topSpeedsShown(roundNumber, session, trap, entries.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, session, trap]);
  const unit = useKm ? 'km/h' : 'mph';
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={[styles.colHeader, styles.pos]} />
        <Text style={[styles.colHeader, styles.flex]}>DRIVER</Text>
        <Text style={[styles.colHeader, styles.num]}>AVG</Text>
        <Text style={[styles.colHeader, styles.num]}>BEST</Text>
      </View>
      {entries.map(e => {
        const fav = isFavourite(e.driver);
        return (
          <View key={e.no} style={[styles.row, fav && styles.rowFav]}>
            <Text style={styles.pos}>{e.pos}</Text>
            <Text style={[styles.driver, styles.flex, fav && styles.favText]} numberOfLines={1}>{formatDriverName(e.driver)}</Text>
            <Text style={[styles.valueStrong, styles.num]}>{formatSpeed(e.avg, useKm)}</Text>
            <Text style={[styles.value, styles.num]}>{formatSpeed(e.best, useKm)}</Text>
          </View>
        );
      })}
      <Text style={styles.footnote}>
        Average of each driver's 5 fastest passes through {trap}, in {unit} - steadier than a single best, which one tow can inflate
      </Text>
    </View>
  );
}

export function TopSpeedsCard({year, roundNumber, session, isFavourite, useKm}) {
  return (
    <AnalysisGate year={year} roundNumber={roundNumber} session={session}>
      {data => (data.topSpeeds.length ? (
        <TopSpeedsBody entries={data.topSpeeds} trap={data.topSpeedsTrap} roundNumber={roundNumber} session={session} isFavourite={isFavourite} useKm={useKm} />
      ) : <EmptyCard />)}
    </AnalysisGate>
  );
}

// ── Session stats ────────────────────────────────────────────────────────────

const CLASS_LABELS = {M: 'Manufacturer', I: 'Independent', IND: 'Independent', J: 'Jack Sears Trophy', JST: 'Jack Sears Trophy'};

export function delayLabel(mins) {
  if (mins == null) return null;
  if (mins === 0) return 'Started on time';
  const n = Math.abs(mins);
  return `Started ${n} min ${mins > 0 ? 'late' : 'early'}`;
}

function StatRow({label, value}) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={[styles.muted, styles.flex]}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function SessionStatsBody({stats, roundNumber, session, isFavourite, useKm}) {
  useEffect(() => {
    Analytics.sessionStatsShown(roundNumber, session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, session]);
  const delay = delayLabel(stats.startDelayMins);
  const distance = stats.totalDistance == null ? null
    : useKm ? `${Math.round(stats.totalDistance * 1.60934).toLocaleString()} km` : `${Math.round(stats.totalDistance).toLocaleString()} miles`;
  const classes = Object.entries(stats.classes).filter(([, info]) => info.fastestLap);
  return (
    <View>
      <View style={styles.card}>
        {delay && (
          <View style={[styles.delayChip, stats.startDelayMins > 0 && styles.delayChipLate]}>
            <Text style={styles.delayChipText}>{delay}</Text>
          </View>
        )}
        <StatRow label="Scheduled start" value={clockTime(stats.plannedStart)} />
        <StatRow label="Actual start" value={clockTime(stats.actualStart, true)} />
        <StatRow label="Finish" value={clockTime(stats.finishTime, true)} />
        <StatRow label="Starters" value={stats.competitors} />
        <StatRow label="Laps completed (all cars)" value={stats.totalLaps?.toLocaleString()} />
        <StatRow label="Distance covered (all cars)" value={distance} />
      </View>
      {classes.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>FASTEST LAP BY CLASS</Text>
          {classes.map(([cl, info]) => {
            const fav = isFavourite(info.fastestLap.driver);
            return (
              <View key={cl} style={[styles.row, fav && styles.rowFav]}>
                <Text style={[styles.muted, styles.classLabel]}>{CLASS_LABELS[cl] || cl}</Text>
                <Text style={[styles.driver, styles.flex, fav && styles.favText]} numberOfLines={1}>{formatDriverName(info.fastestLap.driver)}</Text>
                <Text style={[styles.value, styles.num]}>{info.fastestLap.time}</Text>
              </View>
            );
          })}
        </View>
      )}
      {stats.fastestLapHistory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>FASTEST LAP PROGRESSION</Text>
          {stats.fastestLapHistory.map((e, i) => {
            const fav = isFavourite(e.driver);
            return (
              <View key={i} style={[styles.row, fav && styles.rowFav]}>
                <Text style={[styles.muted, styles.lapNo]}>{e.group ? `G${e.group} ` : ''}L{e.lap}</Text>
                <Text style={[styles.driver, styles.flex, fav && styles.favText]} numberOfLines={1}>{formatDriverName(e.driver)}</Text>
                <Text style={[styles.value, styles.num]}>{e.time}</Text>
              </View>
            );
          })}
          <Text style={styles.footnote}>Every time the session's fastest lap was beaten{stats.fastestLapHistory.some(e => e.group) ? ' (G1/G2 = qualifying group)' : ''}</Text>
        </View>
      )}
    </View>
  );
}

export function SessionStatsCard({year, roundNumber, session, isFavourite, useKm}) {
  return (
    <AnalysisGate year={year} roundNumber={roundNumber} session={session}>
      {data => (data.sessionStats ? (
        <SessionStatsBody stats={data.sessionStats} roundNumber={roundNumber} session={session} isFavourite={isFavourite} useKm={useKm} />
      ) : <EmptyCard />)}
    </AnalysisGate>
  );
}

function EmptyCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.muted}>Not available for this session yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {backgroundColor: Colors.card, borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 6},
  chartCard: {backgroundColor: Colors.card, borderRadius: 12, padding: 8, marginTop: 4, marginBottom: 6},
  chartEmpty: {textAlign: 'center', paddingVertical: 40},
  hint: {color: Colors.textSecondary, fontSize: 11, textAlign: 'center', marginBottom: 6},
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8},
  rowFav: {borderWidth: 1, borderColor: 'rgba(254,189,2,0.5)', borderRadius: 6, paddingHorizontal: 4},
  expandArea: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8},
  flex: {flex: 1},
  pos: {color: '#fff', fontSize: 12, fontWeight: '800', width: 20, textAlign: 'center'},
  driver: {color: '#fff', fontSize: 12.5, fontWeight: '600'},
  favText: {color: Colors.yellow},
  value: {color: Colors.textSecondary, fontSize: 12, fontWeight: '700'},
  valueStrong: {color: '#fff', fontSize: 12, fontWeight: '800'},
  num: {width: 62, textAlign: 'right'},
  numNarrow: {width: 38, textAlign: 'right'},
  colHeader: {color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1},
  sectionTitle: {color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4},
  muted: {color: Colors.textSecondary, fontSize: 12},
  footnote: {color: Colors.textSecondary, fontSize: 10.5, marginTop: 8, lineHeight: 15},
  chartToggle: {width: 22},
  check: {height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  checkMark: {color: '#fff', fontSize: 11, fontWeight: '900'},
  lapTable: {backgroundColor: Colors.surface, borderRadius: 8, padding: 8, marginVertical: 4},
  lapTableRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 2},
  lapCellLap: {color: Colors.textSecondary, fontSize: 11, width: 28},
  lapCell: {color: '#fff', fontSize: 11, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums']},
  lapCellTime: {color: '#fff', fontSize: 11, fontWeight: '700', width: 92, textAlign: 'right', fontVariant: ['tabular-nums']},
  lapDeleted: {color: Colors.textSecondary, textDecorationLine: 'line-through'},
  sectorSessionBest: {color: '#C77DFF', fontWeight: '800'},
  sectorPersonalBest: {color: '#4CD07D', fontWeight: '800'},
  keyRow: {flexDirection: 'row', gap: 16, marginTop: 6},
  keyText: {fontSize: 10},
  chip: {borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2},
  chipText: {fontSize: 10.5, fontWeight: '800'},
  chipRow: {flexDirection: 'row', gap: 4},
  usageRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6},
  usageItem: {flexDirection: 'row', alignItems: 'center', gap: 6},
  delayChip: {alignSelf: 'flex-start', backgroundColor: Colors.outline, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6},
  delayChipLate: {backgroundColor: 'rgba(229,50,45,0.25)'},
  delayChipText: {color: '#fff', fontSize: 11.5, fontWeight: '700'},
  classLabel: {width: 96},
  lapNo: {width: 52},
});
