# Implementation Plan: Tablet Master-Detail Layout

## Overview

Extend the existing CalendarScreen master-detail pattern to Results, Drivers, and News screens. On tablet (≥600dp), each screen renders a two-column Row with a 360dp master pane, 1dp divider, and flexible detail pane. On phone (<600dp), all screens retain current navigation. Also update CalendarScreen's breakpoint from 840dp to 600dp for consistency.

## Tasks

- [x] 1. Create shared DetailPlaceholder composable and update CalendarScreen breakpoint
  - [x] 1.1 Create a `DetailPlaceholder` composable in a shared location (e.g. `ui/components/DetailPlaceholder.kt`)
    - Accept a `message: String` parameter
    - Render a centered `Text` on `BtccBackground` using `BtccTextSecondary` color and `bodyLarge` style
    - Follow the design's `DetailPlaceholder` specification exactly
    - _Requirements: 1.4, 2.5, 3.4, 4.1, 4.2, 4.3_
  - [x] 1.2 Update `CalendarScreen.kt` breakpoint from `screenWidthDp >= 840` to `screenWidthDp >= 600`
    - Change the `isTablet` check at the top of `CalendarScreen` from `>= 840` to `>= 600`
    - Verify the existing master-detail layout still works correctly at the new breakpoint
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Add `showBackButton` parameter to detail screens
  - [x] 2.1 Add `showBackButton: Boolean = true` to `RoundResultsScreen`
    - Wrap the `IconButton(onClick = onBack)` in the `navigationIcon` block with `if (showBackButton)`
    - Wrap the `BackHandler` call with `if (showBackButton)`
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 2.2 Add `showBackButton: Boolean = true` to `DriverDetailScreen` and `TeamDetailScreen` in `DriversScreen.kt`
    - Make both composables `internal` (not private) so they can be used from the master-detail branch
    - Wrap the back `IconButton` and `BackHandler` with `if (showBackButton)` in both screens
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 2.3 Add `showBackButton: Boolean = true` to `ArticleScreen`
    - Wrap the back `IconButton` and `BackHandler` with `if (showBackButton)` in `ArticleScreen.kt`
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 2.4 Write property test for showBackButton parameter (Property 5)
    - **Property 5: Back button visibility controlled by showBackButton parameter**
    - **Validates: Requirements 6.1, 6.2**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Results screen master-detail layout
  - [x] 4.1 Add tablet master-detail branch to `ResultsScreen`
    - Add `var selectedRound by remember { mutableStateOf<Pair<Int,Int>?>(null) }` for (year, round)
    - On tablet (`screenWidthDp >= 600`): wrap existing `Column` content in a `Row` — left 360dp pane contains the full existing content (TopAppBar, year selector, tabs, pager), right pane renders `RoundResultsScreen` inline with `showBackButton = false`, keyed on `selectedRound`
    - When no round is selected, show `DetailPlaceholder("Select a round to view results")`
    - Modify the `onRoundClick` callback: on tablet, set `selectedRound`; on phone, call the existing navigation lambda
    - Preserve all existing tabs (Drivers, Teams, Results, Stats, Chart) and year selector in the master pane
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 5.1_
  - [x] 4.2 Write property test for Results master-detail layout (Property 1)
    - **Property 1: Master-detail layout structure on tablet**
    - **Validates: Requirements 1.1, 4.1, 4.2, 4.3**
  - [x] 4.3 Write property test for Results item selection (Property 2)
    - **Property 2: Item selection updates detail pane inline on tablet**
    - **Validates: Requirements 1.2, 5.1**

- [x] 5. Implement Drivers screen master-detail layout
  - [x] 5.1 Add tablet master-detail branch to `DriversScreen`
    - On tablet (`screenWidthDp >= 600`): replace the current `when` block with a `Row`-based master-detail layout
    - Left 360dp pane: `GridTabs` composable (existing drivers/teams pager with TopAppBar and TabRow)
    - Right pane: `DriverDetailScreen` or `TeamDetailScreen` based on `selectedDriver`/`selectedTeam`, with `showBackButton = false`, keyed on the selected item
    - When no driver/team is selected, show `DetailPlaceholder("Select a driver or team")`
    - On tablet, driver/team click callbacks set `selectedDriver`/`selectedTeam` state; on phone, keep existing `BackHandler`-based navigation
    - Ensure `GridTabs` and detail screens are accessible from the master-detail branch (adjust visibility from `private` to `internal` as needed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4_
  - [x] 5.2 Write property test for Drivers master-detail layout (Property 1)
    - **Property 1: Master-detail layout structure on tablet**
    - **Validates: Requirements 2.1, 4.1, 4.2, 4.3**

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement News screen master-detail layout
  - [x] 7.1 Add tablet master-detail branch to `NewsScreen`
    - Add `var selectedArticle by remember { mutableStateOf<Article?>(null) }`
    - On tablet (`screenWidthDp >= 600`): wrap the existing `Column` (search bar + PullToRefreshBox) in a `Row` — left 360dp pane contains the full news feed (hero card, grid cards, compact cards, search, FAB, pull-to-refresh, infinite scroll), right pane renders `ArticleScreen` inline with `showBackButton = false`
    - When no article is selected, show `DetailPlaceholder("Select an article to read")`
    - On tablet, article click callbacks set `selectedArticle` and update `ArticleHolder.current`; on phone, call the existing navigation lambda
    - Use `key(selectedArticle)` on the detail pane to reset scroll/WebView state on selection change
    - Preserve all existing feed functionality in the master pane (hero, grid, search, pull-to-refresh, scroll-to-top FAB, infinite scroll)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.2_
  - [x] 7.2 Write property test for News master-detail layout (Property 1)
    - **Property 1: Master-detail layout structure on tablet**
    - **Validates: Requirements 3.1, 4.1, 4.2, 4.3**

- [x] 8. Update navigation and deep link handling for tablet
  - [x] 8.1 Update `AppNavigation.kt` for tablet navigation bypass
    - In the `Screen.News` composable: on tablet, pass an `onArticleClick` that sets local state instead of navigating via NavController. On phone, keep existing `navController.navigate(Screen.Article.route)` behavior
    - In the `Screen.Results` composable: on tablet, pass an `onRoundClick` that sets local state instead of navigating. On phone, keep existing `navController.navigate(Screen.RoundResults.route(...))` behavior
    - The `Screen.RoundResults` and `Screen.Article` routes remain for phone navigation and deep links
    - No changes needed for `Screen.Drivers` (already uses BackHandler, not NavController routes)
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 8.2 Update deep link handling in `MainActivity.kt` for tablet
    - For article deep links (`pendingArticleId`, `pendingArticleSlug`): on tablet, navigate to `Screen.News` and pass the article as a selection parameter instead of navigating to `Screen.Article`
    - For results deep links (`pendingOpenResults`, `pendingResultsRound`): on tablet, navigate to `Screen.Results` and pass the round as a selection parameter instead of navigating to `Screen.RoundResults`
    - On phone, keep existing deep link navigation unchanged
    - _Requirements: 5.4_
  - [x] 8.3 Write property test for phone navigation preservation (Property 3)
    - **Property 3: Phone navigation behavior preserved**
    - **Validates: Requirements 1.3, 2.4, 3.3, 5.3**

- [x] 9. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The CalendarScreen's existing master-detail implementation serves as the canonical reference pattern
- Detail screens (`RoundResultsScreen`, `DriverDetailScreen`, `TeamDetailScreen`, `ArticleScreen`) are reused in the detail pane with `showBackButton = false`
