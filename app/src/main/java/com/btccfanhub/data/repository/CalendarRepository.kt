package com.btccfanhub.data.repository

import com.btccfanhub.data.model.CalendarData
import com.btccfanhub.data.model.LapRecord
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.model.TrackInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

object CalendarRepository {

    private const val URL =
        "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json"

    private val client = OkHttpClient()

    @Volatile private var cache: CalendarData? = null
    @Volatile private var cacheTime: Long = 0
    private const val TTL = 60 * 60_000L // 1 hour

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
            val result = parse(body)
            cache = result
            cacheTime = now
            result
        } catch (e: Exception) {
            cache ?: EMPTY
        }
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

            races += Race(round, venue, startDate, endDate)

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

            trackMap[round] = TrackInfo(
                round            = round,
                venue            = venue,
                location         = r.optString("location"),
                country          = r.optString("country"),
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
            )
        }

        return CalendarData(seasonStartDate, races, trackMap)
    }
}
