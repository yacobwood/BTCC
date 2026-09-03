import React, {useState, useMemo, useCallback, useRef, useEffect} from 'react';
import {Image, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// WordPress thumbnail sizes generated on upload
const WP_SIZES = [150, 300, 768, 1024];

// Return the smallest WordPress thumbnail >= targetPx, or the original URL
function wpThumb(uri, targetPx) {
  if (!uri || !uri.includes('btcc.net/wp-content/uploads/')) return uri;
  const size = WP_SIZES.find(s => s >= targetPx) || null;
  if (!size) return uri;
  return uri.replace(/(\.[a-z]+)$/i, `-${size}x${size}$1`);
}

// A cell scrolling in/out of a FlatList's render window fast enough to
// cancel an in-flight image request looks identical to a real load failure
// to RN's Image - with no retry, one transient blip permanently shows the
// broken-image icon for a URL that's perfectly fine. Retrying a few times
// covers that without masking a genuinely dead URL forever.
const MAX_RETRIES = 2;
// A screen that mounts many CachedImages at once (e.g. the Teams grid -
// ~20 requests together) can transiently fail several simultaneously if
// they're all retried the instant they error, since that just re-hits the
// same request burst. A short, increasing delay between retries (2026-08-19,
// root-caused live: Team VERTU/LKQ/Speedworks each failed once, in rotation,
// on an otherwise-correct URL) gives the burst time to clear first.
const RETRY_DELAY_MS = 400;

// Simple wrapper that uses React Native's built-in Image with prefetch support.
// Pass `targetWidth` to automatically request the smallest adequate WP thumbnail.
// Pass `fallback` to render something other than the default broken-image icon
// once retries are exhausted - e.g. a plain colour wash for a decorative
// background, where a small icon glyph would look more like a mistake than
// the photo/car/number cases this default fallback was designed for.
export default function CachedImage({uri, style, resizeMode = 'cover', targetWidth, fallback, ...props}) {
  const [src, setSrc] = useState(() => targetWidth ? wpThumb(uri, targetWidth) : uri);
  const [errored, setErrored] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retriesRef = useRef(0);
  const retryTimeoutRef = useRef(null);

  // FlatList/PagerView recycle component instances across list items rather
  // than remounting - without this, a single dead image anywhere poisons
  // every subsequent item that instance gets reused for, since errored/src
  // would otherwise carry over from whatever uri this instance last showed.
  useEffect(() => {
    // Also cancel any retry still pending for the *previous* uri - otherwise
    // a recycled instance could apply a stale delayed retry against the new
    // image it's since moved on to.
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    setSrc(targetWidth ? wpThumb(uri, targetWidth) : uri);
    setErrored(false);
    retriesRef.current = 0;
    setRetryCount(0);
  }, [uri, targetWidth]);

  // Cancel a pending retry if the component unmounts before it fires.
  useEffect(() => () => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
  }, []);

  const source = useMemo(() => ({uri: src}), [src]);
  const handleError = useCallback((e) => {
    // handleError previously had no visibility into *why* a load failed -
    // every failure looked identical (network blip, dead URL, CDN block,
    // decode error) all the way to the broken-image fallback. Logging the
    // native error string here so a genuinely reproducible failure (survives
    // retries + a rebuild) is diagnosable from Metro/logcat instead of
    // guessed at.
    console.warn(`CachedImage load failed for ${src}:`, e?.nativeEvent?.error);
    if (src !== uri) {
      setSrc(uri);
      return;
    }
    // Clear any still-pending retry before scheduling another - each onError
    // used to overwrite retryTimeoutRef with only the latest timer, so an
    // error arriving before the previous retry had actually fired left that
    // earlier timeout orphaned (unreachable by the unmount cleanup below,
    // since only the ref's current value gets cleared). Rare in practice
    // (real network errors are naturally spaced out enough), but a real bug
    // regardless - fixed 2026-08-21 while investigating an unrelated report.
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (retriesRef.current < MAX_RETRIES) {
      retriesRef.current += 1;
      const attempt = retriesRef.current;
      // source.uri is unchanged, so bumping retryCount alone wouldn't make
      // RN's Image actually re-attempt anything - it's used in the key
      // below purely to force a fresh mount, which does. Delayed (rather
      // than immediate) so a request-burst failure gets a chance to clear.
      retryTimeoutRef.current = setTimeout(() => setRetryCount(attempt), RETRY_DELAY_MS * attempt);
    } else {
      setErrored(true);
    }
  }, [src, uri]);

  if (!uri || errored) {
    if (fallback) return fallback;
    return (
      <View style={[style, {backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'}]}>
        <Icon name="image-not-supported" size={24} color="#333" />
      </View>
    );
  }

  return (
    <Image
      key={retryCount}
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
      fadeDuration={0}
      {...props}
    />
  );
}

// Prefetch a batch of image URLs, optionally at a specific WP thumbnail size.
// targetWidth should match the CachedImage targetWidth prop so the prefetched URL
// is identical to the URL the Image component will request.
export function prefetchImages(urls, targetWidth) {
  urls.forEach(url => {
    if (url) Image.prefetch(targetWidth ? wpThumb(url, targetWidth) : url).catch(() => {});
  });
}
