# Requirements Document

## Introduction

"Shop the Grid" (BTCC Merch Hub) is a contextual merchandise discovery feature for the BTCC Fan Hub Android app. It surfaces relevant BTCC merchandise — from official team stores, independent sellers, and fan collectibles — at the right moment: after a race win, on a driver's profile, during a race weekend. The hub is monetised through affiliate links (eBay Partner Network, Amazon Associates), direct team/shop partnerships with sponsored listings, and custom discount-code tracking. This differentiates the app from all other BTCC coverage by bringing F1-style contextual merch discovery to British Touring Cars for the first time.

---

## Glossary

- **Merch_Hub**: The top-level "Shop the Grid" screen and its sub-sections within the app.
- **Merch_Item**: A single purchasable product (shirt, diecast, book, cap, etc.) with title, image, price, seller, and affiliate/tracking URL.
- **Merch_Feed**: The remote JSON feed (hosted on GitHub alongside existing data files) that supplies Merch_Item lists, seller metadata, and sponsored flags.
- **Seller**: An entity offering products — one of: Official_Store, Team_Store, Independent_Seller, or Collectibles_Seller.
- **Official_Store**: The official BTCC merchandise store.
- **Team_Store**: A BTCC team's own merchandise outlet (e.g. Sutton Motorsport, NAPA Racing UK).
- **Independent_Seller**: A third-party BTCC-focused retailer (e.g. Pit-Lane Motorsport).
- **Collectibles_Seller**: A marketplace listing (eBay, Etsy, Amazon) for fan collectibles such as diecasts and memorabilia.
- **Affiliate_Link**: A URL containing a tracking parameter for eBay Partner Network or Amazon Associates that attributes a commission to the app.
- **Sponsored_Listing**: A Merch_Item or Seller promoted via a paid placement (£10–£100/month tier), visually badged as "Featured".
- **Context_Trigger**: An in-app event (race result published, driver page opened, team page opened, race weekend active) that causes the Merch_Hub to surface contextually relevant Merch_Items.
- **Discount_Code**: A unique alphanumeric code provided by a direct partner Seller, tracked per-click for analytics.
- **Click_Event**: A recorded user interaction when a Merch_Item external link is opened.
- **Section**: A named grouping of Merch_Items within the Merch_Hub (e.g. "This Weekend's Merch Drops", "Driver Gear", "Fan Favourites").

---

## Requirements

### Requirement 1: Merch Hub Entry Point

**User Story:** As a fan, I want a dedicated merch section in the app, so that I can browse BTCC merchandise without leaving the app experience.

#### Acceptance Criteria

1. THE Merch_Hub SHALL be accessible from the app's bottom navigation bar as a distinct tab.
2. THE Merch_Hub SHALL display the following Sections in order: "Shop the Grid", "This Weekend's Merch Drops", "Driver Gear", "Fan Favourites".
3. WHEN the Merch_Feed fails to load, THE Merch_Hub SHALL display a non-blocking error message and show any previously cached Merch_Items.
4. WHEN the Merch_Feed loads successfully, THE Merch_Hub SHALL cache the response for a minimum of 1 hour to reduce redundant network requests.

---

### Requirement 2: Merch Feed Data Model

**User Story:** As a developer, I want a well-defined remote data feed, so that merch content can be updated without an app release.

#### Acceptance Criteria

1. THE Merch_Feed SHALL be a JSON document hosted at a URL configurable via the existing remote config (ConfigCat) mechanism.
2. THE Merch_Feed SHALL contain, for each Merch_Item: a unique identifier, title, image URL, price (as a string), currency code, seller name, seller type (one of: official, team, independent, collectible), external purchase URL, affiliate tracking parameters, sponsored flag (boolean), and an optional list of associated driver IDs and team IDs.
3. THE Merch_Feed SHALL contain, for each Seller: a unique identifier, display name, seller type, logo URL, and an optional Discount_Code.
4. IF a Merch_Feed response cannot be parsed into the expected schema, THEN THE Merch_Hub SHALL log the parse error via the existing Firebase Crashlytics integration and fall back to cached data.
5. THE Merch_Feed SHALL support a `lastUpdated` timestamp field so THE Merch_Hub can determine whether a cached copy is stale.

---

### Requirement 3: Seller Tiers and Store Sections

**User Story:** As a fan, I want to browse merchandise by seller type, so that I can find official gear, team kit, and fan collectibles in one place.

#### Acceptance Criteria

1. THE Merch_Hub SHALL display Official_Store items in the "Shop the Grid" Section.
2. THE Merch_Hub SHALL display Team_Store items grouped by team in the "Driver Gear" Section.
3. THE Merch_Hub SHALL display Independent_Seller and Collectibles_Seller items in the "Fan Favourites" Section.
4. WHEN a race weekend is active (determined by the existing schedule data), THE Merch_Hub SHALL populate the "This Weekend's Merch Drops" Section with Merch_Items tagged for the current round.
5. IF no race weekend is active, THEN THE Merch_Hub SHALL hide the "This Weekend's Merch Drops" Section.

---

### Requirement 4: Context-Based Merch Discovery

**User Story:** As a fan, I want to see relevant merchandise surfaced automatically after key race moments, so that I can act on my excitement immediately.

#### Acceptance Criteria

1. WHEN a race result is published and a driver is identified as the race winner, THE Merch_Hub SHALL promote Merch_Items associated with that driver's driver ID to the top of the relevant Section for a minimum of 2 hours.
2. WHEN a user opens a driver detail page, THE Merch_Hub SHALL surface a "Shop [Driver Name] Gear" inline card showing up to 4 Merch_Items associated with that driver's driver ID.
3. WHEN a user opens a team detail page, THE Merch_Hub SHALL surface a "Shop [Team Name] Kit" inline card showing up to 4 Merch_Items associated with that team's team ID.
4. WHEN a race weekend is active, THE Merch_Hub SHALL display a "Race Weekend Picks" banner on the app home screen linking to the "This Weekend's Merch Drops" Section.
5. THE Context_Trigger logic SHALL use the existing driver IDs and team IDs already present in the app's GridData model to match Merch_Items without requiring a separate mapping layer.

---

### Requirement 5: Affiliate Link Handling

**User Story:** As the app operator, I want all external purchase links to carry affiliate tracking parameters, so that the app earns commission on qualifying purchases.

#### Acceptance Criteria

1. WHEN a user taps a Merch_Item from a Collectibles_Seller, THE Merch_Hub SHALL open the external URL with eBay Partner Network or Amazon Associates tracking parameters appended as query parameters.
2. THE Merch_Hub SHALL open all external purchase URLs in the device's default browser via an Intent, not within an in-app WebView.
3. THE Merch_Hub SHALL record a Click_Event for every external link opened, including: Merch_Item identifier, Seller identifier, seller type, timestamp, and whether the item was a Sponsored_Listing.
4. THE Merch_Hub SHALL transmit Click_Events to Firebase Analytics using the existing Analytics wrapper (`data/analytics/Analytics.kt`).
5. IF an affiliate tracking parameter is absent from a Merch_Item's URL, THEN THE Merch_Hub SHALL still open the URL and record the Click_Event with an `affiliate_missing` flag.

---

### Requirement 6: Sponsored Listings

**User Story:** As a partner seller, I want my products to appear prominently in the hub, so that fans discover my store first.

#### Acceptance Criteria

1. THE Merch_Hub SHALL display a "Featured" badge on all Merch_Items where the sponsored flag is true.
2. THE Merch_Hub SHALL render Sponsored_Listing items before non-sponsored items within the same Section.
3. THE Merch_Hub SHALL display a "Featured Merch of the Round" banner at the top of the Merch_Hub when at least one Sponsored_Listing is tagged for the current round.
4. THE Merch_Hub SHALL include a visible "Ad" or "Sponsored" label adjacent to the "Featured" badge to comply with advertising disclosure requirements.
5. WHEN a Sponsored_Listing is tapped, THE Merch_Hub SHALL record the Click_Event with a `sponsored: true` attribute in addition to standard Click_Event fields.

---

### Requirement 7: Direct Partner Discount Codes

**User Story:** As a partner seller, I want to provide a discount code to app users, so that I can track sales originating from the app.

#### Acceptance Criteria

1. WHEN a Seller has a Discount_Code defined in the Merch_Feed, THE Merch_Hub SHALL display the Discount_Code on that Seller's store card within the relevant Section.
2. WHEN a user taps the Discount_Code display, THE Merch_Hub SHALL copy the code to the device clipboard and display a confirmation snackbar reading "Code copied".
3. THE Merch_Hub SHALL record a Click_Event of type `discount_code_copied` including the Seller identifier and Discount_Code value (not the user's clipboard contents) when a code is copied.
4. THE Merch_Hub SHALL NOT transmit any personally identifiable information as part of Click_Event payloads.

---

### Requirement 8: Merch Item Display

**User Story:** As a fan, I want each product card to show enough information to decide whether to buy, so that I don't have to leave the app to evaluate a product.

#### Acceptance Criteria

1. THE Merch_Hub SHALL display each Merch_Item as a card containing: product image, title (truncated to 2 lines), price with currency symbol, seller name, and a "Buy" or "View" call-to-action button.
2. THE Merch_Hub SHALL load Merch_Item images asynchronously using the existing Coil dependency, displaying a placeholder while loading.
3. IF a Merch_Item image URL returns an error, THEN THE Merch_Hub SHALL display a generic placeholder image.
4. THE Merch_Hub SHALL display Sponsored_Listing cards at a visually distinct size (wider card) compared to standard Merch_Item cards within horizontal scroll lists.

---

### Requirement 9: Accessibility

**User Story:** As a fan using accessibility features, I want the merch hub to be fully navigable, so that I can browse and purchase merchandise without barriers.

#### Acceptance Criteria

1. THE Merch_Hub SHALL provide a content description for every Merch_Item image that includes the product title and seller name.
2. THE Merch_Hub SHALL ensure all interactive elements (Buy button, Discount_Code tap target, Section headers) meet a minimum touch target size of 48×48dp.
3. THE Merch_Hub SHALL support system font scaling without truncating the Seller name or price on Merch_Item cards.

---

### Requirement 10: Performance

**User Story:** As a fan, I want the merch hub to load quickly, so that browsing merchandise doesn't interrupt my use of the app.

#### Acceptance Criteria

1. WHEN the Merch_Hub screen is opened and a valid cache exists, THE Merch_Hub SHALL render the first Section within 300ms of screen composition.
2. WHEN the Merch_Hub screen is opened and no cache exists, THE Merch_Hub SHALL display a loading skeleton within 100ms and populate content within 3 seconds on a standard mobile data connection.
3. THE Merch_Hub SHALL load Merch_Feed data on a background coroutine and SHALL NOT block the main thread.
