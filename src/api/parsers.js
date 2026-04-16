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
  try {
    const media = embedded?.['wp:featuredmedia']?.[0]?.source_url;
    if (media) return media;
  } catch {}
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractCategory(embedded) {
  try {
    return embedded?.['wp:term']?.[0]?.[0]?.name || '';
  } catch {
    return '';
  }
}

export function formatDate(date) {
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
  } catch {
    return date;
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
  const rounds = (json.rounds || []).map((r, i) => ({
    round: r.round || i + 1,
    venue: r.venue || '',
    startDate: r.startDate || '',
    endDate: r.endDate || '',
    tslEventId: r.tslEventId || 0,
    location: r.location || '',
    country: r.country || '',
    lat: r.lat || 0,
    lng: r.lng || 0,
    lengthMiles: r.lengthMiles || '',
    lengthKm: r.lengthKm || '',
    corners: r.corners || 0,
    cornersLeft: r.cornersLeft ?? null,
    cornersRight: r.cornersRight ?? null,
    about: r.about || '',
    btccFact: r.btccFact || '',
    imageUrl: r.imageUrl || '',
    layoutImageUrl: r.layoutImageUrl || '',
    raceImages: r.raceImages || [],
    firstBtccYear: r.firstBtccYear || null,
    qualifyingRecord: r.qualifyingRecord || null,
    raceRecord: r.raceRecord || null,
    sessions: (r.sessions || []).map(s => ({
      name: s.name || '',
      day: s.day || '',
      time: s.time || '',
    })),
    trackGuide: (r.trackGuide || []).map(s => ({
      name: s.sector || '',
      corners: (s.corners || []).map(c => ({
        number: c.number || '',
        name: c.name || '',
        description: c.description || '',
        overtaking: c.overtaking || false,
      })),
    })),
  }));
  return {
    seasonStartDate: json.seasonStartDate || '2026-04-18',
    liveTimingEnabled: json.liveTimingEnabled !== false,
    rounds,
  };
}

// Parse drivers JSON
export function parseGrid(json) {
  const drivers = (json.drivers || [])
    .filter(d => d.team && d.team.trim())
    .map(d => ({
      number: d.number || 0,
      name: d.name || '',
      team: d.team || '',
      car: d.car || '',
      imageUrl: d.imageUrl || '',
      nationality: d.nationality || 'British',
      bio: d.bio || '',
      dateOfBirth: d.dateOfBirth || '',
      birthplace: d.birthplace || '',
      history: (d.history || []).map(h => ({
        year: h.year,
        team: h.team || '',
        car: h.car || '',
        pos: h.pos || 0,
        points: h.points || 0,
        wins: h.wins || 0,
        podiums: h.podiums || 0,
        poles: h.poles || 0,
        fastestLaps: h.fastestLaps || 0,
        isChampion: h.champion || false,
      })),
    }));
  const teams = (json.teams || []).map(t => ({
    name: t.name || '',
    car: t.car || '',
    entries: t.entries || 0,
    bio: t.bio || '',
    standing2025: t.standing2025 || 0,
    points2025: t.points2025 || 0,
    carImageUrl: t.carImageUrl || '',
    cardBgUrl: t.cardBgUrl || '',
    founded: t.founded || 0,
    base: t.base || '',
    driversChampionships: t.driversChampionships || 0,
    teamsChampionships: t.teamsChampionships || 0,
    drivers: drivers.filter(d => d.team === t.name),
  }));
  return {drivers, teams};
}

// Parse standings JSON
export function parseStandings(json) {
  const drivers = (json.standings || []).map((d, i) => ({
    position: d.pos || i + 1,
    name: d.driver || '',
    team: d.team || '',
    car: d.car || '',
    points: d.points || 0,
    wins: d.wins || 0,
  }));
  const teams = (json.teams || []).map((t, i) => ({
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
  };
}

// Parse race results JSON
const POINTS_BY_POS = [20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export function parseResults(json) {
  return (json.rounds || []).map((r, i) => ({
    round: r.round || i + 1,
    venue: r.venue || '',
    date: r.date || '',
    polePosition: r.polePosition || null,
    races: (r.races || []).map((race, j) => {
      const label = race.label || `Race ${j + 1}`;
      const isQR = label.toLowerCase() === 'qualifying race';
      const isRace1 = label.toLowerCase() === 'race 1';
      return {
        label,
        date: race.date || null,
        fullRaceUrl: race.fullRaceUrl || null,
        results: (race.results || []).map(d => {
          const pos = d.pos || 0;
          const rawPts = d.points || 0;
          const fl = d.fastestLap || d.fl || false;
          const lead = d.leadLap || d.l || false;
          const pole = d.pole || d.p || false;
          let points;
          if (rawPts > 0) {
            points = rawPts;
          } else if (isQR) {
              const qrPts = [10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1];
              points = pos >= 1 && pos <= 15 ? qrPts[pos - 1] : 0;
          } else {
              points = pos >= 1 && pos <= 15 ? POINTS_BY_POS[pos - 1] : 0;
              if (fl) points += 1;
              if (lead) points += 1;
              if (pole && isRace1) points += 1;
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
            fastestLap: fl,
            leadLap: lead,
            pole,
            avgLapSpeed: d.avgLapSpeed || null,
          };
        }),
      };
    }),
  }));
}
