/**
 * Minimal mock for react-native-svg so Jest tests don't crash when components
 * that use SVG (e.g. CareerTimeline) render in the test environment.
 */
const React = require('react');
const {View, Text} = require('react-native');

const Stub = ({children}) => React.createElement(View, null, children);
const TextStub = ({children}) => React.createElement(Text, null, children);

module.exports = {
  __esModule: true,
  default: Stub,
  Svg: Stub,
  Circle: Stub,
  Ellipse: Stub,
  G: Stub,
  Line: Stub,
  Path: Stub,
  Polygon: Stub,
  Polyline: Stub,
  Rect: Stub,
  Text: TextStub,
  TSpan: TextStub,
  TextPath: Stub,
  Use: Stub,
  Image: Stub,
  Symbol: Stub,
  Defs: Stub,
  LinearGradient: Stub,
  RadialGradient: Stub,
  Stop: Stub,
  ClipPath: Stub,
  Pattern: Stub,
  Mask: Stub,
};
