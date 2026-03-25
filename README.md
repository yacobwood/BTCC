# BTCC Fan Hub — Android App

Unofficial BTCC fan app for Android. Built with Kotlin and Jetpack Compose.

- **Package:** `com.btccfanhub`
- **Min SDK:** 26 · **Target SDK:** 36
- **Current version:** 1.2.0 (versionCode 30)

---

## Features

- Live news feed from btcc.net with infinite scroll and search
- Full race calendar with track guides, timetables and weather forecasts
- Race results and championship standings — 2004 to present
- Championship progression chart and season stats
- Live timing during race weekends (TSL SignalR feed)
- Home screen widget with countdown, session schedule and team themes
- Push notifications for race sessions, qualifying and new results
- BTCC radio stream
- Favourite driver highlighting across grid, standings and results

---

## Architecture

```
app/src/main/java/com/btccfanhub/
├── data/
│   ├── analytics/      # Firebase Analytics wrapper
│   ├── model/          # Data classes (Article, Race, RoundResult, …)
│   ├── network/        # RssParser (WordPress REST API + HTML scraping)
│   ├── repository/     # Data access — calendar, results, standings, weather, …
│   ├── season/         # SeasonData, SeasonStatsComputer, Standings2026
│   └── store/          # SharedPreferences stores (FeatureFlags, Favourites, …)
├── navigation/         # AppNavigation (single-activity Compose nav)
├── ui/
│   ├── calendar/       # CalendarScreen, TrackDetailScreen
│   ├── drivers/        # DriversScreen, DriverDetailScreen, TeamDetailScreen
│   ├── more/           # MoreScreen, InfoPageScreen
│   ├── news/           # NewsScreen, ArticleScreen
│   ├── onboarding/     # NotificationOnboardingScreen, WhatsNewDialog
│   ├── results/        # ResultsScreen, RoundResultsScreen, ChampionshipProgressionChart
│   ├── settings/       # SettingsScreen, BugReportScreen, FeatureFlagsScreen
│   ├── timing/         # LiveTimingScreen
│   └── theme/          # Colours, typography
├── widget/             # CountdownWidget, WidgetUtils, WidgetPrefs, WidgetTheme
└── worker/             # WorkManager jobs — news, results, race notifications
```

---

## Data Sources

| Data | Source |
|---|---|
| News articles | WordPress REST API (`btcc.net/wp-json/wp/v2/posts`) |
| Calendar & track info | GitHub (`yacobwood/BTCC/data/`) |
| Race results (2004–present) | GitHub (`yacobwood/BTCC/data/results{year}.json`) |
| Championship standings | GitHub (`yacobwood/BTCC/data/standings.json`) |
| Driver/team grid | GitHub (`yacobwood/BTCC/data/grid.json`) |
| Session schedule | GitHub (`yacobwood/BTCC/data/schedule.json`) |
| Weather forecasts | Open-Meteo API |
| Live timing | TSL Timing SignalR feed |

---

## Running Tests

```bash
./gradlew testDebugUnitTest
```

121 unit tests covering all non-UI business logic — no Android runtime required.

| Test class | What's covered |
|---|---|
| `ChampionshipProgressionComputerTest` | Cumulative points, round ordering, multi-race rounds |
| `SeasonStatsComputerTest` | Wins / podiums / DNFs / poles / fastest laps, sort order |
| `RaceResultsRepositoryTest` | Full 15-position points table, bonus points, 2023 round reorder |
| `RssParserTest` | Date formatting, HTML entity decoding, HTML stripping, NGG image dedup |
| `WidgetUtilsTest` | Session name abbreviation, timezone conversions (day rollover) |
| `DriverStandingTest` | `displayTeam` computed property |
| `ConstantsTest` | `firstRaceNumberForRound` |

---

## Tools

Python scripts used for data preparation live under `tools/`:

- `tools/scraper/` — scrape results, standings and grid data from btcc.net
- `tools/scripts/` — convert Excel/CSV exports to JSON, verify points totals

---

## AdMob

Real publisher IDs are configured in `local.properties` (not committed). The app uses a banner ad above the bottom navigation bar, hidden on article and detail screens.

---

## Build & Release

```bash
# Debug APK
./gradlew assembleDebug

# Release bundle (requires keystore.properties)
./gradlew bundleRelease
```

Keystore credentials are stored in `keystore.properties` (not committed).
