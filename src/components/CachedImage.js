import React, {useState} from 'react';
import {Image, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Simple wrapper that uses React Native's built-in Image with prefetch support
// Image component already caches on Android (OkHttp disk cache)
export default function CachedImage({uri, style, resizeMode = 'cover', ...props}) {
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
      source={{uri, cache: 'force-cache'}}
      style={style}
      resizeMode={resizeMode}
      onError={() => setErrored(true)}
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
