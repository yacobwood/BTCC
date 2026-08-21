const {selectMessagesToTrim, MAX_MESSAGES, MAX_AGE_MS} = require('../../functions/chatTrim');

const NOW = new Date('2026-08-20T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

// Builds `count` entries, oldest-first, spaced 1ms apart starting at `startTs`.
// `prefix` keeps keys unique across multiple calls in the same test (e.g.
// distinguishing an "old" batch from a "recent" batch) - reusing keys would
// silently collapse two conceptually different entries into one via the
// Set-based dedup inside selectMessagesToTrim.
function makeEntries(count, startTs = NOW - count, prefix = 'm') {
  return Array.from({length: count}, (_, i) => ({key: `${prefix}${i}`, timestamp: startTs + i}));
}

describe('selectMessagesToTrim', () => {
  it('deletes nothing when under the message cap and all recent', () => {
    const entries = makeEntries(50, NOW - 1000);
    expect(selectMessagesToTrim(entries, NOW)).toEqual([]);
  });

  it('deletes nothing at exactly the message cap', () => {
    const entries = makeEntries(MAX_MESSAGES, NOW - 1000);
    expect(selectMessagesToTrim(entries, NOW)).toEqual([]);
  });

  it('deletes only the oldest messages once over the count cap, keeping the newest 200', () => {
    const entries = makeEntries(MAX_MESSAGES + 5, NOW - 1000);
    const deleted = selectMessagesToTrim(entries, NOW);
    expect(deleted).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
  });

  it('deletes a message older than 14 days even when well under the count cap', () => {
    const entries = [
      {key: 'old', timestamp: NOW - (MAX_AGE_MS + DAY)},
      {key: 'new', timestamp: NOW - 1000},
    ];
    expect(selectMessagesToTrim(entries, NOW)).toEqual(['old']);
  });

  it('keeps a message exactly at the 14-day boundary (not older than cutoff)', () => {
    const entries = [{key: 'boundary', timestamp: NOW - MAX_AGE_MS}];
    expect(selectMessagesToTrim(entries, NOW)).toEqual([]);
  });

  it('deletes a message one millisecond past the 14-day boundary', () => {
    const entries = [{key: 'justOld', timestamp: NOW - MAX_AGE_MS - 1}];
    expect(selectMessagesToTrim(entries, NOW)).toEqual(['justOld']);
  });

  it('does not re-apply the count cap to messages already removed by the age cap', () => {
    // 10 messages older than 14 days, 50 recent ones - only the 10 old ones
    // should go; the count cap has nothing left to do since 50 < 200.
    const old = makeEntries(10, NOW - MAX_AGE_MS - DAY, 'old');
    const recent = makeEntries(50, NOW - 1000, 'recent');
    const deleted = selectMessagesToTrim([...old, ...recent], NOW);
    expect(deleted.sort()).toEqual(old.map(e => e.key).sort());
  });

  it('applies the count cap to what remains after the age cap removes some messages', () => {
    // 10 old messages (deleted by age) + 205 recent messages (5 over cap).
    const old = makeEntries(10, NOW - MAX_AGE_MS - DAY, 'old');
    const recent = makeEntries(205, NOW - 1000, 'recent');
    const deleted = selectMessagesToTrim([...old, ...recent], NOW);
    expect(deleted).toHaveLength(15); // 10 old + 5 oldest-of-the-remaining-205
    old.forEach(e => expect(deleted).toContain(e.key));
    // The 5 oldest of the 205 recent ones (recent[0..4]) should also be gone.
    recent.slice(0, 5).forEach(e => expect(deleted).toContain(e.key));
    // The remaining 200 recent ones should survive.
    recent.slice(5).forEach(e => expect(deleted).not.toContain(e.key));
  });

  it('returns an empty array for no entries', () => {
    expect(selectMessagesToTrim([], NOW)).toEqual([]);
  });
});
