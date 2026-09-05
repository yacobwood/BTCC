// Pure logic split out of scraperAdmin.js so it can be unit tested directly,
// same pattern as newsCheck.js/chatMentions.js/chatTrim.js - not aggregated
// into index.js (see its own comment), so this never becomes its own
// deployed Cloud Function, just a plain module scraperAdmin.js requires.
const {fetchWithTimeout} = require('./shared');
const crypto = require('crypto');

// Fetches results{year}.json + standings.json fresh (cache-busted) from the
// GitHub raw CDN.
async function fetchResultsAndStandings(year) {
  const [resultsRes, standingsRes] = await Promise.all([
    fetchWithTimeout(`https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results${year}.json?t=${Date.now()}`),
    fetchWithTimeout(`https://raw.githubusercontent.com/yacobwood/BTCC/main/data/standings.json?t=${Date.now()}`),
  ]);
  const results = resultsRes.ok ? await resultsRes.json() : null;
  const standingsFull = standingsRes.ok ? await standingsRes.json() : null;
  return {results, standings: standingsFull};
}

function hashSession(race) {
  return crypto.createHash('sha256').update(JSON.stringify({results: race.results || [], grid: race.grid || null})).digest('hex');
}

// {[round]: {[sessionLabel]: hash}} - a compact per-session fingerprint,
// deliberately just the results/grid arrays (not standings.json's `updated`
// field, which scrape_tsl.py re-stamps with the current time on essentially
// every raceday run regardless of real content change - tools/scraper/
// scrape_tsl.py:1332 - the exact spurious byte-diff that used to make every
// single scrape tick fire a visible push, before this dedup existed).
// Every round's 6 session slots (Free Practice/Qualifying/Qualifying Race/
// Race 1/2/3) already exist in results{year}.json from the start of the
// season, future rounds just with empty `results` arrays - so there's no
// "a whole new round appears later" edge case to handle separately from the
// steady-state per-session diff below.
function computeSessionFingerprints(results) {
  const fp = {};
  for (const round of results?.rounds || []) {
    fp[round.round] = {};
    for (const race of round.races || []) {
      fp[round.round][race.label] = hashSession(race);
    }
  }
  return fp;
}

// Finds the single most-recently-changed (round, session) pair by comparing
// freshly computed fingerprints against the last-stored map - or null if
// nothing genuinely changed. "Most recent" = highest round number, then the
// last session (by races[] array order, which mirrors real chronology: FP ->
// Qualifying -> Qualifying Race -> Race 1/2/3) that changed within that
// round - the natural pick during normal one-session-at-a-time live scraping,
// and a reasonable one if a backfill or manual re-scrape touches several
// sessions in the same tick (only the latest is surfaced, never one push per
// session - that would just reintroduce the spam this dedup exists to stop).
function findChangedSession(results, currentFp, storedFp) {
  let picked = null;
  for (const round of results?.rounds || []) {
    const roundNum = round.round;
    (round.races || []).forEach((race, raceIndex) => {
      const cur = currentFp[roundNum]?.[race.label];
      const prev = storedFp?.[roundNum]?.[race.label];
      if (cur && cur !== prev) {
        picked = {round: roundNum, raceIndex, label: race.label};
      }
    });
  }
  return picked;
}

module.exports = {fetchResultsAndStandings, computeSessionFingerprints, findChangedSession};
