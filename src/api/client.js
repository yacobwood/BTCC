import {cacheWrite, cacheRead} from '../store/cache';
import {formatDate} from './parsers';
import {getStableDeviceId} from '../utils/deviceId';

const BASE_GITHUB = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data';
const BASE_WP = 'https://www.btcc.net/wp-json/wp/v2';

const BUNDLED_CALENDAR = require('../../data/calendar.json');
const BUNDLED_CALENDAR_2027 = require('../../data/calendar2027.json');
const BUNDLED_DRIVERS = require('../../data/drivers.json');
const BUNDLED_BLACKLIST = require('../../data/blacklist.json');

// Stale-while-revalidate: serve from cache immediately, refresh in background.
// If the cached entry is older than MAX_AGE_MS, treat as a cache miss so the
// user never sees data more than an hour stale.
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// staleFallback: on network error, return any cached value (even expired) rather than throwing
// staleFirst:   serve ANY cached value immediately (no age limit) and always refresh in background;
//               only blocks on network when there is truly nothing cached (cold install).
//               Use for content where showing slightly old data beats a long spinner (e.g. news).
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
      const stale = await cacheRead(cacheKey);
      if (stale) return stale;
    }
    throw e;
  }
}

export async function fetchCalendar(year = 2026) {
  if (year === 2027) return BUNDLED_CALENDAR_2027;
  try {
    return await fetchJson(
      'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json',
      `calendar_${year}`,
      false,
      /* staleFallback */ true,
      /* staleFirst */ false,
      10 * 60 * 1000,
    );
  } catch {
    return BUNDLED_CALENDAR;
  }
}

export async function fetchBlacklist() {
  try {
    return await fetchJson(`${BASE_GITHUB}/blacklist.json`, 'blacklist', false, false, /* staleFirst */ true);
  } catch {
    return BUNDLED_BLACKLIST;
  }
}

export async function fetchDrivers() {
  try {
    return await fetchJson(`${BASE_GITHUB}/drivers.json`, 'drivers', false, false, /* staleFirst */ true);
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
    return await fetchJson(`${BASE_GITHUB}/live_status.json`, 'live_status', false, false, /* staleFirst */ true, 2 * 60 * 1000);
  } catch {
    return null;
  }
}

export async function fetchResults(year = 2026, forceRefresh = false) {
  return fetchJson(`${BASE_GITHUB}/results${year}.json`, `results_${year}`, forceRefresh, false, false, 5 * 60 * 1000);
}


export async function fetchArticles(page = 1, perPage = 20, search = '', forceRefresh = false) {
  let url = `${BASE_WP}/posts?per_page=${perPage}&page=${page}&_embed=1`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const cacheKey = search ? null : `news_p${page}`;
  return fetchJson(url, cacheKey, forceRefresh, /* staleFallback */ true);
}

// Returns any cached articles for a page without triggering a network request.
// Used by NewsScreen to show stale data instantly before fetching fresh data.
export async function peekArticlesCache(page = 1) {
  return cacheRead(`news_p${page}`); // no maxAge  -  any cached data regardless of age
}

const HUB_CACHE_KEY = 'hub_posts';
const HUB_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

function mapHubPosts(data, deviceId) {
  const now = Date.now();
  return (data.posts || [])
    .filter(p => {
      const status = p.status || 'published';
      if (status === 'published') return true;
      if (status === 'scheduled') return p.scheduledAt && new Date(p.scheduledAt).getTime() <= now;
      if (status === 'draft') return deviceId && Array.isArray(p.previewDeviceIds) && p.previewDeviceIds.includes(deviceId);
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
    }));
}

export async function fetchHubPosts() {
  const deviceId = await getStableDeviceId().catch(() => null);
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
    return mapHubPosts(data, deviceId);
  } catch {
    // Stale fallback on network error (any age)
    const stale = await cacheRead(HUB_CACHE_KEY);
    if (stale) return mapHubPosts(stale, deviceId);
    return [];
  }
}

export async function fetchArticleBySlug(slug) {
  const cacheKey = `article_${slug}`;
  return fetchJson(`${BASE_WP}/posts?slug=${slug}&_embed=1`, cacheKey, false, /* staleFallback */ true, /* staleFirst */ true)
    .then(arr => (Array.isArray(arr) ? arr[0] ?? null : arr))
    .catch(() => null);
}
