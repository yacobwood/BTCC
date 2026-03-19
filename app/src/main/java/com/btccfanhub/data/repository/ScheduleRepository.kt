package com.btccfanhub.data.repository

import com.btccfanhub.data.NetworkDiskCache
import com.btccfanhub.data.model.RaceSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.btccfanhub.data.network.HttpClient
import okhttp3.Request
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject

object ScheduleRepository {

    private val client = HttpClient.client
    private val url = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/schedule.json"
    private val mutex = Mutex()

    private var cache: Map<Int, List<RaceSession>>? = null
    private var cacheTime: Long = 0
    private const val CACHE_MS = 15 * 60 * 1000L // 15 min — short enough to pick up time updates on race day

    suspend fun getSchedule(): Map<Int, List<RaceSession>> = withContext(Dispatchers.IO) {
        mutex.withLock {
            val now = System.currentTimeMillis()
            if (cache != null && now - cacheTime < CACHE_MS) return@withLock cache!!

            try {
                val request = Request.Builder().url("$url?t=$now").build()
                val body = client.newCall(request).execute().use { it.body?.string() }
                    ?: return@withLock cache ?: emptyMap()
                NetworkDiskCache.write("schedule", body)
                val result = parse(body)
                cache = result
                cacheTime = now
                result
            } catch (e: Exception) {
                cache ?: NetworkDiskCache.read("schedule")?.let { runCatching { parse(it) }.getOrNull() }
                ?: emptyMap()
            }
        }
    }

    private fun parse(body: String): Map<Int, List<RaceSession>> {
        val json = JSONObject(body)
        val roundsArr = json.optJSONArray("rounds") ?: return emptyMap()
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
        return result
    }
}
