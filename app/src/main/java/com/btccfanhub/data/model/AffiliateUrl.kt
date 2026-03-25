package com.btccfanhub.data.model

import android.net.Uri

/**
 * Builds the final purchase URL for a [MerchItem] by appending affiliate tracking parameters.
 *
 * @return Pair of (finalUrl, affiliateMissing) where affiliateMissing is true if no affiliate
 *         params were present on the item.
 *
 * eBay Partner Network params: campid, toolid, customid
 * Amazon Associates params: tag
 */
fun buildAffiliateUrl(item: MerchItem): Pair<String, Boolean> {
    if (item.affiliateParams.isEmpty()) {
        return Pair(item.purchaseUrl, true)
    }
    val uri = Uri.parse(item.purchaseUrl).buildUpon()
    item.affiliateParams.forEach { (key, value) ->
        uri.appendQueryParameter(key, value)
    }
    return Pair(uri.build().toString(), false)
}
