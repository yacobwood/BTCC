package com.btccfanhub.ui.ads

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.btccfanhub.R
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdOptions
import com.google.android.gms.ads.nativead.NativeAdView

// Replace with your real native ad unit ID from AdMob console
private const val NATIVE_AD_UNIT_ID = "ca-app-pub-2098489502774763/1265232433"

private enum class AdState { LOADING, LOADED, FAILED }

@Composable
fun NativeAdItem() {
    val context = LocalContext.current
    var nativeAd by remember { mutableStateOf<NativeAd?>(null) }
    var adState by remember { mutableStateOf(AdState.LOADING) }

    LaunchedEffect(Unit) {
        // Initialize MobileAds first (idempotent — safe to call multiple times).
        // The callback fires immediately if already initialised, so this adds no
        // meaningful delay for subsequent ad slots in the same session.
        MobileAds.initialize(context) {
            AdLoader.Builder(context, NATIVE_AD_UNIT_ID)
                .forNativeAd { ad ->
                    nativeAd = ad
                    adState = AdState.LOADED
                }
                .withAdListener(object : AdListener() {
                    override fun onAdFailedToLoad(error: LoadAdError) {
                        adState = AdState.FAILED
                    }
                })
                .withNativeAdOptions(NativeAdOptions.Builder().build())
                .build()
                .loadAd(AdRequest.Builder().build())
        }
    }

    DisposableEffect(Unit) {
        onDispose { nativeAd?.destroy() }
    }

    when (adState) {
        AdState.LOADING -> {
            Box(
                modifier = Modifier
                    .padding(horizontal = 16.dp, vertical = 5.dp)
                    .fillMaxWidth()
                    .height(144.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color(0xFF161828)),
            )
        }
        AdState.FAILED -> { /* show nothing */ }
        AdState.LOADED -> {
            val ad = nativeAd ?: return
            AndroidView(
                factory = { ctx ->
                    val view = android.view.LayoutInflater.from(ctx)
                        .inflate(R.layout.native_ad_item, null) as NativeAdView
                    bindNativeAd(view, ad)
                    view
                },
                update = { view -> bindNativeAd(view, ad) },
            )
        }
    }
}

private fun bindNativeAd(view: NativeAdView, ad: NativeAd) {
    val mediaView = view.findViewById<com.google.android.gms.ads.nativead.MediaView>(R.id.ad_media)
    val headlineView = view.findViewById<android.widget.TextView>(R.id.ad_headline)
    val advertiserView = view.findViewById<android.widget.TextView>(R.id.ad_advertiser)

    view.mediaView = mediaView
    view.headlineView = headlineView
    view.advertiserView = advertiserView

    headlineView.text = ad.headline
    advertiserView.text = ad.advertiser ?: ""
    advertiserView.visibility = if (ad.advertiser != null) android.view.View.VISIBLE else android.view.View.GONE

    ad.mediaContent?.let { mediaView.mediaContent = it }

    view.setNativeAd(ad)
}
