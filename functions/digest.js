const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
const {
  logError,
  fetchWithTimeout,
  CALENDAR_URL,
  ARTICLES_URL,
  getUKDateString,
  ADMIN_SECRET,
} = require('./shared');

// ── Shared digest prompt intros ───────────────────────────────
// Used by weeklyDigest/raceWeekendDigest (scheduled) and triggerDigest (manual admin
// button) so all three stay in sync - the two used to keep separate copies, which is
// how the manual trigger drifted onto stale wording after a prompt fix.
function weeklyDigestPromptIntro() {
  return (
    `You are a passionate, opinionated British BTCC fan writing a weekly round-up for the BTCC Hub fan app. ` +
    `Write like someone who was glued to their TV or at the circuit all weekend — not a journalist, not a press release. ` +
    `Use British English throughout. ` +
    `Cover the past 7 days: race results, driver performances, team news, championship picture, fan reaction and anything else worth talking about. If any drivers received penalty points on their licence, mention who got them and why — these matter for the title fight. ` +
    `Let the length be dictated entirely by how much genuinely happened this week - never pad, stretch thin material or invent a paragraph just to hit a target. A quiet week might only justify 2 or 3 focused paragraphs; a dramatic one might justify 8 or more. Every paragraph must be built around something real and specific, not general filler. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
    `Have opinions — say who impressed you, who disappointed, what surprised you. ` +
    `Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate — no images. ` +
    `Do not include the title in the body. Do not add empty <p> tags or blank lines between elements — place each <h2> or <h3> immediately after the closing </p> of the previous paragraph with no gap.\n\n`
  );
}

function raceWeekendPromptIntro(round) {
  return (
    `You are a passionate, opinionated British BTCC fan writing a race weekend preview for the BTCC Hub fan app. ` +
    `Write like someone who can't wait for the weekend — not a journalist, not a press release. ` +
    `Use British English throughout. ` +
    (round ? `This weekend the BTCC heads to ${round.venue} (${round.location}). ` : '') +
    `Build genuine anticipation: who to watch, the storylines going in, the championship battle, what makes this circuit special, and any team or driver news fans need to know. ` +
    `Let the length be dictated entirely by how much there genuinely is to say - never pad, stretch thin material or invent a paragraph just to hit a target. A round with few storylines might only justify 2 or 3 focused paragraphs; one with plenty going on might justify 8 or more. Every paragraph must be built around something real and specific, not general filler. Each paragraph should have a clear focus. Mix short punchy sentences with the occasional longer one for rhythm. ` +
    `Have opinions — get fans excited, make predictions, say who you think will shine or struggle. ` +
    `Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate — no images. ` +
    `Do not include the title in the body. Do not add empty <p> tags or blank lines between elements — place each <h2> or <h3> immediately after the closing </p> of the previous paragraph with no gap.\n\n`
  );
}

// ── Shared digest logic ───────────────────────────────────────
async function runDigest(label, promptIntro, {force = false} = {}) {
  const today = getUKDateString(new Date());
  const postId = `digest-${today}`;

  const DIGEST_HERO = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/hub_images/digest/weekly-digest-hero.png';
  const GITHUB_API = 'https://api.github.com/repos/yacobwood/BTCC/contents/data/hub_news.json';
  const ghHeaders = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // ── Fetch current hub_news.json from GitHub ─────────────────
  const fileRes = await fetchWithTimeout(GITHUB_API, 10000, {headers: ghHeaders});
  if (!fileRes.ok) throw new Error(`GitHub GET failed: ${fileRes.status}`);
  const fileData = await fileRes.json();
  const hubNews = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));

  // Skip if today's digest already exists (retry guard). Manual admin triggers can
  // pass {force: true} to regenerate instead - but only over an existing draft,
  // never silently clobbering something already published or scheduled.
  const existingIndex = hubNews.posts.findIndex(p => p.id === postId);
  const existing = existingIndex !== -1 ? hubNews.posts[existingIndex] : null;
  if (existing && !force) {
    console.log(`${label}: ${postId} already exists, skipping`);
    return;
  }
  if (existing && existing.status !== 'draft') {
    throw new Error(`${postId} is already '${existing.status}' - refusing to overwrite. Unpublish it first if you want to regenerate.`);
  }

  const sources = [];

  // ── Reddit r/BTCC ───────────────────────────────────────────
  try {
    const res = await fetchWithTimeout(
      'https://www.reddit.com/r/BTCC/top.json?t=week&limit=30',
      10000,
      {headers: {'User-Agent': 'BTCCHubBot/1.0 by BTCC_Hub'}},
    );
    const data = await res.json();
    for (const child of data?.data?.children ?? []) {
      const p = child.data;
      if (p.score < 3) continue;
      sources.push({
        source: 'Reddit r/BTCC',
        title: p.title,
        text: p.selftext?.slice(0, 800) || '',
        url: `https://reddit.com${p.permalink}`,
      });
    }
  } catch (e) {
    console.error('Reddit scrape failed:', e);
  }

  // ── BTCC.net articles (GitHub mirror) ────────────────────────
  // btcc.net moved off WordPress to a Vercel-hosted React app (2026-07-31)
  // and confirmed directly with the site's own dev that wp-json is
  // permanently gone, not just temporarily blocked - so this reads the
  // same GitHub-mirrored article pages every other btcc.net-sourced
  // feature already uses (see newsCheck.js, src/api/client.js) instead of
  // fetching btcc.net live. See project_vercel_migration memory.
  try {
    const posts = await fetchWithTimeout(ARTICLES_URL).then(r => r.json());
    for (const post of posts.slice(0, 15)) {
      const excerpt = post.excerpt?.rendered?.replace(/<[^>]+>/g, '').trim() ?? '';
      sources.push({
        source: 'BTCC.net',
        title: post.title?.rendered ?? '',
        text: excerpt.slice(0, 600),
        url: post.link,
      });
    }
  } catch (e) {
    console.error('BTCC.net articles fetch failed:', e);
  }

  // ── RSS helper ──────────────────────────────────────────────
  async function scrapeRss(url, sourceName) {
    try {
      const text = await fetchWithTimeout(url).then(r => r.text());
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
        if (title) {
          sources.push({source: sourceName, title, text: desc.slice(0, 500), url: link});
        }
      }
    } catch (e) {
      console.error(`${sourceName} RSS failed:`, e);
    }
  }

  await Promise.all([
    scrapeRss('https://www.autosport.com/rss/btcc/news/', 'Autosport'),
    scrapeRss('https://www.motorsport.com/rss/btcc/news/', 'Motorsport.com'),
    scrapeRss('https://touringcartimes.com/feed/', 'Touring Car Times'),
  ]);

  if (sources.length === 0) {
    console.log(`${label}: no sources found, skipping`);
    return;
  }

  // ── Ask Claude to write the article ────────────────────────
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({apiKey: process.env.ANTHROPIC_API_KEY});

  const sourceBlock = sources
    .map((s, i) => `[${i + 1}] ${s.source}: "${s.title}"\n${s.text || '(no excerpt)'}`)
    .join('\n\n');

  // Build cross-reference context from previous digest articles.
  // Drafts are excluded — a status of 'draft' means it was never (or not yet) shown to readers,
  // so it shouldn't count as "already covered" for repetition purposes. Missing status defaults
  // to published, matching the admin panel's convention (see standings-admin.html).
  const isVisible = p => p.status !== 'draft';
  const prevDigests = hubNews.posts
    .filter(p => p.category === 'Weekly Digest' && p.id !== postId && isVisible(p))
    .slice(0, 12);
  const prevDigestBlock = prevDigests.length
    ? prevDigests.map(p => {
        const plain = (p.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
        return `  • "${p.title}" (${p.pubDate?.slice(0, 10) || 'undated'})\n    ${plain}`;
      }).join('\n\n')
    : '  (none yet — this is the first digest)';

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2200,
    messages: [
      {
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
          `- Do not use full car model names (e.g. "Ford Focus Titanium", "BMW 330i M Sport") — just say "car" or refer to the team/manufacturer only when the make is genuinely relevant\n` +
          `- Express opinions and reactions — this is a fan writing for fans, not a wire report\n` +
          `- The app is called "BTCC Hub" — never refer to it as "BTCC Fan Hub"\n` +
          `- The title and body must feel completely distinct from any previously published article. Do not reuse phrasing, angles or story structures from these existing titles:\n` +
          hubNews.posts.filter(isVisible).slice(0, 20).map(p => `  • ${p.title}`).join('\n') + '\n\n' +
          `- Before writing anything, read every previous digest below in full and mentally list the specific topics, storylines and driver narratives each one already covered. Your new digest must not repeat any of them. A story is only fair game again if something genuinely new has happened since that digest was published (a new result, a new statement, a new incident) - and even then, spend at most a sentence on the recap before moving straight to what's new. If, after checking, nothing new has happened on a given storyline this week, leave it out entirely rather than restating it. Do not cover a topic just because it's the most obvious one available - covering fewer, genuinely fresh stories is better than covering a full spread that repeats last time:\n` +
          prevDigestBlock + '\n\n' +
          `Respond with ONLY valid JSON in exactly this format (no markdown, no extra text):\n` +
          `{"title":"<short punchy headline>","content":"<HTML body>","description":"<one sentence summary>"}\n\n` +
          `Sources:\n${sourceBlock}`,
      },
    ],
  });

  let title = `BTCC Digest — ${today}`;
  let content = '<p>No content generated.</p>';
  let description = '';
  try {
    const raw = message.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(raw);
    title = parsed.title || title;
    content = (parsed.content || content)
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<h([23])>\s*/g, '<h$1>')
      .replace(/\s*<\/h([23])>/g, '</h$1>');
    description = parsed.description || '';
  } catch (e) {
    console.error(`${label}: failed to parse Claude response:`, e);
    content = `<p>${message.content[0].text}</p>`;
  }

  // ── Prepend draft to hub_news.json and commit ───────────────
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

  if (existingIndex !== -1) {
    hubNews.posts[existingIndex] = newPost;
  } else {
    hubNews.posts.unshift(newPost);
  }

  const updatedContent = Buffer.from(JSON.stringify(hubNews, null, 2)).toString('base64');
  const putRes = await fetchWithTimeout(GITHUB_API, 10000, {
    method: 'PUT',
    headers: {...ghHeaders, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      message: `${label} digest draft — ${today}`,
      content: updatedContent,
      sha: fileData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub PUT failed: ${putRes.status} ${err}`);
  }

  // Notification is intentionally NOT sent here — the article is saved as a
  // draft for admin review first. The admin publishes it manually via the
  // admin panel, which triggers the digest_alerts notification at that point.
  console.log(`${label}: digest draft committed for ${today}: ${title}`);

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {user: 'btcchub@gmail.com', pass: process.env.GMAIL_APP_PASSWORD},
    });
    await transporter.sendMail({
      from: '"BTCC Hub" <btcchub@gmail.com>',
      to: 'btcchub@gmail.com',
      subject: `[BTCC Hub] ${label} digest ready to review`,
      text: `A new ${label} digest draft is ready for review and publishing.\n\nTitle: ${title}\n\nReview and publish at:\nhttps://yacobwood.github.io/BTCC/admin/standings-admin.html`,
    });
  } catch (emailErr) {
    console.warn('Digest ready email failed (non-fatal):', emailErr.message);
  }
}

// ── Weekly digest — every Monday at 8am ──────────────────────
exports.weeklyDigest = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'Europe/London',
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  async () => {
    try {
      await runDigest('weeklyDigest', weeklyDigestPromptIntro());
    } catch (e) {
      console.error('weeklyDigest failed:', e);
      await logError('weeklyDigest', e.message, e, {alert: true});
    }
  },
);

// ── Race weekend preview digest — every Thursday at 8am ──────
// Only runs if there is a BTCC round starting that Saturday.
exports.raceWeekendDigest = onSchedule(
  {
    schedule: '0 8 * * 4',
    timeZone: 'Europe/London',
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
  },
  async () => {
    try {
      const now = new Date();
      const saturdayStr = getUKDateString(now, 2); // Thursday + 2 = Saturday
      const calendar = await fetchWithTimeout(CALENDAR_URL).then(r => r.json());
      const round = calendar.rounds.find(r => r.startDate === saturdayStr);
      if (!round) {
        console.log(`raceWeekendDigest: no round on ${saturdayStr}, skipping`);
        return;
      }
      await runDigest('raceWeekendDigest', raceWeekendPromptIntro(round));
    } catch (e) {
      console.error('raceWeekendDigest failed:', e);
      await logError('raceWeekendDigest', e.message, e, {alert: true});
    }
  },
);

// ── Manual digest trigger — called from admin page ────────────
exports.triggerDigest = onRequest(
  {
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'GMAIL_APP_PASSWORD'],
    cors: ['https://yacobwood.github.io'],
  },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    if (req.headers['x-admin-secret'] !== ADMIN_SECRET) { res.status(401).send('Unauthorized'); return; }

    const type = req.body?.type || 'weekly';
    try {
      if (type === 'race') {
        const now = new Date();
        const saturdayStr = getUKDateString(now, 2);
        const calendar = await fetchWithTimeout(CALENDAR_URL).then(r => r.json());
        const round = calendar.rounds.find(r => r.startDate === saturdayStr)
          || calendar.rounds.find(r => {
            const start = new Date(r.startDate);
            const end = new Date(r.endDate || r.startDate);
            return now >= start && now <= end;
          });
        await runDigest('triggerDigest:race', raceWeekendPromptIntro(round), {force: true});
      } else {
        await runDigest('triggerDigest:weekly', weeklyDigestPromptIntro(), {force: true});
      }
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('triggerDigest failed:', e);
      await logError('triggerDigest', e.message, e, {alert: true});
      res.status(500).json({ok: false, error: e.message});
    }
  },
);
