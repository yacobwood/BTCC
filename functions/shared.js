// Shared helpers used across the split-out function files (sessionNotifications.js,
// digest.js, chat.js, analytics.js, scraperAdmin.js, appEndpoints.js). Split out of
// what used to be one 1470-line index.js on 2026-08-25 - see git history before this
// commit for the original monolith.
const {getFirestore} = require('firebase-admin/firestore');

// ── Error observability ───────────────────────────────────────
// opts.key   — upsert at errors/{key} instead of appending (use for repetitive per-minute errors)
// opts.alert — also send an email to btcchub@gmail.com
async function logError(fn, message, err, opts = {}) {
  try {
    const db = getFirestore();
    const entry = {
      fn,
      message: String(message).slice(0, 500),
      stack: (err?.stack || '').slice(0, 2000),
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    let shouldAlert = !!opts.alert;
    if (opts.key) {
      const ref = db.collection('errors').doc(opts.key);
      if (opts.alert) {
        // Only alert on first occurrence or when error recurs after being resolved
        const existing = await ref.get();
        shouldAlert = !existing.exists || existing.data().resolved === true;
      }
      await ref.set(entry);
    } else {
      await db.collection('errors').add(entry);
    }
    if (shouldAlert && process.env.GMAIL_APP_PASSWORD) {
      await sendErrorEmail(fn, message, err);
    }
  } catch (e) {
    console.error('logError itself failed:', e);
  }
}

async function logPushHistory(title, body, channel) {
  try {
    const db = getFirestore();
    await db.collection('push_history').add({
      title, body, channel, type: 'auto', sentAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('logPushHistory failed:', e);
  }
}

async function sendErrorEmail(fn, message, err) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {user: 'btcchub@gmail.com', pass: process.env.GMAIL_APP_PASSWORD},
  });
  await transporter.sendMail({
    from: '"BTCC Hub" <btcchub@gmail.com>',
    to: 'btcchub@gmail.com',
    subject: `[BTCC Hub Error] ${fn}`,
    text: `Function: ${fn}\nMessage: ${message}\n\nStack:\n${err?.stack || 'n/a'}\n\nTime: ${new Date().toISOString()}`,
  });
}

const CALENDAR_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json';
const SCHEDULE_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/schedule.json';
const HUB_NEWS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_news.json';
// Just the newest page - articles.json was split into per-page files
// (data/articles/page_<n>.json) so a list/search/slug fetch never has to
// download the whole archive; this digest-context use only ever wants the
// most recent handful anyway (sliced to 15 in digest.js).
const ARTICLES_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/articles/page_1.json';
const PODCAST_RSS_URL = 'https://rss.buzzsprout.com/1065916.rss';

// Wrap fetch with a hard timeout so a hanging external service never causes a 504.
// Cloud Run kills the function at 60s; default 10s, btcc.net WordPress uses 20s.
function fetchWithTimeout(url, ms = 10000, options = {}) {
  return fetch(url, {...options, signal: AbortSignal.timeout(ms)});
}

// Session name → FCM topic (must match LEAF_TOPICS in src/store/settings.js)
const SESSION_TOPICS = {
  'Free Practice':   'pre_fp',
  'Qualifying':      'pre_qualifying',
  'Qualifying Race': 'pre_qrace',
  'Race 1':          'pre_race1',
  'Race 2':          'pre_race2',
  'Race 3':          'pre_race3',
};

// Session name → Android notification channel
const SESSION_CHANNELS = {
  'Free Practice': 'free_practice',
  'Qualifying': 'qualifying',
  'Qualifying Race': 'race',
  'Race 1': 'race',
  'Race 2': 'race',
  'Race 3': 'race',
};

/**
 * Converts a session date + local UK time string to a UTC Date.
 * Handles BST/GMT automatically via Intl.
 */
function sessionToUTC(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  // Check what UTC offset London has at midday on this date
  const midday = new Date(Date.UTC(year, month - 1, day, 12, 0));
  const londonMiddayHour = parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      hour12: false,
    }).format(midday),
    10,
  );
  const ukOffset = londonMiddayHour - 12; // 0 = GMT, 1 = BST

  return new Date(Date.UTC(year, month - 1, day, hour - ukOffset, minute));
}

/**
 * Returns current time parts in Europe/London timezone.
 */
function getUKTimeParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return {
    weekday: parts.find(p => p.type === 'weekday')?.value,
    hour: parseInt(parts.find(p => p.type === 'hour')?.value, 10),
    minute: parseInt(parts.find(p => p.type === 'minute')?.value, 10),
  };
}

/**
 * Returns a YYYY-MM-DD string for the UK date offsetDays from the given date.
 */
function getUKDateString(date, offsetDays = 0) {
  const d = new Date(date.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// Shared by every admin-page-triggered onRequest function (triggerDigest,
// dismissError, backfillAnalyticsDaily, setChatDonor, lookupUserByEmail) to
// authenticate the caller. No hardcoded fallback, deliberately - the old
// 'btcchub-digest-trigger-2026' default was also hardcoded into
// admin/standings-admin.html's TRIGGER_DIGEST_SECRET, a publicly-served
// static file with no server-side gate, which meant the real secret was
// readable by anyone who viewed the page's source (its SHA-256 login gate
// only hides the UI, it never touches these endpoints). The current value
// lives only in Firebase Secret Manager (`firebase functions:secrets:set
// ADMIN_SECRET`) - never commit it to this repo in any form, including a
// README or comment. For local/emulator use, set it in functions/.env.local
// (already gitignored, never committed).
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Standard guard for admin-page-triggered onRequest functions (triggerDigest,
// dismissError, backfillAnalyticsDaily, setChatDonor, lookupUserByEmail) -
// rejects non-POST requests and requests missing/wrong x-admin-secret,
// writing the response itself in either case. Callers do:
//   if (requireAdminPost(req, res)) return;
// as their very first line, before touching req.body. Not used by
// notifyResultsUpdate/reportScraperFailure, which authenticate against
// SCRAPER_SECRET instead - a different caller (GitHub Actions), not the
// admin page.
//
// EVERY caller of this function MUST also declare `secrets: ['ADMIN_SECRET']`
// in its own onRequest options object (alongside any other secrets it
// needs) - found live 2026-08-29: referencing process.env.ADMIN_SECRET in
// code is not enough on its own. Firebase Functions v2 only injects a
// Secret Manager value into a given function's runtime if that function
// explicitly lists it in `secrets: [...]`; without that, the module-level
// const above silently reads whatever plain (non-Secret-Manager)
// environment variable of the same name already happens to be configured
// on that Cloud Run service - in this case, a stale value set independently
// of this repo at some point in the past, which kept authenticating
// successfully even after this file's own fallback was removed and a new
// value was set in Secret Manager. Confirmed live via curl: the real new
// secret was rejected with 401, while the old hardcoded value kept working,
// until `secrets: ['ADMIN_SECRET']` was added to every one of these 5
// functions and redeployed.
function requireAdminPost(req, res) {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return true; }
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) { res.status(401).send('Unauthorized'); return true; }
  return false;
}

module.exports = {
  logError,
  logPushHistory,
  fetchWithTimeout,
  CALENDAR_URL,
  SCHEDULE_URL,
  HUB_NEWS_URL,
  ARTICLES_URL,
  PODCAST_RSS_URL,
  SESSION_TOPICS,
  SESSION_CHANNELS,
  sessionToUTC,
  getUKTimeParts,
  getUKDateString,
  ADMIN_SECRET,
  requireAdminPost,
};
