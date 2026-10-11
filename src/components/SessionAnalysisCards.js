import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions} from 'react-native';
import Svg, {Polyline, Line, Circle, Text as SvgText} from 'react-native-svg';
import {Colors} from '../theme/colors';
import {TEAM_COLORS} from '../theme/teamColors';
import {Analytics} from '../utils/analytics';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  TeamStripe, RankBadge, ValueBar, DriverName, closeness,
  favRowStyle, tableStyles, ColumnHeader,
} from './analysisUi';
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

function LapTimesChart({drivers, selected, colorOf, isFavourite}) {
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

  const chartW = screenWidth - 48;
  const chartH = 230;
  const padL = 50;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const x = lap => padL + ((lap - 1) / (maxLap - 1)) * (chartW - padL - padR);
  // Faster (lower) times at the top, same direction as a position chart.
  const y = t => padT + ((t - lo) / (hi - lo)) * (chartH - padT - padB);
  const yTicks = [0, 1, 2, 3].map(i => lo + ((hi - lo) * i) / 3);
  const lapStep = Math.max(1, Math.ceil(maxLap / 8));
  const lapTicks = [];
  for (let l = 1; l <= maxLap; l += lapStep) lapTicks.push(l);

  // Favourites draw last (on top) and thicker, so their line is never
  // buried under the rest of the selection.
  const ordered = [...series].sort((a, b) => Number(isFavourite(a.d.driver)) - Number(isFavourite(b.d.driver)));

  return (
    <Svg width={chartW} height={chartH}>
      {yTicks.map(t => (
        <React.Fragment key={t}>
          <Line x1={padL} y1={y(t)} x2={chartW - padR} y2={y(t)} stroke={Colors.outline} strokeWidth={0.5} strokeDasharray="3,4" />
          <SvgText x={padL - 6} y={y(t) + 3} fill={Colors.textSecondary} fontSize={9} textAnchor="end">{formatLapTime(t)}</SvgText>
        </React.Fragment>
      ))}
      {ordered.map(({d, laps}) => {
        const color = colorOf(d);
        const fav = isFavourite(d.driver);
        // A gap in the lap numbers (pit stop, Safety Car lap) breaks the
        // line rather than drawing a misleading straight join across it.
        const segments = [];
        laps.forEach((l, i) => {
          if (i === 0 || l.lap !== laps[i - 1].lap + 1) segments.push([]);
          segments[segments.length - 1].push(`${x(l.lap)},${y(l.time)}`);
        });
        const bestLap = laps.reduce((b, l) => (l.time < b.time ? l : b), laps[0]);
        return (
          <React.Fragment key={d.no}>
            {segments.map((pts, si) => (pts.length > 1 ? (
              <Polyline key={si} points={pts.join(' ')} fill="none" stroke={color} strokeWidth={fav ? 2.75 : 1.5} strokeLinejoin="round" opacity={fav ? 1 : 0.85} />
            ) : null))}
            {laps.map(l => <Circle key={l.lap} cx={x(l.lap)} cy={y(l.time)} r={fav ? 2.5 : 1.75} fill={color} />)}
            <Circle cx={x(bestLap.lap)} cy={y(bestLap.time)} r={5} fill={Colors.card} stroke={color} strokeWidth={2} />
          </React.Fragment>
        );
      })}
      {lapTicks.map(l => (
        <SvgText key={l} x={x(l)} y={chartH - 5} fill={Colors.textSecondary} fontSize={8.5} textAnchor="middle">{l}</SvgText>
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
      {driver.laps.map((l, idx) => {
        const note = l.deleted ? 'DEL' : l.outLap && l.inLap ? 'OUT/IN' : l.outLap ? 'OUT' : l.inLap ? 'IN' : l.pit ? 'PIT' : null;
        const isBest = l.time === driver.best;
        return (
          <View key={l.lap} style={[styles.lapTableRow, idx % 2 === 1 && styles.lapTableRowAlt, isBest && styles.lapTableRowBest]}>
            <Text style={styles.lapCellLap}>{l.lap}</Text>
            {Array.from({length: sectorCount}, (_, i) => (
              <Text key={i} style={[styles.lapCell, tone(l.sectors[i], i)]}>
                {l.sectors[i] == null ? '-' : formatLapTime(l.sectors[i])}
              </Text>
            ))}
            <Text style={[styles.lapCellTime, l.deleted && styles.lapDeleted, isBest && styles.sectorPersonalBest]}>
              {formatLapTime(l.time)}{note ? ` ${note}` : ''}
            </Text>
          </View>
        );
      })}
      <View style={styles.keyRow}>
        <View style={styles.keyItem}><View style={[styles.keyDot, {backgroundColor: SESSION_BEST}]} /><Text style={styles.keyText}>Session best</Text></View>
        <View style={styles.keyItem}><View style={[styles.keyDot, {backgroundColor: PERSONAL_BEST}]} /><Text style={styles.keyText}>Personal best</Text></View>
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

  // Team colour when it's the only selected car from that team, otherwise a
  // distinct palette colour so two teammates never share a line colour.
  const colorOf = useCallback(d => {
    const team = TEAM_COLORS[d.team];
    const teamCount = [...selected].filter(no => drivers.find(x => x.no === no)?.team === d.team).length;
    if (team && teamCount === 1) return team;
    return CHART_COLORS[[...selected].indexOf(d.no) % CHART_COLORS.length] || CHART_COLORS[0];
  }, [selected, drivers]);

  const bestTimes = drivers.map(d => d.best).filter(t => t != null);
  const fastest = bestTimes.length ? Math.min(...bestTimes) : null;
  const slowest = bestTimes.length ? Math.max(...bestTimes) : null;
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

  const shown = drivers.filter(d => selected.has(d.no));

  return (
    <View>
      <View style={styles.chartCard}>
        {shown.length > 0 && (
          <View style={styles.legendRow}>
            {shown.map(d => (
              <TouchableOpacity
                key={d.no}
                style={[styles.legendChip, {borderColor: colorOf(d)}]}
                onPress={() => toggle(d)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${d.driver} from chart`}>
                <View style={[styles.legendDot, {backgroundColor: colorOf(d)}]} />
                <Text style={[styles.legendText, isFavourite(d.driver) && styles.favText]} numberOfLines={1}>
                  {d.driver.split(' ').pop()}
                </Text>
                <Icon name="close" size={12} color={Colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <LapTimesChart drivers={drivers} selected={selected} colorOf={colorOf} isFavourite={isFavourite} />
        <Text style={styles.hint}>Representative laps only. Ringed dot = each driver's best lap.</Text>
      </View>
      <View style={tableStyles.card}>
        <View style={tableStyles.headerRow}>
          <ColumnHeader style={styles.checkHeader}>PLOT</ColumnHeader>
          <ColumnHeader style={styles.flex}>DRIVER</ColumnHeader>
          <ColumnHeader style={styles.num}>BEST</ColumnHeader>
          <ColumnHeader style={styles.num}>AVG</ColumnHeader>
          <ColumnHeader style={styles.numNarrow}>±</ColumnHeader>
        </View>
        {drivers.map(d => {
          const on = selected.has(d.no);
          const fav = isFavourite(d.driver);
          const st = stats[d.no];
          const open = expanded === d.no;
          return (
            <View key={d.no}>
              <View style={[tableStyles.row, fav && favRowStyle, open && styles.rowOpen]}>
                <TeamStripe team={d.team} />
                <TouchableOpacity
                  onPress={() => toggle(d)}
                  hitSlop={8}
                  style={[styles.check, {borderColor: on ? colorOf(d) : Colors.outline, backgroundColor: on ? colorOf(d) : 'transparent'}]}
                  accessibilityRole="checkbox"
                  accessibilityState={{checked: on}}
                  accessibilityLabel={`Plot ${d.driver} on chart`}>
                  {on && <Icon name="check" size={13} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.expandArea}
                  onPress={() => toggleExpand(d)}
                  accessibilityRole="button"
                  accessibilityState={{expanded: open}}
                  accessibilityLabel={`${open ? 'Hide' : 'Show'} every lap for ${d.driver}`}>
                  <View style={tableStyles.main}>
                    <DriverName name={d.driver} fav={fav} />
                    <ValueBar fraction={closeness(d.best, fastest, slowest)} fav={fav} />
                  </View>
                  <Text style={[tableStyles.value, styles.num, d.best === fastest && styles.fastestText]}>{formatLapTime(d.best)}</Text>
                  <Text style={[tableStyles.sub, styles.num]}>{st.avg == null ? '-' : formatLapTime(st.avg)}</Text>
                  <Text style={[tableStyles.sub, styles.numNarrow]}>{st.spread == null ? '-' : st.spread.toFixed(2)}</Text>
                  <Icon name={open ? 'expand-less' : 'expand-more'} size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {open && <LapTable driver={d} bests={bests} />}
            </View>
          );
        })}
        <Text style={tableStyles.footnote}>AVG and ± (spread in seconds - lower is more consistent) use representative laps. Tap a driver for every lap and sector.</Text>
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
  Soft: '#E5322D',
  Medium: '#FEBD02',
  Hard: '#F2F2F2',
  Wet: '#2F7FE0',
};

// A tyre sidewall: dark disc ringed in the compound's colour with its
// initial in the middle - the same visual language broadcast graphics use.
export function TyreIcon({name, size = 24}) {
  const color = COMPOUND_COLORS[name] || Colors.textSecondary;
  return (
    <View
      style={[styles.tyre, {width: size, height: size, borderRadius: size / 2, borderColor: color, borderWidth: Math.max(2.5, size / 8)}]}
      accessibilityLabel={name}>
      <Text style={[styles.tyreLetter, {color, fontSize: size * 0.42}]}>{(name || '?').charAt(0).toUpperCase()}</Text>
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
    <View>
      <View style={styles.usageRow}>
        {Object.entries(usage).map(([c, n]) => (
          <View key={c} style={styles.usageTile}>
            <TyreIcon name={c} size={30} />
            <View>
              <Text style={styles.usageCount}>{n}</Text>
              <Text style={styles.usageLabel}>{n === 1 ? 'car' : 'cars'} on {c}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={tableStyles.card}>
        {rows.map(t => {
          const fav = isFavourite(t.driver);
          return (
            <View key={t.no} style={[tableStyles.row, fav && favRowStyle]}>
              <TeamStripe team={t.team} />
              {order[t.no] != null ? <RankBadge pos={order[t.no] + 1} /> : <Text style={styles.rankBlank}>-</Text>}
              <View style={tableStyles.main}><DriverName name={t.driver} fav={fav} /></View>
              <View style={styles.tyreRow}>
                {t.compounds.map((c, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <Icon name="chevron-right" size={12} color={Colors.textSecondary} />}
                    <TyreIcon name={c} size={22} />
                  </React.Fragment>
                ))}
              </View>
            </View>
          );
        })}
        <Text style={tableStyles.footnote}>Compounds in the order each driver used them, listed in classification order</Text>
      </View>
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
  const avgs = entries.map(e => e.avg);
  const top = Math.max(...avgs);
  const bottom = Math.min(...avgs);
  return (
    <View>
      <View style={tableStyles.card}>
        <View style={tableStyles.headerRow}>
          <ColumnHeader style={styles.flexIndent}>DRIVER</ColumnHeader>
          <ColumnHeader style={styles.num}>AVG</ColumnHeader>
          <ColumnHeader style={styles.numNarrow}>BEST</ColumnHeader>
        </View>
        {entries.map(e => {
          const fav = isFavourite(e.driver);
          return (
            <View key={e.no} style={[tableStyles.row, fav && favRowStyle]}>
              <TeamStripe team={e.team} />
              <RankBadge pos={e.pos} />
              <View style={tableStyles.main}>
                <DriverName name={e.driver} fav={fav} />
                <ValueBar fraction={closeness(e.avg, top, bottom)} fav={fav} />
              </View>
              <Text style={[tableStyles.value, styles.num]}>{formatSpeed(e.avg, useKm)}</Text>
              <Text style={[tableStyles.sub, styles.numNarrow]}>{formatSpeed(e.best, useKm)}</Text>
            </View>
          );
        })}
        <Text style={tableStyles.footnote}>
          Average of each driver's 5 fastest passes through {trap}, in {unit} - steadier than a single best, which one tow can inflate
        </Text>
      </View>
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

const FLAG_LABELS = [
  {key: 'red', label: 'Red flag', color: '#E5322D'},
  {key: 'safetyCar', label: 'Safety Car', color: '#FEBD02'},
  {key: 'fcy', label: 'Full Course Yellow', color: '#FEBD02'},
];

function weatherIcon(weather) {
  const c = `${weather?.condition || ''} ${weather?.track || ''}`.toLowerCase();
  if (c.includes('rain') || c.includes('wet')) return 'grain';
  if (c.includes('bright') || c.includes('sun')) return 'wb-sunny';
  return 'wb-cloudy';
}

function minutesBetween(a, b) {
  const t = s => {
    const [h, m, sec] = (s.split('T')[1] || '').split(':').map(Number);
    return h * 60 + m + (sec || 0) / 60;
  };
  if (!a || !b) return null;
  return Math.round(t(b) - t(a));
}

function Tile({icon, label, value, sub, tone}) {
  return (
    <View style={[styles.tile, tone === 'late' && styles.tileLate]}>
      <View style={styles.tileHead}>
        <Icon name={icon} size={14} color={tone === 'late' ? '#FF8A80' : Colors.yellow} />
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
      {!!sub && <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

function SessionStatsBody({stats, roundNumber, session, isFavourite, useKm, weather, flagStats}) {
  useEffect(() => {
    Analytics.sessionStatsShown(roundNumber, session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundNumber, session]);
  const delay = delayLabel(stats.startDelayMins);
  const distance = stats.totalDistance == null ? null
    : useKm ? `${Math.round(stats.totalDistance * 1.60934).toLocaleString()} km` : `${Math.round(stats.totalDistance).toLocaleString()} miles`;
  const duration = minutesBetween(stats.actualStart, stats.finishTime);
  const classes = Object.entries(stats.classes).filter(([, info]) => info.fastestLap);
  const incidents = flagStats ? FLAG_LABELS.filter(f => flagStats[f.key] > 0) : [];
  const history = stats.fastestLapHistory;

  const finalHolder = history.length ? history[history.length - 1] : null;

  return (
    <View>
      <View style={styles.tileGrid}>
        {weather && <Tile icon={weatherIcon(weather)} label="CONDITIONS" value={weather.condition} sub={`Track ${weather.track.toLowerCase()}`} />}
        {stats.actualStart && (
          <Tile
            icon="schedule"
            label="START"
            value={clockTime(stats.actualStart)}
            sub={delay ? `${delay}${stats.plannedStart ? ` (${clockTime(stats.plannedStart)})` : ''}` : null}
            tone={stats.startDelayMins > 0 ? 'late' : null}
          />
        )}
        {stats.competitors != null && <Tile icon="groups" label="STARTERS" value={String(stats.competitors)} sub={duration ? `${duration} min session` : null} />}
        {stats.totalLaps != null && <Tile icon="loop" label="LAPS" value={stats.totalLaps.toLocaleString()} sub={distance ? `${distance} covered` : null} />}
      </View>
      {flagStats && (
        <View style={styles.flagRow}>
          {incidents.length ? incidents.map(f => (
            <View key={f.key} style={[styles.flagChip, {borderColor: f.color}]}>
              <Icon name="flag" size={12} color={f.color} />
              <Text style={styles.flagChipText}>{f.label}{flagStats[f.key] > 1 ? ` x${flagStats[f.key]}` : ''}</Text>
            </View>
          )) : (
            <View style={[styles.flagChip, styles.flagChipClean]}>
              <Icon name="flag" size={12} color="#4CD07D" />
              <Text style={styles.flagChipText}>Green all the way - no flag incidents</Text>
            </View>
          )}
        </View>
      )}
      {classes.length > 0 && (
        <View style={tableStyles.card}>
          <Text style={styles.sectionTitle}>FASTEST LAP BY CLASS</Text>
          {classes.map(([cl, info]) => {
            const fav = isFavourite(info.fastestLap.driver);
            return (
              <View key={cl} style={[tableStyles.row, fav && favRowStyle]}>
                <TeamStripe team={info.fastestLap.team} />
                <View style={tableStyles.main}>
                  <Text style={styles.classLabel}>{(CLASS_LABELS[cl] || cl).toUpperCase()}</Text>
                  <DriverName name={info.fastestLap.driver} fav={fav} />
                </View>
                <View style={styles.classRight}>
                  <Text style={tableStyles.value}>{info.fastestLap.time}</Text>
                  {!!info.fastestLap.lap && <Text style={tableStyles.sub}>lap {info.fastestLap.lap}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}
      {history.length > 0 && (
        <View style={tableStyles.card}>
          <Text style={styles.sectionTitle}>FASTEST LAP PROGRESSION</Text>
          {history.map((e, i) => {
            const fav = isFavourite(e.driver);
            const last = e === finalHolder;
            return (
              <View key={i} style={[styles.timelineRow, fav && favRowStyle]}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, last && styles.timelineDotLast, fav && styles.timelineDotFav]} />
                  {i < history.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <Text style={styles.lapNo}>{e.group ? `G${e.group} ` : ''}L{e.lap}</Text>
                <View style={tableStyles.main}><DriverName name={e.driver} fav={fav} /></View>
                <Text style={[tableStyles.value, last && styles.fastestText]}>{e.time}</Text>
              </View>
            );
          })}
          <Text style={tableStyles.footnote}>Every time the session's fastest lap was beaten{history.some(e => e.group) ? ' (G1/G2 = qualifying group)' : ''}</Text>
        </View>
      )}
    </View>
  );
}

export function SessionStatsCard({year, roundNumber, session, isFavourite, useKm, weather, flagStats}) {
  return (
    <AnalysisGate year={year} roundNumber={roundNumber} session={session}>
      {data => (data.sessionStats ? (
        <SessionStatsBody stats={data.sessionStats} roundNumber={roundNumber} session={session} isFavourite={isFavourite} useKm={useKm} weather={weather} flagStats={flagStats} />
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

const SESSION_BEST = '#C77DFF';
const PERSONAL_BEST = '#4CD07D';

const styles = StyleSheet.create({
  card: {backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 6, alignItems: 'center'},
  chartCard: {backgroundColor: Colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, marginTop: 4, marginBottom: 6},
  chartEmpty: {textAlign: 'center', paddingVertical: 40},
  hint: {color: Colors.textSecondary, fontSize: 10.5, textAlign: 'center', marginTop: 2},
  legendRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8, marginBottom: 6},
  legendChip: {flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingLeft: 7, paddingRight: 6, paddingVertical: 3},
  legendDot: {width: 8, height: 8, borderRadius: 4},
  legendText: {color: '#fff', fontSize: 11, fontWeight: '700', maxWidth: 110},
  flex: {flex: 1},
  flexIndent: {flex: 1, marginLeft: 36},
  favText: {color: Colors.yellow},
  fastestText: {color: '#C77DFF'},
  num: {width: 58, textAlign: 'right'},
  numNarrow: {width: 40, textAlign: 'right'},
  checkHeader: {width: 34, marginLeft: 6},
  colHeader: {color: Colors.textSecondary, fontSize: 9.5, fontWeight: '800', letterSpacing: 1},
  sectionTitle: {color: Colors.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginHorizontal: 6, marginTop: 6, marginBottom: 4},
  muted: {color: Colors.textSecondary, fontSize: 12},
  check: {width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  expandArea: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6},
  rowOpen: {backgroundColor: 'rgba(255,255,255,0.04)'},
  lapTable: {backgroundColor: Colors.surface, borderRadius: 10, padding: 8, marginVertical: 4, marginLeft: 10},
  lapTableRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 4, borderRadius: 4},
  lapTableRowAlt: {backgroundColor: 'rgba(255,255,255,0.025)'},
  lapTableRowBest: {backgroundColor: 'rgba(76,208,125,0.10)'},
  lapCellLap: {color: Colors.textSecondary, fontSize: 11, width: 26, fontVariant: ['tabular-nums']},
  lapCell: {color: '#fff', fontSize: 11, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums']},
  lapCellTime: {color: '#fff', fontSize: 11, fontWeight: '800', width: 92, textAlign: 'right', fontVariant: ['tabular-nums']},
  lapDeleted: {color: Colors.textSecondary, textDecorationLine: 'line-through'},
  sectorSessionBest: {color: SESSION_BEST, fontWeight: '800'},
  sectorPersonalBest: {color: PERSONAL_BEST, fontWeight: '800'},
  keyRow: {flexDirection: 'row', gap: 16, marginTop: 8, paddingHorizontal: 4},
  keyItem: {flexDirection: 'row', alignItems: 'center', gap: 5},
  keyDot: {width: 7, height: 7, borderRadius: 4},
  keyText: {color: Colors.textSecondary, fontSize: 10},
  tyre: {alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0C14'},
  tyreLetter: {fontWeight: '900'},
  tyreRow: {flexDirection: 'row', alignItems: 'center', gap: 3},
  rankBlank: {color: Colors.textSecondary, width: 22, textAlign: 'center'},
  usageRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 6},
  usageTile: {flexGrow: 1, flexBasis: '30%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: 12, padding: 10},
  usageCount: {color: '#fff', fontSize: 18, fontWeight: '900'},
  usageLabel: {color: Colors.textSecondary, fontSize: 10.5, fontWeight: '700'},
  tileGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 6},
  tile: {flexBasis: '48%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12},
  tileLate: {backgroundColor: 'rgba(229,50,45,0.14)'},
  tileHead: {flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6},
  tileLabel: {color: Colors.textSecondary, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1},
  tileValue: {color: '#fff', fontSize: 18, fontWeight: '900'},
  tileSub: {color: Colors.textSecondary, fontSize: 11, marginTop: 2},
  flagRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6},
  flagChip: {flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: Colors.card},
  flagChipClean: {borderColor: 'rgba(76,208,125,0.6)'},
  flagChipText: {color: '#fff', fontSize: 11.5, fontWeight: '700'},
  classLabel: {color: Colors.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 1},
  classRight: {alignItems: 'flex-end'},
  timelineRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingRight: 6, borderRadius: 8, borderWidth: 1, borderColor: 'transparent'},
  timelineRail: {width: 16, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center'},
  timelineDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textSecondary, zIndex: 1},
  timelineDotLast: {backgroundColor: '#C77DFF', width: 10, height: 10, borderRadius: 5},
  timelineDotFav: {backgroundColor: Colors.yellow},
  timelineLine: {position: 'absolute', top: '50%', bottom: -14, width: 2, backgroundColor: Colors.outline},
  lapNo: {color: Colors.textSecondary, fontSize: 11, fontWeight: '700', width: 44, fontVariant: ['tabular-nums']},
});
