import {
  weatherIcon,
  weatherIconColor,
  windDirectionCompass,
  fetchWeather,
} from '../../src/utils/weather';

// ── weatherIcon ────────────────────────────────────────────────────────────────
describe('weatherIcon', () => {
  it('returns "wb-sunny" for clear sky (0)', () => {
    expect(weatherIcon(0)).toBe('wb-sunny');
  });

  it('returns "cloud" for overcast (3)', () => {
    expect(weatherIcon(3)).toBe('cloud');
  });

  it('returns "water-drop" for heavy rain (65)', () => {
    expect(weatherIcon(65)).toBe('water-drop');
  });

  it('returns "ac-unit" for snow (73)', () => {
    expect(weatherIcon(73)).toBe('ac-unit');
  });

  it('returns "flash-on" for thunderstorm (95)', () => {
    expect(weatherIcon(95)).toBe('flash-on');
  });

  it('defaults to "cloud" for an unrecognised code', () => {
    expect(weatherIcon(999)).toBe('cloud');
  });
});

// ── weatherIconColor ───────────────────────────────────────────────────────────
describe('weatherIconColor', () => {
  it('returns amber for clear sky (0)', () => {
    expect(weatherIconColor(0)).toBe('#F5C842');
  });

  it('returns amber for mainly clear (1)', () => {
    expect(weatherIconColor(1)).toBe('#F5C842');
  });

  it('returns light blue-grey for partly cloudy (2)', () => {
    expect(weatherIconColor(2)).toBe('#A0B4C8');
  });

  it('returns mid grey-blue for overcast (3)', () => {
    expect(weatherIconColor(3)).toBe('#7A8FA0');
  });

  it('returns fog colour for code 45', () => {
    expect(weatherIconColor(45)).toBe('#8A9BAA');
  });

  it('returns pale blue for snow (71)', () => {
    expect(weatherIconColor(71)).toBe('#B0C8E0');
  });

  it('returns pale blue for heavy snow (75)', () => {
    expect(weatherIconColor(75)).toBe('#B0C8E0');
  });

  it('returns purple for thunderstorm (95)', () => {
    expect(weatherIconColor(95)).toBe('#9B7ED8');
  });

  it('returns purple for thunderstorm + hail (96)', () => {
    expect(weatherIconColor(96)).toBe('#9B7ED8');
  });

  it('returns blue for rain (63)', () => {
    expect(weatherIconColor(63)).toBe('#5BA3FF');
  });

  it('returns blue for light showers (80)', () => {
    expect(weatherIconColor(80)).toBe('#5BA3FF');
  });
});

// ── windDirectionCompass ─────────────────────────────────────────────────────────
describe('windDirectionCompass', () => {
  it('returns N for 0 degrees', () => {
    expect(windDirectionCompass(0)).toBe('N');
  });

  it('returns E for 90 degrees', () => {
    expect(windDirectionCompass(90)).toBe('E');
  });

  it('returns SW for 225 degrees', () => {
    expect(windDirectionCompass(225)).toBe('SW');
  });

  it('wraps 360 back to N', () => {
    expect(windDirectionCompass(360)).toBe('N');
  });

  it('rounds to the nearest 8-point compass direction', () => {
    // 200 degrees is closer to S (180, distance 20) than SW (225, distance 25)
    expect(windDirectionCompass(200)).toBe('S');
  });
});

// ── fetchWeather ───────────────────────────────────────────────────────────────
const MOCK_RESPONSE = {
  hourly: {
    time: ['2025-05-04T00:00', '2025-05-04T01:00', '2025-05-05T14:00'],
    weather_code: [1, 2, 61],
    temperature_2m: [9.6, 9.1, 13.7],
    precipitation_probability: [0, 5, 65],
    wind_speed_10m: [8.2, 9.9, 21.4],
    wind_gusts_10m: [10.1, 12.4, 30.2],
    wind_direction_10m: [200, 210, 225],
    apparent_temperature: [8.0, 8.5, 12.9],
    relative_humidity_2m: [70, 72, 88],
    cloud_cover: [40, 55, 95],
  },
};

describe('fetchWeather', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-04-27'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null when the event is more than 10 days away', async () => {
    // system time: 2025-04-27; May 15 is 18 days away
    const result = await fetchWeather(52.07, -1.02, '2025-05-15', '2025-05-17');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null at the boundary of exactly 11 days away', async () => {
    // system time: 2025-04-27; May 8 is exactly 11 days away
    const result = await fetchWeather(52.07, -1.02, '2025-05-08', '2025-05-09');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches at the boundary of exactly 10 days away', async () => {
    // system time: 2025-04-27; May 7 is exactly 10 days away — should fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });
    const result = await fetchWeather(52.07, -1.02, '2025-05-07', '2025-05-08');
    expect(result).not.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns mapped hourly forecast data', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });

    const result = await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');

    expect(result.hourly).toHaveLength(3);
    expect(result.hourly[2]).toEqual({
      time: '2025-05-05T14:00',
      weatherCode: 61,
      temp: 14,
      precipProb: 65,
      windSpeed: 21,
      windGust: 30,
      windDir: 225,
      feelsLike: 13,
      humidity: 88,
      cloudCover: 95,
    });
  });

  it('falls back detail fields to their base equivalents when Open-Meteo omits them', async () => {
    // Older/partial responses (or a future API change) might not include the
    // detail fields - fetchWeather should still return a usable entry rather
    // than NaN/undefined creeping into the UI.
    const partial = {
      hourly: {
        time: ['2025-05-04T00:00'],
        weather_code: [1],
        temperature_2m: [9.6],
        precipitation_probability: [0],
        wind_speed_10m: [8.2],
      },
    };
    global.fetch.mockResolvedValueOnce({ok: true, json: () => Promise.resolve(partial)});

    const result = await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');

    expect(result.hourly[0]).toEqual({
      time: '2025-05-04T00:00',
      weatherCode: 1,
      temp: 10,
      precipProb: 0,
      windSpeed: 8,
      windGust: 8, // falls back to windSpeed
      windDir: 0,
      feelsLike: 10, // falls back to temp
      humidity: 0,
      cloudCover: 0,
    });
  });

  it('requests hourly fields only (no daily summary) in the API call', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });

    await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('hourly=weather_code,temperature_2m,precipitation_probability,wind_speed_10m');
    expect(url).not.toContain('daily=');
  });

  it('returns null when fetch response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({ok: false});
    const result = await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
    const result = await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');
    expect(result).toBeNull();
  });

  it('returns null when response has no hourly.time', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({hourly: {}}),
    });
    const result = await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');
    expect(result).toBeNull();
  });
});
