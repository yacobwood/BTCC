import {useState, useEffect} from 'react';
import {AppState} from 'react-native';

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

async function fetchBroadcaster() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  if (timeoutId?.unref) timeoutId.unref();
  try {
    const text = await fetch('https://cloudflare.com/cdn-cgi/trace', {signal: controller.signal})
      .then(r => r.text());
    clearTimeout(timeoutId);
    const match = text.match(/loc=([A-Z]{2})/);
    return match ? countryToBroadcaster(match[1]) : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export function useBroadcaster() {
  const [broadcaster, setBroadcaster] = useState(() => detectBroadcaster());

  useEffect(() => {
    fetchBroadcaster().then(result => { if (result) setBroadcaster(result); });

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        fetchBroadcaster().then(result => { if (result) setBroadcaster(result); });
      }
    });

    return () => sub.remove();
  }, []);

  return broadcaster;
}
