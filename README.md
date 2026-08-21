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
15. [Feature Flags](#15-feature-flags)
16. [Design System](#16-design-system)
17. [Shared Components](#17-shared-components)
18. [Utility Modules](#18-utility-modules)
19. [Python Scrapers](#19-python-scrapers)
20. [Admin Interface](#20-admin-interface)
21. [Test Suite](#21-test-suite)
22. [Build and Release](#22-build-and-release)
23. [Deep Linking](#23-deep-linking)
24. [Known Architecture Decisions](#24-known-architecture-decisions)

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

Current version: **2.20.7** (versionCode 85)

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
| News source | GitHub-mirrored btcc.net article snapshot (`data/articles/page_<n>.json` + `index.json` - see [§19](#19-python-scrapers); btcc.net is now a Vercel-hosted React app with no public REST API, so the app never hits it directly) |
| Podcast source | Buzzsprout RSS |
| Weather | Open-Meteo (free, no API key) |
| Live timing | TSL SignalR |
| Radio (iOS) | react-native-track-player |
| Radio (Android) | Native RadioService NativeModule |
| Charts | react-native-svg |
| WebView | react-native-webview |
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

**ResultsStack:** ResultsList → RoundResults → Records

**MoreStack:** MoreMenu → Settings → InfoPage → BugReport → Listen → Radio → Podcasts → Records → Partners → Roadmap → TocaRadio

### 5.3 Global Settings

All screens use `animation: 'none'` - no page transition animations. This is deliberate and must not be changed.

### 5.4 Tab Press Behaviour

`useResetStackOnTabPress` hook is registered in every stack root. When the user taps a tab they are already on, it resets that stack to its root screen (clears any nested navigation).

### 5.5 Ad Banner

`AdBanner` is positioned below the tab bar and gated behind the `banner_ad` feature flag (default `false`). When the flag is off the container is not rendered at all, keeping `ChatFab`'s `bottomOffset` clean. When on, the banner stays hidden until the first ad loads (`loaded` state starts `false`) to prevent the empty container from flashing before the ad arrives. `BannerAd` manages its own refresh timer internally - no manual `.load()` calls are needed.

---

## 6. Screens Reference

### News Stack

**NewsScreen** ([src/screens/NewsScreen.js](src/screens/NewsScreen.js))
Combines two feeds: official btcc.net articles (from the GitHub-mirrored `data/articles/page_<n>.json` snapshot - see [§19](#19-python-scrapers); btcc.net is a Vercel-hosted React app with no public REST API, so the app never hits it directly) and curated hub posts (from `hub_news.json` on GitHub). Features: search with debounce (fetches every mirrored page and filters client-side by title/content, not a live btcc.net search - see §8's `fetchArticles` row for why that's a deliberate one-off cost only paid when actually searching), pagination (each page a separate ~20-article fetch, so scrolling deep into the archive doesn't cost more per page than scrolling the first one), hideDigests filter toggle, real-time Firestore reactions (emoji voting). Hub news requires `hub_news_enabled` feature flag. Article cards show category, date and featured image. Favourite driver highlighting applied when a driver's name appears in article title.

**ArticleScreen** ([src/screens/ArticleScreen.js](src/screens/ArticleScreen.js))
WebView article reader for btcc.net articles. Adds Firestore comments (with commenter name input and optimistic posting), like/dislike reactions, a view counter, share button and external link option. Tracks scroll depth for Firebase Analytics. Accepts either a full article object or just a `slug` parameter (resolved via `data/articles/index.json` to find which page file actually holds it, if needed). If the slug isn't found (e.g. a just-published article the mirror hasn't picked up yet in its 5-minute refresh cycle) or the lookup fails, shows a "Couldn't load this article" retry state instead of spinning forever - but only after the very first automatic (mount-triggered) load has already gotten one immediate, cache-bypassing silent re-attempt, since a notification can fire before the slower article-mirror commit lands and the on-device cache can still be serving that pre-commit snapshot of the index for up to 5 minutes (same race the manual Retry button already accounted for below; root-caused live via device trace 2026-08-13 - an earlier version of this auto-retry re-read the same stale cache instead of bypassing it, so it reliably missed twice). Manual Retry-button presses don't get a second silent layer stacked on top. The initial load reads the index's normal 5-minute cache, but both the silent auto-retry and the manual Retry pass `forceRefresh=true` all the way through `fetchArticleBySlug` so neither can just replay the same cached miss. Signed-in users can edit and delete their own comments - edit uses Firestore REST PATCH with `updateMask.fieldPaths` to update only `text` and `editedAt` without touching reactions. Edited comments show an "edited" label. Delete uses Firestore REST DELETE and removes the item from local state optimistically. View count lives in `article_views/{slug}` (mirrors the `article_reactions` increment pattern: a Firestore `:commit` transform with `fieldTransforms: [{fieldPath: 'views', increment: 1}]`). Every WebView load records a view and re-fetches the total, shown next to the reaction buttons - no dedup, so the same person re-opening the article counts each time by design. A "Source: <link>" line renders at the bottom of the article body (`buildHtml()`, exported for direct unit testing) - hub posts show their own explicit `sourceUrl` verbatim (e.g. a credited Reddit thread), regular btcc.net-scraped articles fall back to a clean "btcc.net" label linking to `article.link`. Tapping it opens the system browser, not the in-app WebView (`onShouldStartLoad` only allows same-window navigation to the bare btcc.net root).

**DigestsScreen** ([src/screens/DigestsScreen.js](src/screens/DigestsScreen.js))
Lists AI-generated weekly digest articles from hub_news.json filtered to the Weekly Digest category.

### Calendar Stack

**CalendarScreen** ([src/screens/CalendarScreen.js](src/screens/CalendarScreen.js))
Renders all rounds from `calendar.json`. Highlights the current/next active round. Tapping a round navigates to TrackDetail.

**TrackDetailScreen** ([src/screens/TrackDetailScreen.js](src/screens/TrackDetailScreen.js))
Hero image, Open-Meteo weather widget (gated on `track_weather` flag), track facts (length, corners, first BTCC year), About section, BTCC Fact, session schedule with day/time, lap records (qualifying + race), YouTube race replay links (gated to UK users only via locale check), and a UK map pin showing circuit location. A "Live Timing" button appears during active race weekends when `tslEventId` is set and the flag is enabled. An expandable "Show full weekend timetable" toggle inside the schedule card shows all support series (Porsche Sprint Challenge, MINI CHALLENGE, Scottish Legends etc.) alongside BTCC when `fullTimetable` is populated in `calendar.json` for that round.

The weather widget defaults to a daily summary (one card per race-weekend day) and refetches every 5 minutes plus on app foreground (`WEATHER_POLL_INTERVAL_MS`) so it stays current through a live weekend, not just on first load - `fetchWeather()`'s own cache is 30 minutes, so most polls are cheap cache hits, they just shorten how long a fresh forecast takes to reach the screen. When hourly data is available a "Daily / By session" toggle appears (same segmented-control pattern as the full-weekend-timetable toggle): "By session" cross-references `track.sessions` against the hourly forecast to show a weather chip for each BTCC session's actual start time, rather than one vague summary for the whole day - the 3 session tiles per day stretch evenly across the row (`flex: 1` each), not a scrollable row, since there are always exactly 3 BTCC sessions per day. An "unfold-more" icon next to the toggle (visible only in "By session" mode) expands every chip with extra detail - feels-like temperature, wind speed/gusts with an 8-point compass direction (`windDirectionCompass()`), humidity and cloud cover - all fetched unconditionally alongside the existing hourly fields (no separate API call) but only rendered when expanded.

**LiveTimingScreen** ([src/screens/LiveTimingScreen.js](src/screens/LiveTimingScreen.js))
WebView embedding the TSL live timing interface. Only rendered when `live_timing_in_app` feature flag is true.

### Grid/Drivers Stack

**DriversScreen** ([src/screens/DriversScreen.js](src/screens/DriversScreen.js))
Two-tab view: Drivers (card grid with number, photo, team and car class - the driver's own car livery lived here too for a while, see below for why it moved to the profile page) and Teams (team cards showing just the sponsor logo). Drivers can be starred as favourites. Tapping navigates to DriverDetail or TeamDetail. A driver whose `currentlyRacing` field in `drivers.json` is `false` (e.g. moved out of their seat mid-season to a reserve/development role) drops out of the main "N CONFIRMED" grid into a separate "NOT CURRENTLY RACING · RACED IN 2026" section below it, and is excluded from their last team's driver roster on TeamDetailScreen - kept visible rather than deleted, since they did race that season.

A driver card's `carImageUrl` (added 2026-08-21) was originally shown on the tile too - the driver's own resolved car, not a shared team image, since a team can field more than one livery (Steel Seal with Power Maxed Racing's Dexter Patterson and Nick Halstead each have their own separately-branded car, Halstead's mid-season "Ask GVT" livery confirmed by an official photo). Removed from the tile entirely later the same day, by request, in favour of giving the driver photo the tile's full height instead - `driverPhoto`'s `height` 85% -> 100%, width initially staying at 60% and left-aligned (`driverImageArea`'s `alignItems: 'flex-start'`) so it didn't compete with the top-right number - later widened to `100%` and re-centered (`alignItems: 'center'`) once that left-alignment had no remaining reason to exist, matching `DriverDetailScreen`'s header being reverted to centered the same way. The car itself now only shows on the driver's own profile page (`DriverDetailScreen`, see below) - with 23+ drivers on one grid there's no good way to show a car properly at tile size anyway, and the profile page is where a bigger, dedicated showcase actually fits. Worth keeping as history for how the tile got here: it went through four layout passes before removal - an absolutely-positioned bottom-left badge overlapping the photo (fine small, but a visible collision with the driver's own legs/feet once sized up), a dedicated full-width strip below the photo (avoided the collision, but made every tile noticeably taller), an upright bottom-right corner badge (`driverCarImg`, 50%/33%) that avoided both but capped how large the car could get, and finally a -90 degree rotated vertical strip (`driverCarSide`/`driverCarSideImg`) that let it grow bigger within the same footprint - superseded by removing it outright once it became clear the tile just isn't the right place to showcase 23 different cars at once. Team cards dropped the car cutout entirely for the same underlying reason - a single "representative" car on a team tile would just be misleading once more than one livery exists under that team - and instead show the sponsor logo (`logoUrl`) large and centered, filling most of the tile rather than a small top-right badge. Teams with no logo file yet (e.g. CPRL as of 2026-08-20) simply render without one - no placeholder. `MerchScreen.js`'s tiles use the identical large/centered `teamLogoImgLarge` treatment for parity (see below).

The tile's top-right number went through its own separate fix (2026-08-22): the branded number-graphic replacement (`driverNumberImg`, used for 22 of 23 drivers) originally sized itself with a fixed `width`/`height` box (`45%`/`36%`), letting `resizeMode="contain"` decide per-file which axis to letterbox depending on how each number's own real aspect ratio compared to that box's - single/double-digit numbers (aspect ratio close to or narrower than the box's) filled the box's full height and touched the tile's top edge, while most 2-3 digit numbers (noticeably wider files) got letterboxed vertically instead, leaving a gap above - "some numbers touching top, some not," confirmed by checking every file in `data/numberImages/`'s actual aspect ratio rather than guessing. Replaced with `NumberBadge`, a small component that measures the image's own aspect ratio via its `onLoad` event (`nativeEvent.source.width`/`height`) and sizes itself off that instead - fixed height, width computed via `aspectRatio` to match - so every number fills the same height and sits flush at the same top-right corner regardless of how wide or narrow its own graphic happens to be. `driverNumberImg`'s style lost its `width` entirely as a result; only `height: '36%'` remains, with `aspectRatio` applied per-instance.

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
Year selector (2004 - 2026) via `YearWheelPicker` modal. Four tabs:
- Drivers Standings - position, points, wins, 2nds, 3rds
- Teams Standings - points by team
- Season Table (`SeasonTable` component) - race-by-race result grid with DSQ/Ret/DNS/FL/PP badges
- Progression Chart (`ProgressionChart` component) - SVG line chart of points accumulation per round

**RoundResultsScreen** ([src/screens/RoundResultsScreen.js](src/screens/RoundResultsScreen.js))
Per-round detail. `SwipeableTabs` with lazy loading across all sessions: Free Practice, Qualifying, Qualifying Race, Race 1, Race 2, Race 3. Each tab shows: position badges (P1=gold, P2=silver, P3=bronze), grid position delta arrows (↑/↓), points awarded, fastest lap / lead lap / pole bonuses. Non-finisher labels: `DQ` (disqualified, `status: "DQ"`), `DNS` (did not start/not classified - `status: "DNS"` or `status: "NC"`, the latter being the actual token `scrape_tsl.py` produces from TSL's PDFs) or `DNF` (a bare `pos: 0` with no such status). Before results land, if a TSL grid PDF has been scraped, shows a `StartingGridTab` with a two-column staggered layout mirroring the physical grid. R3 shows a `ReverseGridTab` prediction stepper as fallback when no actual grid data exists yet. R1 and R2 show a "Predicted Starting Grid" (also `StartingGridTab`, just fed a synthesised grid) derived straight from the previous session's finishing order per reg 3.4.1.b, as fallback when TSL hasn't published the official grid PDF yet. For UK users, race tabs show a "Watch Full Race" YouTube button when a URL is available - for 2026 this falls back to bundled URLs from `results2026.json`; for past years the button only appears if the round's own `youtubeUrls` field is populated.

### More Stack

**MoreScreen** ([src/screens/MoreScreen.js](src/screens/MoreScreen.js))
Menu screen. A "Buy me a coffee" card renders first, above every section (Android only - excluded on iOS, likely to avoid App Store scrutiny of external donation links, though that hasn't been re-verified against current guidelines) - styled as an in-app CTA card (icon + title + subtitle) rather than the raw buymeacoffee.com badge image it used to be. Static rows below it: Records, Settings, About BTCC (InfoPage), Roadmap, Partners, Feedback (BugReport). Flag-gated rows: Radio and Podcasts (both require `podcasts_enabled` or `radio_tab` flags).

**SettingsScreen** ([src/screens/SettingsScreen.js](src/screens/SettingsScreen.js))
All notification toggles with parent/child hierarchy (toggling a parent enables/disables all children). Spoiler-free mode toggle. Display settings (km/miles distance unit; 12hr/24hr time format). Device ID and FCM token display for admin/debugging.

**RadioScreen** ([src/screens/RadioScreen.js](src/screens/RadioScreen.js))
List of live radio streams from `radio.json`. Platform-specific playback: iOS uses `react-native-track-player`, Android uses a native `RadioService`. A Stop button appears in the header when a station is playing. Shows a "No stations available" empty state when the list is empty - true as of 2026-08-20, when talkSPORT/talkSPORT 2 (the only two stations that existed) were retired and `radio_tab` set to `false`, hiding "Online Radio" from the Listen menu entirely. TOCA Live Radio ([TocaRadioScreen](src/screens/TocaRadioScreen.js) below) is a separate, always-on feature and unaffected.

**TocaRadioScreen** ([src/screens/TocaRadioScreen.js](src/screens/TocaRadioScreen.js))
WebView embedding the Cre8Media TOCA Radio player. JavaScript injection intercepts audio stream URLs. Shows a connecting spinner for 15 seconds on load.

**PodcastsScreen** ([src/screens/PodcastsScreen.js](src/screens/PodcastsScreen.js))
Buzzsprout RSS feed with filter chips (All/Race/Qualifying/Podcast). Pagination. AsyncStorage caching. Playback via RadioProvider.

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
Generic page renderer for `pages.json` content. Sections support `text` (body) and `heading` types. Used for About BTCC, History, Rules and Academy pages.

**ChatScreen** ([src/screens/ChatScreen.js](src/screens/ChatScreen.js))
Firebase Realtime Database community chat. Retention enforced by `trimChat` Cloud Function (`functions/chatTrim.js`, unit tested): keeps only the newest 200 messages, and separately drops anything older than 14 days regardless of count - the two caps apply independently, so a message needs to satisfy both to survive. Event-driven off new messages (was silently non-functional 2026-08-20 due to a `getDatabase(url)`/`getDatabaseWithUrl(url)` mixup, see the Mention notifications entry below; fixed and redeployed same day) - during a quiet stretch with no new posts, an aged-out message waits for the next post to trigger cleanup rather than being removed on its own schedule. Profanity filter via `blacklist.json`. 3-flag auto-hide via atomic RTDB transaction (prevents race conditions from concurrent flags). Name prompt on first post (stored as `commenter_name` in AsyncStorage, plus uniqueness-claimed in Firestore for signed-in users via `claimUsername()`). 24 character display name limit, 500 character message limit. Security rules in `database.rules.json` enforce field types, length limits, immutability of text/author/timestamp after creation, and that flagCount can only increase and hidden can only go true - never back to false. Opened via `ChatFab` floating button (not a tab). Accepts an `onClose` prop that shows a back arrow in the header when provided.

**Retroactive rename:** each message's own `authorName` field is an immutable snapshot (the rules reject any attempt to edit it after creation), so renaming only ever changed future messages - past ones kept showing whatever name you had when you sent them. Fixed 2026-08-10 by adding a live `/chat/authorNames/{authorId} -> name` map, written whenever a user (re)names themselves and read once on mount alongside the message listener; `resolveAuthorName()` looks up the message's `authorId` in that map and falls back to the message's own stored `authorName` only for authors who've never (re)named themselves since the map existed. Reply mentions (`@Name`) also resolve through this so they tag someone's current name, not a stale one.

**Username release-on-rename ordering:** `claimUsername()` frees a user's old Firestore `usernames/{name}` doc when they rename, so abandoned names become available again rather than being squatted on forever. Until 2026-08-10 it released the old name *before* confirming the new claim succeeded - a failed/contested claim (someone else grabs the new name a moment earlier, a network blip) left the caller holding neither name, silently freeing the old one for anyone else to grab while the caller's own local state still believed they owned it, undermining the uniqueness guarantee the whole system exists for. Fixed by claiming the new name first (the existing server-enforced precondition already makes that safe) and only releasing the old one once that succeeds.

**Ban system:** Admins can ban users via the Chat tab in the admin panel. Bans are stored at `/chat/bans/{authorId}` (authorId = the sender's Firebase Auth uid - anonymous sign-in gives every install one on first launch, see `store/auth.js`; this stays stable across a rename and even across later linking a Google/Apple account, since linking keeps the same uid). The `onChatBan` Cloud Function triggers on creation, hides all existing messages from the banned user, and writes a `ban_notice` system message. The banned user sees a locked input row instead of the text field. Temporary bans (1h / 24h / 7d) expire automatically via `expiresAt` timestamp checked client-side; permanent bans have `expiresAt: null`. Unbanning deletes the `/chat/bans/{authorId}` node.

**Mention notifications (added 2026-08-20):** typing `@Name` in a message (pre-filled by the Reply button, or typed manually) pushes a notification to that person even if the app is closed - previously this text was cosmetic only, with nothing reading it back out. The `onChatMention` Cloud Function triggers on every new message, resolves `@mentions` against the live `/chat/authorNames` map via `resolveMentionedAuthorIds()` (`functions/chatMentions.js`, unit tested), then sends a single targeted FCM message to whatever token that authorId last registered at `/chat/deviceTokens/{authorId}`. This is the one exception to every other notification in the app being a topic broadcast (see [§11](#11-notifications-system)) - a mention is inherently to one specific person, not a subscribable feed. The device token is written by `syncChatMentionToken()` (`src/utils/notifications.js`), called whenever chat identity resolves or the new "Mention notifications" setting (Settings > LIVE CHAT, default on) is toggled; turning it off removes the token rather than just suppressing display client-side, so a disabled device never receives the push at all. Server-side matching is still plain-text against display names rather than a structured mention field - the longest registered name that fits at each `@` wins, so `@Jo Smith` doesn't also separately match a shorter `@Jo` registered by someone else, and a match only counts when followed by a non-name character (`@Steven` never matches a registered `Steve`). Anonymous users' names aren't guaranteed unique, so a genuine duplicate display name notifies every authorId holding it rather than none - a missed mention was judged worse than an occasional extra ping to a namesake. Tapping the notification opens the chat sheet via a small `requestOpenChat()`/`onOpenChatRequest()` pub/sub in `src/utils/chatBridge.js`, since live chat is a `Modal` owned by `ChatFab`'s own local state rather than a react-navigation route - `notifNavigation.js`'s `type: 'chat'` deep link previously called `navigationRef.navigate('Chat')`, which was always a no-op since no `'Chat'` route exists in `AppNavigator`.

**@mention autocomplete (added 2026-08-20):** typing `@` in the compose box now opens a suggestion dropdown, closing the gap between free-text matching and a guaranteed-correct mention - listing everyone with a visible message in the currently loaded chat history alphabetically (deduped by current live name via `resolveAuthorName()`, excluding yourself and the `ban_notice` system author), narrowing as more characters are typed (`@a` → names starting with "a", case-insensitive). Tapping a suggestion splices in the exact `@FullName ` text at the cursor - not just appended to the end - so mentioning someone mid-sentence ("hey @Jo can you check this") works, and the inserted name is guaranteed to match server-side since it's copied verbatim from the same `authorNames` map `onChatMention` resolves against. The dropdown closes itself once the typed query no longer prefixes any candidate (typing past a complete name, or a query nobody matches) rather than needing a special "mention finished" trigger - the same logic that lets multi-word names like "Jo Smith" keep matching across the space in the middle. Implementation: `mentionQuery`/`mentionStart` in `ChatScreen.js` are plain values derived with `useMemo` from the input text and cursor position (`onSelectionChange`), computed in the same render pass as the text change - an earlier version derived them via a `useEffect`+`setState` pair instead, which forced a second render before the dropdown could appear and was the real cause of a reported on-device delay (see [project memory] for the full diagnosis); cursor is repositioned after insertion via `setNativeProps` rather than a controlled `selection` prop, since a controlled selection fights normal typing. A dedicated `@` button sits to the left of the text field (`insertMentionTrigger()`) for discoverability - it inserts "@" at the last known cursor position, and since `mentionQuery`/`mentionStart` are derived from `input`/`cursorPos` on every render regardless of what changed them, the dropdown opens the same way whether "@" arrived by typing or by this button.

**Production bug found on first live test:** the first real cross-device test sent no notification. `onChatMention` was crashing on every invocation with `firebaseApp.getOrInitService is not a function` - `getDatabase(app?: App)` in this `firebase-admin` version only accepts an App instance, not a URL string; the function that takes a database URL is the separate `getDatabaseWithUrl(url, app?)`. This wasn't a new mistake - `onChatBan` and `trimChat` had called `getDatabase(url)` the same wrong way all along, silently swallowed by their own `catch { console.error(...) }` with no wrapper-level test to catch it (only their pure-logic siblings are unit tested). Fixed by switching all three call sites to `getDatabaseWithUrl()` and redeploying together.

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
weekendPreview      → weekend_preview
standingsUpdate     → standings_update
podcastAlerts       → podcast_alerts
```

**Spoiler-free mode:** When enabled, sets an expiry of the next Monday at 23:00 local time (stored as ISO string). On every app open, if the expiry has passed the mode is silently cleared; if not yet expired the `SpoilerClearedDialog` is shown.

**Legacy migration:** Old single-key settings (e.g. `setting_race_alerts`) are migrated to the new granular key structure on first load.

**Non-topic leaf settings:** `chatFab` (show/hide the floating chat button) and `chatMentions` (receive a push when `@mentioned` in Live Chat) aren't in the topic hierarchy above - `chatFab` is purely local UI state, and `chatMentions` instead registers/removes this device's FCM token at `/chat/deviceTokens/{uid}` via `syncChatMentionToken()` (see ChatScreen's Mention notifications entry, [§6](#6-screens-reference)).

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

### Public API Functions

| Function | Source | Notes |
|---|---|---|
| `fetchCalendar(year)` | GitHub or bundled JSON | Fallback to bundled on network error |
| `fetchDrivers()` | GitHub or bundled JSON | staleFirst; bundled fallback |
| `fetchStandings(forceRefresh?)` | GitHub | staleFallback |
| `fetchResults(year, forceRefresh?)` | GitHub | 5-minute cache |
| `fetchArticles(page, perPage, search)` | GitHub (`articles/page_<n>.json`) | No search: fetches just that one page file, cached under its own `news_p<n>` key - never downloads the rest of the archive. With search: fetches `index.json` plus every distinct page it references, filters client-side (a deliberate one-off cost only paid when actually searching). btcc.net has no public REST API, so none of this ever hits btcc.net directly (see [§19](#19-python-scrapers)) |
| `peekArticlesCache(page)` | AsyncStorage only | Returns that page's cache without a network call, bounded to one 5-minute scrape cycle (older entries return null) - see [§24](#24-known-architecture-decisions) |
| `fetchHubPosts()` | GitHub + device ID filter | Handles published/scheduled/draft states |
| `fetchArticleBySlug(slug, forceRefresh)` | GitHub (`articles/index.json` + one `page_<n>.json`) | Looks up the slug's page number in the index, then fetches only that one page file - never the whole archive; returns null if not (yet) present. `forceRefresh` (used by ArticleScreen's Retry) bypasses both files' 5-minute cache entirely, not just a stale hit |
| `fetchBlacklist()` | GitHub or bundled JSON | staleFirst |
| `fetchLiveStatus()` | GitHub | 2-minute cache; returns null on error |

### Hub Post Filtering

`hub_news.json` posts have a `status` field:
- `published` - always visible
- `scheduled` - visible after `scheduledAt` timestamp passes
- `draft` - visible only on devices whose FCM token is listed in `previewDeviceIds`

---

## 9. Data Sources

| Source | URL/Location | Data |
|---|---|---|
| GitHub raw CDN | `https://raw.githubusercontent.com/yacobwood/BTCC/main/data` | drivers, standings, results, hub_news, news, articles, flags, calendar, schedule, roadmap, radio, blacklist, live_status, team_map |
| btcc.net (Vercel) | `https://www.btcc.net/news/` + per-article pages | News articles - scraped into `news.json` (latest headline, for the notification trigger) and `data/articles/page_<n>.json` + `index.json` (accumulated article archive, for the app's News tab and article deep-links) by `scrape_news.py`/`scrape_articles.py` via headless Chromium (see [§19](#19-python-scrapers)) |
| Buzzsprout RSS | Configured URL | Podcast episodes |
| Open-Meteo | `api.open-meteo.com/v1/forecast` (free, no API key) | Daily + hourly forecast for the circuit's lat/lng over its race weekend |
| TSL SignalR | Live timing hub endpoint | Session live timing entries |
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
| `flags.json` | Feature flags + per-device overrides |
| `hub_news.json` | Hub-curated news posts including AI-generated digests |
| `news.json` | Latest btcc.net article (WP-REST-shaped), scraped every 5 minutes so `sendSessionNotifications` can read it without hitting btcc.net directly |
| `articles/page_<n>.json` + `articles/index.json` | btcc.net article archive in full (title, content, image, category), accumulated over time (capped at 500 articles, oldest dropped) and split into ~20-article page files plus a slug→page index, so the app's News tab, search and article deep-links only ever fetch the one page they actually need instead of the whole archive - see [§19](#19-python-scrapers) |
| `roadmap.json` | Feature roadmap items with status |
| `radio.json` | Live radio station URLs - empty since 2026-08-20 (talkSPORT/talkSPORT 2 retired, `radio_tab` flag set to `false`) |
| `blacklist.json` | Profanity filter word list |
| `live_status.json` | Whether a live session is in progress |
| `schedule.json` | Session start times used by Cloud Functions for pre-session notifications |
| `team_map.json` | Driver-to-team mapping used by scrapers |
| `records.json` | All-time driver records (computed by `compute_records.py` on every scrape) |
| `tracks.json` | Static circuit guide data - corner sequences, L/R counts, sector breakdowns and corner descriptions for all 10 BTCC venues. Corner names and lap order are authoritative from `src/assets/tracks/*.svg` SVG renders. |

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
| `digest_alerts` | New weekly/race weekend digest |
| `podcast_alerts` | New podcast episode |
| `weekend_preview` | Friday 9am before a race weekend |
| `standings_update` | Tuesday 9am after a race weekend |
| `pre_fp` | 15 minutes before Free Practice |
| `pre_qualifying` | 15 minutes before Qualifying |
| `pre_qrace` | 15 minutes before Qualifying Race |
| `pre_race1/2/3` | 15 minutes before Race 1/2/3 |
| `results_fp/qualifying/etc` | Session results posted |
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

Session results notifications are a separate mechanism entirely - `.github/scripts/session_watcher.py` (Python, connected to TSL's live-timing SignalR feed, not this Cloud Function) sends those on `sessioncomplete` events, since it needs to react the moment a session actually finishes rather than poll once a minute. **Not currently reachable in production** though: confirmed via GitHub Actions run history that `session-watcher.yml` (which it needs dispatching from) hasn't actually run since May 2026 - its cron auto-trigger is commented out and nothing else dispatches it. See [§19](#19-python-scrapers).

**Always runs (every minute, regardless of race day):**
- News alerts: polls `news.json` on the GitHub raw CDN (scraped from `btcc.net/news/` every 5 minutes by `scrape_news.py` via headless Chromium - btcc.net's Vercel bot-challenge blocks the Cloud Function's runtime fetch from hitting it directly, see [§19](#19-python-scrapers)), compares latest `id` (now the article slug, not a WordPress post ID) to Firestore `state/news.lastId`. Before actually sending, checks that the slug is already in `data/articles/index.json` (`isSlugMirrored`) - `news.json` is committed well before the much slower `scrape_articles.py` mirror step in the same workflow run, so a slug can exist here for several minutes before `ArticleScreen`'s lookup can find it. If not yet mirrored, the send is skipped for this tick without clearing `pendingSend`, so the next 1-minute tick just retries once the mirror catches up - fixed 2026-08-11, root cause of notifications occasionally opening to a "couldn't load this article" screen. Sends to `news_alerts` on change. Includes `slug` + `imageUrl` in payload. Logic lives in `functions/newsCheck.js` (injected deps for testability). Uses a 20-second fetch timeout.
- Hub news alerts: polls `hub_news.json`, compares latest `id` to Firestore `state/hub_news.lastId`. Sends to `news_alerts`. Excludes "Weekly Digest" category articles.
- Podcast alerts: polls Buzzsprout RSS, compares `guid` to Firestore state. Sends to `podcast_alerts`.

Firestore transactions prevent duplicate sends. First-time detection (when `lastId` is null) stores the ID but does NOT send a notification.

**Error alerting:** every `logError` call uses `alert: true`. For per-minute checks (news/hub/podcast/FCM) the error is upserted at a fixed key and the email is only sent on first occurrence or when the error recurs after being marked resolved in the admin FIRESTORE tab. One-off failures (syncAnalytics, notifyResultsUpdate, digest generation) always email. All alerts go to `btcchub@gmail.com` via `GMAIL_APP_PASSWORD` secret - **this secret must be explicitly declared in a function's `secrets: [...]` option to be injected into `process.env`** (Firebase Functions v2 does not bind Secret Manager secrets to a function unless it asks for them). `sendSessionNotifications`, `syncAnalytics` and `notifyResultsUpdate` were missing this declaration until 2026-07-11, so every alert from them silently wrote to Firestore but never emailed - fixed by adding `secrets: ['GMAIL_APP_PASSWORD']` to each.

**Scraper failure alerting:** `reportScraperFailure` (HTTP, `SCRAPER_SECRET`-gated) lets the GitHub Actions scraper workflows report into this same pipeline, since a failed workflow run has no way to email on its own. Every scraper workflow has a final `if: failure()` step (see [§19](#19-python-scrapers)) that POSTs `{workflow, message, runUrl}` to it, which calls `logError` with `key: scraper-<workflow>` - same dedup-until-resolved behaviour as the per-minute checks above, and shows up in the same admin FIRESTORE tab.

**Resolving errors:** the admin FIRESTORE tab Dismiss button calls the `dismissError` Cloud Function (Admin SDK, bypasses rules) via `POST /dismissError` with `x-admin-secret`. The `errors` collection has `allow write: if false` for clients - direct REST PATCH from the admin page was silently rejected by Firestore rules, so writes are routed through the function instead. "Dismiss all" sends `{all: true}` and the function batch-updates all unresolved docs.

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

Implemented in [src/utils/ttb.js](src/utils/ttb.js), per reg 1.11.1. Shown as a ⚡ badge on each driver's card in the Starting Grid tab (Race 1/2/3 only - current season only).

Laps of boost available per race is a sliding scale by position - P1 gets fewest, P8+ gets most - split by circuit type:

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
- **Race 2** - Race 1's finishing order, same round
- **Race 3** - Race 2's finishing order, same round

Non-classified results (DNF/DQ/DNS) are ranked after classified finishers by laps covered (descending) - the same convention `buildStraightGrid()`/`buildReverseGrid()` already use for grid derivation.

**Not modelled** (both explicitly left to Administrator discretion by the regs, so there's no data-derivable formula): Late Entry TTB for cars registered after 13 Mar 2026 or missing rounds (1.11.1.c.i), and substitute-driver TTB carryover (1.11.1.c.ii). Guest-driver results are also supposed to be excluded from Race 2/3 position numbering (1.11.1.a), but guest entries aren't flagged in the results data, so they're currently counted as a normal finisher. Feature is gated to the current season only (`year === CURRENT_SEASON`) since the same scale isn't verified against older seasons' regs.

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
- ⚡ TTB badge per driver card (laps of TOCA Turbo Boost available this race) - see [§13](#13-scoring-and-race-format)

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

## 15. Feature Flags

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

## 16. Design System

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

## 17. Shared Components

**AdBanner** ([src/components/AdBanner.js](src/components/AdBanner.js)) - Google AdMob banner, gated by `banner_ad` feature flag. Hidden until first ad loads (`loaded` state). `BannerAd` handles refresh internally; manually calling `.load()` on tab switch interrupted the cycle and caused visible flashing.

**CachedImage** ([src/components/CachedImage.js](src/components/CachedImage.js)) - Image component that rewrites btcc.net WordPress URLs to thumbnails (`-150x150` or `-768x768` suffix depending on display size). Provides a fallback placeholder on load error or null URI.

**ErrorBoundary** ([src/components/ErrorBoundary.js](src/components/ErrorBoundary.js)) - React class component catching JS errors anywhere in the tree. Shows a "Try Again" button that resets its state.

**OnboardingDialog** ([src/components/OnboardingDialog.js](src/components/OnboardingDialog.js)) - First-launch modal with "Allow Notifications" and "Skip" options. Stored in AsyncStorage key `onboarding_shown`.

**ProgressionChart** ([src/components/ProgressionChart.js](src/components/ProgressionChart.js)) - SVG line chart (react-native-svg) plotting points-per-round for each driver. Supports "Show all / Hide all" toggle and individual driver series toggling. Handles null gaps in data.

**SeasonTable** ([src/components/SeasonTable.js](src/components/SeasonTable.js)) - Scrollable grid of all rounds and results. Shows DSQ/Ret/DNS/FL/PP badges. P4-P15 rendered with a smooth green gradient (brightest at P4). Sorted by championship points. Supports standings override for historical seasons. Round/venue header background lives on the static clip container (not the translated Animated.View) to prevent React Native GPU layer clipping from cutting the colour band short on Android.

**SpoilerClearedDialog** ([src/components/SpoilerClearedDialog.js](src/components/SpoilerClearedDialog.js)) - Modal shown when spoiler-free mode was active and auto-expired.

**SwipeableTabs** ([src/components/SwipeableTabs.js](src/components/SwipeableTabs.js)) - `PagerView`-based tab component. Supports `lazy` mode (only renders the active page on first visit). Used in RoundResultsScreen for session tabs.

**UKMapPin** ([src/components/UKMapPin.js](src/components/UKMapPin.js)) - Renders an SVG outline of the UK with a map pin at the given `lat`/`lng` coordinate. Used in TrackDetailScreen to show circuit location.

**UpdateDialog** ([src/components/UpdateDialog.js](src/components/UpdateDialog.js)) - Force-update modal linking to App Store or Play Store. Shown when build number is below `update_min_version_ios`/`update_min_version_android` in flags.

---

## 18. Utility Modules

**analytics.js** - Firebase Analytics event helpers wrapping `logEvent()` calls. Note: the `widget_configured` event (Android, params: `size` and `theme`) and `widget_size_used` event (iOS, param: `size`) are fired natively - not via this module. Android fires from `WidgetConfigureActivity.kt` at configure time. iOS queues the family in the shared App Group UserDefaults during `getTimeline` and the main app flushes to Firebase in `AppDelegate.didFinishLaunchingWithOptions`.

`articleClicked` (event: `select_content`, `content_type: 'article'`) takes an optional 5th `publishDate` argument that logs as `publish_date` (only included when present). All call sites that have the full article object (NewsScreen hero/grid/list, DigestsScreen) pass `article.sortDate`. `ArticleScreen`'s own `Analytics.screen('article:...')` call also includes `publish_date` from `article.sortDate` when available. The notification deep-link path in `App.tsx` only has an article ID/slug (no full article object), so it cannot supply `publish_date`. Since this is an event parameter, GA4 only captures it going forward from when this shipped (2026-07-21) - it does not backfill `publish_date` onto previously logged events, so older `select_content`/`screen_view` rows in GA4 will show `(not set)` for it.

**backgroundPrefetch.js** - Prefetches driver and article images into the React Native image cache on app start.

**broadcaster.js** - Simple event emitter for cross-component state broadcast.

**deviceId.js** - Generates a stable anonymous UUID stored in AsyncStorage. Used for hub post draft previews and roadmap vote deduplication.

**digestRead.js** - Tracks which digest article IDs have been read (AsyncStorage). Syncs to the signed-in user's Firestore profile (`digestReadIds` field via `userProfile.js`) so read state carries across devices; anonymous users only get local persistence.

**driverName.js** - Formats driver names as "Firstname LASTNAME" (e.g. `Tom INGRAM`). Used consistently across all screens for display.

**notifNavigation.js** - Maps notification `data` payloads to navigation actions. Uses `CommonActions.reset()` for all nested screen navigations.

**notifications.js** - Sets up Android notification channels. Requests OS permission. Registers foreground FCM message handler.

**profanityFilter.js** - Checks input text against the `blacklist.json` word list. Used in ChatScreen and BugReportScreen.

**reviewPrompt.js** - Decides when to trigger `react-native-in-app-review` based on usage events.

**signalr.js** - TSL SignalR client. Handles WebSocket negotiation, handshake, `registerForEvent`, session/entry parsing, pong responses (type 6), reconnection and teardown.

**timeAgo.js** - Returns relative time strings ("2 hours ago", "3 days ago") from a date string.

**ttb.js** - TOCA Turbo Boost (race-lap boost allocation) calculations - see [§13](#13-scoring-and-race-format).

**weather.js** - Fetches forecast weather from Open-Meteo for a circuit's lat/lng over its race weekend dates. Only fetches when the round is within `MAX_FORECAST_DAYS` (10 days, raised from 7 on 2026-08-10 - Open-Meteo's free tier forecasts up to 16 days out, so 10 is comfortably within range) and not a past weekend. Uses a manual AbortController for the 8-second timeout (AbortSignal.timeout is unreliable on Android/Hermes). Helpers for WMO weather code descriptions, icons and icon colours. **BTCCWidget.swift** (iOS) and **LargeWidget.kt** (Android) - the home-screen widgets, a separate surface from TrackDetailScreen - each have their own independent `7`-day constant that was deliberately left as-is in that same change, since it wasn't part of what was asked; keep this in mind if the widgets' cutoff is ever revisited, since all three constants must still be kept in sync manually. (The widgets also stay daily-only, bare-array shape - the hourly addition below is TrackDetailScreen-only, deliberately not propagated there.) `fetchWeather()` returns `{daily, hourly}` (2026-08-09, breaking change from a bare daily array) - `hourly` drives the session-aligned forecast in TrackDetailScreen (see [§6](#6-screens-reference)). Cache reduced from 3 hours to 30 minutes for the same reason: a race-weekend forecast is worth checking through the day, not settling for what was true hours ago.

---

## 19. Python Scrapers

Located in [tools/scraper/](tools/scraper/). Run manually or via CI to update data files on GitHub.

**Fetching btcc.net:** btcc.net moved off WordPress entirely to a Vercel-hosted React app (2026-07-31). It now issues a Vercel BotID JS proof-of-work challenge (HTTP 429) to any request that can't execute JavaScript, so every btcc.net-facing scraper renders pages with headless Chromium via `tools/scraper/btcc_playwright.py` (`fetch_rendered(url)` for one-off fetches, or the `RenderedFetcher` context manager to reuse one browser across several fetches in the same run) instead of a direct HTTP request. The challenge also scores network/IP reputation on top of the JS check - confirmed by testing the identical Playwright code from both a residential IP (passes cleanly) and a GitHub-hosted Actions runner (still gets 429'd). As an interim fix until btcc.net's dev allowlists our traffic, every btcc.net-facing workflow below runs on a **self-hosted runner** (label `btcc-mac`, a `launchd` service on the maintainer's own Mac - see `~/actions-runner-btcc`) instead of `ubuntu-latest`, using a persistent venv at `~/.btcc-scraper-venv` (Playwright + Chromium pre-installed) rather than reinstalling on every run. `scrape-results.yml` (TSL PDFs) and `scrape-youtube.yml` never touch btcc.net and stay on `ubuntu-latest`. The old `btcc_relay.py`/`cf-worker/` Cloudflare Worker relay (which solved a *different*, now-obsolete IP-reputation WAF block on the old WordPress origin) has been removed - it can't help here, since a Worker can't execute a JS challenge either. **2026-08-13/14 re-block, root-caused and fixed:** even the residential runner IP started getting challenged again on every path (including `/robots.txt`) after weeks of clean runs - not a code regression or a Vercel-wide incident. `RenderedFetcher` was launching a brand-new, cookie-less browser on every single run, forever, which is itself a strong signal to behavioral bot-scoring independent of running a real browser (a genuine returning visitor's session carries cookies, including whatever token a solved challenge sets, so it isn't re-challenged from scratch every visit). Fixed by persisting Playwright's `storage_state` to `~/.btcc-scraper-state/` (same machine-local, outside-the-checkout pattern as the venv) across runs, plus a small random startup jitter so the fetch doesn't fire at an exact 5-minute mark every time.

**Failure handling convention:** every scraper invoked by a workflow exits non-zero on a real failure (fetch error, empty/unparseable response) and exits 0 only when there was legitimately nothing new to do. Each of those workflows has a final `if: failure()` step that reports to the `reportScraperFailure` Cloud Function (see [§12](#12-firebase-cloud-functions)), which emails `btcchub@gmail.com` and logs to the same admin FIRESTORE tab as Cloud Function errors. `scrape_tsl.py` is the one exception to "fetch happens before write": `compute_records.py` runs as an internal sub-step *after* `results{year}.json`/`standings.json` are already written, so its workflow (`scrape-results.yml`) uses `continue-on-error` on the scrape step so the commit step still saves that good data even when the sub-step fails, then explicitly fails the job afterward so the run still shows red and alerts.

**scrape_tsl.py** - Main results and grid scraper. Fetches TSL timing PDFs for each session (not btcc.net, so unaffected by the Vercel-challenge/self-hosted-runner situation above). Parses race results and starting grids. Writes to `results{year}.json`. Non-finisher results carry `pos: 0`; disqualifications additionally carry `status: "DQ"`. At the end of each run it also updates circuit lap records in `calendar.json` and triggers `compute_records.py`. (Team stats used to run here too - see `scrape_team_stats.py` below for why that moved out.) Every PDF suffix (`SESSION_SUFFIXES`, `GRID_SUFFIXES`, `CHAMPIONSHIP_SUFFIX`) gets `trg` appended at the point of use (`f"{suffix}trg"`) - TSL's touring-car category disambiguator, needed because a single TOCA event ID covers BTCC plus several support series sharing the same file namespace.

**scrape_articles.py** - Mirrors full btcc.net article content into `data/articles/page_<n>.json` + `index.json` (see file's own docstring for the per-page split rationale). A slug already in the accumulated archive normally keeps its cached content rather than re-fetching every run (`scrape-news.yml` runs every 5 minutes) - `needs_full_refetch()` is the one exception: if the cached content is itself btcc.net's own literal `"More to follow..."` stub (published before a live race-weekend session's result was in), it's re-fetched on every run regardless of age, since a stub with no further signal would otherwise be treated as "done" forever. Fixed 2026-08-09 - two Snetterton reports had sat unfinished for 2.5+ months, and Knockhill's own FP/qualifying reports were stuck the same way the day this was found. `--refresh-all` (CLI-only, never used by the scheduled workflow) forces every page-1 card to re-fetch regardless of stub status, for a manual full catch-up.

**Championship standings** (`parse_championship_pdf()`, called by `scrape_tsl.py` after every scrape) - parses the TSL championship PDF (`CHAMPIONSHIP_SUFFIX`, e.g. `ptstrg`) into `data/standings.json`. The PDF holds six distinct scored tables (Drivers, Manufacturers/Constructors, Teams, Independents' Teams, Independents' Trophy for Drivers, Jack Sears Trophy - `_CHAMP_SECTIONS`), each column-detected independently via its own header row. The **Independents' Trophy for Drivers** section was detected and parsed (it's in `_DRIVER_SECTIONS`) but never written into the output dict - fixed 2026-08-10, having gone unnoticed because the app's Results screen was papering over the gap by filtering the main Drivers' Championship array by `cls === 'I'` and just relabelling it "Independents", which happened to look plausible but showed the wrong points/wins (Sporting Regs §1.6.2.b scores the Independents' Trophy on the same finishing-position points table as the main championship, minus the pole/fastest-lap/race-leader bonus points - not a re-ranking of the main table). `standings["independents"]`'s own Wins/2nds/3rds columns are trusted as scraped (a class tally: best-placed independent per race) rather than overridden with the outright-finish tallies used for `standings`/`jst`, since those are a different metric. `Manufacturers/Constructors` was already being written to the JSON but the app-side parser (`parseStandings()` in `src/api/parsers.js`) never read it, so it also went unused until the same fix.

**Track lap records** (`update_calendar_records()`, called by `scrape_tsl.py` after every scrape) - compares each round's fastest `bestLap` (Qualifying for `qualifyingRecord`, fastest of Race 1/2/3 for `raceRecord`) against the stored record in `calendar.json` and overwrites only when genuinely faster. `lap_to_secs()` parses `"M:SS.mmm"` or bare `"SS.mmm"`, tolerating a trailing unit suffix (some older records were manually seeded as `"50.876s"`) - before 2026-08-09 it didn't, so `float(t)` raised on that suffix, silently returned `inf` for the *stored* record, and let literally any freshly-scraped lap overwrite it as a false "new record" regardless of whether it was actually faster (this hit Knockhill live in production; Silverstone's records carried the same `"s"`-suffixed formatting and would have hit the same bug at its own race weekend). `src/screens/TrackDetailScreen.js` has its own client-side `lapTimeSecs()` for a "live record" preview during a race weekend, fixed the same day - it previously required a colon (`"M:SS.mmm"`) and returned `null` for any bare-seconds record, which is how every short circuit (Knockhill, Brands Hatch Indy) actually stores its sub-two-minute times, so their live-record speed calculation silently never ran.

**is_race_weekend.py** (`.github/scripts/`) - Gates `scrape-results.yml`'s actual scraping steps: the workflow cron fires every 2 minutes Sat/Sun 09:00-19:00 UTC regardless, but each step only runs `if: steps.raceday.outputs.in_session_window == 'true'`. `compute_session_windows()` opens a `[start+15min, start+90min]` window per session by default. Grid-bearing sessions (`PRECEDING_SESSION` map: Qualifying Race ← Qualifying, Race 1 ← Qualifying Race, Race 2 ← Race 1, Race 3 ← Race 2) also open their window early, as soon as the preceding session's results are committed, through to the same `w_end` - per reg 3.4.1.a/b the grid is published as soon as the preceding session finishes, normally hours before the grid-bearing session's own start. Before this fix (2026-08-09), the window for e.g. Race 1's grid never opened until 15 minutes *into* Race 1 itself, so the official grid was never actually fetchable before the race started - the client-side "Predicted Starting Grid" fallback (see [§14](#14-starting-grid-system)) existed to cover exactly that gap, and still serves as the fallback for any case where the real grid is fetched late for other reasons (TSL delay, workflow hiccup, etc).

**session_watcher.py** (`.github/scripts/`) - Connects to TSL's SignalR live-timing feed for a race day and reacts to `sessioncomplete` events: fires a "Starting in 15 mins" pre-session alert, and on each session's completion waits 3 minutes for the PDF, scrapes+commits, then sends that session's results notification. **Not currently reachable in production**: `.github/workflows/session-watcher.yml` requires either a manual `workflow_dispatch` or an auto-dispatch from `race-day-start.yml`, and confirmed via GitHub Actions run history it hasn't actually run since May 2026 (its cron auto-trigger is commented out, and `race-day-start.yml` produced no runs at all on a live race weekend it was checked against). Every pre-session/results notification a user actually receives today comes from `sendSessionNotifications` instead (see [§12](#12-firebase-cloud-functions)) - this file's implementation is left in place, correct but dormant, in case the workflow is ever reactivated.

**compute_records.py** - All-time records computer. Reads all bundled season JSONs (2004-2025) and the live `results{year}.json` file to compute every stat shown on the RecordsScreen (wins, podiums, poles, streaks, consecutive finishes, hat tricks, etc.). Preserves `historical: true` entries (pre-2004 era drivers) from the existing `records.json`. Writes `records.json`. Called automatically by `scrape_tsl.py` after each scrape. **Not standalone-safe:** it only knows about 2004+ timeline data, so running it alone temporarily reverts the official wins/championships overrides that `scrape_btcc_stats.py` applies for drivers active before 2004 (e.g. Jason Plato) - it self-heals at the next daily `scrape_btcc_stats.py` run, but don't run it in isolation and expect the result to be final.

**career_stats.py** - Manual driver history verification/regeneration tool (not run automatically by any workflow). `compute_year_standings(rounds)` computes one year's points/wins/podiums/poles/fastest laps/DNFs/position/champion directly from a season's raw round data (`src/assets/data/season_{year}.json` for 2004-2025, `data/results{year}.json` for the live season) - the same field-by-field ground truth used to regenerate `drivers.json`'s per-driver `history[]` arrays after they were found to have drifted from reality across 41+ driver-years. `normalize_name()` converts `results{year}.json`'s "Firstname SURNAME" convention (e.g. `Max BUXTON`) to the natural title case `drivers.json`/`season_{year}.json` both use (`Max Buxton`) - `get_driver()` checks `DRIVER_NAME_ALIASES` against the raw name first, since normalizing before the alias check mangles names like `Daryl DeLeon`. Includes a whole-round-blank DNF heuristic: if every one of a driver's races in a round shows `pos: 0, laps: 0`, the round was never entered (driver left the series) rather than three phantom DNFs. Run `--verify-champions` to cross-check that computed standings identify the correct champion for all 22 years (2004-2025) against an independently-curated `CHAMPIONS` dict.

**scrape_btcc_stats.py** - Weekly official-stats override pass. Fetches all-time wins (`btcc.net/history/statistics/drivers/`) and championship counts (`btcc.net/history/champions/btcc-titles/`) and patches them into `records.json` on top of whatever `compute_records.py` last computed - this is what makes pre-2004 career totals correct. The wins/titles content itself turned out to still be WordPress-migrated static text and Gutenberg tables even after the Vercel migration, so `parse_wins()`/`parse_titles()` needed no changes - only the fetch mechanism did. Runs Monday 06:00 UTC via `scrape-btcc-stats.yml` (dropped from daily - btcc.net's own dev confirmed results/standings only move on race weekends, so a weekly check reliably catches anything new).

**scrape_calendar.py** - Parses the BTCC calendar to update `calendar.json` with round dates and venues (internally calls `scrape_full_timetable.py` per round to populate support-series timetables into each round's `fullTimetable`). The calendar page's card order is **not chronological** (a grid/layout artifact on the live site) - rounds are sorted by parsed date before round numbers are assigned, rather than trusting encounter order. Also note: btcc.net abbreviates September to 4 letters ("SEPT") while every other month uses 3 - the date regex allows `{3,4}` specifically to avoid silently dropping September rounds (see `test_scrape_calendar.py`). Runs weekly (Monday 09:00 UTC via `scrape-calendar.yml`, immediately followed by `scrape_schedule.py` and `merge_schedule.py` in the same job) rather than daily - btcc.net's own dev confirmed the calendar "doesn't get updated often, once set at season launch kinda stays that way most of the time".

**scrape_news.py** - Fetches the latest btcc.net article from the rendered `/news/` page and writes it to `news.json`. `id` is the article slug (WordPress numeric post IDs no longer exist post-migration; every consumer already treats `id` as an opaque string, so this is safe). Runs every 5 minutes via `scrape-news.yml` so `sendSessionNotifications` can read it from GitHub instead of hitting btcc.net directly. Title extraction tolerates (and strips) a nested inline tag around the title text - e.g. a "breaking" badge span - rather than hard-failing the whole scrape; hardened 2026-08-19 after "could not extract title/slug" recurred intermittently 7 times across ~9.5 hours the prior evening, not reproducible on demand.

**scrape_articles.py** - Mirrors btcc.net articles in full (not just the single latest headline `scrape_news.py` tracks) into `data/articles/page_<n>.json` (PAGE_SIZE=20 each, must match `fetchArticles()`'s `perPage` in `src/api/client.js`) plus `data/articles/index.json` (slug → page number). Gets slug/title/excerpt/date/image for every card from the rendered `/news/` listing page, then fetches each article's own page for full body HTML - but only for slugs not already cached, so a steady-state run is typically 0-1 extra page loads, not a full re-fetch of every article. Each run's freshly-scraped cards are merged into the full previously-accumulated archive (not just replaced), then capped at MAX_ARTICLES=500 by date - this per-page split is what lets the app fetch one page's worth of data regardless of how deep the archive goes; an earlier version wrote one flat `articles.json` capped the same way, but that meant every fetch (list, search, or a single slug lookup) downloaded the entire archive's full content every time. `--backfill-pages N` crawls `/news/page/2/` onward for a one-off deep backfill (not for routine runs) - note this only works up to however many pages btcc.net's listing actually renders distinct content for when hit via a fresh navigation; deeper pages have been observed to just repeat page 1's cards. (The old WordPress `/feed/` RSS source this used for full content no longer exists post-migration.) Runs every 5 minutes in the same `scrape-news.yml` workflow as `scrape_news.py`.

**scrape_schedule.py** - Updates `schedule.json` with precise BTCC session start times (Free Practice/Qualifying/Qualifying Race/Race 1-3) for Cloud Function pre-session alert timing. Used to independently re-fetch every circuit page via `scrape_full_timetable.py` (duplicating the exact same fetches `scrape_calendar.py` already makes to populate `fullTimetable` - both workflows were hitting btcc.net for the same ~10 pages once a day each). Now a pure local transform of `calendar.json`'s already-scraped `fullTimetable` (`classify_btcc_sessions()`, tested in `test_scrape_schedule.py`) - makes zero network requests, and only runs as a step within `scrape-calendar.yml` right after `scrape_calendar.py`, not as its own workflow.

**scrape_youtube.py** - Associates YouTube race replay URLs with rounds in the results JSON.

**scrape_team_stats.py** - Fetches race/win totals per team from `btcc.net/team/<slug>/` and writes them into `data/drivers.json`. Used to run as a sub-step of every `scrape_tsl.py` invocation (every 2 minutes during a live race weekend), but that meant launching a headless browser on every tick just to re-check totals that only change once a weekend's results are final - now runs on its own weekly schedule via `scrape-team-stats.yml` instead (Monday 06:30 UTC, same reasoning as `scrape_btcc_stats.py` above). Used to also mirror each team's card-background graphic and car photo from `/teams/` into `cardBgUrl`/`carImageUrl` - that image-fetching code was stripped out 2026-08-18 (see below), leaving this script purely a stats scraper.

**scrape_circuit_images.py** - Manual, one-off mirror tool (not on any schedule). Fetches each circuit's hero photo from its `btcc.net/circuit/<slug>/` page and saves it into `data/media/tracks/`, repointing that track's `imageUrl` in `tracks.json` at the GitHub-raw-hosted copy. Needed because the new site serves this image from a private Supabase Storage bucket behind a per-request signed URL (expires within the hour) via btcc.net's own stable `/api/media/<uuid>` redirector - same mechanism the now-archived `scrape_driver_images.py` used to mirror for driver cutouts, just a different page/selector (`.circuit-profile-hero`'s `background-image` `url(...)` instead of an `<img src>`). `layoutImageUrl`/`raceImages` are deliberately not touched - every current track has a bundled SVG in `TrackDetailScreen.js`'s `BUNDLED_TRACK_LAYOUTS` that takes priority, and the race-photos carousel is never actually pushed into that screen's render list, so both are dead code regardless of URL validity. Brands Hatch GP is skipped - its `imageUrl` already points at `images.msv.com` (the circuit's own site) and still resolves.

**Archived 2026-08-18: scrape_driver_images.py, scrape_driver_cutouts.py, scrape_driver_backgrounds.py** - lived in `tools/scraper/`, now moved to `tools/scraper/archive/` (kept for reference, no longer run, dropped from `scrape-team-stats.yml`). Between them these live-scraped a driver's headshot (`imageUrl`), their bundled `src/assets/driver_images/<number>.webp` cutout, and their card-background graphic (`cardBgUrl`) from btcc.net. Replaced by a hand-curated set of official team/driver graphics committed directly into the repo - see "Hardcoded driver/team images" immediately below, and `tools/scraper/archive/README.md` for the full old-field → new-source mapping.

**Hardcoded driver/team images** - `data/driverImages/`, `data/carImages/`, `data/numberImages/` and `data/backgroundImages/` hold official team/driver graphics (headshot, side-on car cutout, branded number graphic, 1920x600 card background respectively). `driverImages/`/`numberImages/` stay named `<car number>`; team backgrounds use `<team-slug>`. `carImages/` was renamed `<car number>` → `<driver surname>` 2026-08-21 (e.g. `patterson.webp`, `halstead.webp`) - a car number was already 1:1 with a driver, but the surname makes it legible which specific driver's livery a file is, which matters now that `carImageUrl` is read per-driver rather than once per team (see the Grid/Merch/TeamDetail entries above). All four folders are WebP end to end as of the same date (only `numberImages/` still keeps a couple of tiny flat-graphic files as PNG, where WebP wasn't smaller) - the batch had been a mix of WebP and full lossless PNG at roughly double the size for the same picture, `numberImages/123.png` (Daniel Lloyd, a grunge-textured graphic rather than the flat silhouette style of its siblings) needed lossless WebP specifically since lossy actually made it bigger. Photo-like content (cars, headshots, gradient backgrounds) compresses far better lossy; flat vector-style graphics (most number badges) don't need converting at all and can even lose ground to lossy WebP if attempted. Referenced by `raw.githubusercontent.com` URL from `data/drivers.json`: driver-level `imageUrl`/`carImageUrl`/`numberImageUrl`/`cardBgUrl`, team-level `cardBgUrl`/`carImageUrl` (`attachTeamDisplayFields()` in `src/api/parsers.js` prefers a driver's own `cardBgUrl`/`carImageUrl` over their team's, same precedence for both fields - team-level `carImageUrl` is now purely that fallback, since no screen renders it directly any more). `numberImageUrl` replaced the plain styled-text car number in `DriversScreen`/`DriverDetailScreen`/`TeamDetailScreen` (falls back to the old text rendering when absent). No scraper writes any of these four fields - swapping an image means committing a new file under the same name (or repointing the URL in `drivers.json` if the name changes), no code change or app release needed. Adding or replacing a `carImages/` file specifically also needs `python3 scripts/generate_car_thumb.py` re-run for it - it now generates two derived variants, not one: the plain `-thumb.webp` `TeamDetailScreen` requests (padding intact, on purpose - its sponsor logo overlay relies on it) and the cropped `-thumb-crop.webp` `DriverDetailScreen`'s banner requests (see that screen's entry above for the full story of why two, not one). A missing variant 404s the same way a missing full-size file used to. `driverImages/` has its own equivalent: `python3 scripts/generate_driver_bundle.py` re-run after adding or replacing a file, which regenerates the actual bundled asset `getDriverImage()` requires - `src/assets/driver_images/<number>.webp` - from the `data/driverImages/` source (unlike `carImages/`, this isn't fetched over network, so a stale bundled copy doesn't 404, it just silently keeps showing the old photo). This script itself is new (2026-08-21) - `src/assets/driver_images/` had been shrunk to 300x450 at some undocumented point in the past, fine while the driver photo only ever rendered as a small tile badge, but once the tile gave the photo its full height and the profile header gave it the full screen width (both this same session), that 300px source was rendering at up to a ~2.5x upscale on a typical phone - visibly blurry, confirmed by the difference before/after regenerating from `data/driverImages/`'s already-close-to-right-sized 683x1024 originals. Two bundled files (`19.webp`/Max Buxton, `132.webp`/James Dorlin, both departed mid-season) have no `data/driverImages/` counterpart to regenerate from and are left as the old 300x450 versions - not touched by this fix, since there's nothing to regenerate them from. Nick Halstead's headshot/car gap (both `driverImages/55.webp` and `carImages/halstead.webp`, the latter confirming his mid-season car carries a separate "Ask GVT" livery from teammate Dexter Patterson's) was filled 2026-08-21; Senna Proctor (reserve-only, no seat of his own) remains the one gap.

Four `carImages/` files (`bensley.webp`, `gilbert.webp`, `halstead.webp`, `sutton.webp`) were replaced 2026-08-21 with genuinely higher-resolution sources the user had on disk, after `DriverDetailScreen`'s car banner was reported "still blurry" - checked before assuming the rest of the 23 needed the same treatment: every other file in the offered source folder turned out to be the *exact same* 1536x1024 render already in the repo, just re-saved as PNG instead of WebP (confirmed via matching `getbbox()` output pixel-for-pixel against the already-committed file, not just eyeballed), so swapping those in would have changed nothing. Only these four were real upgrades (2048x1365-6000x4000, confirmed sharp via a cropped detail region showing genuine photographic texture, not just a bigger canvas). `scripts/generate_car_thumb.py` re-run for just these four regenerates both derived variants from the new source; the other 19 drivers' cars, including the one most tested during this whole feature's development (De Leon), remain as soft as the original source they were always generated from - fixing those needs an actual higher-resolution photo from somewhere, not a reprocessing trick.

`driverImages/7.webp` (Ryan Bensley) and `29.webp` (Lewis Gilbert) are genuine half-body source photos (683x854, not the 683x1024 every other driver's headshot is) - fixed 2026-08-21 by padding transparent space above the head to reach the full 683x1024 canvas with the existing content bottom-aligned, then regenerating both bundled `src/assets/driver_images/{7,29}.webp` from that corrected source. Previously the shorter canvas rendered as a half-body photo floating vertically centered in `DriversScreen`'s tile and `DriverDetailScreen`'s header (both `resizeMode="contain"`, which centers by default) rather than anchored to the bottom edge like every full-body photo - visible as an odd hard crop-line mid-tile rather than a clean cutout against transparent background. Padding doesn't add missing leg/feet content (there isn't any to add), it just repositions what exists to sit where a full-body photo's feet normally would, matching how every other driver's headshot already behaves in both places.

**merge_schedule.py** - Merges scraped session times from `schedule.json` into `calendar.json`. Run after `scrape_schedule.py` as a separate step in `scrape-schedule.yml`.

**build_team_map.py / backfill_team_names.py** - One-off historical data-migration tools, not on any schedule. `build_team_map.py` regenerates `team_name_map.json` from `drivers.json`; `backfill_team_names.py` uses that map to resolve car-model strings into real team names across `results2014.json`-`results2023.json`. Re-run manually only when historical driver/team data changes.

---

## 20. Admin Interface

**File:** [admin/standings-admin.html](admin/standings-admin.html)

Hosted at https://yacobwood.github.io/BTCC/admin/standings-admin.html

A single-page web admin UI with tabs for:

- **Standings** - Update driver and team championship standings in `standings.json`
- **Notifications** - Send broadcast notifications, test notifications to a single device, compose news article deep-link notifications
- **Flags** - Edit all feature flags and per-device overrides in `flags.json`. Includes `broadcaster_override` (uk/international/us) which bypasses IP geolocation on a specific device.
- **Live** - Edit Saturday and Sunday live stream URLs per region (UK, International, US) in `live_urls.json`. Watch Live button only shows when a URL is set for the user's region and day.
- **Hub News** - Compose and publish hub news posts to `hub_news.json`
- **Digests** - Manually trigger the AI digest generation via `triggerDigest` Cloud Function
- **Analytics** - GA4-backed charts sourced from the `analytics_history`/`analytics_daily_history` Firestore collections (populated weekly by the `exportAnalyticsHistory` Cloud Function): daily/weekly user trends, top acquisition sources, platform/OS breakdown and a UK city-level "where users are browsing from" breakdown (`ukCities`, filtered to `country == United Kingdom`, top 10 cities by active users)

All writes go directly to the GitHub repository via the GitHub API (authenticated with a personal access token stored locally in the browser).

---

## 21. Test Suite

**Runner:** Jest 29 + `@testing-library/react-native` 13

**Config:** [jest.config.js](jest.config.js) / [jest.setup.js](jest.setup.js)

Run with: `npm test`

### Coverage

The test suite covers all major stores, utilities, components and screens. Key files:

| Area | Test file |
|---|---|
| API parsers | `__tests__/parsers.test.js` |
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

## 22. Build and Release

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

1. Update `version` and `versionCode` in [package.json](package.json)
2. Update `ios/BTCCFanHub/Info.plist` and `android/app/build.gradle`
3. Update Fastlane metadata
4. Rebuild native bundles and commit

---

## 23. Deep Linking

Configured in `AppNavigator.js` under the `linking` object.

| URL scheme | Maps to |
|---|---|
| `btccfanhub://news/slug-here` | Article screen |
| `btccfanhub://round/5` | TrackDetail for round 5 |
| `btccfanhub://live-timing/event-id` | LiveTimingScreen |
| `btccfanhub://drivers/driver-slug` | DriverDetail |
| `btccfanhub://results/5` | RoundResults for round 5 |
| `https://btcchub.vercel.app/...` | Same routes via universal links |
| `https://btcchub-af77a.firebaseapp.com/...` | Magic link auth completion (handled in `AuthProvider`) |

Notification deep links use the `data` payload fields (`type`, `slug`, `round`) mapped in `notifNavigation.js`.

Magic link auth links are intercepted in `AuthProvider` via `Linking.getInitialURL()` (cold start) and `Linking.addEventListener('url', ...)` (warm start). The pending email is stored in `AsyncStorage` under `magic_link_pending_email` between the user requesting the link and tapping it. If the current user is anonymous, `linkWithCredential` upgrades the existing account rather than creating a new one. The auth modal in `SettingsScreen` auto-closes when `isAnonymous` changes to `false` via a `useEffect` dependency on the context value.

**Email flow:** The `sendMagicLinkEmail` Cloud Function generates a plain Firebase action URL (`/__/auth/action?mode=signIn&oobCode=...`) with no `handleCodeInApp`/Dynamic Links wrapper (Firebase Dynamic Links were shut down August 2025). The button in the email links directly to `btcchub-af77a.firebaseapp.com` - Firebase automatically serves `assetlinks.json` for that domain, so the verified App Link intercepts the tap in Gmail's Chrome Custom Tab and opens the app. `isSignInWithEmailLink` is `await`ed (it is async in the native bridge); without `await` the Promise is always truthy and sign-in is attempted for every URL.

---

## 24. Known Architecture Decisions

**No page transition animations** - `animation: 'none'` is set globally in `screenOptions`. This is intentional for performance and must not be changed.

**`CommonActions.reset()` for nested deep links** - `navigate()` into a nested stack only works when the stack is already mounted. `reset()` sets the full navigation state tree directly and works at any lifecycle stage including cold start.

**stale-while-revalidate everywhere** - The app always shows something immediately (cached data) and refreshes in the background. This is the primary UX pattern for all data fetching.

**Both of `fetchJson`'s stale-cache reads are age-bounded, not just the happy path** - `peekArticlesCache()` (used by `NewsScreen`'s Phase 1 instant-render before the Phase 2 network fetch) only returns a cached page-1 snapshot younger than `ARTICLES_MAX_AGE_MS` (5 minutes, matching the scraper's own refresh cadence); past that age `NewsScreen` falls through to its normal spinner instead. `fetchJson`'s own `staleFallback` catch-path (used when the live fetch itself throws - e.g. `forceRefresh=true` callers like Phase 2, or any pull-to-refresh, which skip the age-checked branch entirely and land straight here on failure) is bounded the same way, rather than "any cached value, even expired." Both exist to close the same underlying symptom: a cache older than one scrape cycle is likely to already have a different top-of-feed order than the live mirror, and showing it - whether via the instant-render path or the network-failure fallback - only to have it replaced by a re-ordered hero/grid a moment later reads as a visible bug ("flash of different articles") rather than a perceived-performance win. Every current `staleFallback` caller (`fetchCalendar`, `fetchDrivers`, `fetchStandings`, `fetchResults`, `fetchBlacklist`, `fetchMerchStores`, `fetchPartners`, `fetchRecords`, the articles endpoints) either has its own bundled-JSON fallback or a call site that already `.catch()`s/`try`s around it, so bounding this catch-path uniformly across all of them doesn't introduce a new unhandled rejection anywhere - confirmed by reading every call site, not assumed.

**GitHub as CDN** - `raw.githubusercontent.com` serves all data files. This is free, fast and allows the admin web UI to update data by committing to the repository without a traditional backend.

**Platform-split radio** - iOS uses `react-native-track-player` for background audio. Android uses a native Java `RadioService` NativeModule because React Native's background capabilities differ significantly between platforms.

**Firestore for user-generated content** - Chat, comments, reactions, bug reports and roadmap votes are stored in Firestore rather than GitHub, as they require write access from untrusted clients with per-document security rules.

**`android:extractNativeLibs="true"`** - AGP 8.x injects `extractNativeLibs="false"` by default, which loads `.so` files directly from the APK zip. This caused a recurring Crashlytics crash (`couldn't find DSO to load: libreactnative.so`) on a subset of Android devices (Samsung/OEM and sideloaded APKs). The app manifest explicitly overrides this to `true` so native libs are extracted to disk on install, making them reliably available to SoLoader on all devices.

**FCM topics not tokens** - All notification subscriptions use named topics managed client-side in `SettingsProvider`. This avoids maintaining a server-side device registry and allows instant opt-in/out without a backend call.

**Spoiler-free expiry on app open** - The mode auto-disables on the next app open after expiry rather than at the exact expiry time. This is simpler and avoids background timer management.

---

*This document is kept up to date with every code change. Last updated: 2026-08-10*
