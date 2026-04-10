// Bundled driver images keyed by driver number for instant loading
const driverImages = {
  2: require('./driver_images/2.webp'),
  3: require('./driver_images/3.webp'),
  11: require('./driver_images/11.png'),
  15: require('./driver_images/15.png'),
  16: require('./driver_images/16.webp'),
  17: require('./driver_images/17.webp'),
  19: require('./driver_images/19.webp'),
  22: require('./driver_images/22.png'),
  27: require('./driver_images/27.webp'),
  28: require('./driver_images/28.png'),
  32: require('./driver_images/32.webp'),
  33: require('./driver_images/33.webp'),
  50: require('./driver_images/50.webp'),
  52: require('./driver_images/52.webp'),
  66: require('./driver_images/66.webp'),
  77: require('./driver_images/77.webp'),
  80: require('./driver_images/80.webp'),
  88: require('./driver_images/88.webp'),
  99: require('./driver_images/99.webp'),
  116: require('./driver_images/116.webp'),
  132: require('./driver_images/132.png'),
};

export function getDriverImage(number) {
  return driverImages[number] || null;
}
