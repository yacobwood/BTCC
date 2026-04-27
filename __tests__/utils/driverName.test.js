import {formatDriverName} from '../../src/utils/driverName';

describe('formatDriverName', () => {
  it('returns empty string for null input', () => {
    expect(formatDriverName(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(formatDriverName(undefined)).toBe('');
  });

  it('returns empty string for empty string input', () => {
    expect(formatDriverName('')).toBe('');
  });

  it('uppercases a single-word name', () => {
    expect(formatDriverName('sutton')).toBe('SUTTON');
  });

  it('preserves first name casing and uppercases surname', () => {
    expect(formatDriverName('Ashley Sutton')).toBe('Ashley SUTTON');
  });

  it('handles already-uppercase surname without change', () => {
    expect(formatDriverName('Ashley SUTTON')).toBe('Ashley SUTTON');
  });

  it('handles multi-part surnames (Daryl DE LEON)', () => {
    expect(formatDriverName('Daryl De Leon')).toBe('Daryl DE LEON');
  });

  it('handles multi-part surnames already formatted', () => {
    expect(formatDriverName('Daryl DE LEON')).toBe('Daryl DE LEON');
  });

  it('trims leading and trailing whitespace', () => {
    expect(formatDriverName('  Colin Turkington  ')).toBe('Colin TURKINGTON');
  });

  it('collapses internal whitespace in surname', () => {
    expect(formatDriverName('Dan  Cammish')).toBe('Dan CAMMISH');
  });
});
