import React from 'react';
import {View} from 'react-native';
import Svg, {Path, Circle} from 'react-native-svg';
import {Colors} from '../theme/colors';

// Coordinate space: viewBox 0 0 210 270
// lat: 49.5–61.0 (span 11.5), lng: -8.0–2.5 (span 10.5)
const VB_W = 210;
const VB_H = 270;
const LAT_MAX = 61.0;
const LAT_SPAN = 11.5;
const LNG_MIN = -8.0;
const LNG_SPAN = 10.5;

// Simplified UK mainland outline, clockwise from SE England
const UK_PATH = [
  'M186,232',  // Dover
  'L189,227',  // North Foreland
  'L174,224',  // Thames Estuary
  'L196,204',  // Lowestoft
  'L182,195',  // NW Norfolk
  'L161,182',  // Humberside
  'L161,171',  // Flamborough Head
  'L148,163',  // Whitby
  'L131,153',  // Tyne
  'L123,139',  // Holy Island
  'L119,137',  // Berwick
  'L103,132',  // Firth of Forth
  'L105,126',  // Fife coast
  'L118,109',  // Aberdeen
  'L124,101',  // Peterhead
  'L81,94',    // Dornoch Firth
  'L101,84',   // Wick
  'L102,80',   // John O\'Groats
  'L95,79',    // Dunnet Head
  'L61,80',    // Cape Wrath
  'L46,96',    // Torridon
  'L44,112',   // Mallaig
  'L35,117',   // Ardnamurchan
  'L51,124',   // Oban
  'L50,130',   // Crinan
  'L49,144',   // Campbeltown
  'L45,147',   // Mull of Kintyre
  'L69,144',   // Ayr
  'L65,162',   // Mull of Galloway
  'L98,155',   // Solway Firth
  'L92,162',   // Workington
  'L98,173',   // Barrow
  'L102,179',  // Blackpool
  'L100,190',  // Dee Estuary
  'L67,201',   // Lleyn Peninsula
  'L62,217',   // Fishguard
  'L63,224',   // Milford Haven
  'L78,226',   // Gower
  'L101,228',  // Cardiff
  'L105,226',  // Newport
  'L105,230',  // Weston-super-Mare
  'L94,234',   // Minehead
  'L72,237',   // Hartland Point
  'L60,251',   // Newquay
  'L47,258',   // Land\'s End
  'L81,252',   // Plymouth
  'L117,249',  // Portland
  'L129,244',  // Bournemouth
  'L146,243',  // Portsmouth
  'L166,242',  // Brighton
  'L174,244',  // Beachy Head
  'L190,240',  // Dungeness
  'Z',
].join(' ');

// Tight viewBox — trimmed to actual UK outline extents
const VB_X = 30;
const VB_Y = 75;
const VB_TW = 170;
const VB_TH = 190;

export default function UKMapPin({lat, lng, height = 100}) {
  if (!lat || !lng) return null;
  const width = Math.round(height * (VB_TW / VB_TH));
  const pinX = (lng - LNG_MIN) / LNG_SPAN * VB_W;
  const pinY = (LAT_MAX - lat) / LAT_SPAN * VB_H;

  const innerH = height - 16;
  const innerW = Math.round(innerH * (VB_TW / VB_TH));
  return (
    <View style={{width, height, justifyContent: 'center', alignItems: 'center'}}>
      <Svg width={innerW} height={innerH} viewBox={`${VB_X} ${VB_Y} ${VB_TW} ${VB_TH}`}>
        <Path
          d={UK_PATH}
          fill={Colors.surface}
          stroke={Colors.outline}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Circle cx={pinX} cy={pinY} r={10} fill={Colors.yellow} opacity={0.25} />
        <Circle cx={pinX} cy={pinY} r={5} fill={Colors.yellow} />
      </Svg>
    </View>
  );
}
