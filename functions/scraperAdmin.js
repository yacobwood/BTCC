const {onRequest} = require('firebase-functions/v2/https');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');
const {logError, logPushHistory, requireAdminPost} = require('./shared');
const {fetchResultsAndStandings, computeSessionFingerprints, findChangedSession} = require('./resultsHash');

// ── Error dismissal — called from admin page ──────────────────────────────────
exports.dismissError = onRequest(
  {secrets: ['ADMIN_SECRET'], cors: ['https://yacobwood.github.io']},
  async (req, res) => {
    if (requireAdminPost(req, res)) return;

    const {id, all} = req.body || {};
    const db = getFirestore();
    try {
      if (all) {
        const snap = await db.collection('errors').where('resolved', '==', false).get();
        const batch = db.batch();
        snap.docs.forEach(doc => batch.update(doc.ref, {resolved: true}));
        await batch.commit();
        res.status(200).json({ok: true, count: snap.size});
      } else {
        if (!id) { res.status(400).json({ok: false, error: 'id required'}); return; }
        await db.collection('errors').doc(id).update({resolved: true});
        res.status(200).json({ok: true});
      }
    } catch (e) {
      console.error('dismissError failed:', e);
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

// ── Results cache invalidation — called by GitHub Actions scraper ─────────────
// Sends a silent FCM data message to the 'results_live' topic so all app
// clients immediately discard their cached results and fetch fresh data.
// No visible notification is shown to users.
const SCRAPER_SECRET = process.env.SCRAPER_SECRET;

exports.notifyResultsUpdate = onRequest(
  {secrets: ['SCRAPER_SECRET', 'GMAIL_APP_PASSWORD']},
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    if (!SCRAPER_SECRET || req.headers['x-scraper-secret'] !== SCRAPER_SECRET) {
      res.status(401).send('Unauthorized'); return;
    }
    const year = String(req.body?.year || '2026');
    try {
      await getMessaging().send({
        topic: 'results_live',
        data: {type: 'results_refresh', year},
        // content_available wakes iOS apps that are backgrounded
        apns: {payload: {aps: {'content-available': 1}}},
        android: {priority: 'high'},
      });
      console.log(`notifyResultsUpdate: sent results_refresh for year=${year}`);

      // Re-engagement push for whichever session's result most recently
      // changed - deep-links straight to that round/session (RoundResults,
      // via notifNavigation.js's existing type:"results"+round(+race)
      // handler, no new navigation case needed), on its own topic so
      // src/store/settings.js's spoilerFree gate can fully unsubscribe
      // devices from it (RESULT_LEAF_KEYS) instead of the old behaviour of
      // sending a sanitized, non-deep-linking copy to everyone regardless -
      // changed 2026-09-05 by explicit request: spoiler-free users should
      // get no notification at all, not a deep-link-free one; everyone else
      // should land on the actual result, not just the generic Results tab.
      //
      // Deduped via computeSessionFingerprints/findChangedSession
      // (./resultsHash.js) - this endpoint gets called on every
      // scrape-results.yml tick (every 2 min on a raceday), and had no
      // dedup of its own at all before 2026-09-05, unconditionally firing a
      // visible push on every call. Confirmed live: users getting repeat "A
      // fresh result just dropped" pushes during the Croft (round 8) race
      // weekend with nothing actually new to show - standings.json's own
      // `updated` timestamp (tools/scraper/scrape_tsl.py:1332) gets
      // re-stamped on nearly every raceday run regardless of real content
      // change, which is why fingerprinting only ever hashes each session's
      // own results/grid arrays, never that field.
      try {
        const {results} = await fetchResultsAndStandings(year);
        const currentFp = computeSessionFingerprints(results);
        const stateRef = getFirestore().collection('state').doc('results_teaser');
        const snap = await stateRef.get();
        if (!snap.exists) {
          // First run ever (no prior fingerprints to diff against) - every
          // session with existing results would otherwise look "new" purely
          // because nothing was stored yet, not because anything actually
          // just changed. Same "don't notify on the very first sighting"
          // idiom as newsCheck.js's state/news.lastId bootstrap - just seed
          // the baseline silently.
          await stateRef.set({fingerprints: currentFp, sentAt: new Date().toISOString()});
          console.log('notifyResultsUpdate: first-ever run, seeding fingerprints without sending');
        } else {
          const storedFp = snap.data().fingerprints || {};
          const changed = findChangedSession(results, currentFp, storedFp);
          if (changed) {
            await stateRef.set({fingerprints: currentFp, sentAt: new Date().toISOString()});
            const title = 'A fresh result just dropped';
            const body = 'Open BTCC Hub to see how it went.';
            await getMessaging().send({
              topic: 'results_teaser',
              notification: {title, body},
              data: {type: 'results', year, round: String(changed.round), race: String(changed.raceIndex + 1)},
              android: {notification: {channelId: 'results'}},
            });
            await logPushHistory(title, body, 'results');
          } else {
            console.log('notifyResultsUpdate: no session content changed - skipping teaser push');
          }
        }
      } catch (e) {
        // Fails safe toward "don't spam": the silent results_live refresh
        // above already went out unconditionally, so app clients still get
        // fresh data regardless - they just don't get an extra nudge push
        // if this dedup check itself errors.
        console.error('notifyResultsUpdate: results_teaser send failed:', e);
      }

      res.status(200).json({ok: true});
    } catch (e) {
      console.error('notifyResultsUpdate failed:', e);
      await logError('notifyResultsUpdate', e.message, e, {alert: true});
      res.status(500).json({ok: false, error: e.message});
    }
  },
);

// Scraper failure reporting - called from GitHub Actions workflows on
// `if: failure()`, since none of them have their own way to alert us.
// Reuses the same logError/email pipeline as Cloud Function errors, so
// scraper failures show up in the same admin FIRESTORE tab.
exports.reportScraperFailure = onRequest(
  {secrets: ['SCRAPER_SECRET', 'GMAIL_APP_PASSWORD']},
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    if (!SCRAPER_SECRET || req.headers['x-scraper-secret'] !== SCRAPER_SECRET) {
      res.status(401).send('Unauthorized'); return;
    }
    const {workflow, message, runUrl} = req.body || {};
    if (!workflow) { res.status(400).json({ok: false, error: 'workflow required'}); return; }
    try {
      await logError(
        `scraper:${workflow}`,
        message || 'Workflow failed - see run log',
        {stack: runUrl || ''},
        {key: `scraper-${workflow}`, alert: true},
      );
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('reportScraperFailure failed:', e);
      res.status(500).json({ok: false, error: e.message});
    }
  },
);
