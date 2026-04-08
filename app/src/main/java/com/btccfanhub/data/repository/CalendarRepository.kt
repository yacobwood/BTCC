package com.btccfanhub.data.repository

import android.content.Context
import com.btccfanhub.data.store.NetworkDiskCache
import com.btccfanhub.data.model.CalendarData
import com.btccfanhub.data.model.Corner
import com.btccfanhub.data.model.LapRecord
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.model.RaceSession
import com.btccfanhub.data.model.Sector
import com.btccfanhub.data.model.TrackInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.btccfanhub.data.network.HttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

object CalendarRepository {

    private const val URL =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json"

    private val client = HttpClient.client

    @Volatile private var cache: CalendarData? = null
    @Volatile private var cacheTime: Long = 0
    private const val TTL = 5 * 60_000L // 5 minutes so calendar/hero image updates appear soon after push

    private val EMPTY = CalendarData(LocalDate.of(2026, 4, 18), emptyList(), emptyMap())

    suspend fun getCalendarData(): CalendarData = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        cache?.takeIf { now - cacheTime < TTL }?.let { return@withContext it }
        try {
            val body = client.newCall(
                Request.Builder()
                    .url("$URL?t=$now")
                    .header("User-Agent", "BTCCFanHub/1.0 Android")
                    .build()
            ).execute().body?.string() ?: return@withContext cache ?: EMPTY
            NetworkDiskCache.write("calendar", body)
            val result = parse(body)
            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: NetworkDiskCache.read("calendar")?.let { runCatching { parse(it) }.getOrNull() } ?: EMPTY
        }
    }

    suspend fun getCalendarFromAssets(context: Context): CalendarData = withContext(Dispatchers.IO) {
        runCatching {
            context.assets.open("calendar.json").bufferedReader().use { it.readText() }.let { parse(it) }
        }.getOrDefault(EMPTY)
    }

    fun invalidateCache() {
        cache = null
        cacheTime = 0
    }

    private fun parse(json: String): CalendarData {
        val root = JSONObject(json)

        val seasonStartDate = try {
            LocalDate.parse(root.optString("seasonStartDate", "2026-04-18"))
        } catch (e: Exception) {
            LocalDate.of(2026, 4, 18)
        }

        val roundsArr = root.optJSONArray("rounds") ?: JSONArray()
        val races      = mutableListOf<Race>()
        val trackMap   = mutableMapOf<Int, TrackInfo>()

        for (i in 0 until roundsArr.length()) {
            val r = roundsArr.getJSONObject(i)
            val round = r.optInt("round", i + 1)
            val venue = r.optString("venue")

            val startDate = try {
                LocalDate.parse(r.optString("startDate"))
            } catch (e: Exception) { continue }
            val endDate = try {
                LocalDate.parse(r.optString("endDate"))
            } catch (e: Exception) { continue }

            val sessionsArr = r.optJSONArray("sessions") ?: JSONArray()
            val sessions = (0 until sessionsArr.length()).map { j ->
                val s = sessionsArr.getJSONObject(j)
                RaceSession(
                    name = s.optString("name", ""),
                    day  = s.optString("day", ""),
                    time = s.optString("time", "TBA"),
                )
            }

            races += Race(round, venue, startDate, endDate, r.optInt("tslEventId", 0), sessions)

            val imagesArr = r.optJSONArray("raceImages") ?: JSONArray()
            val raceImages = (0 until imagesArr.length()).map { imagesArr.getString(it) }

            fun lapRecord(obj: JSONObject?) = obj?.let {
                LapRecord(
                    driver = it.optString("driver"),
                    time   = it.optString("time"),
                    speed  = it.optString("speed"),
                    year   = it.optInt("year"),
                )
            }

            val guideArr = r.optJSONArray("trackGuide") ?: JSONArray()
            val sectors = (0 until guideArr.length()).map { si ->
                val sObj = guideArr.getJSONObject(si)
                val cornersArr = sObj.optJSONArray("corners") ?: JSONArray()
                Sector(
                    name = sObj.optString("sector"),
                    corners = (0 until cornersArr.length()).map { ci ->
                        val c = cornersArr.getJSONObject(ci)
                        Corner(
                            number      = c.optString("number"),
                            name        = c.optString("name"),
                            description = c.optString("description"),
                            overtaking  = c.optBoolean("overtaking", false),
                        )
                    }
                )
            }

            trackMap[round] = TrackInfo(
                round            = round,
                venue            = venue,
                location         = r.optString("location"),
                country          = r.optString("country"),
                lat              = r.optDouble("lat", 0.0),
                lng              = r.optDouble("lng", 0.0),
                lengthMiles      = r.optString("lengthMiles"),
                lengthKm         = r.optString("lengthKm"),
                corners          = r.optInt("corners"),
                about            = r.optString("about"),
                btccFact         = r.optString("btccFact"),
                imageUrl         = r.optString("imageUrl"),
                layoutImageUrl   = r.optString("layoutImageUrl"),
                raceImages       = raceImages,
                firstBtccYear    = r.optInt("firstBtccYear").takeIf { it > 0 },
                qualifyingRecord = lapRecord(r.optJSONObject("qualifyingRecord")),
                raceRecord       = lapRecord(r.optJSONObject("raceRecord")),
                trackGuide       = sectors,
                youtubeUrl       = r.optString("youtubeUrl"),
            )
        }

        val liveTimingEnabled = root.optBoolean("liveTimingEnabled", true)
        return CalendarData(seasonStartDate, races, trackMap, liveTimingEnabled)
    }
}
