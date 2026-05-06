// Override the global SVG mock (which lacks a default export) with one that has
// __esModule: true so `import Svg from 'react-native-svg'` works in the real component
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg', Path: 'Path', Circle: 'Circle', G: 'G',
  Line: 'Line', Text: 'SvgText', Polyline: 'Polyline',
}));

// Use the real component — jest.setup.js stubs it as () => null globally
jest.mock('../../src/components/UKMapPin', () => jest.requireActual('../../src/components/UKMapPin'));

import React from 'react';
import {render} from '@testing-library/react-native';
import UKMapPin from '../../src/components/UKMapPin';

// Silverstone coordinates
const LAT = 52.07;
const LNG = -1.02;

describe('UKMapPin', () => {
  // ── Valid coordinates ─────────────────────────────────────────────────────────

  it('renders without crashing with valid lat and lng', () => {
    const {toJSON} = render(<UKMapPin lat={LAT} lng={LNG} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with a custom height', () => {
    const {toJSON} = render(<UKMapPin lat={LAT} lng={LNG} height={200} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders with default height when height prop is omitted', () => {
    const {toJSON} = render(<UKMapPin lat={LAT} lng={LNG} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── Edge coordinates ──────────────────────────────────────────────────────────

  it('renders for a northern Scotland location', () => {
    const {toJSON} = render(<UKMapPin lat={58.0} lng={-4.0} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders for a southern England location', () => {
    const {toJSON} = render(<UKMapPin lat={50.0} lng={-0.5} />);
    expect(toJSON()).toBeTruthy();
  });

  // ── Missing props ─────────────────────────────────────────────────────────────

  it('returns null when lat is not provided', () => {
    const {toJSON} = render(<UKMapPin lng={LNG} />);
    expect(toJSON()).toBeNull();
  });

  it('returns null when lng is not provided', () => {
    const {toJSON} = render(<UKMapPin lat={LAT} />);
    expect(toJSON()).toBeNull();
  });

  it('returns null when neither lat nor lng is provided', () => {
    const {toJSON} = render(<UKMapPin />);
    expect(toJSON()).toBeNull();
  });
});
