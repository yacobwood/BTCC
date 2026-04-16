// Bundled driver images keyed by driver number for instant loading
const driverImages = {
  2: require('./driver_images/2.png'),
  3: require('./driver_images/3.png'),
  11: require('./driver_images/11.png'),
  15: require('./driver_images/15.png'),
  16: require('./driver_images/16.png'),
  17: require('./driver_images/17.png'),
  19: require('./driver_images/19.png'),
  22: require('./driver_images/22.png'),
  27: require('./driver_images/27.png'),
  28: require('./driver_images/28.png'),
  32: require('./driver_images/32.png'),
  33: require('./driver_images/33.png'),
  50: require('./driver_images/50.png'),
  52: require('./driver_images/52.png'),
  66: require('./driver_images/66.png'),
  77: require('./driver_images/77.png'),
  80: require('./driver_images/80.png'),
  88: require('./driver_images/88.png'),
  99: require('./driver_images/99.png'),
  116: require('./driver_images/116.png'),
  132: require('./driver_images/132.png'),
};

export function getDriverImage(number) {
  return driverImages[number] || null;
}
