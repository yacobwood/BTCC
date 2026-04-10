import {Image} from 'react-native';
import {fetchDrivers, fetchArticles} from '../api/client';
import {parseGrid} from '../api/parsers';
import {parseArticle} from '../api/parsers';

const BUNDLED_CALENDAR = require('../data/calendar.json');

function prefetch(urls) {
  urls.forEach(url => { if (url) Image.prefetch(url).catch(() => {}); });
}

function prefetchCalendar() {
  const urls = [];
  for (const round of BUNDLED_CALENDAR.rounds || []) {
    if (round.imageUrl) urls.push(round.imageUrl);
    if (round.layoutImageUrl) urls.push(round.layoutImageUrl);
    if (round.raceImages) urls.push(...round.raceImages);
  }
  prefetch(urls);
}

async function prefetchDrivers() {
  try {
    const raw = await fetchDrivers();
    const {drivers, teams} = parseGrid(raw);
    prefetch(drivers.map(d => d.imageUrl).filter(Boolean));
    prefetch(teams.map(t => t.carImageUrl).filter(Boolean));
  } catch {}
}

async function prefetchNews() {
  try {
    const raw = await fetchArticles(1);
    prefetch(raw.map(parseArticle).map(a => a.imageUrl).filter(Boolean));
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
