package com.btcchub.data.repository

import com.btcchub.data.model.RaceSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

object ScheduleRepository {

    private val client = OkHttpClient()
    private val url = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/schedule.json"

    private var cache: Map<Int, List<RaceSession>>? = null
    private var cacheTime: Long = 0
    private const val CACHE_MS = 60 * 60 * 1000L // 1 hour — schedule changes rarely

    suspend fun getSchedule(): Map<Int, List<RaceSession>> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (cache != null && now - cacheTime < CACHE_MS) return@withContext cache!!

        try {
            val request = Request.Builder().url("$url?t=$now").build()
            val body = client.newCall(request).execute().use { it.body?.string() }
                ?: return@withContext emptyMap()

            val json = JSONObject(body)
            val roundsArr = json.optJSONArray("rounds") ?: return@withContext emptyMap()

            val result = mutableMapOf<Int, List<RaceSession>>()
            for (i in 0 until roundsArr.length()) {
                val r = roundsArr.getJSONObject(i)
                val round = r.optInt("round", -1)
                if (round == -1) continue
                val sessionsArr = r.optJSONArray("sessions") ?: continue
                result[round] = (0 until sessionsArr.length()).map { j ->
                    val s = sessionsArr.getJSONObject(j)
                    RaceSession(
                        name = s.optString("name", ""),
                        day  = s.optString("day", ""),
                        time = s.optString("time", "TBA"),
                    )
                }
            }

            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: emptyMap()
        }
    }
}
