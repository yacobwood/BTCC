import {cacheWrite, cacheRead} from '../store/cache';
import {formatDate} from './parsers';
import auth from '@react-native-firebase/auth';

const BASE_GITHUB = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data';

const BUNDLED_CALENDAR = require('../../data/calendar.json');
const BUNDLED_CALENDAR_2027 = require('../../data/calendar2027.json');
const BUNDLED_DRIVERS = require('../../data/drivers.json');
const BUNDLED_BLACKLIST = require('../../data/blacklist.json');
const BUNDLED_MERCH = require('../../data/merch.json');
const BUNDLED_PARTNERS = require('../../data/partners.json');

// Stale-while-revalidate: serve from cache immediately, refresh in background.
// If the cached entry is older than MAX_AGE_MS, treat as a cache miss so the
// user never sees data more than an hour stale.
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// staleFallback: on network error, return a cached value rather than throwing - but only if
//               it's still within maxAgeMs. A forceRefresh=true caller (e.g. NewsScreen's Phase
//               2, or any pull-to-refresh) skips the age-checked branch below entirely and comes
//               straight here on failure, so this is often the *only* age check a stale entry
//               ever gets for that call. Bounding it (rather than "any cached value, even
//               expired") is what stops a transient network blip from resurfacing an
//               arbitrarily old snapshot - see the News tab "flash of different articles" fix.
// staleFirst:   serve ANY cached value immediately (no age limit) and always refresh in background;
//               only blocks on network when there is truly nothing cached (cold install).
//               Use for content where showing slightly old data beats a long spinner (e.g. news).
//               Only governs this initial read - the staleFallback catch-path below is always
//               age-checked regardless of staleFirst.
async function fetchJson(url, cacheKey, forceRefresh = false, staleFallback = false, staleFirst = false, maxAgeMs = MAX_AGE_MS) {
  if (cacheKey && !forceRefresh) {
    const ageLimit = staleFirst ? undefined : maxAgeMs;
    const cached = await cacheRead(cacheKey, ageLimit);
    if (cached) {
      // Refresh cache in background without blocking
      fetch(url, {signal: AbortSignal.timeout(10000)})
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) cacheWrite(cacheKey, data); })
        .catch(() => {});
      return cached;
    }
  }
  // No cache (or forced refresh)  -  fetch and wait
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (cacheKey) cacheWrite(cacheKey, data);
    return data;
  } catch (e) {
    if (staleFallback && cacheKey) {
      const stale = await cacheRead(cacheKey, maxAgeMs);
      if (stale) return stale;
    }
    throw e;
  }
}

export async function fetchCalendar(year = 2026, forceRefresh = false) {
  const url = year === 2026
    ? 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json'
    : `${BASE_GITHUB}/calendar${year}.json`;
  const fallback = year === 2027 ? BUNDLED_CALENDAR_2027 : BUNDLED_CALENDAR;
  try {
    return await fetchJson(url, `calendar_${year}`, forceRefresh, /* staleFallback */ true, /* staleFirst */ false, 10 * 60 * 1000);
  } catch {
    return fallback;
  }
}

export async function fetchBlacklist() {
  try {
    // Bounded (not staleFirst): a moderation-list fix needs to actually land on
    // devices rather than potentially sticking on the old list forever.
    return await fetchJson(`${BASE_GITHUB}/blacklist.json`, 'blacklist', false, /* staleFallback */ true, /* staleFirst */ false, 24 * 60 * 60 * 1000);
  } catch {
    return BUNDLED_BLACKLIST;
  }
}

export async function fetchDrivers() {
  try {
    // Bounded staleness (not staleFirst): a cache older than MAX_AGE_MS forces a
    // blocking re-fetch instead of serving indefinitely if the one background
    // refresh attempt ever silently fails (roster count stuck stale otherwise).
    return await fetchJson(`${BASE_GITHUB}/drivers.json`, 'drivers', false, /* staleFallback */ true, /* staleFirst */ false, MAX_AGE_MS);
  } catch {
    // Cold install + no network: fall back to the bundled snapshot
    return BUNDLED_DRIVERS;
  }
}

export async function fetchStandings(forceRefresh = false) {
  return fetchJson(`${BASE_GITHUB}/standings.json`, 'standings', forceRefresh, /* staleFallback */ true, false, 5 * 60 * 1000);
}

export async function fetchLiveStatus() {
  try {
    // staleFirst must stay false here: fetchJson ignores maxAgeMs entirely when
    // staleFirst is true, which would silently defeat the 2-minute bound below —
    // exactly the "stuck stale forever" failure this data (race-day live state)
    // can least afford.
    return await fetchJson(`${BASE_GITHUB}/live_status.json`, 'live_status', false, false, /* staleFirst */ false, 2 * 60 * 1000);
  } catch {
    return null;
  }
}

export async function fetchResults(year = 2026, forceRefresh = false) {
  return fetchJson(`${BASE_GITHUB}/results${year}.json`, `results_${year}`, forceRefresh, /* staleFallback */ true, false, 5 * 60 * 1000);
}

export async function fetchMerchStores() {
  try {
    const data = await fetchJson(`${BASE_GITHUB}/merch.json`, 'merch_stores', false, /* staleFallback */ true, /* staleFirst */ false, 48 * 60 * 60 * 1000);
    return data.stores || {};
  } catch {
    return BUNDLED_MERCH.stores || {};
  }
}

export async function fetchPartners() {
  try {
    const data = await fetchJson(`${BASE_GITHUB}/partners.json`, 'partners', false, /* staleFallback */ true, /* staleFirst */ false, 48 * 60 * 60 * 1000);
    return Array.isArray(data) ? data : BUNDLED_PARTNERS;
  } catch {
    return BUNDLED_PARTNERS;
  }
}

export async function fetchRecords() {
  return fetchJson(`${BASE_GITHUB}/records.json`, 'records', /* forceRefresh */ true, /* staleFallback */ true);
}


// btcc.net's own wp-json REST API now returns 401 for every client, so the
// news list/search/article-by-slug all read this GitHub-mirrored snapshot
// (tools/scraper/scrape_articles.py) instead of hitting btcc.net directly.
// Mirrored as one file per page (data/articles/page_<n>.json, PAGE_SIZE each)
// plus a slug->page index (data/articles/index.json), matching the old
// wp-json shape this replaced (`?per_page=20&page=N`, `?slug=X`, each cached
// under its own key) rather than one ever-growing blob - a normal list fetch
// only ever downloads the one page it actually asked for, regardless of how
// deep the archive goes. An earlier version mirrored a single capped-size
// articles.json instead; that made every fetch - list, search, or a single
// slug lookup - download the *entire* archive's full content every time.
const ARTICLES_BASE = `${BASE_GITHUB}/articles`;
const ARTICLES_MAX_AGE_MS = 5 * 60 * 1000; // matches the scraper's own refresh cadence

async function fetchArticlesPage(page, forceRefresh = false) {
  try {
    const posts = await fetchJson(`${ARTICLES_BASE}/page_${page}.json`, `news_p${page}`, forceRefresh, /* staleFallback */ true, /* staleFirst */ false, ARTICLES_MAX_AGE_MS);
    return Array.isArray(posts) ? posts : [];
  } catch {
    return [];
  }
}

async function fetchArticlesIndex(forceRefresh = false) {
  try {
    const index = await fetchJson(`${ARTICLES_BASE}/index.json`, 'articles_index', forceRefresh, /* staleFallback */ true, /* staleFirst */ false, ARTICLES_MAX_AGE_MS);
    return index && typeof index === 'object' ? index : {};
  } catch {
    return {};
  }
}

// perPage is accepted for interface compatibility with existing call sites
// but otherwise unused - it must match PAGE_SIZE in scrape_articles.py (20)
// since a list fetch just returns that page's file as-is, not a re-sliced
// count. Search ignores page/perPage entirely and returns every match.
export async function fetchArticles(page = 1, perPage = 20, search = '', forceRefresh = false) {
  const q = search.trim().toLowerCase();
  if (!q) return fetchArticlesPage(page, forceRefresh);

  // Search has no server to hit anymore (see above), so it fetches every
  // mirrored page and filters client-side - a heavier, deliberate one-off
  // cost only paid when the user actually searches, not on every list fetch.
  const index = await fetchArticlesIndex();
  const pageNumbers = [...new Set(Object.values(index))];
  const pages = await Promise.all(pageNumbers.map(n => fetchArticlesPage(n)));
  const all = pages.flat();
  return all.filter(p => (p.title?.rendered || '').toLowerCase().includes(q) || (p.content?.rendered || '').toLowerCase().includes(q));
}

// Returns a cached page of articles (if fresh enough) without triggering a
// network request. Used by NewsScreen to show stale data instantly before
// fetching fresh data. Bounded to ARTICLES_MAX_AGE_MS (same as the scraper's
// own refresh cadence) rather than "any cached data regardless of age" - a
// cache older than one scrape cycle is likely to already have a different
// top-of-feed order than the live mirror, and showing it instantly just to
// have NewsScreen's Phase 2 fetch immediately replace it with a re-ordered
// hero/grid reads as a bug ("flash of different articles") rather than a
// perf win. Past that age it's better to fall through to NewsScreen's
// spinner and show the live order the first time, instead of showing a
// snapshot of it.
export async function peekArticlesCache(page = 1) {
  const cached = await cacheRead(`news_p${page}`, ARTICLES_MAX_AGE_MS);
  return Array.isArray(cached) && cached.length ? cached : null;
}

const HUB_CACHE_KEY = 'hub_posts';
const HUB_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
// hub_news.json has no size cap of its own (unlike articles/, capped at
// MAX_ARTICLES=500 by scrape_articles.py) - it's admin-curated, not scraped,
// so nothing currently prunes it. Capping here keeps it from ever being able
// to grow larger than the article archive it's merged into on the News tab -
// if it ever did, every hub post beyond this many would still load in full
// on every fetch regardless of how deep the user actually scrolls, the exact
// problem the article per-page split was built to avoid.
const MAX_HUB_POSTS = 500;

function mapHubPosts(data, uid) {
  const now = Date.now();
  return (data.posts || [])
    .filter(p => {
      const status = p.status || 'published';
      if (status === 'published') return true;
      if (status === 'scheduled') return p.scheduledAt && new Date(p.scheduledAt).getTime() <= now;
      if (status === 'draft') {
        const ids = Array.isArray(p.previewDeviceIds) ? p.previewDeviceIds : [];
        return uid && ids.includes(uid);
      }
      return false;
    })
    .map(p => ({
      id: p.id,
      title: p.title || '',
      link: p.link || null,
      description: p.description || '',
      sortDate: p.pubDate || new Date().toISOString(),
      pubDate: formatDate(p.pubDate || ''),
      imageUrl: p.imageUrl || null,
      category: p.category || '',
      content: [
        p.content || '',
        ...(Array.isArray(p.images) ? p.images.map(u => `<img src="${u}" />`) : []),
      ].filter(Boolean).join('\n'),
      source: p.source || 'btcc hub',
      sourceUrl: p.sourceUrl || null,
    }))
    .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
    .slice(0, MAX_HUB_POSTS);
}

export async function fetchHubPosts() {
  const uid = auth().currentUser?.uid ?? null;
  try {
    const cached = await cacheRead(HUB_CACHE_KEY, HUB_CACHE_MAX_AGE);
    let data;
    if (cached) {
      // Serve cached immediately, refresh in background
      fetch(`${BASE_GITHUB}/hub_news.json?t=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) cacheWrite(HUB_CACHE_KEY, d); })
        .catch(() => {});
      data = cached;
    } else {
      const res = await fetch(`${BASE_GITHUB}/hub_news.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
      cacheWrite(HUB_CACHE_KEY, data).catch(() => {});
    }
    return mapHubPosts(data, uid);
  } catch {
    // Stale fallback on network error (any age)
    const stale = await cacheRead(HUB_CACHE_KEY);
    if (stale) return mapHubPosts(stale, uid);
    return [];
  }
}

// forceRefresh skips both the index's and the page's 5-minute cache entirely -
// used by ArticleScreen's Retry button, since a slug that just 404'd may have
// been looked up against a stale, pre-commit copy of the index (the article
// mirror commits well after the notification that links to it goes out; see
// newsCheck.js's isSlugMirrored). A plain re-render would otherwise keep
// serving that same cached miss for up to 5 more minutes.
export async function fetchArticleBySlug(slug, forceRefresh = false) {
  try {
    const index = await fetchArticlesIndex(forceRefresh);
    const page = index[slug];
    if (!page) return null;
    const posts = await fetchArticlesPage(page, forceRefresh);
    return posts.find(p => p.slug === slug) ?? null;
  } catch {
    return null;
  }
}
