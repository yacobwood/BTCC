package com.btccfanhub.data.store

import android.content.Context
import android.content.SharedPreferences
import android.provider.Settings
import android.util.Log
import com.btccfanhub.BuildConfig
import com.btccfanhub.Constants
import com.configcat.ConfigCatClient
import com.configcat.PollingModes
import com.configcat.User
import com.btccfanhub.worker.NewsCheckWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext
import java.time.LocalDateTime

object FeatureFlagsStore {

    private const val PREFS_NAME = "feature_flags"

    const val KEY_RADIO_TAB             = "radio_tab"
    const val KEY_ADS                   = "ads_enabled"
    const val KEY_WHATS_NEW             = "whats_new"
    const val KEY_LIVE_UPDATES          = "live_updates"
    const val KEY_RESULTS_NOTIFICATIONS = "results_notifications"
    const val KEY_TRACK_WEATHER         = "track_weather"
    const val KEY_WIDGET_RACE_WEEKEND   = "widget_race_weekend_test"
    const val KEY_MERCH_HUB             = "merch_hub_enabled"
    const val KEY_MERCH_FEED_URL        = "merch_feed_url"

    val radioTab             = MutableStateFlow(true)
    val adsEnabled           = MutableStateFlow(true)
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

    private var prefs: android.content.SharedPreferences? = null
    private var user: User? = null
    private lateinit var client: ConfigCatClient
    // Held strongly so it isn't garbage-collected (SharedPreferences uses WeakReference)
    private var unitPrefsListener: SharedPreferences.OnSharedPreferenceChangeListener? = null

    fun init(context: Context) {
        val p = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs            = p
        radioTab.value             = p.getBoolean(KEY_RADIO_TAB,              true)
        adsEnabled.value           = p.getBoolean(KEY_ADS,                    true)
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
        val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        user = User.newBuilder().build(deviceId)
        Log.d("FeatureFlags", "Device ID: $deviceId")

        client = ConfigCatClient.get(BuildConfig.CONFIGCAT_SDK_KEY) { options ->
            options.pollingMode(PollingModes.autoPoll(60))
            options.hooks().addOnConfigChanged {
                val prevWidgetTest = widgetRaceWeekendTest.value
                applyAll()
                // If the widget race weekend flag changed, push an immediate widget update
                if (widgetRaceWeekendTest.value != prevWidgetTest) {
                    refreshWidgets(context)
                }
            }
        }
    }

    /** Force-fetches the latest config from ConfigCat and applies it. */
    suspend fun fetchRemote() {
        try {
            withContext(Dispatchers.IO) { client.forceRefresh() }
            applyAll()
        } catch (e: Exception) {
            Log.e("FeatureFlags", "Fetch error: ${e.message}")
        }
    }

    /** Broadcasts an update to all CountdownWidget instances. */
    fun refreshWidgets(context: Context) {
        try {
            val mgr = android.appwidget.AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(
                android.content.ComponentName(context, com.btccfanhub.widget.CountdownWidget::class.java)
            )
            if (ids.isNotEmpty()) {
                context.sendBroadcast(
                    android.content.Intent(
                        android.appwidget.AppWidgetManager.ACTION_APPWIDGET_UPDATE,
                        null,
                        context,
                        com.btccfanhub.widget.CountdownWidget::class.java,
                    ).putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                )
                Log.d("FeatureFlags", "Widget refresh broadcast sent for ${ids.size} widget(s)")
            }
        } catch (e: Exception) {
            Log.e("FeatureFlags", "Widget refresh error: ${e.message}")
        }
    }

    private fun applyAll() {
        apply(KEY_RADIO_TAB,              client.getValue(Boolean::class.java, KEY_RADIO_TAB,              user, true))
        apply(KEY_ADS,                    client.getValue(Boolean::class.java, KEY_ADS,                    user, true))
        apply(KEY_WHATS_NEW,              client.getValue(Boolean::class.java, KEY_WHATS_NEW,              user, true))
        apply(KEY_LIVE_UPDATES,           client.getValue(Boolean::class.java, KEY_LIVE_UPDATES,           user, true))
        apply(KEY_RESULTS_NOTIFICATIONS,  client.getValue(Boolean::class.java, KEY_RESULTS_NOTIFICATIONS,  user, false))
        apply(KEY_TRACK_WEATHER,          client.getValue(Boolean::class.java, KEY_TRACK_WEATHER,          user, false))
        apply(KEY_WIDGET_RACE_WEEKEND,    client.getValue(Boolean::class.java, KEY_WIDGET_RACE_WEEKEND,    user, false))
        apply(KEY_MERCH_HUB,              client.getValue(Boolean::class.java, KEY_MERCH_HUB,              user, false))
        apply(KEY_MERCH_FEED_URL,         client.getValue(String::class.java,  KEY_MERCH_FEED_URL,         user, ""))
        Log.d("FeatureFlags", "Flags applied for device: ${user?.identifier}")
    }

    private fun apply(key: String, value: Boolean) {
        prefs?.edit()?.putBoolean(key, value)?.apply()
        when (key) {
            KEY_RADIO_TAB             -> radioTab.value             = value
            KEY_ADS                   -> adsEnabled.value           = value
            KEY_WHATS_NEW             -> whatsNew.value             = value
            KEY_LIVE_UPDATES          -> liveUpdates.value          = value
            KEY_RESULTS_NOTIFICATIONS -> resultsNotifications.value = value
            KEY_TRACK_WEATHER         -> trackWeather.value          = value
            KEY_WIDGET_RACE_WEEKEND   -> widgetRaceWeekendTest.value  = value
            KEY_MERCH_HUB             -> merchHubEnabled.value       = value
        }
    }

    private fun apply(key: String, value: String) {
        prefs?.edit()?.putString(key, value)?.apply()
        when (key) {
            KEY_MERCH_FEED_URL -> merchFeedUrl.value = value
        }
    }

    /** Local session override — useful for testing without touching the dashboard. */
    fun set(key: String, value: Boolean) = apply(key, value)
}
