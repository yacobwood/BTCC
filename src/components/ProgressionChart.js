import React, {useState, useEffect, memo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Dimensions} from 'react-native';
import Svg, {Polyline, Line, Text as SvgText} from 'react-native-svg';
import {Colors} from '../theme/colors';

const CHART_COLORS = [
  '#FEBD02', '#5B8DEF', '#E06060', '#4CAF7D', '#D4853F',
  '#9B7ED8', '#D07AAB', '#4DA8A0', '#C9943B', '#7B80C5',
  '#4BA8C4', '#8BB44E', '#C44A6A', '#8B6BBF', '#4A9AC4',
];

const screenWidth = Dimensions.get('window').width;

function ProgressionChart({series: rawSeries, roundLabels, isFavourite}) {
  const series = rawSeries.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);
  const [visible, setVisible] = useState(() => {
    const m = {};
    series.forEach(s => { m[s.name] = true; });
    return m;
  });

  // Reset visibility when the year changes (series names change)
  useEffect(() => {
    const m = {};
    series.forEach(s => { m[s.name] = true; });
    setVisible(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawSeries]);


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
  const chartH = 300;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxRounds = Math.max(...series.map(s => s.points.length), 1);
  const maxPts = Math.max(...series.map(s => Math.max(...s.points.filter(v => v !== null), 0)), 1);

  // Y-axis ticks every 50
  const yTicks = [];
  for (let v = 0; v <= maxPts + 50; v += 50) yTicks.push(v);

  const x = (i) => padL + (i / (maxRounds - 1 || 1)) * plotW;
  const y = (v) => padT + plotH - (v / (yTicks[yTicks.length - 1] || 1)) * plotH;

  return (
    <View>
      <View style={styles.chartContainer}>
        <Svg width={chartW} height={chartH}>
          {/* Y-axis grid lines and labels */}
          {yTicks.map(v => (
            <React.Fragment key={v}>
              <Line x1={padL} y1={y(v)} x2={chartW - padR} y2={y(v)} stroke={Colors.outline} strokeWidth={0.5} />
              <SvgText x={padL - 6} y={y(v) + 4} fill={Colors.textSecondary} fontSize={9} textAnchor="end">{v}</SvgText>
            </React.Fragment>
          ))}
          {/* X-axis labels */}
          {Array.from({length: maxRounds}, (_, i) => (
            <SvgText key={i} x={x(i)} y={chartH - 4} fill={Colors.textSecondary} fontSize={8} textAnchor="middle">
              R{i + 1}
            </SvgText>
          ))}
          {/* Lines — split into segments at null gaps (late-joining drivers) */}
          {series.map((s, si) => {
            if (visible[s.name] === false) return null;
            const color = CHART_COLORS[si % CHART_COLORS.length];
            // Build contiguous segments, skipping null entries
            const segments = [];
            let seg = [];
            s.points.forEach((v, i) => {
              if (v === null) {
                if (seg.length > 1) segments.push(seg);
                seg = [];
              } else {
                seg.push(`${x(i)},${y(v)}`);
              }
            });
            if (seg.length > 1) segments.push(seg);
            return segments.map((pts, segIdx) => (
              <Polyline
                key={`${s.name}-${segIdx}`}
                points={pts.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                opacity={0.85}
              />
            ));
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
          const color = CHART_COLORS[si % CHART_COLORS.length];
          const on = visible[s.name] !== false;
          const fav = isFavourite?.(s.name);
          const finalPts = s.points[s.points.length - 1] || 0;
          const surname = s.name.split(' ').pop();
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
                <Text style={[styles.legendName, fav && {color: Colors.yellow}]}>{surname}</Text>
                <Text style={styles.legendPts}>{finalPts} pts</Text>
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

export default memo(ProgressionChart);
