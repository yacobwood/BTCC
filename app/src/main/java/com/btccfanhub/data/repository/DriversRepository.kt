package com.btccfanhub.data.repository

import com.btccfanhub.data.NetworkDiskCache
import com.btccfanhub.data.model.Driver
import com.btccfanhub.data.model.GridData
import com.btccfanhub.data.model.SeasonStat
import com.btccfanhub.data.model.Team
import com.btccfanhub.data.model.TeamParticipation
import com.btccfanhub.data.model.TeamSeasonStat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.btccfanhub.data.network.HttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

object DriversRepository {

    private const val URL =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/drivers.json"

    private val client = HttpClient.client

    @Volatile private var cache: GridData? = null
    @Volatile private var cacheTime: Long = 0
    private const val TTL = 5 * 60_000L

    suspend fun fetchGrid(): GridData = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        cache?.takeIf { now - cacheTime < TTL }?.let { return@withContext it }
        try {
            val body = client.newCall(
                Request.Builder()
                    .url("$URL?t=$now")
                    .header("User-Agent", "BTCCFanHub/1.0 Android")
                    .build()
            ).execute().body?.string() ?: return@withContext cache ?: GridData(emptyList(), emptyList())
            NetworkDiskCache.write("drivers", body)
            val result = parse(body)
            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: NetworkDiskCache.read("drivers")?.let { runCatching { parse(it) }.getOrNull() } ?: GridData(emptyList(), emptyList())
        }
    }

    private fun parse(json: String): GridData {
        val root = JSONObject(json)

        val driversArr = root.optJSONArray("drivers") ?: JSONArray()
        val drivers = (0 until driversArr.length()).map { i ->
            val d = driversArr.getJSONObject(i)
            val histArr = d.optJSONArray("history") ?: JSONArray()
            Driver(
                number      = d.optInt("number"),
                name        = d.optString("name"),
                team        = d.optString("team"),
                car         = d.optString("car"),
                imageUrl    = d.optString("imageUrl"),
                nationality = d.optString("nationality", "British"),
                bio         = d.optString("bio"),
                dateOfBirth = d.optString("dateOfBirth", ""),
                birthplace  = d.optString("birthplace", ""),
                history     = (0 until histArr.length()).map { j ->
                    val h = histArr.getJSONObject(j)
                    val teamsArr = h.optJSONArray("teams")
                    val teams = if (teamsArr != null) {
                        (0 until teamsArr.length()).map { k ->
                            val t = teamsArr.getJSONObject(k)
                            TeamParticipation(
                                name  = t.optString("name"),
                                car   = t.optString("car"),
                                races = if (t.has("races")) t.optInt("races") else null
                            )
                        }
                    } else {
                        emptyList<TeamParticipation>()
                    }
                    SeasonStat(
                        year        = h.optInt("year"),
                        team        = h.optString("team"),
                        car         = h.optString("car"),
                        pos         = h.optInt("pos"),
                        points      = h.optInt("points"),
                        wins        = h.optInt("wins"),
                        podiums     = h.optInt("podiums"),
                        poles       = h.optInt("poles"),
                        fastestLaps = h.optInt("fastestLaps"),
                        isChampion  = h.optBoolean("champion"),
                        teams       = teams,
                    )
                },
            )
        }

        val teamsArr = root.optJSONArray("teams") ?: JSONArray()
        val teams = (0 until teamsArr.length()).map { i ->
            val t = teamsArr.getJSONObject(i)
            val name = t.optString("name")
            val histArr = t.optJSONArray("history") ?: JSONArray()
            Team(
                name                 = name,
                car                  = t.optString("car"),
                entries              = t.optInt("entries"),
                bio                  = t.optString("bio"),
                standing2025         = t.optInt("standing2025"),
                points2025           = t.optInt("points2025"),
                carImageUrl          = t.optString("carImageUrl"),
                founded              = t.optInt("founded"),
                base                 = t.optString("base"),
                driversChampionships = t.optInt("driversChampionships"),
                teamsChampionships   = t.optInt("teamsChampionships"),
                history              = (0 until histArr.length()).map { j ->
                    val h = histArr.getJSONObject(j)
                    TeamSeasonStat(
                        year   = h.optInt("year"),
                        pos    = h.optInt("pos"),
                        points = h.optInt("points"),
                    )
                },
                drivers              = drivers.filter { it.team == name },
            )
        }

        return GridData(drivers, teams)
    }
}
