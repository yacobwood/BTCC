// Starts session-watcher.yml at each BTCC session's start time - one run per
// session - replacing race-day-start.yml's GitHub cron (2026-10-10).
//
// Why: race-day-start.yml was scheduled for 08:27 UTC but GitHub's schedule
// trigger actually fired it 13:08-14:34 UTC every race weekend checked
// (20 Sep to 10 Oct), so the watcher connected after most sessions had
// already finished and their winner-naming result pushes never went out.
// Same root cause and same fix as resultsDispatch.js: Cloud Scheduler runs
// on time, GitHub's schedule trigger doesn't.
//
// Why one run per session rather than one per day: a GitHub-hosted job is
// capped at 6 hours, and Sunday's Race 1 start to Race 3 result is ~6.5h, so
// a whole-day run gets killed before Race 3. A whole-day run also labels
// results by counting sessionComplete events off in order, so starting late
// mislabels everything after. A per-session run started at that session's
// start time watches exactly one session and exits.
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getFirestore} = require('firebase-admin/firestore');
const {fetchWithTimeout, logError, CALENDAR_URL, sessionToUTC, getUKDateString} = require('./shared');

const REPO = 'yacobwood/BTCC';

// Dispatch any time in the first DISPATCH_WINDOW_MS after a session starts,
// so a failed tick is retried automatically by the next one. Shorter than
// any BTCC session, so a run can never start after its own session ended.
const DISPATCH_WINDOW_MS = 10 * 60 * 1000;
// A claim this recent is another tick's in-flight dispatch, not abandoned.
const CLAIM_STALE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Pure: the BTCC sessions (calendar.json `sessions`, same source
// session_watcher.py's load_sessions reads) that started within the last
// DISPATCH_WINDOW_MS, as {round, day, label, key, startUTC}.
function findSessionsToStart(calendar, now) {
  const today = getUKDateString(now);
  const out = [];
  for (const rnd of calendar.rounds || []) {
    let day = null;
    if (rnd.startDate === today) day = 'saturday';
    else if (rnd.endDate === today) day = 'sunday';
    if (!day) continue;
    const dayCode = day === 'saturday' ? 'SAT' : 'SUN';
    for (const s of rnd.sessions || []) {
      if (s.day !== dayCode || !s.time || !s.name) continue;
      const startUTC = sessionToUTC(today, s.time);
      const sinceStart = now.getTime() - startUTC.getTime();
      if (sinceStart >= 0 && sinceStart < DISPATCH_WINDOW_MS) {
        out.push({round: rnd.round, day, label: s.name, key: `${today} R${rnd.round} ${s.name}`, startUTC});
      }
    }
  }
  return out;
}

async function dispatchOnce({round, day, label}, year) {
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${REPO}/actions/workflows/session-watcher.yml/dispatches`,
    15000,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ref: 'main', inputs: {round: String(round), day, year, session: label}}),
    },
  );
  // A successful dispatch is 204 No Content, no body.
  if (res.status !== 204) {
    const body = await res.text().catch(() => '');
    throw new Error(`dispatch failed: HTTP ${res.status} ${body}`);
  }
}

async function startDueWatchers({fetchFn = fetchWithTimeout, db, now = new Date(), dispatch = dispatchOnce} = {}) {
  const calendar = await fetchFn(CALENDAR_URL).then(r => r.json());
  const due = findSessionsToStart(calendar, now);
  if (due.length === 0) return [];

  const stateRef = db.collection('state').doc('session_watcher');
  const started = [];
  for (const session of due) {
    // Claim first so two overlapping ticks can't both dispatch (a second
    // watcher for the same session would send every result push twice).
    let claimed = false;
    await db.runTransaction(async (tx) => {
      claimed = false;
      const snap = await tx.get(stateRef);
      const entry = (snap.exists ? snap.data().dispatched || {} : {})[session.key];
      if (entry?.sentAt) return;
      if (entry?.claimedAt && now.getTime() - entry.claimedAt < CLAIM_STALE_MS) return;
      tx.set(stateRef, {dispatched: {[session.key]: {claimedAt: now.getTime()}}}, {merge: true});
      claimed = true;
    });
    if (!claimed) continue;

    const year = getUKDateString(now).slice(0, 4);
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await dispatch(session, year);
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
      }
    }

    if (!lastError) {
      await stateRef.set({dispatched: {[session.key]: {sentAt: new Date().toISOString()}}}, {merge: true});
      console.log(`startSessionWatchers: dispatched watcher for ${session.key}`);
      started.push(session.key);
      continue;
    }

    // Release the claim so the next minute's tick retries. Only alert once
    // the dispatch window is about to close with no watcher running.
    await stateRef.set({dispatched: {[session.key]: {claimedAt: 0}}}, {merge: true});
    const windowLeft = session.startUTC.getTime() + DISPATCH_WINDOW_MS - now.getTime();
    if (windowLeft <= 60 * 1000) {
      await logError('startSessionWatchers', `No watcher started for ${session.key}: ${lastError.message}`, lastError, {key: `startSessionWatchers-${session.key}`, alert: true});
    } else {
      console.warn(`startSessionWatchers: ${session.key} dispatch failed, next tick retries:`, lastError.message);
    }
  }
  return started;
}

exports.startSessionWatchers = onSchedule(
  {
    // Every minute, Sat/Sun, 07:00-19:59 UTC - covers every BTCC session
    // start in either BST or GMT. findSessionsToStart does the real gating.
    schedule: '* 7-19 * * 0,6',
    timeZone: 'Etc/UTC',
    secrets: ['GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  async () => {
    try {
      await startDueWatchers({db: getFirestore()});
    } catch (e) {
      console.error('startSessionWatchers failed:', e);
      await logError('startSessionWatchers', e.message, e, {key: 'startSessionWatchers', alert: true});
    }
  },
);

exports.findSessionsToStart = findSessionsToStart;
exports.startDueWatchers = startDueWatchers;
exports.DISPATCH_WINDOW_MS = DISPATCH_WINDOW_MS;
