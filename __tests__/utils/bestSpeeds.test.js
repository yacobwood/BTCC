import {selectBestSpeedsRows} from '../../src/screens/RoundResultsScreen';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntries(count) {
  return Array.from({length: count}, (_, i) => ({
    pos: i + 1, no: i + 1, driver: `Driver${i + 1}`, team: 'Team A', mph: 150 - i,
  }));
}

const noFavourite = () => false;
const favouriteDriver8 = (name) => name === 'Driver8';

// ── selectBestSpeedsRows ───────────────────────────────────────────────────────

describe('selectBestSpeedsRows', () => {
  it('returns an empty array for empty/missing entries', () => {
    expect(selectBestSpeedsRows([], false, noFavourite)).toEqual([]);
    expect(selectBestSpeedsRows(null, false, noFavourite)).toEqual([]);
    expect(selectBestSpeedsRows(undefined, false, noFavourite)).toEqual([]);
  });

  it('returns the top `count` entries by default', () => {
    const rows = selectBestSpeedsRows(makeEntries(10), false, noFavourite, 5);
    expect(rows).toHaveLength(5);
    expect(rows.map(r => r.pos)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns every entry unmodified when there are fewer than `count`', () => {
    const rows = selectBestSpeedsRows(makeEntries(3), false, noFavourite, 5);
    expect(rows).toHaveLength(3);
  });

  it('appends the favourited driver when they sit outside the top `count`', () => {
    const rows = selectBestSpeedsRows(makeEntries(10), false, favouriteDriver8, 5);
    expect(rows).toHaveLength(6);
    expect(rows[5].driver).toBe('Driver8');
  });

  it('does not duplicate the favourited driver when already inside the top `count`', () => {
    const alwaysFav = (name) => name === 'Driver2';
    const rows = selectBestSpeedsRows(makeEntries(10), false, alwaysFav, 5);
    expect(rows).toHaveLength(5);
    expect(rows.filter(r => r.driver === 'Driver2')).toHaveLength(1);
  });

  it('returns every entry regardless of favourite when expanded', () => {
    const rows = selectBestSpeedsRows(makeEntries(10), true, favouriteDriver8, 5);
    expect(rows).toHaveLength(10);
  });

  it('is a no-op when no driver is favourited', () => {
    const rows = selectBestSpeedsRows(makeEntries(10), false, noFavourite, 5);
    expect(rows).toHaveLength(5);
  });
});
