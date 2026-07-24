import {parseArticle, formatDate, formatFullDate, decodeEntities, stripHtml, parseCalendar, parseGrid, parseStandings, parseResults, parseDriverHistory, attachTeamDisplayFields} from '../src/api/parsers';

// Must be declared before any import so Jest hoists it above the require()
// inside parsers.js. Venue names are synthetic to prevent tests passing by
// coincidence against real track data.
jest.mock('../data/tracks.json', () => ({
  'Test Track': {
    location: 'Testville, England',
    country: 'England',
    lat: 51.5,
    lng: -1.2,
    lengthMiles: '2.000 mi',
    lengthKm: '3.219 km',
    corners: 12,
    cornersLeft: 5,
    cornersRight: 7,
    about: 'A test circuit.',
    btccFact: 'First BTCC race in 2000.',
    imageUrl: 'https://example.com/track.jpg',
    layoutImageUrl: 'https://example.com/layout.jpg',
    raceImages: ['https://example.com/race.jpg'],
    firstBtccYear: 2000,
    trackGuide: [
      {
        sector: 'Sector 1',
        corners: [
          {number: 'T1', name: 'The Hairpin', overtaking: true, description: 'Tight corner.'},
        ],
      },
    ],
    lapPreviewUrl: 'https://www.youtube.com/watch?v=preview123',
  },
  'No Preview Track': {
    location: 'Somewhere, England',
    country: 'England',
    lat: 52.0,
    lng: -1.0,
    lengthMiles: '1.500 mi',
    lengthKm: '2.414 km',
    corners: 8,
    cornersLeft: 4,
    cornersRight: 4,
    about: 'Another circuit.',
    btccFact: '',
    imageUrl: null,
    layoutImageUrl: null,
    raceImages: [],
    firstBtccYear: null,
    trackGuide: [],
    lapPreviewUrl: null,
  },
}));

describe('decodeEntities', () => {
  test('decodes HTML entities', () => {
    expect(decodeEntities('&amp; &lt; &gt; &quot;')).toBe('& < > "');
    expect(decodeEntities('&#039;')).toBe("'");
    expect(decodeEntities('&#8217;')).toBe('\u2019');
    expect(decodeEntities('&hellip;')).toBe('\u2026');
    expect(decodeEntities('&nbsp;')).toBe(' ');
  });
});

describe('stripHtml', () => {
  test('removes HTML tags and decodes entities', () => {
    expect(stripHtml('<p>Hello &amp; world</p>')).toBe('Hello & world');
    expect(stripHtml('<b>Bold</b> <i>italic</i>')).toBe('Bold italic');
  });
});

describe('formatDate', () => {
  test('formats ISO date to readable format', () => {
    const result = formatDate('2026-04-03T10:00:00');
    expect(result).toMatch(/3 Apr 2026/);
  });

  test('returns empty string on invalid date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  test('returns empty string for empty input', () => {
    expect(formatDate('')).toBe('');
  });

  test('returns empty string for null/undefined', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('formatFullDate', () => {
  test('formats to ordinal-day, full-month, date-only', () => {
    expect(formatFullDate('2026-07-20T08:00:00')).toBe('20th July 2026');
  });

  test('uses st/nd/rd/th suffixes correctly, including the 11th-13th exception', () => {
    expect(formatFullDate('2026-07-01')).toBe('1st July 2026');
    expect(formatFullDate('2026-07-02')).toBe('2nd July 2026');
    expect(formatFullDate('2026-07-03')).toBe('3rd July 2026');
    expect(formatFullDate('2026-07-11')).toBe('11th July 2026');
    expect(formatFullDate('2026-07-12')).toBe('12th July 2026');
    expect(formatFullDate('2026-07-13')).toBe('13th July 2026');
    expect(formatFullDate('2026-07-21')).toBe('21st July 2026');
  });

  test('drops the time component entirely', () => {
    expect(formatFullDate('2026-07-20T23:45:00')).not.toMatch(/\d{2}:\d{2}/);
  });

  test('returns empty string on invalid or missing input', () => {
    expect(formatFullDate('not-a-date')).toBe('');
    expect(formatFullDate('')).toBe('');
    expect(formatFullDate(null)).toBe('');
    expect(formatFullDate(undefined)).toBe('');
  });
});

describe('parseArticle', () => {
  test('parses WordPress post object', () => {
    const post = {
      id: 123,
      title: {rendered: 'Test &amp; Title'},
      link: 'https://btcc.net/test',
      excerpt: {rendered: '<p>Excerpt text</p>'},
      content: {rendered: '<p>Content</p>'},
      date: '2026-04-01T12:00:00',
      _embedded: {
        'wp:featuredmedia': [{source_url: 'https://img.jpg'}],
        'wp:term': [[{name: 'News'}]],
      },
    };
    const article = parseArticle(post);
    expect(article.id).toBe(123);
    expect(article.title).toBe('Test & Title');
    expect(article.imageUrl).toBe('https://img.jpg');
    expect(article.category).toBe('News');
    expect(article.description).toBe('Excerpt text');
  });
});

describe('parseCalendar', () => {
  // ── Season-level fields ───────────────────────────────────────────────────────

  test('passes seasonStartDate and liveTimingEnabled through', () => {
    const json = {seasonStartDate: '2027-04-10', liveTimingEnabled: false, rounds: []};
    const cal = parseCalendar(json);
    expect(cal.seasonStartDate).toBe('2027-04-10');
    expect(cal.liveTimingEnabled).toBe(false);
  });

  test('defaults liveTimingEnabled to true when absent', () => {
    const json = {rounds: []};
    expect(parseCalendar(json).liveTimingEnabled).toBe(true);
  });

  test('defaults seasonStartDate when absent', () => {
    const json = {rounds: []};
    expect(typeof parseCalendar(json).seasonStartDate).toBe('string');
  });

  // ── Static venue fields come from tracks.json, not round data ─────────────────

  test('merges static venue fields from tracks.json by venue name', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track', startDate: '2027-04-10', endDate: '2027-04-11'}]};
    const r = parseCalendar(json).rounds[0];
    expect(r.location).toBe('Testville, England');
    expect(r.country).toBe('England');
    expect(r.lat).toBe(51.5);
    expect(r.lng).toBe(-1.2);
    expect(r.lengthMiles).toBe('2.000 mi');
    expect(r.lengthKm).toBe('3.219 km');
    expect(r.corners).toBe(12);
    expect(r.cornersLeft).toBe(5);
    expect(r.cornersRight).toBe(7);
    expect(r.about).toBe('A test circuit.');
    expect(r.btccFact).toBe('First BTCC race in 2000.');
    expect(r.imageUrl).toBe('https://example.com/track.jpg');
    expect(r.layoutImageUrl).toBe('https://example.com/layout.jpg');
    expect(r.raceImages).toEqual(['https://example.com/race.jpg']);
    expect(r.firstBtccYear).toBe(2000);
  });

  test('does not use any static fields from round data (they are ignored)', () => {
    // Even if these keys appear in the calendar JSON they must be ignored -
    // tracks.json is the single source of truth for venue-invariant data.
    const json = {rounds: [{
      round: 1,
      venue: 'Test Track',
      location: 'WRONG VALUE',
      corners: 999,
      about: 'WRONG VALUE',
    }]};
    const r = parseCalendar(json).rounds[0];
    expect(r.location).toBe('Testville, England');
    expect(r.corners).toBe(12);
    expect(r.about).toBe('A test circuit.');
  });

  test('unknown venue produces empty/zero defaults for all static fields', () => {
    const json = {rounds: [{round: 1, venue: 'Unknown Venue'}]};
    const r = parseCalendar(json).rounds[0];
    expect(r.location).toBe('');
    expect(r.country).toBe('');
    expect(r.lat).toBe(0);
    expect(r.lng).toBe(0);
    expect(r.lengthMiles).toBe('');
    expect(r.corners).toBe(0);
    expect(r.cornersLeft).toBeNull();
    expect(r.cornersRight).toBeNull();
    expect(r.about).toBe('');
    expect(r.btccFact).toBe('');
    expect(r.imageUrl).toBe('');
    expect(r.layoutImageUrl).toBe('');
    expect(r.raceImages).toEqual([]);
    expect(r.firstBtccYear).toBeNull();
    expect(r.trackGuide).toEqual([]);
    expect(r.lapPreviewUrl).toBeNull();
  });

  // ── lapPreviewUrl ─────────────────────────────────────────────────────────────

  test('lapPreviewUrl is populated from tracks.json when present', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track'}]};
    expect(parseCalendar(json).rounds[0].lapPreviewUrl).toBe('https://www.youtube.com/watch?v=preview123');
  });

  test('lapPreviewUrl is null when tracks.json has no preview for the venue', () => {
    const json = {rounds: [{round: 1, venue: 'No Preview Track'}]};
    expect(parseCalendar(json).rounds[0].lapPreviewUrl).toBeNull();
  });

  test('lapPreviewUrl is null for unknown venues', () => {
    const json = {rounds: [{round: 1, venue: 'Unknown Venue'}]};
    expect(parseCalendar(json).rounds[0].lapPreviewUrl).toBeNull();
  });

  // ── trackGuide mapping ────────────────────────────────────────────────────────

  test('maps trackGuide sector field to name', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track'}]};
    const guide = parseCalendar(json).rounds[0].trackGuide;
    expect(guide).toHaveLength(1);
    expect(guide[0].name).toBe('Sector 1');
    expect(guide[0].corners).toHaveLength(1);
    expect(guide[0].corners[0].name).toBe('The Hairpin');
    expect(guide[0].corners[0].overtaking).toBe(true);
    expect(guide[0].corners[0].description).toBe('Tight corner.');
  });

  test('produces empty trackGuide array for venues with no guide', () => {
    const json = {rounds: [{round: 1, venue: 'No Preview Track'}]};
    expect(parseCalendar(json).rounds[0].trackGuide).toEqual([]);
  });

  // ── Year-specific fields come from round data ─────────────────────────────────

  test('startDate and endDate come from round data', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track', startDate: '2027-04-10', endDate: '2027-04-11'}]};
    const r = parseCalendar(json).rounds[0];
    expect(r.startDate).toBe('2027-04-10');
    expect(r.endDate).toBe('2027-04-11');
  });

  test('qualifyingRecord and raceRecord come from round data', () => {
    const qualRec = {driver: 'Ash Sutton', time: '1:07.570', year: 2023};
    const raceRec = {driver: 'Ash Sutton', time: '1:08.011', year: 2025};
    const json = {rounds: [{round: 1, venue: 'Test Track', qualifyingRecord: qualRec, raceRecord: raceRec}]};
    const r = parseCalendar(json).rounds[0];
    expect(r.qualifyingRecord).toEqual(qualRec);
    expect(r.raceRecord).toEqual(raceRec);
  });

  test('qualifyingRecord and raceRecord are null when absent', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track'}]};
    const r = parseCalendar(json).rounds[0];
    expect(r.qualifyingRecord).toBeNull();
    expect(r.raceRecord).toBeNull();
  });

  test('youtubeUrls comes from round data (race highlights only, no lap preview)', () => {
    const urls = ['https://youtu.be/r1', 'https://youtu.be/r2', 'https://youtu.be/r3'];
    const json = {rounds: [{round: 1, venue: 'Test Track', youtubeUrls: urls}]};
    expect(parseCalendar(json).rounds[0].youtubeUrls).toEqual(urls);
  });

  test('youtubeUrls defaults to empty array when absent', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track'}]};
    expect(parseCalendar(json).rounds[0].youtubeUrls).toEqual([]);
  });

  test('sessions are mapped from round data', () => {
    const json = {rounds: [{
      round: 1,
      venue: 'Test Track',
      sessions: [
        {name: 'Free Practice', day: 'SAT', time: '09:15'},
        {name: 'Qualifying', day: 'SAT', time: '11:30'},
        {name: 'Race 1', day: 'SUN', time: '11:05'},
      ],
    }]};
    const sessions = parseCalendar(json).rounds[0].sessions;
    expect(sessions).toHaveLength(3);
    expect(sessions[0]).toEqual({name: 'Free Practice', day: 'SAT', time: '09:15'});
    expect(sessions[2]).toEqual({name: 'Race 1', day: 'SUN', time: '11:05'});
  });

  test('sessions defaults to empty array when absent', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track'}]};
    expect(parseCalendar(json).rounds[0].sessions).toEqual([]);
  });

  test('round defaults to index + 1 when not specified', () => {
    const json = {rounds: [{venue: 'Test Track'}, {venue: 'No Preview Track'}]};
    const rounds = parseCalendar(json).rounds;
    expect(rounds[0].round).toBe(1);
    expect(rounds[1].round).toBe(2);
  });

  test('tslEventId defaults to 0 when absent', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track'}]};
    expect(parseCalendar(json).rounds[0].tslEventId).toBe(0);
  });

  // ── fullTimetable ──────────────────────────────────────────────────────────────

  test('parses fullTimetable entries preserving all fields', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track', fullTimetable: [
      {day: 'SAT', time: '09:00', endTime: '09:30', series: 'Mini Challenge', session: 'Qualifying', laps: null},
      {day: 'SAT', time: '11:40', series: 'Scottish Legends Championship', session: 'Race', laps: '6'},
      {day: 'SUN', time: '12:25', series: 'Kwik Fit British Touring Car Championship', session: 'Race 1', laps: '15'},
    ]}]};
    const ft = parseCalendar(json).rounds[0].fullTimetable;
    expect(ft).toHaveLength(3);
    expect(ft[0]).toEqual({day: 'SAT', time: '09:00', endTime: '09:30', series: 'Mini Challenge', session: 'Qualifying', laps: null});
    expect(ft[1]).toEqual({day: 'SAT', time: '11:40', endTime: null, series: 'Scottish Legends Championship', session: 'Race', laps: '6'});
    expect(ft[2]).toEqual({day: 'SUN', time: '12:25', endTime: null, series: 'Kwik Fit British Touring Car Championship', session: 'Race 1', laps: '15'});
  });

  test('parses fullTimetable null-series event rows', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track', fullTimetable: [
      {day: 'SUN', time: '10:30', endTime: '11:05', series: null, session: 'Pit Lane Walkabout', laps: null},
    ]}]};
    const ft = parseCalendar(json).rounds[0].fullTimetable;
    expect(ft[0].series).toBeNull();
    expect(ft[0].session).toBe('Pit Lane Walkabout');
  });

  test('fullTimetable defaults to empty array when absent', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track'}]};
    expect(parseCalendar(json).rounds[0].fullTimetable).toEqual([]);
  });

  test('fullTimetable endTime defaults to null when absent from entry', () => {
    const json = {rounds: [{round: 1, venue: 'Test Track', fullTimetable: [
      {day: 'SAT', time: '11:40', series: 'Scottish Legends Championship', session: 'Race', laps: '6'},
    ]}]};
    expect(parseCalendar(json).rounds[0].fullTimetable[0].endTime).toBeNull();
  });

  test('parses multiple rounds independently', () => {
    const json = {rounds: [
      {round: 1, venue: 'Test Track',      startDate: '2027-04-10', endDate: '2027-04-11'},
      {round: 2, venue: 'No Preview Track', startDate: '2027-05-08', endDate: '2027-05-09'},
    ]};
    const rounds = parseCalendar(json).rounds;
    expect(rounds).toHaveLength(2);
    expect(rounds[0].corners).toBe(12);
    expect(rounds[1].corners).toBe(8);
    expect(rounds[0].lapPreviewUrl).toBe('https://www.youtube.com/watch?v=preview123');
    expect(rounds[1].lapPreviewUrl).toBeNull();
  });
});

describe('parseGrid', () => {
  test('parses drivers and teams', () => {
    const json = {
      drivers: [
        {number: 80, name: 'Tom Ingram', team: 'Team Vertu', car: 'Hyundai', imageUrl: '', nationality: 'British'},
      ],
      teams: [
        {name: 'Team Vertu', car: 'Hyundai', entries: 2},
      ],
    };
    const grid = parseGrid(json);
    expect(grid.drivers).toHaveLength(1);
    expect(grid.drivers[0].name).toBe('Tom Ingram');
    expect(grid.teams).toHaveLength(1);
    expect(grid.teams[0].drivers).toHaveLength(1);
  });

  test('passes through livesIn, defaults to empty string when absent', () => {
    const json = {
      drivers: [
        {number: 54, name: 'Ryan Bensley', team: 'Speedworks', car: 'Toyota', livesIn: 'Kings Lynn'},
        {number: 2, name: 'No Lives In', team: 'Speedworks', car: 'Toyota'},
      ],
      teams: [{name: 'Speedworks', car: 'Toyota', entries: 2}],
    };
    const grid = parseGrid(json);
    expect(grid.drivers.find(d => d.name === 'Ryan Bensley').livesIn).toBe('Kings Lynn');
    expect(grid.drivers.find(d => d.name === 'No Lives In').livesIn).toBe('');
  });

  test('filters drivers without team', () => {
    const json = {
      drivers: [
        {number: 1, name: 'No Team', team: '', car: ''},
        {number: 2, name: 'Has Team', team: 'Racing', car: 'Car'},
      ],
      teams: [],
    };
    const grid = parseGrid(json);
    expect(grid.drivers).toHaveLength(1);
    expect(grid.drivers[0].name).toBe('Has Team');
  });

  test('passes through totalRaces, totalWins, history and carSpecs', () => {
    const specs = {Engine: '350+bhp', Drive: 'FWD'};
    const json = {
      drivers: [],
      teams: [
        {name: 'Team A', car: 'Car', entries: 1, totalRaces: 81, totalWins: 12, history: [{year: 2024, pos: 1}], carSpecs: specs},
      ],
    };
    const grid = parseGrid(json);
    expect(grid.teams[0].totalRaces).toBe(81);
    expect(grid.teams[0].totalWins).toBe(12);
    expect(grid.teams[0].history).toEqual([{year: 2024, pos: 1}]);
    expect(grid.teams[0].carSpecs).toEqual(specs);
  });

  test('defaults totalRaces and totalWins to 0 when absent', () => {
    const json = {
      drivers: [],
      teams: [{name: 'Team B', car: 'Car', entries: 1}],
    };
    const grid = parseGrid(json);
    expect(grid.teams[0].totalRaces).toBe(0);
    expect(grid.teams[0].totalWins).toBe(0);
    expect(grid.teams[0].carSpecs).toBeNull();
  });

  test('shapes driver history: champion renamed to isChampion, numeric fields defaulted', () => {
    const json = {
      drivers: [{
        number: 1, name: 'A Driver', team: 'Team A', car: 'Car',
        history: [
          {year: 2016, team: 'Old Team', car: 'Old Car', pos: 1, points: 308, wins: 4, podiums: 10, poles: 4, fastestLaps: 3, champion: true},
          {year: 2017, team: 'Old Team', car: 'Old Car'}, // no stats at all - must default, not crash
        ],
      }],
      teams: [{name: 'Team A', car: 'Car', entries: 1}],
    };
    const [driver] = parseGrid(json).drivers;
    expect(driver.history[0]).toEqual({
      year: 2016, team: 'Old Team', car: 'Old Car', pos: 1, points: 308,
      wins: 4, podiums: 10, poles: 4, fastestLaps: 3, dnfs: 0, isChampion: true,
    });
    expect(driver.history[1]).toEqual({
      year: 2017, team: 'Old Team', car: 'Old Car', pos: 0, points: 0,
      wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, isChampion: false,
    });
  });
});

describe('parseDriverHistory', () => {
  test('renames champion to isChampion and defaults every numeric field', () => {
    const shaped = parseDriverHistory([{year: 2020, champion: true}]);
    expect(shaped).toEqual([{
      year: 2020, team: '', car: '', pos: 0, points: 0, wins: 0,
      podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, isChampion: true,
    }]);
  });

  test('returns an empty array for null/undefined input', () => {
    expect(parseDriverHistory(null)).toEqual([]);
    expect(parseDriverHistory(undefined)).toEqual([]);
  });
});

describe('attachTeamDisplayFields', () => {
  const rawTeams = [
    {name: 'WSR', cardBgUrl: 'https://example.com/wsr.png', lightCardBg: true},
    {name: 'Restart Racing', cardBgUrl: 'https://example.com/restart.png', lightCardBg: false},
  ];

  test('attaches cls from raw `class`, and cardBgUrl/lightCardBg from the matching team', () => {
    const raw = {name: 'A Driver', team: 'WSR', class: 'I'};
    const shaped = attachTeamDisplayFields(raw, rawTeams);
    expect(shaped.cls).toBe('I');
    expect(shaped.cardBgUrl).toBe('https://example.com/wsr.png');
    expect(shaped.lightCardBg).toBe(true);
  });

  test('preserves an already-shaped `cls` field rather than requiring raw `class`', () => {
    const shaped = attachTeamDisplayFields({name: 'A Driver', team: 'Restart Racing', cls: 'M'}, rawTeams);
    expect(shaped.cls).toBe('M');
    expect(shaped.lightCardBg).toBe(false);
  });

  test('defaults to empty/false when the driver has no matching team', () => {
    const shaped = attachTeamDisplayFields({name: 'A Driver', team: 'Unknown Team'}, rawTeams);
    expect(shaped.cls).toBe('');
    expect(shaped.cardBgUrl).toBe('');
    expect(shaped.lightCardBg).toBe(false);
  });

  test('is what closes the deep-link dual-shape bug: raw driver + raw teams produces the same display fields parseGrid() would', () => {
    const json = {
      drivers: [{number: 1, name: 'A Driver', team: 'WSR', car: 'Car', class: 'I'}],
      teams: rawTeams,
    };
    const viaParseGrid = parseGrid(json).drivers[0];
    const viaDeepLink = attachTeamDisplayFields(json.drivers[0], json.teams);
    expect(viaDeepLink.cls).toBe(viaParseGrid.cls);
    expect(viaDeepLink.cardBgUrl).toBe(viaParseGrid.cardBgUrl);
    expect(viaDeepLink.lightCardBg).toBe(viaParseGrid.lightCardBg);
  });
});

describe('parseStandings', () => {
  test('parses standings JSON', () => {
    const json = {
      season: '2026',
      round: 3,
      standings: [{pos: 1, driver: 'Ingram', team: 'Vertu', points: 100}],
      teams: [{pos: 1, team: 'Vertu', points: 150}],
    };
    const s = parseStandings(json);
    expect(s.round).toBe(3);
    expect(s.drivers).toHaveLength(1);
    expect(s.drivers[0].points).toBe(100);
    expect(s.teams).toHaveLength(1);
  });
});

describe('parseResults', () => {
  test('passes scraper-provided points through unchanged', () => {
    // The scraper bakes FL/leadLap bonuses into points before writing the JSON.
    // parsers.js must not add them again — just pass rawPts through.
    const json = {
      rounds: [{
        round: 1,
        venue: 'Donington',
        date: '18 Apr 2026',
        races: [{
          label: 'Race 1',
          results: [
            // 22 = scraper-provided total (20 base + FL + leadLap already included)
            {pos: 1, no: 80, driver: 'Ingram', team: 'Vertu', laps: 20, time: '30:00', points: 22, fastestLap: true, leadLap: true},
            {pos: 2, no: 3, driver: 'Chilton', team: 'Vertu', laps: 20, time: '', gap: '+1.5', points: 17},
          ],
        }],
      }],
    };
    const rounds = parseResults(json);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].races[0].results[0].points).toBe(22); // passed through as-is
    expect(rounds[0].races[0].results[0].fastestLap).toBe(true);
    expect(rounds[0].races[0].results[1].points).toBe(17);
  });

  test('computes points when not provided', () => {
    const json = {
      rounds: [{
        round: 1,
        venue: 'Test',
        races: [{
          label: 'Race 1',
          results: [
            {pos: 1, no: 1, driver: 'A', team: 'T', laps: 10, time: '20:00'},
          ],
        }],
      }],
    };
    const rounds = parseResults(json);
    // P1 = 20 points base
    expect(rounds[0].races[0].results[0].points).toBe(20);
  });

  test('computes qualifying race points', () => {
    const json = {
      rounds: [{
        round: 1,
        venue: 'Test',
        races: [{
          label: 'Qualifying Race',
          results: [
            {pos: 1, no: 1, driver: 'A', team: 'T', laps: 10, time: '20:00'},
          ],
        }],
      }],
    };
    const rounds = parseResults(json);
    // QR P1 = 10 points
    expect(rounds[0].races[0].results[0].points).toBe(10);
  });

  test('QR results have fastestLap, leadLap and pole stripped (reg 1.6.2.a)', () => {
    const json = {
      rounds: [{
        round: 1,
        venue: 'Test',
        races: [{
          label: 'Qualifying Race',
          results: [{
            pos: 1, no: 1, driver: 'A', team: 'T', laps: 10, time: '20:00',
            fastestLap: true, leadLap: true, pole: true,
          }],
        }],
      }],
    };
    const result = parseResults(json)[0].races[0].results[0];
    expect(result.fastestLap).toBe(false);
    expect(result.leadLap).toBe(false);
    expect(result.pole).toBe(false);
  });

  test('pole flag is informational only and does not add championship points', () => {
    // Verified against official TSL standings: pole bonus is not a separate
    // points addition in the results data - standings match without it.
    const mkRace = (label) => ({
      label,
      results: [{pos: 1, no: 1, driver: 'A', team: 'T', laps: 10, time: '20:00', pole: true}],
    });
    const json = {rounds: [{round: 1, venue: 'Test', races: [mkRace('Race 1'), mkRace('Race 2'), mkRace('Race 3')]}]};
    const [round] = parseResults(json);
    expect(round.races[0].results[0].points).toBe(20); // P1 base only, no pole bonus
    expect(round.races[1].results[0].points).toBe(20);
    expect(round.races[2].results[0].points).toBe(20);
    expect(round.races[0].results[0].pole).toBe(true); // flag preserved for display
  });

  test('DNF driver with pole and leadLap flags scores 0 points', () => {
    // Regression: Tom Ingram R1 Race 1 DNF had leadLap:true causing a phantom +1
    const json = {
      rounds: [{
        round: 1,
        venue: 'Test',
        races: [{
          label: 'Race 1',
          results: [{pos: 0, no: 80, driver: 'Ingram', team: 'Vertu', laps: 0, time: '', points: 0, pole: true, leadLap: true}],
        }],
      }],
    };
    const result = parseResults(json)[0].races[0].results[0];
    expect(result.points).toBe(0);
    expect(result.pole).toBe(true);   // flag preserved for display
    expect(result.leadLap).toBe(true);
  });

  test('reverseGridDraw is passed through when set and defaults to null', () => {
    const json = {
      rounds: [{
        round: 1,
        venue: 'Test',
        races: [
          {label: 'Race 3', reverseGridDraw: 11, results: [], grid: []},
          {label: 'Race 2', results: [], grid: []},
        ],
      }],
    };
    const [round] = parseResults(json);
    const r3 = round.races.find(r => r.label === 'Race 3');
    const r2 = round.races.find(r => r.label === 'Race 2');
    expect(r3.reverseGridDraw).toBe(11);
    expect(r2.reverseGridDraw).toBeNull();
  });

  test('DQ status field is passed through from raw result', () => {
    const json = {
      rounds: [{
        round: 1,
        venue: 'Test',
        races: [{
          label: 'Race 1',
          results: [{pos: 0, no: 80, driver: 'Ingram', team: 'Vertu', laps: 0, time: '', points: 0, status: 'DQ'}],
        }],
      }],
    };
    const result = parseResults(json)[0].races[0].results[0];
    expect(result.status).toBe('DQ');
    expect(result.points).toBe(0);
  });

  test('regular race results preserve fastestLap, leadLap and pole flags', () => {
    const json = {
      rounds: [{
        round: 1,
        venue: 'Test',
        races: [{
          label: 'Race 1',
          results: [{
            pos: 1, no: 1, driver: 'A', team: 'T', laps: 10, time: '20:00',
            fastestLap: true, leadLap: true, pole: true,
          }],
        }],
      }],
    };
    const result = parseResults(json)[0].races[0].results[0];
    expect(result.fastestLap).toBe(true);
    expect(result.leadLap).toBe(true);
    expect(result.pole).toBe(true);
  });
});

describe('parseStandings', () => {
  test('returns jst and independentsTeams arrays', () => {
    const json = {
      season: '2026',
      round: 3,
      standings: [],
      teams: [],
      jst: [{pos: 1, driver: 'Dexter PATTERSON', team: 'Steel Seal', points: 60, wins: 0, seconds: 1, thirds: 0}],
      independentsTeams: [{pos: 1, team: 'LKQ Euro Car Parts', points: 57}],
    };
    const s = parseStandings(json);
    expect(s.jst).toHaveLength(1);
    expect(s.jst[0].name).toBe('Dexter PATTERSON');
    expect(s.jst[0].points).toBe(60);
    expect(s.independentsTeams).toHaveLength(1);
    expect(s.independentsTeams[0].name).toBe('LKQ Euro Car Parts');
  });

  test('driver entries include nat field', () => {
    const json = {
      season: '2026',
      round: 1,
      standings: [{pos: 1, driver: 'Ashley SUTTON', team: 'NAPA Racing UK', points: 71, nat: 'GBR'}],
      teams: [],
    };
    const s = parseStandings(json);
    expect(s.drivers[0].nat).toBe('GBR');
  });

  test('returns empty jst and independentsTeams when absent', () => {
    const json = {season: '2026', round: 0, standings: [], teams: []};
    const s = parseStandings(json);
    expect(s.jst).toEqual([]);
    expect(s.independentsTeams).toEqual([]);
  });
});
