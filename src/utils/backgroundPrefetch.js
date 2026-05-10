import {Image} from 'react-native';
import {fetchDrivers, fetchArticles} from '../api/client';
import {parseGrid, parseArticle} from '../api/parsers';

const BUNDLED_CALENDAR = require('../../data/calendar.json');
const PREFETCH_CONCURRENCY = 5;

function thumb(url, size = '150x150') {
  if (!url || !url.includes('btcc.net/wp-content/uploads/')) return url;
  return url.replace(/(\.[a-z]+)$/i, `-${size}$1`);
}

// Prefetch up to `concurrency` images at a time to avoid flooding slow connections
async function batchPrefetch(urls, concurrency = PREFETCH_CONCURRENCY) {
  const queue = urls.filter(Boolean);
  const workers = Array.from({length: Math.min(concurrency, queue.length)}, async () => {
    while (queue.length) {
      const url = queue.shift();
      if (url) await Image.prefetch(url).catch(() => {});
    }
  });
  await Promise.all(workers);
}

function prefetchCalendar() {
  const urls = [];
  for (const round of BUNDLED_CALENDAR.rounds || []) {
    if (round.imageUrl) urls.push(thumb(round.imageUrl, '768x768'));
    if (round.layoutImageUrl) urls.push(thumb(round.layoutImageUrl, '300x300'));
    if (round.raceImages) urls.push(...round.raceImages.map(u => thumb(u, '300x300')));
  }
  batchPrefetch(urls);
}

async function prefetchDrivers() {
  try {
    const raw = await fetchDrivers();
    const {drivers, teams} = parseGrid(raw);
    const urls = [
      ...drivers.map(d => thumb(d.imageUrl)).filter(Boolean),
      ...teams.map(t => thumb(t.carImageUrl)).filter(Boolean),
      ...teams.map(t => thumb(t.cardBgUrl)).filter(Boolean),
    ];
    await batchPrefetch(urls);
  } catch {}
}

async function prefetchNews() {
  try {
    const raw = await fetchArticles(1);
    const urls = raw.map(parseArticle).map(a => thumb(a.imageUrl, '300x300')).filter(Boolean);
    await batchPrefetch(urls);
  } catch {}
}

export function runBackgroundPrefetch() {
  // Calendar images are bundled — start immediately
  prefetchCalendar();
  // Network-dependent — run after a short delay so startup isn't impacted
  setTimeout(() => {
    prefetchDrivers();
    prefetchNews();
  }, 3000);
}
