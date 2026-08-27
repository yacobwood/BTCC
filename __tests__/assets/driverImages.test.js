// jest.setup.js stubs this module globally (both getters -> null) so
// screen tests don't have to care which drivers have bundled photos.
// Override back to the real module here so we actually exercise the
// bundled require() maps this file guards.
jest.mock('../../src/assets/driverImages', () =>
  jest.requireActual('../../src/assets/driverImages'),
);

const {getDriverImageLarge, getBundledSmallNumbers} = require('../../src/assets/driverImages');

describe('driverImages bundle', () => {
  // Root-caused live 2026-08-28: Max Buxton (19) and James Dorlin (132) had
  // a small (tile-size) bundled photo but no large (DriverDetailScreen
  // header) one, so their profile page fell through to imageUrl - a dead
  // btcc.net wp-content hotlink permanently blocked by Vercel bot mitigation
  // - and showed CachedImage's broken-image icon instead of a photo.
  it('has a large bundled header photo for Max Buxton (19)', () => {
    expect(getDriverImageLarge(19)).not.toBeNull();
  });

  it('has a large bundled header photo for James Dorlin (132)', () => {
    expect(getDriverImageLarge(132)).not.toBeNull();
  });

  // Structural guard against the same class of bug recurring for any other
  // driver: DriverDetailScreen's header always prefers getDriverImageLarge()
  // over the small tile photo (see driverImages.js's own two-tier comment),
  // so a number present in one map but not the other silently regresses to
  // the dead network fallback for that one driver's profile page only -
  // exactly the shape that made this bug easy to miss in the first place.
  it('bundles a large photo for every number that has a small one', () => {
    const missingLarge = getBundledSmallNumbers().filter(n => !getDriverImageLarge(n));
    expect(missingLarge).toEqual([]);
  });
});
