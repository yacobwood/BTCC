# Requirements Document

## Introduction

The BTCC Fan Hub app currently implements a master-detail layout on the Calendar screen for tablet devices (≥600dp or ≥840dp width). This feature expands the same master-detail pattern to three additional screens — Results, Drivers, and News — so that tablet users see a list pane alongside a detail pane instead of navigating to full-screen detail routes. The existing CalendarScreen implementation (Row with 360dp left pane, 1dp divider, flexible right pane) serves as the reference pattern.

## Glossary

- **Master_Pane**: The fixed-width left column (360dp) displaying a scrollable list of items (rounds, drivers, articles)
- **Detail_Pane**: The flexible-width right column displaying the full detail content for the selected item
- **Tablet_Device**: A device where `LocalConfiguration.current.screenWidthDp >= 600`
- **Wide_Tablet**: A device where `LocalConfiguration.current.screenWidthDp >= 840`
- **Master_Detail_Layout**: A two-column Row layout with a Master_Pane, a 1dp vertical divider, and a Detail_Pane
- **Results_Screen**: The screen displaying championship standings, race results, stats, and chart tabs with a year selector
- **RoundResults_Screen**: The detail screen showing individual race results for a specific round
- **Drivers_Screen**: The screen displaying the driver grid and team list with a pager (Drivers/Teams tabs)
- **DriverDetail_Screen**: The detail screen showing a driver's bio, stats, and career history
- **TeamDetail_Screen**: The detail screen showing a team's details and driver roster
- **News_Screen**: The screen displaying a feed of news articles with hero card, grid cards, and compact cards
- **Article_Screen**: The detail screen rendering a full news article via WebView
- **Phone_Device**: A device where `LocalConfiguration.current.screenWidthDp < 600`
- **Navigation_Router**: The AppNavHost composable that manages route-based navigation via NavController

## Requirements

### Requirement 1: Results Screen Master-Detail Layout

**User Story:** As a tablet user, I want to see the standings/results list alongside the round detail, so that I can browse rounds without losing context of the standings.

#### Acceptance Criteria

1. WHILE the Results_Screen is displayed on a Tablet_Device, THE Results_Screen SHALL render a Master_Detail_Layout with the standings/tabs content in the Master_Pane and the RoundResults_Screen in the Detail_Pane
2. WHEN a user taps a round in the Results tab on a Tablet_Device, THE Results_Screen SHALL display the corresponding RoundResults_Screen in the Detail_Pane without performing a full-screen navigation
3. WHILE the Results_Screen is displayed on a Phone_Device, THE Results_Screen SHALL retain the existing full-screen navigation to the RoundResults_Screen route
4. WHEN the Results_Screen first loads on a Tablet_Device, THE Detail_Pane SHALL display a placeholder or the most recent completed round
5. THE Master_Pane in the Results_Screen SHALL retain all existing tabs (Drivers, Teams, Results, Stats, Chart) and the year selector

### Requirement 2: Drivers Screen Master-Detail Layout

**User Story:** As a tablet user, I want to see the driver list alongside driver details, so that I can quickly compare drivers without navigating back and forth.

#### Acceptance Criteria

1. WHILE the Drivers_Screen is displayed on a Tablet_Device, THE Drivers_Screen SHALL render a Master_Detail_Layout with the driver/team list in the Master_Pane and the selected detail in the Detail_Pane
2. WHEN a user taps a driver card on a Tablet_Device, THE Drivers_Screen SHALL display the DriverDetail_Screen in the Detail_Pane without performing a full-screen navigation
3. WHEN a user taps a team card on a Tablet_Device, THE Drivers_Screen SHALL display the TeamDetail_Screen in the Detail_Pane without performing a full-screen navigation
4. WHILE the Drivers_Screen is displayed on a Phone_Device, THE Drivers_Screen SHALL retain the existing in-screen navigation behavior (BackHandler-based detail screens)
5. WHEN the Drivers_Screen first loads on a Tablet_Device with no selection, THE Detail_Pane SHALL display a placeholder prompting the user to select a driver or team
6. THE Master_Pane in the Drivers_Screen SHALL retain the existing Drivers/Teams tab pager

### Requirement 3: News Screen Master-Detail Layout

**User Story:** As a tablet user, I want to read articles alongside the news feed, so that I can browse and read without losing my scroll position.

#### Acceptance Criteria

1. WHILE the News_Screen is displayed on a Tablet_Device, THE News_Screen SHALL render a Master_Detail_Layout with the article feed in the Master_Pane and the Article_Screen in the Detail_Pane
2. WHEN a user taps an article on a Tablet_Device, THE News_Screen SHALL display the Article_Screen in the Detail_Pane without performing a full-screen navigation
3. WHILE the News_Screen is displayed on a Phone_Device, THE News_Screen SHALL retain the existing full-screen navigation to the Article_Screen route
4. WHEN the News_Screen first loads on a Tablet_Device with no article selected, THE Detail_Pane SHALL display a placeholder prompting the user to select an article
5. THE Master_Pane in the News_Screen SHALL retain all existing functionality including hero card, grid cards, search, pull-to-refresh, scroll-to-top FAB, and infinite scroll

### Requirement 4: Consistent Master-Detail Pattern

**User Story:** As a developer, I want all master-detail layouts to follow the same structural pattern, so that the tablet experience is visually consistent and maintainable.

#### Acceptance Criteria

1. THE Master_Pane across all master-detail screens SHALL use a fixed width of 360dp
2. THE Master_Detail_Layout across all screens SHALL include a 1dp vertical divider between the Master_Pane and the Detail_Pane
3. THE Detail_Pane across all master-detail screens SHALL use flexible width (Modifier.weight(1f)) to fill remaining horizontal space
4. WHEN the selected item changes in any Master_Pane, THE Detail_Pane SHALL recompose with the new detail content using a Compose `key` block to reset scroll state

### Requirement 5: Navigation Bypass on Tablet

**User Story:** As a tablet user, I want detail screens to appear inline rather than as separate routes, so that the navigation stack stays clean and the back button behaves predictably.

#### Acceptance Criteria

1. WHILE a Tablet_Device displays the Results_Screen, THE Navigation_Router SHALL suppress navigation to the RoundResults_Screen route when a round is tapped
2. WHILE a Tablet_Device displays the News_Screen, THE Navigation_Router SHALL suppress navigation to the Article_Screen route when an article is tapped
3. WHILE a Phone_Device is in use, THE Navigation_Router SHALL continue to navigate to full-screen detail routes for all screens
4. IF a deep link or notification targets a detail screen on a Tablet_Device, THEN THE Navigation_Router SHALL navigate to the parent screen and select the appropriate item in the Detail_Pane

### Requirement 6: Detail Pane Back Button Suppression

**User Story:** As a tablet user, I want the detail pane to not show a back arrow, so that the layout feels like a single integrated screen rather than stacked pages.

#### Acceptance Criteria

1. WHILE a detail screen is rendered inside a Detail_Pane on a Tablet_Device, THE detail screen SHALL hide the back navigation button
2. WHILE a detail screen is rendered as a full-screen route on a Phone_Device, THE detail screen SHALL display the back navigation button
3. THE CalendarScreen's existing `showBackButton = false` pattern for TrackDetailScreen SHALL serve as the reference implementation for back button suppression
