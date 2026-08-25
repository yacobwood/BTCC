import {Share} from 'react-native';
import {Analytics} from './analytics';

const APP_MESSAGE = 'BTCC Hub - the companion app for British Touring Car Championship fans.';

// Single place that builds the "share the app" message, so every entry
// point (More menu, review-prompt nudge, anywhere else later) sends the
// same text and only differs by a ?src= tag for GA4 attribution.
export async function shareApp(origin) {
  Analytics.contentShared('app', origin);
  try {
    await Share.share({message: `${APP_MESSAGE}\n\nhttps://btcchub.vercel.app?src=${origin}`});
  } catch {}
}
