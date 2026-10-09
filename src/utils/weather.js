const WMO_ICONS = {
  0: 'wb-sunny', 1: 'wb-sunny', 2: 'cloud', 3: 'cloud',
  45: 'blur-on', 48: 'blur-on',
  51: 'grain', 53: 'grain', 55: 'grain',
  61: 'water-drop', 63: 'water-drop', 65: 'water-drop',
  71: 'ac-unit', 73: 'ac-unit', 75: 'ac-unit',
  80: 'water-drop', 81: 'water-drop', 82: 'water-drop',
  95: 'flash-on', 96: 'flash-on', 99: 'flash-on',
};

export function weatherIcon(code) {
  return WMO_ICONS[code] || 'cloud';
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Open-Meteo gives wind direction as the compass bearing it's blowing FROM,
// in degrees (0-360). 8-point compass is plenty of precision for a race
// weekend weather chip.
export function windDirectionCompass(deg) {
  return COMPASS_POINTS[Math.round(((deg % 360) / 45)) % 8];
}

export function weatherIconColor(code) {
  if (code === 0 || code === 1) return '#F5C842'; // sunny  -  warm amber
  if (code === 2)               return '#A0B4C8'; // partly cloudy  -  light blue-grey
  if (code === 3)               return '#7A8FA0'; // overcast  -  mid grey-blue
  if (code === 45 || code === 48) return '#8A9BAA'; // fog
  if (code >= 71 && code <= 75) return '#B0C8E0'; // snow  -  pale blue
  if (code === 95 || code === 96 || code === 99) return '#9B7ED8'; // thunder  -  purple
  return '#5BA3FF'; // rain/drizzle/showers  -  blue
}

import {cacheRead, cacheWrite} from '../store/cache';

const MAX_FORECAST_DAYS = 10;
// Shorter than a typical "check the week ahead" cache on purpose: a race
// weekend forecast is exactly the kind of thing worth re-checking through the
// day rather than settling for whatever was true hours ago.
const WEATHER_CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

// fetchWeather() returns {hourly} - hourly only, aligned to session start
// times by TrackDetailScreen. The old daily summary was dropped (2026-10-09)
// because its whole-day max/min and worst-case rain regularly contradicted
// the per-session forecast shown right beside it.
export async function fetchWeather(lat, lng, startDate, endDate) {
  const today = new Date();
  const start = new Date(startDate);
  const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
  if (diffDays > MAX_FORECAST_DAYS) return null;

  const cacheKey = `weather_${lat}_${lng}_${startDate}`;

  try {
    const cached = await cacheRead(cacheKey, WEATHER_CACHE_MAX_AGE);
    if (cached) return cached;
  } catch {}

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=weather_code,temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m,` +
      `wind_direction_10m,apparent_temperature,relative_humidity_2m,cloud_cover` +
      `&timezone=Europe/London&start_date=${startDate}&end_date=${endDate}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    if (timeoutId?.unref) timeoutId.unref();
    const res = await fetch(url, {signal: controller.signal});
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    const h = json.hourly;
    if (!h?.time) return null;
    const hourly = h.time.map((time, i) => ({
      time,
      weatherCode: h.weather_code[i],
      temp: Math.round(h.temperature_2m[i]),
      precipProb: h.precipitation_probability[i],
      windSpeed: Math.round(h.wind_speed_10m[i]),
      // Detail fields - only surfaced in TrackDetailScreen's expanded by-session
      // view, but fetched unconditionally since there's no separate cheap query.
      windGust: Math.round(h.wind_gusts_10m?.[i] ?? h.wind_speed_10m[i]),
      windDir: Math.round(h.wind_direction_10m?.[i] ?? 0),
      feelsLike: Math.round(h.apparent_temperature?.[i] ?? h.temperature_2m[i]),
      humidity: Math.round(h.relative_humidity_2m?.[i] ?? 0),
      cloudCover: Math.round(h.cloud_cover?.[i] ?? 0),
    }));
    const result = {hourly};
    cacheWrite(cacheKey, result).catch(() => {});
    return result;
  } catch { return null; }
}
