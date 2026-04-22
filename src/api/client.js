import {cacheWrite, cacheRead} from '../store/cache';
import {formatDate} from './parsers';
import {getStableDeviceId} from '../utils/deviceId';

const BASE_GITHUB = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data';
const BASE_WP = 'https://www.btcc.net/wp-json/wp/v2';

const BUNDLED_CALENDAR = require('../data/calendar.json');
const BUNDLED_HUB_DRAFT = require('../../data/hub_news_draft.json');

async function fetchJson(url, cacheKey) {
  // Return cached data immediately if available, refresh in background
  if (cacheKey) {
    const cached = await cacheRead(cacheKey);
    if (cached) {
      // Refresh cache in background without blocking
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) cacheWrite(cacheKey, data); })
        .catch(() => {});
      return cached;
    }
  }
  // No cache yet — fetch and wait
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (cacheKey) cacheWrite(cacheKey, data);
    return data;
  } catch (e) {
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
  const cacheKey = search ? null : `news_p${page}`;
  if (cacheKey) {
    const cached = await cacheRead(cacheKey);
    if (cached) {
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) cacheWrite(cacheKey, data); })
        .catch(() => {});
      return cached;
    }
  }
  try {
    const res = await fetch(url);
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

export async function fetchHubPosts() {
  try {
    const deviceId = await getStableDeviceId();
    // No cache — hub news is author-managed and must reflect deletes/publishes immediately
    const res = await fetch(`${BASE_GITHUB}/hub_news.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
        sortDate: p.pubDate || '',
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
