/**
 * inject_timing.js
 *
 * Scrapes motorsportstats.com classification pages and injects timing data
 * into data/results{YEAR}.json files.
 *
 * Adds / updates per-driver fields:
 *   time        — race time for P1 (e.g. "27:11.648"), empty for others
 *   gap         — gap to leader for P2+ (e.g. "+1.043"), empty for P1
 *   bestLap     — fastest lap time (e.g. "1:08.011")
 *   avgLapSpeed — average race speed in km/h (e.g. "145.2")
 *
 * Usage:
 *   node inject_timing.js               # all years 2014–2025
 *   node inject_timing.js 2025          # single year
 *   node inject_timing.js 2023 2024 2025
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const puppeteer = require('puppeteer');

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/** Milliseconds → "M:SS.mmm" (lap time) or "MM:SS.mmm" (race time) */
function fmtMs(ms) {
  if (typeof ms !== 'number' || ms <= 0) return '';
  const m   = Math.floor(ms / 60000);
  const s   = Math.floor((ms % 60000) / 1000);
  const rem = ms % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(rem).padStart(3, '0')}`;
}

/** Gap object → "+S.mmm" or "+N Lap(s)" */
function fmtGap(g) {
  if (!g) return '';
  if (g.lapsToLead > 0) return `+${g.lapsToLead} Lap${g.lapsToLead > 1 ? 's' : ''}`;
  if (!g.timeToLead) return '';
  const ms  = g.timeToLead;
  const s   = Math.floor(ms / 1000);
  const rem = ms % 1000;
  return `+${s}.${String(rem).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Name matching helpers
// ---------------------------------------------------------------------------

/** Normalise for comparison: lowercase, strip diacritics, remove non-alpha */
function norm(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function lastName(name) {
  const parts = norm(name).split(' ');
  return parts[parts.length - 1];
}

/**
 * Known first-name short forms used by motorsportstats.
 * Key = norm(motorsportstats name), Value = norm(btcc.net name).
 */
const SHORT_FORMS = {
  'ash sutton':           'ashley sutton',
  'rob collard':          'robert collard',
  'tom onslow-cole':      'tom onslow cole',
  'onslow-cole':          'onslow cole',
  'derek palmer jr':      'derek palmer',
  'derek palmer jr.':     'derek palmer',
};

// ---------------------------------------------------------------------------
// Venue → MSS slug mapping
// ---------------------------------------------------------------------------

/**
 * Given a btcc.net venue name and the set of available MSS slugs for the year,
 * return the matching MSS short-slug (or null if no match).
 * Order matters: more specific checks (e.g. "GP") before generic ones.
 */
function getSlugForVenue(venue, slugSet) {
  const has = s => slugSet.has(s);
  const v = venue.toLowerCase().trim();

  if (v.includes('brands hatch') && (v.includes('gp') || v.includes(' gp')))
    return has('brands-hatch-gp') ? 'brands-hatch-gp' : has('brands-hatch-2') ? 'brands-hatch-2' : null;
  if (v.includes('brands hatch') && v.includes('indy'))
    return has('brands-hatch-indy') ? 'brands-hatch-indy' : has('brands-hatch') ? 'brands-hatch' : null;
  if (v.includes('brands hatch'))
    return has('brands-hatch') ? 'brands-hatch' : null;

  if (v.includes('donington') && (v.includes('gp') || v.includes(' gp')))
    return has('donington-park') ? 'donington-park' : null;
  if (v.includes('donington'))
    return has('donington-national') ? 'donington-national' : has('donington') ? 'donington' : null;

  if (v.includes('snetterton'))
    return has('snetterton-300') ? 'snetterton-300' : has('snetterton') ? 'snetterton' : null;
  if (v.includes('oulton'))
    return has('oulton-park-island') ? 'oulton-park-island' : has('oulton-park') ? 'oulton-park' : null;
  if (v.includes('silverstone'))
    return has('silverstone-national') ? 'silverstone-national' : has('silverstone') ? 'silverstone' : null;
  if (v.includes('thruxton') && (v.includes(' 2') || v.includes('-2')))
    return has('thruxton-2') ? 'thruxton-2' : null;
  if (v.includes('thruxton'))
    return has('thruxton') ? 'thruxton' : null;
  if (v.includes('croft'))
    return has('croft') ? 'croft' : null;
  if (v.includes('knockhill'))
    return has('knockhill') ? 'knockhill' : null;
  if (v.includes('rockingham'))
    return has('rockingham') ? 'rockingham' : null;
  if (v.includes('mondello'))
    return has('mondello-park') ? 'mondello-park' : null;
  if (v.includes('castle donington'))
    return has('donington-national') ? 'donington-national' : null;

  return null;
}

/** Find the btcc.net driver name in `candidates` that best matches `mssName`. */
function matchDriver(mssName, candidates) {
  const mssNorm     = norm(mssName);
  const mssResolved = SHORT_FORMS[mssNorm] || mssNorm;
  const mssLast     = lastName(mssResolved);

  // 1. Exact match (normalised)
  for (const c of candidates) {
    if (norm(c) === mssNorm || norm(c) === mssResolved) return c;
  }
  // 2. Last-name match (handles "Ash" vs "Ashley" etc.)
  for (const c of candidates) {
    if (lastName(c) === mssLast) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Puppeteer helpers — DOM-based extraction
// ---------------------------------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractNextData(html) {
  const m = html.match(/id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/**
 * Open a page, wait for the classification table to be populated, then return
 * the page handle for further use.
 */
async function openClassificationPage(browser, url) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  // Wait until at least one table row appears with timing data
  await page.waitForSelector('table tbody tr', { timeout: 15000 }).catch(() => {});
  return page;
}

/**
 * Get race session short-slugs from the classification overview page.
 * Tries __NEXT_DATA__ first (has session list); the slug tail after the last '_'
 * gives the URL segment (e.g. "race", "race-2", "race-3").
 */
async function getSessionSlugs(browser, year, eventSlug) {
  const url = `https://www.motorsportstats.com/results/british-touring-car-championship/${year}/${eventSlug}/classification`;
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    const html  = await page.content();
    const data  = extractNextData(html);
    if (!data) { await page.close(); return []; }

    const slugs = (data.props?.pageProps?.sessions || [])
      .filter(s => /race/i.test(s.session?.name || s.name || ''))
      .map(s => {
        const full = s.session?.slug || s.slug || '';
        return full.split('_').pop();   // "race", "race-2", "race-3" …
      })
      .filter(Boolean);

    await page.close();
    return slugs;
  } catch (e) {
    console.error(`    getSessionSlugs error: ${e.message}`);
    await page.close().catch(() => {});
    return [];
  }
}

/**
 * Scrape the classification table from the rendered DOM.
 *
 * Table columns (motorsportstats.com):
 *   0  pos          1  car#   2  driver   3  team   4  laps
 *   5  time (race)  6  gap-to-leader  7  gap-to-prev
 *   8  avgLapSpeed  9  bestLap        10 bestLapLap#
 *
 * Returns array of { pos, driver, time, gap, avgLapSpeed, bestLap } or null.
 */
async function getClassification(browser, year, eventSlug, sessionSlug) {
  const url = `https://www.motorsportstats.com/results/british-touring-car-championship/${year}/${eventSlug}/classification/${sessionSlug}`;
  let page;
  try {
    page = await openClassificationPage(browser, url);

    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('table tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      }).filter(r => r.length >= 6);
    });

    await page.close();
    if (!rows.length) return null;

    return rows.map(cells => {
      const posRaw = cells[0] || '';
      const pos    = parseInt(posRaw, 10) || 0;   // 0 for DNF/NC
      return {
        pos,
        driver:       cells[2] || '',
        time:         cells[5] || '',   // absolute race time e.g. "27:11.648"
        gap:          cells[6] || '',   // gap to leader e.g. "+ 1.043" (P2+) or ""
        avgLapSpeed:  cells[8] || '',   // e.g. "145.2"
        bestLap:      cells[9] || '',   // e.g. "1:29.815"
      };
    }).filter(r => r.driver);

  } catch (e) {
    console.error(`    getClassification error: ${e.message}`);
    if (page && !page.isClosed()) await page.close().catch(() => {});
    return null;
  }
}

// ---------------------------------------------------------------------------
// Per-year processing
// ---------------------------------------------------------------------------

async function processYear(browser, year) {
  console.log(`\n${'='.repeat(50)}\n  ${year}\n${'='.repeat(50)}`);

  const mssFile     = path.join(__dirname, `${year}.json`);
  const resultsFile = path.join(__dirname, '..', 'data', `results${year}.json`);

  if (!fs.existsSync(mssFile)) {
    console.log(`  SKIP — motorsportstats/${year}.json not found`);
    return;
  }
  if (!fs.existsSync(resultsFile)) {
    console.log(`  SKIP — data/results${year}.json not found`);
    return;
  }

  const mss     = JSON.parse(fs.readFileSync(mssFile, 'utf8'));
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

  // Build set of all unique MSS short-slugs for this year
  const slugSet = new Set();
  for (const r of mss.races) {
    const shortSlug = r.event.slug.replace(`british-touring-car-championship_${year}_`, '');
    slugSet.add(shortSlug);
  }

  for (const round of results.rounds) {
    const shortSlug = getSlugForVenue(round.venue, slugSet);
    if (!shortSlug) {
      console.log(`\n  Round ${round.round} (${round.venue}): no venue mapping — skipping`);
      continue;
    }

    console.log(`\n  Round ${round.round} — ${round.venue} (${shortSlug})`);
    await delay(1500);

    const sessionSlugs = await getSessionSlugs(browser, year, shortSlug);
    if (sessionSlugs.length === 0) {
      console.log(`    No race sessions found`);
      continue;
    }
    console.log(`    Sessions: ${sessionSlugs.join(', ')}`);

    const races = round.races.filter(r => r.results.length > 0);

    for (let i = 0; i < Math.min(races.length, sessionSlugs.length); i++) {
      const race       = races[i];
      const sessionSlug = sessionSlugs[i];

      console.log(`    ${race.label} → ${sessionSlug}`);
      await delay(1000);

      const classification = await getClassification(browser, year, shortSlug, sessionSlug);
      if (!classification) {
        console.log(`      Failed to fetch classification`);
        continue;
      }

      // Build name → timing map from DOM-extracted rows
      // classification is [{pos, driver, time, gap, avgLapSpeed, bestLap}]
      const timingMap = new Map();
      for (const c of classification) {
        if (!c.driver) continue;
        const isP1  = c.pos === 1;
        const isDNF = c.pos === 0;

        // gap column from DOM already has "+ 1.043" format — normalise to "+1.043"
        const gapStr = c.gap.replace(/\s+/g, '').replace(/^([^+])/, '+$1');

        timingMap.set(c.driver, {
          time:         isP1 && !isDNF ? c.time : '',
          gap:          !isP1 && !isDNF && c.gap ? gapStr : '',
          bestLap:      c.bestLap || '',
          avgLapSpeed:  !isDNF && c.avgLapSpeed ? c.avgLapSpeed : '',
        });
      }

      // Match drivers and inject
      let updated = 0, unmatched = [];

      for (const dr of race.results) {
        const isP1    = dr.pos === 1;
        const mssName = findMssName(dr.driver, timingMap);

        // P1 gap should always be empty — fix "0.000" / "0" artefacts from btcc.net
        if (isP1 && (dr.gap === '0.000' || dr.gap === '0' || dr.gap === '0:00.000')) {
          dr.gap = '';
        }

        if (!mssName) {
          unmatched.push(dr.driver);
          continue;
        }
        const t = timingMap.get(mssName);

        // Always overwrite from MSS (handles re-runs that correct previously bad data)
        if (t.time)        dr.time   = t.time;
        if (t.gap)         dr.gap    = t.gap;
        if (t.bestLap)     dr.bestLap = t.bestLap;
        if (t.avgLapSpeed) dr.avgLapSpeed = t.avgLapSpeed;

        updated++;
      }

      console.log(`      Updated ${updated}/${race.results.length} drivers` +
                  (unmatched.length ? ` | unmatched: ${unmatched.join(', ')}` : ''));
    }
  }

  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n  ✓ Saved data/results${year}.json`);
}

/** Find the motorsportstats driver name key in timingMap that matches btccName. */
function findMssName(btccName, timingMap) {
  const btccNorm = norm(btccName);
  const btccLast = lastName(btccName);

  for (const mssName of timingMap.keys()) {
    const mssNorm     = norm(mssName);
    const mssResolved = SHORT_FORMS[mssNorm] || mssNorm;
    const mssLast     = lastName(mssResolved);

    if (btccNorm === mssNorm || btccNorm === mssResolved) return mssName;
    if (btccLast === mssLast) return mssName;
  }
  return null;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args  = process.argv.slice(2).map(Number).filter(n => n >= 2004 && n <= 2025);
  const years = args.length > 0 ? args : [2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];

  console.log(`Processing years: ${years.join(', ')}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const year of years) {
      await processYear(browser, year);
    }
  } catch (e) {
    console.error('Fatal error:', e);
  } finally {
    await browser.close();
    console.log('\nDone.');
  }
}

main();
