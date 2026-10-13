// Auto-publishes accepted Academy articles on their scheduledDate - run by
// .github/workflows/publish-scheduled-explainers.yml. Only articles the
// admin has explicitly marked `accepted: true` (ACADEMY tab "Accept" button)
// are ever touched; anything not accepted stays staged until it's published
// by hand, exactly as before this existed.
//
//   node scripts/explainerAutoPublish.js publish   - flips due articles to
//     published in data/explainer_articles.json and writes the notifications
//     to send into NOTIFS_FILE (JSON array)
//   node scripts/explainerAutoPublish.js notify    - waits for each article
//     in NOTIFS_FILE to be served as published by raw.githubusercontent.com,
//     then dispatches send-broadcast-notif.yml for it (needs GH_TOKEN)
//
// The notification only goes out once the article is confirmed live, same
// rule as the admin's own publish path (waitForExplainerLive) - a push for
// content a device can't fetch yet is worse than none.

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'explainer_articles.json');
const REPO = process.env.GITHUB_REPOSITORY || 'yacobwood/BTCC';
const PUBLISH_HOUR_LONDON = 19;
// Last hour a run may still publish (21:xx). GitHub's own schedule trigger
// proved to run hours late on this repo (none of the three 2026-10-13
// evening crons had started by 22:16), so a late trigger must never fire a
// notification at night - it does nothing and the article waits for the
// next evening's run instead. A forced manual run ignores the window.
const LAST_PUBLISH_HOUR_LONDON = 21;
// An accepted article more than this many days past its scheduledDate is
// skipped rather than published, so a long Actions outage (or a batch of
// old dates) can't fire a burst of notifications in one run.
const MAX_OVERDUE_DAYS = 3;

function londonParts(now) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, x.value]));
  return {date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour)};
}

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000);
}

// Returns {due, overdue}: due = accepted, unpublished, dated today or up to
// MAX_OVERDUE_DAYS ago; overdue = accepted but too old to auto-publish.
function selectDue(posts, today) {
  const due = [], overdue = [];
  for (const p of posts) {
    if (p.status === 'published' || p.accepted !== true || !p.scheduledDate) continue;
    const late = daysBetween(p.scheduledDate.slice(0, 10), today);
    if (late < 0) continue;
    (late <= MAX_OVERDUE_DAYS ? due : overdue).push(p);
  }
  return {due, overdue};
}

// Mirrors the admin's Save & Publish: the notification override wins over
// the headline, and is consumed (deleted) once a publish has used it.
function publishArticle(p, nowIso) {
  const notif = {
    id: p.id,
    title: p.notifTitleOverride || p.title || 'New Academy article',
    body: p.notifBodyOverride || '',
    imageUrl: p.imageUrl || '',
  };
  p.status = 'published';
  p.pubDate = p.pubDate || nowIso;
  delete p.notifTitleOverride;
  delete p.notifBodyOverride;
  return notif;
}

function runPublish({now = new Date(), force = false} = {}) {
  const {date, hour} = londonParts(now);
  if (!force && (hour < PUBLISH_HOUR_LONDON || hour > LAST_PUBLISH_HOUR_LONDON)) {
    console.log(`London time is ${hour}:xx, outside the ${PUBLISH_HOUR_LONDON}:00-${LAST_PUBLISH_HOUR_LONDON}:59 publish window - nothing to do.`);
    return [];
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  const {due, overdue} = selectDue(data.posts || [], date);
  for (const p of overdue) {
    console.log(`::warning::Skipped "${p.title}" - accepted but scheduled ${p.scheduledDate}, more than ${MAX_OVERDUE_DAYS} days ago. Publish it by hand if it should still go out.`);
  }
  const notifs = due.map(p => {
    console.log(`Publishing "${p.title}" (scheduled ${p.scheduledDate})`);
    return publishArticle(p, now.toISOString());
  });
  if (notifs.length) fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
  else console.log('No accepted articles due today.');
  return notifs;
}

async function waitForLive(id, {timeoutMs = 600000, intervalMs = 5000} = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/data/explainer_articles.json?t=${Date.now()}`);
      if (r.ok) {
        const post = ((await r.json()).posts || []).find(p => p.id === id);
        if (post && post.status === 'published') return true;
      }
    } catch {
      // transient - keep polling until the deadline
    }
    if (Date.now() >= deadline) return false;
    await new Promise(res => setTimeout(res, intervalMs));
  }
}

async function dispatchNotif(n) {
  const inputs = {
    channel: 'explainer',
    title: n.title,
    body: n.body,
    data: JSON.stringify({type: 'explainer', id: n.id}),
    image_url: n.imageUrl,
    topic: 'explainer_alerts',
  };
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/send-broadcast-notif.yml/dispatches`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json'},
      body: JSON.stringify({ref: 'main', inputs}),
    });
    if (r.ok) return;
    if (attempt >= 3) throw new Error(`dispatch failed for ${n.id}: HTTP ${r.status} ${await r.text()}`);
    await new Promise(res => setTimeout(res, 5000 * attempt));
  }
}

async function runNotify(notifs) {
  const failed = [];
  for (const n of notifs) {
    if (!(await waitForLive(n.id))) {
      failed.push(`${n.id} (never confirmed live - notification NOT sent)`);
      continue;
    }
    try {
      await dispatchNotif(n);
      console.log(`Notification dispatched for ${n.id}`);
    } catch (e) {
      failed.push(`${n.id} (${e.message})`);
    }
  }
  if (failed.length) throw new Error('Published but not notified: ' + failed.join('; '));
}

module.exports = {londonParts, selectDue, publishArticle, runPublish, MAX_OVERDUE_DAYS};

if (require.main === module) {
  const mode = process.argv[2];
  const notifsFile = process.env.NOTIFS_FILE || 'explainer-notifs.json';
  (async () => {
    if (mode === 'publish') {
      const notifs = runPublish({force: process.env.FORCE === 'true'});
      fs.writeFileSync(notifsFile, JSON.stringify(notifs));
    } else if (mode === 'notify') {
      const notifs = fs.existsSync(notifsFile) ? JSON.parse(fs.readFileSync(notifsFile, 'utf8')) : [];
      await runNotify(notifs);
    } else {
      throw new Error('usage: explainerAutoPublish.js publish|notify');
    }
  })().catch(e => { console.error(e.message); process.exit(1); });
}
