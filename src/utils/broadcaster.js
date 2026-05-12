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
