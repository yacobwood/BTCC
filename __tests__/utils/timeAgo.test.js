import {timeAgo} from '../../src/utils/timeAgo';

describe('timeAgo', () => {
  const now = Date.now();

  it('returns empty string for falsy input', () => {
    expect(timeAgo(null)).toBe('');
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo('')).toBe('');
  });

  it('returns "just now" for timestamps within the last minute', () => {
    expect(timeAgo(now - 30 * 1000)).toBe('just now');
    expect(timeAgo(now - 59 * 1000)).toBe('just now');
  });

  it('returns minutes ago for timestamps between 1 and 60 minutes', () => {
    expect(timeAgo(now - 2 * 60 * 1000)).toBe('2m ago');
    expect(timeAgo(now - 59 * 60 * 1000)).toBe('59m ago');
  });

  it('returns hours ago for timestamps between 1 and 24 hours', () => {
    expect(timeAgo(now - 2 * 3600 * 1000)).toBe('2h ago');
    expect(timeAgo(now - 23 * 3600 * 1000)).toBe('23h ago');
  });

  it('returns days ago for timestamps older than 24 hours', () => {
    expect(timeAgo(now - 2 * 86400 * 1000)).toBe('2d ago');
    expect(timeAgo(now - 7 * 86400 * 1000)).toBe('7d ago');
  });

  it('accepts ISO date strings', () => {
    const ts = new Date(now - 5 * 60 * 1000).toISOString();
    expect(timeAgo(ts)).toBe('5m ago');
  });
});
