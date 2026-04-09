// Bundled driver images keyed by driver number for instant loading
const driverImages = {
  2: require('./driver_images/2.webp'),
  3: require('./driver_images/3.webp'),
  16: require('./driver_images/16.webp'),
  17: require('./driver_images/17.webp'),
  18: require('./driver_images/18.webp'),
  19: require('./driver_images/19.webp'),
  25: require('./driver_images/25.webp'),
  27: require('./driver_images/27.webp'),
  32: require('./driver_images/32.webp'),
  33: require('./driver_images/33.webp'),
  40: require('./driver_images/40.webp'),
  50: require('./driver_images/50.webp'),
  52: require('./driver_images/52.webp'),
  66: require('./driver_images/66.webp'),
  77: require('./driver_images/77.webp'),
  80: require('./driver_images/80.webp'),
  88: require('./driver_images/88.webp'),
  99: require('./driver_images/99.webp'),
  116: require('./driver_images/116.webp'),
};

export function getDriverImage(number) {
  return driverImages[number] || null;
}
