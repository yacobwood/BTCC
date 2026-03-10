package com.btccfanhub.data

import android.content.Context
import android.provider.Settings
import android.util.Log
import com.btccfanhub.BuildConfig
import com.configcat.ConfigCatClient
import com.configcat.PollingModes
import com.configcat.User
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.withContext

object FeatureFlagsStore {

    private const val PREFS_NAME = "feature_flags"

    const val KEY_RADIO_TAB    = "radio_tab"
    const val KEY_ADS          = "ads_enabled"
    const val KEY_WHATS_NEW    = "whats_new"
    const val KEY_LIVE_UPDATES          = "live_updates"
    const val KEY_RESULTS_NOTIFICATIONS = "results_notifications"

    val radioTab              = MutableStateFlow(true)
    val adsEnabled            = MutableStateFlow(true)
    val whatsNew              = MutableStateFlow(true)
    val liveUpdates           = MutableStateFlow(true)
    val resultsNotifications  = MutableStateFlow(false)

    private var prefs: android.content.SharedPreferences? = null
    private var user: User? = null
    private lateinit var client: ConfigCatClient

    fun init(context: Context) {
        val p = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs            = p
        radioTab.value             = p.getBoolean(KEY_RADIO_TAB,              true)
        adsEnabled.value           = p.getBoolean(KEY_ADS,                    true)
        whatsNew.value             = p.getBoolean(KEY_WHATS_NEW,              true)
        liveUpdates.value          = p.getBoolean(KEY_LIVE_UPDATES,           true)
        resultsNotifications.value = p.getBoolean(KEY_RESULTS_NOTIFICATIONS,  false)

        val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        user = User.newBuilder().build(deviceId)
        Log.d("FeatureFlags", "Device ID: $deviceId")

        client = ConfigCatClient.get(BuildConfig.CONFIGCAT_SDK_KEY) { options ->
            options.pollingMode(PollingModes.autoPoll(60))
            options.hooks().addOnConfigChanged { applyAll() }
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

    private fun applyAll() {
        apply(KEY_RADIO_TAB,              client.getValue(Boolean::class.java, KEY_RADIO_TAB,              user, true))
        apply(KEY_ADS,                    client.getValue(Boolean::class.java, KEY_ADS,                    user, true))
        apply(KEY_WHATS_NEW,              client.getValue(Boolean::class.java, KEY_WHATS_NEW,              user, true))
        apply(KEY_LIVE_UPDATES,           client.getValue(Boolean::class.java, KEY_LIVE_UPDATES,           user, true))
        apply(KEY_RESULTS_NOTIFICATIONS,  client.getValue(Boolean::class.java, KEY_RESULTS_NOTIFICATIONS,  user, false))
        Log.d("FeatureFlags", "Flags applied for device: ${user?.identifier}")
    }

    private fun apply(key: String, value: Boolean) {
        prefs?.edit()?.putBoolean(key, value)?.apply()
        when (key) {
            KEY_RADIO_TAB    -> radioTab.value    = value
            KEY_ADS          -> adsEnabled.value  = value
            KEY_WHATS_NEW    -> whatsNew.value    = value
            KEY_LIVE_UPDATES          -> liveUpdates.value          = value
            KEY_RESULTS_NOTIFICATIONS -> resultsNotifications.value = value
        }
    }

    /** Local session override — useful for testing without touching the dashboard. */
    fun set(key: String, value: Boolean) = apply(key, value)
}
