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
- An in-app news feed combining official BTCC WordPress articles with curated hub content
- A community chat room (feature-flag gated)
- Live radio streams and podcast archive
- Spoiler-free mode to hide results until the user is ready
- An all-time records screen with championship, win, podium and pole statistics

The app is published on both the Apple App Store and Google Play Store.

Current version: **2.14.1** (versionCode 66)

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
| News source | BTCC.net WordPress REST API |
| Podcast source | Buzzsprout RSS |
| Weather | WeatherAPI |
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
│       └── weather.js         WeatherAPI fetch + temperature/condition helpers
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

Four separate notification entry points are wired in `App.tsx`:

| State | Handler |
|---|---|
| App killed - Notifee press | `notifee.getInitialNotification()` |
| App background - FCM tap | `onNotificationOpenedApp()` |
| App killed - FCM tap | `getInitialNotification()` |
| App foregrounded | `notifee.onForegroundEvent()` |

All four call `navigateFromData(navigationRef, data)` from [src/utils/notifNavigation.js](src/utils/notifNavigation.js).

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
Combines two feeds: official btcc.net WordPress articles (via REST API) and curated hub posts (from `hub_news.json` on GitHub). Features: search with debounce, pagination, hideDigests filter toggle, real-time Firestore reactions (emoji voting). Hub news requires `hub_news_enabled` feature flag. Article cards show category, date and featured image. Favourite driver highlighting applied when a driver's name appears in article title.

**ArticleScreen** ([src/screens/ArticleScreen.js](src/screens/ArticleScreen.js))
WebView article reader for btcc.net articles. Adds Firestore comments (with commenter name input and optimistic posting), like/dislike reactions, share button and external link option. Tracks scroll depth for Firebase Analytics. Accepts either a full article object or just a `slug` parameter (fetches by slug if needed). Signed-in users can edit and delete their own comments - edit uses Firestore REST PATCH with `updateMask.fieldPaths` to update only `text` and `editedAt` without touching reactions. Edited comments show an "edited" label. Delete uses Firestore REST DELETE and removes the item from local state optimistically.

**DigestsScreen** ([src/screens/DigestsScreen.js](src/screens/DigestsScreen.js))
Lists AI-generated weekly digest articles from hub_news.json filtered to the Weekly Digest category.

### Calendar Stack

**CalendarScreen** ([src/screens/CalendarScreen.js](src/screens/CalendarScreen.js))
Renders all rounds from `calendar.json`. Highlights the current/next active round. Tapping a round navigates to TrackDetail.

**TrackDetailScreen** ([src/screens/TrackDetailScreen.js](src/screens/TrackDetailScreen.js))
Hero image, WeatherAPI weather widget (gated on `track_weather` flag), track facts (length, corners, first BTCC year), About section, BTCC Fact, session schedule with day/time, lap records (qualifying + race), YouTube race replay links (gated to UK users only via locale check), and a UK map pin showing circuit location. A "Live Timing" button appears during active race weekends when `tslEventId` is set and the flag is enabled.

**LiveTimingScreen** ([src/screens/LiveTimingScreen.js](src/screens/LiveTimingScreen.js))
WebView embedding the TSL live timing interface. Only rendered when `live_timing_in_app` feature flag is true.

### Grid/Drivers Stack

**DriversScreen** ([src/screens/DriversScreen.js](src/screens/DriversScreen.js))
Two-tab view: Drivers (card grid with number, photo, team, car class) and Teams (team cards with car image). Drivers can be starred as favourites. Tapping navigates to DriverDetail or TeamDetail.

**DriverDetailScreen** ([src/screens/DriverDetailScreen.js](src/screens/DriverDetailScreen.js))
Full driver profile: photo, number, nationality, team, car, DOB (with live age calculation), birthplace, bio text, career statistics (wins/podiums/poles/fastest laps per year), and computed live 2026 championship standings from results data. Favourite toggle. History rendered as a scrollable year table.

**TeamDetailScreen** ([src/screens/TeamDetailScreen.js](src/screens/TeamDetailScreen.js))
Team profile: car image, bio, founded year, base, current drivers, championships won, historical standings.

### Results Stack

**ResultsScreen** ([src/screens/ResultsScreen.js](src/screens/ResultsScreen.js))
Year selector (2004 - 2026) via `YearWheelPicker` modal. Four tabs:
- Drivers Standings - position, points, wins, 2nds, 3rds
- Teams Standings - points by team
- Season Table (`SeasonTable` component) - race-by-race result grid with DSQ/Ret/DNS/FL/PP badges
- Progression Chart (`ProgressionChart` component) - SVG line chart of points accumulation per round

**RoundResultsScreen** ([src/screens/RoundResultsScreen.js](src/screens/RoundResultsScreen.js))
Per-round detail. `SwipeableTabs` with lazy loading across all sessions: Free Practice, Qualifying, Qualifying Race, Race 1, Race 2, Race 3. Each tab shows: position badges (P1=gold, P2=silver, P3=bronze), grid position delta arrows (↑/↓), points awarded, fastest lap / lead lap / pole bonuses. Non-finisher labels: `DQ` (disqualified, driven by a `status: "DQ"` field in the result), `DNS` (did not start - pos 0, laps 0, no DQ status) or `DNF` (did not finish - pos 0, laps > 0). Before results land, if a TSL grid PDF has been scraped, shows a `StartingGridTab` with a two-column staggered layout mirroring the physical grid. R3 shows a `ReverseGridTab` prediction stepper as fallback when no actual grid data exists yet. For UK users, race tabs show a "Watch Full Race" YouTube button when a URL is available - for 2026 this falls back to bundled URLs from `results2026.json`; for past years the button only appears if the round's own `youtubeUrls` field is populated.

### More Stack

**MoreScreen** ([src/screens/MoreScreen.js](src/screens/MoreScreen.js))
Menu screen. Static rows: Records, Settings, About BTCC (InfoPage), Roadmap, Partners, Feedback (BugReport). Flag-gated rows: Radio and Podcasts (both require `podcasts_enabled` or `radio_tab` flags).

**SettingsScreen** ([src/screens/SettingsScreen.js](src/screens/SettingsScreen.js))
All notification toggles with parent/child hierarchy (toggling a parent enables/disables all children). Spoiler-free mode toggle. Unit system (km/miles). Device ID and FCM token display for admin/debugging.

**RadioScreen** ([src/screens/RadioScreen.js](src/screens/RadioScreen.js))
List of live radio streams from `radio.json`. Platform-specific playback: iOS uses `react-native-track-player`, Android uses a native `RadioService`. A Stop button appears in the header when a station is playing.

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
Firebase Realtime Database community chat. 200 message limit (enforced by `trimChat` Cloud Function). Profanity filter via `blacklist.json`. 3-flag auto-hide via atomic RTDB transaction (prevents race conditions from concurrent flags). Name prompt on first post (stored as `commenter_name` in AsyncStorage). 300 character limit. Security rules in `database.rules.json` enforce field types, length limits, immutability of text/author/timestamp after creation, and that flagCount can only increase and hidden can only go true - never back to false. Opened via `ChatFab` floating button (not a tab). Accepts an `onClose` prop that shows a back arrow in the header when provided.

**Ban system:** Admins can ban users via the Chat tab in the admin panel. Bans are stored at `/chat/bans/{authorId}` (authorId = first 8 chars of FCM token). The `onChatBan` Cloud Function triggers on creation, hides all existing messages from the banned user, and writes a `ban_notice` system message. The banned user sees a locked input row instead of the text field. Temporary bans (1h / 24h / 7d) expire automatically via `expiresAt` timestamp checked client-side; permanent bans have `expiresAt: null`. Unbanning deletes the `/chat/bans/{authorId}` node.

**ListenScreen** ([src/screens/ListenScreen.js](src/screens/ListenScreen.js))
Entry point routing to Radio and Podcasts sections.

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
| `track_weather` | - | Enable WeatherAPI widget |
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
| Articles page | `news_p{page}` | 1 hour |
| Hub posts | `hub_posts` | 5 minutes |
| Live status | `live_status` | 2 minutes |

### Public API Functions

| Function | Source | Notes |
|---|---|---|
| `fetchCalendar(year)` | GitHub or bundled JSON | Fallback to bundled on network error |
| `fetchDrivers()` | GitHub or bundled JSON | staleFirst; bundled fallback |
| `fetchStandings(forceRefresh?)` | GitHub | staleFallback |
| `fetchResults(year, forceRefresh?)` | GitHub | 5-minute cache |
| `fetchArticles(page, perPage, search)` | WordPress REST API | No cache for search queries |
| `peekArticlesCache(page)` | AsyncStorage only | Returns stale data without network call |
| `fetchHubPosts()` | GitHub + device ID filter | Handles published/scheduled/draft states |
| `fetchArticleBySlug(slug)` | WordPress REST API | staleFirst |
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
| GitHub raw CDN | `https://raw.githubusercontent.com/yacobwood/BTCC/main/data` | drivers, standings, results, hub_news, flags, calendar, schedule, roadmap, radio, blacklist, live_status, team_map |
| BTCC WordPress | `https://www.btcc.net/wp-json/wp/v2` | News articles |
| Buzzsprout RSS | Configured URL | Podcast episodes |
| WeatherAPI | API key in config | Current weather at circuit location |
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
| `standings.json` | Current season driver and team standings |
| `results{year}.json` | Full results for a season (2004 - 2026), including grids from TSL PDFs |
| `flags.json` | Feature flags + per-device overrides |
| `hub_news.json` | Hub-curated news posts including AI-generated digests |
| `roadmap.json` | Feature roadmap items with status |
| `radio.json` | Live radio station URLs |
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

All notification subscriptions are topic-based (not individual tokens), managed by `SettingsProvider.syncAllTopics()`:

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

Only top-level tab navigations (no nested screen) use `navigate()`.

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
- Pre-session alerts: 15 minutes before each session start time from `schedule.json`
- Friday 9am: race weekend preview notification to `weekend_preview` topic
- Tuesday 9am: standings update notification to `standings_update` topic
- Post-session results: triggered when session results land in `results{year}.json`

**Always runs (every minute, regardless of race day):**
- News alerts: polls `btcc.net/wp-json/wp/v2/posts?per_page=1`, compares latest `id` to Firestore `state/news.lastId`. Sends to `news_alerts` on change. Includes `slug` + `imageUrl` in payload. Logic lives in `functions/newsCheck.js` (injected deps for testability).
- Hub news alerts: polls `hub_news.json`, compares latest `id` to Firestore `state/hub_news.lastId`. Sends to `news_alerts`. Excludes "Weekly Digest" category articles.
- Podcast alerts: polls Buzzsprout RSS, compares `guid` to Firestore state. Sends to `podcast_alerts`.

Firestore transactions prevent duplicate sends. First-time detection (when `lastId` is null) stores the ID but does NOT send a notification.

**Error alerting:** every `logError` call uses `alert: true`. For per-minute checks (news/hub/podcast/FCM) the error is upserted at a fixed key and the email is only sent on first occurrence or when the error recurs after being marked resolved in the admin FIRESTORE tab. One-off failures (syncAnalytics, notifyResultsUpdate, digest generation) always email. All alerts go to `btcchub@gmail.com` via `GMAIL_APP_PASSWORD` secret.

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
i cant see it

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

### Empty State Logic

```
if no results yet:
  if race.grid has data  → show StartingGridTab
  if R3                  → show ReverseGridTab (prediction stepper)
```

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

**backgroundPrefetch.js** - Prefetches driver and article images into the React Native image cache on app start.

**broadcaster.js** - Simple event emitter for cross-component state broadcast.

**deviceId.js** - Generates a stable anonymous UUID stored in AsyncStorage. Used for hub post draft previews and roadmap vote deduplication.

**digestRead.js** - Tracks which digest article IDs have been read (AsyncStorage).

**driverName.js** - Formats driver names as "Firstname LASTNAME" (e.g. `Tom INGRAM`). Used consistently across all screens for display.

**notifNavigation.js** - Maps notification `data` payloads to navigation actions. Uses `CommonActions.reset()` for all nested screen navigations.

**notifications.js** - Sets up Android notification channels. Requests OS permission. Registers foreground FCM message handler.

**profanityFilter.js** - Checks input text against the `blacklist.json` word list. Used in ChatScreen and BugReportScreen.

**reviewPrompt.js** - Decides when to trigger `react-native-in-app-review` based on usage events.

**signalr.js** - TSL SignalR client. Handles WebSocket negotiation, handshake, `registerForEvent`, session/entry parsing, pong responses (type 6), reconnection and teardown.

**timeAgo.js** - Returns relative time strings ("2 hours ago", "3 days ago") from a date string.

**weather.js** - Fetches forecast weather from Open-Meteo for a circuit's lat/lng over its race weekend dates. Only fetches when the round is within 7 days and not a past weekend. Uses a manual AbortController for the 8-second timeout (AbortSignal.timeout is unreliable on Android/Hermes). Helpers for WMO weather code descriptions, icons and icon colours. The same 7-day limit applies in BTCCWidget.swift (iOS) and LargeWidget.kt (Android) - these are independent constants that must be kept in sync manually.

---

## 19. Python Scrapers

Located in [tools/scraper/](tools/scraper/). Run manually or via CI to update data files on GitHub.

**scrape_tsl.py** - Main results and grid scraper. Fetches TSL timing PDFs for each session. Parses race results and starting grids. Writes to `results{year}.json`. Non-finisher results carry `pos: 0`; disqualifications additionally carry `status: "DQ"`. At the end of each run it also updates circuit lap records in `calendar.json` and triggers `compute_records.py`.

**compute_records.py** - All-time records computer. Reads all bundled season JSONs (2004-2025) and the live `results{year}.json` file to compute every stat shown on the RecordsScreen (wins, podiums, poles, streaks, consecutive finishes, hat tricks, etc.). Applies official wins/championships overrides from btcc.net for modern drivers. Preserves `historical: true` entries (pre-2004 era drivers) from the existing `records.json`. Writes `records.json`. Called automatically by `scrape_tsl.py` after each scrape.

**scrape_calendar.py** - Parses the BTCC calendar to update `calendar.json` with round dates, venues and session times.

**scrape_schedule.py** - Updates `schedule.json` with precise session start times for Cloud Function pre-session alert timing.

**scrape_youtube.py** - Associates YouTube race replay URLs with rounds in the results JSON.

**merge_schedule.py** - Merges schedule data from multiple sources.

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
- Auth modal submit button has `accessibilityLabel="Log in to account"` (login) or `"Create account"` (register) to distinguish it from the modal title

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

Notification deep links use the `data` payload fields (`type`, `slug`, `round`) mapped in `notifNavigation.js`.

---

## 24. Known Architecture Decisions

**No page transition animations** - `animation: 'none'` is set globally in `screenOptions`. This is intentional for performance and must not be changed.

**`CommonActions.reset()` for nested deep links** - `navigate()` into a nested stack only works when the stack is already mounted. `reset()` sets the full navigation state tree directly and works at any lifecycle stage including cold start.

**stale-while-revalidate everywhere** - The app always shows something immediately (cached data) and refreshes in the background. This is the primary UX pattern for all data fetching.

**GitHub as CDN** - `raw.githubusercontent.com` serves all data files. This is free, fast and allows the admin web UI to update data by committing to the repository without a traditional backend.

**Platform-split radio** - iOS uses `react-native-track-player` for background audio. Android uses a native Java `RadioService` NativeModule because React Native's background capabilities differ significantly between platforms.

**Firestore for user-generated content** - Chat, comments, reactions, bug reports and roadmap votes are stored in Firestore rather than GitHub, as they require write access from untrusted clients with per-document security rules.

**`android:extractNativeLibs="true"`** - AGP 8.x injects `extractNativeLibs="false"` by default, which loads `.so` files directly from the APK zip. This caused a recurring Crashlytics crash (`couldn't find DSO to load: libreactnative.so`) on a subset of Android devices (Samsung/OEM and sideloaded APKs). The app manifest explicitly overrides this to `true` so native libs are extracted to disk on install, making them reliably available to SoLoader on all devices.

**FCM topics not tokens** - All notification subscriptions use named topics managed client-side in `SettingsProvider`. This avoids maintaining a server-side device registry and allows instant opt-in/out without a backend call.

**Spoiler-free expiry on app open** - The mode auto-disables on the next app open after expiry rather than at the exact expiry time. This is simpler and avoids background timer management.

---

*This document is kept up to date with every code change. Last updated: 2026-05-16*
