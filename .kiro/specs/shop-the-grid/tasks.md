# Implementation Plan: Shop the Grid (BTCC Merch Hub)

## Overview

Implement the Shop the Grid contextual merchandise discovery feature following the existing MVVM + Repository pattern. The feature is gated behind a ConfigCat feature flag (`merch_hub_enabled`) and uses the existing OkHttp/NetworkDiskCache/Analytics infrastructure. Implementation proceeds in six phases: foundation, business logic, UI components, main screen + navigation, context integration, and tests.

## Tasks

- [x] 1. Foundation — data models, repository, analytics, feature flag, build config
  - [x] 1.1 Add Kotest dependencies to `app/build.gradle.kts`
    - Add `testImplementation("io.kotest:kotest-runner-junit5:5.9.1")`, `kotest-property:5.9.1`, `kotest-assertions-core:5.9.1`, and `kotlinx-coroutines-test:1.8.1` in the `dependencies` block
    - _Requirements: Testing Strategy (design.md)_

  - [x] 1.2 Create `data/model/MerchModels.kt` with all merch data classes
    - Define `SellerType` enum (`OFFICIAL`, `TEAM`, `INDEPENDENT`, `COLLECTIBLE`)
    - Define `MerchItem` data class with all fields from Requirement 2.2 (`id`, `title`, `imageUrl`, `price`, `currency`, `sellerName`, `sellerType`, `purchaseUrl`, `affiliateParams`, `sponsored`, `driverIds`, `teamIds`, `roundTags`)
    - Define `Seller` data class with fields from Requirement 2.3 (`id`, `displayName`, `sellerType`, `logoUrl`, `discountCode`)
    - Define `MerchFeed` data class (`lastUpdated`, `items`, `sellers`)
    - Define `MerchSection` data class (`title`, `items`, `sellers`)
    - Define `ClickEvent` data class and `ClickEventType` enum (`ITEM_TAPPED`, `DISCOUNT_CODE_COPIED`)
    - _Requirements: 2.2, 2.3, 2.5_

  - [x] 1.3 Add `merch_hub_enabled` feature flag to `data/store/FeatureFlagsStore.kt`
    - Add `const val KEY_MERCH_HUB = "merch_hub_enabled"` constant
    - Add `val merchHubEnabled = MutableStateFlow(false)` property
    - Add `val merchFeedUrl = MutableStateFlow("")` property for ConfigCat-supplied feed URL
    - Wire `KEY_MERCH_HUB` into `applyAll()` and `apply()` with default `false`
    - _Requirements: 1.1 (design flag gate)_

  - [x] 1.4 Add merch analytics events to `data/analytics/Analytics.kt`
    - Add `fun merchItemTapped(itemId, sellerId, sellerType, sponsored, affiliateMissing)` logging `merch_item_tapped` event
    - Add `fun discountCodeCopied(sellerId, discountCode)` logging `discount_code_copied` event — use `discountCode.take(50)`, no PII
    - Add `fun merchSectionViewed(sectionTitle)` logging `merch_section_viewed` event
    - _Requirements: 5.3, 5.4, 7.3, 7.4_

  - [x] 1.5 Create `data/repository/MerchRepository.kt`
    - Mirror `DriversRepository` structure: `object MerchRepository`, `CACHE_KEY = "merch"`, `TTL_MS = 60 * 60_000L`
    - Implement `suspend fun fetchFeed(): MerchFeed` with in-memory cache check, OkHttp fetch using `FeatureFlagsStore.merchFeedUrl`, `NetworkDiskCache.write/read` fallback
    - Implement `internal fun parse(json: String): MerchFeed` using `JSONObject`/`JSONArray` — parse all `MerchItem` and `Seller` fields; wrap in `runCatching` and log parse errors to `FirebaseCrashlytics.getInstance().recordException(e)`
    - Implement `private fun diskFallback(): MerchFeed`
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 1.6 Write unit tests for `MerchRepository.parse()`
    - Test valid full feed JSON produces correct `MerchFeed` with all fields populated
    - Test feed with missing optional fields (`discountCode`, `driverIds`, `teamIds`, `roundTags`) parses without error
    - Test malformed JSON returns empty `MerchFeed` (not a crash)
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 2. Business logic — section assembly and ViewModel
  - [x] 2.1 Implement `buildAffiliateUrl(item: MerchItem): Pair<String, Boolean>` pure function in `MerchModels.kt` or a new `AffiliateUrl.kt` file
    - If `affiliateParams` is empty, return `Pair(item.purchaseUrl, true)` (`affiliateMissing = true`)
    - Otherwise build URI with `Uri.parse(item.purchaseUrl).buildUpon()`, append each param via `appendQueryParameter`, return `Pair(uri.build().toString(), false)`
    - _Requirements: 5.1, 5.5_

  - [ ]* 2.2 Write property test for `buildAffiliateUrl` — Property 10
    - `// Feature: shop-the-grid, Property 10: Affiliate URL construction appends all params`
    - Use `Arb.map(Arb.string(1..20), Arb.string(1..20))` for `affiliateParams`
    - Assert: non-empty params → all key-value pairs present in result URL and `affiliateMissing == false`
    - Assert: empty params → original `purchaseUrl` returned unchanged and `affiliateMissing == true`
    - Run minimum 100 iterations
    - **Validates: Requirements 5.1, 5.5**

  - [x] 2.3 Create `ui/merch/MerchViewModel.kt`
    - Define `MerchUiState` sealed class: `Loading`, `Success(sections, showFeaturedBanner, showRaceWeekendBanner, winnerDriverId)`, `Error(cachedSections)`
    - Implement `class MerchViewModel : ViewModel()` with `val uiState: StateFlow<MerchUiState>`
    - Implement `fun load()` in `viewModelScope.launch`: fetch `MerchFeed`, fetch active round from `ScheduleRepository`, determine `winnerDriverId` (result within 2 hours), assemble sections in required order (Official → Weekend → Team → Fan), apply sponsored-first sort within each section, apply winner promotion, emit `Success` or `Error`
    - Implement `fun itemTapped(item: MerchItem, context: Context)`: call `buildAffiliateUrl`, open URL via `Intent(ACTION_VIEW)`, call `Analytics.merchItemTapped`, record `ClickEvent`
    - Implement `fun discountCodeCopied(seller: Seller, context: Context)`: copy `seller.discountCode` to clipboard, call `Analytics.discountCodeCopied`, record `ClickEvent` of type `DISCOUNT_CODE_COPIED`
    - Implement `fun getDriverItems(driverId: Int): List<MerchItem>` returning up to 4 items where `driverIds.contains(driverId)`
    - Implement `fun getTeamItems(teamName: String): List<MerchItem>` returning up to 4 items where `teamIds.contains(teamName)`
    - _Requirements: 1.2, 1.3, 3.1–3.5, 4.1–4.3, 5.1–5.5, 6.2, 6.3, 7.2, 7.3, 10.3_

  - [ ]* 2.4 Write property tests for section assembly — Properties 4, 5, 6, 7, 8
    - Extract section assembly into a pure `assembleSections(feed, currentRound, isRaceWeekend, winnerDriverId, winnerTimestampMs)` function testable without Android context
    - **Property 4**: `// Feature: shop-the-grid, Property 4: Items route to correct section by seller type` — use `Arb.list(Arb.merchItem())`, assert every item appears in exactly one section, OFFICIAL→"Shop the Grid", TEAM→"Driver Gear", INDEPENDENT/COLLECTIBLE→"Fan Favourites". **Validates: Requirements 3.1, 3.2, 3.3**
    - **Property 5**: `// Feature: shop-the-grid, Property 5: Weekend section visibility matches race weekend state` — use `Arb.bool()` for `isRaceWeekend`, assert section present/absent accordingly. **Validates: Requirements 3.4, 3.5**
    - **Property 6**: `// Feature: shop-the-grid, Property 6: Sections emitted in required order` — assert title order when all sections populated. **Validates: Requirements 1.2**
    - **Property 7**: `// Feature: shop-the-grid, Property 7: Sponsored items sort before non-sponsored` — use `Arb.list(Arb.merchItem())`, assert all sponsored items have lower index than all non-sponsored within each section. **Validates: Requirements 6.2**
    - **Property 8**: `// Feature: shop-the-grid, Property 8: Winner promotion places driver items first` — use `Arb.int()` for driverId, `Arb.long()` for timestamp within 2h, assert matching items precede non-matching. **Validates: Requirements 4.1**
    - Run minimum 100 iterations each

  - [ ]* 2.5 Write property tests for repository behaviour — Properties 2, 3
    - **Property 2**: `// Feature: shop-the-grid, Property 2: Repository falls back to cache on failure` — pre-populate disk cache, simulate network failure, assert `fetchFeed()` returns cached feed not empty/exception. **Validates: Requirements 1.3, 2.4**
    - **Property 3**: `// Feature: shop-the-grid, Property 3: Cache TTL is respected` — use `Arb.long(0..3_599_999)` for elapsed ms, assert second call within TTL returns same in-memory object without new network call. **Validates: Requirements 1.4**
    - Run minimum 100 iterations each

  - [ ]* 2.6 Write property test for feed parse round-trip — Property 1
    - `// Feature: shop-the-grid, Property 1: Feed parse round-trip`
    - Generate valid merch feed JSON strings with `Arb.string()` shaped as valid JSON; parse → re-serialise → re-parse; assert equivalent objects
    - Assert all required fields present in parsed result
    - **Validates: Requirements 2.2, 2.3, 2.5**
    - Run minimum 100 iterations

  - [ ]* 2.7 Write property tests for context card and ClickEvent — Properties 9, 13
    - **Property 9**: `// Feature: shop-the-grid, Property 9: Context card contains at most 4 matching items` — use `Arb.int()` for driverId, assert `getDriverItems` and `getTeamItems` return ≤ 4 items all matching the requested ID/name. **Validates: Requirements 4.2, 4.3**
    - **Property 13**: `// Feature: shop-the-grid, Property 13: Click event payload contains no PII` — use `Arb.clickEvent()`, assert field names are subset of allowed set, no user/device/email/location fields. **Validates: Requirements 7.4**
    - Run minimum 100 iterations each

- [x] 3. UI components
  - [x] 3.1 Create `ui/merch/components/SectionHeader.kt`
    - `@Composable fun SectionHeader(title: String, modifier: Modifier = Modifier)` — styled `Text` matching existing section header style
    - Minimum touch target 48dp for any interactive variant
    - _Requirements: 9.2_

  - [x] 3.2 Create `ui/merch/components/MerchItemCard.kt`
    - `@Composable fun MerchItemCard(item: MerchItem, onBuyClick: () -> Unit, modifier: Modifier = Modifier)`
    - `AsyncImage` with `placeholder = painterResource(R.drawable.merch_placeholder)` and `error = painterResource(R.drawable.merch_placeholder)`, `contentDescription = "${item.title} by ${item.sellerName}"`
    - Show "Featured" badge (`BtccYellow`) and "Ad" label when `item.sponsored == true`
    - Title truncated to 2 lines (`maxLines = 2, overflow = TextOverflow.Ellipsis`)
    - Price + seller name row
    - "Buy" / "View" `Button` with `minHeight = 48.dp`
    - Sponsored card `width = 200.dp`, standard `width = 160.dp`
    - Card background `BtccCard`, `RoundedCornerShape(8.dp)`
    - _Requirements: 6.1, 6.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3_

  - [ ]* 3.3 Write property tests for MerchItemCard state — Properties 11, 14
    - **Property 11**: `// Feature: shop-the-grid, Property 11: Sponsored items carry both Featured badge and Ad label` — use `Arb.bool()` for `sponsored`, assert `showFeaturedBadge` and `showAdLabel` both match `sponsored`. **Validates: Requirements 6.1, 6.4**
    - **Property 14**: `// Feature: shop-the-grid, Property 14: Content description contains title and seller name` — use `Arb.string()` for title/sellerName, assert generated `contentDescription` contains both as substrings. **Validates: Requirements 9.1**
    - Run minimum 100 iterations each

  - [x] 3.4 Create `ui/merch/components/SellerCard.kt`
    - `@Composable fun SellerCard(seller: Seller, onDiscountCodeTap: (Seller) -> Unit, modifier: Modifier = Modifier)`
    - Show seller logo (`AsyncImage`), display name
    - Show discount code row only when `seller.discountCode != null`; tap target uses `Modifier.clickable` + `minimumInteractiveComponentSize()`
    - _Requirements: 7.1, 7.2, 9.2_

  - [ ]* 3.5 Write property test for SellerCard state — Property 12
    - `// Feature: shop-the-grid, Property 12: Seller card exposes discount code when present`
    - Use `Arb.string().orNull()` for `discountCode`, assert code shown when non-null, hidden when null
    - **Validates: Requirements 7.1**
    - Run minimum 100 iterations

  - [x] 3.6 Create `ui/merch/components/FeaturedBanner.kt`
    - `@Composable fun FeaturedBanner(modifier: Modifier = Modifier)` — full-width `BtccYellow` surface card with "Featured Merch of the Round" text
    - Visible only when `showFeaturedBanner == true` in `MerchUiState.Success`
    - _Requirements: 6.3_

  - [x] 3.7 Create `ui/merch/components/SkeletonLoader.kt`
    - `@Composable fun SkeletonLoader(modifier: Modifier = Modifier)` — three shimmer card placeholders matching `MerchItemCard` dimensions using `Modifier.shimmer()` (add shimmer library dependency if not present, or use `animateFloat` alpha pulse as fallback)
    - Must be visible within 100ms of screen composition when no cache exists
    - _Requirements: 10.2_

  - [x] 3.8 Create `ui/merch/components/DriverInlineCard.kt`
    - `@Composable fun DriverInlineCard(driverName: String, items: List<MerchItem>, onItemTap: (MerchItem) -> Unit, modifier: Modifier = Modifier)`
    - Title row "Shop [driverName] Gear", then horizontal `LazyRow` of up to 4 `MerchItemCard` instances
    - Render only when `items.isNotEmpty()`
    - _Requirements: 4.2_

  - [x] 3.9 Create `ui/merch/components/TeamInlineCard.kt`
    - `@Composable fun TeamInlineCard(teamName: String, items: List<MerchItem>, onItemTap: (MerchItem) -> Unit, modifier: Modifier = Modifier)`
    - Title row "Shop [teamName] Kit", then horizontal `LazyRow` of up to 4 `MerchItemCard` instances
    - Render only when `items.isNotEmpty()`
    - _Requirements: 4.3_

  - [x] 3.10 Create `ui/merch/components/RaceWeekendBanner.kt`
    - `@Composable fun RaceWeekendBanner(onClick: () -> Unit, modifier: Modifier = Modifier)`
    - Full-width `Surface(color = BtccYellow)` card with "Race Weekend Picks →" text
    - Tapping calls `onClick` (navigates to `Screen.Shop`)
    - _Requirements: 4.4_

- [x] 4. Main screen, navigation, and bottom nav tab
  - [x] 4.1 Create `ui/merch/ShopTheGridScreen.kt`
    - `@Composable fun ShopTheGridScreen(viewModel: MerchViewModel = viewModel(), onItemTap: (String) -> Unit)`
    - Call `viewModel.load()` via `LaunchedEffect(Unit)`
    - `LazyColumn` root: when `Loading` → `SkeletonLoader`; when `Success` → optional `FeaturedBanner`, then for each `MerchSection` a `SectionHeader` + `LazyRow` of `MerchItemCard`; when `Error` → show `Snackbar` "Could not load merch. Showing cached results." and render cached sections
    - Call `Analytics.screen("shop_the_grid")` on composition
    - _Requirements: 1.1, 1.2, 1.3, 6.3, 10.1, 10.2_

  - [x] 4.2 Add Shop routes to `navigation/AppNavigation.kt`
    - Add `object Shop : Screen("shop")`, `object ShopDriverInline : Screen("shop/driver/{driverId}")` with `fun route(driverId: Int)`, `object ShopTeamInline : Screen("shop/team/{teamName}")` with `fun route(teamName: String)` to the `Screen` sealed class
    - Add `composable(Screen.Shop.route) { ShopTheGridScreen(...) }` to `AppNavHost`
    - Add `composable(Screen.ShopDriverInline.route, ...)` and `composable(Screen.ShopTeamInline.route, ...)` entries
    - _Requirements: 1.1_

  - [x] 4.3 Add flag-gated Shop nav item to `MainActivity.kt`
    - Collect `FeatureFlagsStore.merchHubEnabled` as state in `MainScreen`
    - Conditionally add `NavItem(Screen.Shop, "Shop", Icons.Default.ShoppingBag)` to `navItems` `buildList` when flag is `true`
    - Add `Screen.Shop` to `navItemSelected` equality check and `showBottomBar` exclusion list
    - _Requirements: 1.1_

  - [ ]* 4.4 Write unit test for flag-gated nav item
    - Assert `navItems` contains Shop tab when `merchHubEnabled = true`
    - Assert `navItems` does not contain Shop tab when `merchHubEnabled = false`
    - _Requirements: 1.1_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Context integration — inline cards and race weekend banner
  - [x] 6.1 Add `DriverInlineCard` to driver detail screen in `ui/drivers/DriversScreen.kt`
    - Obtain `MerchViewModel` (shared or scoped), call `getDriverItems(driver.number)`
    - Render `DriverInlineCard` below the driver bio section when `items.isNotEmpty()` and `merchHubEnabled == true`
    - Tapping an item calls `viewModel.itemTapped(item, context)`
    - _Requirements: 4.2, 4.5_

  - [x] 6.2 Add `TeamInlineCard` to team detail screen in `ui/drivers/TeamDetailScreen.kt`
    - Obtain `MerchViewModel`, call `getTeamItems(team.name)`
    - Render `TeamInlineCard` below the team bio section when `items.isNotEmpty()` and `merchHubEnabled == true`
    - Tapping an item calls `viewModel.itemTapped(item, context)`
    - _Requirements: 4.3, 4.5_

  - [x] 6.3 Add `RaceWeekendBanner` to `ui/news/NewsScreen.kt`
    - Collect `MerchUiState` from `MerchViewModel`; when `Success.showRaceWeekendBanner == true` and `merchHubEnabled == true`, render `RaceWeekendBanner` at the top of the news feed
    - Tapping navigates to `Screen.Shop`
    - _Requirements: 4.4_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use Kotest `forAll` with minimum 100 iterations; tag each with `// Feature: shop-the-grid, Property N: <text>`
- The `assembleSections` function should be extracted as a pure function (no Android context) to enable property testing without instrumentation
- `buildAffiliateUrl` is a pure function — no side effects, fully testable on JVM
- The Shop tab is only added to `navItems` when `FeatureFlagsStore.merchHubEnabled` is `true`; inline cards and banners also check this flag before rendering
