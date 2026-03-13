package com.btccfanhub.data.repository

import android.content.Context
import com.btccfanhub.data.DriverProgressionSeries
import com.btccfanhub.data.DriverSeasonStats
import com.btccfanhub.data.SeasonData
import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.model.RoundResult
import com.btccfanhub.data.model.TeamStanding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

object SeasonRepository {

    private const val ASSET_PATH = "data/season_%d.json"

    private val cache = mutableMapOf<Int, SeasonData>()

    suspend fun getSeason(context: Context, year: Int): SeasonData? = withContext(Dispatchers.IO) {
        cache[year] ?: loadFromAssets(context, year)?.also { cache[year] = it }
    }

    fun invalidateCache() {
        cache.clear()
    }

    private fun loadFromAssets(context: Context, year: Int): SeasonData? {
        val path = ASSET_PATH.format(year)
        return try {
            val json = context.assets.open(path).bufferedReader().use { it.readText() }
            parse(JSONObject(json), year)
        } catch (_: Exception) {
            null
        }
    }

    private fun parse(root: JSONObject, year: Int): SeasonData {
        val drivers = parseDrivers(root.optJSONArray("drivers"))
        val teams = parseTeams(root.optJSONArray("teams"))
        val rounds = parseRounds(root.optJSONArray("rounds"))
        val driverStats = parseDriverStats(root.optJSONArray("driverStats"))
        val progression = parseProgression(root.optJSONArray("progression"))
        return SeasonData(
            year = year,
            drivers = drivers,
            teams = teams,
            rounds = rounds,
            driverStats = driverStats,
            progression = progression,
        )
    }

    private fun parseDriverStats(arr: org.json.JSONArray?): List<DriverSeasonStats> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            DriverSeasonStats(
                driver = o.optString("driver", ""),
                team = o.optString("team", ""),
                races = o.optInt("races", 0),
                wins = o.optInt("wins", 0),
                podiums = o.optInt("podiums", 0),
                poles = o.optInt("poles", 0),
                dnfs = o.optInt("dnfs", 0),
            )
        }
    }

    private fun parseProgression(arr: org.json.JSONArray?): List<DriverProgressionSeries> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            val cumArr = o.optJSONArray("cumulativePointsByRound")
            val cumulativePointsByRound = if (cumArr != null) {
                (0 until cumArr.length()).map { j -> cumArr.optInt(j, 0) }
            } else emptyList()
            DriverProgressionSeries(
                driver = o.optString("driver", ""),
                team = o.optString("team", ""),
                cumulativePointsByRound = cumulativePointsByRound,
            )
        }
    }

    private fun parseDrivers(arr: org.json.JSONArray?): List<DriverStanding> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            DriverStanding(
                position = o.optInt("position", 0),
                name = o.optString("name", ""),
                team = o.optString("team", ""),
                teamSecondary = o.optString("teamSecondary", "").takeIf { it.isNotEmpty() },
                car = o.optString("car", ""),
                points = o.optInt("points", 0),
                wins = o.optInt("wins", 0),
            )
        }
    }

    private fun parseTeams(arr: org.json.JSONArray?): List<TeamStanding> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            TeamStanding(
                position = o.optInt("position", 0),
                name = o.optString("name", ""),
                points = o.optInt("points", 0),
            )
        }
    }

    private fun parseRounds(arr: org.json.JSONArray?): List<RoundResult> {
        if (arr == null) return emptyList()
        return (0 until arr.length()).mapNotNull { i ->
            val r = arr.getJSONObject(i)
            val racesArr = r.optJSONArray("races") ?: return@mapNotNull null
            val races = (0 until racesArr.length()).map { j ->
                val race = racesArr.getJSONObject(j)
                val resultsArr = race.optJSONArray("results") ?: org.json.JSONArray()
                RaceEntry(
                    label = race.optString("label", "Race ${j + 1}"),
                    date = race.optString("date", "").takeIf { it.isNotEmpty() },
                    fullRaceUrl = race.optString("fullRaceUrl", "").takeIf { it.isNotEmpty() },
                    results = (0 until resultsArr.length()).map { k ->
                        val d = resultsArr.getJSONObject(k)
                        val fl = d.optBoolean("fastestLap", false) || d.optBoolean("fl", false)
                        DriverResult(
                            position = d.optInt("pos", 0),
                            number = d.optInt("no", 0),
                            driver = d.optString("driver", ""),
                            team = d.optString("team", ""),
                            laps = d.optInt("laps", 0),
                            time = d.optString("time", ""),
                            gap = d.optString("gap", "").takeIf { it.isNotEmpty() },
                            bestLap = d.optString("bestLap", ""),
                            points = d.optInt("points", 0),
                            fastestLap = fl,
                            leadLap = d.optBoolean("leadLap", false) || d.optBoolean("l", false),
                            pole = d.optBoolean("pole", false) || d.optBoolean("p", false),
                            displayTime = d.optString("displayTime", ""),
                        )
                    },
                )
            }
            RoundResult(
                round = r.optInt("round", i + 1),
                venue = r.optString("venue", ""),
                date = r.optString("date", ""),
                races = races,
                polePosition = r.optString("polePosition", "").takeIf { it.isNotEmpty() },
            )
        }
    }
}
