package com.btcchub.data.repository

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

data class RadioStation(
    val name: String,
    val tagline: String,
    val streamUrl: String,
    val coverage: String,
)

object RadioRepository {

    private const val URL =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/radio.json"

    private val client = OkHttpClient()

    @Volatile private var cache: List<RadioStation>? = null
    @Volatile private var cacheTime: Long = 0
    private const val TTL = 24 * 60 * 60_000L // 24 hours — stream URLs rarely change

    suspend fun getStations(): List<RadioStation> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        cache?.takeIf { now - cacheTime < TTL }?.let { return@withContext it }
        try {
            val body = client.newCall(
                Request.Builder()
                    .url("$URL?t=$now")
                    .header("User-Agent", "BTCCFanHub/1.0 Android")
                    .build()
            ).execute().body?.string() ?: return@withContext cache ?: emptyList()
            val result = parse(body)
            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: emptyList()
        }
    }

    private fun parse(json: String): List<RadioStation> {
        val arr = JSONObject(json).optJSONArray("stations") ?: JSONArray()
        return (0 until arr.length()).map {
            val s = arr.getJSONObject(it)
            RadioStation(
                name      = s.optString("name"),
                tagline   = s.optString("tagline"),
                streamUrl = s.optString("streamUrl"),
                coverage  = s.optString("coverage"),
            )
        }
    }
}
