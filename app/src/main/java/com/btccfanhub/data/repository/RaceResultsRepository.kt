package com.btccfanhub.data.repository

import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.model.RoundResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

object RaceResultsRepository {

    private val client = OkHttpClient()
    private val url2026 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results.json"
    private val url2025 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2025.json"

    private var cache2026: List<RoundResult>? = null
    private var cacheTime2026: Long = 0
    private const val CACHE_MS = 5 * 60 * 1000L

    private var cache2025: List<RoundResult>? = null
    private var cacheTime2025: Long = 0
    private const val CACHE_MS_2025 = 24 * 60 * 60 * 1000L // historical — rarely changes

    suspend fun getResults(): List<RoundResult> = fetchAndCache(
        url = url2026,
        cache = { cache2026 },
        cacheTime = { cacheTime2026 },
        ttl = CACHE_MS,
        setCache = { r, t -> cache2026 = r; cacheTime2026 = t },
    )

    suspend fun getResults2025(): List<RoundResult> = fetchAndCache(
        url = url2025,
        cache = { cache2025 },
        cacheTime = { cacheTime2025 },
        ttl = CACHE_MS_2025,
        setCache = { r, t -> cache2025 = r; cacheTime2025 = t },
    )

    private suspend fun fetchAndCache(
        url: String,
        cache: () -> List<RoundResult>?,
        cacheTime: () -> Long,
        ttl: Long,
        setCache: (List<RoundResult>, Long) -> Unit,
    ): List<RoundResult> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        cache()?.let { if (now - cacheTime() < ttl) return@withContext it }

        try {
            val request = Request.Builder().url("$url?t=$now").build()
            val body = client.newCall(request).execute().use { it.body?.string() }
                ?: return@withContext cache() ?: emptyList()

            val rounds = parseRounds(JSONObject(body))
            setCache(rounds, now)
            rounds
        } catch (e: Exception) {
            cache() ?: emptyList()
        }
    }

    private fun parseRounds(json: JSONObject): List<RoundResult> {
        val roundsArr = json.optJSONArray("rounds") ?: return emptyList()
        return (0 until roundsArr.length()).mapNotNull { i ->
            val r = roundsArr.getJSONObject(i)
            val racesArr = r.optJSONArray("races") ?: return@mapNotNull null
            val races = (0 until racesArr.length()).map { j ->
                val race = racesArr.getJSONObject(j)
                val resultsArr = race.optJSONArray("results") ?: org.json.JSONArray()
                RaceEntry(
                    label = race.optString("label", "Race ${j + 1}"),
                    results = (0 until resultsArr.length()).map { k ->
                        val d = resultsArr.getJSONObject(k)
                        DriverResult(
                            position = d.optInt("pos", 0),
                            number   = d.optInt("no", 0),
                            driver   = d.optString("driver", ""),
                            team     = d.optString("team", ""),
                            laps     = d.optInt("laps", 0),
                            time     = d.optString("time", ""),
                            gap      = d.optString("gap", "").takeIf { it.isNotEmpty() },
                            bestLap  = d.optString("bestLap", ""),
                            points   = d.optInt("points", 0),
                        )
                    },
                )
            }
            RoundResult(
                round         = r.optInt("round", i + 1),
                venue         = r.optString("venue", ""),
                date          = r.optString("date", ""),
                races         = races,
                highlightsUrl = r.optString("highlightsUrl", "").takeIf { it.isNotEmpty() },
            )
        }
    }

    fun invalidateCache() {
        cache2026 = null
        cacheTime2026 = 0
    }
}
