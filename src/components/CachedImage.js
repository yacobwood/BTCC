import React, {useState, useMemo, useCallback} from 'react';
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

// Simple wrapper that uses React Native's built-in Image with prefetch support.
// Pass `targetWidth` to automatically request the smallest adequate WP thumbnail.
export default function CachedImage({uri, style, resizeMode = 'cover', targetWidth, ...props}) {
  const [src, setSrc] = useState(() => targetWidth ? wpThumb(uri, targetWidth) : uri);
  const [errored, setErrored] = useState(false);
  const source = useMemo(() => ({uri: src}), [src]);
  const handleError = useCallback(() => {
    if (src !== uri) { setSrc(uri); } else { setErrored(true); }
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
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
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
