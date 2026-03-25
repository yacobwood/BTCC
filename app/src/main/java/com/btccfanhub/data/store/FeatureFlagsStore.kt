package com.btccfanhub.data.store

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import android.util.Log
import com.btccfanhub.Constants
import com.btccfanhub.worker.NewsCheckWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.time.LocalDateTime

object FeatureFlagsStore {

    private const val PREFS_NAME = "feature_flags"
    private const val FLAGS_URL  =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/flags.json"

    const val KEY_RADIO_TAB             = "radio_tab"
    const val KEY_ADS                   = "banner_ad"
    const val KEY_NATIVE_ADS            = "newsfeed_ad"
    const val KEY_WHATS_NEW             = "whats_new"
    const val KEY_LIVE_UPDATES          = "live_updates"
    const val KEY_RESULTS_NOTIFICATIONS = "results_notifications"
    const val KEY_TRACK_WEATHER         = "track_weather"
    const val KEY_WIDGET_RACE_WEEKEND   = "widget_race_weekend_test"
    const val KEY_MERCH_HUB             = "merch_hub_enabled"
    const val KEY_MERCH_FEED_URL        = "merch_feed_url"

    val radioTab             = MutableStateFlow(true)
    val adsEnabled           = MutableStateFlow(true)
    val nativeAdsEnabled     = MutableStateFlow(true)
    val whatsNew             = MutableStateFlow(true)
    val liveUpdates          = MutableStateFlow(true)
    val resultsNotifications = MutableStateFlow(false)
    val trackWeather         = MutableStateFlow(false)
    val widgetRaceWeekendTest = MutableStateFlow(false)
    val merchHubEnabled      = MutableStateFlow(false)
    val merchFeedUrl         = MutableStateFlow("")

    /** When non-null, overrides LocalDate/LocalDateTime.now() throughout the app for testing. */
    val testDateTimeOverride = MutableStateFlow<LocalDateTime?>(null)

    /** Reactive unit preference — true = km, false = miles. */
    val useKm = MutableStateFlow(false)

    fun setTestDateTime(dt: LocalDateTime?) {
        testDateTimeOverride.value = dt
    }

    private var prefs: SharedPreferences? = null
    private val http = OkHttpClient()
    // Held strongly so it isn't garbage-collected (SharedPreferences uses WeakReference)
    private var unitPrefsListener: SharedPreferences.OnSharedPreferenceChangeListener? = null

    /** The Android device ID — shown in Test Mode so you can add per-device overrides in the admin. */
    var deviceId: String = "unknown"
        private set

    fun init(context: Context) {
        val p = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs = p
        radioTab.value             = p.getBoolean(KEY_RADIO_TAB,              true)
        adsEnabled.value           = p.getBoolean(KEY_ADS,                    true)
        nativeAdsEnabled.value     = p.getBoolean(KEY_NATIVE_ADS,             true)
        whatsNew.value             = p.getBoolean(KEY_WHATS_NEW,              true)
        liveUpdates.value          = p.getBoolean(KEY_LIVE_UPDATES,           true)
        resultsNotifications.value = p.getBoolean(KEY_RESULTS_NOTIFICATIONS,  false)
        trackWeather.value         = p.getBoolean(KEY_TRACK_WEATHER,          false)
        widgetRaceWeekendTest.value = p.getBoolean(KEY_WIDGET_RACE_WEEKEND,   false)
        merchHubEnabled.value      = p.getBoolean(KEY_MERCH_HUB,              false)

        // Load unit preference from the app prefs (written by SettingsScreen)
        val appPrefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        useKm.value = appPrefs.getString(NewsCheckWorker.KEY_UNIT_SYSTEM, NewsCheckWorker.UNIT_MILES) == NewsCheckWorker.UNIT_KM
        // Store listener strongly — SharedPreferences only holds a WeakReference
        unitPrefsListener = SharedPreferences.OnSharedPreferenceChangeListener { sp, key ->
            if (key == NewsCheckWorker.KEY_UNIT_SYSTEM) {
                useKm.value = sp.getString(key, NewsCheckWorker.UNIT_MILES) == NewsCheckWorker.UNIT_KM
            }
        }
        appPrefs.registerOnSharedPreferenceChangeListener(unitPrefsListener)
        deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown"
        Log.d("FeatureFlags", "Device ID: $deviceId")
    }

    /** Fetches the latest flags.json from GitHub and applies it. */
    suspend fun fetchRemote(context: Context? = null) {
        try {
            val json = withContext(Dispatchers.IO) {
                val req = Request.Builder()
                    .url("$FLAGS_URL?t=${System.currentTimeMillis()}")
                    .build()
                http.newCall(req).execute().use { it.body?.string() }
            } ?: return

            val obj = JSONObject(json)
            applyAll(obj, context)
            Log.d("FeatureFlags", "Flags fetched from GitHub")
        } catch (e: Exception) {
            Log.e("FeatureFlags", "Fetch error: ${e.message}")
        }
    }

    /** Broadcasts an update to all widget instances (Small, Medium, Large). */
    fun refreshWidgets(context: Context) {
        try {
            val mgr = android.appwidget.AppWidgetManager.getInstance(context)
            val widgetClasses = listOf(
                com.btccfanhub.widget.SmallWidget::class.java,
                com.btccfanhub.widget.MediumWidget::class.java,
                com.btccfanhub.widget.LargeWidget::class.java,
            )
            for (cls in widgetClasses) {
                val ids = mgr.getAppWidgetIds(android.content.ComponentName(context, cls))
                if (ids.isNotEmpty()) {
                    context.sendBroadcast(
                        android.content.Intent(
                            android.appwidget.AppWidgetManager.ACTION_APPWIDGET_UPDATE,
                            null,
                            context,
                            cls,
                        ).putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                    )
                }
            }
            Log.d("FeatureFlags", "Widget refresh broadcast sent")
        } catch (e: Exception) {
            Log.e("FeatureFlags", "Widget refresh error: ${e.message}")
        }
    }

    private fun applyAll(obj: JSONObject, context: Context?) {
        val prevWidgetTest = widgetRaceWeekendTest.value

        // Per-device override merges on top of defaults
        val override = obj.optJSONObject("overrides")?.optJSONObject(deviceId)

        fun bool(key: String, default: Boolean): Boolean =
            override?.optBoolean(key, obj.optBoolean(key, default)) ?: obj.optBoolean(key, default)

        fun str(key: String, default: String): String =
            override?.optString(key, obj.optString(key, default)) ?: obj.optString(key, default)

        apply(KEY_RADIO_TAB,             bool(KEY_RADIO_TAB,             true))
        apply(KEY_ADS,                   bool(KEY_ADS,                   true))
        apply(KEY_NATIVE_ADS,            bool(KEY_NATIVE_ADS,            true))
        apply(KEY_WHATS_NEW,             bool(KEY_WHATS_NEW,             true))
        apply(KEY_LIVE_UPDATES,          bool(KEY_LIVE_UPDATES,          true))
        apply(KEY_RESULTS_NOTIFICATIONS, bool(KEY_RESULTS_NOTIFICATIONS, false))
        apply(KEY_TRACK_WEATHER,         bool(KEY_TRACK_WEATHER,         false))
        apply(KEY_WIDGET_RACE_WEEKEND,   bool(KEY_WIDGET_RACE_WEEKEND,   false))
        apply(KEY_MERCH_HUB,             bool(KEY_MERCH_HUB,             false))
        apply(KEY_MERCH_FEED_URL,        str(KEY_MERCH_FEED_URL,         ""))

        if (override != null) Log.d("FeatureFlags", "Per-device overrides applied for $deviceId")
        Log.d("FeatureFlags", "Flags applied")
        if (context != null && widgetRaceWeekendTest.value != prevWidgetTest) {
            refreshWidgets(context)
        }
    }

    private fun apply(key: String, value: Boolean) {
        prefs?.edit()?.putBoolean(key, value)?.apply()
        when (key) {
            KEY_RADIO_TAB             -> radioTab.value             = value
            KEY_ADS                   -> adsEnabled.value           = value
            KEY_NATIVE_ADS            -> nativeAdsEnabled.value     = value
            KEY_WHATS_NEW             -> whatsNew.value             = value
            KEY_LIVE_UPDATES          -> liveUpdates.value          = value
            KEY_RESULTS_NOTIFICATIONS -> resultsNotifications.value = value
            KEY_TRACK_WEATHER         -> trackWeather.value         = value
            KEY_WIDGET_RACE_WEEKEND   -> widgetRaceWeekendTest.value = value
            KEY_MERCH_HUB             -> merchHubEnabled.value       = value
        }
    }

    private fun apply(key: String, value: String) {
        prefs?.edit()?.putString(key, value)?.apply()
        when (key) {
            KEY_MERCH_FEED_URL -> {
                val changed = merchFeedUrl.value != value
                merchFeedUrl.value = value
                if (changed) com.btccfanhub.data.repository.MerchRepository.invalidateCache()
            }
        }
    }

    /** Local session override — useful for testing without touching the dashboard. */
    fun set(key: String, value: Boolean) = apply(key, value)
}
