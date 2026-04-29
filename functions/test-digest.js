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
const envPath = path.join(__dirname, '.env');
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
    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
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
      if (title) results.push({source: sourceName, title, text: desc.slice(0, 400), url: link});
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
      `You are writing a weekly round-up for the BTCC Hub fan app. ` +
      `Based on the sources below, write a concise engaging article (3–5 paragraphs) ` +
      `looking back at everything that happened in BTCC over the past 7 days — ` +
      `race results, driver news, team updates, fan reaction and anything else noteworthy. ` +
      `Write the body in HTML using only <p> tags — no headers, no bullet points, no images. ` +
      `Do not include the title in the body.\n\n`;
  } else {
    // Thursday — find next race weekend from calendar
    const calendar = await fetch(CALENDAR_URL).then(r => r.json());
    // Find the next upcoming round
    const upcoming = calendar.rounds
      .filter(r => r.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    if (upcoming) {
      console.log(`\n  Mode: Thursday preview — ${upcoming.venue} (${upcoming.startDate})\n`);
      promptIntro =
        `You are writing a race weekend preview for the BTCC Hub fan app. ` +
        `This weekend the BTCC heads to ${upcoming.venue} (${upcoming.location}). ` +
        `Based on the sources below, write a concise exciting article (3–5 paragraphs) ` +
        `building anticipation for the weekend ahead — who to watch, storylines going in, ` +
        `championship picture, what makes this venue special, and anything fans should know. ` +
        `Write the body in HTML using only <p> tags — no headers, no bullet points, no images. ` +
        `Do not include the title in the body.\n\n`;
    } else {
      console.log('\n  Mode: Thursday preview — no upcoming round found, using generic prompt\n');
      promptIntro =
        `You are writing a race weekend preview for the BTCC Hub fan app. ` +
        `Based on the sources below, write a concise exciting article (3–5 paragraphs) ` +
        `building anticipation for the upcoming weekend. ` +
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
      'https://www.reddit.com/r/BTCC/top.json?t=week&limit=15',
      {headers: {'User-Agent': 'BTCCHubBot/1.0 by BTCC_Hub'}},
    );
    const data = await res.json();
    const posts = (data?.data?.children ?? []).filter(c => c.data.score >= 3);
    for (const child of posts) {
      const p = child.data;
      sources.push({source: 'Reddit r/BTCC', title: p.title, text: p.selftext?.slice(0, 500) || '', url: `https://reddit.com${p.permalink}`});
    }
    console.log(`  ✓ Reddit r/BTCC: ${posts.length} items`);
  } catch (e) {
    console.log(`  ✗ Reddit r/BTCC: ${e.message}`);
  }

  try {
    const posts = await fetch(
      'https://www.btcc.net/wp-json/wp/v2/posts?per_page=5&_fields=title,excerpt,link&orderby=date',
    ).then(r => r.json());
    for (const post of posts) {
      const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() ?? '';
      sources.push({source: 'BTCC.net', title: post.title?.rendered ?? '', text: excerpt.slice(0, 400), url: post.link});
    }
    console.log(`  ✓ BTCC.net: ${posts.length} items`);
  } catch (e) {
    console.log(`  ✗ BTCC.net: ${e.message}`);
  }

  const rssResults = await Promise.all([
    scrapeRss('https://www.autosport.com/rss/btcc/news/', 'Autosport'),
    scrapeRss('https://www.motorsport.com/rss/btcc/news/', 'Motorsport.com'),
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

  const client = new Anthropic.default({apiKey: API_KEY});
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content:
        promptIntro +
        `Style rules you must follow:\n` +
        `- Never use a comma before "and"\n` +
        `- Never use em dashes (— or –)\n` +
        `- The title and body must feel completely distinct from any previously published article. Do not reuse phrasing, angles or story structures from these existing titles:\n` +
        hubNews.posts.slice(0, 20).map(p => `  • ${p.title}`).join('\n') + '\n\n' +
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
