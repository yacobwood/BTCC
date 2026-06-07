const BTCC_CHANNEL_ID = 'UCm1pFKRmvlf7vd7-Yni5MWA';
const GITHUB_REPO    = 'yacobwood/BTCC';
const LIVE_FILE_PATH = 'data/live_status.json';

// BTCC race weekends — [Saturday ISO date, Sunday ISO date]
// Update each season alongside scrape_tsl.py ROUNDS.
const RACE_WEEKENDS_2026 = [
  ['2026-04-18', '2026-04-19'], // Donington Park
  ['2026-05-09', '2026-05-10'], // Brands Hatch Indy
  ['2026-05-23', '2026-05-24'], // Snetterton
  ['2026-06-06', '2026-06-07'], // Oulton Park
  ['2026-07-25', '2026-07-26'], // Thruxton
  ['2026-08-08', '2026-08-09'], // Knockhill
  ['2026-08-22', '2026-08-23'], // Donington Park GP
  ['2026-09-05', '2026-09-06'], // Croft
  ['2026-09-26', '2026-09-27'], // Silverstone
  ['2026-10-10', '2026-10-11'], // Brands Hatch GP
];

function isRaceWeekend() {
  const today = new Date().toISOString().slice(0, 10);
  return RACE_WEEKENDS_2026.some(([sat, sun]) => today === sat || today === sun);
}

async function checkLive(youtubeApiKey) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${BTCC_CHANNEL_ID}&eventType=live&type=video&key=${youtubeApiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`YouTube API error: ${res.status}`);
    return null;
  }
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  const title = item.snippet.title;
  if (!title.includes('BTCC')) return null;
  return {
    videoId: item.id.videoId,
    title,
  };
}

async function getCurrentFile(githubToken) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${LIVE_FILE_PATH}`,
    { headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'btcc-cf-worker' } }
  );
  if (res.status === 404) return { sha: null, content: null };
  if (!res.ok) return { sha: null, content: null };
  const data = await res.json();
  return { sha: data.sha, content: JSON.parse(atob(data.content.replace(/\n/g, ''))) };
}

async function commitFile(githubToken, content, sha) {
  const body = {
    message: 'chore: update live status [skip ci]',
    content: btoa(JSON.stringify(content, null, 2)),
    committer: { name: 'github-actions[bot]', email: 'github-actions[bot]@users.noreply.github.com' },
  };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${LIVE_FILE_PATH}`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${githubToken}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'btcc-cf-worker', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  console.log(`Committed live_status.json: ${res.status}`);
}

export default {
  async scheduled(event, env, ctx) {
    if (!isRaceWeekend()) {
      console.log('Not a race weekend — skipping');
      return;
    }

    // Check YouTube for a live BTCC broadcast
    const live = await checkLive(env.YOUTUBE_API_KEY);
    const { sha, content: current } = await getCurrentFile(env.GITHUB_TOKEN);

    const next = live
      ? { active: true, liveUrl: `https://www.youtube.com/watch?v=${live.videoId}`, title: live.title }
      : { active: false, liveUrl: null, title: null };

    // Only commit if state changed
    const changed = !current || current.active !== next.active || current.liveUrl !== next.liveUrl;
    if (changed) {
      await commitFile(env.GITHUB_TOKEN, next, sha);
    }

    console.log(`Live: ${next.active}, url: ${next.liveUrl}`);
  },
};
