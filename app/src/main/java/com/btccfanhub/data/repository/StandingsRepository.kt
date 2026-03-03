package com.btccfanhub.data.repository

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

data class LiveStandings(
    val season: String,
    val round: Int,
    val venue: String,
    val drivers: List<DriverStanding>,
    val teams: List<TeamStanding>,
)

object StandingsRepository {

    private val client = OkHttpClient()
    private val url =
        "https://gist.githubusercontent.com/yacobwood/7a2af0a9690d24cab8eb608dd4c5ba42/raw/btcc-standings.json"

    // Cache: avoid re-fetching on every screen open (valid for 5 minutes)
    private var cache: LiveStandings? = null
    private var cacheTime: Long = 0
    private const val CACHE_MS = 5 * 60 * 1000L

    suspend fun getStandings(): LiveStandings? = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        if (cache != null && now - cacheTime < CACHE_MS) return@withContext cache

        try {
            val request = Request.Builder()
                .url("$url?t=$now") // bust CDN cache
                .build()
            val body = client.newCall(request).execute().use { it.body?.string() } ?: return@withContext null
            val json = JSONObject(body)

            val drivers = json.optJSONArray("drivers")?.let { arr ->
                (0 until arr.length()).map { i ->
                    val d = arr.getJSONObject(i)
                    DriverStanding(
                        position = d.optInt("pos", i + 1),
                        name = d.getString("name"),
                        team = d.optString("team", ""),
                        car = "",
                        points = d.optInt("points", 0),
                    )
                }
            } ?: emptyList()

            val teams = json.optJSONArray("teams")?.let { arr ->
                (0 until arr.length()).map { i ->
                    val t = arr.getJSONObject(i)
                    TeamStanding(
                        position = t.optInt("pos", i + 1),
                        name = t.getString("name"),
                        points = t.optInt("points", 0),
                    )
                }
            } ?: emptyList()

            val result = LiveStandings(
                season = json.optString("season", "2026"),
                round = json.optInt("round", 0),
                venue = json.optString("venue", ""),
                drivers = drivers,
                teams = teams,
            )
            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            null // fall back to hardcoded data in ResultsScreen
        }
    }

    fun invalidateCache() {
        cache = null
        cacheTime = 0
    }
}
