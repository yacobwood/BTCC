const BUNDLED_TRACKS = require('../../data/tracks.json');

// Rewrite a btcc.net image URL to a smaller WordPress-generated thumbnail
export function thumbUrl(url, size = '150x150') {
  if (!url || !url.includes('btcc.net/wp-content/uploads/')) return url;
  return url.replace(/(\.[a-z]+)$/i, `-${size}$1`);
}

// Parse WordPress post into Article
export function parseArticle(post) {
  const id = post.id;
  const title = decodeEntities(post.title?.rendered || '');
  const link = post.link || '';
  const description = stripHtml(post.excerpt?.rendered || '');
  const content = post.content?.rendered || '';
  const sortDate = post.date || '';
  const pubDate = formatDate(sortDate);
  const embedded = post._embedded;
  const imageUrl = extractFeaturedImage(embedded, content);
  const category = extractCategory(embedded);
  return {id, title, link, description, pubDate, sortDate, imageUrl, category, content, source: 'btcc.net'};
}

function extractFeaturedImage(embedded, content = '') {
  const media = embedded?.['wp:featuredmedia']?.[0]?.source_url;
  if (media) return media;
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractCategory(embedded) {
  return embedded?.['wp:term']?.[0]?.[0]?.name || '';
}

export function formatDate(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  } catch {
    return '';
  }
}

export function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&nbsp;/g, ' ');
}

export function stripHtml(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).trim();
}

// Parse calendar JSON
export function parseCalendar(json) {
  const rounds = (json.rounds || []).map((r, i) => {
    const venue = r.venue || '';
    const t = BUNDLED_TRACKS[venue] || {};
    return {
      round: r.round || i + 1,
      venue,
      startDate: r.startDate || '',
      endDate: r.endDate || '',
      tslEventId: r.tslEventId || 0,
      // Static venue data merged from tracks.json
      location: t.location || '',
      country: t.country || '',
      lat: t.lat || 0,
      lng: t.lng || 0,
      lengthMiles: t.lengthMiles || '',
      lengthKm: t.lengthKm || '',
      corners: t.corners || 0,
      cornersLeft: t.cornersLeft ?? null,
      cornersRight: t.cornersRight ?? null,
      about: t.about || '',
      btccFact: t.btccFact || '',
      imageUrl: t.imageUrl || '',
      layoutImageUrl: t.layoutImageUrl || '',
      raceImages: t.raceImages || [],
      lapPreviewUrl: t.lapPreviewUrl || null,
      firstBtccYear: t.firstBtccYear || null,
      trackGuide: (t.trackGuide || []).map(s => ({
        name: s.sector || '',
        corners: (s.corners || []).map(c => ({
          number: c.number || '',
          name: c.name || '',
          description: c.description || '',
          overtaking: c.overtaking || false,
        })),
      })),
      // Year-specific data from the calendar file
      liveUrl: r.liveUrl || null,
      qualifyingRecord: r.qualifyingRecord || null,
      raceRecord: r.raceRecord || null,
      youtubeUrls: r.youtubeUrls || [],
      sessions: (r.sessions || []).map(s => ({
        name: s.name || '',
        day: s.day || '',
        time: s.time || '',
      })),
      fullTimetable: (r.fullTimetable || []).map(s => ({
        day: s.day || '',
        time: s.time || '',
        endTime: s.endTime || null,
        series: s.series || null,
        session: s.session || '',
        laps: s.laps || null,
      })),
    };
  });
  return {
    seasonStartDate: json.seasonStartDate || '2026-04-18',
    liveTimingEnabled: json.liveTimingEnabled !== false,
    rounds,
  };
}

// Shapes one raw driver-history entry into the app's field names/defaults
// (champion -> isChampion, numeric defaults). Shared by parseGrid() and any
// single-driver lookup that bypasses it (e.g. DriverDetailScreen's deep-link
// path, which reads raw JSON directly).
export function parseDriverHistory(history) {
  return (history || []).map(h => ({
    year: h.year,
    team: h.team || '',
    car: h.car || '',
    pos: h.pos || 0,
    points: h.points || 0,
    wins: h.wins || 0,
    podiums: h.podiums || 0,
    poles: h.poles || 0,
    fastestLaps: h.fastestLaps || 0,
    dnfs: h.dnfs || 0,
    isChampion: h.champion || false,
  }));
}

// Attaches the display fields that depend on cross-referencing a driver's
// team against the (raw) teams array - cls (Independents/Main chip),
// cardBgUrl/lightCardBg (header background + number text color). Exported so
// a single driver reached outside the full-roster parse (e.g.
// DriverDetailScreen's deep-link lookup, which reads raw JSON directly) can
// still get the same display fields as one reached via parseGrid() - without
// this, those profiles silently lost the class chip, champion gold styling
// and header background image.
export function attachTeamDisplayFields(driver, rawTeams) {
  const team = (rawTeams || []).find(t => t.name === driver.team);
  const {class: rawClass, ...rest} = driver; // `class` is raw-shape only; output uses `cls`
  return {
    ...rest,
    cls: driver.cls || rawClass || '',
    cardBgUrl: team?.cardBgUrl || '',
    lightCardBg: team?.lightCardBg || false,
  };
}

// Parse drivers JSON
export function parseGrid(json) {
  const rawTeams = json.teams || [];
  const drivers = (json.drivers || [])
    .filter(d => d.team && d.team.trim())
    .map(d => attachTeamDisplayFields({
      number: d.number || 0,
      name: d.name || '',
      team: d.team || '',
      car: d.car || '',
      imageUrl: d.imageUrl || '',
      nationality: d.nationality || 'British',
      class: d.class || '',
      bio: d.bio || '',
      dateOfBirth: d.dateOfBirth || '',
      birthplace: d.birthplace || '',
      // false only when a driver has left their seat mid-season (e.g. moved to
      // a reserve/development role) - they stay in the roster and keep their
      // last team/car for display, but drop out of that team's active driver
      // list below. Absent/true means "currently racing" as normal.
      currentlyRacing: d.currentlyRacing !== false,
      history: parseDriverHistory(d.history),
    }, rawTeams));
  const teams = (json.teams || []).map(t => ({
    name: t.name || '',
    car: t.car || '',
    entries: t.entries || 0,
    bio: t.bio || '',
    standing2025: t.standing2025 || 0,
    points2025: t.points2025 || 0,
    carImageUrl: t.carImageUrl || '',
    cardBgUrl: t.cardBgUrl || '',
    lightCardBg: t.lightCardBg || false,
    founded: t.founded || 0,
    base: t.base || '',
    driversChampionships: t.driversChampionships || 0,
    teamsChampionships: t.teamsChampionships || 0,
    totalRaces: t.totalRaces || 0,
    totalWins: t.totalWins || 0,
    history: t.history || [],
    carSpecs: t.carSpecs || null,
    // currentlyRacing check excludes a driver who's moved to a reserve role
    // but still has this team recorded as their last one - their old team's
    // roster/detail page should only show who's actually racing for it now.
    drivers: drivers.filter(d => d.team === t.name && d.currentlyRacing),
  }));
  return {drivers, teams};
}

// Parse standings JSON
export function parseStandings(json) {
  const mapDriver = (d, i) => ({
    position: d.pos || i + 1,
    name: d.driver || '',
    team: d.team || '',
    car: d.car || '',
    cls: d.class || '',
    nat: d.nat || '',
    points: d.points || 0,
    wins: d.wins || 0,
    seconds: d.seconds || 0,
    thirds: d.thirds || 0,
  });
  const drivers = (json.standings || []).map(mapDriver);
  const jst     = (json.jst      || []).map(mapDriver);
  const teams = (json.teams || []).map((t, i) => ({
    position: t.pos || i + 1,
    name: t.team || '',
    points: t.points || 0,
  }));
  const independentsTeams = (json.independentsTeams || []).map((t, i) => ({
    position: t.pos || i + 1,
    name: t.team || '',
    points: t.points || 0,
  }));
  return {
    season: json.season || '2026',
    round: json.round || 0,
    venue: json.venue || '',
    drivers,
    teams,
    jst,
    independentsTeams,
  };
}

// Parse race results JSON
const POINTS_BY_POS = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function parseResults(json) {
  return (json.rounds || []).map((r, i) => ({
    round: r.round || i + 1,
    venue: r.venue || '',
    date: r.date || '',
    youtubeUrls: r.youtubeUrls || [],
    polePosition: r.polePosition || null,
    races: (r.races || []).map((race, j) => {
      const label = race.label || `Race ${j + 1}`;
      const labelLc = label.toLowerCase();
      const isQR = labelLc === 'qualifying race';
      const isRace1 = labelLc === 'race 1';
      const noPoints = labelLc === 'free practice' || labelLc === 'qualifying';
      return {
        label,
        date: race.date || null,
        fullRaceUrl: race.fullRaceUrl || null,
        reverseGridDraw: race.reverseGridDraw ?? null,
        grid: (race.grid || []).map(g => ({
          pos: g.pos,
          no: g.no,
          cl: g.cl || '',
          driver: g.driver || '',
          team: g.team || '',
        })),
        results: (race.results || []).map(d => {
          const pos = d.pos || 0;
          const rawPts = d.points || 0;
          const fl = d.fastestLap || d.fl || false;
          const lead = d.leadLap || d.l || false;
          const pole = d.pole || d.p || false;
          let points;
          if (noPoints) {
            points = 0;
          } else if (rawPts > 0) {
            points = rawPts;
          } else if (isQR) {
              const qrPts = [10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1];
              points = pos >= 1 && pos <= 15 ? qrPts[pos - 1] : 0;
          } else {
              points = pos >= 1 && pos <= 15 ? POINTS_BY_POS[pos - 1] : 0;
              if (pos >= 1 && fl) points += 1;
              if (pos >= 1 && lead) points += 1;
          }
          return {
            position: pos,
            number: d.no || 0,
            driver: d.driver || '',
            team: d.team || '',
            laps: d.laps || 0,
            time: d.time || '',
            gap: d.gap || null,
            bestLap: d.bestLap || '',
            points,
            fastestLap: isQR ? false : fl,
            leadLap: isQR ? false : lead,
            pole: isQR ? false : pole,
            avgLapSpeed: d.avgLapSpeed || null,
            status: d.status || null,
          };
        }),
      };
    }),
  }));
}
