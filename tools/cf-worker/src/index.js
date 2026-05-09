export default {
  async scheduled(event, env, ctx) {
    const res = await fetch(
      'https://api.github.com/repos/yacobwood/BTCC/actions/workflows/scrape-results.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'btcc-cf-worker',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );
    console.log(`Dispatched: ${res.status}`);
  },
};
