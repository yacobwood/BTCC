import {Image} from 'react-native';
import {fetchDrivers, fetchArticles} from '../api/client';
import {parseGrid} from '../api/parsers';
import {parseArticle} from '../api/parsers';

const BUNDLED_CALENDAR = require('../data/calendar.json');

function thumb(url, size = '150x150') {
  if (!url || !url.includes('btcc.net/wp-content/uploads/')) return url;
  return url.replace(/(\.[a-z]+)$/i, `-${size}$1`);
}

function prefetch(urls) {
  urls.forEach(url => { if (url) Image.prefetch(url).catch(() => {}); });
}

function prefetchCalendar() {
  const urls = [];
  for (const round of BUNDLED_CALENDAR.rounds || []) {
    if (round.imageUrl) urls.push(thumb(round.imageUrl, '768x768'));
    if (round.layoutImageUrl) urls.push(thumb(round.layoutImageUrl, '300x300'));
    if (round.raceImages) urls.push(...round.raceImages.map(u => thumb(u, '300x300')));
  }
  prefetch(urls);
}

async function prefetchDrivers() {
  try {
    const raw = await fetchDrivers();
    const {drivers, teams} = parseGrid(raw);
    prefetch(drivers.map(d => thumb(d.imageUrl)).filter(Boolean));
    prefetch(teams.map(t => thumb(t.carImageUrl)).filter(Boolean));
    prefetch(teams.map(t => thumb(t.cardBgUrl)).filter(Boolean));
  } catch {}
}

async function prefetchNews() {
  try {
    const raw = await fetchArticles(1);
    prefetch(raw.map(parseArticle).map(a => thumb(a.imageUrl, '300x300')).filter(Boolean));
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
