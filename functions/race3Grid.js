// Race 3 grid-order notification - checks whether Race 3's starting grid
// has just become available for any round, and sends a one-time
// notification if so. Extracted into its own file (same pattern as
// newsCheck.js) purely so its pure grid-lookup logic can be unit tested
// with injected fetch/db/messaging, without needing the whole Firebase
// Admin SDK.
//
// Called from notifyResultsUpdate (functions/index.js), itself called by
// scrape-results.yml's GitHub Action every time it actually commits a
// results change - NOT from .github/scripts/session_watcher.py, which
// implements this same idea but hasn't actually run since May 2026
// (confirmed via GitHub Actions run history - session-watcher.yml's
// auto-trigger cron is commented out and nothing else dispatches it).
// That Python implementation is left in place as-is (not wrong, just
// currently unreachable) in case the workflow gets reactivated later; this
// is the version that actually runs in production.
//
// Race 3's grid needs both Race 2's finishing order AND a separately-timed
// reversal-count draw: per BTCC reg 3.4.1.b, the number of positions
// reversed is "picked at random by someone nominated by the Administrator
// as soon as practical after the finish of that Race" - distinct wording
// from "as soon as possible" used elsewhere in the same regulation, and
// framed as its own event, not an automatic byproduct of Race 2's result
// going final. So this checks Race 3's own `grid` field directly, rather
// than assuming it's ready the instant Race 2's results land.

const RESULTS_URL = (year) => `https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results${year}.json`;

function findRace3(resultsData, round) {
  const rnd = (resultsData.rounds || []).find(r => r.round === round);
  if (!rnd) return null;
  return (rnd.races || []).find(r => r.label === 'Race 3') || null;
}

function race3GridReady(resultsData, round) {
  const race3 = findRace3(resultsData, round);
  return Boolean(race3 && race3.grid && race3.grid.length);
}

function race3PoleSitter(resultsData, round) {
  const race3 = findRace3(resultsData, round);
  if (!race3 || !race3.grid) return null;
  const pole = race3.grid.find(g => g.pos === 1);
  return pole ? pole.driver : null;
}

async function checkRace3Grid({fetchFn, db, messaging, logHistory, year}) {
  const resultsData = await fetchFn(RESULTS_URL(year)).then(r => r.json());
  const readyRounds = (resultsData.rounds || []).filter(r => race3GridReady(resultsData, r.round));

  for (const rnd of readyRounds) {
    // One doc per round+year - each round's own idempotent "have we already
    // notified for this one" flag, set once and never touched again. No
    // read-then-write race between different rounds since each has its own
    // doc; the transaction only guards against this same check running
    // concurrently for the *same* round (e.g. two overlapping scraper ticks).
    const stateRef = db.collection('state').doc(`race3grid_${year}_${rnd.round}`);
    let shouldSend = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(stateRef);
      if (snap.exists) return;
      tx.set(stateRef, {sentAt: new Date().toISOString()});
      shouldSend = true;
    });
    if (!shouldSend) continue;

    const pole = race3PoleSitter(resultsData, rnd.round);
    const title = `Race 3 Grid Set - Round ${rnd.round}`;
    const body = pole ? `${pole} starts Race 3 from pole` : `Race 3's starting grid is now set`;

    await messaging.send({
      topic: 'pre_race3_grid',
      android: {priority: 'high'},
      apns: {payload: {aps: {sound: 'default', alert: {title, body}}}},
      data: {type: 'results', round: String(rnd.round), year: String(year), race: '3'},
    });
    logHistory(title, body, 'pre_race3_grid');
  }
}

module.exports = {checkRace3Grid, findRace3, race3GridReady, race3PoleSitter, RESULTS_URL};
