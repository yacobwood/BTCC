// Reliable replacement for scrape-results.yml's own `schedule:` trigger.
//
// Root cause (found live, 2026-09-05, Croft round 8): that workflow's cron
// (`*/2 9-19 * * 6` / `*/2 9-19 * * 0`, set 2026-06-07) asks GitHub Actions
// for a 2-minute cadence, but GitHub's own docs cap scheduled workflows at a
// 5-minute floor ("The shortest interval you can run scheduled workflows is
// once every 5 minutes") and don't guarantee even that under load. Checked
// against the workflow's entire real run history via the Actions API: not
// one single schedule-triggered tick has ever landed within 3 minutes of the
// previous one - median real gap 21.6 minutes, worst observed 230 minutes
// (3.8 hours), the entire 3 months this cron has existed. This isn't a
// one-off scheduling blip like scrape-news.yml occasionally hits - the
// schedule trigger has never delivered anywhere near what it claims to.
//
// Google Cloud Scheduler (what Firebase's own onSchedule provisions under
// the hood) has no such floor - sendSessionNotifications already runs
// 'every 1 minutes' reliably in this same codebase. So instead of asking
// GitHub to do something it's documented not to support, this function runs
// on Cloud Scheduler's reliable cadence and just calls the exact same
// workflow_dispatch endpoint the admin panel's Scrapers tab RUN button
// already uses - same dispatch, reliable trigger.
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {fetchWithTimeout, logError} = require('./shared');

const REPO = 'yacobwood/BTCC';

exports.triggerResultsScrape = onSchedule(
  {
    // Unix-cron (not the App Engine shorthand) so day-of-week/hour restriction
    // is expressed directly - Sat(6)/Sun(0), 09:00-19:00, every 2 minutes.
    // Cloud Scheduler has no 5-minute floor, unlike GitHub Actions' own
    // schedule trigger this replaces.
    schedule: '*/2 9-19 * * 0,6',
    timeZone: 'Etc/UTC',
    secrets: ['GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  async () => {
    const year = String(new Date().getFullYear());
    try {
      const res = await fetchWithTimeout(
        `https://api.github.com/repos/${REPO}/actions/workflows/scrape-results.yml/dispatches`,
        15000,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ref: 'main', inputs: {year}}),
        },
      );
      // A successful dispatch is 204 No Content, no body.
      if (res.status !== 204) {
        const body = await res.text().catch(() => '');
        throw new Error(`dispatch failed: HTTP ${res.status} ${body}`);
      }
      console.log(`triggerResultsScrape: dispatched scrape-results.yml for year=${year}`);
    } catch (e) {
      console.error('triggerResultsScrape failed:', e);
      await logError('triggerResultsScrape', e.message, e, {alert: true});
    }
  },
);
