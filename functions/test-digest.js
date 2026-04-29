/**
 * Full end-to-end test — scrapes, asks Claude, commits draft to hub_news.json.
 *
 * Run with:
 *   node test-digest.js monday     ← weekly round-up
 *   node test-digest.js thursday   ← race weekend preview
 *
 * Keys are loaded from functions/.env automatically.
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Load .env from the same directory as this script
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const GH_TOKEN = process.env.GITHUB_TOKEN;

if (!API_KEY || !GH_TOKEN) {
  console.error('Missing keys. Create functions/.env with:');
  console.error('  ANTHROPIC_API_KEY=sk-ant-...');
  console.error('  GITHUB_TOKEN=ghp_...');
  process.exit(1);
}

const mode = process.argv[2];
if (!mode || !['monday', 'thursday'].includes(mode)) {
  console.error('Usage:');
  console.error('  node test-digest.js monday     ← weekly round-up');
  console.error('  node test-digest.js thursday   ← race weekend preview');
  process.exit(1);
}

const DIGEST_HERO = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_images/digest/weekly-digest-hero.png';
const GITHUB_API = 'https://api.github.com/repos/yacobwood/BTCC/contents/data/hub_news.json';
const CALENDAR_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json';
const ghHeaders = {
  Authorization: `Bearer ${GH_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function scrapeRss(url, sourceName) {
  const results = [];
  try {
    const text = await fetch(url).then(r => r.text());
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12);
    for (const item of items) {
      const title =
        (item[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
          item[1].match(/<title>(.*?)<\/title>/))?.[1] ?? '';
      const desc =
        (item[1].match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
          item[1].match(/<description>(.*?)<\/description>/))?.[1]
          ?.replace(/<[^>]+>/g, '')
          .trim() ?? '';
      const link =
        (item[1].match(/<link>(.*?)<\/link>/) ||
          item[1].match(/<link\s[^>]+href="([^"]+)"/))?.[1]?.trim() ?? '';
      if (title) results.push({source: sourceName, title, text: desc.slice(0, 500), url: link});
    }
    console.log(`  ✓ ${sourceName}: ${results.length} items`);
  } catch (e) {
    console.log(`  ✗ ${sourceName}: ${e.message}`);
  }
  return results;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const postId = `digest-${today}`;

  // ── Build prompt intro based on mode ─────────────────────
  let promptIntro;
  if (mode === 'monday') {
    console.log('\n  Mode: Monday round-up\n');
    promptIntro =
      `You are a passionate, opinionated British BTCC fan writing a weekly round-up for the BTCC Hub fan app. ` +
      `Write like someone who was glued to their TV or at the circuit all weekend — not a journalist, not a press release. ` +
      `Use British English throughout. ` +
      `Cover the past 7 days: race results, driver performances, team news, championship picture, fan reaction and anything else worth talking about. ` +
      `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
      `Have opinions — say who impressed you, who disappointed, what surprised you. ` +
      `Write the body in HTML using only <p> tags — no headers, no bullet points, no images. ` +
      `Do not include the title in the body.\n\n`;
  } else {
    // Thursday — find next race weekend from calendar
    const calendar = await fetch(CALENDAR_URL).then(r => r.json());
    const upcoming = calendar.rounds
      .filter(r => r.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    if (upcoming) {
      console.log(`\n  Mode: Thursday preview — ${upcoming.venue} (${upcoming.startDate})\n`);
      promptIntro =
        `You are a passionate, opinionated British BTCC fan writing a race weekend preview for the BTCC Hub fan app. ` +
        `Write like someone who can't wait for the weekend — not a journalist, not a press release. ` +
        `Use British English throughout. ` +
        `This weekend the BTCC heads to ${upcoming.venue} (${upcoming.location}). ` +
        `Build genuine anticipation: who to watch, the storylines going in, the championship battle, what makes this circuit special, and any team or driver news fans need to know. ` +
        `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
        `Have opinions — get fans excited, make predictions, say who you think will shine or struggle. ` +
        `Write the body in HTML using only <p> tags — no headers, no bullet points, no images. ` +
        `Do not include the title in the body.\n\n`;
    } else {
      console.log('\n  Mode: Thursday preview — no upcoming round found, using generic prompt\n');
      promptIntro =
        `You are a passionate, opinionated British BTCC fan writing a race weekend preview for the BTCC Hub fan app. ` +
        `Write like someone who can't wait for the weekend — not a journalist, not a press release. ` +
        `Use British English throughout. ` +
        `Build genuine anticipation for the upcoming BTCC round: who to watch, storylines going in, the championship picture and anything else fans need to know. ` +
        `Write 5 to 7 paragraphs. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
        `Have opinions — get fans excited, make predictions, say who you think will shine or struggle. ` +
        `Write the body in HTML using only <p> tags — no headers, no bullet points, no images. ` +
        `Do not include the title in the body.\n\n`;
    }
  }

  // ── Fetch current hub_news.json ───────────────────────────
  console.log('── Fetching hub_news.json from GitHub ───────────────\n');
  const fileRes = await fetch(GITHUB_API, {headers: ghHeaders});
  if (!fileRes.ok) throw new Error(`GitHub GET failed: ${fileRes.status}`);
  const fileData = await fileRes.json();
  const hubNews = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

  if (hubNews.posts.some(p => p.id === postId)) {
    console.log(`Draft ${postId} already exists in hub_news.json — nothing to do.`);
    return;
  }
  console.log(`  ✓ Fetched (${hubNews.posts.length} existing posts, sha: ${fileData.sha.slice(0, 7)})`);

  // ── Scrape sources ────────────────────────────────────────
  console.log('\n── Scraping sources ─────────────────────────────────\n');
  const sources = [];

  try {
    const res = await fetch(
      'https://www.reddit.com/r/BTCC/top.json?t=week&limit=30',
      {headers: {'User-Agent': 'BTCCHubBot/1.0 by BTCC_Hub'}},
    );
    const data = await res.json();
    const posts = (data?.data?.children ?? []).filter(c => c.data.score >= 3);
    for (const child of posts) {
      const p = child.data;
      sources.push({source: 'Reddit r/BTCC', title: p.title, text: p.selftext?.slice(0, 800) || '', url: `https://reddit.com${p.permalink}`});
    }
    console.log(`  ✓ Reddit r/BTCC: ${posts.length} items`);
  } catch (e) {
    console.log(`  ✗ Reddit r/BTCC: ${e.message}`);
  }

  try {
    const posts = await fetch(
      'https://www.btcc.net/wp-json/wp/v2/posts?per_page=15&_fields=title,excerpt,link&orderby=date',
    ).then(r => r.json());
    for (const post of posts) {
      const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() ?? '';
      sources.push({source: 'BTCC.net', title: post.title?.rendered ?? '', text: excerpt.slice(0, 600), url: post.link});
    }
    console.log(`  ✓ BTCC.net: ${posts.length} items`);
  } catch (e) {
    console.log(`  ✗ BTCC.net: ${e.message}`);
  }

  const rssResults = await Promise.all([
    scrapeRss('https://www.autosport.com/rss/btcc/news/', 'Autosport'),
    scrapeRss('https://www.motorsport.com/rss/btcc/news/', 'Motorsport.com'),
    scrapeRss('https://touringcartimes.com/feed/', 'Touring Car Times'),
  ]);
  sources.push(...rssResults.flat());

  console.log(`\n── ${sources.length} total items collected ──────────────────────\n`);

  if (sources.length === 0) {
    console.log('No sources found. Nothing to digest.');
    return;
  }

  sources.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.source}: ${s.title}`);
  });

  // ── Ask Claude ────────────────────────────────────────────
  console.log('\n── Asking Claude to write the article ───────────────\n');

  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] ${s.source}: "${s.title}"\n${s.text || '(no excerpt)'}`)
    .join('\n\n');

  // Build cross-reference context from previous digest articles
  const prevDigests = hubNews.posts
    .filter(p => p.category === 'Weekly Digest' && p.id !== postId)
    .slice(0, 8);
  const prevDigestBlock = prevDigests.length
    ? prevDigests.map(p => {
        const plain = (p.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);
        return `  • "${p.title}"\n    ${plain}`;
      }).join('\n\n')
    : '  (none yet — this is the first digest)';

  const client = new Anthropic.default({apiKey: API_KEY});
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2200,
    messages: [{
      role: 'user',
      content:
        promptIntro +
        `Writing rules — follow all of these without exception:\n` +
        `- Write in British English (tyre not tire, colour not color, etc.)\n` +
        `- Never use a comma before "and"\n` +
        `- Never use em dashes (— or –)\n` +
        `- Never start a sentence with "It's worth noting", "Furthermore", "Additionally", "Moreover" or "In conclusion"\n` +
        `- Never use the words: delve, showcase, navigate, elevate, crucial, pivotal, fascinating, notably, seamlessly, underscores, landscape\n` +
        `- Avoid passive voice where active is possible\n` +
        `- Use specific names, lap times, positions and details rather than vague generalities\n` +
        `- Express opinions and reactions — this is a fan writing for fans, not a wire report\n` +
        `- The title and body must feel completely distinct from any previously published article. Do not reuse phrasing, angles or story structures from these existing titles:\n` +
        hubNews.posts.slice(0, 20).map(p => `  • ${p.title}`).join('\n') + '\n\n' +
        `- Do not repeat a topic, story or driver storyline from a previous digest unless genuinely new information has emerged. If revisiting a recurring story, acknowledge only what has changed and move on:\n` +
        prevDigestBlock + '\n\n' +
        `Respond with ONLY valid JSON in exactly this format (no markdown, no extra text):\n` +
        `{"title":"<short punchy headline>","content":"<HTML body>","description":"<one sentence summary>"}\n\n` +
        `Sources:\n${sourceBlock}`,
    }],
  });

  let title = `BTCC Digest — ${today}`;
  let content = '<p>No content generated.</p>';
  let description = '';
  try {
    const parsed = JSON.parse(message.content[0].text);
    title = parsed.title || title;
    content = parsed.content || content;
    description = parsed.description || '';
  } catch (e) {
    console.error('Failed to parse Claude response:', e);
    content = `<p>${message.content[0].text}</p>`;
  }

  console.log('TITLE:   ', title);
  console.log('SUMMARY: ', description);
  console.log('\nCONTENT:\n', content);

  // ── Commit to hub_news.json ───────────────────────────────
  console.log('\n── Committing draft to hub_news.json ────────────────\n');

  const newPost = {
    id: postId,
    title,
    description,
    content,
    imageUrl: DIGEST_HERO,
    pubDate: `${today}T08:00:00`,
    category: 'Weekly Digest',
    source: 'btcc-hub',
    status: 'draft',
  };

  hubNews.posts.unshift(newPost);

  const updatedContent = Buffer.from(JSON.stringify(hubNews, null, 2)).toString('base64');
  const putRes = await fetch(GITHUB_API, {
    method: 'PUT',
    headers: {...ghHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      message: `${mode} digest draft — ${today}`,
      content: updatedContent,
      sha: fileData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub PUT failed: ${putRes.status} ${err}`);
  }

  console.log(`  ✓ Draft committed as "${postId}"`);
  console.log(`\n  View in admin: https://yacobwood.github.io/BTCC/admin/standings-admin.html`);
}

main().catch(console.error);
