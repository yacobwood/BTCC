const NEWS_URL = 'https://www.btcc.net/wp-json/wp/v2/posts?per_page=1&_fields=id,title,slug,featured_media,_links&_embed=wp:featuredmedia';
const NEWS_USER_AGENT = 'Mozilla/5.0 (compatible; BTCCHub/1.0)';

function decodeHtmlEntities(str) {
  return str.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

async function checkBtccNews({fetchFn, db, messaging, logHistory}) {
  const newsRes = await fetchFn(NEWS_URL, 10000, {headers: {'User-Agent': NEWS_USER_AGENT}});
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

    if (latest.id !== lastId) {
      const title = decodeHtmlEntities(latest.title?.rendered || '') || 'New BTCC Article';
      const imageUrl = latest._embedded?.['wp:featuredmedia']?.[0]?.source_url || null;
      // Only notify if this isn't the very first article we've ever seen
      const payload = lastId !== null ? {title, imageUrl, slug: latest.slug || ''} : null;
      tx.set(stateRef, {lastId: latest.id, detectedAt: new Date().toISOString(), pendingSend: payload});
      notifyPayload = payload;
    } else if (pendingSend) {
      // Previous run wrote state but crashed before sending — retry
      notifyPayload = pendingSend;
    }
  });

  if (notifyPayload) {
    console.log(`News notification sending: "${notifyPayload.title}" (${notifyPayload.slug})`);
    await messaging.send({
      topic: 'news_alerts',
      android: {collapseKey: `news_${notifyPayload.slug}`, priority: 'high', ttl: 3600000},
      apns: {headers: {'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': `news_${notifyPayload.slug}`.slice(0, 64)}, payload: {aps: {sound: 'default', alert: {title: 'New Article', body: notifyPayload.title}}}},
      data: {type: 'news', slug: notifyPayload.slug, channel: 'news', title: notifyPayload.title, ...(notifyPayload.imageUrl ? {imageUrl: notifyPayload.imageUrl} : {})},
    });
    await stateRef.update({pendingSend: null});
    logHistory('New Article', notifyPayload.title, 'news_alerts');
  }
}

module.exports = {checkBtccNews, NEWS_URL};
