import React, {useState, useMemo, useCallback, useRef} from 'react';
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

// Simple wrapper that uses React Native's built-in Image with prefetch support.
// Pass `targetWidth` to automatically request the smallest adequate WP thumbnail.
export default function CachedImage({uri, style, resizeMode = 'cover', targetWidth, ...props}) {
  const [src, setSrc] = useState(() => targetWidth ? wpThumb(uri, targetWidth) : uri);
  const [errored, setErrored] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retriesRef = useRef(0);
  const source = useMemo(() => ({uri: src}), [src]);
  const handleError = useCallback(() => {
    if (src !== uri) {
      setSrc(uri);
      return;
    }
    if (retriesRef.current < MAX_RETRIES) {
      retriesRef.current += 1;
      // source.uri is unchanged, so bumping retryCount alone wouldn't make
      // RN's Image actually re-attempt anything - it's used in the key
      // below purely to force a fresh mount, which does.
      setRetryCount(retriesRef.current);
    } else {
      setErrored(true);
    }
  }, [src, uri]);

  if (!uri || errored) {
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
