import {Image} from 'react-native';
import {fetchDrivers, fetchArticles, fetchCalendar} from '../api/client';
import {parseGrid, parseArticle, parseCalendar, thumbUrl, carThumbUrl, carThumbCropUrl} from '../api/parsers';

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
      // '300x300', not thumbUrl's own '150x150' default - DriversScreen's
      // tile and DriverDetailScreen's header both request this fallback
      // photo via targetWidth={300} (only reachable for the 2 departed
      // drivers with no bundled photo, e.g. Max Buxton/James Dorlin, whose
      // imageUrl is still btcc.net-hosted). Prefetching the mismatched
      // default size warmed a URL neither screen ever actually requests -
      // no cache hit, no offline benefit, just wasted bandwidth.
      ...drivers.map(d => thumbUrl(d.imageUrl, '300x300')).filter(Boolean),
      // cardBgUrl: no targetWidth at any render site (DriversScreen,
      // DriverDetailScreen, TeamDetailScreen all request it unmodified), so
      // no thumbUrl() rewrite here either - every current cardBgUrl is
      // GitHub-hosted anyway (thumbUrl no-ops on those), but matching what's
      // actually requested matters the moment a WP-hosted one shows up again.
      // Driver-level, not team-level: covers a driver whose own cardBgUrl
      // differs from their team's (e.g. Nicolas Hamilton, Daniel Lloyd),
      // which teams.cardBgUrl alone would miss.
      ...drivers.map(d => d.cardBgUrl).filter(Boolean),
      ...drivers.map(d => d.numberImageUrl).filter(Boolean),
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
      ...teams.map(t => t.cardBgUrl).filter(Boolean),
      // Sponsor logos (added 2026-08-24, was a real gap - had never been
      // prefetched at all): shown on DriversScreen's Teams tab tile,
      // MerchScreen's team tile and TeamDetailScreen's hero, none of which
      // had ever warmed this URL ahead of time.
      ...teams.map(t => t.logoUrl).filter(Boolean),
      // Not populated on any team as of this writing (checked live against
      // data/drivers.json), but DriversScreen's Teams tab tile and
      // MerchScreen's tile both prefer this over cardBgUrl when present -
      // costs nothing to cover now so it isn't a silent gap the day it is.
      ...teams.map(t => t.cardBgThumbUrl).filter(Boolean),
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

// Circuit guide images (added 2026-08-24, previously never prefetched at
// all) - hero photo, layout map and race-photo carousel for every track in
// the calendar, not just the next round. Only ~10 tracks with a handful of
// images each, so the total is small enough to just cover all of them
// rather than guess which one a fan might actually be checking trackside -
// this is exactly the kind of screen someone would want working with zero
// signal at the circuit itself.
async function prefetchTracks() {
  try {
    const calendar = await fetchCalendar();
    const {rounds} = parseCalendar(calendar);
    const urls = [
      // targetWidth={768}/{300} at TrackDetailScreen's hero/layout-map
      // render sites - matched here so a WP-hosted URL (layoutImageUrl
      // commonly is) actually warms the size that gets requested, not a
      // differently-sized thumbnail that misses the cache. GitHub-hosted
      // URLs (most track hero images) pass through thumbUrl unchanged.
      ...rounds.map(r => thumbUrl(r.imageUrl, '768x768')).filter(Boolean),
      ...rounds.map(r => thumbUrl(r.layoutImageUrl, '300x300')).filter(Boolean),
      // Race-photo carousel renders these via a plain <Image>, not
      // CachedImage - no targetWidth applied there, so no rewrite here either.
      ...rounds.flatMap(r => r.raceImages || []),
    ];
    await batchPrefetch(urls);
  } catch {}
}

export function runBackgroundPrefetch() {
  setTimeout(() => {
    prefetchDrivers();
    prefetchNews();
    prefetchTracks();
  }, 3000);
}
