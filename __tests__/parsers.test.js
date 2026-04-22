import {parseArticle, formatDate, decodeEntities, stripHtml, parseCalendar, parseGrid, parseStandings, parseResults} from '../src/api/parsers';

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
  test('parses calendar JSON', () => {
    const json = {
      seasonStartDate: '2026-04-18',
      liveTimingEnabled: true,
      rounds: [{
        round: 1,
        venue: 'Donington Park',
        startDate: '2026-04-18',
        endDate: '2026-04-19',
        location: 'Castle Donington',
        corners: 10,
      }],
    };
    const cal = parseCalendar(json);
    expect(cal.seasonStartDate).toBe('2026-04-18');
    expect(cal.rounds).toHaveLength(1);
    expect(cal.rounds[0].venue).toBe('Donington Park');
    expect(cal.rounds[0].corners).toBe(10);
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
  test('parses results with explicit points', () => {
    const json = {
      rounds: [{
        round: 1,
        venue: 'Donington',
        date: '18 Apr 2026',
        races: [{
          label: 'Race 1',
          results: [
            {pos: 1, no: 80, driver: 'Ingram', team: 'Vertu', laps: 20, time: '30:00', points: 22, fastestLap: true, leadLap: true},
            {pos: 2, no: 3, driver: 'Chilton', team: 'Vertu', laps: 20, time: '', gap: '+1.5', points: 17},
          ],
        }],
      }],
    };
    const rounds = parseResults(json);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].races[0].results[0].points).toBe(22);
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
});
