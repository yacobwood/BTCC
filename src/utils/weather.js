const WMO_DESCRIPTIONS = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm',
};

const WMO_ICONS = {
  0: 'wb-sunny', 1: 'wb-sunny', 2: 'cloud', 3: 'cloud',
  45: 'blur-on', 48: 'blur-on',
  51: 'grain', 53: 'grain', 55: 'grain',
  61: 'water-drop', 63: 'water-drop', 65: 'water-drop',
  71: 'ac-unit', 73: 'ac-unit', 75: 'ac-unit',
  80: 'water-drop', 81: 'water-drop', 82: 'water-drop',
  95: 'flash-on', 96: 'flash-on', 99: 'flash-on',
};

export function weatherDescription(code) {
  return WMO_DESCRIPTIONS[code] || 'Unknown';
}

export function weatherIcon(code) {
  return WMO_ICONS[code] || 'cloud';
}

const MAX_FORECAST_DAYS = 16;

export async function fetchWeather(lat, lng, startDate, endDate) {
  const today = new Date();
  const start = new Date(startDate);
  const diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
  if (diffDays > MAX_FORECAST_DAYS) return null;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Europe/London&start_date=${startDate}&end_date=${endDate}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.daily;
    if (!d?.time) return null;
    return d.time.map((date, i) => ({
      date,
      weatherCode: d.weather_code[i],
      tempMax: Math.round(d.temperature_2m_max[i]),
      tempMin: Math.round(d.temperature_2m_min[i]),
      precipProb: d.precipitation_probability_max[i],
      windMax: Math.round(d.wind_speed_10m_max[i]),
    }));
  } catch { return null; }
}
