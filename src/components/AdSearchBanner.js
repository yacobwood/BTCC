import React from 'react';
import {View, Platform} from 'react-native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {Analytics} from '../utils/analytics';

const AD_UNIT = Platform.OS === 'ios'
  ? 'ca-app-pub-2098489502774763/1405832655'
  : 'ca-app-pub-2098489502774763/3675006417';

export default function AdSearchBanner({visible = true}) {
  if (!visible) return null;
  return (
    <View style={{flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 24}}>
      <BannerAd
        unitId={AD_UNIT}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={{requestNonPersonalizedAdsOnly: true}}
        onAdFailedToLoad={() => {}}
        onAdImpression={() => Analytics.adImpression('search_banner')}
        onAdOpened={() => Analytics.adClicked('search_banner')}
      />
    </View>
  );
}
