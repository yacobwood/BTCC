# Design Document: Shop the Grid (BTCC Merch Hub)

## Overview

Shop the Grid is a contextual merchandise discovery feature embedded in the BTCC Fan Hub Android app. It surfaces relevant BTCC merchandise at the right moment — after a race win, on a driver's profile, during a race weekend — and monetises through affiliate links (eBay Partner Network, Amazon Associates), sponsored listings, and discount-code tracking.

The feature follows the existing MVVM + Repository pattern with Jetpack Compose UI, Kotlin coroutines/Flow, and the existing OkHttp/NetworkDiskCache infrastructure. It is gated behind a ConfigCat feature flag (`merch_hub_enabled`) so it can be enabled remotely without an app release.

### Key Design Decisions

- **No new networking library**: reuse `HttpClient.client` (OkHttp singleton) and `NetworkDiskCache` exactly as `DriversRepository` does.
- **No WebView**: all purchase links open via `Intent(ACTION_VIEW)` to the device browser.
- **No PII in analytics**: `ClickEvent` carries only item/seller IDs, types, and flags — never user identity.
- **Affiliate URL construction is pure**: a stateless function transforms a `MerchItem` into a final URL, making it trivially testable.
- **Section ordering is data-driven**: the ViewModel assembles an ordered list of `MerchSection` objects; the UI renders them in list order.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (Jetpack Compose)                                  │
│  ShopTheGridScreen  DriverInlineCard  TeamInlineCard         │
│  RaceWeekendBanner  MerchItemCard  SellerCard  Skeleton      │
└────────────────────┬────────────────────────────────────────┘
                     │ collectAsState()
┌────────────────────▼────────────────────────────────────────┐
│  MerchViewModel (androidx.lifecycle.ViewModel)               │
│  StateFlow<MerchUiState>                                     │
│  fun itemTapped(item, context)                               │
│  fun discountCodeCopied(seller)                              │
└──────┬──────────────────────────┬───────────────────────────┘
       │                          │
┌──────▼──────┐          ┌────────▼────────┐
│ MerchRepo   │          │ ScheduleRepo    │
│ fetchFeed() │          │ isRaceWeekend() │
└──────┬──────┘          └─────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────┐
│  Cache Layer                                                 │
│  In-memory (TTL 60 min)  +  NetworkDiskCache("merch")        │
└──────┬──────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────┐
│  Network: OkHttp → GitHub-hosted merch.json                  │
└─────────────────────────────────────────────────────────────┘
```

### Feature Flag Gate

`FeatureFlagsStore.KEY_MERCH_HUB = "merch_hub_enabled"` (Boolean, default `false`).  
`FeatureFlagsStore.merchHubEnabled = MutableStateFlow(false)`.  
The Shop tab in `MainActivity.navItems` is only added when this flag is `true`. The ViewModel also checks the flag before loading data.

---

## Components and Interfaces

### Navigation Changes

Add to `Screen` sealed class:
```kotlin
object Shop : Screen("shop")
object ShopDriverInline : Screen("shop/driver/{driverId}") {
    fun route(driverId: Int) = "shop/driver/$driverId"
}
object ShopTeamInline : Screen("shop/team/{teamName}") {
    fun route(teamName: String) = "shop/team/${Uri.encode(teamName)}"
}
```

Add to `AppNavHost`:
```kotlin
composable(Screen.Shop.route) { ShopTheGridScreen(onItemTap = { url -> openUrl(context, url) }) }
composable(Screen.ShopDriverInline.route, arguments = listOf(navArgument("driverId") { type = NavType.IntType })) { ... }
composable(Screen.ShopTeamInline.route, arguments = listOf(navArgument("teamName") { type = NavType.StringType })) { ... }
```

Add to `navItems` in `MainActivity` (only when `merchHubEnabled` flag is true):
```kotlin
NavItem(Screen.Shop, "Shop", Icons.Default.ShoppingBag)
```

The `navItemSelected` lambda should include `Screen.Shop` in the standard equality check.

### New Files

| File | Purpose |
|------|---------|
| `data/model/MerchModels.kt` | All merch data classes |
| `data/repository/MerchRepository.kt` | Fetch, cache, parse merch feed |
| `ui/merch/MerchViewModel.kt` | UI state, business logic |
| `ui/merch/ShopTheGridScreen.kt` | Main hub screen |
| `ui/merch/components/MerchItemCard.kt` | Product card composable |
| `ui/merch/components/SellerCard.kt` | Seller store card composable |
| `ui/merch/components/SectionHeader.kt` | Section title row |
| `ui/merch/components/FeaturedBanner.kt` | "Featured Merch of the Round" banner |
| `ui/merch/components/SkeletonLoader.kt` | Loading skeleton |
| `ui/merch/components/DriverInlineCard.kt` | Inline card for driver detail page |
| `ui/merch/components/TeamInlineCard.kt` | Inline card for team detail page |
| `ui/merch/components/RaceWeekendBanner.kt` | Home screen race weekend banner |

### Existing Files to Modify

| File | Change |
|------|--------|
| `data/analytics/Analytics.kt` | Add `merchItemTapped`, `discountCodeCopied`, `merchSectionViewed` |
| `data/store/FeatureFlagsStore.kt` | Add `KEY_MERCH_HUB` constant and `merchHubEnabled` StateFlow |
| `navigation/AppNavigation.kt` | Add Shop routes |
| `MainActivity.kt` | Add Shop nav item (flag-gated) |
| `ui/drivers/DriversScreen.kt` | Add `DriverInlineCard` to driver detail |
| `ui/drivers/TeamDetailScreen.kt` | Add `TeamInlineCard` to team detail |
| `ui/news/NewsScreen.kt` | Add `RaceWeekendBanner` when race weekend active |

---

## Data Models

### `data/model/MerchModels.kt`

```kotlin
package com.btccfanhub.data.model

/** Seller classification matching the feed's sellerType field. */
enum class SellerType { OFFICIAL, TEAM, INDEPENDENT, COLLECTIBLE }

/** A single purchasable product from the merch feed. */
data class MerchItem(
    val id: String,
    val title: String,
    val imageUrl: String,
    val price: String,           // e.g. "£24.99"
    val currency: String,        // ISO-4217, e.g. "GBP"
    val sellerName: String,
    val sellerType: SellerType,
    val purchaseUrl: String,
    val affiliateParams: Map<String, String>,  // key→value query params
    val sponsored: Boolean,
    val driverIds: List<Int>,    // matches Driver.number
    val teamIds: List<String>,   // matches Team.name
    val roundTags: List<Int>,    // round numbers this item is tagged for
)

/** A seller entity from the merch feed. */
data class Seller(
    val id: String,
    val displayName: String,
    val sellerType: SellerType,
    val logoUrl: String,
    val discountCode: String?,   // null if no discount code
)

/** Top-level feed response. */
data class MerchFeed(
    val lastUpdated: String,     // ISO-8601
    val items: List<MerchItem>,
    val sellers: List<Seller>,
)

/** A named section of items shown in the hub. */
data class MerchSection(
    val title: String,
    val items: List<MerchItem>,
    val sellers: List<Seller>,   // sellers relevant to this section
)

/** Analytics event recorded for every external link open or code copy. */
data class ClickEvent(
    val itemId: String?,         // null for discount_code_copied events
    val sellerId: String,
    val sellerType: SellerType,
    val timestampMs: Long,
    val sponsored: Boolean,
    val affiliateMissing: Boolean,
    val eventType: ClickEventType,
    val discountCode: String?,   // only for discount_code_copied
)

enum class ClickEventType { ITEM_TAPPED, DISCOUNT_CODE_COPIED }
```

### Affiliate URL Construction

```kotlin
/** Pure function — no side effects, fully testable. */
fun buildAffiliateUrl(item: MerchItem): Pair<String, Boolean> {
    if (item.affiliateParams.isEmpty()) return Pair(item.purchaseUrl, true) // affiliateMissing=true
    val uri = Uri.parse(item.purchaseUrl).buildUpon()
    item.affiliateParams.forEach { (k, v) -> uri.appendQueryParameter(k, v) }
    return Pair(uri.build().toString(), false)
}
```

eBay params: `campid`, `toolid`, `customid`.  
Amazon params: `tag`.

---

## Repository Design

### `MerchRepository`

Follows `DriversRepository` exactly:

```kotlin
object MerchRepository {
    private const val CACHE_KEY = "merch"
    private const val TTL_MS = 60 * 60_000L  // 1 hour

    @Volatile private var cache: MerchFeed? = null
    @Volatile private var cacheTime: Long = 0

    suspend fun fetchFeed(): MerchFeed = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        cache?.takeIf { now - cacheTime < TTL_MS }?.let { return@withContext it }
        try {
            val url = FeatureFlagsStore.merchFeedUrl  // ConfigCat-supplied URL
            val body = HttpClient.client.newCall(
                Request.Builder().url("$url?t=$now")
                    .header("User-Agent", "BTCCFanHub/1.0 Android").build()
            ).execute().body?.string()
                ?: return@withContext cache ?: diskFallback()
            NetworkDiskCache.write(CACHE_KEY, body)
            val result = parse(body)
            cache = result; cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: diskFallback()
        }
    }

    private fun diskFallback(): MerchFeed =
        NetworkDiskCache.read(CACHE_KEY)
            ?.let { runCatching { parse(it) }.getOrNull() }
            ?: MerchFeed("", emptyList(), emptyList())

    internal fun parse(json: String): MerchFeed { /* JSONObject parsing */ }
}
```

Parse errors are caught by `runCatching`; Crashlytics logging is added in the catch block via `FirebaseCrashlytics.getInstance().recordException(e)`.

---

## ViewModel State

### `MerchUiState`

```kotlin
sealed class MerchUiState {
    object Loading : MerchUiState()
    data class Success(
        val sections: List<MerchSection>,
        val showFeaturedBanner: Boolean,
        val showRaceWeekendBanner: Boolean,
        val winnerDriverId: Int?,          // non-null within 2h of a race result
    ) : MerchUiState()
    data class Error(val cachedSections: List<MerchSection>) : MerchUiState()
}
```

### `MerchViewModel`

```kotlin
class MerchViewModel : ViewModel() {
    val uiState: StateFlow<MerchUiState>

    fun load()
    fun itemTapped(item: MerchItem, context: Context)
    fun discountCodeCopied(seller: Seller, context: Context)
    fun getDriverItems(driverId: Int): List<MerchItem>   // up to 4
    fun getTeamItems(teamName: String): List<MerchItem>  // up to 4
}
```

Section assembly logic (inside `load()`):

1. Fetch `MerchFeed` from `MerchRepository`.
2. Fetch active round from `ScheduleRepository`.
3. Determine `winnerDriverId` from latest race result (if within 2 hours of result timestamp).
4. Build sections in order:
   - "Shop the Grid" — `sellerType == OFFICIAL`, sponsored first.
   - "This Weekend's Merch Drops" — `roundTags.contains(currentRound)`, only if race weekend active; sponsored first.
   - "Driver Gear" — `sellerType == TEAM`, grouped by team, sponsored first.
   - "Fan Favourites" — `sellerType == INDEPENDENT || COLLECTIBLE`, sponsored first.
5. If `winnerDriverId != null`, move items matching that driver to the top of their section.
6. Emit `MerchUiState.Success`.

---

## UI Component Specs

### `ShopTheGridScreen`

- `LazyColumn` root.
- First item: `FeaturedBanner` (visible when `showFeaturedBanner == true`).
- Subsequent items: one `SectionHeader` + `LazyRow` of `MerchItemCard` per `MerchSection`.
- Sponsored items render as wider cards (`width = 200.dp`) vs standard (`width = 160.dp`).
- Error state: `Snackbar` with "Could not load merch. Showing cached results." — non-blocking.
- Loading state: `SkeletonLoader` (shimmer rectangles matching card dimensions).

### `MerchItemCard`

```
┌──────────────────────────────┐
│  [AsyncImage 160×120dp]      │  ← placeholder = R.drawable.merch_placeholder
│  [Featured] [Ad]  (if spon.) │  ← BtccYellow badge + grey "Ad" label
│  Title (2 lines max)         │
│  £24.99  •  Seller Name      │
│  [  Buy / View  ]            │  ← BtccYellow button, min 48dp height
└──────────────────────────────┘
```

- `contentDescription = "${item.title} by ${item.sellerName}"`
- Sponsored card: `width = 200.dp`, standard: `width = 160.dp`
- Card background: `BtccCard`, shape: `RoundedCornerShape(8.dp)`

### `SellerCard`

Displays seller logo, display name, and discount code (if present).  
Discount code tap target: `Modifier.clickable { onDiscountCodeTap(seller) }` with `minimumInteractiveComponentSize()`.

### `DriverInlineCard` / `TeamInlineCard`

Horizontal `LazyRow` of up to 4 `MerchItemCard` instances, preceded by a title row "Shop [Name] Gear/Kit".  
Shown only when `items.isNotEmpty()`.

### `RaceWeekendBanner`

Full-width `Surface(color = BtccYellow)` card with "Race Weekend Picks →" text.  
Tapping navigates to `Screen.Shop` with the weekend section scrolled into view.

### `SkeletonLoader`

Three shimmer card placeholders using `Modifier.shimmer()` (Valentinilk shimmer library or equivalent).  
Visible within 100ms of screen composition when no cache exists.

---

## Analytics Events

Add to `Analytics.kt`:

```kotlin
fun merchItemTapped(itemId: String, sellerId: String, sellerType: String, sponsored: Boolean, affiliateMissing: Boolean) {
    fa.logEvent("merch_item_tapped") {
        param("item_id", itemId)
        param("seller_id", sellerId)
        param("seller_type", sellerType)
        param("sponsored", if (sponsored) "true" else "false")
        param("affiliate_missing", if (affiliateMissing) "true" else "false")
    }
}

fun discountCodeCopied(sellerId: String, discountCode: String) {
    fa.logEvent("discount_code_copied") {
        param("seller_id", sellerId)
        param("discount_code", discountCode.take(50))
    }
}

fun merchSectionViewed(sectionTitle: String) {
    fa.logEvent("merch_section_viewed") {
        param("section_title", sectionTitle)
    }
}
```

No PII fields are included in any event. `discountCode` is the code string itself (e.g. "BTCC10"), not clipboard contents.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Network failure, cache exists | Return cached `MerchFeed`; emit `MerchUiState.Error(cachedSections)` |
| Network failure, no cache | Return empty `MerchFeed`; emit `MerchUiState.Error(emptyList())` |
| JSON parse failure | Log to Crashlytics; fall back to disk cache or empty |
| Image load failure | Coil `error = R.drawable.merch_placeholder` |
| Affiliate params missing | Open URL as-is; set `affiliateMissing = true` in `ClickEvent` |
| Feature flag disabled | Shop tab hidden; inline cards not rendered |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Feed parse round-trip

*For any* valid merch feed JSON string, parsing it should produce a `MerchFeed` whose items and sellers each contain all required fields (id, title, imageUrl, price, currency, sellerName, sellerType, purchaseUrl, sponsored, lastUpdated), and serialising that `MerchFeed` back to JSON and re-parsing should produce an equivalent object.

**Validates: Requirements 2.2, 2.3, 2.5**

---

### Property 2: Repository falls back to cache on failure

*For any* pre-populated disk cache and a simulated network failure, calling `MerchRepository.fetchFeed()` should return the cached `MerchFeed` rather than throwing an exception or returning an empty feed.

**Validates: Requirements 1.3, 2.4**

---

### Property 3: Cache TTL is respected

*For any* successful fetch, a second call to `MerchRepository.fetchFeed()` within 60 minutes should return the same in-memory object without issuing a new network request.

**Validates: Requirements 1.4**

---

### Property 4: Items route to correct section by seller type

*For any* `MerchFeed`, the section assembly function should route every item to exactly one section: `OFFICIAL` → "Shop the Grid", `TEAM` → "Driver Gear", `INDEPENDENT` or `COLLECTIBLE` → "Fan Favourites". No item should appear in a section it does not belong to, and no item should be silently dropped.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 5: Weekend section visibility matches race weekend state

*For any* `MerchFeed` and active round number, when `isRaceWeekend = true` the assembled sections list should contain "This Weekend's Merch Drops" populated with items whose `roundTags` contain the current round; when `isRaceWeekend = false` that section should be absent.

**Validates: Requirements 3.4, 3.5**

---

### Property 6: Sections are emitted in the required order

*For any* `MerchFeed` where all four section types have at least one item and a race weekend is active, the assembled `sections` list should have titles in the order: "Shop the Grid", "This Weekend's Merch Drops", "Driver Gear", "Fan Favourites".

**Validates: Requirements 1.2**

---

### Property 7: Sponsored items sort before non-sponsored within a section

*For any* section containing a mix of sponsored and non-sponsored items, after sorting, every sponsored item should appear at a lower index than every non-sponsored item.

**Validates: Requirements 6.2**

---

### Property 8: Winner promotion places driver items first

*For any* section and a winner driver ID with a result timestamp within 2 hours, all items whose `driverIds` contain the winner's ID should appear before all items that do not, after promotion is applied.

**Validates: Requirements 4.1**

---

### Property 9: Context card contains at most 4 matching items

*For any* driver ID or team name and a `MerchFeed`, `getDriverItems(driverId)` and `getTeamItems(teamName)` should each return a list of length at most 4, where every item in the list matches the requested driver ID or team name respectively.

**Validates: Requirements 4.2, 4.3**

---

### Property 10: Affiliate URL construction appends all params

*For any* `MerchItem` with non-empty `affiliateParams`, `buildAffiliateUrl(item)` should return a URL that contains every key-value pair from `affiliateParams` as query parameters, and `affiliateMissing` should be `false`. For any item with empty `affiliateParams`, the original `purchaseUrl` should be returned unchanged and `affiliateMissing` should be `true`.

**Validates: Requirements 5.1, 5.5**

---

### Property 11: Sponsored items carry both Featured badge and Ad label

*For any* `MerchItem` with `sponsored = true`, the card UI state should expose both `showFeaturedBadge = true` and `showAdLabel = true`. For any item with `sponsored = false`, both should be `false`.

**Validates: Requirements 6.1, 6.4**

---

### Property 12: Seller card exposes discount code when present

*For any* `Seller` with a non-null `discountCode`, the seller card state should expose that exact code string. For any `Seller` with `discountCode = null`, no code should be displayed.

**Validates: Requirements 7.1**

---

### Property 13: Click event payload contains no PII

*For any* `ClickEvent`, the set of field names should be a subset of `{itemId, sellerId, sellerType, timestampMs, sponsored, affiliateMissing, eventType, discountCode}` — no field should carry a user identifier, device ID, name, email, or location.

**Validates: Requirements 7.4**

---

### Property 14: Content description contains title and seller name

*For any* `MerchItem`, the generated `contentDescription` string should contain both `item.title` and `item.sellerName` as substrings.

**Validates: Requirements 9.1**

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:

- **Unit tests** cover specific examples, integration points, and edge cases.
- **Property-based tests** verify universal correctness across randomly generated inputs.

### Property-Based Testing

Use **[Kotest Property Testing](https://kotest.io/docs/proptest/property-based-testing.html)** (`io.kotest:kotest-property`), which integrates naturally with Kotlin and coroutines.

Each property test must run a minimum of **100 iterations**.

Tag format for each test:
```
// Feature: shop-the-grid, Property N: <property_text>
```

Each correctness property above maps to exactly one property-based test:

| Property | Test class | Generator |
|----------|-----------|-----------|
| 1 — Feed parse round-trip | `MerchRepositoryTest` | `Arb.string()` shaped as valid JSON |
| 2 — Cache fallback | `MerchRepositoryTest` | `Arb.string()` for cache content |
| 3 — Cache TTL | `MerchRepositoryTest` | `Arb.long(0..3_599_999)` for elapsed ms |
| 4 — Section routing | `MerchSectionAssemblyTest` | `Arb.list(Arb.merchItem())` |
| 5 — Weekend section visibility | `MerchSectionAssemblyTest` | `Arb.bool()` for isRaceWeekend |
| 6 — Section order | `MerchSectionAssemblyTest` | `Arb.list(Arb.merchItem())` |
| 7 — Sponsored sort | `MerchSectionAssemblyTest` | `Arb.list(Arb.merchItem())` |
| 8 — Winner promotion | `MerchSectionAssemblyTest` | `Arb.int()` for driverId, `Arb.long()` for timestamp |
| 9 — Context card size | `MerchViewModelTest` | `Arb.int()` for driverId |
| 10 — Affiliate URL | `AffiliateUrlTest` | `Arb.map(Arb.string(), Arb.string())` for params |
| 11 — Sponsored badge+label | `MerchItemCardStateTest` | `Arb.bool()` for sponsored |
| 12 — Discount code display | `SellerCardStateTest` | `Arb.string().orNull()` for discountCode |
| 13 — No PII in ClickEvent | `ClickEventTest` | `Arb.clickEvent()` |
| 14 — Content description | `MerchItemCardStateTest` | `Arb.string()` for title/sellerName |

### Unit Tests

Focus on:
- Specific JSON parse examples (valid feed, missing optional fields, malformed JSON).
- `buildAffiliateUrl` with eBay and Amazon param sets.
- `Analytics.merchItemTapped` called with correct params when item tapped.
- `Analytics.discountCodeCopied` called with seller ID and code (not clipboard contents).
- `MerchViewModel.discountCodeCopied` emits clipboard event with correct code.
- `ScheduleRepository` integration: `isRaceWeekend` returns correct value for known schedule fixtures.
- Navigation: Shop tab present in navItems when flag enabled, absent when disabled.

### Test Configuration

```kotlin
// build.gradle.kts (app)
testImplementation("io.kotest:kotest-runner-junit5:5.9.1")
testImplementation("io.kotest:kotest-property:5.9.1")
testImplementation("io.kotest:kotest-assertions-core:5.9.1")
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
```
