package com.btcchub.data.repository

import com.btcchub.data.model.Driver
import com.btcchub.data.model.GridData
import com.btcchub.data.model.SeasonStat
import com.btcchub.data.model.Team
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject

object DriversRepository {

    private const val URL =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/drivers.json"

    private val client = OkHttpClient()

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
            val result = parse(body)
            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: GridData(emptyList(), emptyList())
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
                    )
                },
            )
        }

        val teamsArr = root.optJSONArray("teams") ?: JSONArray()
        val teams = (0 until teamsArr.length()).map { i ->
            val t = teamsArr.getJSONObject(i)
            val name = t.optString("name")
            Team(
                name         = name,
                car          = t.optString("car"),
                entries      = t.optInt("entries"),
                bio          = t.optString("bio"),
                standing2025 = t.optInt("standing2025"),
                points2025   = t.optInt("points2025"),
                carImageUrl  = t.optString("carImageUrl"),
                drivers      = drivers.filter { it.team == name },
            )
        }

        return GridData(drivers, teams)
    }
}
