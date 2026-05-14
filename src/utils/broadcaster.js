import {useState, useEffect} from 'react';

export const BROADCASTERS = {
  uk:            {label: 'ITV4 / ITVX',   sub: 'Free · UK',        url: 'https://www.itv.com/hub/itv4'},
  international: {label: 'Official BTCC', sub: 'Free · Worldwide', url: 'https://www.youtube.com/@OfficialBTCC/streams'},
};

export function detectBroadcaster() {
  try {
    const {timeZone = '', locale = ''} = Intl.DateTimeFormat().resolvedOptions();
    if (timeZone === 'Europe/London' || locale.includes('-GB')) return 'uk';
    if (locale.includes('-US')) return 'us';
    return 'international';
  } catch {
    return 'international';
  }
}

function countryToBroadcaster(code) {
  if (code === 'GB') return 'uk';
  if (code === 'US') return 'us';
  return 'international';
}

export function useBroadcaster() {
  const [broadcaster, setBroadcaster] = useState(() => detectBroadcaster());

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    if (timeoutId?.unref) timeoutId.unref();
    fetch('https://api.country.is', {signal: controller.signal})
      .then(r => { clearTimeout(timeoutId); return r.json(); })
      .then(({country}) => { if (country) setBroadcaster(countryToBroadcaster(country)); })
      .catch(() => {});
    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, []);

  return broadcaster;
}
