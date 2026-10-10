const {buildSpoilerSafePush} = require('./spoilerSafe');

// Scraped from btcc.net by tools/scraper/scrape_news.py and republished here -
// Cloudflare blocks non-browser TLS clients (JA3 fingerprinting) regardless of
// User-Agent, which this function's runtime fetch cannot impersonate.
const NEWS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/news.json';
// Written by a separate, much slower scrape step (scrape_articles.py, via
// scrape-news.yml) than news.json above. A slug can sit in news.json - and
// so be ready to notify about - for several minutes before it lands here.
// ArticleScreen looks slugs up in this file, so notifying before it's here
// sends users straight to a "couldn't load this article" screen. Since
// 2026-09-06, scrape_articles.py also deliberately withholds a genuinely
// brand-new, still image-less article from this index for up to
// PUBLISH_HOLD_WINDOW (see that script) while it retries the image fetch -
// so "not yet in the index" now also covers "known about, but held back
// pending its image", which is exactly the gate this notification needs too.
const ARTICLES_INDEX_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/articles/index.json';
const ARTICLES_PAGE_BASE = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/articles/page_';

function decodeHtmlEntities(str) {
  return str.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

// Returns the article mirror's own current image for slug (a URL string -
// or null if the mirrored article genuinely has none) once the slug is
// confirmed present in the index - or `undefined` if it isn't mirrored yet
// at all - callers must not send while this is undefined. Deliberately not
// notifyPayload.imageUrl (data/news.json's own, independent image-fetch
// attempt, captured once back when the headline first changed and never
// refreshed on later retries) - the two scrapers' image fetches are
// separate and can resolve at different times (see scrape_news.py's
// _archive_mirrored_image comment); by the time this resolves true the
// article mirror is the more authoritative, more likely-correct source,
// especially now that scrape_articles.py can hold a brand-new article back
// from the index specifically to give its own image fetch more tries.
//
// Fails closed (undefined, i.e. "not mirrored yet") on any error, including
// a bad response or a network hiccup - safe, since pendingSend just retries
// on the next 1-minute tick rather than the notification being lost
// outright. The index fetch checks `.ok` explicitly (mirrors the old
// isSlugMirrored this replaces); the page fetch doesn't, matching this
// file's own top-level NEWS_URL handling - either way a malformed response
// fails via the surrounding try/catch or the final "no matching article"
// check, not a missed `.ok`.
async function mirroredImageUrl(fetchFn, slug) {
  if (!slug) return undefined;
  try {
    const indexRes = await fetchFn(ARTICLES_INDEX_URL, 10000);
    if (!indexRes.ok) return undefined;
    const index = await indexRes.json();
    const pageNum = index && typeof index === 'object' && !Array.isArray(index) ? index[slug] : undefined;
    if (!pageNum) return undefined;
    const pageRes = await fetchFn(`${ARTICLES_PAGE_BASE}${pageNum}.json`, 10000);
    const page = await pageRes.json();
    const article = Array.isArray(page) ? page.find((a) => a?.slug === slug) : null;
    if (!article) return undefined;
    return article._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;
  } catch {
    return undefined;
  }
}

// sendSessionNotifications ticks every minute without waiting for the
// previous tick to finish, so when a tick runs long (slow btcc.net/GitHub
// fetches) the next one can start while it's still in flight. A pendingSend
// claimed this recently is assumed to be that other tick's own in-flight
// attempt at the same article, not an abandoned one - so this tick backs off
// instead of racing it to messaging.send() and double-pushing the user. Set
// well above this function's own realistic single-tick runtime.
const CLAIM_STALE_MS = 3 * 60 * 1000;

async function checkBtccNews({fetchFn, db, messaging, logHistory}) {
  const newsRes = await fetchFn(NEWS_URL, 20000);
  const articles = await newsRes.json();
  const latest = articles?.[0];

  if (!Array.isArray(articles) || !latest) {
    console.log(`News check: unexpected response (${newsRes.status}), articles=${JSON.stringify(articles)?.slice(0, 100)}`);
    return;
  }

  const stateRef = db.collection('state').doc('news');
  let notifyPayload = null;

  await db.runTransaction(async (tx) => {
    notifyPayload = null;
    const snap = await tx.get(stateRef);
    const data = snap.exists ? snap.data() : {};
    const lastId = data.lastId ?? null;
    const pendingSend = data.pendingSend ?? null;
    const now = Date.now();

    if (latest.id !== lastId) {
      const title = decodeHtmlEntities(latest.title?.rendered || '') || 'New BTCC Article';
      const imageUrl = latest._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;
      // btcc.net can briefly double-publish the exact same story under a
      // second slug (confirmed live 2026-10-06: "Where to Watch: Brands
      // Hatch GP" scraped first as ...-2026, then as ...-2 once btcc.net's
      // listing reshuffled - two different ids, identical title). A slug
      // change alone doesn't mean a genuinely new article if the title is
      // one we already notified about last time.
      const isSameStoryNewSlug = lastId !== null && title === (data.lastTitle ?? null);
      // Only notify if this isn't the very first article we've ever seen,
      // and it isn't just a reslugged repeat of the last one
      const payload = lastId !== null && !isSameStoryNewSlug ? {title, imageUrl, slug: latest.slug || '', claimedAt: now} : null;
      tx.set(stateRef, {lastId: latest.id, lastTitle: title, detectedAt: new Date().toISOString(), pendingSend: payload});
      notifyPayload = payload;
    } else if (pendingSend && now - (pendingSend.claimedAt ?? 0) > CLAIM_STALE_MS) {
      // Previous run claimed this but either crashed before sending, or
      // deferred and released its claim (see the mirror-gate below) - either
      // way it's safe to claim and retry now.
      tx.set(stateRef, {pendingSend: {...pendingSend, claimedAt: now}}, {merge: true});
      notifyPayload = pendingSend;
    }
  });

  if (!notifyPayload) return;

  // Don't send a slug the article mirror hasn't picked up yet - which now
  // also covers a brand-new article scrape_articles.py is deliberately
  // holding back pending its image (see PUBLISH_HOLD_WINDOW there). Once it
  // resolves, use ITS image, not notifyPayload.imageUrl's stale snapshot -
  // see mirroredImageUrl's own comment. pendingSend is already persisted
  // above, so the next 1-minute tick just retries either way, instead of
  // sending users to a broken article link (or a permanently stale image)
  // now.
  const mirrorImage = await mirroredImageUrl(fetchFn, notifyPayload.slug);
  if (mirrorImage === undefined) {
    console.log(`News notification deferred: "${notifyPayload.title}" (${notifyPayload.slug}) not yet in article mirror`);
    // Release the claim (rather than leaving it fresh) so the very next tick
    // retries immediately instead of waiting out CLAIM_STALE_MS. Transactional
    // and slug-checked so a concurrent tick that already sent (cleared
    // pendingSend to null) or a newer article (different slug) isn't clobbered.
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(stateRef);
      const current = snap.exists ? (snap.data().pendingSend ?? null) : null;
      if (current && current.slug === notifyPayload.slug) {
        tx.set(stateRef, {pendingSend: {...current, claimedAt: 0}}, {merge: true});
      }
    });
    return;
  }

  console.log(`News notification sending: "${notifyPayload.title}" (${notifyPayload.slug})`);
  // Headlines are results too on a race weekend ("Flying Scotsman Moffat
  // tames Brands Hatch") - spoiler-mode devices excluded like every other push.
  const message = buildSpoilerSafePush({
    topic: 'news_alerts',
    title: notifyPayload.title,
    channel: 'news',
    data: {type: 'news', slug: notifyPayload.slug, ...(mirrorImage ? {imageUrl: mirrorImage} : {})},
    android: {collapseKey: `news_${notifyPayload.slug}`, ttl: 3600000},
    apnsHeaders: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `news_${notifyPayload.slug}`.slice(0, 64)},
    alert: {title: 'New Article', body: notifyPayload.title},
  });
  let messageId;
  try {
    messageId = await messaging.send(message);
  } catch (e) {
    // pendingSend stays set, so the next tick retries - record the failure.
    await logHistory('New Article', notifyPayload.title, 'news_alerts', {source: 'newsCheck', target: message.condition, slug: notifyPayload.slug, ok: false, error: String(e?.message || e).slice(0, 300)});
    throw e;
  }
  console.log(`News notification sent OK: "${notifyPayload.title}"`);
  await stateRef.update({pendingSend: null});
  await logHistory('New Article', notifyPayload.title, 'news_alerts', {source: 'newsCheck', target: message.condition, messageId, slug: notifyPayload.slug});
}

module.exports = {checkBtccNews, NEWS_URL, ARTICLES_INDEX_URL};
