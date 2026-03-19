package com.btccfanhub.data.repository

import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.model.RoundResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.btccfanhub.data.network.HttpClient
import okhttp3.Request
import org.json.JSONObject

object RaceResultsRepository {

    /** BTCC points for positions 1–15 when JSON has no points (e.g. 2014–2023 data). */
    private val pointsByPosition = intArrayOf(20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1)

    /** Qualifying Race points scale (reg 1.6.2.a): 10,9,8,7,6,5,5,4,4,3,3,2,2,1,1. No bonus points. */
    private val qualifyingRacePoints = intArrayOf(10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1)

    private fun pointsFromPosition(position: Int): Int =
        if (position in 1..15) pointsByPosition[position - 1] else 0

    /** BTCC bonus points: fastest lap +1, lead lap +1, R1 pole +1. Used when JSON has no points. */
    private fun pointsWithBonuses(
        position: Int,
        fastestLap: Boolean,
        leadLap: Boolean,
        pole: Boolean,
        isRace1: Boolean,
    ): Int {
        var p = pointsFromPosition(position)
        if (fastestLap) p += 1
        if (leadLap) p += 1
        if (pole && isRace1) p += 1
        return p
    }

    private val client = HttpClient.client

    private const val CACHE_MS_LIVE       = 5 * 60 * 1000L      // 2026 — refresh every 5 min
    private const val CACHE_MS_HISTORICAL = 24 * 60 * 60 * 1000L // historical — rarely changes

    private val cache     = mutableMapOf<Int, List<RoundResult>>()
    private val cacheTime = mutableMapOf<Int, Long>()

    private fun urlFor(year: Int) =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results$year.json"

    suspend fun getResults(year: Int = 2026): List<RoundResult> = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val ttl = if (year == 2026) CACHE_MS_LIVE else CACHE_MS_HISTORICAL
        synchronized(cache) {
            val cached = cache[year]
            val age = now - (cacheTime[year] ?: 0L)
            if (cached != null && age < ttl) return@withContext cached
        }
        try {
            val request = Request.Builder().url("${urlFor(year)}?t=$now").build()
            val body = client.newCall(request).execute().use { it.body?.string() }
                ?: return@withContext synchronized(cache) { cache[year] } ?: emptyList()
            var rounds = parseRounds(JSONObject(body))
            if (year == 2023) rounds = reorder2023RoundsToChartOrder(rounds)
            synchronized(cache) { cache[year] = rounds; cacheTime[year] = now }
            rounds
        } catch (e: Exception) {
            synchronized(cache) { cache[year] } ?: emptyList()
        }
    }

    /** 2023 chart order: DPN, BHI, SNE, THR, OUL, CRO, KNO, DPGP, SIL, BHGP. */
    private fun reorder2023RoundsToChartOrder(rounds: List<RoundResult>): List<RoundResult> {
        val order = listOf(
            "Donington Park",
            "Brands Hatch Indy",
            "Snetterton",
            "Thruxton",
            "Oulton Park",
            "Croft",
            "Knockhill",
            "Donington Park GP",
            "Silverstone",
            "Brands Hatch GP",
        )
        val byVenue = rounds.associateBy { it.venue }
        val reordered = order.mapNotNull { venue -> byVenue[venue] }
        if (reordered.size != order.size) return rounds
        return reordered.mapIndexed { i, r -> r.copy(round = i + 1) }
    }

    private fun parseRounds(json: JSONObject): List<RoundResult> {
        val roundsArr = json.optJSONArray("rounds") ?: return emptyList()
        return (0 until roundsArr.length()).mapNotNull { i ->
            val r = roundsArr.getJSONObject(i)
            val racesArr = r.optJSONArray("races") ?: return@mapNotNull null
            val races = (0 until racesArr.length()).map { j ->
                val race = racesArr.getJSONObject(j)
                val resultsArr = race.optJSONArray("results") ?: org.json.JSONArray()
                val label   = race.optString("label", "Race ${j + 1}")
                val isQR    = label.equals("Qualifying Race", ignoreCase = true)
                val isRace1 = label.equals("Race 1", ignoreCase = true)
                RaceEntry(
                    label       = label,
                    date        = race.optString("date", "").takeIf { it.isNotEmpty() },
                    fullRaceUrl = race.optString("fullRaceUrl", "").takeIf { it.isNotEmpty() },
                    results = (0 until resultsArr.length()).map { k ->
                        val d = resultsArr.getJSONObject(k)
                        val pos = d.optInt("pos", 0)
                        val rawPoints = d.optInt("points", 0)
                        val fl = d.optBoolean("fastestLap", false) || d.optBoolean("fl", false)
                        val lead = d.optBoolean("leadLap", false) || d.optBoolean("l", false)
                        val pole = d.optBoolean("pole", false) || d.optBoolean("p", false)
                        val points = when {
                            rawPoints > 0 -> rawPoints
                            isQR -> if (pos in 1..15) qualifyingRacePoints[pos - 1] else 0
                            else -> pointsWithBonuses(pos, fl, lead, pole, isRace1)
                        }
                        DriverResult(
                            position     = pos,
                            number       = d.optInt("no", 0),
                            driver       = d.optString("driver", ""),
                            team         = d.optString("team", ""),
                            laps         = d.optInt("laps", 0),
                            time         = d.optString("time", ""),
                            gap          = d.optString("gap", "").takeIf { it.isNotEmpty() },
                            bestLap      = d.optString("bestLap", ""),
                            points       = points,
                            fastestLap   = fl,
                            leadLap      = lead,
                            pole         = pole,
                            avgLapSpeed  = d.optString("avgLapSpeed", "").takeIf { it.isNotEmpty() },
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
        synchronized(cache) { cache.clear(); cacheTime.clear() }
    }
}
