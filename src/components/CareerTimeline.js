import React from 'react';
import {View, Text, Dimensions} from 'react-native';
import Svg, {Polyline, Line, Circle, Text as SvgText} from 'react-native-svg';
import {Colors} from '../theme/colors';

// Season-by-season championship position, as a small SVG line chart. Shared
// between DriverDetailScreen and TeamDetailScreen - only needs {year, pos},
// isChampion is optional (skips the star/gold treatment when absent, which
// is always true for team history - team.history has no isChampion field).
export default function CareerTimeline({history}) {
  const entries = [...history].filter(h => h.pos > 0).sort((a, b) => a.year - b.year);
  if (entries.length < 2) return null;

  const LABEL_W = 30;
  const H = 130;
  const PR = 8, PL = 6, PT = 14, PB = 18;
  // SVG width excludes the native label column
  const svgW = Dimensions.get('window').width - 32 - 16 - LABEL_W;
  const plotW = svgW - PL - PR;
  const plotH = H - PT - PB;

  const maxPos = Math.max(...entries.map(e => e.pos), 10);
  const xOf = i => PL + (i / (entries.length - 1)) * plotW;
  const yOf = pos => PT + ((pos - 1) / (maxPos - 1)) * plotH;

  const ticks = [1];
  for (let v = 5; v <= maxPos; v += 5) ticks.push(v);
  const linePoints = entries.map((h, i) => `${xOf(i)},${yOf(h.pos)}`).join(' ');

  const dotColor = h =>
    h.isChampion ? Colors.yellow :
    h.pos === 2 ? '#C0C0C0' :
    h.pos === 3 ? '#CD7F32' :
    h.pos <= 10 ? '#fff' :
    Colors.textSecondary;

  return (
    <View style={{backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6, marginBottom: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start'}}>
      {/* Y-axis labels as native Text - outside SVG to avoid SVG clipping */}
      <View style={{width: LABEL_W, height: H}}>
        {ticks.map(v => (
          <Text key={v} style={{position: 'absolute', top: yOf(v) - 6, right: 4, color: Colors.textSecondary, fontSize: 8, fontWeight: '600'}}>P{v}</Text>
        ))}
      </View>
      <Svg width={svgW} height={H}>
        {ticks.map(v => (
          <Line key={v} x1={PL} y1={yOf(v)} x2={svgW - PR} y2={yOf(v)} stroke={Colors.outline} strokeWidth={0.5} />
        ))}
        <Polyline points={linePoints} fill="none" stroke="rgba(139,143,168,0.35)" strokeWidth={1.5} strokeLinejoin="round" />
        {entries.map((h, i) => (
          <React.Fragment key={h.year}>
            <Circle cx={xOf(i)} cy={yOf(h.pos)} r={4} fill={dotColor(h)} />
            {h.isChampion && (
              <SvgText x={xOf(i)} y={yOf(h.pos) - 7} fill={Colors.yellow} fontSize={9} textAnchor="middle">★</SvgText>
            )}
          </React.Fragment>
        ))}
        {entries.map((h, i) => (
          <SvgText key={h.year} x={xOf(i)} y={H - 2} fill={Colors.textSecondary} fontSize={8} textAnchor="middle">
            '{String(h.year).slice(2)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
