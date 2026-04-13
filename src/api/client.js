import {cacheWrite, cacheRead} from '../store/cache';

const BASE_GITHUB = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data';
const BASE_WP = 'https://www.btcc.net/wp-json/wp/v2';

const BUNDLED_CALENDAR = require('../data/calendar.json');

async function fetchJson(url, cacheKey) {
  const t = Date.now();
  const sep = url.includes('?') ? '&' : '?';
  try {
    const res = await fetch(`${url}${sep}t=${t}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (cacheKey) cacheWrite(cacheKey, data);
    return data;
  } catch (e) {
    // Fallback to cache on network error
    if (cacheKey) {
      const cached = await cacheRead(cacheKey);
      if (cached) return cached;
    }
    throw e;
  }
}

export function fetchCalendar() {
  return BUNDLED_CALENDAR;
}

export async function fetchDrivers() {
  return fetchJson(`${BASE_GITHUB}/drivers.json`, 'drivers');
}

export async function fetchStandings() {
  return fetchJson(`${BASE_GITHUB}/standings.json`, 'standings');
}

export async function fetchResults(year = 2026) {
  return fetchJson(`${BASE_GITHUB}/results${year}.json`, `results_${year}`);
}


export async function fetchArticles(page = 1, perPage = 20, search = '') {
  let url = `${BASE_WP}/posts?per_page=${perPage}&page=${page}&_embed=1`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  const t = Date.now();
  const cacheKey = search ? null : `news_p${page}`;
  try {
    const res = await fetch(`${url}&t=${t}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (cacheKey) cacheWrite(cacheKey, data);
    return data;
  } catch (e) {
    if (cacheKey) {
      const cached = await cacheRead(cacheKey);
      if (cached) return cached;
    }
    throw e;
  }
}

export async function fetchHubPosts(preview = false) {
  const file = preview ? 'hub_news_draft.json' : 'hub_news.json';
  const cacheKey = preview ? null : 'hub_news';
  try {
    const data = await fetchJson(`${BASE_GITHUB}/${file}`, cacheKey);
    return (data.posts || []).map(p => ({
      id: p.id,
      title: p.title || '',
      link: p.link || null,
      description: p.description || '',
      pubDate: p.pubDate || '',
      imageUrl: p.imageUrl || null,
      category: p.category || '',
      content: p.content || '',
      source: 'btcc hub',
    }));
  } catch {
    return [];
  }
}

export async function fetchArticleBySlug(slug) {
  const res = await fetch(`${BASE_WP}/posts?slug=${slug}&_embed=1`);
  if (!res.ok) return null;
  const arr = await res.json();
  return arr.length > 0 ? arr[0] : null;
}
