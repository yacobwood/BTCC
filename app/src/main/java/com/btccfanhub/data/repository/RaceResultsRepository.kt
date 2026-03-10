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
    private val url2024 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2024.json"
    private val url2023 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2023.json"
    private val url2022 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2022.json"
    private val url2021 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2021.json"
    private val url2020 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2020.json"
    private val url2019 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2019.json"
    private val url2018 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2018.json"
    private val url2017 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2017.json"
    private val url2016 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2016.json"
    private val url2015 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2015.json"
    private val url2014 = "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2014.json"

    private var cache2026: List<RoundResult>? = null
    private var cacheTime2026: Long = 0
    private const val CACHE_MS = 5 * 60 * 1000L

    private var cache2025: List<RoundResult>? = null
    private var cacheTime2025: Long = 0
    private const val CACHE_MS_2025 = 24 * 60 * 60 * 1000L // historical — rarely changes

    private var cache2024: List<RoundResult>? = null; private var cacheTime2024: Long = 0
    private var cache2023: List<RoundResult>? = null; private var cacheTime2023: Long = 0
    private var cache2022: List<RoundResult>? = null; private var cacheTime2022: Long = 0
    private var cache2021: List<RoundResult>? = null; private var cacheTime2021: Long = 0
    private var cache2020: List<RoundResult>? = null; private var cacheTime2020: Long = 0
    private var cache2019: List<RoundResult>? = null; private var cacheTime2019: Long = 0
    private var cache2018: List<RoundResult>? = null; private var cacheTime2018: Long = 0
    private var cache2017: List<RoundResult>? = null; private var cacheTime2017: Long = 0
    private var cache2016: List<RoundResult>? = null; private var cacheTime2016: Long = 0
    private var cache2015: List<RoundResult>? = null; private var cacheTime2015: Long = 0
    private var cache2014: List<RoundResult>? = null; private var cacheTime2014: Long = 0

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

    suspend fun getResults2024(): List<RoundResult> = fetchAndCache(
        url = url2024,
        cache = { cache2024 },
        cacheTime = { cacheTime2024 },
        ttl = CACHE_MS_2025,
        setCache = { r, t -> cache2024 = r; cacheTime2024 = t },
    )

    suspend fun getResults2023(): List<RoundResult> = fetchAndCache(
        url = url2023,
        cache = { cache2023 },
        cacheTime = { cacheTime2023 },
        ttl = CACHE_MS_2025,
        setCache = { r, t -> cache2023 = r; cacheTime2023 = t },
    )

    suspend fun getResults2022(): List<RoundResult> = fetchAndCache(url2022, { cache2022 }, { cacheTime2022 }, CACHE_MS_2025) { r, t -> cache2022 = r; cacheTime2022 = t }
    suspend fun getResults2021(): List<RoundResult> = fetchAndCache(url2021, { cache2021 }, { cacheTime2021 }, CACHE_MS_2025) { r, t -> cache2021 = r; cacheTime2021 = t }
    suspend fun getResults2020(): List<RoundResult> = fetchAndCache(url2020, { cache2020 }, { cacheTime2020 }, CACHE_MS_2025) { r, t -> cache2020 = r; cacheTime2020 = t }
    suspend fun getResults2019(): List<RoundResult> = fetchAndCache(url2019, { cache2019 }, { cacheTime2019 }, CACHE_MS_2025) { r, t -> cache2019 = r; cacheTime2019 = t }
    suspend fun getResults2018(): List<RoundResult> = fetchAndCache(url2018, { cache2018 }, { cacheTime2018 }, CACHE_MS_2025) { r, t -> cache2018 = r; cacheTime2018 = t }
    suspend fun getResults2017(): List<RoundResult> = fetchAndCache(url2017, { cache2017 }, { cacheTime2017 }, CACHE_MS_2025) { r, t -> cache2017 = r; cacheTime2017 = t }
    suspend fun getResults2016(): List<RoundResult> = fetchAndCache(url2016, { cache2016 }, { cacheTime2016 }, CACHE_MS_2025) { r, t -> cache2016 = r; cacheTime2016 = t }
    suspend fun getResults2015(): List<RoundResult> = fetchAndCache(url2015, { cache2015 }, { cacheTime2015 }, CACHE_MS_2025) { r, t -> cache2015 = r; cacheTime2015 = t }
    suspend fun getResults2014(): List<RoundResult> = fetchAndCache(url2014, { cache2014 }, { cacheTime2014 }, CACHE_MS_2025) { r, t -> cache2014 = r; cacheTime2014 = t }

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
                    label       = race.optString("label", "Race ${j + 1}"),
                    date        = race.optString("date", "").takeIf { it.isNotEmpty() },
                    fullRaceUrl = race.optString("fullRaceUrl", "").takeIf { it.isNotEmpty() },
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
                polePosition  = r.optString("polePosition", "").takeIf { it.isNotEmpty() },
            )
        }
    }

    fun invalidateCache() {
        cache2026 = null; cacheTime2026 = 0
        cache2025 = null; cacheTime2025 = 0
        cache2024 = null; cacheTime2024 = 0
        cache2023 = null; cacheTime2023 = 0
        cache2022 = null; cacheTime2022 = 0
        cache2021 = null; cacheTime2021 = 0
        cache2020 = null; cacheTime2020 = 0
        cache2019 = null; cacheTime2019 = 0
        cache2018 = null; cacheTime2018 = 0
        cache2017 = null; cacheTime2017 = 0
        cache2016 = null; cacheTime2016 = 0
        cache2015 = null; cacheTime2015 = 0
        cache2014 = null; cacheTime2014 = 0
    }
}
