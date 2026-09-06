# BTCC Hub - Complete System Documentation

> This is the authoritative technical reference for the BTCC Hub mobile application. It covers the product, architecture, data pipeline, backend services and operational processes end to end.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Application Entry Point](#4-application-entry-point)
5. [Navigation Architecture](#5-navigation-architecture)
6. [Screens Reference](#6-screens-reference)
7. [State Management - Context Stores](#7-state-management---context-stores)
8. [Data Layer - API Client](#8-data-layer---api-client)
9. [Data Sources](#9-data-sources)
10. [Data Files](#10-data-files)
11. [Notifications System](#11-notifications-system)
12. [Firebase Cloud Functions](#12-firebase-cloud-functions)
13. [Scoring and Race Format](#13-scoring-and-race-format)
14. [Starting Grid System](#14-starting-grid-system)
15. [Judicial Decisions (Penalties) System](#15-judicial-decisions-penalties-system)
16. [Feature Flags](#16-feature-flags)
17. [Design System](#17-design-system)
18. [Shared Components](#18-shared-components)
19. [Utility Modules](#19-utility-modules)
20. [Python Scrapers](#20-python-scrapers)
21. [Admin Interface](#21-admin-interface)
22. [Test Suite](#22-test-suite)
23. [Build and Release](#23-build-and-release)
24. [Deep Linking](#24-deep-linking)
25. [Known Architecture Decisions](#25-known-architecture-decisions)

---

## 1. Product Overview

BTCC Hub is a React Native mobile application for fans of the British Touring Car Championship. It delivers:

- Live and historical race results, standings and season progression across all years from 2004 to present
- A race calendar with track details, session schedules, lap records, weather and YouTube race replays
- Driver and team profiles with career statistics and live 2026 championship standings
- Push notifications for pre-session alerts, race results, news articles and podcast episodes
- An in-app news feed combining official btcc.net articles with curated hub content
- A community chat room (feature-flag gated)
- Live radio streams and podcast archive
- Spoiler-free mode to hide results until the user is ready
- An all-time records screen with championship, win, podium and pole statistics

The app is published on both the Apple App Store and Google Play Store.

Current version: **2.20.10** (versionCode 88)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.84.1 (New Architecture / Hermes enabled) |
| Language | JavaScript (screens/stores/utils) + TypeScript (App.tsx entry point) |
| React | 19.2.3 |
| Navigation | React Navigation 7.x - bottom tabs + native stack |
| Push notifications | Firebase Cloud Messaging (FCM) + Notifee |
| Analytics | Firebase Analytics |
| Crash reporting | Firebase Crashlytics |
| Real-time data | Firebase Realtime Database (chat) |
| Backend storage | Firestore (comments, reactions, bug reports, roadmap votes) |
| Backend logic | Firebase Cloud Functions (Node.js) |
| Data hosting | GitHub raw file CDN (`raw.githubusercontent.com`) |
| News source | GitHub-mirrored btcc.net article snapshot (`data/articles/page_<n>.json` + `index.json` - see [§20](#20-python-scrapers); btcc.net is now a Vercel-hosted React app with no public REST API, so the app never hits it directly) |
| Podcast source | Buzzsprout RSS |
| Weather | Open-Meteo (free, no API key) |
| Live timing | TSL SignalR |
| Radio (iOS) | react-native-track-player |
| Radio (Android) | Native RadioService NativeModule |
| Charts | react-native-svg |
| WebView | react-native-webview |
| Text-to-speech (article read-aloud) | @mhpdev/react-native-speech (New Architecture only, on-device OS voices, no cloud/per-request cost) |
| Ads | react-native-google-mobile-ads (AdMob) |
| In-app review | react-native-in-app-review |
| Splash screen | react-native-bootsplash |
| Device info | react-native-device-info |
| Testing | Jest + @testing-library/react-native |

---

## 3. Project Structure

```
BTCC/
├── App.tsx                    Entry point - providers, dialogs, notification wiring
├── index.js                   React Native registration
├── src/
│   ├── api/
│   │   ├── client.js          All fetch calls - stale-while-revalidate pattern
│   │   └── parsers.js         Transform raw JSON/WordPress into app models
│   ├── assets/
│   │   ├── driverImages.js    Bundled require() map for driver photos
│   │   ├── teamImages.js      Bundled require() map for team car images
│   │   └── seasonData.js      Bundled 2026 standings/results for offline use
│   ├── components/
│   │   ├── AdBanner.js        Google AdMob banner
│   │   ├── CachedImage.js     Image with thumbnail URL rewriting + fallback
│   │   ├── ErrorBoundary.js   Top-level React error boundary
│   │   ├── OnboardingDialog.js First-run notification permission prompt
│   │   ├── ProgressionChart.js Points-over-rounds SVG line chart
│   │   ├── SeasonTable.js     Race-by-race results grid
│   │   ├── SpoilerClearedDialog.js Notifies user spoiler mode auto-expired
│   │   ├── SwipeableTabs.js   PagerView-based tab switcher with lazy loading
│   │   ├── UKMapPin.js        SVG map pin for track location on UK outline
│   │   └── UpdateDialog.js    Force-update modal
│   ├── config/
│   │   └── firebase.js        Firebase app initialisation
│   ├── navigation/
│   │   └── AppNavigator.js    Tab navigator + all stack navigators + deep link config
│   ├── screens/               One file per screen (see Section 6)
│   ├── store/
│   │   ├── cache.js           AsyncStorage wrapper with timestamps
│   │   ├── favouriteDriver.js Context: starred drivers array
│   │   ├── featureFlags.js    Context: remote flags from flags.json
│   │   ├── radio.js           Context: platform-specific radio playback
│   │   ├── reviewPrompt.js    Logic for in-app review trigger
│   │   ├── settings.js        Context: all user preferences + FCM topic sync
│   │   └── units.js           Context: km vs miles preference
│   ├── theme/
│   │   └── colors.js          Centralised colour tokens
│   └── utils/
│       ├── analytics.js       Firebase Analytics event helpers
│       ├── backgroundPrefetch.js Pre-warms image cache on app start
│       ├── broadcaster.js     Utility for broadcasting state changes
│       ├── deviceId.js        Stable anonymous device identifier
│       ├── digestRead.js      Tracks which digests have been read
│       ├── driverName.js      Formats driver names (Tom INGRAM style)
│       ├── explainerRead.js   Tracks which Academy articles have been read
│       ├── notifNavigation.js Maps notification data payloads to screen routes
│       ├── notifications.js   Channel setup + permission requests
│       ├── profanityFilter.js Checks text against blacklist.json
│       ├── reviewPrompt.js    Decides when to trigger in-app review
│       ├── signalr.js         TSL SignalR client for live timing
│       ├── timeAgo.js         Relative time formatting
│       └── weather.js         Open-Meteo daily + hourly fetch, temperature/condition helpers
├── data/                      Bundled + GitHub-served JSON data files
├── functions/
│   └── index.js               All Firebase Cloud Functions
├── tools/
│   └── scraper/               Python scrapers (TSL PDFs, calendar, schedule, YouTube)
├── admin/
│   └── standings-admin.html   Admin web UI for standings, notifications, flags
├── regulations/
│   └── 2026-BTCC-Regulations.pdf Official regulations (referenced for rule implementation)
└── __tests__/                 Jest test suite
```

---

## 4. Application Entry Point

**File:** [App.tsx](App.tsx)

`App.tsx` is the outermost shell. It does four things:

### 4.1 Provider Tree

Providers are nested in this exact order (outermost to innermost). Order matters because inner providers can consume outer ones:

```
ErrorBoundary
  SafeAreaProvider
    FeatureFlagsProvider       Fetches flags.json on start - gates features
      FavouriteDriverProvider  Starred drivers array
        UnitsProvider          km vs miles preference
          SettingsProvider     All notification + spoiler settings + FCM sync
            RadioProvider      Platform radio playback state
              AppNavigator     The entire navigation tree
              AppDialogs       Onboarding, update prompt, spoiler-cleared dialog
```

### 4.2 AppDialogs Component

Rendered alongside the navigator (not inside it) so dialogs appear above all screens. Manages three modals:

- **OnboardingDialog** - shown once on first launch; prompts for notification permission
- **UpdateDialog** - shown when `update_available` flag is set and the installed build number is below `update_min_version_android` or `update_min_version_ios`
- **SpoilerClearedDialog** - shown when spoiler-free mode auto-expires (next Monday 23:00 local time)

### 4.3 Startup Side Effects (useEffect in App)

On every app launch:

1. iOS ATT tracking permission prompt (App Store guideline 2.1 compliance)
2. AdMob UMP/GDPR consent flow, then `MobileAds().initialize()`
3. Firebase Crashlytics enabled
4. Notification channel setup (Android)
5. Background image prefetch (`runBackgroundPrefetch`)
6. Stale cache eviction (`cacheEvictStale`)

### 4.4 Notification Routing

Five separate notification entry points are wired across `App.tsx` and `index.js`:

| State | Handler |
|---|---|
| App killed - Notifee press | `notifee.getInitialNotification()` (`App.tsx`) |
| App backgrounded - Notifee press | `notifee.onBackgroundEvent()` (`index.js`) |
| App background - FCM tap | `onNotificationOpenedApp()` (`App.tsx`) |
| App killed - FCM tap | `getInitialNotification()` (`App.tsx`) |
| App foregrounded | `notifee.onForegroundEvent()` (`App.tsx`) |

Since the real production news/podcast/broadcast notifications are data-only FCM messages (no top-level `notification` field - see `functions/newsCheck.js`/`send-test-notif.yml`), what the user actually sees and taps is a **Notifee**-displayed local notification built by `index.js`'s `setBackgroundMessageHandler` - so the two Notifee rows above are the ones that matter for those in practice, not the two FCM-tap rows (those only fire for a message with its own top-level `notification` payload, which none of this app's senders currently use).

All five call `handleNotificationOpen(navigationRef, data)` from [src/utils/notifNavigation.js](src/utils/notifNavigation.js), which tracks `notificationOpened`/`articleClicked` analytics before delegating to `navigateFromData()`. **Fixed 2026-08-12:** `notifee.onBackgroundEvent()` in `index.js` was a no-op stub (`async () => {}`), on the mistaken assumption that `App.tsx`'s `getInitialNotification()` polling covered every lifecycle state - it structurally can't, since that API only ever reports the notification that cold-started the app. The practical symptom: tapping a notification while the app was open-but-backgrounded just foregrounded the app with no navigation at all.

A foreground FCM message with `type: 'results_refresh'` deletes the cached results entry rather than showing a notification, so the next screen open fetches fresh data.

---

## 5. Navigation Architecture

**File:** [src/navigation/AppNavigator.js](src/navigation/AppNavigator.js)

React Navigation 7 with a bottom tab navigator containing 5 permanent tabs and 1 flag-gated tab.

### 5.1 Tab Structure

| Tab | Label | Icon | Initial Screen | `unmountOnBlur` |
|---|---|---|---|---|
| News | News | article | NewsFeed | true |
| Calendar | Calendar | date-range | CalendarList | true |
| Grid | Grid | groups | DriversList | true |
| Chat | - | - | ChatFab + ChatScreen modal | Floating button, gated on `live_chat` flag |
| Results | Season | emoji-events | ResultsList | **false** (preserves year state) |
| More | More | more-horiz | MoreMenu | true |

Results tab is labelled "Season" in the tab bar and uses `unmountOnBlur: false` so the year selection is preserved when switching tabs.

### 5.2 Stack Navigators

Each tab has its own nested `Stack.Navigator`:

**NewsStack:** NewsFeed → Article → Digests

**CalendarStack:** CalendarList → TrackDetail → LiveTiming

**DriversStack:** DriversList → DriverDetail → TeamDetail

**ResultsStack:** ResultsList → RoundResults → GalleryAlbum → Records

**MoreStack:** MoreMenu → Settings → InfoPage → BugReport → Listen → Radio → Podcasts → Records → Partners → Roadmap → TocaRadio

### 5.3 Global Settings

All screens use `animation: 'none'` - no page transition animations. This is deliberate and must not be changed.

### 5.4 Tab Press Behaviour

`useTabPressReset` ([src/navigation/useTabPressReset.js](src/navigation/useTabPressReset.js)) subscribes directly to the parent tab navigator's own `tabPress` event, and does two things when the user taps a tab they're already on: resets that stack to its root screen (clears any nested navigation) and runs an optional scroll-to-top callback the calling screen passes in. Previously the stack-reset lived in `AppNavigator.js` (as `useResetStackOnTabPress`) while each screen with a scroll-to-top need (Calendar/Grid/More/Results) separately wired its own `useFocusEffect` for it - since `useFocusEffect` fires on *any* focus, that meant scroll position was lost on an innocent back navigation from a detail screen too, not just an actual tab press. Consolidating both into one hook, driven by the real `tabPress` event, fixed that: back navigation from TrackDetail/DriverDetail/RoundResults now preserves scroll position, and only a genuine tab bar tap resets it. Screens import the hook directly from its own file rather than through `AppNavigator.js`, so they don't pull in that file's imports of every other screen in the app. `MerchScreen` has no nested detail routes of its own, so it never needed this at all - its old `useFocusEffect` scroll-reset was just removed outright, not migrated.

### 5.5 Ad Banner

`AdBanner` is positioned below the tab bar and gated behind the `banner_ad` feature flag (default `false`). When the flag is off the container is not rendered at all, keeping `ChatFab`'s `bottomOffset` clean. When on, the banner stays hidden until the first ad loads (`loaded` state starts `false`) to prevent the empty container from flashing before the ad arrives. `BannerAd` manages its own refresh timer internally - no manual `.load()` calls are needed.

---

## 6. Screens Reference

### News Stack

**NewsScreen** ([src/screens/NewsScreen.js](src/screens/NewsScreen.js))
Combines two feeds: official btcc.net articles (from the GitHub-mirrored `data/articles/page_<n>.json` snapshot - see [§20](#20-python-scrapers); btcc.net is a Vercel-hosted React app with no public REST API, so the app never hits it directly) and curated hub posts (from `hub_news.json` on GitHub). Features: search with debounce (fetches every mirrored page and filters client-side by title/content, not a live btcc.net search - see §8's `fetchArticles` row for why that's a deliberate one-off cost only paid when actually searching), pagination (each page a separate ~20-article fetch, so scrolling deep into the archive doesn't cost more per page than scrolling the first one), hideDigests filter toggle, real-time Firestore reactions (emoji voting). Hub news requires `hub_news_enabled` feature flag. Article cards show category, date and featured image. Favourite driver highlighting applied when a driver's name appears in article title. Hero/feed ordering across the two sources uses each article's `orderDate` (added 2026-08-24), not `sortDate` - btcc.net's own `date` field has no time-of-day (always midnight), so two mirror articles published the same day used to tie on it, and any same-day hub post (whose `pubDate` does carry real time-of-day) always won that tie regardless of which was actually newer/seen more recently. `parseArticle` (`api/parsers.js`) sets a mirror article's `orderDate` from the scraper's `firstSeenAt` timestamp (falling back to `sortDate` for older archived articles that predate that field); `mapHubPosts` (`api/client.js`) just aliases a hub post's already-precise `pubDate` as both fields. `sortDate` itself is untouched by this and keeps meaning "official publish date" - it still drives the displayed article header date and the GA4 `publish_date` param ([§19](#19-utility-modules)), neither of which should reflect scrape-detection time.

**ArticleScreen** ([src/screens/ArticleScreen.js](src/screens/ArticleScreen.js))
WebView article reader for btcc.net articles. Adds Firestore comments (with commenter name input and optimistic posting), like/dislike reactions, a view counter, share button and external link option. Tracks scroll depth for Firebase Analytics. Accepts either a full article object or just a `slug` parameter (resolved via `data/articles/index.json` to find which page file actually holds it, if needed). If the slug isn't found (e.g. a just-published article the mirror hasn't picked up yet in its 5-minute refresh cycle) or the lookup fails, shows a "Couldn't load this article" retry state instead of spinning forever - but only after the very first automatic (mount-triggered) load has already gotten one immediate, cache-bypassing silent re-attempt, since a notification can fire before the slower article-mirror commit lands and the on-device cache can still be serving that pre-commit snapshot of the index for up to 5 minutes (same race the manual Retry button already accounted for below; root-caused live via device trace 2026-08-13 - an earlier version of this auto-retry re-read the same stale cache instead of bypassing it, so it reliably missed twice). Manual Retry-button presses don't get a second silent layer stacked on top. The initial load reads the index's normal 5-minute cache, but both the silent auto-retry and the manual Retry pass `forceRefresh=true` all the way through `fetchArticleBySlug` so neither can just replay the same cached miss. Signed-in users can edit and delete their own comments - edit uses Firestore REST PATCH with `updateMask.fieldPaths` to update only `text` and `editedAt` without touching reactions. Edited comments show an "edited" label. Delete uses Firestore REST DELETE and removes the item from local state optimistically. View count lives in `article_views/{slug}` (mirrors the `article_reactions` increment pattern: a Firestore `:commit` transform with `fieldTransforms: [{fieldPath: 'views', increment: 1}]`). Every WebView load records a view and re-fetches the total, shown next to the reaction buttons - no dedup, so the same person re-opening the article counts each time by design. A "Source: <link>" line renders at the bottom of the article body (`buildHtml()`, exported for direct unit testing) - hub posts show their own explicit `sourceUrl` verbatim (e.g. a credited Reddit thread), regular btcc.net-scraped articles fall back to a clean "btcc.net" label linking to `article.link`. Tapping it opens the system browser, not the in-app WebView (`onShouldStartLoad` only allows same-window navigation to the bare btcc.net root).

**Read aloud** (added 2026-09-02): a headphones icon in the header, next to Share, uses `@mhpdev/react-native-speech` (New Architecture TurboModule, on-device OS voices - no cloud TTS API, no per-request cost, works offline) to read the article's body aloud. Tapping it starts playback and the single headphones icon splits into two buttons: a pause/resume toggle and a separate stop button, both staying visible until playback is stopped (idle collapses back to the single headphones icon). Leaving the screen (`navigation.addListener('blur', ...)`) also stops it, since there's no background-audio session for this the way RadioScreen's `react-native-track-player` has - a still-talking article after navigating away would just be a stuck voice, not a feature. The blur listener reads the current reader status and stop function through refs rather than closing over them directly - both change on every play/pause/resume and a listener re-registered on each of those changes would leave React Navigation holding whichever closure was current when it last fired, silently under-reporting the `article_listen_stopped` GA4 event. `htmlToSpeechText()` (`src/utils/htmlToSpeechText.js`) converts the article's HTML body to plain speech-friendly text - the one non-trivial part is a `<table>` (23 of the 48 Academy articles now have one), which reads as unintelligible tag soup if just tag-stripped, so each row becomes its own sentence restating both column headers ("Position: 1st. Points: 20.") rather than raw markup. `useArticleReader()` (`src/utils/useArticleReader.js`) wraps the library's single-utterance `speak()` call in a small chunking queue, since Android's engine rejects anything over `Speech.maxInputLength` (commonly ~4000 characters) in one call - chunks split on the nearest sentence boundary under ~3500 characters and play back to back via the `onFinish` event, so pause/resume and the overall play/pause icon state stay correct across an arbitrarily long article without the caller (ArticleScreen) needing to know chunking exists at all. Full GA4 coverage: `article_listen_started/paused/resumed/completed/stopped/failed`. Requires a native rebuild (`pod install` on iOS) after installing, since it's a native TurboModule, not something Fast Refresh alone picks up.

**Voice quality (added 2026-09-02):** Android's `quality` field on a voice is not a usable signal - every installed voice reports "Enhanced" regardless of actual tier, confirmed live on a test device where the default voice dispatched was its lowest tier despite that label. `resolveVoice()` in `useArticleReader.js` deliberately never requests a `network` voice (Google's cloud TTS) even though those sound dramatically more natural than a `local`/`embedded` one - repeated live testing showed the network voice fails on the large majority of attempts and Android's own TTS service silently substitutes ITS OWN fallback voice underneath (a different, uncontrolled identifier practically every time, observed as `en-gb-x-gbb-lstm-embedded`/`en-gb-x-gbb-seanet-embedded`/`en-gb-x-gba-local` across different runs) before this app's own code ever gets a chance to act. That substitution isn't visible to `Speech.onStart`/`onFinish` as anything other than "the requested voice eventually started a bit late", so no amount of app-level tuning aimed at a network voice could reliably reach what actually gets heard. Going local-only instead is fully predictable: `PREFERRED_VOICE_IDENTIFIER` (`en-gb-x-gbb-local`), `VOICE_PITCH` (`1.0`) and `VOICE_RATE` (`1.0`) are exactly what the user tested and approved via a temporary in-app "Voice Lab" tool built for this (voice list + pitch/rate steppers + a fixed test phrase), removed once the values were settled. `resolveVoice()` falls through to the first en-GB local/embedded voice, then any en-GB voice, then whatever's first, if that specific identifier isn't present on a given device (different manufacturer, OS version). On iOS none of this filtering vocabulary matches anything, so it resolves null and `start()` simply leaves the OS's own default voice in place (already decent quality there, unlike Android's raw default) - a no-op on that platform by design.

A chosen voice can still fail to ever start producing audio - this WAS observed live even with a single deterministic local voice - root-caused (09-02) to `@mhpdev/react-native-speech`'s own native Android `speak()` implementation, which decides whether to actually dispatch a queued utterance based on `TextToSpeech.isSpeaking`, a flag that can still read stale right after a `stop()` call (the engine is bound to a remote system service over Binder IPC and `stop()` can return before that service's own internal state has caught up). When the race hits, `speak()` still resolves with a valid utterance id, so nothing on the JS side can tell from the promise alone - the item just sits silently queued forever with no event ever firing for it. A 6-second `Speech.onStart`-based timeout catches this and retries the identical chunk once, which reliably clears it since the stale state has settled by the time the retry runs - only escalating to a real `onError` if that retry also times out, which would mean a genuinely broken voice rather than this specific race. The retry allowance is per-chunk, reset on every genuine `onStart`, so a later chunk that hits the same race still gets its own attempt rather than inheriting an earlier chunk's used-up one.

`useArticleReader()` exposes a second `isBuffering` flag alongside `status`, true from the moment `start()` is called until `Speech.onStart` genuinely fires (or the attempt fails outright) - the header button shows a small `ActivityIndicator` in that window instead of the pause icon, labelled "Starting article read-aloud" for screen readers. Without it the button looked identical whether audio was actually playing or synthesis just hadn't started yet, so even an ordinary couple-hundred-millisecond gap before the first chunk began read as the app being broken rather than starting up. Only tracked for a fresh `start()`, not every chunk-to-chunk handoff within one article, since a voice that has already started tends to start again quickly.

`start()` also awaits any `Speech.stop()` still in flight from a just-pressed Stop before dispatching a new `speak()` call - `Speech.stop()` is genuinely asynchronous on the native side, and calling Stop then Listen in quick succession could otherwise race a fresh utterance against a stop command that hadn't landed on the engine yet.

**DigestsScreen** ([src/screens/DigestsScreen.js](src/screens/DigestsScreen.js))
Lists AI-generated weekly digest articles from hub_news.json filtered to the Weekly Digest category. Branded "The Flying Lap" in the UI (header, banner, Settings toggle, push notification title) covering both the post-race weekly edition and the pre-race buildup edition - renamed 2026-08-26 from "BTCC Monday Roundup" since the admin can trigger a new edition on demand and the old name tied it to a fixed day/cadence that no longer held.

**ExplainerListScreen** ([src/screens/ExplainerListScreen.js](src/screens/ExplainerListScreen.js))
Lists "Academy" articles (displayed name renamed from "Explained" 2026-09-02, at the user's request for a better learning/expert-themed name - unrelated to the separate fix that same day for "The Flying Lap"'s tile text getting cut off, which sits alongside this one on the News home screen but wasn't a naming issue) - regulation-explainer pieces BTCC Hub writes itself (how TTB works, how points are scored, why the ride height minimum exists, etc.), added 2026-09-01. Sourced from `data/explainer_articles.json` via `fetchExplainerArticles()` (`api/client.js`), a separate fetch path from `hub_news.json` and deliberately never merged into the real News feed's `visibleArticles` - these are BTCC Hub's own writing, not btcc.net journalism, and must never look like the latter to a user scrolling News. Reached via a teaser tile in `NewsScreen`'s banner row, rendered half-width alongside the Flying Lap digest banner (both share one row; either renders full-width alone if the other has nothing to show). The teaser itself, and this whole section, stay invisible until an admin has published at least one article - `explainer_articles.json` holds all articles from day one with a `status: 'staged'|'published'` field, and `fetchExplainerArticles()` filters to `published` only. The tile turns yellow with an unread count exactly like the Flying Lap banner (added 2026-09-03) - Academy already had its own read/unread tracking, `explainerRead.js` (a direct port of `digestRead.js`, backing `ExplainerListScreen`'s own read/unread UI), the tile itself had just never been wired up to it and always rendered in the plain grey "read" style regardless of unread count.

**Preview on my device (added 2026-09-03):** the admin ACADEMY tab's edit form has a "Preview on my device" button alongside Save Changes / Save & Publish, mirroring the `previewDeviceIds` gate hub posts already had. Sets `status: 'draft'` + `previewDeviceIds: [uid]` on the article and commits - `mapExplainerPosts()` (`api/client.js`) filters a `'draft'` article in exactly like `mapHubPosts()` already does: visible only when the current Firebase Auth uid (`Settings → User ID` in the app) is in that array, invisible to everyone else including the real News tab. Lets a full article be checked end to end (rendering, images, tables, links, and now the notification too) on a real device before it's genuinely public. Originally shipped without a notification (reasoning: the separate "Send test notification to my device" button already covered that) - revised the same day once actual use showed that split was the wrong default: someone clicking Preview to test the whole flow expects the same experience a real Save & Publish gives everyone else, article visible *and* a notification arriving, not just the former. `dispatchTestExplainerNotif()` is shared between the standalone button and the preview save path, sending to the same cached device token via `send-test-notif.yml`, never the real `explainer_alerts` topic - the standalone button now exists for the narrower case of wanting just the notification with no change to what's saved. Clicking Preview on an already-published article demotes it back to device-only after a confirmation, since that would otherwise silently pull a live article off the real News tab for everyone else. A plain Save Changes on an article already in this state leaves `previewDeviceIds` untouched (still visible to that device); only an actual Save & Publish clears it, since that's the one transition where leaving it behind would be stale and meaningless. Clicking Preview **appends** the admin's uid to any existing `previewDeviceIds` (deduped), rather than replacing the array - found live the same day that replacing it silently erased a second device that had been added directly (e.g. a QA emulator's uid, added via the GitHub contents API rather than through this button), the moment anyone next re-clicked Preview on that article. `getMyUid()`/`changeMyUid()` cache the admin's own uid in `localStorage` (`btcc_my_uid`) the same way `getMyDeviceToken()` already does for the device token - but until this same day, only the device token had a visible "change device" link to update it once cached; the uid could only ever be set once (first use) with no way to correct it afterward short of clearing browser storage. Found live when the cached uid turned out to be stale (it doesn't track the device's identity automatically - if the underlying device is ever reset, the cached value silently stops matching, and every future Preview click keeps authorizing a uid that no longer means anything). Added a matching "change my device's User ID" link below the Preview button.

**The actual cause of the "notification arrives but the article isn't there" reports (several distinct fixes above genuinely fixed real bugs found along the way, but none of them was this):** `raw.githubusercontent.com` can take up to a couple of minutes to serve a just-committed file's *new* content - a genuine backend propagation delay, not an HTTP caching issue the app's own cache-busting `?t=` query params can do anything about (those only defeat proxy/CDN caching of an *existing* response, not a backend that hasn't finished replicating a brand-new commit yet). The notification itself always arrives immediately regardless (it's a direct FCM push, nothing to do with this), so tapping it right away could land on the real content before raw.githubusercontent.com was actually ready to serve it - `fetchExplainerArticleById` correctly did a genuine live fetch (per its own `forceRefresh` fix above) and correctly found nothing, because at that exact moment there was genuinely nothing to find yet, anywhere. Confirmed directly: dispatching a test notification and waiting even 15+ seconds before tapping reliably worked; tapping immediately never did, regardless of how many other fixes had already shipped.

**Fixed for real 2026-09-04, not just documented:** admin's `saveExplainers()` (`admin/standings-admin.html`) now waits for `raw.githubusercontent.com` to actually be serving the new state before firing the notification at all, via `waitForExplainerLive()` - polls the raw file (fresh `?t=` each attempt) up to ~2 minutes until the just-committed article matches (`status === 'published'` for a real publish, `previewDeviceIds` containing the admin's uid for a device preview), only then dispatches. The edit card shows a live countdown ("confirming it's live before notifying… (Ns)") instead of closing immediately, since the wait can now take a while. A timeout still notifies anyway rather than silently dropping a real publish - the note under the Preview/Publish buttons stays as a fallback explanation for that rare case, but is no longer the primary mitigation.

**Same day, immediately after - the wait-before-notify fix above didn't fully close it either:** confirmed live via a direct `git log`/curl check that the article really was committed and really was being served by `raw.githubusercontent.com` within minutes, matching `waitForExplainerLive`'s own confirmation - yet a real device still hit "notification arrived (after admin's own ~2 min wait), tapped it, article not there." Root cause: `raw.githubusercontent.com` is served off Fastly's edge network, not one single origin - admin's own check succeeding only proves the content is live on whichever edge *admin's* request happened to land on, never that every edge has replicated it, so a phone on a different network landing on a different, still-stale edge moments later is a real and distinct possibility no single check from one location can rule out. Rather than keep stretching `waitForExplainerLive`'s timeout to chase a moving target, added a short bounded retry to the actual reader instead: `fetchExplainerArticleById()` (`api/client.js`) now retries up to 2 more times, 3 seconds apart, before giving up and returning null - only adds latency on the failure path (an article found on the first try, the overwhelming majority of taps, resolves exactly as fast as before). This treats the real cause - edge propagation isn't atomic across a CDN, so no single check from one location can ever fully guarantee it for another - rather than a timeout number that would eventually prove too small again regardless of how large it's made.

**Same day, immediately after a real rebuild+retest - the ~3s x 2 retry above still wasn't enough:** confirmed live end to end this time (commit timestamp, notification-posted timestamp, and a curl re-check all captured directly): one commit's actual propagation ran **4m13s**, not the "~2 minutes" figure both fixes above had been sized around - well past `waitForExplainerLive`'s ~130s ceiling (which duly timed out and notified anyway, exactly as designed) and light-years past the reader's ~9s retry window. A manual pull-to-refresh on `ExplainerListScreen` found the article instantly once it was actually live, proving the data layer was never in question - nothing was ever checking again after that one early miss. Worth noting explicitly: Flying Lap's `saveHubNews()`/`dispatchArticleNotif()` publish path has the *exact same* unprotected commit-then-notify pattern (verified directly, no `waitForExplainerLive`-equivalent at all) - it isn't proven safer, it's just never been hit this hard, since `hub_news.json` is the single highest-traffic file this app serves (kept warmer across Fastly's edges than a rarely-touched file like `explainer_articles.json`) and Flying Lap's real publish workflow has minutes of AI-draft review baked in before the button is ever clicked, unlike Academy's rapid click-then-immediately-check preview flow. Rather than chase a bigger fixed number again (a long enough tail will eventually exceed any fixed timeout), added a background self-healing mechanism instead: `notifNavigation.js`'s null-article fallback now passes `pendingArticleId` as a param on the `ExplainerList` route, and `ExplainerListScreen.js` picks it up to quietly re-check every 15s for up to 2 minutes (`PENDING_POLL_INTERVAL_MS` / `PENDING_POLL_MAX_ATTEMPTS`), auto-navigating straight into the `Article` screen the instant it appears - exactly as if the original tap had resolved immediately - and silently giving up after that window (the article still shows up normally on the next manual refresh or re-focus, same as before this existed). 4 new tests using fake timers, plus 1 covering the new `pendingArticleId` param in `notifNavigation.js`'s fallback dispatch; full suite 2204/2204.

**Same day, after the user rejected the background self-heal as the fix ("clicking the notification needs to instantly take me to the article"):** correct - the self-heal papers over a late notification, it doesn't make the tap itself instant, and a tap can only ever be instant if the notification never goes out before the content is genuinely live. That lever already existed (`waitForExplainerLive()`) but the evidence showed it had never once actually worked: every notification sent that day arrived 2m25s-2m40s after its commit, matching `130000`ms (its timeout) plus a few seconds of GitHub Actions dispatch latency almost exactly - meaning the predicate had never once matched before timing out, and every notification that day was the "gave up, sent anyway" fallback, not the intended "confirmed live" path. That fallback is exactly what was causing every "tapped immediately, article not there" report. Root cause of the root cause: `130000` was an early *guess* at "up to a couple of minutes," never actually measured - real propagation observed the same day ran to 4m13s, comfortably past it every time. Raised the timeout to `360000` (6 minutes, real margin above the observed worst case) rather than the reader-side band-aids above. `ExplainerListScreen`'s background poll and the note under the buttons both stay as defense-in-depth for whatever residual tail even 6 minutes doesn't cover, but are no longer the primary mitigation - the primary fix is simply not sending the notification until it's actually safe to be instant.

**Confirmed fixed by the user, then one more real design gap surfaced immediately after:** "even after 6 mins, i wouldnt want a notification going out for an article that doesnt esist" - correct, and `waitForExplainerLive`'s own timeout still fired the notification anyway at that point (a deliberate choice from when it first shipped, reasoned as "better than silently dropping a real publish"). That reasoning doesn't hold up: a notification pointing at content that genuinely isn't there anywhere is actively worse than none at all, not a lesser evil - it's the exact defect this whole saga has been about, just self-inflicted by admin.html's own timeout instead of GitHub's propagation delay. Removed the "notify anyway" fallback entirely: `saveExplainers()` now returns `{ok, notifSent}` and only calls `dispatchExplainerNotif()` when `waitForExplainerLive()` actually resolved true; the preview path (`saveExplainerEdit`'s direct `waitForExplainerLive`/`dispatchTestExplainerNotif` call) got the identical treatment. On a timeout, the article is still saved/published exactly as before - only the notification is withheld - and the status line says so explicitly ("Published, but NOT confirmed live after 6 min - notification not sent"), staying on screen rather than auto-dismissing, with the retry path being simply clicking Publish/Preview again once the content is confirmed live (the wait resolves almost immediately on that second attempt, since the content is by then actually there - no separate "resend" button needed). `quickPublishExplainer`'s row-level Publish Now got the same `notifSent` check plus an explicit alert on failure, since it has no persistent status line of its own. Verified in isolation (three cases: timeout→no dispatch, confirmed-live→dispatch, no-notifArticle→no dispatch) against the exact branch structure the real code uses.

**`fetchExplainerArticleById()` needed `forceRefresh: true` as its default, unlike `fetchExplainerArticles()` itself** - a fourth call site of the same on-device-cache root cause, found live the same day via a real notification tap that landed on the plain Academy list instead of the article. `notifNavigation.js` calls this to resolve a tapped notification into a full article; if the on-device cache predates whatever article the notification is actually about (exactly the case for a just-previewed article), the lookup silently returns null, and `notifNavigation.js`'s own fallback for a null article drops the user on the plain `ExplainerList` with no article and no explanation. A notification is always about content that just changed, so this one specifically defaults to bypassing the cache rather than requiring every caller to remember to ask for it.

**`fetchExplainerArticles()` needed a `forceRefresh` option, unlike every other cached fetch in this file** - found live the same day, from a second-preview-article report of "not published": with no way to bypass the function's own 5-minute on-device cache, an admin previewing a new article had no way to actually see it appear - not even `ExplainerListScreen`'s pull-to-refresh could break through it, since `load()` called the exact same un-forced fetch either way, and the screen's mount-only fetch never re-ran on its own. Fixed by adding `forceRefresh` (same pattern as `fetchArticles`/`fetchCalendar`), and wiring both `ExplainerListScreen`'s pull-to-refresh and its `navigation.addListener('focus', ...)` handler (previously only refreshing read/unread state, not the article list itself) to force one; `NewsScreen`'s own explainer fetch (feeding the teaser's count/unread badge) gained the same forced refetch in its existing `useFocusEffect`. Together these mean returning to either screen after publishing or previewing something new always shows it, without needing to wait out the cache window or force-quit the app. Tapping an article navigates straight to the existing **ArticleScreen** unmodified (passing a full article object, not a slug) - comments, like/dislike reactions, view count and analytics all come for free from that shared component, keyed by the article's `explainer-<slug>`-prefixed id (distinct namespace from real btcc.net slugs and `hub-`/`digest-` ids, since these ids double as literal Firestore document keys in `article_reactions`/`article_views`/`article_comments`). Publishing (admin-only, via the admin page's ACADEMY tab - internal id still `panel-explainers`, only the visible label was renamed) flips an article's status, commits the change to GitHub, and fires a notification on its own `explainer_alerts` FCM topic ([§11](#11-notifications-system)) - deliberately manual rather than date-automated, so a human reviews each of these AI-drafted pieces before it reaches real users, the same review gate Hub News/Digest already use for their own AI-assisted drafts. Each row's thumbnail image (`rowImage` style) has no fixed height, only a fixed `width: 96` - the row itself sets no `alignItems`, so its default (`stretch`) makes the image match `rowContent`'s natural height, which varies with how many lines the title wraps to (`numberOfLines={3}`). A fixed height here (fixed 2026-09-02) left the image only covering the top of any row taller than 96px, with a visible gap underneath on 2-3 line titles. Every article has a hero image (2026-09-02, was 18 of 48) - sourced via the same actually-download-and-view-before-use discipline as the original 18, using well-reasoned generic BTCC imagery for administrative/procedural topics (breathalyser tests, licensing paperwork, disciplinary codes) with no genuinely specific photo available, never a filename-only guess. A one-line "what is this section" intro (2026-09-03) sits above the list via `ListHeaderComponent`, matching `PartnersScreen.js`'s own identical convention - the only other screen with this pattern - deliberately placed here rather than inside whichever article currently sorts first: the list is every visitor's real entry point regardless of which headline they tap, and "first article" shifts with `order` over time, so baking an about-Academy blurb into one specific article's own content would both miss most visitors and permanently misplace section-level commentary inside an unrelated regulation topic.

**Read/unread tracking added 2026-09-02**, mirroring DigestsScreen's own behaviour exactly, at the user's request ("academy needs the same readunread logic as the flying lap... i will be pushing to it"): `explainerRead.js` (a parallel of `digestRead.js`, kept as its own module/AsyncStorage key rather than shared, so reading a Flying Lap edition doesn't also mark an Academy article read) backs a header "Mark all read/unread" toggle, mark-read-on-tap, a dimmed card + bordered "READ" pill on already-read rows, and a `navigation.addListener('focus', ...)` refresh so returning from an article picks up the new state. `userProfile.js`'s `PROFILE_ASYNC_KEYS` gained `explainerReadIds` alongside `digestReadIds` so this also survives a reinstall/new device the same way, not just live-syncs. The admin ACADEMY tab was upgraded the same day from a thin "Publish Now on pre-staged content, no editing" panel to the same edit/publish/unpublish/delete flow (with a rich-text Quill editor) DIGEST already had, plus a "+ New Article" button DIGEST doesn't need (it relies on its own AI-generate buttons for new drafts; ACADEMY deliberately has none - these are hand-curated, pushed by the maintainer). One thing intentionally *not* copied from DIGEST's own tab: its notification dispatch never sets an FCM `topic`, so it silently falls back to the always-on `broadcast` topic instead of `digest_alerts` - meaning the Settings "The Flying Lap" toggle currently does nothing (a pre-existing bug, not touched here). ACADEMY's dispatch already correctly passed its own `topic: 'explainer_alerts'` before this change and still does. The edit form's DESCRIPTION field (copied from DIGEST's) was removed the same day - confirmed neither ExplainerListScreen.js nor ArticleScreen.js ever read `article.description` for an Academy article, so it was dead weight in the form. Its one real use was as the push notification body (`dispatchExplainerNotif`'s `body: article.description`) - a newly-created article now publishes with an empty notification body instead. Existing articles' stored `description` values are untouched (editing one no longer overwrites it, just stops collecting a new one).

Three more real bugs found and fixed the same day, all in the admin editors (DIGEST/ACADEMY/HUB NEWS's shared Quill instances) rather than the app itself: (1) Quill leaves a blank line as a literal empty `<p><br></p>` (or a formatting-tag-wrapped variant), which renders as a full text line's height on top of the CSS margins already collapsing around it - `stripEmptyParagraphs()` strips it at load and save, and (added after this kept causing confusion mid-draft) on blur too, via `autoCleanEmptyLinesOnBlur()` listening for Quill's own `selection-change` firing with a null range - deliberately not continuous/per-keystroke, verified with a headless-Chrome test that a blank line survives untouched while focus stays in the editor. (2) Quill Core has no table support at all and silently **deletes** any `<table>` the instant content containing one loads into it - confirmed via the same headless-Chrome technique setting `quill.root.innerHTML` directly. Since Save reads from Quill's own post-deletion DOM, this was a real data-loss bug (opening any of the 23 Academy articles that have a table and saving anything, even a typo fix, would have permanently stripped it) - not caught in time by luck, not a fix. `extractTables()`/`restoreTables()` swap each table for a plain-text placeholder before Quill ever sees it and splice the real HTML back in only at save time (never on blur, which would just re-trigger the same deletion). (3) `.ql-editor` had no table/th/td CSS at all before this, so even a table Quill preserved would render with default (effectively black-on-black) text - copied ArticleScreen.js's own table CSS verbatim.

### Calendar Stack

**CalendarScreen** ([src/screens/CalendarScreen.js](src/screens/CalendarScreen.js))
Renders all rounds from `calendar.json`. Highlights the current/next active round. Tapping a round navigates to TrackDetail.

**TrackDetailScreen** ([src/screens/TrackDetailScreen.js](src/screens/TrackDetailScreen.js))
Hero image, Open-Meteo weather widget (gated on `track_weather` flag), track facts (length, corners, first BTCC year), About section, BTCC Fact, session schedule with day/time, lap records (qualifying + race), YouTube race replay links (gated to UK users only via locale check), and a UK map pin showing circuit location. A "Live Timing" button appears during active race weekends when `tslEventId` is set and the flag is enabled. An expandable "Show full weekend timetable" toggle inside the schedule card shows all support series (Porsche Sprint Challenge, MINI CHALLENGE, Scottish Legends etc.) alongside BTCC when `fullTimetable` is populated in `calendar.json` for that round.

The weather widget defaults to a daily summary (one card per race-weekend day) and refetches every 5 minutes plus on app foreground (`WEATHER_POLL_INTERVAL_MS`) so it stays current through a live weekend, not just on first load - `fetchWeather()`'s own cache is 30 minutes, so most polls are cheap cache hits, they just shorten how long a fresh forecast takes to reach the screen. When hourly data is available a "Daily / By session" toggle appears (same segmented-control pattern as the full-weekend-timetable toggle): "By session" cross-references `track.sessions` against the hourly forecast to show a weather chip for each BTCC session's actual start time, rather than one vague summary for the whole day - the 3 session tiles per day stretch evenly across the row (`flex: 1` each), not a scrollable row, since there are always exactly 3 BTCC sessions per day. An "unfold-more" icon next to the toggle (visible only in "By session" mode) expands every chip with extra detail - feels-like temperature, wind speed/gusts with an 8-point compass direction (`windDirectionCompass()`), humidity and cloud cover - all fetched unconditionally alongside the existing hourly fields (no separate API call) but only rendered when expanded.

Fixed 2026-08-24: tapping a circuit on the Calendar tab could load a different circuit's page. `CalendarScreen` always navigates here with a fully-parsed, season-correct round object (`route.params.track`), but this screen's initial render used to discard that and re-derive `track` by looking up the same round *number* inside the bundled `calendar.json` - which is always the current season regardless of which year pill was selected on the calendar. Round numbers are reused every season but assigned to different venues (round 7 is "Donington Park GP" in 2026 but "Croft" in 2027), so any round tapped from a non-current-season calendar view briefly rendered the wrong venue's hero image, stats, records and schedule - and logged the wrong venue to `Analytics.trackDetailViewed` on mount, before a background refetch (already year-aware) quietly corrected the screen. Fixed by trusting `route.params.track` directly when it's present; the bundled-calendar round-number lookup is now only used as a synchronous fallback for the deep-link/notification path, which only ever supplies a bare round number with no season context.

**LiveTimingScreen** ([src/screens/LiveTimingScreen.js](src/screens/LiveTimingScreen.js))
WebView embedding the TSL live timing interface. Only rendered when `live_timing_in_app` feature flag is true.

### Grid/Drivers Stack

**DriversScreen** ([src/screens/DriversScreen.js](src/screens/DriversScreen.js))
Two-tab view: Drivers (card grid with number, photo, team and car class - the driver's own car livery lived here too for a while, see below for why it moved to the profile page) and Teams (team cards showing just the sponsor logo). Drivers can be starred as favourites. Tapping navigates to DriverDetail or TeamDetail. A driver whose `currentlyRacing` field in `drivers.json` is `false` (e.g. moved out of their seat mid-season to a reserve/development role) drops out of the main "N CONFIRMED" grid into a separate "NOT CURRENTLY RACING · RACED IN 2026" section below it, and is excluded from their last team's driver roster on TeamDetailScreen - kept visible rather than deleted, since they did race that season.

A driver card's `carImageUrl` (added 2026-08-21) was originally shown on the tile too - the driver's own resolved car, not a shared team image, since a team can field more than one livery (Steel Seal with Power Maxed Racing's Dexter Patterson and Nick Halstead each have their own separately-branded car, Halstead's mid-season "Ask GVT" livery confirmed by an official photo). Removed from the tile entirely later the same day, by request, in favour of giving the driver photo the tile's full height instead - `driverPhoto`'s `height` 85% -> 100%, width initially staying at 60% and left-aligned (`driverImageArea`'s `alignItems: 'flex-start'`) so it didn't compete with the top-right number - later widened to `100%` and re-centered (`alignItems: 'center'`) once that left-alignment had no remaining reason to exist, matching `DriverDetailScreen`'s header being reverted to centered the same way. The car itself now only shows on the driver's own profile page (`DriverDetailScreen`, see below) - with 23+ drivers on one grid there's no good way to show a car properly at tile size anyway, and the profile page is where a bigger, dedicated showcase actually fits. Worth keeping as history for how the tile got here: it went through four layout passes before removal - an absolutely-positioned bottom-left badge overlapping the photo (fine small, but a visible collision with the driver's own legs/feet once sized up), a dedicated full-width strip below the photo (avoided the collision, but made every tile noticeably taller), an upright bottom-right corner badge (`driverCarImg`, 50%/33%) that avoided both but capped how large the car could get, and finally a -90 degree rotated vertical strip (`driverCarSide`/`driverCarSideImg`) that let it grow bigger within the same footprint - superseded by removing it outright once it became clear the tile just isn't the right place to showcase 23 different cars at once. Team cards dropped the car cutout entirely for the same underlying reason - a single "representative" car on a team tile would just be misleading once more than one livery exists under that team - and instead show the sponsor logo (`logoUrl`) large and centered, filling most of the tile rather than a small top-right badge. Teams with no logo file yet (e.g. CPRL as of 2026-08-20) simply render without one - no placeholder. `MerchScreen.js`'s tiles use the identical large/centered `teamLogoImgLarge` treatment for parity (see below).

The tile's top-right number went through its own separate fix (2026-08-22): the branded number-graphic replacement (`driverNumberImg`, used for 22 of 23 drivers) originally sized itself with a fixed `width`/`height` box (`45%`/`36%`), letting `resizeMode="contain"` decide per-file which axis to letterbox depending on how each number's own real aspect ratio compared to that box's - single/double-digit numbers (aspect ratio close to or narrower than the box's) filled the box's full height and touched the tile's top edge, while most 2-3 digit numbers (noticeably wider files) got letterboxed vertically instead, leaving a gap above - "some numbers touching top, some not," confirmed by checking every file in `data/numberImages/`'s actual aspect ratio rather than guessing. Replaced with `NumberBadge`, a small component that measures the image's own aspect ratio via its `onLoad` event (`nativeEvent.source.width`/`height`) and sizes itself off that instead - fixed height, width computed via `aspectRatio` to match - so every number fills the same height and sits flush at the same top-right corner regardless of how wide or narrow its own graphic happens to be. `driverNumberImg`'s style lost its `width` entirely as a result; only `height: '36%'` remains, with `aspectRatio` applied per-instance.

Tile/card press feedback (both `DriversScreen`'s `DriverCardInner` and `TeamDetailScreen`'s `TeamDriverCard`) is a dark scrim overlay, not `TouchableOpacity`'s own built-in opacity fade (fixed 2026-08-24, reported live: "the number can quickly be seen through his face"). Root cause: `TouchableOpacity` animates its opacity by wrapping its whole child subtree in one `Animated.View` and dropping *that view's* opacity, but on Android, reducing a View's opacity without offscreen-buffer compositing (`needsOffscreenAlphaCompositing`, which `TouchableOpacity` in this RN version doesn't forward to consumers at all - checked the installed `node_modules/react-native` source directly rather than assuming) applies the reduced alpha to each overlapping child's own paint call individually, rather than flattening the subtree to one opaque bitmap first. `driverImageArea`'s number graphic and driver photo are two such overlapping opaque siblings (the photo's `90%×90%`/`100%×85%` box fully covers the number's top-right `~60%×48%` box at rest) - at `opacity===1` the photo simply occludes the number as normal paint order, but mid-fade both layers are independently translucent and blend, letting the still-opaque number bleed through the now-see-through photo, specifically around the driver's head where the boxes overlap. Fixed by setting `activeOpacity={1}` (disables `TouchableOpacity`'s fade entirely, keeping it purely for tap/accessibility handling) and adding a separate `Animated.View` scrim (`pressScrim`, `rgba(0,0,0,0.25)`) as the card's last child, driven by its own `useRef(Animated.Value)` via `onPressIn`/`onPressOut` - since nothing underneath a scrim that only ever gets *more opaque on top* of an unchanged stack ever has its own alpha touched, the bleed-through can't happen by construction.

Every car image still rendered anywhere in the app - `DriverDetailScreen`'s profile header and `TeamDetailScreen`'s per-driver cards, now that the tile no longer shows one at all - has its URL rewritten to a small pre-generated thumbnail (`carThumbUrl()`, `<name>-thumb.webp` alongside every full-size file in `data/carImages/` - see `scripts/generate_car_thumb.py`), not the full-size original. This was originally added for the driver tile specifically, back when it still rendered a car per driver: Android's image pipeline decodes to an uncompressed bitmap sized off pixel dimensions, not file size, so every car image - already WebP-compressed to ~90KB on disk - still cost 1536x1024x4 bytes = 6MB of *decoded* memory each, and unlike `cardBgUrl` (shared across a team's drivers, so Android decodes and caches it once), every car image was unique per driver with no reuse to fall back on - 23 of them on one non-virtualized grid blew straight through Android's ~192MB decode pool, confirmed live via a device log capture (`onError`'s actual native reason: `Pool hard cap violation`) rather than guessed. Two earlier attempts (staggering the badge's mount, widening `CachedImage`'s retry budget) didn't fix it and were reverted - both were trying to fix a request that hadn't gotten a turn yet, when the real failure was a *decode* that couldn't fit in memory no matter how long it waited or how many times it retried. Now that the driver tile no longer renders a car at all (see above), that specific 23-at-once crowding scenario doesn't exist on this screen any more - but the thumbnail is still exactly the right call on `DriverDetailScreen` and `TeamDetailScreen`, since neither needs 15x more bitmap than a corner strip or card actually displays, regardless of how many are ever on screen at once.

`teams.map()` here renders every entry in `drivers.json`'s `teams` array with no drivers filter, so a team object with zero matching drivers still gets a tile - found and fixed 2026-08-20: a standalone `"Power Maxed Racing"` team entry (leftover from before Nick Halstead's mid-season car was assigned a livery) had no driver pointing to it at all, since both Dexter Patterson and Halstead race as `"Steel Seal with Power Maxed Racing"` - a phantom, driver-less 10th tile on the Grid -> Teams tab. Removed the orphaned entry and corrected Steel Seal's stale `entries` count (1 -> 2) to match its actual two current drivers.

**DriverDetailScreen** ([src/screens/DriverDetailScreen.js](src/screens/DriverDetailScreen.js))
Full driver profile: photo, number, DOB (with live age calculation), birthplace, current residence (`livesIn` field - only shown when set, since btcc.net leaves it blank for some drivers), bio text, career statistics (wins/podiums/poles/fastest laps per year), and computed live 2026 championship standings from results data. Nationality/team/car/class render as labelled `StatBox` tiles (bordered card, bold yellow value, grey label) in two rows - same visual pattern as TeamDetailScreen's stat tiles, replacing the previous unlabelled pill chips. Favourite toggle. History rendered as a scrollable year table.

This screen also shows the driver's own car - same underlying reason as DriversScreen's tile used to have - a team can field more than one livery, so it has to be the driver's own `carImageUrl`, not a shared team image. Now that the tile has dropped its car entirely (see above), this is the *only* place it appears. It went through four header-based arrangements first - a bottom-left overlay, an upright bottom-right corner badge, a `-90deg` rotated strip on the right under the number, then a `90deg` rotated column running the full height on the left with the photo re-centered around it - each abandoned in favour of the next once it stopped looking right at the size the car needed to be. All four were trying to fit three competing subjects (photo, number, car) into one square (`aspectRatio: 1`) header, which turned out to be the actual constraint rather than any one arrangement's specific numbers.

Landed instead (2026-08-21) on taking the car out of the header entirely: `headerBg` reverted to its original pre-car-feature layout (`headerPhoto` full width and centered, `headerNumberImg`/`headerNumber` top-right, nothing else in it), and the car gets its own full-bleed `carStrip` banner between the name row (`headerFooter`) and the stat boxes - shown at its natural, unrotated landscape orientation, `Colors.surface` tint background, so there's no rotation math and nothing to compete with for space. Uses the same pre-generated `-thumb` URL (`carThumbUrl()`) as `TeamDetailScreen`'s per-driver cards - this screen never actually hit the decode-memory cap that originally motivated the thumbnail (only one driver's car is ever on screen here), but there's no reason to decode 15x more bitmap than a banner this size needs just because the count happens to be small in this context.

`carStrip`'s `aspectRatio` went through two more values after that before landing on `3.1`. First, `2.6` (an arbitrary banner shape, wider than any car actually was) capped `resizeMode="contain"` at roughly half the strip's width no matter how large `carStripImg`'s own percentages were set, since `contain` stays bound by whichever of the box's width/height it hits first. Matching the box to the *full* `1536x1024` canvas (`aspectRatio: 1536/1024`) fixed that specific bug, but surfaced the next one, reported the same day: "a lot of padding above and below the car." Checked rather than assumed - `PIL`'s `getbbox()` on every one of the 23 files confirmed the visible car only occupies the canvas's middle ~40-50% of height, with ~40% blank space above it and ~16% below baked into every single file (not just one driver's). That padding was never a layout bug; it was the source images themselves.

Fixed at the source in `scripts/generate_car_thumb.py`: added a `crop_to_content()` step (PIL, cropped to each file's own `getbbox()` plus a small margin) that now generates a **second** thumbnail variant alongside the existing one - `<name>-thumb-crop.webp` - rather than cropping the existing `-thumb.webp` in place. That distinction mattered: `TeamDetailScreen`'s `carImage` style has its own comment explaining that its cars' padding is load-bearing - the team hero's sponsor logo sits absolutely-positioned over the top of the car cards and relies on that blank space to avoid visually clashing with the car artwork underneath it. Cropping the shared file would have fixed this banner while quietly breaking that screen's logo clearance. So `DriverDetailScreen.js` now has its own local `carThumbUrl()` pointing at `-thumb-crop` (a new `carThumbCropUrl()` export in `api/parsers.js` covers the same rewrite for `backgroundPrefetch.js`, which now warms both variants), while `TeamDetailScreen.js` keeps requesting the original, still-padded `-thumb` completely unchanged. `carStrip`'s `aspectRatio: 3.1` matches the *cropped* thumbnails' own aspect ratio (median 3.08, mean 3.09 across all 23, computed directly rather than guessed), and `carStripImg`'s `94%/94%` (widened from `85%/85%`, by request - "almost full width") now actually reaches that size instead of being capped well below it.

One more round the same day: the crop shipped at `THUMB_WIDTH` (400px, the same target `-thumb` uses for a small corner badge/card) and immediately looked "blurry." Checked the actual numbers rather than guessed: a typical phone is ~1240 physical px wide at 3x density, so `carStrip`'s ~94%-width banner displays at ~1166px - a 400px source was being upscaled ~2.9x to fill it. `-thumb-crop` got its own `CROP_THUMB_WIDTH` (1200px) as a result, separate from `THUMB_WIDTH` - this screen only ever decodes one car at a time (unlike `-thumb`'s original ~23-at-once decode-pool problem that motivated shrinking these in the first place), so there's plenty of headroom to go bigger without approaching that cap again. Landed at ~50-65KB per file (up from ~10-14KB at 400px) - still trivial for a one-at-a-time banner.

Once the car badge grew into that real showcase size, the top-right number (`headerNumber`/`headerNumberImg`) read as too dominant by comparison and was shrunk to match - `headerNumber`'s plain-text fallback from `fontSize: 160` to `110`, `headerNumberImg`'s branded-graphic box from `60%/48%` of the header down to `45%/36%`. Both also nudged down (`top: 0`/`-4` -> `60`/`56`) later the same day - once the car left the header entirely and the header reverted to its simple layout, the number sat flush against the header's very top edge, crowding the back/share buttons and status bar above it.

**TeamDetailScreen** ([src/screens/TeamDetailScreen.js](src/screens/TeamDetailScreen.js))
Team profile: hero banner, bio, current drivers, championships won, historical standings. Founded/base render in one stat-tile row, Cars/Races/Wins in a second (Cars always shows even before a team's first race of the season; Races/Wins only appear together once the team has actually raced). The Base tile carries `flexGrow={2}` so a long "Town, County" value (e.g. "Wellingborough, Northamptonshire") gets enough width to wrap at a word boundary instead of breaking mid-word - the two short tiles it shares a row with don't need the extra space.

The hero (added 2026-08-21, replacing a single `team.carImageUrl`) shows one car card per current driver - `team.drivers` (already the active, non-reserve roster `parseGrid()` filters to) mapped to each driver's own resolved `carImageUrl` - rather than one image standing in for the whole team, since a team can field more than one livery (a 2-driver team like Steel Seal with Power Maxed Racing shows 2 distinct cars; a 4-driver team like Team VERTU or NAPA Racing UK wraps into a 2x2 grid). A driver with no `carImageUrl` of their own (e.g. a reserve with no car cutout yet) simply contributes no card - the hero still renders for its logo/other cars, or collapses to a plain spacer if there's genuinely nothing to show.

Two follow-up fixes the same day (2026-08-22, "remove the name of the driver from under the car images" and "neaten up the layout of cars vs logo"): the per-car driver-name caption (`carCaption`) was removed outright - it read poorly against some teams' hero backgrounds (NAPA Racing UK's gold in particular) and the name is already shown once in the DRIVERS grid further down the same screen. The sponsor logo (`logoUrl`) moved out of `position: 'absolute'` entirely - it used to sit top-right, overlapping the same vertical band as the top row of cars (both competing for space rather than reading as two deliberate sections, even though they rarely visually collided in practice) - now it's a normal-flow, centered element with its own `marginBottom`, so the car grid always starts in clear space below it regardless of team/logo size. This also dropped the aspectRatio-vs-height-% workaround `teamLogoImg`/`teamLogoImgSmall` needed while sharing space with `carsRow` - now that nothing overlaps, both are just a plain width + `aspectRatio`.

A SPONSORS section (added 2026-08-20) lists each team's real-world sponsors/partners from `team.sponsors` (`{name, tier}[]` in `drivers.json`, passed through untouched by `parseGrid()`), grouped into four tiers - Principal, Associate, Technical, and "Also on the car" (small decal-only placements, e.g. wheel arches) - rendered as wrapped chip rows under a heading per tier; a tier with no sponsors that team just doesn't render. An optional `sponsorsNote` renders above the chips as an italic caveat line, used for things a flat list can't express: a team running multiple liveries under one entry (Team VERTU, WSR, Laser Tools Racing with MB Motorsport all field 2-4 cars with per-car sponsor variation) or a livery genuinely in flux (CPRL's car is unbranded as of 2026-08-20, following Plato Racing Ltd's administration on 11 August and its rebrand under new principal Dave Kelly - see `data/drivers.json`'s CPRL entry). The championship-wide series partners already covered by `partners.json`/`PartnersScreen` (Kwik Fit, Goodyear, Autocar) are deliberately excluded from every team's list even though they physically appear on every car, to avoid listing the same three names on all nine team pages. Sourced via parallel web research plus visual inspection of current car photos (to catch small decals no press release mentions) - some listed sponsors are visually confirmed only (legible on a current photo, not independently named in any team/press text source); anything too small/blurry to read confidently was left out rather than guessed.

### Results Stack

**ResultsScreen** ([src/screens/ResultsScreen.js](src/screens/ResultsScreen.js))
Year selector (2004 - 2026) via `YearWheelPicker` modal. Tabs include:
- Drivers Standings - position, points, wins, 2nds, 3rds
- Teams Standings - points by team
- Season Table (`SeasonTable` component) - race-by-race result grid with DSQ/Ret/DNS/FL/PP badges
- Progression Chart (`ProgressionChart` component) - SVG line chart of points accumulation per round
- Gallery (`GalleryTab` component, added 2026-08-28) - btcc.net's photo gallery (`btcc.net/gallery/<year>/`, goes back to 2010), reusing this screen's own year picker rather than a separate top-level tab. Albums are grouped into "Race Weekends" (resolved to a round via `match_round()` in `scrape_gallery.py`, ordered by round) and "Other" (a season-launch shoot, TOCA Awards, a test day - anything `match_round()` couldn't resolve, since forcing every album into a track slot would misrepresent non-race-weekend content). Photos are hotlinked directly from btcc.net's own public Supabase Storage URLs, not mirrored (see [§20](#20-python-scrapers)) - confirmed live that gallery images, unlike article/driver images, sit on a different host entirely from btcc.net's own Vercel deployment and its bot-challenge, so there's nothing to work around. `scrape_gallery.py` still paginates through each album incrementally/resumably (by page, not by photo) so a single scheduled run's cost stays bounded regardless of how deep an album or the historical backlog goes. Tapping an album pushes `GalleryAlbumScreen`; tapping a photo opens `PhotoLightbox` (a full-screen swipe-between-photos viewer, no pinch-zoom, see [§18](#18-shared-components)).

**GalleryAlbumScreen** ([src/screens/GalleryAlbumScreen.js](src/screens/GalleryAlbumScreen.js))
Virtualized 3-column photo grid for one gallery album (`route.params: {season, albumSlug}`, mirroring `RoundResultsScreen`'s `{round, year}` pattern). Fetches `data/gallery/{year}/{slug}.json` on demand (never bundled with the season index, which carries only album metadata + cover thumbnails). Photo count copy (`formatPhotoCount()`, `src/utils/galleryPhotoCount.js`, shared with `GalleryTab`'s own tiles) reads "24 of ~120 photos · more being added" while an album is still mid-capture, or the plain "120 photos" once `complete`. Fixed live 2026-08-28: an earlier version showed only the estimated eventual total (`totalCount`, extrapolated from the first scraped page) with no indication a much smaller subset (`capturedCount`) was actually captured yet - a user correctly counted the real, smaller number on screen and reasonably read the mismatch as a bug. A "Photos: btcc.net" credit line reflects the source, even though the photos themselves are hotlinked rather than redistributed. Added 2026-08-29: tapping `PhotoLightbox`'s share button calls `handleSharePhoto(index)` here, which builds the message/URL (`shareContent('gallery_photo', ...)`, same `src/utils/appShare.js` helper every other share button in the app already uses - see [§24](#24-deep-linking)) since `PhotoLightbox` itself stays generic and builds no URLs. An optional `route.params.photoIndex` (from a shared link) auto-opens the lightbox at that exact photo once the album has loaded, guarded to fire only once so a later pull-to-refresh can't re-open it over whatever the user has since navigated to.

**RoundResultsScreen** ([src/screens/RoundResultsScreen.js](src/screens/RoundResultsScreen.js))
Per-round detail. `SwipeableTabs` with lazy loading across all sessions: Free Practice, Qualifying, Qualifying Race, Race 1, Race 2, Race 3. Each tab shows: position badges (P1=gold, P2=silver, P3=bronze), grid position delta arrows (↑/↓), points awarded, fastest lap / lead lap / pole bonuses. Non-finisher labels: `DQ` (disqualified, `status: "DQ"`), `DNS` (did not start/not classified - `status: "DNS"` or `status: "NC"`, the latter being the actual token `scrape_tsl.py` produces from TSL's PDFs) or `DNF` (a bare `pos: 0` with no such status). Before results land, if a TSL grid PDF has been scraped, shows a `StartingGridTab` with a two-column staggered layout mirroring the physical grid. R3 shows a `ReverseGridTab` prediction stepper as fallback when no actual grid data exists yet. R1 and R2 show a "Predicted Starting Grid" (also `StartingGridTab`, just fed a synthesised grid) derived straight from the previous session's finishing order per reg 3.4.1.b, as fallback when TSL hasn't published the official grid PDF yet. For UK users, race tabs show a "Watch Full Race" YouTube button when a URL is available - for 2026 this falls back to bundled URLs from `results2026.json`; for past years the button only appears if the round's own `youtubeUrls` field is populated.

### More Stack

**MoreScreen** ([src/screens/MoreScreen.js](src/screens/MoreScreen.js))
Menu screen. A "Buy me a coffee" card renders first, above every section (Android only - excluded on iOS, likely to avoid App Store scrutiny of external donation links, though that hasn't been re-verified against current guidelines) - styled as an in-app CTA card (icon + title + subtitle) rather than the raw buymeacoffee.com badge image it used to be. Static rows below it: Records, Settings, About BTCC (InfoPage), Roadmap, Partners, Feedback (BugReport). Flag-gated rows: Radio and Podcasts (both require `podcasts_enabled` or `radio_tab` flags). A "Share BTCC Hub" row (COMMUNITY section, added 2026-08-25) shares the app's own web link via `src/utils/appShare.js`.

**Donor name gate (added 2026-08-25):** tapping "Buy me a coffee" first checks `hasChatDisplayName()` (`src/utils/chatIdentity.js`) - if the user already has a chat display name, the link opens immediately with no interruption. If not, a small modal asks them to set one first ("use this same name when you donate"), since that name is the only thing an admin can see in the Buy Me a Coffee notification to match a donation to a chat identity for the supporter badge below. Skip still opens the link, just without a name set yet. Anonymous users additionally see a "Sign in to make this permanent" link to Settings - the actual fix for the badge being lost on reinstall (see Supporter badge below), not a data-model workaround. **Bug fixed 2026-08-26:** the modal's own Save button accepted an empty/whitespace-only name - `saveChatDisplayName()` silently falls back to a generated `Fan #1234` placeholder for an empty input, which is correct behavior for ChatScreen's own casual name flow but wrong here, since it satisfied `hasChatDisplayName()` permanently while giving the admin nothing real to match against a donation. `MoreScreen.js` now rejects a blank/whitespace name before ever calling the shared function, showing "Enter a display name, or tap Skip" instead.

**SettingsScreen** ([src/screens/SettingsScreen.js](src/screens/SettingsScreen.js))
All notification toggles with parent/child hierarchy (toggling a parent enables/disables all children). Spoiler-free mode toggle. Display settings (km/miles distance unit; 12hr/24hr time format). Device ID and FCM token display for admin/debugging.

**RadioScreen** ([src/screens/RadioScreen.js](src/screens/RadioScreen.js))
List of live radio streams from `radio.json`. Platform-specific playback: iOS uses `react-native-track-player`, Android uses a native `RadioService`. A Stop button appears in the header when a station is playing. Shows a "No stations available" empty state when the list is empty - true as of 2026-08-20, when talkSPORT/talkSPORT 2 (the only two stations that existed) were retired and `radio_tab` set to `false`, hiding "Online Radio" from the Listen menu entirely. TOCA Live Radio ([TocaRadioScreen](src/screens/TocaRadioScreen.js) below) is a separate, always-on feature and unaffected.

**TocaRadioScreen** ([src/screens/TocaRadioScreen.js](src/screens/TocaRadioScreen.js))
WebView embedding the Cre8Media TOCA Radio player. JavaScript injection intercepts audio stream URLs. Shows a connecting spinner for 15 seconds on load.

**PodcastsScreen** ([src/screens/PodcastsScreen.js](src/screens/PodcastsScreen.js))
Buzzsprout RSS feed with filter chips (All/Race/Qualifying/Podcast). Pagination. AsyncStorage caching. Playback via RadioProvider.

**Cache-hit re-fetch race fixed (2026-09-06):** the data-loading effect keyed its own re-run on `[loading, refreshing]`, but called `setLoading(false)` on a cache hit before awaiting `InteractionManager`. React could commit that state update, and run the effect's cleanup, well before `InteractionManager`'s callback fired - the new effect instance's `!loading && !refreshing` guard then exited immediately and the in-flight run had already been cancelled, so the real network re-fetch never ran and stale cached episodes stayed on screen indefinitely. Replaced the `loading`/`refreshing` dependency with a `hasFetchedRef` ref the effect only ever sets, never depends on, so the state update it triggers can't retrigger the same effect.

**RecordsScreen** ([src/screens/RecordsScreen.js](src/screens/RecordsScreen.js))
All-time driver statistics. Two tab groups:
- Rates: Win%, Podium%, Pts/Start, DNF% (min. 30 starts · 2004 onwards)
- Totals: Championships, Wins (source: btcc.net - 228 drivers including 51 historical pre-2004 era drivers)

Sortable columns. Medal emojis for top 3. Historical (pre-2004) drivers appear in both Totals tabs; they are excluded from Rates because those only use 2004+ computed data.

**RoadmapScreen** ([src/screens/RoadmapScreen.js](src/screens/RoadmapScreen.js))
Feature roadmap from `roadmap.json`. Firestore voting per device (one vote per item). Status filter (Planned/In Progress/Done). Idea submission form.

**BugReportScreen** ([src/screens/BugReportScreen.js](src/screens/BugReportScreen.js))
Feedback form. Category chips: Bug, Crash, UI Issue, Feature Request. Title, description and steps fields. Firestore submission. Submissions include the signed-in user's UID (or `'anonymous'` for unauthenticated users) for triage traceability.

**InfoPageScreen** ([src/screens/InfoPageScreen.js](src/screens/InfoPageScreen.js))
Generic page renderer for `pages.json` content. Sections support `text` (body), `heading`, `callout` and `link` types. Used for About BTCC, History, Rules and Academy pages. The Race Weekend rules page's Race Start / Start Delayed section (added 2026-08-24) documents BTCC's actual 5 second board procedure (regs 3.5.2.b/3.5.3) - not the lights-out sequence some UK club events use, which is a different procedure under a different organising body.

**ChatScreen** ([src/screens/ChatScreen.js](src/screens/ChatScreen.js))
Firebase Realtime Database community chat. Retention enforced by `trimChat` Cloud Function (`functions/chatTrim.js`, unit tested): keeps only the newest 200 messages, and separately drops anything older than 14 days regardless of count - the two caps apply independently, so a message needs to satisfy both to survive. Event-driven off new messages (was silently non-functional 2026-08-20 due to a `getDatabase(url)`/`getDatabaseWithUrl(url)` mixup, see the Mention notifications entry below; fixed and redeployed same day) - during a quiet stretch with no new posts, an aged-out message waits for the next post to trigger cleanup rather than being removed on its own schedule. Profanity filter via `blacklist.json`. 3-flag auto-hide via atomic RTDB transaction (prevents race conditions from concurrent flags). Name prompt on first post (stored as `commenter_name` in AsyncStorage, plus uniqueness-claimed in Firestore for signed-in users via `claimUsername()`). 24 character display name limit, 500 character message limit. Security rules in `database.rules.json` enforce field types, length limits, immutability of text/author/timestamp after creation, and that flagCount can only increase and hidden can only go true - never back to false. Opened via `ChatFab` floating button (not a tab). Accepts an `onClose` prop that shows a back arrow in the header when provided.

**Retroactive rename:** each message's own `authorName` field is an immutable snapshot (the rules reject any attempt to edit it after creation), so renaming only ever changed future messages - past ones kept showing whatever name you had when you sent them. Fixed 2026-08-10 by adding a live `/chat/authorNames/{authorId} -> name` map, written whenever a user (re)names themselves and read once on mount alongside the message listener; `resolveAuthorName()` looks up the message's `authorId` in that map and falls back to the message's own stored `authorName` only for authors who've never (re)named themselves since the map existed. Reply mentions (`@Name`) also resolve through this so they tag someone's current name, not a stale one.

**Username release-on-rename ordering:** `claimUsername()` frees a user's old Firestore `usernames/{name}` doc when they rename, so abandoned names become available again rather than being squatted on forever. Until 2026-08-10 it released the old name *before* confirming the new claim succeeded - a failed/contested claim (someone else grabs the new name a moment earlier, a network blip) left the caller holding neither name, silently freeing the old one for anyone else to grab while the caller's own local state still believed they owned it, undermining the uniqueness guarantee the whole system exists for. Fixed by claiming the new name first (the existing server-enforced precondition already makes that safe) and only releasing the old one once that succeeds.

**Ban system:** Admins can ban users via the Chat tab in the admin panel. Bans are stored at `/chat/bans/{authorId}` (authorId = the sender's Firebase Auth uid - anonymous sign-in gives every install one on first launch, see `store/auth.js`; this stays stable across a rename and even across later linking a Google/Apple account, since linking keeps the same uid). The `onChatBan` Cloud Function triggers on creation, hides all existing messages from the banned user, and writes a `ban_notice` system message. The banned user sees a locked input row instead of the text field. Temporary bans (1h / 24h / 7d) expire automatically via `expiresAt` timestamp checked client-side; permanent bans have `expiresAt: null`. Unbanning deletes the `/chat/bans/{authorId}` node.

**Mention notifications (added 2026-08-20):** typing `@Name` in a message (pre-filled by the Reply button, or typed manually) pushes a notification to that person even if the app is closed - previously this text was cosmetic only, with nothing reading it back out. The `onChatMention` Cloud Function triggers on every new message, resolves `@mentions` against the live `/chat/authorNames` map via `resolveMentionedAuthorIds()` (`functions/chatMentions.js`, unit tested), then sends a single targeted FCM message to whatever token that authorId last registered at `/chat/deviceTokens/{authorId}`. This is the one exception to every other notification in the app being a topic broadcast (see [§11](#11-notifications-system)) - a mention is inherently to one specific person, not a subscribable feed. The device token is written by `syncChatMentionToken()` (`src/utils/notifications.js`), called whenever chat identity resolves or the new "Mention notifications" setting (Settings > LIVE CHAT, default on) is toggled; turning it off removes the token rather than just suppressing display client-side, so a disabled device never receives the push at all. Server-side matching is still plain-text against display names rather than a structured mention field - the longest registered name that fits at each `@` wins, so `@Jo Smith` doesn't also separately match a shorter `@Jo` registered by someone else, and a match only counts when followed by a non-name character (`@Steven` never matches a registered `Steve`). Anonymous users' names aren't guaranteed unique, so a genuine duplicate display name notifies every authorId holding it rather than none - a missed mention was judged worse than an occasional extra ping to a namesake. Tapping the notification opens the chat sheet via a small `requestOpenChat()`/`onOpenChatRequest()` pub/sub in `src/utils/chatBridge.js`, since live chat is a `Modal` owned by `ChatFab`'s own local state rather than a react-navigation route - `notifNavigation.js`'s `type: 'chat'` deep link previously called `navigationRef.navigate('Chat')`, which was always a no-op since no `'Chat'` route exists in `AppNavigator`.

**@mention autocomplete (added 2026-08-20):** typing `@` in the compose box now opens a suggestion dropdown, closing the gap between free-text matching and a guaranteed-correct mention - listing everyone with a visible message in the currently loaded chat history alphabetically (deduped by current live name via `resolveAuthorName()`, excluding yourself and the `ban_notice` system author), narrowing as more characters are typed (`@a` → names starting with "a", case-insensitive). Tapping a suggestion splices in the exact `@FullName ` text at the cursor - not just appended to the end - so mentioning someone mid-sentence ("hey @Jo can you check this") works, and the inserted name is guaranteed to match server-side since it's copied verbatim from the same `authorNames` map `onChatMention` resolves against. The dropdown closes itself once the typed query no longer prefixes any candidate (typing past a complete name, or a query nobody matches) rather than needing a special "mention finished" trigger - the same logic that lets multi-word names like "Jo Smith" keep matching across the space in the middle. Implementation: `mentionQuery`/`mentionStart` in `ChatScreen.js` are plain values derived with `useMemo` from the input text and cursor position (`onSelectionChange`), computed in the same render pass as the text change - an earlier version derived them via a `useEffect`+`setState` pair instead, which forced a second render before the dropdown could appear and was the real cause of a reported on-device delay (see [project memory] for the full diagnosis); cursor is repositioned after insertion via `setNativeProps` rather than a controlled `selection` prop, since a controlled selection fights normal typing. A dedicated `@` button sits to the left of the text field (`insertMentionTrigger()`) for discoverability - it inserts "@" at the last known cursor position, and since `mentionQuery`/`mentionStart` are derived from `input`/`cursorPos` on every render regardless of what changed them, the dropdown opens the same way whether "@" arrived by typing or by this button.

**Production bug found on first live test:** the first real cross-device test sent no notification. `onChatMention` was crashing on every invocation with `firebaseApp.getOrInitService is not a function` - `getDatabase(app?: App)` in this `firebase-admin` version only accepts an App instance, not a URL string; the function that takes a database URL is the separate `getDatabaseWithUrl(url, app?)`. This wasn't a new mistake - `onChatBan` and `trimChat` had called `getDatabase(url)` the same wrong way all along, silently swallowed by their own `catch { console.error(...) }` with no wrapper-level test to catch it (only their pure-logic siblings are unit tested). Fixed by switching all three call sites to `getDatabaseWithUrl()` and redeploying together.

**Supporter badge (added 2026-08-25):** a small ☕ badge next to a donor's name in chat, recognising Buy Me a Coffee supporters (see the donor name gate under MoreScreen above). Donor flags live at `/chat/donors/{authorId}` - `.write: false` in `database.rules.json`, so only the Admin SDK can set them, not a raw client write. The `setChatDonor` Cloud Function (`functions/chat.js`, admin-secret gated like `dismissError`) is triggered from a new SUPPORTERS section in the admin panel: an admin types the chat display name they saw in a BMC donation notice, the panel looks up which `authorId` currently holds that name via `/chat/authorNames`, then calls the function. Matching is manual, not webhook-automated - donation volume doesn't currently justify building and de-risking that. Deliberately keyed by `authorId`, not display name: names aren't unique for anonymous users and can be released and reused after a signed-in user's rename, so name-keying would let a badge transfer to the wrong person. The one accepted limitation: an anonymous donor's badge is lost on reinstall (a fresh anonymous uid), which the MoreScreen sign-in nudge exists to let people opt out of.

**Find user by email (added 2026-08-26):** a FIND USER BY EMAIL search at the top of the admin Chat tab, for when an admin only has an email (a support message, a BMC receipt) rather than a known chat display name - the gap the SUPPORTERS flow above can't cover, since it only searches by name. Resolves the email to a Firebase Auth account via `getAuth().getUserByEmail()` in a new `lookupUserByEmail` Cloud Function (`functions/chat.js`, same admin-secret gating as `setChatDonor`), then folds in that `uid`'s chat display name, donor status and active ban in one response, with MARK AS SUPPORTER / REMOVE SUPPORTER BADGE / UNBAN actions directly on the result card.

**ListenScreen** ([src/screens/ListenScreen.js](src/screens/ListenScreen.js))
Entry point routing to Radio and Podcasts sections.

**MerchScreen** ([src/screens/MerchScreen.js](src/screens/MerchScreen.js))
Reached via MoreScreen's "Team Merch" row. Reuses `parseGrid()`'s teams list - the same `cardBgUrl`/`logoUrl` fields DriversScreen's Grid -> Teams tab renders - filtered down to teams with at least one store in `fetchMerchStores()`'s `merch.json` map. A single-store team opens that store's URL directly via `Linking.openURL` (wrapped by `withTracking()`, which appends `utm_source=btcchub&utm_medium=app&utm_campaign=merch`); a multi-store team opens a `StorePickerModal` bottom sheet instead, listing every store by name.

Tile background image must use `resizeMode="stretch"` (not `"cover"`) and `collapsable={false}`, matching DriversScreen's team tile exactly - `cardBgUrl` is a pre-rendered graphic with diagonal stripes and corner decorations baked in near its edges, not something drawn in CSS/JS, so `"cover"` crops most of that away and leaves what looks like a flat colour swatch. Fixed 2026-08-20: this screen was added in a separate commit after the Teams-tab redesign that introduced the `"stretch"` requirement, so it never picked the fix up and had visibly plainer tiles than the Grid tab's teams.

Tiles also show each team's sponsor logo (`team.logoUrl`) - added 2026-08-20 as a top-right badge over the car cutout, changed 2026-08-21 to large and centered with the car cutout removed entirely (`teamLogoImgLarge`), matching DriversScreen's Grid -> Teams tab tile exactly so the two screens stay in visual sync - see that entry above for why the car went away (a team can field more than one livery, so no single cutout can represent it on a shared tile).

---

## 7. State Management - Context Stores

All stores live in [src/store/](src/store/). They use React Context with `useState`/`useEffect` for persistence.

### FeatureFlagsContext ([src/store/featureFlags.js](src/store/featureFlags.js))

Fetches `flags.json` from GitHub on every app start. Two-phase loading:
1. Applies last-known cached flags from AsyncStorage instantly (no network block)
2. Fetches fresh flags with an 8-second timeout, then applies global flags + per-device overrides

Per-device overrides are keyed by FCM token inside the `overrides` object in `flags.json` and are never cached.

| Flag | Default | Purpose |
|---|---|---|
| `radio_tab` | false | Show Radio in More menu |
| `podcasts_enabled` | false | Show Podcasts in More menu |
| `debug_mode` | false | Enable debug logging |
| `hub_news_enabled` | true | Show hub posts in News feed |
| `live_timing_in_app` | false | Enable LiveTimingScreen |
| `live_chat` | false | Show Chat tab |
| `update_available` | true | Enable update prompt |
| `update_min_version_ios` | 0 | iOS minimum build number |
| `update_min_version_android` | 66 | Android minimum build number |
| `track_weather` | - | Enable Open-Meteo weather widget |
| `live_updates` | - | Enable live scoring updates |

### SettingsContext ([src/store/settings.js](src/store/settings.js))

The most complex store. Manages all user notification preferences and FCM topic subscriptions.

Every `setSetting()` call triggers `syncAllTopics()`, which subscribes or unsubscribes from each FCM topic based on the full `PARENT_CHAIN` hierarchy. A leaf topic is only subscribed when its own value AND all parent values are `true`.

**Notification hierarchy:**

```
preRace (parent)
  preRaceFP         → pre_fp
  preRaceQualifying → pre_qualifying
  preRaceQRace      → pre_qrace
  preRaceRace (parent)
    preRaceRace1    → pre_race1
    preRaceRace2    → pre_race2
    preRaceRace3    → pre_race3

results (parent)
  resultsFP         → results_fp
  resultsQualifying → results_qualifying
  resultsQRace      → results_qrace
  resultsRace (parent)
    resultsRace1    → results_race1
    resultsRace2    → results_race2
    resultsRace3    → results_race3

newsAlerts          → news_alerts
digestAlerts        → digest_alerts
explainerAlerts     → explainer_alerts
weekendPreview      → weekend_preview
standingsUpdate     → standings_update
podcastAlerts       → podcast_alerts
```

**Spoiler-free mode:** When enabled, sets an expiry of the next Monday at 23:00 local time (stored as ISO string). On every app open, if the expiry has passed the mode is silently cleared; if not yet expired the `SpoilerClearedDialog` is shown.

**Legacy migration:** Old single-key settings (e.g. `setting_race_alerts`) are migrated to the new granular key structure on first load.

**Non-topic leaf settings:** `chatFab` (show/hide the floating chat button) and `chatMentions` (receive a push when `@mentioned` in Live Chat) aren't in the topic hierarchy above - `chatFab` is purely local UI state, and `chatMentions` instead registers/removes this device's FCM token at `/chat/deviceTokens/{uid}` via `syncChatMentionToken()` (see ChatScreen's Mention notifications entry, [§6](#6-screens-reference)).

**Cross-device sync (Firestore user profile):** a setting only survives a reinstall/new device/re-login if its key is listed in *both* `SYNCED_KEYS` here (gates whether `setSetting()` calls `saveProfile()`) *and* `PROFILE_ASYNC_KEYS` in `userProfile.js` (gates `uploadLocalProfile()`/`applyProfileToStorage()`, both invoked from `auth.js`'s `onAuthStateChanged`). Adding a new synced setting means updating both lists - `use12HourTime` (12hr/24hr time format) shipped with neither, so a signed-in user's choice never reached Firestore and silently reverted to 24hr on a fresh install/new device; fixed 2026-08-29, see [`units.js`](src/store/units.js)'s `unitKm` for the reference pattern (a single field synced unconditionally, no gating set needed).

**Widget time-format bridge:** `use12HourTime` also needs to reach the home-screen widgets, which run as a separate native process on both platforms and can't read AsyncStorage. `src/utils/widgetSettings.js`'s `syncWidgetTimeFormat()` is called on every settings load and on every toggle of this key, and calls a native module (`WidgetSettings`) that didn't exist before 2026-08-29: Android's `WidgetSettingsModule.kt`/`WidgetSettingsPackage.kt` (registered in `MainApplication.kt`) write into the same `WidgetPrefs` SharedPreferences file the widgets already read and force a redraw; iOS's `WidgetSettingsModule.swift`/`.m` write into the shared App Group `UserDefaults` (`group.com.btccfanhub.widget`) and call `WidgetCenter.shared.reloadAllTimelines()`. Both are best-effort (wrapped in try/catch) - a missing/older native build just leaves the widget showing 24hr, the pre-existing behaviour, not a crash. The widgets then format the raw `"HH:mm"` strings themselves at render time (`formatWidgetTime()` in Android's new `WidgetTimeFormat.kt` and a same-named private helper in `BTCCWidget.swift`) - previously they displayed the raw 24hr string unconditionally regardless of the in-app setting.

### FavouriteDriverContext ([src/store/favouriteDriver.js](src/store/favouriteDriver.js))

Array of driver name strings in AsyncStorage key `favourite_drivers`. Case-insensitive matching. Legacy migration from single string to array format.

API: `favourites[]`, `toggle(name)`, `isFavourite(name)`

### UnitsContext ([src/store/units.js](src/store/units.js))

Single boolean `useKm` (AsyncStorage key `use_km`). `true` = kilometres, `false` = miles.

### RadioContext ([src/store/radio.js](src/store/radio.js))

Platform-specific radio. State: `currentStation` (name string), `isPlaying` (boolean).

- **iOS:** `react-native-track-player` - `play(station)` calls `TrackPlayer.add()` then `TrackPlayer.play()`
- **Android:** Native `RadioService` NativeModule

### cache.js ([src/store/cache.js](src/store/cache.js))

Not a context - a utility module. AsyncStorage wrapper that stores `{data, timestamp}` pairs.

- `cacheWrite(key, data)` - stores with current timestamp
- `cacheRead(key, maxAgeMs?)` - returns null if missing or older than `maxAgeMs`
- `cacheEvictStale()` - called on startup to clear entries older than 24 hours
- `cacheDelete(key)` - removes a specific entry (used by results_refresh FCM message)

---

## 8. Data Layer - API Client

**File:** [src/api/client.js](src/api/client.js)

All network requests go through the internal `fetchJson()` function which implements a **stale-while-revalidate** pattern.

### fetchJson() Behaviour

| Mode | When used | Behaviour |
|---|---|---|
| Normal | Most data | Serve cache if under maxAge; else fetch and wait |
| `staleFallback` | News, standings | On network error, return any cached value regardless of age |
| `staleFirst` | Drivers, blacklist, hub news | Serve ANY cached value immediately; always refresh in background |

Cache max age defaults to 1 hour. Overrides per endpoint:

| Endpoint | Cache key | Max age |
|---|---|---|
| Calendar | `calendar_{year}` | 10 minutes |
| Standings | `standings` | 5 minutes |
| Results | `results_{year}` | 5 minutes |
| Articles mirror | `articles_mirror` | 5 minutes |
| Hub posts | `hub_posts` | 5 minutes |
| Live status | `live_status` | 2 minutes |
| Gallery index/album | `gallery_{year}` / `gallery_album_{year}_{slug}` | 1 hour (matches the scraper's weekly-ish cadence) |

### Public API Functions

| Function | Source | Notes |
|---|---|---|
| `fetchCalendar(year)` | GitHub or bundled JSON | Fallback to bundled on network error |
| `fetchDrivers()` | GitHub or bundled JSON | staleFirst; bundled fallback |
| `fetchStandings(forceRefresh?)` | GitHub | staleFallback |
| `fetchResults(year, forceRefresh?)` | GitHub | 5-minute cache |
| `fetchPenalties(year, forceRefresh?)` | GitHub | 5-minute cache; a 404 (no decisions yet) resolves to `{season, rounds: []}` rather than throwing - see [§15](#15-judicial-decisions-penalties-system) |
| `fetchArticles(page, perPage, search)` | GitHub (`articles/page_<n>.json`) | No search: fetches just that one page file, cached under its own `news_p<n>` key - never downloads the rest of the archive. With search: fetches `index.json` plus every distinct page it references, filters client-side (a deliberate one-off cost only paid when actually searching). btcc.net has no public REST API, so none of this ever hits btcc.net directly (see [§20](#20-python-scrapers)) |
| `peekArticlesCache(page)` | AsyncStorage only | Returns that page's cache without a network call, bounded to one 5-minute scrape cycle (older entries return null) - see [§25](#25-known-architecture-decisions) |
| `fetchHubPosts()` | GitHub + device ID filter | Handles published/scheduled/draft states |
| `fetchArticleBySlug(slug, forceRefresh)` | GitHub (`articles/index.json` + one `page_<n>.json`) | Looks up the slug's page number in the index, then fetches only that one page file - never the whole archive; returns null if not (yet) present. `forceRefresh` (used by ArticleScreen's Retry and its own silent auto-retry) bypasses both files' 5-minute app-side cache entirely, not just a stale hit, and appends a `_cb=<timestamp>` cache-busting param so the request can't be served from `raw.githubusercontent.com`'s own `Cache-Control: max-age=300` CDN cache either - see [§25](#25-known-architecture-decisions) |
| `fetchBlacklist()` | GitHub or bundled JSON | staleFirst |
| `fetchLiveStatus()` | GitHub | 2-minute cache; returns null on error |
| `fetchGallery(year, forceRefresh?)` | GitHub (`gallery{year}.json`) | Album metadata + capture progress only, never a photo list - no bundled fallback (a non-critical browsing feature, matches `fetchArticles`' precedent) |
| `fetchGalleryAlbum(year, slug, forceRefresh?)` | GitHub (`gallery/{year}/{slug}.json`) | Fetched only when a user actually opens that album - same "small index, on-demand detail" split as the articles archive |

### Hub Post Filtering

`hub_news.json` posts have a `status` field:
- `published` - always visible
- `scheduled` - visible after `scheduledAt` timestamp passes
- `draft` - visible only on devices whose FCM token is listed in `previewDeviceIds`

---

## 9. Data Sources

| Source | URL/Location | Data |
|---|---|---|
| GitHub raw CDN | `https://raw.githubusercontent.com/yacobwood/BTCC/main/data` | drivers, standings, results, hub_news, news, articles, flags, calendar, schedule, roadmap, radio, blacklist, live_status, team_map, gallery |
| btcc.net (Vercel) | `https://www.btcc.net/news/` + per-article pages | News articles - scraped into `news.json` (latest headline, for the notification trigger) and `data/articles/page_<n>.json` + `index.json` (accumulated article archive, for the app's News tab and article deep-links) by `scrape_news.py`/`scrape_articles.py` via headless Chromium (see [§20](#20-python-scrapers)) |
| btcc.net (Vercel) | `https://btcc.net/gallery/<year>/` + per-album pages, both paginated | Photo gallery, year → album (one per race weekend plus occasional non-track events, back to 2010) - scraped into `data/gallery{year}.json` + `data/gallery/{year}/<slug>.json` by `scrape_gallery.py`, resumably/incrementally by page; photos are hotlinked (public Supabase Storage URLs, a different host than btcc.net), no image bytes mirrored (see [§20](#20-python-scrapers)) |
| Buzzsprout RSS | Configured URL | Podcast episodes |
| Open-Meteo | `api.open-meteo.com/v1/forecast` (free, no API key) | Daily + hourly forecast for the circuit's lat/lng over its race weekend |
| TSL SignalR | Live timing hub endpoint | Session live timing entries |
| BARC (WordPress) | `barc.net/online_noticeboard/*` + WP REST API | Judicial decision PDFs - scraped into `data/penalties{year}.json` by `scrape_penalties.py`, run the Monday morning after each round (see [§15](#15-judicial-decisions-penalties-system)) |
| Firebase Realtime DB | Firebase project | Community chat messages |
| Firestore | Firebase project | Article comments, reactions, bug reports, roadmap votes, notification state tracking |

---

## 10. Data Files

Stored in [data/](data/) directory. Served via GitHub raw CDN. Some are also bundled into the app as fallbacks.

| File | Purpose |
|---|---|
| `calendar.json` | 2026 season rounds with venues, dates, sessions, track guide, records |
| `calendar2027.json` | 2027 calendar (bundled, for advance planning) |
| `drivers.json` | All 2026 drivers and teams - names, numbers, images, bios, DOBs, career history |
| `standings.json` | Current season standings, scraped from the TSL championship PDF's six tables: Drivers, Independents' Trophy for Drivers, Jack Sears Trophy, Teams, Independents' Teams, Manufacturers/Constructors. The Independents' Trophy and Jack Sears Trophy are separately-scored classifications (Sporting Regs §1.6), not the Drivers' Championship filtered by class - see `parseStandings()` in `src/api/parsers.js` |
| `results{year}.json` | Full results for a season (2004 - 2026), including grids from TSL PDFs |
| `penalties{year}.json` | BARC judicial decisions per round, keyed like `results{year}.json`: `{round, penalties: [{session, driver, carNo, ruleRef, facts, offence, decision, sanction, oneLiner, pdfUrl, confidence}]}` - see [§15](#15-judicial-decisions-penalties-system) |
| `flags.json` | Feature flags + per-device overrides |
| `hub_news.json` | Hub-curated news posts including AI-generated digests |
| `explainer_articles.json` | "Academy" regulation-explainer articles (displayed name "Explained" until 2026-09-02), `{posts: [{id, title, content, status: 'staged'\|'published', scheduledDate, pubDate, order, ...}]}` - `status` is admin-flipped via the admin page's ACADEMY tab (edit/publish/unpublish/delete + a rich-text editor, upgraded 2026-09-02), not date-automated; see the ExplainerListScreen entry in [§6](#6-screens-reference) |
| `news.json` | Latest btcc.net article (WP-REST-shaped), scraped every 5 minutes so `sendSessionNotifications` can read it without hitting btcc.net directly |
| `articles/page_<n>.json` + `articles/index.json` | btcc.net article archive in full (title, content, image, category), accumulated over time (capped at 500 articles, oldest dropped) and split into ~20-article page files plus a slug→page index, so the app's News tab, search and article deep-links only ever fetch the one page they actually need instead of the whole archive - see [§20](#20-python-scrapers) |
| `roadmap.json` | Feature roadmap items with status |
| `radio.json` | Live radio station URLs - empty since 2026-08-20 (talkSPORT/talkSPORT 2 retired, `radio_tab` flag set to `false`) |
| `blacklist.json` | Profanity filter word list |
| `live_status.json` | Whether a live session is in progress |
| `schedule.json` | Session start times used by Cloud Functions for pre-session notifications |
| `team_map.json` | Driver-to-team mapping used by scrapers |
| `records.json` | All-time driver records (computed by `compute_records.py` on every scrape) |
| `tracks.json` | Static circuit guide data - corner sequences, L/R counts, sector breakdowns and corner descriptions for all 10 BTCC venues. Corner names and lap order are authoritative from `src/assets/tracks/*.svg` SVG renders. |
| `gallery{year}.json` | Gallery season index - one row per album (slug, title, cover, round/venue if resolved, capture progress). No photo lists, so opening the Gallery tab doesn't download every album's photos up front |
| `gallery/{year}/{slug}.json` | One album's full photo list (`{thumbUrl, viewUrl}` pairs, hotlinked Supabase Storage URLs - no image bytes mirrored), fetched only when a user opens that album |

---

## 11. Notifications System

### Architecture

Push notifications flow through two separate libraries working together:

- **FCM (Firebase Cloud Messaging)** - delivers the raw push payload to the device
- **Notifee** - displays the local notification UI and handles tap events

### FCM Topics

All notification subscriptions are topic-based (not individual tokens), managed by `SettingsProvider.syncAllTopics()` - with one exception: chat `@mentions` are a targeted send to a specific person's device token rather than a topic, since a mention can't be modelled as a subscribable feed. See the Mention notifications entry under ChatScreen ([§6](#6-screens-reference)) and `onChatMention` below.

| Topic | Trigger |
|---|---|
| `news_alerts` | New btcc.net article or hub post |
| `digest_alerts` | New weekly/race weekend digest ("The Flying Lap") |
| `explainer_alerts` | New "Academy" regulation-explainer article published - see the Academy section entry below and [§6](#6-screens-reference) |
| `podcast_alerts` | New podcast episode |
| `weekend_preview` | Friday 9am before a race weekend |
| `standings_update` | Tuesday 9am after a race weekend |
| `pre_fp` | 15 minutes before Free Practice |
| `pre_qualifying` | 15 minutes before Qualifying |
| `pre_qrace` | 15 minutes before Qualifying Race |
| `pre_race1/2/3` | 15 minutes before Race 1/2/3 |
| `results_fp/qualifying/etc` | Session results posted |
| `results_teaser` | Session results posted. Sent by `functions/scraperAdmin.js`'s `notifyResultsUpdate`, called by `scrape-results.yml` on every scrape tick (every 2 min on a raceday, reliably via `triggerResultsScrape` - see [§12](#12-firebase-cloud-functions)) - had **no dedup at all** until 2026-09-05, unconditionally firing on every call. `scrape_tsl.py` re-stamps `standings.json`'s `updated` field on nearly every raceday run regardless of real content change (`SESSION_FILTER` deliberately keeps grid-bearing sessions open all day "to catch grid amendments") - confirmed live, users getting repeat "A fresh result just dropped" pushes during the Croft (round 8) weekend with nothing new to show. Fixed with `functions/resultsHash.js`'s `computeSessionFingerprints()`/`findChangedSession()` - fingerprints each session's own `results`/`grid` arrays (never touches `standings.json`'s `updated` at all, so that field can't cause a resend even indirectly), diffs against `state/results_teaser`'s stored map in Firestore, and only sends when a specific (round, session) genuinely changed. **Changed again same day, by explicit request:** originally deliberately excluded from `RESULT_LEAF_KEYS` (sent generic, non-deep-linking copy so `spoilerFree` could never suppress it) - now deep-links straight to the actual changed result (`data: {type:'results', round, year, race}`, the same `RoundResults` navigation `resultsRace1/2/3` already use) and moved *into* `RESULT_LEAF_KEYS`, so `spoilerFree` fully unsubscribes the topic instead of sending a sanitized version. **Title changed 2026-09-06:** was the generic `"A fresh result just dropped"` regardless of which session changed; now names the session and venue directly, e.g. `"Results for Race 2 at Donington Park is now available"`, built from `changed.label` + the matching round's `venue` in `results{year}.json` (falls back to the label alone if `venue` is ever missing). **Grid-only false positive fixed same day:** `hashSession()` fingerprints a session's `grid` alongside its `results`, so a session's reversed grid being published (e.g. Race 3's, set right after Race 2 finishes, well before Race 3 is run) looked identical to an actual result posting - confirmed live (round 8, Croft): a user got "Results for Race 3 at Croft is now available" the moment its grid was set, with Race 3 not yet run. Grid announcements are already `sessionAlerts.js`'s job (a correctly-worded, well-timed pre-race push) - `notifyResultsUpdate` now only sends this push when the changed session's `results` array is actually non-empty, still advancing the fingerprint baseline either way so a grid-only change doesn't keep re-triggering the check every tick. |
| `broadcast` | All users (unconditional subscription) |

### Deep Link Routing

**File:** [src/utils/notifNavigation.js](src/utils/notifNavigation.js)

All notification data payloads are routed here. **Critical rule:** all navigations to nested screens use `CommonActions.reset()` rather than `navigate()`. This ensures navigation works on cold start when nested stacks are not yet mounted.

Only top-level tab navigations (no nested screen) use `navigate()`. One further exception: `type: 'chat'` doesn't navigate at all - it calls `requestOpenChat()` (`src/utils/chatBridge.js`) since live chat is a `Modal` owned by `ChatFab`, not a route.

### Manual Sending

The admin page at https://yacobwood.github.io/BTCC/admin/standings-admin.html has a NOTIFS tab for:
- Broadcast to all users (`broadcast` topic)
- Test notification to a single device token
- Article deep-link notifications (require `{"type":"news","slug":"article-slug"}` in data field)

`.github/workflows/send-broadcast-notif.yml` also accepts an optional `topic` input (default `'broadcast'`), added for the Academy feature below - a caller wanting a notification type users can actually opt out of (one with its own Settings toggle) passes a specific topic instead of relying on the default, which every install is force-subscribed to unconditionally regardless of any Settings toggle. Hub News/Digest publishing (below) deliberately keeps relying on that default and is unaffected by this addition.

---

## 12. Firebase Cloud Functions

**File:** [functions/index.js](functions/index.js)

All Cloud Functions run in the Europe/London timezone.

### sendSessionNotifications (every 1 minute)

The main workhorse function. Runs every minute and handles two categories of work:

**Race-day gated** (only runs on race days, Friday before or Tuesday after):
- Pre-session alerts: 15 minutes before each session start time from `schedule.json` (`buildSessionAlertPayload()` in `functions/sessionAlerts.js`, injected-deps-free pure function for testability). Every session deep-links to live timing when `round.tslEventId` is set, **except Race 3**: its grid is a reverse-grid derived from Race 2's result (BTCC reg 3.4.1.b) and reliably already published by the time this 15-minutes-before alert fires, so its body reads "...Tap to see the starting grid." and it deep-links to the grid tab (`{type: 'results', round, year, race: '3'}`, reusing `notifNavigation.js`'s existing race-index handling) instead of live timing.
- Friday 9am: race weekend preview notification to `weekend_preview` topic
- Tuesday 9am: standings update notification to `standings_update` topic

Session results notifications are a separate mechanism entirely - `.github/scripts/session_watcher.py` (Python, connected to TSL's live-timing SignalR feed, not this Cloud Function) sends those on `sessioncomplete` events, since it needs to react the moment a session actually finishes rather than poll once a minute. **Fixed 2026-09-02** (both the `race-day-start.yml` dispatch bug and a second, deeper `load_sessions()` schema mismatch it had been masking - see §20 for the full writeup) ahead of round 8 (Croft, 2026-09-05/06), its first live run all season. Not verifiable end-to-end without an actual live TSL feed, so that weekend is this fix's real first test regardless of how carefully it was checked beforehand.

**Always runs (every minute, regardless of race day):**
- News alerts: polls `news.json` on the GitHub raw CDN (scraped from `btcc.net/news/` every 5 minutes by `scrape_news.py` via headless Chromium - btcc.net's Vercel bot-challenge blocks the Cloud Function's runtime fetch from hitting it directly, see [§20](#20-python-scrapers)), compares latest `id` (now the article slug, not a WordPress post ID) to Firestore `state/news.lastId`. Before actually sending, checks that the slug is already in `data/articles/index.json` (`mirroredImageUrl`) - `news.json` is committed well before the much slower `scrape_articles.py` mirror step in the same workflow run, so a slug can exist here for several minutes before `ArticleScreen`'s lookup can find it. If not yet mirrored, the send is skipped for this tick without clearing `pendingSend`, so the next 1-minute tick just retries once the mirror catches up - fixed 2026-08-11, root cause of notifications occasionally opening to a "couldn't load this article" screen. **2026-09-06:** `mirroredImageUrl` also replaces `notifyPayload.imageUrl` (captured once, from `news.json`, back when the headline first changed) with whatever image the article mirror itself has by send time - `scrape_articles.py`'s own image fetch is independent and can resolve later (or not at all yet), so the mirror is the more authoritative source once this gate has passed anyway. Same date: `scrape_articles.py` can now withhold a genuinely brand-new, still image-less article from `index.json` entirely for up to `PUBLISH_HOLD_WINDOW` (20 minutes) while it retries the image - since this gate reads that same index, a held-back article's notification (and its News tab/website appearance) waits right along with it, then sends with whatever image was found (or none, if the hold expired first) with no separate gating logic needed here. Sends to `news_alerts` on change. Includes `slug` + `imageUrl` in payload. Logic lives in `functions/newsCheck.js` (injected deps for testability). Uses a 20-second fetch timeout.
- Hub news alerts: polls `hub_news.json`, compares latest `id` to Firestore `state/hub_news.lastId`. Sends to `news_alerts`. Excludes "Weekly Digest" category articles.
- Podcast alerts: polls Buzzsprout RSS, compares `guid` to Firestore state. Sends to `podcast_alerts`.

Firestore transactions prevent duplicate sends. First-time detection (when `lastId` is null) stores the ID but does NOT send a notification.

**Error alerting:** every `logError` call uses `alert: true`. For per-minute checks (news/hub/podcast/FCM) the error is upserted at a fixed key and the email is only sent on first occurrence or when the error recurs after being marked resolved in the admin's ERRORS tab (renamed from "FIRESTORE" 2026-09-05 - it only ever read the `errors` collection). One-off failures (syncAnalytics, notifyResultsUpdate, digest generation) always email. All alerts go to `btcchub@gmail.com` via `GMAIL_APP_PASSWORD` secret - **this secret must be explicitly declared in a function's `secrets: [...]` option to be injected into `process.env`** (Firebase Functions v2 does not bind Secret Manager secrets to a function unless it asks for them). `sendSessionNotifications`, `syncAnalytics` and `notifyResultsUpdate` were missing this declaration until 2026-07-11, so every alert from them silently wrote to Firestore but never emailed - fixed by adding `secrets: ['GMAIL_APP_PASSWORD']` to each.

**Scraper failure alerting:** `reportScraperFailure` (HTTP, `SCRAPER_SECRET`-gated) lets the GitHub Actions scraper workflows report into this same pipeline, since a failed workflow run has no way to email on its own. The 5 btcc.net-facing workflows (`scrape-news`, `scrape-calendar`, `scrape-btcc-stats`, `scrape-team-stats`, `scrape-gallery` - all Scrapfly-based as of 2026-09-01, see [§20](#20-python-scrapers)) POST to it only from a final `if: (failure() || cancelled()) && is_retry` step, not on every failure - see that section's "Failure handling convention" for the auto-retry-before-alerting mechanism. The remaining workflows still alert on plain `if: failure()`. Either way it calls `logError` with `key: scraper-<workflow>` - same dedup-until-resolved behaviour as the per-minute checks above, and shows up in the same admin ERRORS tab.

**Resolving errors:** the admin ERRORS tab Dismiss button calls the `dismissError` Cloud Function (Admin SDK, bypasses rules) via `POST /dismissError` with `x-admin-secret`. The `errors` collection has `allow write: if false` for clients - direct REST PATCH from the admin page was silently rejected by Firestore rules, so writes are routed through the function instead. "Dismiss all" sends `{all: true}` and the function batch-updates all unresolved docs.

### triggerResultsScrape (every 2 minutes, Sat/Sun 09:00-19:00 UTC)

Added 2026-09-05 to replace `scrape-results.yml`'s own `schedule:` trigger, which turned out to have never actually worked as documented. That workflow's cron (`*/2 9-19 * * 6` / `*/2 9-19 * * 0`, set 2026-06-07) asks for a 2-minute cadence, but GitHub Actions' own docs cap scheduled workflows at a 5-minute floor ("The shortest interval you can run scheduled workflows is once every 5 minutes") and don't guarantee even that under load. Checked against the workflow's entire run history via the Actions API (`?event=schedule`): **not one single schedule-triggered tick has ever landed within 3 minutes of the previous one, the whole 3 months this cron has existed** - median real gap 21.6 minutes, worst observed 230 minutes (3.8 hours). This isn't a one-off scheduling blip like `scrape-news.yml` occasionally hits (that one's `*/5`-floor-respecting cron self-heals within a couple hours) - the schedule trigger has never delivered anywhere near what it claims to, silently, the entire time. Found live during the Croft (round 8) race weekend when Free Practice results still hadn't appeared 28 minutes after the session ended.

`functions/resultsDispatch.js`'s `triggerResultsScrape` runs on Cloud Scheduler instead (what Firebase's own `onSchedule` provisions under the hood) - `sendSessionNotifications` above already proves `every 1 minutes` is reliable via this path, since Cloud Scheduler has no 5-minute floor. It does nothing scraper-side itself - it just calls the exact same `workflow_dispatch` endpoint the admin panel's Scrapers tab RUN button already uses (`POST .../actions/workflows/scrape-results.yml/dispatches`, `{ref: 'main', inputs: {year}}`), reusing the existing `GITHUB_TOKEN` secret (confirmed to already carry both `repo` and `workflow` OAuth scopes). `scrape-results.yml`'s own `is_race_weekend.py` gate and `concurrency: {group: scrape-results, cancel-in-progress: false}` block are unchanged and still do their job - this only fixes how reliably the workflow gets *invoked*, not what it does once running. The workflow's own `schedule:` entries were deliberately left in place (harmless, and free insurance if Cloud Scheduler itself ever has an outage) rather than removed.

### weeklyDigest (Monday 8am)

1. Scrapes: Reddit r/BTCC, btcc.net WordPress, Autosport RSS, Motorsport.com RSS, Touring Car Times RSS
2. Calls Claude API (`claude-opus-4-6`) with a digest prompt to generate a British English HTML article
3. Commits draft to `hub_news.json` on GitHub
4. Sends `digest_alerts` FCM notification

### raceWeekendDigest (Thursday 8am - if a round starts Saturday)

Same pipeline as weeklyDigest but uses a race-specific prompt focused on the upcoming round.

### triggerDigest (HTTP POST)

Admin-callable manual trigger for digest generation. CORS restricted to `yacobwood.github.io`. Secret-protected.

---

## 13. Scoring and Race Format

Scoring is implemented in [src/api/parsers.js](src/api/parsers.js) and verified against the 2026 BTCC Sporting Regulations ([regulations/2026-BTCC-Regulations.pdf](regulations/2026-BTCC-Regulations.pdf)).

### Points Scales

**Race 1, 2 and 3 (positions 1 - 15):**
20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1

**Bonus points:**
- +1 for Fastest Lap (Race 1/2/3 only, not QR)
- +1 for Lead Lap (Race 1/2/3 only)
- +1 for Pole Position (Race 1 only)

**Qualifying Race (QR) - positions 1 - 15):**
10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1

No bonus points in QR.

### Grid Format

- **Race 1:** Set by Qualifying session order
- **Race 2:** Set by Race 1 result
- **QR / Race 3:** Reverse of top N from previous session (N determined by draw 6 to 12)

R3 reverse grid detection (`detectReversalCount` in RoundResultsScreen) compares the actual TSL grid against reversed R2 top-N for N in range 12 down to 6.

### TTB (TOCA Turbo Boost) Allocation

Implemented in [src/utils/ttb.js](src/utils/ttb.js), per reg 1.11.1. Reg 1.11.1.a: TTB applies in Qualifying and every Race, with "different operating methods" between them - two distinct metrics, dispatched by race label via `ttbPositionMapForRace()`/`getTtbBadge()`. Shown as a ⚡ badge (current season only): on each driver's card in the Starting Grid tab pre-race, and on each row of the results list once that race has results in. It's the same fixed pre-race allocation in both places, not a live "laps/seconds consumed" counter - the app has no per-lap boost-deployment feed to drive one.

**Races (1/2/3)** - laps of boost available for the whole race, a sliding scale by position (P1 gets fewest, P8+ gets most), split by circuit type:

| Pos | A circuits | B circuits |
|---|---|---|
| 1 | 1 | 4 |
| 2 | 2 | 5 |
| 3 | 3 | 6 |
| 4 | 4 | 7 |
| 5 | 5 | 8 |
| 6 | 6 | 10 |
| 7 | 8 | 12 |
| 8+ | 10 | 14 |

"B circuits" (more laps) are Brands Hatch Indy, Knockhill and Silverstone; every other venue is an "A circuit". Ties on points get the same rank (standard competition ranking - next distinct value skips ahead by the number tied), per reg 1.11.1.b.

Position source per race:
- **Race 1** - Championship Order (cumulative points from every earlier round this season, reconstructed from `results{year}.json` since there's no historical standings-by-round snapshot). The regs don't define what happens at Round 1 (no prior round to rank by) - every other "no Championship Order yet" clause in these regs hands that gap to Co-ordinator discretion rather than a computed rule. Per user confirmation (not a quoted regulation - flagged as an inference in `ttb.js`), the season opener gives every driver the max TTB tier instead: legend reads "Season opener - every driver gets max TOCA Turbo Boost" (`isSeasonOpenerRace1()`).

  A driver with no results in any earlier round at all (e.g. Daniel Lloyd making his season debut at Donington Park GP after taking over from James Dorlin) has no points to sum and would otherwise be silently missing from the Championship Order entirely, dropping their TTB badge. `championshipOrderBeforeRound()` folds any such driver from the current round's grid in tied on zero points instead, per reg 1.11.1.b's ordinary tie rule - it does not implement the discretionary Late Entry TTB bonus below, it just stops them falling out of the ranking.
- **Race 2** - Race 1's finishing order, same round
- **Race 3** - Race 2's finishing order, same round

Non-classified results (DNF/DQ/DNS) are ranked after classified finishers by laps covered (descending) - the same convention `buildStraightGrid()`/`buildReverseGrid()` already use for grid derivation.

**Qualifying and the Qualifying Race** - a separate metric (`getTtbSeconds()`/`ttbQualifyingPositionMap()`): seconds per lap of boost available, one shared scale with no circuit split:

| Pos | Secs/lap |
|---|---|
| 1 | 1 |
| 2 | 3 |
| 3 | 5 |
| 4 | 7 |
| 5 | 9 |
| 6 | 11 |
| 7 | 15 |
| 8+ | 20 |

Both sessions share Race 1's Championship Order position source - **not** each other's finishing order the way Race 2/3 use the prior race. This is a genuine trap in the regs' own table: despite the Qualifying Race being a race-format, points-scoring session, it's grouped with the plain Qualifying session under the seconds scale, not the Races laps scale. Round 1's Qualifying/Qualifying Race has the same "no Championship Order yet" gap as Race 1 - the regs state the reduction only applies "from the second Championship meeting", but don't say what happens instead at Round 1. `isSeasonOpenerQualifying()` applies the same max-tier-for-everyone convention as Race 1's by analogy, flagged as the same kind of inference, not a quoted rule.

**Not modelled** (both explicitly left to Administrator discretion by the regs, so there's no data-derivable formula): Late Entry TTB for cars registered after 13 Mar 2026 or missing rounds (1.11.1.c.i), and substitute-driver TTB carryover (1.11.1.c.ii). Guest-driver results are also supposed to be excluded from Race 2/3 position numbering (1.11.1.a), but guest entries aren't flagged in the results data, so they're currently counted as a normal finisher. Also not modelled: reg 1.11.1.b's "Deployment Minimum Car Speed (KPH)" column (140kph at P1 down to 105kph at P8+) - a speed-gating condition on top of whichever allocation above applies. Left out because the table's own header for that column ("Qualifying & Race", singular "Race") is ambiguous about which sessions it covers, and there's no live speed-trace data in this app to apply it against regardless. Feature is gated to the current season only (`year === CURRENT_SEASON`) since the same scales aren't verified against older seasons' regs.

---

## 14. Starting Grid System

### Data Pipeline

1. TSL publishes grid PDFs at race weekends
2. Python scraper (`tools/scraper/scrape_tsl.py`) fetches and parses PDFs
3. Grid data stored in `results{year}.json` alongside race results under `race.grid`
4. App displays grid before results land; uses grid for accurate position-change deltas

### PDF Parsing

Grid PDFs have a two-column layout. Left column has positions at x-coordinates ~73-82; right column at ~313-322. Grid PDFs do NOT include team names - these are cross-referenced from race results via a `teamMap` built from all sessions in that round.

Suffix mapping for grid types:
- `"Qualifying Race"` → `gqr`
- `"Race 1"` → `grd`
- `"Race 2"` → `gr2`
- `"Race 3"` → `gr3`

Safety net: if a re-run of the scraper returns an empty grid (transient fetch failure), the existing non-empty grid is carried forward.

### StartingGridTab UI

- Two-column staggered layout (odd positions left, even positions right)
- Right column offset: `(GRID_CARD_HEIGHT + GRID_GAP) / 2 = 29px` to vertically centre between adjacent left cards
- Shuffle icon on reversed-grid cards; yellow highlight reserved for favourites only
- Reversal badge at list bottom when R3 reverse is detected ("Top 8 reversed (draw: 8)")
- ⚡ TTB badge per driver card (laps of TOCA Turbo Boost for Race 1/2/3, seconds/lap for the Qualifying Race) - see [§13](#13-scoring-and-race-format)

### Empty State Logic

```
if no results yet:
  if race.grid has data        → show StartingGridTab (official grid)
  if R3                        → show ReverseGridTab (prediction stepper)
  if Qualifying (FP has results) → show QualGroupsTab
  if R1 or R2                  → show StartingGridTab (predicted grid, from
                                   Qualifying Race / Race 1 finishing order -
                                   reg 3.4.1.b), if that source race has results
  otherwise                    → plain empty state
```

`buildStraightGrid()` computes the R1/R2 predicted grid: classified finishers keep the source race's finishing order, non-classified competitors follow ordered by laps covered (descending) - same DNF-ordering rule `buildReverseGrid()` uses for R3, just without the reversal step.

---

## 15. Judicial Decisions (Penalties) System

### Data Pipeline

1. BARC (the BTCC's organising club) publishes every stewards' decision as a PDF on a per-round "Online Noticeboard" page, e.g. `barc.net/online_noticeboard/2026-snetterton-300-may-23-24/`
2. `.github/workflows/scrape-penalties.yml` runs 07:00 UTC every Monday (the morning after a Sat/Sun round), gated by `.github/scripts/is_day_after_race.py` (checks `calendar.json` for a round whose `endDate` was yesterday)
3. `tools/scraper/scrape_penalties.py`:
   - Resolves the round's noticeboard page via BARC's WordPress REST API (`/wp-json/wp/v2/online_noticeboard`), matching on venue keyword + month + both day-of-month tokens (its own `search` param was tried and rejected - it silently ignores the collection scope on this site and returns ordinary news posts instead)
   - Filters notices to ones naming "British Touring Car Championship" in full (the page lists every series racing that weekend; BTCC's own results/grid PDFs are labelled with the short "BTCC" form instead, so that filter alone separates a real judicial decision from everything else)
   - Downloads and parses each linked PDF with layout-aware text extraction (same pdfminer technique as the grid PDFs in [§14](#14-starting-grid-system))
4. Output written to `data/penalties{year}.json`, keyed by round: `{round, penalties: [{session, driver, carNo, ruleRef, facts, offence, decision, sanction, oneLiner, pdfUrl, confidence}]}`

### PDF Parsing

BARC changed their decision template mid-2026 season, so parsing is template-aware:
- **Template A** ("BRITISH AUTOMOBILE RACING CLUB" header): prose form - "I find that you are guilty of contravening, {rule} ... In that {facts} ... I order that you should: {checkbox list}". Split at "In that": the part before is `offence` (rule citation), the part after is `facts` (plain-English incident description).
- **Template B** ("BRITISH TOURING CAR CHAMPIONSHIP" header): labelled fields matching the output schema by name - Car No/Driver, Entrant, Session, **Facts**, **Offence**, **Decision** (checkbox list)
- Both templates also have a **prose-only sub-variant** with no checkbox list at all (confirmed live: false-start penalties, appeal rulings that rescind an earlier penalty, and championship point deductions) - `_prose_order_text()` recovers the operative sentence from "I order that ..." directly in that case. There's no structural seam to split facts from offence in this sub-variant, so both stay `null` and the whole sentence goes into `decision` instead - closest in spirit, since it IS the operative sanction statement.

`facts`/`offence`/`decision` are the PDF's own field values, verbatim (not summarised) - the app shows them as three labelled fields. `ruleRef` is just the short code pulled out of `offence` (e.g. "NCR 12.7.1.8") and `sanction` is a short humanized label derived from `decision` (see below) - both are compact conveniences alongside the verbatim fields, not replacements for them. `oneLiner` collapses driver/sanction/facts into one line and is used as accessibility text and as the sole fallback display when a document didn't parse in enough detail to populate facts/offence/decision individually (`confidence: "minimal"`).

Every field beyond the driver/car header is genuinely optional - a document that doesn't match the checkbox-list shape still keeps its driver/car/session and falls back to the prose extractor, rather than being discarded. A document that doesn't even match a known template at all is still recorded with a generic "judicial decision issued" summary and a link to the PDF, rather than dropped.

**Checkbox matching:** `decision` is whichever option's first line sits closest (by y-coordinate) to the literal "X" marker in the form's left margin - confirmed reliable (within ~1-9pt) across every real document tested. `humanize_sanction()` turns that raw text into `sanction`, a short label (e.g. "5s time penalty", "3-place grid penalty", "Written reprimand"), extracting a digit or spelled-out number tied specifically to the relevant keyword (avoids picking up an unrelated number elsewhere in the sentence, e.g. "...elapsed time for round 19" beside the real "five second" penalty).

**Exclusions:** a notice is dropped entirely (not recorded even minimally) when the document itself states no judicial action was taken - e.g. "I feel that I am unable to take any judicial action..." - since recording it generically would misleadingly read as a penalty on a driver who was actually cleared (`_is_no_action()`).

### App Display

`RoundResultsScreen.js` fetches `penalties{year}.json` once per round (far less volatile than live results, so it isn't on the same 60-second results poll). Each session tab's results `FlatList` gets a `JudicialDecisionsCard` as its `ListFooterComponent`, filtered to that tab's own `race.label` - a penalty from Qualifying Race only shows on the Qualifying Race tab, not lumped into one flat per-round list. Renders nothing (no reserved space) when a session has no penalties, which is the common case. Each entry shows the driver/car line followed by labelled **Facts**/**Offence**/**Decision** fields (whichever are available - falls back to the collapsed `oneLiner` for a "minimal"-confidence entry with none of the three). Tapping "View decision →" opens BARC's own PDF via `Linking.openURL`.

---

## 16. Feature Flags

Flags are served from `data/flags.json` on GitHub. The `FeatureFlagsProvider` fetches fresh flags on every app start with an 8-second abort timeout.

**Per-device overrides** allow individual devices to see different flag values, keyed by FCM token:

```json
{
  "radio_tab": true,
  "overrides": {
    "fcm-token-abc123": {
      "debug_mode": true,
      "live_chat": true
    }
  }
}
```

The admin page at https://yacobwood.github.io/BTCC/admin/standings-admin.html provides a UI for editing all flags.

---

## 17. Design System

**File:** [src/theme/colors.js](src/theme/colors.js)

| Token | Value | Use |
|---|---|---|
| `Colors.yellow` | `#FEBD02` | Primary accent, active tab, favourites |
| `Colors.yellowDark` | `#CC9800` | Yellow pressed state |
| `Colors.navy` | `#020255` | Rarely used |
| `Colors.background` | `#080912` | App background |
| `Colors.surface` | `#0F1122` | Tab bar, cards |
| `Colors.card` | `#161828` | Card backgrounds |
| `Colors.textPrimary` | `#FFFFFF` | Primary text |
| `Colors.textSecondary` | `#8B8FA8` | Secondary text, inactive icons |
| `Colors.outline` | `#2A2D44` | Borders, dividers |

The colour palette is dark navy/black with a BTCC yellow accent. All screens use `Colors.background` as their base.

---

## 18. Shared Components

**AdBanner** ([src/components/AdBanner.js](src/components/AdBanner.js)) - Google AdMob banner, gated by `banner_ad` feature flag. Hidden until first ad loads (`loaded` state). `BannerAd` handles refresh internally; manually calling `.load()` on tab switch interrupted the cycle and caused visible flashing.

**ChatFab** ([src/components/ChatFab.js](src/components/ChatFab.js)) - Floating live-chat button, mounted once globally in `AppContent` (not per-screen), gated on the `live_chat` feature flag and the user's own "Chat button" setting. Positioned a fixed `12px` above the tab bar's own top edge (`bottom: bottomOffset + FAB_BOTTOM_OFFSET`, where `bottomOffset` is the exact same `TAB_BAR_HEIGHT + safeAreaBottom` value the tab bar's own height uses) - so its footprint relative to any screen's natural bottom edge is a fixed 12-64px zone regardless of device/safe-area, and it overlays every screen identically. Since it's an absolute-positioned overlay, a screen's own scrollable content can still scroll its last item underneath it - every screen with a bottom-of-content `paddingBottom` adds `CHAT_FAB_CLEARANCE` (exported from `src/utils/chatFabLayout.js`, a plain-constants file with zero imports) on top of its own value, so the true last item always clears the FAB (fixed 2026-08-24, reported live: a `RoundResultsScreen` judicial-decision card's "View decision" link was sitting half-behind the FAB). `chatFabLayout.js` is deliberately its own dependency-free module rather than exporting the constant straight from `ChatFab.js` itself - that file pulls in Firebase Realtime Database, AsyncStorage and keyboard listeners, and a first attempt at this fix that imported the constant directly from `ChatFab.js` broke 17 unrelated test suites (plain util-level tests with no Firebase mock configured) purely by being on the import chain.

**CachedImage** ([src/components/CachedImage.js](src/components/CachedImage.js)) - Image component that rewrites btcc.net WordPress URLs to thumbnails (`-150x150` or `-768x768` suffix depending on display size). Provides a fallback placeholder on load error or null URI. `handleError` logs the native error string (`e.nativeEvent.error`) via `console.warn` - every failure used to look identical (network blip, dead URL, CDN block, decode error) all the way to the broken-image fallback, with nothing to distinguish them after the fact. A genuinely reproducible failure (one that survives the retry and a rebuild) is now diagnosable straight from Metro/logcat instead of guessed at.

**ErrorBoundary** ([src/components/ErrorBoundary.js](src/components/ErrorBoundary.js)) - React class component catching JS errors anywhere in the tree. Shows a "Try Again" button that resets its state.

**GalleryTab** ([src/components/GalleryTab.js](src/components/GalleryTab.js)) - Album grid for the Season tab's Gallery sub-tab, grouped into "Race Weekends" (ordered by round) and "Other" (season launch, TOCA Awards, test days) sections via one `FlatList` over a manually-built `{type, ...}` items array (header rows + 2-wide album rows) - the same "mixed full-width + grid-cell rows" pattern `NewsScreen`/`TrackDetailScreen` already use, rather than `SectionList`. Tuned like `NewsScreen`'s own image-heavy `FlatList` (`removeClippedSubviews={false}`, `windowSize`/`initialNumToRender`/`maxToRenderPerBatch` all `10`).

**OnboardingDialog** ([src/components/OnboardingDialog.js](src/components/OnboardingDialog.js)) - First-launch modal with "Allow Notifications" and "Skip" options. Stored in AsyncStorage key `onboarding_shown`. An optional "New to BTCC? Learn the basics" link (added 2026-08-25) navigates to the existing newcomer-explainer InfoPage that was previously only reachable three taps deep (More → New to BTCC?) - via `navigateToNewToBtcc()` in `notifNavigation.js`, reusing the same cold-start-safe `navigationRef.dispatch(CommonActions.reset())` pattern already used for notification deep links rather than new plumbing. **Deliberately does not set `onboarding_shown`** - it's a detour, not a decision about notifications. An initial version did set it, which meant a curious new user who tapped straight into "learn the basics" was silently never asked about notifications again, on this or any later launch (caught live, fixed same day). Leaving the flag unset means the notification prompt asks again on the next cold start instead - nothing re-shows it mid-session, since the check only ever runs once, on mount.

**PhotoLightbox** ([src/components/PhotoLightbox.js](src/components/PhotoLightbox.js)) - Full-screen photo viewer (`Modal` + bare `PagerView`, not `SwipeableTabs` which is tab-bar-specific), used by `GalleryAlbumScreen`. Swipe between photos, tap to dismiss - deliberately no pinch-zoom in v1. `offscreenPageLimit` is a small fixed `1` rather than `SwipeableTabs`' "keep every page mounted" pattern, since a gallery album can be arbitrarily large and mounting every photo at once would recreate the Android decode-memory-pool problem documented under `DriversScreen` above. A persistent top bar shows a real close button (the tap-to-dismiss gesture itself has no visual affordance), a "N of total" position counter tracked via internal `currentIndex` state (seeded from `initialIndex`, kept in sync through the same `onPageSelected` handler that fires `onIndexChange`), and an optional share button next to the counter (only rendered when the parent passes an `onShare` prop). A brief "Swipe to browse · Tap photo to close" hint fades in and out on every open (not persisted as "seen once" - the gestures have no other affordance, and a light reminder each time was judged worth more than one-time-only tracking complexity). The component builds no URLs or messages itself - `onShare?.(currentIndex)` just hands the current index to whichever screen renders it, keeping this the same generic, reusable pager it already was (a future `PhotoCarousel` fix could reuse it as-is).

**ProgressionChart** ([src/components/ProgressionChart.js](src/components/ProgressionChart.js)) - SVG line chart (react-native-svg) plotting points-per-round for each driver. Supports "Show all / Hide all" toggle and individual driver series toggling. Handles null gaps in data.

**SeasonTable** ([src/components/SeasonTable.js](src/components/SeasonTable.js)) - Scrollable grid of all rounds and results. Shows DSQ/Ret/DNS/FL/PP badges. P4-P15 rendered with a smooth green gradient (brightest at P4). Sorted by championship points. Supports standings override for historical seasons. Round/venue header background lives on the static clip container (not the translated Animated.View) to prevent React Native GPU layer clipping from cutting the colour band short on Android.

**SpoilerClearedDialog** ([src/components/SpoilerClearedDialog.js](src/components/SpoilerClearedDialog.js)) - Modal shown when spoiler-free mode was active and auto-expired.

**SwipeableTabs** ([src/components/SwipeableTabs.js](src/components/SwipeableTabs.js)) - `PagerView`-based tab component. Supports `lazy` mode (only renders the active page on first visit). Used in RoundResultsScreen for session tabs.

**UKMapPin** ([src/components/UKMapPin.js](src/components/UKMapPin.js)) - Renders an SVG outline of the UK with a map pin at the given `lat`/`lng` coordinate. Used in TrackDetailScreen to show circuit location.

**UpdateDialog** ([src/components/UpdateDialog.js](src/components/UpdateDialog.js)) - Force-update modal linking to App Store or Play Store. Shown when build number is below `update_min_version_ios`/`update_min_version_android` in flags.

---

## 19. Utility Modules

**analytics.js** - Firebase Analytics event helpers wrapping `logEvent()` calls. Note: the `widget_configured` event (Android, params: `size` and `theme`) and `widget_size_used` event (iOS, param: `size`) are fired natively - not via this module. Android fires from `WidgetConfigureActivity.kt` at configure time. iOS queues the family in the shared App Group UserDefaults during `getTimeline` and the main app flushes to Firebase in `AppDelegate.didFinishLaunchingWithOptions`. That flush call (`Analytics.logEvent(...)`) needs an explicit `import FirebaseAnalytics` in `AppDelegate.swift` - `import Firebase` alone stopped transitively exposing it after the Firebase pods were updated (2026-08-29, found while `pod install`-ing to clear an unrelated stale `Podfile.lock` - several pods, including `RNScreens`, were multiple versions behind `node_modules` and referencing source files that no longer existed there).

`articleClicked` (event: `select_content`, `content_type: 'article'`) takes an optional 5th `publishDate` argument that logs as `publish_date` (only included when present). All call sites that have the full article object (NewsScreen hero/grid/list, DigestsScreen) pass `article.sortDate`. `ArticleScreen`'s own `Analytics.screen('article:...')` call also includes `publish_date` from `article.sortDate` when available. The notification deep-link path in `App.tsx` only has an article ID/slug (no full article object), so it cannot supply `publish_date`. Since this is an event parameter, GA4 only captures it going forward from when this shipped (2026-07-21) - it does not backfill `publish_date` onto previously logged events, so older `select_content`/`screen_view` rows in GA4 will show `(not set)` for it.

**backgroundPrefetch.js** - Prefetches images into the React Native/Android image cache 3 seconds after every app launch, so a fan browsing at a race track with no signal still sees photos rather than broken-image placeholders - as long as the app was opened at least once beforehand with a connection (this warms the cache, it doesn't guarantee it survives forever; a long enough gap or enough other image traffic could still evict something). Three sweeps: `prefetchDrivers()` (every driver's fallback photo, card background, number graphic and both car-image thumbnail variants, plus every team's card background, sponsor logo, and `cardBgThumbUrl` if a team ever gets one - not populated on any team as of 2026-08-24, but covered so it isn't a silent gap the day it is), `prefetchNews()` (page-1 article thumbnails), and `prefetchTracks()` (every circuit's hero photo, layout map and race-photo carousel - all ~10 tracks, not just the next round, since the total is small enough that guessing which one a fan needs isn't worth it).

Each prefetched URL is built to match **exactly** what its real render site requests, not a close guess - this matters because a mismatched URL (e.g. a differently-sized WordPress thumbnail) warms a cache entry nothing ever asks for, giving zero actual offline benefit while still spending the bandwidth. Found and fixed one real case of this 2026-08-24: driver `imageUrl`'s fallback photo (only reachable for departed drivers with no bundled headshot, e.g. Max Buxton/James Dorlin, whose photo is still `btcc.net`-hosted) was being prefetched at `thumbUrl()`'s own `150x150` default, while `DriversScreen`'s tile and `DriverDetailScreen`'s header both actually request it via `targetWidth={300}` (`-300x300`) - the prefetch had been warming a URL that was never once requested. `cardBgUrl`/`numberImageUrl` get no size rewrite at all, matching that no render site applies a `targetWidth` to either; `TrackDetailScreen`'s hero/layout-map images do (`768`/`300`), matched here the same way, while its race-photo carousel renders via a plain `<Image>` with no rewrite, so those prefetch unmodified too. Max Buxton/James Dorlin's `imageUrl` no longer exists to prefetch as of 2026-08-28 - see the "Hardcoded driver/team images" entry above for why, and for `driverImagesLarge` now covering their `DriverDetailScreen` header photo directly.

**broadcaster.js** - Simple event emitter for cross-component state broadcast.

**deviceId.js** - Generates a stable anonymous UUID stored in AsyncStorage. Used for hub post draft previews and roadmap vote deduplication.

**digestRead.js** - Tracks which digest article IDs have been read (AsyncStorage). Syncs to the signed-in user's Firestore profile (`digestReadIds` field via `userProfile.js`) so read state carries across devices; anonymous users only get local persistence.

**explainerRead.js** - Same shape as digestRead.js, added 2026-09-02 so Academy articles (ExplainerListScreen) get the same read/unread behaviour as The Flying Lap. Deliberately a separate module/AsyncStorage key (`explainer_read_ids`) and Firestore field (`explainerReadIds`) rather than sharing digestRead.js's, so the two read states track independently.

**driverName.js** - Formats driver names as "Firstname LASTNAME" (e.g. `Tom INGRAM`). Used consistently across all screens for display.

**notifNavigation.js** - Maps notification `data` payloads to navigation actions. Uses `CommonActions.reset()` for all nested screen navigations.

**notifications.js** - Sets up Android notification channels. Requests OS permission. Registers foreground FCM message handler. `setupNotificationChannels()`'s channel `id`s must exactly match every real `data.channel` value a Cloud Function/admin dispatch ever sends (`index.js`'s background handler and this file's own `displayAndroidDataNotification` both pass `data.channel` straight through as the Notifee Android `channelId` with zero validation) - posting to an unregistered channel is a silent, unthrown OS-level no-op (Android's `NotificationChannel` API requirement, API 26+), with nothing in Firebase's own send response to indicate anything went wrong. Confirmed live 2026-09-02/03: `explainer` (Academy articles' channel, set in `admin/standings-admin.html`'s `dispatchExplainerNotif`) was missing from this list entirely - every real Academy notification sent to an Android device had been silently failing to display since the feature launched, discovered only via a manual test notification that Firebase confirmed sending but that never appeared on-device. Fixed by adding the missing channel; worth checking this list stays in sync any time a new `channel`/topic pairing is introduced elsewhere.

A second, bigger bug found the same day while verifying that fix on a live emulator: `onForegroundMessage`'s Android branch used to return early on every message, on the assumption that `index.js`'s background handler "handles display for both foreground and background." A controlled on-device test (same payload, same channel, same permission state, only the app's foreground/background state changed) proved that assumption wrong - the background handler's headless JS task only ever fires while the app is backgrounded or killed, never while it's open, and the two delivery paths are mutually exclusive, not overlapping. That meant every FCM notification, on every channel, was silently dropped whenever a user had the app open - not an Academy-specific bug, and not new; it predates this session. Fixed by extracting the display logic (title/body/channel resolution, the Notifee `android` options) into one shared `displayAndroidDataNotification()` export, called from both `index.js`'s background handler and `onForegroundMessage`'s Android branch, so the same logic can't drift between the two call sites the way the channel list itself already did once.

**profanityFilter.js** - Checks input text against the `blacklist.json` word list. Used in ChatScreen and BugReportScreen.

**reviewPrompt.js** - Decides when to trigger `react-native-in-app-review` based on usage events.

**signalr.js** - TSL SignalR client. Handles WebSocket negotiation, handshake, `registerForEvent`, session/entry parsing, pong responses (type 6), reconnection and teardown.

**timeAgo.js** - Returns relative time strings ("2 hours ago", "3 days ago") from a date string.

**ttb.js** - TOCA Turbo Boost calculations: laps-of-boost for Races, seconds/lap for Qualifying/Qualifying Race - see [§13](#13-scoring-and-race-format).

**weather.js** - Fetches forecast weather from Open-Meteo for a circuit's lat/lng over its race weekend dates. Only fetches when the round is within `MAX_FORECAST_DAYS` (10 days, raised from 7 on 2026-08-10 - Open-Meteo's free tier forecasts up to 16 days out, so 10 is comfortably within range) and not a past weekend. Uses a manual AbortController for the 8-second timeout (AbortSignal.timeout is unreliable on Android/Hermes). Helpers for WMO weather code descriptions, icons and icon colours. **BTCCWidget.swift** (iOS) and **LargeWidget.kt** (Android) - the home-screen widgets, a separate surface from TrackDetailScreen - each have their own independent `7`-day constant that was deliberately left as-is in that same change, since it wasn't part of what was asked; keep this in mind if the widgets' cutoff is ever revisited, since all three constants must still be kept in sync manually. (The widgets also stay daily-only, bare-array shape - the hourly addition below is TrackDetailScreen-only, deliberately not propagated there.) `fetchWeather()` returns `{daily, hourly}` (2026-08-09, breaking change from a bare daily array) - `hourly` drives the session-aligned forecast in TrackDetailScreen (see [§6](#6-screens-reference)). Cache reduced from 3 hours to 30 minutes for the same reason: a race-weekend forecast is worth checking through the day, not settling for what was true hours ago.

---

## 20. Python Scrapers

Located in [tools/scraper/](tools/scraper/). Run manually or via CI to update data files on GitHub.

**Fetching btcc.net:** btcc.net moved off WordPress entirely to a Vercel-hosted React app (2026-07-31). It now issues a Vercel BotID JS proof-of-work challenge (HTTP 429) to any request that can't execute JavaScript, and the challenge also scores network/IP reputation on top of the JS check.

**History, for context (superseded 2026-09-01):** every btcc.net-facing scraper originally rendered pages with local headless Chromium via `tools/scraper/btcc_playwright.py` (the `RenderedFetcher` context manager / `fetch_rendered()`), which only cleared the challenge from a residential-reputation IP - confirmed by testing identical Playwright code from both a residential IP (passed cleanly) and a GitHub-hosted Actions runner (still 429'd). That meant every btcc.net-facing workflow had to share one single **self-hosted runner** (label `btcc-mac`, a `launchd` service on the maintainer's own Mac). That runner became a real reliability problem: `scrape-news.yml`'s 5-minute cron was landing successful runs every 4-5 hours instead, root-caused to runner contention - a workflow's own `concurrency` group only serializes runs *within itself*, giving no protection against a *different* scheduled workflow occupying the one shared runner. `runner-heartbeat.yml`'s alerting only caught a *fully* unresponsive runner (last 3 runs cancelled consecutively, or nothing started within 8 minutes), missing this "online but backlogged" pattern entirely - it went unnoticed for about a week. (The 2026-08-13/14 Vercel re-block and its `storage_state`-persistence fix, and the auto-retry-before-alerting mechanism below, both predate and are unrelated to the migration that follows - they're kept here for anyone reading old run history, but no longer the operative fetch mechanism.)

**Current: full Scrapfly migration (2026-09-01).** All 5 btcc.net-facing scrapers (`scrape_news.py`, `scrape_articles.py`, `scrape_calendar.py`/`scrape_full_timetable.py`, `scrape_team_stats.py`, `scrape_btcc_stats.py`, `scrape_gallery.py`) now fetch via Scrapfly's paid Scrape API (`tools/scraper/scrapfly_fallback.py`'s `fetch_via_scrapfly`/`fetch_image_via_scrapfly`/`fetch_image_smart`) instead of local Playwright - `asp=true` clears the Vercel challenge from *any* IP, confirmed live, so every workflow now runs on GitHub-hosted `ubuntu-latest` with `SCRAPFLY_API_KEY` as the only new secret required. The self-hosted runner registration and `btcc_playwright.py`'s `RenderedFetcher`/`fetch_rendered` are deliberately left completely intact and unused in the repo - dormant, not deleted, in case Scrapfly ever needs to be swapped back out (the one known exception is `scrape_circuit_images.py`, a manual-only script not called by any workflow, which still uses `RenderedFetcher` directly and hasn't been migrated).

Two real cost findings drove the design, both confirmed live 2026-09-01, not assumed:
- **Images cost ~7.5x a plain page fetch** (~225 credits vs. ~30) - Scrapfly bills each resource independently, unlike Playwright, which captured every image on a page for free as a side effect of rendering it once. This is why `scrape_news.py`/`scrape_articles.py` now explicitly gate the image fetch on "does this slug already have a mirrored image" (a real bug fix in `scrape_news.py` specifically - it used to re-attempt the image capture on *every* run regardless, harmless when captures were free, expensive here) and why a Supabase-hosted image (unprotected - see `scrape-gallery.yml`'s own comment) always uses a plain free request instead. A full-time 5-minute cadence including images was estimated at 190k-268k credits/month depending on real article volume that month - past the $30/mo Discovery tier (200k credits) for anything but the quietest months.
- **The real pagination URL is `/page/<n>/`, not `/news/page/<n>/`** (which 404s) - discovered while investigating the above, via the listing's own `<nav class="pagination">` markup. A much older version of this scraper had assumed direct-URL pagination didn't work at all (based on a real observation against the wrong URL) and worked around it with in-page "Next"-link clicking, which hit a genuine site bug after 2 clicks and could never reach past ~75 cards. Confirmed real, chronologically-ordered content all the way to page 201 (~November 2013) - `scrape_articles.py`'s `--backfill-pages` can now genuinely reach 13 years of history, not ~3 pages.

`scrape-news.yml`'s cron is `3-59/5 7-19 * * *` plus `3 0-6,20-23 * * *` (5-minute cadence 07:00-20:00 UTC, hourly the rest of the day) rather than flat 5-minute-forever - sized against the real worst month on record (June 2026, 53 articles) at ~83-88% of the 200k ceiling, comfortable margin rather than razor's-edge. `scrape_news.py`/`scrape_articles.py` also no longer independently re-fetch the same `/news/` listing page within one workflow run (a real pre-existing inefficiency, doubling that one fetch's cost for no reason) - see the git history around 2026-09-01 if that ever needs revisiting.

**Overnight cron gaps, found+fixed 2026-09-02:** real run history showed only 2 of ~7 expected overnight hourly ticks actually landing, arriving 1-4.5 hours late - not runner contention (that ended with the migration above) and not GH-side queueing delay (`ubuntu-latest` jobs were starting instantly once dispatched, confirmed via `createdAt`==`startedAt`). Root cause per [GitHub's own docs](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule): `schedule` triggers can be delayed or dropped under high load, and "high load times include the start of every hour" - every cron entry in this workflow fired exactly on the minute mark (`:00`, or every 5 minutes from `:00`), the single most contended moment on GitHub's shared scheduler. Fixed by offsetting both entries to `:03`-based ticks instead - same cadence/cost, just off the busiest mark, per GitHub's own recommendation. `runner-heartbeat.yml` (retired the same day) made this worse in two ways: its own `0 * * * *` cron collided with `scrape-news.yml`'s at the exact same minute every overnight hour, and once retired its "expected every 5 minutes" threshold no longer matched the hourly-overnight cadence at all - it had been falsely reporting "btcc-mac may be offline" (a runner no scheduled workflow has used since the migration above) on every sampled overnight run since 2026-09-01, Firestore-deduped so not a repeated email but a permanently-wrong entry sitting in the admin errors tab. The README already called this workflow "superseded" the day of the migration; the `.yml` file itself just hadn't been removed to match.

**Failure handling convention:** every scraper invoked by a workflow exits non-zero on a real failure (fetch error, empty/unparseable response) and exits 0 only when there was legitimately nothing new to do. `scrape-penalties.yml`/`scrape-youtube.yml` have a final `if: failure()` step that reports straight to the `reportScraperFailure` Cloud Function (see [§12](#12-firebase-cloud-functions)), which emails `btcchub@gmail.com` and logs to the same admin ERRORS tab as Cloud Function errors. The 5 btcc.net-facing workflows instead auto-retry once before alerting (added 2026-09-01, originally to cut noise from self-hosted-runner contention, kept after the Scrapfly migration since a transient Scrapfly/parse blip deserves the same treatment): a `Retry once on failure` step (`if: (failure() || cancelled()) && github.event.inputs.is_retry != 'true'`) re-dispatches the same workflow via the REST API `workflows/<file>/dispatches` endpoint (needs `permissions: actions: write`), carrying forward whatever manual inputs the run had (e.g. `season`, `dry_run`) plus `is_retry: true`. `Report failure` only runs `if: (failure() || cancelled()) && github.event.inputs.is_retry == 'true'` - i.e. only once the retry has *also* failed - so a single transient blip (the common case) no longer emails anyone. `scrape_tsl.py` is the one exception to "fetch happens before write": `compute_records.py` runs as an internal sub-step *after* `results{year}.json`/`standings.json` are already written, so its workflow (`scrape-results.yml`) uses `continue-on-error` on the scrape step so the commit step still saves that good data even when the sub-step fails, then explicitly fails the job afterward so the run still shows red and alerts.

**`scrape-results.yml` joined the auto-retry group 2026-09-05**, moved out of the plain `if: failure()` group above it started in - `triggerResultsScrape` ([§12](#12-firebase-cloud-functions)) now dispatches it reliably every 2 minutes on a raceday, which surfaced a genuine, previously-unseen failure mode: `stefanzweifel/git-auto-commit-action`'s `push_options: --force-with-lease` rejects with "stale info" if any other push (this workflow's own next tick, a different scraper, a hub-news/digest publish, ...) lands on `main` in the few seconds between this run's `git pull --rebase` and its own push - confirmed live, the first real failure this surfaced, a GitHub-native "workflow run failed" email being how it was noticed rather than this project's own alerting, since `Report failure` was scoped to `steps.scrape.outcome == 'failure'` only and never covered the commit step failing on its own. Now whole-job `failure()`/`cancelled()`, matching the other auto-retry workflows, so it catches the commit step's failure too - a fresh `git pull --rebase` on the retry's next attempt resolves the race cleanly, and `Report failure` (also broadened the same way) only fires if that retry fails too.

**scrape_tsl.py** - Main results and grid scraper. Fetches TSL timing PDFs for each session (not btcc.net, so unaffected by the Vercel-challenge situation above). Parses race results and starting grids. Writes to `results{year}.json`. Non-finisher results carry `pos: 0`; disqualifications additionally carry `status: "DQ"`. At the end of each run it also updates circuit lap records in `calendar.json` and triggers `compute_records.py`. (Team stats used to run here too - see `scrape_team_stats.py` below for why that moved out.) Every PDF suffix (`SESSION_SUFFIXES`, `GRID_SUFFIXES`, `CHAMPIONSHIP_SUFFIX`) gets `trg` appended at the point of use (`f"{suffix}trg"`) - TSL's touring-car category disambiguator, needed because a single TOCA event ID covers BTCC plus several support series sharing the same file namespace.

**scrape_penalties.py** - BARC judicial decision scraper - see [§15](#15-judicial-decisions-penalties-system) for the full pipeline/parsing writeup. Unlike every btcc.net-facing scraper above, BARC (`barc.net`) is a conventional server-rendered WordPress site with no JS bot-challenge (confirmed live), so this fetches with plain `urllib.request` - no Scrapfly needed, since there's no challenge to clear. Its parsing/matching logic is covered by `test_scrape_penalties.py`, using line-layout fixtures transcribed from real documents fetched live while building it - real-data testing is what caught several bugs during development (fragile positional math, a number-extraction bug that picked up an unrelated "round 19" instead of "five seconds", a missing exoneration filter).

**scrape_articles.py** - Mirrors full btcc.net article content into `data/articles/page_<n>.json` + `index.json` (see file's own docstring for the per-page split rationale). A slug already in the accumulated archive normally keeps its cached content rather than re-fetching every run (`scrape-news.yml` runs every 5 minutes) - `needs_full_refetch()` is the one exception: if the cached content is itself btcc.net's own literal `"More to follow..."` stub (published before a live race-weekend session's result was in), it's re-fetched on every run regardless of age, since a stub with no further signal would otherwise be treated as "done" forever. Fixed 2026-08-09 - two Snetterton reports had sat unfinished for 2.5+ months, and Knockhill's own FP/qualifying reports were stuck the same way the day this was found. `--refresh-all` (CLI-only, never used by the scheduled workflow) forces every page-1 card to re-fetch regardless of stub status, for a manual full catch-up. **Image fallback added 2026-09-04:** an article's featured image previously only ever came from its `/news/` listing card's own `<img>` (`card["media_url"]`, matched by `IMAGE_RE`) - confirmed live, "Darlington UK meets Darlington USA" (a Goodyear press-release repost) had no `<img>` anywhere in its listing-card markup at all, so it never got a mirrored image and the app's HeroCard rendered a blank hero. `fetch_article_body()` now also returns `extract_og_image()`'s read of the article's own `<meta property="og:image">` tag from the same already-fetched page (no extra Scrapfly request) as a fallback source when the listing card has nothing. Since an already-mirrored, non-stub article normally never gets `fetch_article_body()` called again, a mirrored article with no image at all (from either source) is treated like a content stub too - `needs_image_retry` forces one more full-page fetch, bounded to `IMAGE_RETRY_WINDOW` (3 days) of its `firstSeenAt` so a genuinely image-less article doesn't re-pay that fetch every run forever. **Publish hold added 2026-09-06:** the og:image fallback above only ever kicks in for an article that's *already published* - a genuinely brand-new article (no prior entry at all) whose very first fetch attempt finds no image at all used to publish immediately anyway, text-only, so the News tab/website and the push notification could both go out ahead of an image that then took a few more retries to actually land (confirmed live: "Qualifying in Quotes: Croft" hit 3 straight Scrapfly 422s on its image fetch, same day). Such an article is now held back entirely - not written to `page_<n>.json`/`index.json` at all, tracked instead in a small scraper-internal `data/articles/pending.json` ({slug: {firstSeenAt}}, never read by the app or website) - and retried in full every cycle (no cached content to fall back on yet) until either an image is found or `PUBLISH_HOLD_WINDOW` (20 minutes) elapses since its true first sighting, at which point it publishes anyway, text-only. Since `functions/newsCheck.js`'s own mirror-gate reads this same `index.json`, holding a slug out of it is what suppresses the push notification too, with no separate gating logic needed on that side - see that section's own `mirroredImageUrl` writeup.

**scrape_gallery.py** (added 2026-08-28) - Mirrors metadata only (never image bytes) for btcc.net's photo gallery (`btcc.net/gallery/<year>/`, year → album, back to 2010) into `data/gallery{year}.json` (album metadata + pagination progress) + `data/gallery/{year}/<slug>.json` (per-album photo list). **The one exception to "every btcc.net image gets mirrored":** confirmed live 2026-08-28 (a bare `curl`, no browser/auth/special headers) that gallery photos are direct, PUBLIC (non-signed, non-expiring) Supabase Storage URLs on a different host entirely from btcc.net - unlike article/driver/circuit images, which route through btcc.net's own `/api/media/<uuid>` redirector and are confirmed blocked by its Vercel bot-challenge (see `scrape_articles.py`'s entry below), gallery photos never touch that origin at all, so the app hotlinks them directly. Each photo's large "display" variant is derived from its small "thumb" variant via a simple URL-suffix swap (`display_url()`) - same idea as this codebase's `wpThumb()`/`carThumbUrl()`, a different naming convention. **Resumable/incremental by page, not by photo, unlike every other scraper here:** both the year listing and each album's own photo grid paginate independently (`?page=N` - a single album can span many pages, e.g. Donington Park's 2026 album is 9), so each album tracks `lastPageScraped`/`totalPages`/`complete` and a run resumes any incomplete album's next unscraped page before starting a brand-new one - a routine run's cost is bounded by page loads, not image downloads. `match_round()` resolves an album to a round/venue by fuzzy-matching its slug/title against `calendar.json`'s venues, preferring the longest/most-specific match when one venue name is a literal prefix of another (confirmed live: round 1 "Donington Park" vs round 7 "Donington Park GP" - a title naming the GP layout explicitly is not a genuine tie) and returning `(None, None)` rather than guessing for a non-track event (season launch, TOCA Awards, a test day) or a genuine ambiguity (e.g. a bare "Brands Hatch" title against both "Brands Hatch Indy" and "Brands Hatch GP"). A round can have more than one published album (confirmed live: a main "2026 - Donington Park GP" album and a separately-published "The Captured Moments: Donington Park GP" one) - each resolved independently, both shown as separate tiles. Historical seasons (2010-2025) are deliberately **not** backfilled by the scheduled weekly run - see `scrape-gallery.yml`'s own comment; run `--season YYYY` manually at whatever pace is convenient. First live run (2026-08-28) found 13 real 2026 albums cleanly, no bot-blocks.

**Championship standings** (`parse_championship_pdf()`, called by `scrape_tsl.py` after every scrape) - parses the TSL championship PDF (`CHAMPIONSHIP_SUFFIX`, e.g. `ptstrg`) into `data/standings.json`. The PDF holds six distinct scored tables (Drivers, Manufacturers/Constructors, Teams, Independents' Teams, Independents' Trophy for Drivers, Jack Sears Trophy - `_CHAMP_SECTIONS`), each column-detected independently via its own header row. The **Independents' Trophy for Drivers** section was detected and parsed (it's in `_DRIVER_SECTIONS`) but never written into the output dict - fixed 2026-08-10, having gone unnoticed because the app's Results screen was papering over the gap by filtering the main Drivers' Championship array by `cls === 'I'` and just relabelling it "Independents", which happened to look plausible but showed the wrong points/wins (Sporting Regs §1.6.2.b scores the Independents' Trophy on the same finishing-position points table as the main championship, minus the pole/fastest-lap/race-leader bonus points - not a re-ranking of the main table). `standings["independents"]`'s own Wins/2nds/3rds columns are trusted as scraped (a class tally: best-placed independent per race) rather than overridden with the outright-finish tallies used for `standings`/`jst`, since those are a different metric. `Manufacturers/Constructors` was already being written to the JSON but the app-side parser (`parseStandings()` in `src/api/parsers.js`) never read it, so it also went unused until the same fix. `_parse_team_rows()` (used for the Teams, Manufacturers and Independents' Teams sections) runs its output through `_normalize_team_entries()` before returning - a mid-season team rename can leave the *source PDF itself* listing the same team twice in one table (real season total under the old name, a fresh zero-point row under the new one) while officials transition the change, not a parsing bug on our side. Hit live 2026-08-22 (Donington Park GP round 7): "Cataclean Plato Racing" (282pts) and "CPRL" (0pts) both appeared in the same Teams table, corrupting `data/standings.json` with a phantom last-place duplicate and briefly failing `liveDataConsistency.test.js`'s teams/standings cross-check. `TEAM_NAME_ALIASES` canonicalizes a known old name, and duplicate rows get summed and re-ranked into a contiguous points-descending `pos` sequence - same pattern as `scrape_team_stats.py`'s `TEAM_SLUGS` comment for the same rename on the drivers.json side. **Reversed 2026-08-22's merge, by request, 2026-08-28**: btcc.net's own site (and the TSL PDF) still show this exact same split weeks later - 282pts/pos 6 as "Cataclean Plato Racing" and 71pts/pos 10 as "CPRL", confirmed live - so it was never a transient rename-week artifact to normalize away. The app now deliberately mirrors the official split instead of hiding it: `TEAM_NAME_ALIASES` ships empty (kept, not deleted - the merge machinery still exists for a genuinely transient future duplicate, just with nothing configured today), `data/standings.json`'s `teams[]` was corrected by hand to match, and `liveDataConsistency.test.js`'s teams/standings cross-check gained a narrow `TEAM_NAMES_WITH_NO_CURRENT_DRIVER` allowance for this one specific known historical name (every individual driver's own `team` field still resolves to "CPRL" only, so this is the one legitimate case of a name appearing in `teams[]` with no driver to match it).

**Track lap records** (`update_calendar_records()`, called by `scrape_tsl.py` after every scrape) - compares each round's fastest `bestLap` (Qualifying for `qualifyingRecord`, fastest of Race 1/2/3 for `raceRecord`) against the stored record in `calendar.json` and overwrites only when genuinely faster. `lap_to_secs()` parses `"M:SS.mmm"` or bare `"SS.mmm"`, tolerating a trailing unit suffix (some older records were manually seeded as `"50.876s"`) - before 2026-08-09 it didn't, so `float(t)` raised on that suffix, silently returned `inf` for the *stored* record, and let literally any freshly-scraped lap overwrite it as a false "new record" regardless of whether it was actually faster (this hit Knockhill live in production; Silverstone's records carried the same `"s"`-suffixed formatting and would have hit the same bug at its own race weekend). `src/screens/TrackDetailScreen.js` has its own client-side `lapTimeSecs()` for a "live record" preview during a race weekend, fixed the same day - it previously required a colon (`"M:SS.mmm"`) and returned `null` for any bare-seconds record, which is how every short circuit (Knockhill, Brands Hatch Indy) actually stores its sub-two-minute times, so their live-record speed calculation silently never ran. **`bestLap` column bleed, fixed 2026-08-24:** `parse_classification()`'s BEST LAP x-range (`470 < x < 545`) was wide enough to also catch the AVG SPEED column TSL prints just to its left for race sessions (x≈477, mph, e.g. `"93.67"` - never itself captured into any field). A classified row always has both cells, so the wide lower bound only "worked" there by accident of pdfminer's element order; a non-classified/DNF row - which TSL doesn't compute a real best lap for after just 1-2 laps - has only the avg-speed cell, so it silently became the "best lap" instead. Donington Park GP round 7 recorded Daniel Rowbottom's Race 3 DNF as `bestLap: "83.35"` (his partial-stint mph) and it briefly became the circuit's `raceRecord`, displaying as a plain "83.35" on the Lap Records card instead of "M:SS.mmm" - the giveaway that something was off, since a genuine time always round-trips through `formatDate`-adjacent display code with its minute prefix intact. Narrowed to `495 < x < 545`, comfortably between the two columns and still catching genuine sub-minute race laps at Brands Hatch Indy/Knockhill (confirmed against real PDFs: both columns' x-position is unaffected by "M:SS.mmm" vs bare "SS.mmm" format). Along with the code fix, did a one-time correction of the 7 already-corrupted `bestLap` entries this had produced across rounds 1/4/5/6/7 (cleared to `""` - TSL genuinely has no best lap to show for those rows) and the 3 `raceRecord`s it had briefly won: round 1 (Donington Park) turned out to hold a genuine, previously-undetected 2026 improvement once the corrupted DNF entry was excluded (Ashley Sutton, `1:07.944`, beating the prior `1:08.011`/2025 record); rounds 5 (Thruxton) and 7 (Donington Park GP) reverted to their pre-corruption record, recovered from calendar.json's git history, since no genuine 2026 lap beat it.

**is_race_weekend.py** (`.github/scripts/`) - Gates `scrape-results.yml`'s actual scraping steps: the workflow is *invoked* every 2 minutes Sat/Sun 09:00-19:00 UTC regardless (via `triggerResultsScrape`, [§12](#12-firebase-cloud-functions) - GitHub's own `schedule:` trigger for this workflow never actually delivered that cadence, see that section), but each step only runs `if: steps.raceday.outputs.in_session_window == 'true'`. `compute_session_windows()` opens a `[start+15min, start+90min]` window per session by default. Grid-bearing sessions (`PRECEDING_SESSION` map: Qualifying Race ← Qualifying, Race 1 ← Qualifying Race, Race 2 ← Race 1, Race 3 ← Race 2) also open their window early, as soon as the preceding session's results are committed, through to the same `w_end` - per reg 3.4.1.a/b the grid is published as soon as the preceding session finishes, normally hours before the grid-bearing session's own start. Before this fix (2026-08-09), the window for e.g. Race 1's grid never opened until 15 minutes *into* Race 1 itself, so the official grid was never actually fetchable before the race started - the client-side "Predicted Starting Grid" fallback (see [§14](#14-starting-grid-system)) existed to cover exactly that gap, and still serves as the fallback for any case where the real grid is fetched late for other reasons (TSL delay, workflow hiccup, etc).

**is_day_after_race.py** (`.github/scripts/`) - Gates `scrape-penalties.yml`: checks whether yesterday was a round's `endDate` in `calendar.json` and, if so, outputs that round number (tested in `test_is_day_after_race.py`). Unlike `is_race_weekend.py` above, this doesn't need a per-session window - BARC's decisions are posted live during the sessions themselves (confirmed by their own timestamps), so by Monday morning everything from that weekend is already up.

**session_watcher.py** (`.github/scripts/`) - Connects to TSL's SignalR live-timing feed for a race day and reacts to `sessioncomplete` events: waits 3 minutes for the PDF, scrapes+commits, then sends that session's spoiler-specific results notification (e.g. "Race 1: Sutton wins"). Two real bugs found and fixed 2026-09-02, both discovered while checking whether the app's race-weekend pipeline was genuinely reliable ahead of round 8 (Croft):
- **Never dispatched, all season.** `race-day-start.yml`'s own `start_race_day.py` was reading `data/schedule.json`'s `saturday_date`/`sunday_date` fields to decide whether to auto-trigger this workflow - those fields never existed there (confirmed 100% failure on rounds 6/7's real race days via run logs). Fixed (`15d120bc`) to read `data/calendar.json`'s `startDate`/`endDate` instead, the same source `is_race_weekend.py` already used correctly.
- **Would have crashed immediately if it had been dispatched.** This script's own `load_sessions()` expected a `schedule.json` shape that no longer exists (`rnd["tsl"]`, `rnd["venue"]`, `rnd["sessions"]` as a dict keyed by day with `suffix`/`start_utc`/`notify_pre`/`is_q1`/`pre_label` per session) - the real file only has `round` + a flat `sessions` list of `{name, day, time}`, so `rnd["tsl"]` raised `KeyError` immediately, confirmed live, before any notification thread started (a clean failed Actions run, not live harm). Fixed (`d7558583`) to read `data/calendar.json` instead and derive `suffix` (from a small map matching `scrape_tsl.py`'s own `SESSION_SUFFIXES` - deliberately duplicated, not imported, since that script parses `sys.argv` at module level by design) and `start_utc` (via a new zoneinfo-based `session_to_utc()`, mirroring `functions/shared.js`'s `sessionToUTC` rather than a hardcoded BST offset).

The old pre-session "starting in 15 mins" alert (`PRE_TOPICS`/`pre_session_notifier()`) was removed entirely rather than repaired - its topic names (`pre_fp`, `pre_race1`, etc.) are identical to `sendSessionNotifications`' own `SESSION_TOPICS` (see [§12](#12-firebase-cloud-functions)), which already sends these reliably on a separate, always-running Firebase schedule; running both would have meant every pre-session alert arriving twice the first weekend this script's dispatch actually worked. The `is_q1`/`notify_results` partial-qualifying exception in `handle_session_complete` was also dropped - checked against the actual 2026 regulations PDF (no Q1/Q2 or split-qualifying anywhere in it) that the current 6-session format has no case it was ever handling; every session now gets its own results notification unconditionally. Not verifiable end-to-end without a live TSL SignalR connection during an actual session, so round 8 (2026-09-05/06) is this rewrite's real first test regardless of how carefully it's been checked otherwise.

**compute_records.py** - All-time records computer. Reads all bundled season JSONs (2004-2025) and the live `results{year}.json` file to compute every stat shown on the RecordsScreen (wins, podiums, poles, streaks, consecutive finishes, hat tricks, etc.). Preserves `historical: true` entries (pre-2004 era drivers) from the existing `records.json`. Writes `records.json`. Called automatically by `scrape_tsl.py` after each scrape. **Not standalone-safe:** it only knows about 2004+ timeline data, so running it alone temporarily reverts the official wins/championships overrides that `scrape_btcc_stats.py` applies for drivers active before 2004 (e.g. Jason Plato) - it self-heals at the next daily `scrape_btcc_stats.py` run, but don't run it in isolation and expect the result to be final.

**career_stats.py** - Manual driver history verification/regeneration tool (not run automatically by any workflow). `compute_year_standings(rounds)` computes one year's points/wins/podiums/poles/fastest laps/DNFs/position/champion directly from a season's raw round data (`src/assets/data/season_{year}.json` for 2004-2025, `data/results{year}.json` for the live season) - the same field-by-field ground truth used to regenerate `drivers.json`'s per-driver `history[]` arrays after they were found to have drifted from reality across 41+ driver-years. `normalize_name()` converts `results{year}.json`'s "Firstname SURNAME" convention (e.g. `Max BUXTON`) to the natural title case `drivers.json`/`season_{year}.json` both use (`Max Buxton`) - `get_driver()` checks `DRIVER_NAME_ALIASES` against the raw name first, since normalizing before the alias check mangles names like `Daryl DeLeon`. Includes a whole-round-blank DNF heuristic: if every one of a driver's races in a round shows `pos: 0, laps: 0`, the round was never entered (driver left the series) rather than three phantom DNFs. Run `--verify-champions` to cross-check that computed standings identify the correct champion for all 22 years (2004-2025) against an independently-curated `CHAMPIONS` dict.

**scrape_btcc_stats.py** - Weekly official-stats override pass. Fetches all-time wins (`btcc.net/history/statistics/drivers/`) and championship counts (`btcc.net/history/champions/btcc-titles/`) and patches them into `records.json` on top of whatever `compute_records.py` last computed - this is what makes pre-2004 career totals correct. The wins/titles content itself turned out to still be WordPress-migrated static text and Gutenberg tables even after the Vercel migration, so `parse_wins()`/`parse_titles()` needed no changes - only the fetch mechanism did. Runs Monday 06:00 UTC via `scrape-btcc-stats.yml` (dropped from daily - btcc.net's own dev confirmed results/standings only move on race weekends, so a weekly check reliably catches anything new).

**scrape_calendar.py** - Parses the BTCC calendar to update `calendar.json` with round dates and venues (internally calls `scrape_full_timetable.py` per round to populate support-series timetables into each round's `fullTimetable`). The calendar page's card order is **not chronological** (a grid/layout artifact on the live site) - rounds are sorted by parsed date before round numbers are assigned, rather than trusting encounter order. Also note: btcc.net abbreviates September to 4 letters ("SEPT") while every other month uses 3 - the date regex allows `{3,4}` specifically to avoid silently dropping September rounds (see `test_scrape_calendar.py`). Runs weekly (Monday 09:00 UTC via `scrape-calendar.yml`, immediately followed by `scrape_schedule.py` and `merge_schedule.py` in the same job) rather than daily - btcc.net's own dev confirmed the calendar "doesn't get updated often, once set at season launch kinda stays that way most of the time".

Fixed 2026-08-24 (live production bug): btcc.net's calendar page started rendering every event's `<a href="/circuit/...">` card twice (a responsive layout puts the same card in two DOM sections, one hidden by CSS depending on viewport, both present in the raw HTML this scraper's regex scans) - a routine Monday scrape parsed 20 "rounds" for a 10-round season. `merge_into_calendar()` writes by index into `calendar.json`'s fixed-length `rounds` list, so it silently overwrote rounds 2-10 with an earlier round's venue/dates in pairs (round 2 got round 1's "Donington Park"/18-19 Apr, round 4 got round 3's, etc.) and dropped the 5 real later rounds (Knockhill, Donington Park GP, Croft, Silverstone, Brands Hatch GP) entirely as "no existing slot, skipped" - shipped straight to `main` via `[skip ci]` auto-commit, reported by a user as "clicking a circuit in calendar loads a different circuit." Fixed by deduplicating scraped events on `(venue, startDate, endDate)` before assigning round numbers - two genuinely different rounds never share both the same venue and the same date range, so this can't merge two real events. Also hardened `merge_into_calendar()`: a round-count mismatch used to print a warning and still merge by index and still exit 0, which is exactly how this reached production undetected - `scrape-calendar.yml`'s failure-report step only runs `if: failure()`, so a warning-but-success run never alerts anyone. A mismatch now hard-fails (`sys.exit(1)`) instead, so bad data can never get committed and the existing alert actually fires. Re-ran the fixed scraper live to correct `calendar.json`/`schedule.json` on `main` immediately, rather than waiting for next Monday's cron.

**scrape_news.py** - Fetches the latest btcc.net article from the rendered `/news/` page and writes it to `news.json`. `id` is the article slug (WordPress numeric post IDs no longer exist post-migration; every consumer already treats `id` as an opaque string, so this is safe). Runs on `scrape-news.yml`'s 5-minute/hourly-overnight cadence (see §20) so `sendSessionNotifications` can read it from GitHub instead of hitting btcc.net directly. Title extraction tolerates (and strips) a nested inline tag around the title text - e.g. a "breaking" badge span - rather than hard-failing the whole scrape; hardened 2026-08-19 after "could not extract title/slug" recurred intermittently 7 times across ~9.5 hours the prior evening, not reproducible on demand. Only re-fetches the headline's image (via Scrapfly, ~225 credits) when the slug differs from what's already committed - fixed 2026-09-01, a real bug where this used to re-attempt the image capture on every single run regardless (harmless under the old free-per-page-render Playwright capture, expensive under Scrapfly's per-resource billing). Before attempting that fetch, `_archive_mirrored_image()` checks whether `scrape_articles.py`'s own full mirror (`data/articles/`, run right after this script in the same `scrape-news.yml` job) already has this exact slug's image from an earlier run - a free, reliable fallback that can't time out. Added 2026-09-02 after a run where this script's own image fetch kept hitting ordinary transient timeouts on a headline whose identical image had already succeeded and sat mirrored in the archive the whole time.

**scrape_articles.py** - Mirrors btcc.net articles in full (not just the single latest headline `scrape_news.py` tracks) into `data/articles/page_<n>.json` (PAGE_SIZE=20 each, must match `fetchArticles()`'s `perPage` in `src/api/client.js`) plus `data/articles/index.json` (slug → page number). Gets slug/title/excerpt/date/image for every card from the rendered `/news/` listing page, then fetches each article's own page for full body HTML - but only for slugs not already cached, so a steady-state run is typically 0-1 extra page loads, not a full re-fetch of every article. If a card's listing-page image is missing, that per-article page fetch also checks the page's own `og:image` meta tag as a fallback (added 2026-09-04 - see this section's other `scrape_articles.py` entry above for the full writeup). Each run's freshly-scraped cards are merged into the full previously-accumulated archive (not just replaced), then capped at MAX_ARTICLES=500 by date - this per-page split is what lets the app fetch one page's worth of data regardless of how deep the archive goes; an earlier version wrote one flat `articles.json` capped the same way, but that meant every fetch (list, search, or a single slug lookup) downloaded the entire archive's full content every time. `--backfill-pages N` crawls `https://btcc.net/page/2/` onward (page 1 is the bare `/news/` URL) for a one-off deep backfill (not for routine runs) - confirmed live 2026-09-01 this genuinely reaches real, chronologically-ordered content all the way to page 201 (~November 2013), once the real pagination URL was found (see §20's Scrapfly migration writeup - an older version of this scraper had been testing `/news/page/<n>/`, which 404s, and never actually reached past ~3 pages as a result). (The old WordPress `/feed/` RSS source this used for full content no longer exists post-migration.) Runs every 5 minutes in the same `scrape-news.yml` workflow as `scrape_news.py`.

**scrape_schedule.py** - Updates `schedule.json` with precise BTCC session start times (Free Practice/Qualifying/Qualifying Race/Race 1-3) for Cloud Function pre-session alert timing. Used to independently re-fetch every circuit page via `scrape_full_timetable.py` (duplicating the exact same fetches `scrape_calendar.py` already makes to populate `fullTimetable` - both workflows were hitting btcc.net for the same ~10 pages once a day each). Now a pure local transform of `calendar.json`'s already-scraped `fullTimetable` (`classify_btcc_sessions()`, tested in `test_scrape_schedule.py`) - makes zero network requests, and only runs as a step within `scrape-calendar.yml` right after `scrape_calendar.py`, not as its own workflow.

**scrape_youtube.py** - Associates YouTube race replay URLs with rounds in the results JSON.

**scrape_team_stats.py** - Fetches race/win totals per team from `btcc.net/team/<slug>/` and writes them into `data/drivers.json`. Used to run as a sub-step of every `scrape_tsl.py` invocation (every 2 minutes during a live race weekend), but that meant launching a headless browser on every tick just to re-check totals that only change once a weekend's results are final - now runs on its own weekly schedule via `scrape-team-stats.yml` instead (Monday 06:30 UTC, same reasoning as `scrape_btcc_stats.py` above). Used to also mirror each team's card-background graphic and car photo from `/teams/` into `cardBgUrl`/`carImageUrl` - that image-fetching code was stripped out 2026-08-18 (see below), leaving this script purely a stats scraper.

**scrape_circuit_images.py** - Manual, one-off mirror tool (not on any schedule). Fetches each circuit's hero photo from its `btcc.net/circuit/<slug>/` page and saves it into `data/media/tracks/`, repointing that track's `imageUrl` in `tracks.json` at the GitHub-raw-hosted copy. Needed because the new site serves this image from a private Supabase Storage bucket behind a per-request signed URL (expires within the hour) via btcc.net's own stable `/api/media/<uuid>` redirector - same mechanism the now-archived `scrape_driver_images.py` used to mirror for driver cutouts, just a different page/selector (`.circuit-profile-hero`'s `background-image` `url(...)` instead of an `<img src>`). `layoutImageUrl`/`raceImages` are deliberately not touched - every current track has a bundled SVG in `TrackDetailScreen.js`'s `BUNDLED_TRACK_LAYOUTS` that takes priority, and the race-photos carousel is never actually pushed into that screen's render list, so both are dead code regardless of URL validity. Brands Hatch GP is skipped - its `imageUrl` already points at `images.msv.com` (the circuit's own site) and still resolves.

**Archived 2026-08-18: scrape_driver_images.py, scrape_driver_cutouts.py, scrape_driver_backgrounds.py** - lived in `tools/scraper/`, now moved to `tools/scraper/archive/` (kept for reference, no longer run, dropped from `scrape-team-stats.yml`). Between them these live-scraped a driver's headshot (`imageUrl`), their bundled `src/assets/driver_images/<number>.webp` cutout, and their card-background graphic (`cardBgUrl`) from btcc.net. Replaced by a hand-curated set of official team/driver graphics committed directly into the repo - see "Hardcoded driver/team images" immediately below, and `tools/scraper/archive/README.md` for the full old-field → new-source mapping.

**Hardcoded driver/team images** - `data/driverImages/`, `data/carImages/`, `data/numberImages/` and `data/backgroundImages/` hold official team/driver graphics (headshot, side-on car cutout, branded number graphic, 1920x600 card background respectively). `numberImages/` stays named `<car number>`; team backgrounds use `<team-slug>`. `carImages/` was renamed `<car number>` → `<driver surname>` 2026-08-21 (e.g. `patterson.webp`, `halstead.webp`) - a car number was already 1:1 with a driver, but the surname makes it legible which specific driver's livery a file is, which matters now that `carImageUrl` is read per-driver rather than once per team (see the Grid/Merch/TeamDetail entries above). `driverImages/` got the same treatment 2026-08-25, for the same reason and using the same slugs `carImages/` already settled on (e.g. `driverImages/halstead.webp` sits alongside `carImages/halstead.webp`) - `getDriverImage()`/`getDriverImageLarge()` still take a car number as their argument (nothing in `DriversScreen`/`DriverDetailScreen`/`TeamDetailScreen` changed), only the `require()` path targets inside `driverImages.js` and the bundled file names moved. `19.webp`/Max Buxton and `132.webp`/James Dorlin (see below) were left numeric since there's no current driver record to slug them against. All four folders are WebP end to end as of the same date (only `numberImages/` still keeps a couple of tiny flat-graphic files as PNG, where WebP wasn't smaller) - the batch had been a mix of WebP and full lossless PNG at roughly double the size for the same picture, `numberImages/123.png` (Daniel Lloyd, a grunge-textured graphic rather than the flat silhouette style of its siblings) needed lossless WebP specifically since lossy actually made it bigger. Photo-like content (cars, headshots, gradient backgrounds) compresses far better lossy; flat vector-style graphics (most number badges) don't need converting at all and can even lose ground to lossy WebP if attempted. Referenced by `raw.githubusercontent.com` URL from `data/drivers.json`: driver-level `imageUrl`/`carImageUrl`/`numberImageUrl`/`cardBgUrl`, team-level `cardBgUrl`/`carImageUrl` (`attachTeamDisplayFields()` in `src/api/parsers.js` prefers a driver's own `cardBgUrl`/`carImageUrl` over their team's, same precedence for both fields - team-level `carImageUrl` is now purely that fallback, since no screen renders it directly any more; since 2026-08-28 that fallback only applies to a currently-racing driver, since `team.carImageUrl` is one specific active teammate's own numbered car, not a neutral team-wide image - correct as a stand-in for someone awaiting their own cutout, misleading for a departed driver who'll never get one, as James Dorlin's/Max Buxton's profile pages found showing Chris Smiley's/Ryan Bensley's cars respectively). `numberImageUrl` replaced the plain styled-text car number in `DriversScreen`/`DriverDetailScreen`/`TeamDetailScreen` (falls back to the old text rendering when absent). No scraper writes any of these four fields - swapping an image means committing a new file under the same name (or repointing the URL in `drivers.json` if the name changes), no code change or app release needed. Adding or replacing a `carImages/` file specifically also needs `python3 scripts/generate_car_thumb.py` re-run for it - it now generates two derived variants, not one: the plain `-thumb.webp` `TeamDetailScreen` requests (padding intact, on purpose - its sponsor logo overlay relies on it) and the cropped `-thumb-crop.webp` `DriverDetailScreen`'s banner requests (see that screen's entry above for the full story of why two, not one). A missing variant 404s the same way a missing full-size file used to. `driverImages/` has its own equivalent: `python3 scripts/generate_driver_bundle.py` re-run after adding or replacing a file, which regenerates the actual bundled asset `getDriverImage()` requires - `src/assets/driver_images/<driver-surname>.webp` - from the `data/driverImages/` source (unlike `carImages/`, this isn't fetched over network, so a stale bundled copy doesn't 404, it just silently keeps showing the old photo). This script itself is new (2026-08-21) - `src/assets/driver_images/` had been shrunk to 300x450 at some undocumented point in the past, fine while the driver photo only ever rendered as a small tile badge, but once the tile gave the photo its full height and the profile header gave it the full screen width (both this same session), that 300px source was rendering at up to a ~2.5x upscale on a typical phone - visibly blurry, confirmed by the difference before/after regenerating from `data/driverImages/`'s already-close-to-right-sized 683x1024 originals. Two bundled files (`19.webp`/Max Buxton, `132.webp`/James Dorlin, both departed mid-season) have no `data/driverImages/` counterpart to regenerate from and are left as the old 300x450 versions - not touched by this fix, since there's nothing to regenerate them from. Root-caused live 2026-08-28: `driverImagesLarge` had skipped these same two numbers entirely on the assumption `DriverDetailScreen`'s `imageUrl` fallback covered it, but that fallback is a dead `btcc.net` `wp-content/uploads` hotlink now permanently 429'd by Vercel's bot mitigation - it showed `CachedImage`'s broken-image icon on their profile header instead of a photo. Fixed by copying their existing `driver_images/{19,132}.webp` (the 300x450 versions above) straight into `driver_images_large/` unmodified rather than regenerating - there's still no higher-res source to regenerate from, but reusing the small file directly beats a broken icon - and nulling `imageUrl` for both in `drivers.json`, since that fallback can now never resolve. `DriverDetailScreen`'s `imageUrl` `CachedImage` also gained a `fallback` prop so this failure mode (a dead network photo for whichever driver currently lacks a bundled one) degrades to no photo shown rather than a broken-image icon if it recurs for anyone else. Nick Halstead's headshot/car gap (both `driverImages/55.webp` and `carImages/halstead.webp`, the latter confirming his mid-season car carries a separate "Ask GVT" livery from teammate Dexter Patterson's) was filled 2026-08-21; Senna Proctor (reserve-only, no seat of his own) remains the one gap.

Four `carImages/` files (`bensley.webp`, `gilbert.webp`, `halstead.webp`, `sutton.webp`) were replaced 2026-08-21 with genuinely higher-resolution sources the user had on disk, after `DriverDetailScreen`'s car banner was reported "still blurry" - checked before assuming the rest of the 23 needed the same treatment: every other file in the offered source folder turned out to be the *exact same* 1536x1024 render already in the repo, just re-saved as PNG instead of WebP (confirmed via matching `getbbox()` output pixel-for-pixel against the already-committed file, not just eyeballed), so swapping those in would have changed nothing. Only these four were real upgrades (2048x1365-6000x4000, confirmed sharp via a cropped detail region showing genuine photographic texture, not just a bigger canvas). `scripts/generate_car_thumb.py` re-run for just these four regenerates both derived variants from the new source; the other 19 drivers' cars, including the one most tested during this whole feature's development (De Leon), remain as soft as the original source they were always generated from - fixing those needs an actual higher-resolution photo from somewhere, not a reprocessing trick.

`driverImages/bensley.webp` (Ryan Bensley) and `gilbert.webp` (Lewis Gilbert) are genuine half-body source photos (683x854, not the 683x1024 every other driver's headshot is) - fixed 2026-08-21 by padding transparent space above the head to reach the full 683x1024 canvas with the existing content bottom-aligned, then regenerating both bundled `src/assets/driver_images/{bensley,gilbert}.webp` from that corrected source. Previously the shorter canvas rendered as a half-body photo floating vertically centered in `DriversScreen`'s tile and `DriverDetailScreen`'s header (both `resizeMode="contain"`, which centers by default) rather than anchored to the bottom edge like every full-body photo - visible as an odd hard crop-line mid-tile rather than a clean cutout against transparent background. Padding doesn't add missing leg/feet content (there isn't any to add), it just repositions what exists to sit where a full-body photo's feet normally would, matching how every other driver's headshot already behaves in both places.

**merge_schedule.py** - Merges scraped session times from `schedule.json` into `calendar.json`. Run after `scrape_schedule.py`, both as steps in `scrape-calendar.yml`'s own job (the standalone `scrape-schedule.yml` workflow was folded into it 2026-08-02 and no longer exists).

**build_team_map.py / backfill_team_names.py** - One-off historical data-migration tools, not on any schedule. `build_team_map.py` regenerates `team_name_map.json` from `drivers.json`; `backfill_team_names.py` uses that map to resolve car-model strings into real team names across `results2014.json`-`results2023.json`. Re-run manually only when historical driver/team data changes.

---

## 21. Admin Interface

**File:** [admin/standings-admin.html](admin/standings-admin.html)

Hosted at https://yacobwood.github.io/BTCC/admin/standings-admin.html

A single-page web admin UI with tabs for:

- **Standings** - Update driver and team championship standings in `standings.json`
- **Notifications** - Send broadcast notifications, test notifications to a single device, compose news article deep-link notifications
- **Flags** - Edit all feature flags and per-device overrides in `flags.json`. Includes `broadcaster_override` (uk/international/us) which bypasses IP geolocation on a specific device.
- **Live** - Edit Saturday and Sunday live stream URLs per region (UK, International, US) in `live_urls.json`. Watch Live button only shows when a URL is set for the user's region and day.
- **Hub News** - Compose and publish hub news posts to `hub_news.json`
- **Digests** - Manually trigger the AI digest generation via `triggerDigest` Cloud Function
- **Analytics** - GA4-backed charts sourced from the `analytics_history`/`analytics_daily_history` Firestore collections (populated weekly by the `exportAnalyticsHistory` Cloud Function, or on-demand via the panel's "Refresh now" button which calls the `refreshAnalyticsHistory` Cloud Function): daily/weekly user trends, engagement quality (avg session duration, engagement rate, bounce rate, page/screen views), top acquisition sources, platform/OS breakdown, a UK city-level "where users are browsing from" breakdown (`ukCities`, filtered to `country == United Kingdom`, top 10 cities by active users), app version adoption (which build active users are on - the direct read on release rollout), a top-events leaderboard (every distinct event name by volume, doubling as the source for the donor-gate and widget-adoption funnels below rather than 2 more GA4 calls), screen popularity, and 5 event-parameter breakdowns (share-by-content-type, onboarding choice, notification opt-in/out by type, most-favourited drivers, top search terms) that each need a one-time custom dimension registered in GA4 Admin first - see the comment atop `exportAnalyticsHistory` in `functions/analytics.js` for the exact parameter names and steps. Every report runs through `Promise.allSettled` so one bad/unregistered dimension degrades only that card instead of losing the whole week's export.

All writes go directly to the GitHub repository via the GitHub API (authenticated with a personal access token stored locally in the browser).

---

## 22. Test Suite

**Runner:** Jest 29 + `@testing-library/react-native` 13

**Config:** [jest.config.js](jest.config.js) / [jest.setup.js](jest.setup.js)

Run with: `npm test`

### Coverage

The test suite covers all major stores, utilities, components and screens. Key files:

| Area | Test file |
|---|---|
| API parsers | `__tests__/api/parsers.test.js` |
| API client | `__tests__/api/client.test.js` |
| Auth store | `__tests__/store/auth.test.js` |
| FeatureFlags store | `__tests__/store/featureFlags.test.js` |
| Settings store | `__tests__/store/settings.test.js` |
| FavouriteDriver store | `__tests__/store/favouriteDriver.test.js` |
| Cache store | `__tests__/store/cache.test.js` |
| Radio store | `__tests__/store/radio.test.js` |
| Units store | `__tests__/store/units.test.js` |
| Notification navigation | `__tests__/navigation/notifNavigation.test.js` |
| AppNavigator | `__tests__/navigation/AppNavigator.test.js` |
| All screens | `__tests__/screens/*.test.js` |
| All components | `__tests__/components/*.test.js` |
| All utils | `__tests__/utils/*.test.js` |
| Data integrity | `__tests__/data/seasonDataIntegrity.test.js` |
| Firestore rules | `__tests__/firestore.rules.test.js` |

### Key Testing Notes

- `formatDriverName('Tom Ingram')` returns `'Tom INGRAM'` - always use the formatted name in assertions
- `SwipeableTabs` is mocked to render all pages at once in ResultsScreen tests
- `CommonActions.reset()` is used in notifNavigation - not `navigate()` for nested screens
- `jest.mock` factory variables must be prefixed with `mock` (e.g. `mockDbOn`) to avoid babel-jest hoisting TDZ errors
- When mocking a module that exports both a provider and a hook, always spread `jest.requireActual()` so `AllProviders` still has the real provider
- `useAuth` is not in `AllProviders` - mock it directly in screen tests with `jest.mock('../../src/store/auth', ...)`
- Auth modal uses magic link (passwordless) - the submit button has `accessibilityLabel="Send magic link"`; after sending it shows a "Check your inbox" confirmation state

### Untested Areas

- Actual audio playback (TrackPlayer native layer)
- Firebase Cloud Functions (manual testing via admin page)
- End-to-end notification cold-start deep-link flow

---

## 23. Build and Release

### Development

```sh
npm start              # Start Metro bundler
npm run android        # Run on Android emulator/device
npm run ios            # Run on iOS simulator/device
npm test               # Run Jest test suite
npm run lint           # ESLint
```

### iOS

```sh
bundle install         # Install CocoaPods (first time only)
bundle exec pod install  # Install native iOS dependencies
```

Build and archive from Xcode for App Store submission.

### Android

```sh
cd android && ./gradlew bundleRelease   # AAB for Play Store
```

Signing key: `btccfanhub.jks` (project root, keep secret).

### Fastlane

Fastlane is configured in [fastlane/](fastlane/) for automated builds and metadata management.

### Version Bump Process

1. Update `version` and `versionCode` in [package.json](package.json) - Android's own `versionCode`/`versionName` in `android/app/build.gradle` read directly from these two fields at build time (`packageJson.versionCode`/`packageJson.version`), so nothing there needs a manual edit. iOS is separate and currently dormant (pulled from the App Store, see below) - its equivalents (`MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`) live in `ios/BTCCFanHub.xcodeproj/project.pbxproj`, not `Info.plist` (which only references those build settings by variable, `$(MARKETING_VERSION)`/`$(CURRENT_PROJECT_VERSION)`), and haven't been bumped since it was pulled.
2. Update `SettingsScreen.test.js`'s `raceVersionLabel()` assertion (`Season {major} · Round {minor} · Lap {patch}`) to match the new version - the test's own comment flags this explicitly rather than silently going stale.
3. Update Fastlane metadata - `fastlane/metadata/android/en-GB/changelogs/{versionCode}.txt`. **Keep it under 500 characters** - Google Play's actual current limit for release notes per language (confirmed live, not assumed). Found live 2026-08-29: 4 of the last 8 changelogs committed here (84/85/87/88) already exceed it, apparently never caught because none had been through an actual Play Console upload yet at commit time.
4. Rebuild native bundles (`cd android && ./gradlew bundleRelease`) and commit

**Release nickname (added 2026-08-25):** SettingsScreen shows a display-only "Season {major} · Round {minor} · Lap {patch}" subtitle under the real version number (`raceVersionLabel()`), mapped onto the app's own Season → Round → Lap hierarchy. Purely cosmetic - the real semver above it is still what App Store Connect/Play Console/Gradle actually use, and still gets bumped exactly as described above.

---

## 24. Deep Linking

Configured in `AppNavigator.js` under the `linking` object.

| URL scheme | Maps to |
|---|---|
| `btccfanhub://news/slug-here` | Article screen |
| `btccfanhub://round/5` | TrackDetail for round 5 |
| `btccfanhub://live-timing/event-id` | LiveTimingScreen |
| `btccfanhub://drivers/driver-slug` | DriverDetail |
| `btccfanhub://results/5` | RoundResults for round 5 |
| `btccfanhub://results` | ResultsList (Season tab) - added 2026-08-25 so the standings share button had a bare-`/results` target to link to; only `results/:round` existed before |
| `btccfanhub://gallery/2026/donington-park-gallery/3` | GalleryAlbum, auto-opening `PhotoLightbox` at photo index 3 once the album loads (added 2026-08-29 for the photo share button) - `photoIndex` is optional (`gallery/:season/:albumSlug/:photoIndex?`), a link with no index still opens the album grid correctly. Unlike `results/:round`, this needs no custom `getStateFromPath` branch: `GalleryAlbumScreen` fetches its own data straight from `season`/`albumSlug`, it doesn't need a pre-resolved object handed down from a parent screen's already-loaded state |
| `https://btcchub.vercel.app/...` | Same routes via universal links |
| `https://btcchub-af77a.firebaseapp.com/...` | Magic link auth completion (handled in `AuthProvider`) |

Notification deep links use the `data` payload fields (`type`, `slug`, `round`) mapped in `notifNavigation.js`.

Magic link auth links are intercepted in `AuthProvider` via `Linking.getInitialURL()` (cold start) and `Linking.addEventListener('url', ...)` (warm start). The pending email is stored in `AsyncStorage` under `magic_link_pending_email` between the user requesting the link and tapping it. If the current user is anonymous, `linkWithCredential` upgrades the existing account rather than creating a new one. The auth modal in `SettingsScreen` auto-closes when `isAnonymous` changes to `false` via a `useEffect` dependency on the context value.

**Email flow:** The `sendMagicLinkEmail` Cloud Function generates a plain Firebase action URL (`/__/auth/action?mode=signIn&oobCode=...`) with no `handleCodeInApp`/Dynamic Links wrapper (Firebase Dynamic Links were shut down August 2025). The button in the email links directly to `btcchub-af77a.firebaseapp.com` - Firebase automatically serves `assetlinks.json` for that domain, so the verified App Link intercepts the tap in Gmail's Chrome Custom Tab and opens the app. `isSignInWithEmailLink` is `await`ed (it is async in the native bridge); without `await` the Promise is always truthy and sign-in is attempted for every URL.

---

## 25. Known Architecture Decisions

**No page transition animations** - `animation: 'none'` is set globally in `screenOptions`. This is intentional for performance and must not be changed.

**`CommonActions.reset()` for nested deep links** - `navigate()` into a nested stack only works when the stack is already mounted. `reset()` sets the full navigation state tree directly and works at any lifecycle stage including cold start.

**stale-while-revalidate everywhere** - The app always shows something immediately (cached data) and refreshes in the background. This is the primary UX pattern for all data fetching.

**Both of `fetchJson`'s stale-cache reads are age-bounded, not just the happy path** - `peekArticlesCache()` (used by `NewsScreen`'s Phase 1 instant-render before the Phase 2 network fetch) only returns a cached page-1 snapshot younger than `ARTICLES_MAX_AGE_MS` (5 minutes, matching the scraper's own refresh cadence); past that age `NewsScreen` falls through to its normal spinner instead. `fetchJson`'s own `staleFallback` catch-path (used when the live fetch itself throws - e.g. `forceRefresh=true` callers like Phase 2, or any pull-to-refresh, which skip the age-checked branch entirely and land straight here on failure) is bounded the same way, rather than "any cached value, even expired." Both exist to close the same underlying symptom: a cache older than one scrape cycle is likely to already have a different top-of-feed order than the live mirror, and showing it - whether via the instant-render path or the network-failure fallback - only to have it replaced by a re-ordered hero/grid a moment later reads as a visible bug ("flash of different articles") rather than a perceived-performance win. Every current `staleFallback` caller (`fetchCalendar`, `fetchDrivers`, `fetchStandings`, `fetchResults`, `fetchBlacklist`, `fetchMerchStores`, `fetchPartners`, `fetchRecords`, the articles endpoints) either has its own bundled-JSON fallback or a call site that already `.catch()`s/`try`s around it, so bounding this catch-path uniformly across all of them doesn't introduce a new unhandled rejection anywhere - confirmed by reading every call site, not assumed.

**`fetchArticlesPage`'s own catch used to defeat `fetchJson`'s error/staleFallback handling entirely** - found live 2026-09-03 from a user report of a broken-looking News tab on slow wifi. `fetchJson` already does the right thing on a genuine fetch failure (tries a bounded-age stale cache, only re-throws if that's also empty), and `NewsScreen.js`'s own `load()` already has real handling built for that throw (Phase 1's `shownStale` check, an `error` state, a Retry button). But `fetchArticlesPage` wrapped its own call to `fetchJson` in a second try/catch that silently swallowed *any* error - network failure, JSON parse error, anything - into a plain `[]`, indistinguishable from "nothing's published yet." Reproduced directly on the Android emulator (confirmed the actual thrown error was `TypeError: Network request failed`, not a slow-but-eventually-successful fetch): with `fetchHubPosts()` succeeding independently (its own 5-minute cache, unaffected), the News tab rendered only the Flying Lap/Academy banner row - fed entirely by `hubPosts`/`explainerCount`, unrelated to the failed articles fetch - above a permanently blank feed, with no spinner, no error text and no Retry button, because `NewsScreen`'s `error` state never got set at all. Fixed by giving `fetchArticlesPage` a `propagateError` parameter: `true` for the primary list fetch (what `fetchArticles`'s non-search branch, and therefore `NewsScreen`, calls), so a genuine failure reaches the caller's existing handling; left `false` (the default) for search's multi-page fan-out, where one page's transient failure reasonably still shouldn't sink the whole search. Verified live end-to-end: forcing a real `fetch()` failure now shows "Network request failed" with a working Retry button instead of the silent banner-only screen.

**GitHub as CDN** - `raw.githubusercontent.com` serves all data files. This is free, fast and allows the admin web UI to update data by committing to the repository without a traditional backend.

**`forceRefresh` must defeat the CDN cache, not just the app's own cache** - `raw.githubusercontent.com` sends `Cache-Control: max-age=300` (confirmed live 2026-08-22), so a plain `fetch(url)` can be served from a Fastly edge cache for up to 5 minutes after a commit, independent of anything the app does locally. Before this fix, `fetchJson`'s `forceRefresh` flag only skipped the on-device `cacheRead` step - the actual network request still used the bare URL, so it could still return the exact same stale response a "forced" refresh was meant to bypass. Root-caused via a live incident (Ingram's Donington Park FP article): `functions/newsCheck.js`'s mirror gate (`mirroredImageUrl`, named `isSlugMirrored` at the time of this incident) and `ArticleScreen`'s own silent auto-retry (see [§6](#6-screens-reference)) both already existed and both worked as designed - `news.json` and the `articles/index.json` mirror committed only 103 seconds apart, well inside a single CDN cache lifetime for that URL - but neither one guarantees the *requesting device's own* edge node has picked up the new commit, since the gate's check and the phone's fetch are two independent requests that can land on two different edges with two different 5-minute clocks. Fixed by having `fetchJson` append a `_cb=<Date.now()>` query param whenever `forceRefresh` is true, the same cache-busting approach `fetchHubPosts()` already used for `hub_news.json` - a unique URL per request can never be served from an existing cache entry. Applies to every current `forceRefresh` caller (`fetchArticleBySlug`/`fetchArticlesIndex`/`fetchArticlesPage`, `fetchCalendar`, `fetchStandings`, `fetchResults`, `fetchRecords`), not just articles.

**Platform-split radio** - iOS uses `react-native-track-player` for background audio. Android uses a native Java `RadioService` NativeModule because React Native's background capabilities differ significantly between platforms.

**Firestore for user-generated content** - Chat, comments, reactions, bug reports and roadmap votes are stored in Firestore rather than GitHub, as they require write access from untrusted clients with per-document security rules.

**`android:extractNativeLibs="true"`** - AGP 8.x injects `extractNativeLibs="false"` by default, which loads `.so` files directly from the APK zip. This caused a recurring Crashlytics crash (`couldn't find DSO to load: libreactnative.so`) on a subset of Android devices (Samsung/OEM and sideloaded APKs). The app manifest explicitly overrides this to `true` so native libs are extracted to disk on install, making them reliably available to SoLoader on all devices.

**FCM topics not tokens** - All notification subscriptions use named topics managed client-side in `SettingsProvider`. This avoids maintaining a server-side device registry and allows instant opt-in/out without a backend call.

**Spoiler-free expiry on app open** - The mode auto-disables on the next app open after expiry rather than at the exact expiry time. This is simpler and avoids background timer management.

---

*This document is kept up to date with every code change. Last updated: 2026-08-24*
