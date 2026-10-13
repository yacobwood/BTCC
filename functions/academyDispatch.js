// Fires publish-scheduled-explainers.yml at 19:00 UK every evening, so
// accepted Academy articles go out on time. Replaces that workflow's own
// `schedule:` trigger, which never ran on time on this repo: on the first
// evening (2026-10-13) none of its three crons (18:07/19:07/20:37 UTC) had
// started by 22:16 BST, so the first article never published. Same fix and
// shape as resultsDispatch.js: Cloud Scheduler is reliable to the minute,
// and a workflow_dispatch run starts straight away.
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {fetchWithTimeout, logError} = require('./shared');

const REPO = 'yacobwood/BTCC';
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchOnce() {
  const res = await fetchWithTimeout(
    `https://api.github.com/repos/${REPO}/actions/workflows/publish-scheduled-explainers.yml/dispatches`,
    15000,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      // No `force` - the script's own 19:00-21:59 window still applies.
      body: JSON.stringify({ref: 'main'}),
    },
  );
  if (res.status !== 204) {
    const body = await res.text().catch(() => '');
    throw new Error(`dispatch failed: HTTP ${res.status} ${body}`);
  }
}

exports.triggerAcademyAutoPublish = onSchedule(
  {
    // Europe/London so it stays 19:00 across the BST/GMT change.
    schedule: '0 19 * * *',
    timeZone: 'Europe/London',
    secrets: ['GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  async () => {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await dispatchOnce();
        console.log(`triggerAcademyAutoPublish: dispatched publish-scheduled-explainers.yml${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
        return;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`triggerAcademyAutoPublish: attempt ${attempt} failed, retrying:`, e.message);
          await sleep(RETRY_DELAY_MS);
        }
      }
    }
    console.error('triggerAcademyAutoPublish failed:', lastError);
    await logError('triggerAcademyAutoPublish', lastError.message, lastError, {key: 'triggerAcademyAutoPublish', alert: true});
  },
);
