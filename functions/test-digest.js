/**
 * Run with:  ANTHROPIC_API_KEY=sk-ant-... node test-digest.js
 *
 * Runs the full dailyDigest pipeline (scrape → Claude → output)
 * without touching Firebase at all. Safe to run any time.
 */

const Anthropic = require('@anthropic-ai/sdk');

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Set ANTHROPIC_API_KEY env var first:');
  console.error('  ANTHROPIC_API_KEY=sk-ant-... node test-digest.js');
  process.exit(1);
}

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
  console.log('\n── Scraping sources ─────────────────────────────────\n');

  const sources = [];

  // Reddit r/BTCC
  try {
    const res = await fetch(
      'https://www.reddit.com/r/BTCC/top.json?t=day&limit=15',
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

  // BTCC.net
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

  // RSS feeds
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

  // Print what we collected
  sources.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.source}`);
    console.log(`    ${s.title}`);
    if (s.text) console.log(`    ${s.text.slice(0, 120)}…`);
    console.log();
  });

  console.log('── Asking Claude to write the article ───────────────\n');

  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] ${s.source}: "${s.title}"\n${s.text || '(no excerpt)'}`)
    .join('\n\n');

  const client = new Anthropic.default({apiKey: API_KEY});
  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content:
          `You are writing a daily BTCC news digest for the BTCC Hub fan app. ` +
          `Based on the sources below from the past 24 hours, write a concise, ` +
          `engaging article (3–5 paragraphs) for BTCC fans. Focus on the most ` +
          `newsworthy items. Write the body in HTML using only <p> tags — no ` +
          `headers, no bullet points, no images. Do not include the title in the body.\n\n` +
          `Respond with ONLY valid JSON in exactly this format (no markdown, no extra text):\n` +
          `{"title":"<short punchy headline>","content":"<HTML body>","description":"<one sentence summary>"}\n\n` +
          `Sources:\n${sourceBlock}`,
      },
    ],
  });

  console.log('── Result ───────────────────────────────────────────\n');

  try {
    const parsed = JSON.parse(message.content[0].text);
    console.log('TITLE:');
    console.log(' ', parsed.title);
    console.log('\nDESCRIPTION:');
    console.log(' ', parsed.description);
    console.log('\nCONTENT (HTML):');
    console.log(parsed.content);
    const DIGEST_HERO = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_images/digest/daily-digest-hero.png';
    console.log('\n── Firestore document preview ───────────────────────\n');
    console.log(JSON.stringify({
      title: parsed.title,
      description: parsed.description,
      imageUrl: DIGEST_HERO,
      status: 'draft',
      pubDate: new Date().toISOString().slice(0, 10) + 'T08:00:00',
      content: parsed.content,
      sources: sources.map(s => ({source: s.source, title: s.title, url: s.url})),
    }, null, 2));
  } catch (e) {
    console.log('Claude returned (unparsed):');
    console.log(message.content[0].text);
  }
}

main().catch(console.error);
