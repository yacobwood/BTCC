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
  2: require('./driver_images/2.webp'),
  3: require('./driver_images/3.webp'),
  7: require('./driver_images/7.webp'),
  11: require('./driver_images/11.webp'),
  15: require('./driver_images/15.webp'),
  16: require('./driver_images/16.webp'),
  17: require('./driver_images/17.webp'),
  19: require('./driver_images/19.webp'),
  22: require('./driver_images/22.webp'),
  27: require('./driver_images/27.webp'),
  29: require('./driver_images/29.webp'),
  28: require('./driver_images/28.webp'),
  32: require('./driver_images/32.webp'),
  33: require('./driver_images/33.webp'),
  50: require('./driver_images/50.webp'),
  52: require('./driver_images/52.webp'),
  55: require('./driver_images/55.webp'),
  66: require('./driver_images/66.webp'),
  77: require('./driver_images/77.webp'),
  80: require('./driver_images/80.webp'),
  88: require('./driver_images/88.webp'),
  99: require('./driver_images/99.webp'),
  116: require('./driver_images/116.webp'),
  123: require('./driver_images/123.webp'),
  132: require('./driver_images/132.webp'),
};

// No 19/132 here (Max Buxton/James Dorlin) - both departed drivers with no
// data/driverImages/ source to generate a large variant from (see the
// generator script). getDriverImageLarge() returning null for them is
// correct: DriverDetailScreen's existing imageUrl fallback covers it, same
// as any driver with no bundled photo at all.
const driverImagesLarge = {
  2: require('./driver_images_large/2.webp'),
  3: require('./driver_images_large/3.webp'),
  7: require('./driver_images_large/7.webp'),
  11: require('./driver_images_large/11.webp'),
  15: require('./driver_images_large/15.webp'),
  16: require('./driver_images_large/16.webp'),
  17: require('./driver_images_large/17.webp'),
  22: require('./driver_images_large/22.webp'),
  27: require('./driver_images_large/27.webp'),
  29: require('./driver_images_large/29.webp'),
  28: require('./driver_images_large/28.webp'),
  32: require('./driver_images_large/32.webp'),
  33: require('./driver_images_large/33.webp'),
  50: require('./driver_images_large/50.webp'),
  52: require('./driver_images_large/52.webp'),
  55: require('./driver_images_large/55.webp'),
  66: require('./driver_images_large/66.webp'),
  77: require('./driver_images_large/77.webp'),
  80: require('./driver_images_large/80.webp'),
  88: require('./driver_images_large/88.webp'),
  99: require('./driver_images_large/99.webp'),
  116: require('./driver_images_large/116.webp'),
  123: require('./driver_images_large/123.webp'),
};

export function getDriverImage(number) {
  return driverImages[number] || null;
}

export function getDriverImageLarge(number) {
  return driverImagesLarge[number] || null;
}
