import React, {createContext, useContext, useState, useEffect} from 'react';

const LIVE_URLS_URL = 'https://raw.githubusercontent.com/yacobwood/BTCC/main/data/live_urls.json';

const defaults = {
  saturday: {uk: null, international: null, us: null},
  sunday: {
    uk:            {url: 'https://www.itv.com/hub/itv4',                      label: 'ITV4 / ITVX'},
    international: {url: 'https://www.youtube.com/@OfficialBTCC/streams',     label: 'Official BTCC'},
    us:            null,
  },
};

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

export function ensureHttps(url) {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : 'https://' + url;
}
