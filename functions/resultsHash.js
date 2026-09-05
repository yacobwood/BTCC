// Pure logic split out of scraperAdmin.js so it can be unit tested directly,
// same pattern as newsCheck.js/chatMentions.js/chatTrim.js - not aggregated
// into index.js (see its own comment), so this never becomes its own
// deployed Cloud Function, just a plain module scraperAdmin.js requires.
const {fetchWithTimeout} = require('./shared');
const crypto = require('crypto');

// Hashes only the meaningful results/standings content - explicitly drops
// standings.json's own `updated` field, which scrape_tsl.py re-stamps with
// the current time on essentially every run during a raceday regardless of
// whether anything actually changed (tools/scraper/scrape_tsl.py:1332), since
// SESSION_FILTER deliberately keeps grid-bearing sessions open all day "to
// catch grid amendments". That spurious byte-diff is also what makes
// scrape-results.yml's own changes_detected gate fire almost every 2-minute
// tick on a live raceday - this hash is notifyResultsUpdate's own,
// independent backstop, not a trust in that upstream signal (same "two
// systems tuned independently" trap that caused this bug in the first
// place - confirmed live, users getting repeat "A fresh result just
// dropped" pushes during the Croft (round 8) race weekend, 2026-09-05).
async function computeResultsHash(year) {
  const [resultsRes, standingsRes] = await Promise.all([
    fetchWithTimeout(`https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results${year}.json?t=${Date.now()}`),
    fetchWithTimeout(`https://raw.githubusercontent.com/yacobwood/BTCC/main/data/standings.json?t=${Date.now()}`),
  ]);
  const results = resultsRes.ok ? await resultsRes.json() : null;
  const standingsFull = standingsRes.ok ? await standingsRes.json() : null;
  const {updated, ...standings} = standingsFull || {};
  return crypto.createHash('sha256').update(JSON.stringify({results, standings})).digest('hex');
}

module.exports = {computeResultsHash};
