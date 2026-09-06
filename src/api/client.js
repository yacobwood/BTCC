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
const BUNDLED_PENALTIES_2026 = require('../../data/penalties2026.json');

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
      // Refresh cache in background without blocking - manual AbortController,
      // not AbortSignal.timeout (unreliable on Android/Hermes - see
      // src/utils/weather.js's own identical workaround). Root-caused live
      // 2026-08-28, via the Gallery tab: AbortSignal.timeout(10000) throws
      // synchronously ("AbortSignal.timeout is not a function") when it's
      // unsupported on the runtime - and since this whole `if (cached)`
      // block sits outside this function's own try/catch below, that throw
      // rejected fetchJson()'s entire returned promise instead of resolving
      // it with the cached value already sitting right here. Every cached
      // endpoint's "instant from cache, refresh quietly after" promise
      // silently never held on an affected device for as long as this line
      // existed - invisible until now because every other caller either
      // already displays its own separately-read cached data first (masking
      // a background-refresh rejection) or wraps the call in a bare
      // try{}catch{}. `timeoutId?.unref?.()` mirrors weather.js's own call -
      // a no-op in React Native, but avoids leaving an open timer handle in
      // Jest's Node environment.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      timeoutId?.unref?.();
      fetch(url, {signal: controller.signal})
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) cacheWrite(cacheKey, data); })
        .catch(() => {})
        .finally(() => clearTimeout(timeoutId));
      return cached;
    }
  }
  // No cache (or forced refresh)  -  fetch and wait
  try {
    // forceRefresh is meant to guarantee genuinely fresh data, but a plain
    // fetch(url) can still be served from a CDN edge cache for that exact
    // URL - raw.githubusercontent.com sends Cache-Control: max-age=300, so a
    // repeat request within that window can return the same stale response
    // forceRefresh was meant to bypass (confirmed live 2026-08-22: a push
    // notification's article mirror gate and the phone's own fetch can hit
    // two different edge nodes on two different 5-minute clocks, so the gate
    // passing is no guarantee the requesting device's edge has caught up).
    // Cache-bust with a unique URL, same fix fetchHubPosts already uses for
    // hub_news.json, so this can never be satisfied from any HTTP cache.
    const fetchUrl = forceRefresh ? `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}` : url;
    const res = await fetch(fetchUrl);
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

// Judicial decisions (tools/scraper/scrape_penalties.py, run the Monday
// morning after each round). Same shape/cadence as fetchResults. Falls back
// to the bundled 2026 snapshot on network error (same pattern as
// fetchCalendar/fetchDrivers) rather than an empty list - a 404 is otherwise
// expected and not an error for a year with no penalties.json committed yet
// (e.g. before the first round of a new season has a decision to report).
export async function fetchPenalties(year = 2026, forceRefresh = false) {
  try {
    return await fetchJson(`${BASE_GITHUB}/penalties${year}.json`, `penalties_${year}`, forceRefresh, /* staleFallback */ true, false, 5 * 60 * 1000);
  } catch {
    return year === 2026 ? BUNDLED_PENALTIES_2026 : {season: String(year), rounds: []};
  }
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

// Gallery season index (tools/scraper/scrape_gallery.py) - album metadata
// only (slug/title/cover/round/venue/capture progress), never the full photo
// list, so opening the Gallery tab doesn't download every album's photos up
// front. No bundled-JSON fallback (matches fetchArticles' precedent for a
// non-critical browsing feature) - an offline cold start just shows an
// empty state on this one tab rather than carrying a static snapshot that
// would grow stale the same way a bundled results/calendar file doesn't
// (those get a fresh app release each season; this doesn't).
const GALLERY_MAX_AGE_MS = 60 * 60 * 1000; // matches the scraper's weekly-ish cadence

// Only a 404 degrades to an empty result - that genuinely means "no gallery
// data scraped for this year yet" (same reasoning as fetchPenalties' own
// 404 fallback above). Any other failure (network error, timeout, DNS) must
// propagate rather than be swallowed here: unlike fetchPenalties (which has
// no reachable error UI downstream - RoundResultsScreen just polls again a
// minute later), GalleryTab has its own dedicated error/retry state that
// this function silently swallowing every failure into "empty" would make
// permanently unreachable, indistinguishable from a season that genuinely
// has no albums yet. Found live 2026-08-28: a real device's first-ever
// Gallery fetch (no cache to fall back on) hit a transient failure and
// showed "no gallery albums" instead of a retryable error.
function isNotFound(e) {
  return e?.message?.includes('404');
}

export async function fetchGallery(year = 2026, forceRefresh = false) {
  try {
    return await fetchJson(`${BASE_GITHUB}/gallery${year}.json`, `gallery_${year}`, forceRefresh, /* staleFallback */ true, false, GALLERY_MAX_AGE_MS);
  } catch (e) {
    if (isNotFound(e)) return {season: year, albums: []};
    throw e;
  }
}

// Per-album photo list, fetched only when a user actually opens that album -
// same "index is small, detail is on-demand" split fetchArticles already
// uses for the same reason (an album can be large; most of them are never
// opened in a given session).
export async function fetchGalleryAlbum(year, slug, forceRefresh = false) {
  try {
    return await fetchJson(`${BASE_GITHUB}/gallery/${year}/${slug}.json`, `gallery_album_${year}_${slug}`, forceRefresh, /* staleFallback */ true, false, GALLERY_MAX_AGE_MS);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
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

// propagateError=false (search's multi-page fan-out, and any other caller
// that doesn't pass it) treats one page's genuine failure as "no matches
// from that page" rather than aborting the whole call - reasonable when
// several pages are being combined and one going missing shouldn't sink
// the rest. The primary list fetch (fetchArticles's non-search branch,
// what NewsScreen's Phase 2 calls) passes propagateError=true instead:
// confirmed live 2026-09-03 that silently swallowing here left a genuine
// "Network request failed" indistinguishable from "nothing's published
// yet" - NewsScreen.js already has real staleFallback/error/retry handling
// built for exactly this (fetchJson's own catch already tries a
// bounded-age cached fallback before this ever throws), but it never got
// the chance to run: no error, no retry button, just a permanently blank
// feed under whatever independently-cached widgets (the Flying Lap/Academy
// banners, fed by their own separate fetchHubPosts call) happened to have
// already loaded.
async function fetchArticlesPage(page, forceRefresh = false, propagateError = false) {
  try {
    const posts = await fetchJson(`${ARTICLES_BASE}/page_${page}.json`, `news_p${page}`, forceRefresh, /* staleFallback */ true, /* staleFirst */ false, ARTICLES_MAX_AGE_MS);
    return Array.isArray(posts) ? posts : [];
  } catch (e) {
    if (propagateError) throw e;
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
  if (!q) return fetchArticlesPage(page, forceRefresh, /* propagateError */ true);

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
      // sortDate and orderDate are the same value here - unlike mirror
      // articles (parsers.js's parseArticle), a hub post's own pubDate
      // already carries real time-of-day precision, so there's no separate
      // "official date" vs "detection time" to reconcile. orderDate exists
      // so NewsScreen's feed-ordering code can read one consistent field
      // name regardless of which source an article came from.
      sortDate: p.pubDate || new Date().toISOString(),
      orderDate: p.pubDate || new Date().toISOString(),
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
// newsCheck.js's mirroredImageUrl). A plain re-render would otherwise keep
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

// ── Explainer articles ────────────────────────────────────────────
// Regulation-explainer pieces (Independents' Trophy, TTB, how points are
// scored, etc.) - deliberately a separate file and a separate fetch path
// from hub_news.json/fetchHubPosts, not merged into the News feed the way
// hub posts are. Each entry stays 'staged' (invisible to fetchExplainerArticles)
// until an admin publishes it via the admin panel, which flips status to
// 'published' and commits the change - the same manual-review gate the
// digest/hub pipeline already uses for AI-assisted drafts, see
// project_article_topic_list_drafts memory for why these 48 pieces
// specifically need that review step before reaching real users.
const EXPLAINER_CACHE_KEY = 'explainer_articles';
const EXPLAINER_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes, matches fetchHubPosts

// Local preview switch only - flip to true to see every draft article in a
// dev build (ignoring status and reading the file straight off disk instead
// of the live GitHub copy), then flip back to false before committing or
// running tests. Never ship this as true; it is not read by any test.
const PREVIEW_ALL_EXPLAINERS_LOCALLY = false;

// uid mirrors mapHubPosts' own draft-preview gate exactly (same shape,
// same Firebase Auth uid check) - added 2026-09-03 so an admin can publish
// an Academy article visible only on their own device (status: 'draft' +
// previewDeviceIds: [uid]) before a real Save & Publish, the same way hub
// posts already could. includeAllStatuses (the local-preview debug switch
// below) bypasses this entirely, same as it already bypassed the plain
// published-only filter.
function mapExplainerPosts(data, uid, includeAllStatuses = false) {
  return (data.posts || [])
    .filter(p => {
      if (includeAllStatuses) return true;
      if (p.status === 'published') return true;
      if (p.status === 'draft') {
        const ids = Array.isArray(p.previewDeviceIds) ? p.previewDeviceIds : [];
        return uid && ids.includes(uid);
      }
      return false;
    })
    .map(p => ({
      id: p.id,
      title: p.title || '',
      link: null,
      description: p.description || '',
      sortDate: p.pubDate || p.scheduledDate || new Date().toISOString(),
      orderDate: p.pubDate || p.scheduledDate || new Date().toISOString(),
      pubDate: formatDate(p.pubDate || p.scheduledDate || ''),
      imageUrl: p.imageUrl || null,
      imageCredit: p.imageCredit || null,
      imageCreditUrl: p.imageCreditUrl || null,
      imageLicense: p.imageLicense || null,
      category: p.category || 'Regs Explained',
      content: p.content || '',
      source: p.source || 'btcc hub',
      sourceUrl: null,
      order: typeof p.order === 'number' ? p.order : null,
    }))
    .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
}

// forceRefresh, unlike every other cached fetch in this file, wasn't
// something this function ever had - found live 2026-09-03 while chasing a
// "second preview article isn't showing up" report: an admin previewing
// content wants their own just-published change to show immediately, but
// with no way to bypass the 5-minute on-device cache, not even pull-to-
// refresh on ExplainerListScreen could break through it - the exact same
// load() call just kept re-serving whatever was cached from before the
// preview was published, for up to 5 minutes with nothing the user could
// do about it.
export async function fetchExplainerArticles(forceRefresh = false) {
  const uid = auth().currentUser?.uid ?? null;
  if (PREVIEW_ALL_EXPLAINERS_LOCALLY) {
    return mapExplainerPosts(require('../../data/explainer_articles.json'), uid, true);
  }
  try {
    const cached = forceRefresh ? null : await cacheRead(EXPLAINER_CACHE_KEY, EXPLAINER_CACHE_MAX_AGE);
    let data;
    if (cached) {
      fetch(`${BASE_GITHUB}/explainer_articles.json?t=${Date.now()}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) cacheWrite(EXPLAINER_CACHE_KEY, d); })
        .catch(() => {});
      data = cached;
    } else {
      const res = await fetch(`${BASE_GITHUB}/explainer_articles.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
      cacheWrite(EXPLAINER_CACHE_KEY, data).catch(() => {});
    }
    return mapExplainerPosts(data, uid);
  } catch {
    const stale = await cacheRead(EXPLAINER_CACHE_KEY);
    if (stale) return mapExplainerPosts(stale, uid);
    return [];
  }
}

// Used by notifNavigation.js to resolve a notification's article id into the
// full article object, same role fetchHubPost plays for type:'hub'/'digest'.
// forceRefresh defaults true here (unlike fetchExplainerArticles itself) -
// found live 2026-09-03 as a fourth call site of the same root cause the
// ExplainerListScreen/NewsScreen fix already covered: a notification is
// always about content that JUST changed, so serving a stale on-device
// cache here isn't a reasonable trade-off the way it can be for ordinary
// list browsing. Without it, tapping a notification for an article that
// isn't in the stale cache yet resolves to null, and notifNavigation.js's
// own fallback for that case silently drops the user on the plain
// ExplainerList with no article and no explanation - exactly the bug this
// closes.
//
// Short bounded retry added 2026-09-04: admin.html's own save flow now waits
// for raw.githubusercontent.com to serve the new content before sending the
// notification at all (waitForExplainerLive) - but confirmed live, a report
// of "waited ~2 minutes for the notification, tapped it, article still not
// there" recurred even after that fix shipped. raw.githubusercontent.com is
// served off Fastly's edge network, not one single origin - admin's own
// check (from admin's network path) finding the new content live doesn't
// guarantee every edge node has replicated it yet, and a phone on a
// different network can land on a different, still-stale edge moments
// later. Retrying here rather than stretching admin's wait further treats
// the actual cause (edge propagation isn't atomic across the CDN, so no
// single check from one location can ever fully guarantee it for another)
// instead of chasing a bigger timeout number that would still eventually be
// too small. Only adds latency on the failure path - an article found on
// the first try (the overwhelming majority of taps, especially now that
// admin's own wait already covers most of the delay) resolves exactly as
// fast as before.
export async function fetchExplainerArticleById(id, forceRefresh = true, {retries = 2, retryDelayMs = 3000} = {}) {
  for (let attempt = 0; ; attempt++) {
    const all = await fetchExplainerArticles(forceRefresh);
    const found = all.find(a => String(a.id) === String(id)) ?? null;
    if (found || attempt >= retries) return found;
    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
  }
}
