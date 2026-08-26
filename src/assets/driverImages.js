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

// No 19/132 here (Max Buxton/James Dorlin) - both departed drivers with no
// data/driverImages/ source to generate a large variant from (see the
// generator script). getDriverImageLarge() returning null for them is
// correct: DriverDetailScreen's existing imageUrl fallback covers it, same
// as any driver with no bundled photo at all.
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
};

export function getDriverImage(number) {
  return driverImages[number] || null;
}

export function getDriverImageLarge(number) {
  return driverImagesLarge[number] || null;
}
