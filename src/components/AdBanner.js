import React, {forwardRef} from 'react';
import {View, StyleSheet, Platform} from 'react-native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {Analytics} from '../utils/analytics';

const BANNER_AD_UNIT = Platform.OS === 'ios'
  ? 'ca-app-pub-2098489502774763/2844509580'
  : 'ca-app-pub-2098489502774763/8563706368';

const AdBanner = forwardRef((props, ref) => (
  <View style={styles.container}>
    <BannerAd
      ref={ref}
      unitId={BANNER_AD_UNIT}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{requestNonPersonalizedAdsOnly: true}}
      onAdFailedToLoad={() => {}}
      onAdImpression={() => Analytics.adImpression('banner')}
      onAdOpened={() => Analytics.adClicked('banner')}
    />
  </View>
));

export default AdBanner;

const styles = StyleSheet.create({
  container: {alignItems: 'center', paddingVertical: 4},
});
