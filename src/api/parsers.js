const BUNDLED_TRACKS = require('../../data/tracks.json');

// Rewrite a btcc.net image URL to a smaller WordPress-generated thumbnail
export function thumbUrl(url, size = '150x150') {
  if (!url || !url.includes('btcc.net/wp-content/uploads/')) return url;
  return url.replace(/(\.[a-z]+)$/i, `-${size}$1`);
}

// Rewrite a data/carImages/ URL to its pre-generated small thumbnail
// (<name>-thumb.webp - see scripts/generate_car_thumb.py). TeamDetailScreen.js
// keeps its own identical copy of this for its own rendering (same
// convention as thumbUrl above vs. this file's), but backgroundPrefetch.js
// needs the canonical one here so it actually warms the cache for the URL
// that screen requests - prefetching the full-size original (as it did
// until 2026-08-21) prefetches a URL nothing ever asks for any more.
export function carThumbUrl(url) {
  if (!url) return url;
  return url.replace(/(\.[a-z0-9]+)$/i, '-thumb$1');
}

// Same idea, but for the tighter -thumb-crop variant DriverDetailScreen.js's
// full-width car banner uses instead of the plain -thumb above - that
// banner has no logo overlay to keep clear of, so it crops out the padding
// TeamDetailScreen's cards deliberately keep (see generate_car_thumb.py for
// why two variants exist at all). DriverDetailScreen.js keeps its own copy
// for rendering; this one exists so backgroundPrefetch.js can warm it too.
export function carThumbCropUrl(url) {
  if (!url) return url;
  return url.replace(/(\.[a-z0-9]+)$/i, '-thumb-crop$1');
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
  // orderDate is for feed ordering only (NewsScreen's byDateDesc/hero gating) -
  // sortDate itself stays the official btcc.net date because it's also used
  // as the displayed article header date and the GA4 publish_date param
  // (ArticleScreen.js), which must show/report the real publish date, not
  // when our scraper happened to see it. btcc.net's `date` has no time-of-day
  // (always T00:00:00), so every article published the same day compares
  // equal on it; against hub posts' real pubDate timestamp (client.js
  // mapHubPosts), that midnight value always loses, letting same-day hub
  // posts jump the hero slot ahead of mirror articles seen hours later (seen
  // 2026-08-24: a 16:47 hub post outranked a 20:16 mirror article). firstSeenAt
  // carries the scraper's real detection time (see scrape_articles.py's
  // sort_posts/resolve_first_seen) and is comparable precision to hub's
  // pubDate, so use it for ordering specifically.
  const orderDate = post.firstSeenAt || sortDate;
  const embedded = post._embedded;
  const imageUrl = extractFeaturedImage(embedded, content);
  const category = extractCategory(embedded);
  return {id, title, link, description, pubDate, sortDate, orderDate, imageUrl, category, content, source: 'btcc.net'};
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

// e.g. "20th July 2026" - date only, no time, ordinal day + full month name
export function formatFullDate(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = d.getDate();
    const suffix = day % 10 === 1 && day !== 11 ? 'st'
      : day % 10 === 2 && day !== 12 ? 'nd'
      : day % 10 === 3 && day !== 13 ? 'rd'
      : 'th';
    const month = d.toLocaleDateString('en-GB', {month: 'long'});
    return `${day}${suffix} ${month} ${d.getFullYear()}`;
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
//
// cardBgUrl prefers the driver's own value (a hand-curated override, e.g.
// Nicolas Hamilton's own VERTU card graphic) over the team-derived one:
// most drivers' cards match their team's colour, but not always - a team
// page can be shared by multiple sub-liveries with different card colours
// (e.g. "Steel Seal with Power Maxed Racing"), so team-only lookup got
// those specific drivers wrong. carImageUrl follows the same precedence
// for consistency - every driver has their own car cutout on disk
// (data/carImages/, named by surname), and since 2026-08-21 that resolved
// per-driver value is what DriversScreen's driver tile and TeamDetailScreen's
// hero actually render (one card per driver there, not one per team).
// team.carImageUrl itself is now purely the fallback used above, for a
// driver with no car cutout of their own yet - DriversScreen/MerchScreen's
// team tiles dropped the car entirely (just the shared logo now), since a
// single "representative" car can no longer describe a multi-livery team.
export function attachTeamDisplayFields(driver, rawTeams) {
  const team = (rawTeams || []).find(t => t.name === driver.team);
  const {class: rawClass, ...rest} = driver; // `class` is raw-shape only; output uses `cls`
  return {
    ...rest,
    cls: driver.cls || rawClass || '',
    cardBgUrl: driver.cardBgUrl || team?.cardBgUrl || '',
    carImageUrl: driver.carImageUrl || team?.carImageUrl || '',
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
      cardBgUrl: d.cardBgUrl || '',
      carImageUrl: d.carImageUrl || '',
      numberImageUrl: d.numberImageUrl || '',
      nationality: d.nationality || 'British',
      class: d.class || '',
      bio: d.bio || '',
      dateOfBirth: d.dateOfBirth || '',
      birthplace: d.birthplace || '',
      livesIn: d.livesIn || '',
      // false only when a driver has left their seat mid-season (e.g. moved to
      // a reserve/development role) - they stay in the roster and keep their
      // last team/car for display, but drop out of that team's active driver
      // list below. Absent/true means "currently racing" as normal.
      currentlyRacing: d.currentlyRacing !== false,
      // True for a one-off reserve/stand-in appearance (e.g. Senna Proctor
      // covering Sam Osborne's seat) - they never had a full-season grid
      // spot, so unlike currentlyRacing:false they get no tile anywhere on
      // DriversScreen, confirmed or not. They still need a drivers.json entry
      // with a matching team/class/number so liveDataConsistency.test.js's
      // standings/results cross-checks resolve their name.
      reserveOnly: d.reserveOnly || false,
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
    logoUrl: t.logoUrl || '',
    // True for a team whose logo asset is a wide, edge-to-edge image with no
    // internal transparent padding (currently just Steel Seal) - see
    // TeamDetailScreen.js's teamLogoImgSmall for why this needs a smaller box
    // there specifically, without affecting every other team's hero logo.
    smallLogo: t.smallLogo || false,
    lightCardBg: t.lightCardBg || false,
    founded: t.founded || 0,
    base: t.base || '',
    driversChampionships: t.driversChampionships || 0,
    teamsChampionships: t.teamsChampionships || 0,
    totalRaces: t.totalRaces || 0,
    totalWins: t.totalWins || 0,
    history: t.history || [],
    carSpecs: t.carSpecs || null,
    // Sponsor/partner brands for TeamDetailScreen's SPONSORS section, tiered
    // from principal (title/livery-defining) down to decal (small logo-only
    // placements, e.g. wheel arches) - see sponsorsNote for caveats like a
    // livery in flux or per-car variation within a multi-entry team.
    sponsors: t.sponsors || [],
    sponsorsNote: t.sponsorsNote || '',
    // currentlyRacing check excludes a driver who's moved to a reserve role
    // but still has this team recorded as their last one - their old team's
    // roster/detail page should only show who's actually racing for it now.
    // reserveOnly excludes a one-off stand-in too - they never held a seat on
    // this team's roster, just covered a single round of it.
    drivers: drivers.filter(d => d.team === t.name && d.currentlyRacing && !d.reserveOnly),
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
  // Independents' Trophy for Drivers (Sporting Regs 1.6.2.b) - a separately
  // scored table, not the main Drivers' Championship filtered by class.
  const drivers      = (json.standings    || []).map(mapDriver);
  const jst          = (json.jst          || []).map(mapDriver);
  const independents = (json.independents || []).map(mapDriver);

  const mapTeam = (t, i) => ({
    position: t.pos || i + 1,
    name: t.team || t.manufacturer || '',
    points: t.points || 0,
  });
  const teams             = (json.teams             || []).map(mapTeam);
  const independentsTeams = (json.independentsTeams || []).map(mapTeam);
  const manufacturers     = (json.manufacturers     || []).map(mapTeam);

  return {
    season: json.season || '2026',
    round: json.round || 0,
    venue: json.venue || '',
    drivers,
    teams,
    jst,
    independents,
    independentsTeams,
    manufacturers,
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
