import React, {createContext, useContext, useState, useEffect} from 'react';

const LIVE_URLS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/live_urls.json';

const defaults = {
  saturday: {uk: null, international: null, us: null},
  sunday: {uk: 'https://www.itv.com/hub/itv4', international: 'https://www.youtube.com/@OfficialBTCC/streams', us: null},
};

const LIVE_INFO = {
  saturday: {
    uk:            {label: 'YouTube',       sub: 'Free · UK'},
    international: {label: 'YouTube',       sub: 'Free · Worldwide'},
    us:            {label: 'YouTube',       sub: 'Free · US'},
  },
  sunday: {
    uk:            {label: 'ITV4 / ITVX',   sub: 'Free · UK'},
    international: {label: 'Official BTCC', sub: 'Free · Worldwide'},
    us:            {label: 'Watch Live',    sub: 'Free · US'},
  },
};

export function getLiveInfo(dayKey, broadcaster) {
  return LIVE_INFO[dayKey]?.[broadcaster] || null;
}

const LiveUrlsContext = createContext(defaults);

export function LiveUrlsProvider({children}) {
  const [liveUrls, setLiveUrls] = useState(defaults);

  useEffect(() => {
    (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        if (timeoutId?.unref) timeoutId.unref();
        const data = await fetch(LIVE_URLS_URL, {signal: controller.signal})
          .then(r => { clearTimeout(timeoutId); return r.json(); });
        setLiveUrls(prev => ({...prev, ...data}));
      } catch {}
    })();
  }, []);

  return (
    <LiveUrlsContext.Provider value={liveUrls}>
      {children}
    </LiveUrlsContext.Provider>
  );
}

export function useLiveUrls() {
  return useContext(LiveUrlsContext);
}
