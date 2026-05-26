import {Image} from 'react-native';
import {fetchDrivers, fetchArticles} from '../api/client';
import {parseGrid, parseArticle, thumbUrl} from '../api/parsers';

const PREFETCH_CONCURRENCY = 5;

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

async function prefetchDrivers() {
  try {
    const raw = await fetchDrivers();
    const {drivers, teams} = parseGrid(raw);
    const urls = [
      ...drivers.map(d => thumbUrl(d.imageUrl)).filter(Boolean),
      ...teams.map(t => thumbUrl(t.carImageUrl)).filter(Boolean),
      ...teams.map(t => thumbUrl(t.cardBgUrl)).filter(Boolean),
    ];
    await batchPrefetch(urls);
  } catch {}
}

async function prefetchNews() {
  try {
    const raw = await fetchArticles(1);
    const urls = raw.map(parseArticle).map(a => thumbUrl(a.imageUrl, '300x300')).filter(Boolean);
    await batchPrefetch(urls);
  } catch {}
}

export function runBackgroundPrefetch() {
  setTimeout(() => {
    prefetchDrivers();
    prefetchNews();
  }, 3000);
}
