package com.btccfanhub.data.model

/** Seller classification matching the feed's sellerType field. */
enum class SellerType { OFFICIAL, TEAM, INDEPENDENT, COLLECTIBLE }

/** A single purchasable product from the merch feed. */
data class MerchItem(
    val id: String,
    val title: String,
    val imageUrl: String,
    val price: String,                              // e.g. "£24.99"
    val currency: String,                           // ISO-4217, e.g. "GBP"
    val sellerName: String,
    val sellerType: SellerType,
    val purchaseUrl: String,
    val affiliateParams: Map<String, String> = emptyMap(),  // key→value query params
    val sponsored: Boolean = false,
    val driverIds: List<Int> = emptyList(),         // matches Driver.number
    val teamIds: List<String> = emptyList(),        // matches Team.name
    val roundTags: List<Int> = emptyList(),         // round numbers this item is tagged for
)

/** A seller entity from the merch feed. */
data class Seller(
    val id: String,
    val displayName: String,
    val sellerType: SellerType,
    val logoUrl: String,
    val discountCode: String?,                      // null if no discount code
)

/** Top-level feed response. */
data class MerchFeed(
    val lastUpdated: String,                        // ISO-8601
    val items: List<MerchItem>,
    val sellers: List<Seller>,
)

/** A named section of items shown in the hub. */
data class MerchSection(
    val title: String,
    val items: List<MerchItem>,
    val sellers: List<Seller>,                      // sellers relevant to this section
)

enum class ClickEventType { ITEM_TAPPED, DISCOUNT_CODE_COPIED }

/** Analytics event recorded for every external link open or code copy. */
data class ClickEvent(
    val itemId: String?,                            // null for discount_code_copied events
    val sellerId: String,
    val sellerType: SellerType,
    val timestampMs: Long,
    val sponsored: Boolean,
    val affiliateMissing: Boolean,
    val eventType: ClickEventType,
    val discountCode: String?,                      // only for DISCOUNT_CODE_COPIED, otherwise null
)
