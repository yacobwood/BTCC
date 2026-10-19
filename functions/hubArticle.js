const {onRequest} = require('firebase-functions/v2/https');
const {
  logError,
  fetchWithTimeout,
  decodeEntities,
  requireRepoPusher,
} = require('./shared');
const {STYLE_RULES, stripDashes} = require('./articleStyle');

// ── "Write with Claude" - admin-briefed Hub article drafts ───────────────────
// The admin panel's Digest tab posts a short brief (plus optional source
// URLs) here from any device, including a phone. Claude writes the article
// and it is committed to hub_news.json as a DRAFT flagged aiDraft:true, which
// is what lists it in the Digest tab's review queue. Nothing here publishes or
// notifies - the admin reads it, fixes it, adds an image and publishes from
// the panel, exactly like the weekly digest drafts.
//
// Auth is requireRepoPusher (the caller's own GitHub token), NOT the shared
// ADMIN_SECRET - that value sits in the public admin page source and this
// endpoint spends Anthropic credit on every call.

const MODEL = 'claude-opus-5-5';
const HUB_NEWS_API = 'https://api.github.com/repos/yacobwood/BTCC/contents/data/hub_news.json';
const RAW = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data';
const CATEGORIES = ['News', 'Paddock'];
const MAX_URLS = 5;
const MAX_SOURCE_CHARS = 12000;
const MAX_BRIEF_CHARS = 6000;

const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: {type: 'string'},
    description: {type: 'string'},
    content: {type: 'string'},
    reviewNotes: {type: 'array', items: {type: 'string'}},
  },
  required: ['title', 'description', 'content', 'reviewNotes'],
  additionalProperties: false,
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Same "YYYY-MM-DDTHH:MM" UK wall-clock shape the admin panel's nowIso()
// writes for hand-made posts.
function ukNowIso(date = new Date()) {
  const d = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'}).format(date);
  const t = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false}).format(date);
  return `${d}T${t}`;
}

function htmlToText(html) {
  return decodeEntities(String(html || '')
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Only an authenticated admin reaches this, but still refuse anything that
// isn't a plain public http(s) URL rather than fetch internal addresses.
function isFetchableUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return !(host === 'localhost' || host.endsWith('.internal') || /^(127\.|10\.|169\.254\.|192\.168\.|0\.)/.test(host) || host === '[::1]');
}

function parseBody(body = {}) {
  const brief = typeof body.brief === 'string' ? body.brief.trim() : '';
  if (brief.length < 10) throw new HttpError(400, 'Brief is too short - give Claude at least a sentence to work from.');
  if (brief.length > MAX_BRIEF_CHARS) throw new HttpError(400, `Brief is over ${MAX_BRIEF_CHARS} characters.`);
  const urls = Array.isArray(body.urls)
    ? [...new Set(body.urls.filter(u => typeof u === 'string').map(u => u.trim()).filter(Boolean))]
    : [];
  if (urls.length > MAX_URLS) throw new HttpError(400, `At most ${MAX_URLS} source links.`);
  const bad = urls.find(u => !isFetchableUrl(u));
  if (bad) throw new HttpError(400, `Not a usable link: ${bad}`);
  const category = CATEGORIES.includes(body.category) ? body.category : 'News';
  const regenerateId = typeof body.regenerateId === 'string' && body.regenerateId ? body.regenerateId : null;
  return {brief, urls, category, regenerateId};
}

async function fetchSources(urls) {
  return Promise.all(urls.map(async url => {
    try {
      const r = await fetchWithTimeout(url, 10000, {headers: {'User-Agent': 'Mozilla/5.0 (compatible; BTCCHub/1.0)'}});
      if (!r.ok) return {url, error: `HTTP ${r.status}`};
      const text = htmlToText(await r.text()).slice(0, MAX_SOURCE_CHARS);
      return text ? {url, text} : {url, error: 'no readable text'};
    } catch (e) {
      return {url, error: e.message};
    }
  }));
}

async function fetchJson(url) {
  try {
    const r = await fetchWithTimeout(url, 10000);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// Reference data so names, numbers, teams and the points picture come from
// the app's own data instead of Claude's memory. Every piece is optional -
// a fetch failure just leaves that section out.
async function buildReference() {
  const [drivers, standings, news] = await Promise.all([
    fetchJson(`${RAW}/drivers.json`),
    fetchJson(`${RAW}/standings.json`),
    fetchJson(`${RAW}/news.json`),
  ]);
  const parts = [];
  if (drivers?.drivers?.length) {
    parts.push(`${drivers.season || 'Current'} grid (number, driver, team):\n` +
      drivers.drivers.map(d => `  #${d.number} ${d.name} - ${d.team}`).join('\n'));
  }
  if (standings?.standings?.length) {
    parts.push(`Drivers' standings after ${standings.round ? `round ${standings.round}` : 'the latest round'}${standings.venue ? ` (${standings.venue})` : ''}:\n` +
      standings.standings.slice(0, 15).map(s => `  ${s.pos}. ${s.driver} (${s.team}) ${s.points} pts, ${s.wins} wins`).join('\n'));
  }
  if (Array.isArray(news) && news.length) {
    parts.push('Latest btcc.net headlines:\n' +
      news.slice(0, 10).map(n => `  • ${htmlToText(n.title?.rendered || n.title)} (${String(n.date || '').slice(0, 10)})`).join('\n'));
  }
  return parts.join('\n\n');
}

function buildSystemPrompt() {
  return (
    `You are a passionate, opinionated British BTCC fan writing a news article for the BTCC Hub fan app, from a brief the app's editor sends you. ` +
    `Write like a fan writing for fans. You are not a journalist and this is not a press release. Use British English throughout.\n\n` +
    `Facts matter more than anything else:\n` +
    `- Every factual claim (results, points, positions, quotes, dates, contract lengths, team or car changes) must come from the editor's brief, the source articles or the reference data. If it isn't in any of them, don't state it.\n` +
    `- Never invent or paraphrase a quote into existence. Only quote words that appear in a source.\n` +
    `- Opinion and analysis are welcome but must be built on the facts you were given.\n` +
    `- The brief is the newest information. If it contradicts the reference data, follow the brief and flag the conflict in reviewNotes.\n` +
    `- The grid in the reference data is the current season's - it does not tell you who is confirmed for next season.\n\n` +
    `Length: let the brief decide. A simple announcement might only justify 2 or 3 focused paragraphs. Never pad or invent a paragraph to fill space. Mix short punchy sentences with the occasional longer one.\n\n` +
    `Writing rules. Follow all of these without exception:\n` +
    STYLE_RULES +
    `- Write the body in HTML using <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li> and <a> tags as appropriate. No images. Do not include the title in the body. Do not add empty <p> tags.\n` +
    `- The title must not reuse the phrasing of any recent Hub headline listed.\n\n` +
    `Output fields:\n` +
    `- title: a short punchy headline\n` +
    `- description: one sentence summary shown in the news feed\n` +
    `- content: the HTML body\n` +
    `- reviewNotes: short notes for the editor to check before publishing. Flag anything you inferred rather than read in a source. Also flag any source that failed to load or any part of the brief that was ambiguous. Empty if there is nothing to flag.`
  );
}

function buildUserContent({brief, sources, reference, recentTitles}) {
  const sourceBlock = sources.length
    ? sources.map((s, i) => s.error
      ? `[${i + 1}] ${s.url}\n(could not be loaded: ${s.error})`
      : `[${i + 1}] ${s.url}\n${s.text}`).join('\n\n')
    : '(none - work from the brief and reference data only)';
  return (
    `Reference data from the app:\n${reference || '(unavailable)'}\n\n` +
    `Recent Hub headlines (do not reuse their phrasing):\n${recentTitles.map(t => `  • ${t}`).join('\n') || '  (none)'}\n\n` +
    `Source articles:\n${sourceBlock}\n\n` +
    `Editor's brief:\n${brief}`
  );
}

async function writeArticle(system, userContent) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({apiKey: process.env.ANTHROPIC_API_KEY});
  const message = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // On a safety-classifier decline (e.g. a false positive on a crash
    // story), the API re-runs the request on a fallback model in the same
    // call rather than failing outright.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {effort: 'high', format: {type: 'json_schema', schema: ARTICLE_SCHEMA}},
    system,
    messages: [{role: 'user', content: userContent}],
  });
  if (message.stop_reason === 'refusal') throw new HttpError(422, 'Claude declined to write this one - try rewording the brief.');
  if (message.stop_reason === 'max_tokens') throw new HttpError(502, 'Claude ran out of room before finishing - try a narrower brief.');
  // Thinking blocks come first on this model, so find the text block rather
  // than reading content[0] the way digest.js does.
  const text = (message.content || []).find(b => b.type === 'text')?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new HttpError(502, 'Claude returned something that was not a valid article - try again.');
  }
  if (!parsed.title || !parsed.content) throw new HttpError(502, 'Claude returned an article with no title or body - try again.');
  return {
    title: stripDashes(parsed.title).trim(),
    description: stripDashes(parsed.description).trim(),
    content: stripDashes(parsed.content)
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<h([23])>\s*/g, '<h$1>')
      .replace(/\s*<\/h([23])>/g, '</h$1>'),
    reviewNotes: Array.isArray(parsed.reviewNotes) ? parsed.reviewNotes.map(n => stripDashes(n).trim()).filter(Boolean) : [],
  };
}

const ghHeaders = () => ({
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

async function loadHubNews() {
  const r = await fetchWithTimeout(HUB_NEWS_API, 10000, {headers: ghHeaders()});
  if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
  const meta = await r.json();
  return {sha: meta.sha, hubNews: JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'))};
}

// Re-reads the file on every attempt and applies just this one post, so a
// commit that lands in between (an admin save, a scraper, a digest) is kept
// rather than overwritten - a sha conflict simply retries on the newer copy.
async function commitDraft(buildPost, regenerateId) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const {sha, hubNews} = await loadHubNews();
    const posts = hubNews.posts || [];
    let post;
    if (regenerateId) {
      const idx = posts.findIndex(p => p.id === regenerateId);
      if (idx === -1 || !posts[idx].aiDraft || posts[idx].status !== 'draft') {
        throw new HttpError(409, 'That draft has been published, deleted or edited into a normal article since - regenerate cancelled.');
      }
      post = buildPost(posts[idx]);
      posts[idx] = post;
    } else {
      post = buildPost(null);
      posts.unshift(post);
    }
    const r = await fetchWithTimeout(HUB_NEWS_API, 10000, {
      method: 'PUT',
      headers: {...ghHeaders(), 'Content-Type': 'application/json'},
      body: JSON.stringify({
        message: `Claude draft: ${post.title}`,
        content: Buffer.from(JSON.stringify({...hubNews, posts}, null, 2) + '\n').toString('base64'),
        sha,
      }),
    });
    if (r.ok) return post;
    if ((r.status === 409 || r.status === 422) && attempt < 3) continue;
    throw new Error(`GitHub PUT failed: ${r.status} ${await r.text()}`);
  }
  throw new Error('GitHub PUT kept conflicting');
}

async function handleDraftRequest(req, res) {
  if (await requireRepoPusher(req, res)) return;
  try {
    const {brief, urls, category, regenerateId} = parseBody(req.body);
    const [sources, reference, current] = await Promise.all([
      fetchSources(urls),
      buildReference(),
      loadHubNews(),
    ]);
    const recentTitles = (current.hubNews.posts || [])
      .filter(p => p.status !== 'draft')
      .slice(0, 20)
      .map(p => p.title);
    const article = await writeArticle(buildSystemPrompt(), buildUserContent({brief, sources, reference, recentTitles}));
    const post = await commitDraft(prev => ({
      // Regenerating keeps the original id and any images already added.
      ...(prev || {}),
      id: prev?.id || `hub-${Date.now()}`,
      title: article.title,
      description: article.description,
      content: article.content,
      imageUrl: prev?.imageUrl || '',
      images: prev?.images || [],
      category,
      source: 'btcc-hub',
      sourceUrl: urls[0] || null,
      pubDate: prev?.pubDate || ukNowIso(),
      status: 'draft',
      aiDraft: true,
      aiBrief: brief,
      aiSourceUrls: urls,
      aiNotes: article.reviewNotes,
    }), regenerateId);
    console.log(`draftHubArticle: committed ${post.id}: ${post.title}`);
    res.status(200).json({ok: true, id: post.id, title: post.title, notes: post.aiNotes});
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ok: false, error: e.message});
      return;
    }
    console.error('draftHubArticle failed:', e);
    await logError('draftHubArticle', e.message, e);
    res.status(500).json({ok: false, error: e.message});
  }
}

exports.draftHubArticle = onRequest(
  {
    secrets: ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN'],
    cors: ['https://yacobwood.github.io'],
    // Opus at high effort can take a minute or two on a long piece; the
    // 60s default would cut it off mid-write.
    timeoutSeconds: 300,
  },
  handleDraftRequest,
);

exports._internal = {parseBody, isFetchableUrl, htmlToText, stripDashes, ukNowIso, buildSystemPrompt, buildUserContent, ARTICLE_SCHEMA};
