package com.btccfanhub.data.repository

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

data class DriverPatch(
    val team: String?,
    val car: String?,
    val bio: String?,
)

object DriversRepository {

    private const val URL =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/drivers.json"

    private val client = OkHttpClient()

    @Volatile private var cache: Map<Int, DriverPatch>? = null
    @Volatile private var cacheTime: Long = 0

    fun fetch(): Map<Int, DriverPatch>? {
        val now = System.currentTimeMillis()
        cache?.takeIf { now - cacheTime < 5 * 60_000L }?.let { return it }
        return try {
            val body = client.newCall(
                Request.Builder()
                    .url(URL)
                    .header("User-Agent", "BTCCFanHub/1.0 Android")
                    .build()
            ).execute().body?.string() ?: return null
            parse(body).also { cache = it; cacheTime = now }
        } catch (e: Exception) {
            null
        }
    }

    private fun parse(json: String): Map<Int, DriverPatch> {
        val result = mutableMapOf<Int, DriverPatch>()
        val array = JSONObject(json).getJSONArray("drivers")
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            result[obj.getInt("number")] = DriverPatch(
                team = obj.optString("team").takeIf { it.isNotEmpty() },
                car  = obj.optString("car").takeIf { it.isNotEmpty() },
                bio  = obj.optString("bio").takeIf { it.isNotEmpty() },
            )
        }
        return result
    }
}
