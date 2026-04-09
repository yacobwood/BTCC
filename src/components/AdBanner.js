import React from 'react';
import {View, StyleSheet} from 'react-native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {Analytics} from '../utils/analytics';

const BANNER_AD_UNIT = 'ca-app-pub-2098489502774763/8563706368';

export default function AdBanner() {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={BANNER_AD_UNIT}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{requestNonPersonalizedAdsOnly: true}}
        onAdFailedToLoad={() => {}}
        onAdImpression={() => Analytics.adImpression('banner')}
        onAdOpened={() => Analytics.adClicked('banner')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {alignItems: 'center', paddingVertical: 4},
});
