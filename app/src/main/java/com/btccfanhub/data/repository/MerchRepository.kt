package com.btccfanhub.data.repository

import com.btccfanhub.data.model.MerchFeed
import com.btccfanhub.data.model.MerchItem
import com.btccfanhub.data.model.Seller
import com.btccfanhub.data.model.SellerType
import com.btccfanhub.data.network.HttpClient
import com.btccfanhub.data.store.FeatureFlagsStore
import com.btccfanhub.data.store.NetworkDiskCache
import com.google.firebase.crashlytics.FirebaseCrashlytics
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

object MerchRepository {

    private const val CACHE_KEY = "merch"
    private const val TTL_MS = 60 * 60_000L

    @Volatile private var cache: MerchFeed? = null
    @Volatile private var cacheTime: Long = 0

    fun invalidateCache() {
        cache = null
        cacheTime = 0
        NetworkDiskCache.write(CACHE_KEY, "")  // clear disk cache too
    }

    suspend fun fetchFeed(): MerchFeed = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        cache?.takeIf { now - cacheTime < TTL_MS }?.let { return@withContext it }

        val url = FeatureFlagsStore.merchFeedUrl.value
        if (url.isBlank()) return@withContext diskFallback()

        try {
            val body = HttpClient.client.newCall(
                Request.Builder()
                    .url("$url?t=$now")
                    .header("User-Agent", "BTCCFanHub/1.0 Android")
                    .build()
            ).execute().body?.string() ?: return@withContext cache ?: diskFallback()
            NetworkDiskCache.write(CACHE_KEY, body)
            val result = parse(body)
            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: diskFallback()
        }
    }

    internal fun parse(json: String): MerchFeed {
        return runCatching {
            val root = JSONObject(json)
            val lastUpdated = root.optString("lastUpdated")

            val itemsArr = root.optJSONArray("items") ?: JSONArray()
            val items = (0 until itemsArr.length()).map { i ->
                val obj = itemsArr.getJSONObject(i)

                val affiliateParams: Map<String, String> = obj.optJSONObject("affiliateParams")
                    ?.let { ap ->
                        ap.keys().asSequence().associateWith { key -> ap.optString(key) }
                    } ?: emptyMap()

                val driverIds: List<Int> = obj.optJSONArray("driverIds")
                    ?.let { arr -> (0 until arr.length()).map { arr.getInt(it) } } ?: emptyList()

                val teamIds: List<String> = obj.optJSONArray("teamIds")
                    ?.let { arr -> (0 until arr.length()).map { arr.getString(it) } } ?: emptyList()

                val roundTags: List<Int> = obj.optJSONArray("roundTags")
                    ?.let { arr -> (0 until arr.length()).map { arr.getInt(it) } } ?: emptyList()

                MerchItem(
                    id             = obj.optString("id"),
                    title          = obj.optString("title"),
                    imageUrl       = obj.optString("imageUrl"),
                    price          = obj.optString("price"),
                    currency       = obj.optString("currency"),
                    sellerName     = obj.optString("sellerName"),
                    sellerType     = parseSellerType(obj.optString("sellerType")),
                    purchaseUrl    = obj.optString("purchaseUrl"),
                    affiliateParams = affiliateParams,
                    sponsored      = obj.optBoolean("sponsored", false),
                    driverIds      = driverIds,
                    teamIds        = teamIds,
                    roundTags      = roundTags,
                )
            }

            val sellersArr = root.optJSONArray("sellers") ?: JSONArray()
            val sellers = (0 until sellersArr.length()).map { i ->
                val obj = sellersArr.getJSONObject(i)
                val discountCode = obj.optString("discountCode", "").takeIf { it.isNotBlank() && it != "null" }
                Seller(
                    id          = obj.optString("id"),
                    displayName = obj.optString("displayName"),
                    logoUrl     = obj.optString("logoUrl"),
                    sellerType  = parseSellerType(obj.optString("sellerType")),
                    discountCode = discountCode,
                )
            }

            MerchFeed(lastUpdated, items, sellers)
        }.getOrElse { e ->
            FirebaseCrashlytics.getInstance().recordException(e)
            MerchFeed("", emptyList(), emptyList())
        }
    }

    private fun parseSellerType(value: String): SellerType = when (value.uppercase()) {
        "OFFICIAL"    -> SellerType.OFFICIAL
        "TEAM"        -> SellerType.TEAM
        "INDEPENDENT" -> SellerType.INDEPENDENT
        else          -> SellerType.COLLECTIBLE
    }

    private fun diskFallback(): MerchFeed =
        NetworkDiskCache.read(CACHE_KEY)?.let { runCatching { parse(it) }.getOrNull() }
            ?: MerchFeed("", emptyList(), emptyList())
}
