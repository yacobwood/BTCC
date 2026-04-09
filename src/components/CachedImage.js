import React from 'react';
import {Image} from 'react-native';

// Simple wrapper that uses React Native's built-in Image with prefetch support
// Image component already caches on Android (OkHttp disk cache)
export default function CachedImage({uri, style, resizeMode = 'cover', ...props}) {
  if (!uri) return null;
  return (
    <Image
      source={{uri, cache: 'force-cache'}}
      style={style}
      resizeMode={resizeMode}
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
