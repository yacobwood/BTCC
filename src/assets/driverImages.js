// Bundled driver images keyed by driver number for instant loading.
// Two sizes, not one - see scripts/generate_driver_bundle.py for the full
// story: bundling a single size for both the small grid tile/roster card
// AND the full-width profile header reintroduced the exact decode-memory-
// pool crisis already fixed once this session for car images (confirmed
// live via the same "Pool hard cap violation" native error) - the grid's
// 23+ tiles decoding a much-bigger-than-needed photo each ate almost the
// entire pool before a profile page ever got a turn. getDriverImage() (this
// smaller size) is for DriversScreen's tile and TeamDetailScreen's roster
// card; getDriverImageLarge() is for DriverDetailScreen's header only.
const driverImages = {
  2: require('./driver_images/deleon.webp'),
  3: require('./driver_images/chilton.webp'),
  7: require('./driver_images/bensley.webp'),
  11: require('./driver_images/collard.webp'),
  15: require('./driver_images/selby.webp'),
  16: require('./driver_images/moffat.webp'),
  17: require('./driver_images/patterson.webp'),
  19: require('./driver_images/19.webp'),
  22: require('./driver_images/smiley.webp'),
  27: require('./driver_images/cammish.webp'),
  29: require('./driver_images/gilbert.webp'),
  28: require('./driver_images/hamilton.webp'),
  32: require('./driver_images/robottom.webp'),
  33: require('./driver_images/morgan.webp'),
  50: require('./driver_images/taylorsmith.webp'),
  52: require('./driver_images/shedden.webp'),
  55: require('./driver_images/halstead.webp'),
  66: require('./driver_images/cook.webp'),
  77: require('./driver_images/osborne.webp'),
  80: require('./driver_images/ingram.webp'),
  88: require('./driver_images/doble.webp'),
  99: require('./driver_images/rainford.webp'),
  116: require('./driver_images/sutton.webp'),
  123: require('./driver_images/lloyd.webp'),
  132: require('./driver_images/132.webp'),
};

// 19/132 (Max Buxton/James Dorlin) reuse the same source photo as their
// small driverImages entry above rather than a scripts/generate_driver_bundle.py
// output - both are departed drivers with no data/driverImages/ source left
// to regenerate a proper large variant from. Root-caused live 2026-08-28:
// leaving them out on the assumption DriverDetailScreen's imageUrl fallback
// covered it was wrong - that fallback is a dead btcc.net wp-content hotlink
// now permanently blocked by Vercel's bot mitigation (429/challenge on every
// request, not a transient blip), so it rendered CachedImage's broken-image
// icon instead. imageUrl has been cleared to null for both in drivers.json
// accordingly (see DriverDetailScreen.js's own CachedImage fallback prop for
// the general-case defence if this gap reopens for some other driver).
const driverImagesLarge = {
  2: require('./driver_images_large/deleon.webp'),
  3: require('./driver_images_large/chilton.webp'),
  7: require('./driver_images_large/bensley.webp'),
  11: require('./driver_images_large/collard.webp'),
  15: require('./driver_images_large/selby.webp'),
  16: require('./driver_images_large/moffat.webp'),
  17: require('./driver_images_large/patterson.webp'),
  22: require('./driver_images_large/smiley.webp'),
  27: require('./driver_images_large/cammish.webp'),
  29: require('./driver_images_large/gilbert.webp'),
  28: require('./driver_images_large/hamilton.webp'),
  32: require('./driver_images_large/robottom.webp'),
  33: require('./driver_images_large/morgan.webp'),
  50: require('./driver_images_large/taylorsmith.webp'),
  52: require('./driver_images_large/shedden.webp'),
  55: require('./driver_images_large/halstead.webp'),
  66: require('./driver_images_large/cook.webp'),
  77: require('./driver_images_large/osborne.webp'),
  80: require('./driver_images_large/ingram.webp'),
  88: require('./driver_images_large/doble.webp'),
  99: require('./driver_images_large/rainford.webp'),
  116: require('./driver_images_large/sutton.webp'),
  123: require('./driver_images_large/lloyd.webp'),
  19: require('./driver_images_large/19.webp'),
  132: require('./driver_images_large/132.webp'),
};

export function getDriverImage(number) {
  return driverImages[number] || null;
}

export function getDriverImageLarge(number) {
  return driverImagesLarge[number] || null;
}

// Driver numbers with a bundled small photo - exported only so tests can
// sweep "does every one of these also have a large variant" generically,
// without a second hardcoded number list of its own to drift out of sync.
export function getBundledSmallNumbers() {
  return Object.keys(driverImages).map(Number);
}
