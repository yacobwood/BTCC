import {
  weatherDescription,
  weatherIcon,
  weatherIconColor,
  fetchWeather,
} from '../../src/utils/weather';

// ── weatherDescription ─────────────────────────────────────────────────────────
describe('weatherDescription', () => {
  it('returns "Clear sky" for code 0', () => {
    expect(weatherDescription(0)).toBe('Clear sky');
  });

  it('returns "Overcast" for code 3', () => {
    expect(weatherDescription(3)).toBe('Overcast');
  });

  it('returns "Rain" for code 63', () => {
    expect(weatherDescription(63)).toBe('Rain');
  });

  it('returns "Heavy snow" for code 75', () => {
    expect(weatherDescription(75)).toBe('Heavy snow');
  });

  it('returns "Thunderstorm" for code 95', () => {
    expect(weatherDescription(95)).toBe('Thunderstorm');
  });

  it('returns "Unknown" for an unrecognised code', () => {
    expect(weatherDescription(999)).toBe('Unknown');
  });
});

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

// ── fetchWeather ───────────────────────────────────────────────────────────────
const MOCK_RESPONSE = {
  daily: {
    time: ['2025-05-04', '2025-05-05'],
    weather_code: [1, 61],
    temperature_2m_max: [18.4, 14.1],
    temperature_2m_min: [10.2, 9.8],
    precipitation_probability_max: [5, 70],
    wind_speed_10m_max: [12.3, 22.7],
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

  it('returns null when the event is more than 16 days away', async () => {
    const result = await fetchWeather(52.07, -1.02, '2025-05-15', '2025-05-17');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns mapped forecast data for a date within range', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });

    const result = await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: '2025-05-04',
      weatherCode: 1,
      tempMax: 18,
      tempMin: 10,
      precipProb: 5,
      windMax: 12,
    });
    expect(result[1]).toEqual({
      date: '2025-05-05',
      weatherCode: 61,
      tempMax: 14,
      tempMin: 10,
      precipProb: 70,
      windMax: 23,
    });
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

  it('returns null when response has no daily.time', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({daily: {}}),
    });
    const result = await fetchWeather(52.07, -1.02, '2025-05-04', '2025-05-05');
    expect(result).toBeNull();
  });
});
