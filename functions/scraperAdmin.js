const {onRequest} = require('firebase-functions/v2/https');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');
const {logError, requireAdminPost} = require('./shared');

// ── Error dismissal — called from admin page ──────────────────────────────────
exports.dismissError = onRequest(
  {cors: ['https://yacobwood.github.io']},
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

      // Spoiler-safe re-engagement push - deliberately generic copy (no round/
      // venue/session context available from this request body, and the
      // whole point is to never state the result), on its own topic so
      // src/store/settings.js's spoilerFree gate can never suppress it the
      // way it suppresses resultsRace*. Reuses the existing type:"results"
      // (no round) fallback in notifNavigation.js, which already just opens
      // the Results tab - no new navigation case needed.
      try {
        await getMessaging().send({
          topic: 'results_teaser',
          notification: {
            title: 'A fresh result just dropped',
            body: 'Open BTCC Hub to see how it went.',
          },
          data: {type: 'results'},
          android: {notification: {channelId: 'results'}},
        });
      } catch (e) {
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
