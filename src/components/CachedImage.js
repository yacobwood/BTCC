import React, {useState} from 'react';
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

  if (!uri || errored) {
    return (
      <View style={[style, {backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center'}]}>
        <Icon name="image-not-supported" size={24} color="#333" />
      </View>
    );
  }

  return (
    <Image
      source={{uri: src, cache: 'force-cache'}}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        // If thumbnail 404s, fall back to the original URL
        if (src !== uri) { setSrc(uri); } else { setErrored(true); }
      }}
      {...props}
    />
  );
}

// Prefetch a batch of image URLs
export function prefetchImages(urls) {
  urls.forEach(url => {
    if (url) Image.prefetch(url);
  });
}
