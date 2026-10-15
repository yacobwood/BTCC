// Reliable replacement for scrape-news.yml's own `schedule:` trigger.
//
// Same root cause as resultsDispatch.js's triggerResultsScrape, found live
// 2026-09-26 (Silverstone round): GitHub Actions' own `schedule:` trigger is
// best-effort and gets silently dropped under load, not queued or retried.
// Checked against this workflow's real run history via the Actions API: on
// 2026-09-25 (an ordinary day, no live session) only 5 of the ~155 ticks its
// own cron (`3-59/5 7-19 * * *` + `3 0-6,20-23 * * *`) should have produced
// actually landed. On 2026-09-26, with session-watcher.yml/Cloud Scheduler's
// own triggerResultsScrape dispatching scrape-results.yml every ~2 minutes
// non-stop for live coverage, only 3 ticks landed all day - the user had to
// manually re-dispatch the workflow repeatedly just to get a published
// btcc.net article showing up in the app.
//
// Same fix: run on Google Cloud Scheduler instead, which has no 5-minute
// floor and isn't affected by GitHub's own Actions queue contention, and
// just call the same workflow_dispatch endpoint the admin panel's Scrapers
// tab RUN button already uses.
//
// Two exported functions rather than one, mirroring scrape-news.yml's own
// two cron lines exactly - Cloud Scheduler's unix-cron can't express "every
// 5 minutes in this hour range, hourly in that one" as a single expression.
//
// Busy window slowed from every 5 to every 10 minutes on 2026-10-15: once
// this trigger actually delivered every tick, the real Scrapfly bill (~60
// credits x 167 runs/day, ~10-13k/day) ran through the 200k/month
// subscription by the 15th - the original 5-minute sizing had only ever
// been tested against GitHub's own cron, which dropped ~97% of runs.
// Together with listing_cache.py (one /news/ fetch per run instead of two)
// that's ~89 runs x ~30 credits, ~2.7k/day, ~80-85k/month before article
// and image fetches. Trade-off: a new btcc.net article can now take up to
// 10 minutes (not 5) to reach the app in UK daytime.
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {fetchWithTimeout, logError} = require('./shared');

const REPO = 'yacobwood/BTCC';

// Same one-bare-retry-before-alerting convention as triggerResultsScrape
// (2026-09-13) - a transient GitHub dispatch-endpoint blip should self-heal
// automatically, not page a human every time.
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchOnce() {
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${REPO}/actions/workflows/scrape-news.yml/dispatches`,
    15000,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ref: 'main'}),
    },
  );
  // A successful dispatch is 204 No Content, no body.
  if (res.status !== 204) {
    const body = await res.text().catch(() => '');
    throw new Error(`dispatch failed: HTTP ${res.status} ${body}`);
  }
}

async function triggerNewsScrape(fnName) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await dispatchOnce();
      console.log(`${fnName}: dispatched scrape-news.yml${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
      return;
    } catch (e) {
      lastError = e;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`${fnName}: attempt ${attempt} failed, retrying:`, e.message);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  console.error(`${fnName} failed:`, lastError);
  await logError(fnName, lastError.message, lastError, {key: fnName, alert: true});
}

// Temporary hourly-only mode until the Scrapfly quota resets on 1 Nov
// 2026: October's 200k ran out on the 15th, so the rest of the month is
// billed pay-as-you-go. Until then only the :03 tick of each busy hour
// dispatches (same cadence as overnight); the other five ticks are
// skipped. Reverts to every 10 minutes by itself on 1 Nov - no second
// deploy needed. Off-season, so an hour's lag on a new article is fine.
const HOURLY_UNTIL = Date.UTC(2026, 10, 1); // 2026-11-01T00:00Z

function isHourlyOnlySkip(scheduleTime) {
  const t = scheduleTime ? new Date(scheduleTime) : new Date();
  // < 10, not === 3: allows for the function starting a little late when
  // scheduleTime isn't available. The next tick is :13.
  return t.getTime() < HOURLY_UNTIL && t.getUTCMinutes() >= 10;
}

exports.triggerNewsScrapeBusy = onSchedule(
  {
    schedule: '3-59/10 7-19 * * *',
    timeZone: 'Etc/UTC',
    secrets: ['GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  (event) => {
    if (isHourlyOnlySkip(event && event.scheduleTime)) {
      console.log('triggerNewsScrapeBusy: hourly-only until 1 Nov (Scrapfly PAYG), skipping this tick');
      return null;
    }
    return triggerNewsScrape('triggerNewsScrapeBusy');
  },
);

exports.triggerNewsScrapeOvernight = onSchedule(
  {
    schedule: '3 0-6,20-23 * * *',
    timeZone: 'Etc/UTC',
    secrets: ['GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  () => triggerNewsScrape('triggerNewsScrapeOvernight'),
);
