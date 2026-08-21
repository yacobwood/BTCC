import {Image} from 'react-native';
import {fetchDrivers, fetchArticles} from '../api/client';
import {parseGrid, parseArticle, thumbUrl, carThumbUrl, carThumbCropUrl} from '../api/parsers';

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
      // cardBgUrl here is already team-cascaded (attachTeamDisplayFields), so
      // most drivers duplicate their team's URL below - harmless (prefetch of
      // an already-cached URL is a no-op), and it's what actually covers a
      // driver-level override (e.g. Nicolas Hamilton, Daniel Lloyd) that
      // differs from their team's, which teams.cardBgUrl alone would miss.
      ...drivers.map(d => thumbUrl(d.cardBgUrl)).filter(Boolean),
      ...drivers.map(d => thumbUrl(d.numberImageUrl)).filter(Boolean),
      // Driver-level, not team-level: each driver now shows their own car on
      // TeamDetailScreen's hero (one card per driver) and their own
      // DriverDetailScreen banner - team.carImageUrl alone would miss a
      // driver whose own liveried car differs from it (e.g. Nick Halstead's
      // "Ask GVT" car vs Steel Seal with Power Maxed Racing's team-level
      // fallback), and this already covers that fallback case too since
      // attachTeamDisplayFields resolves it onto the driver anyway. Both
      // thumbnail variants get prefetched, not just one - carThumbUrl for
      // TeamDetailScreen's plain -thumb, carThumbCropUrl for
      // DriverDetailScreen's tighter -thumb-crop (see that file's comment
      // for why they're different files, not just different sizes).
      ...drivers.map(d => carThumbUrl(d.carImageUrl)).filter(Boolean),
      ...drivers.map(d => carThumbCropUrl(d.carImageUrl)).filter(Boolean),
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
