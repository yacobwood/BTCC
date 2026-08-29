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

// Fires the same content_shared analytics event then opens the OS share
// sheet, wrapped in try/catch so a user cancelling the share sheet (or the
// share sheet itself failing) never surfaces as an unhandled rejection.
// Each caller (DriverDetailScreen, TrackDetailScreen, RoundResultsScreen,
// ResultsScreen) still builds its own bespoke message - that part is
// genuinely different per content type - only this wrapping shape was
// identical across all four, and two of them were missing the try/catch
// before this was factored out.
export async function shareContent(type, id, message) {
  Analytics.contentShared(type, id);
  try {
    await Share.share({message});
  } catch {}
}
