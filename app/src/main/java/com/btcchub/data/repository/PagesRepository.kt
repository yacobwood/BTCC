package com.btcchub.data.repository

import android.content.Context
import com.btcchub.data.model.ContentBlock
import com.btcchub.data.model.InfoPage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

object PagesRepository {

    private const val URL =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/pages.json"

    private val client = OkHttpClient()

    @Volatile private var cache: List<InfoPage>? = null
    @Volatile private var cacheTime: Long = 0
    private const val TTL = 60 * 60_000L

    suspend fun getPages(): List<InfoPage> = withContext(Dispatchers.IO) {
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
        } catch (_: Exception) {
            cache ?: emptyList()
        }
    }

    suspend fun getPage(id: String): InfoPage? = getPages().find { it.id == id }

    suspend fun getPagesFromAssets(context: Context): List<InfoPage> = withContext(Dispatchers.IO) {
        try {
            val list = context.assets.open("pages.json").bufferedReader().use { it.readText() }.let { parse(it) }
            if (list.isNotEmpty()) {
                cache = list
                cacheTime = System.currentTimeMillis()
            }
            list
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun parse(json: String): List<InfoPage> {
        val root = JSONObject(json)
        val arr = root.optJSONArray("pages") ?: return emptyList()
        return (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            val sectionsArr = obj.optJSONArray("sections") ?: org.json.JSONArray()
            InfoPage(
                id = obj.optString("id"),
                title = obj.optString("title"),
                icon = obj.optString("icon"),
                sections = (0 until sectionsArr.length()).map { s ->
                    val sObj = sectionsArr.getJSONObject(s)
                    ContentBlock(
                        type = sObj.optString("type"),
                        body = sObj.optString("body"),
                        url = sObj.optString("url"),
                    )
                }
            )
        }
    }
}
