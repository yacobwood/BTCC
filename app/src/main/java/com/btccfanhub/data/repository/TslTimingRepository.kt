package com.btccfanhub.data.repository

import com.btccfanhub.data.network.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import org.json.JSONObject

data class TslEntry(
    val id: String,
    val no: String,
    val name: String,
    val team: String,
    val subClass: String,
    val position: Int,
    val laps: Int,
    val raceTime: String,
    val fastLapTime: String,
    val gap: String,
    val lastLapTime: String,
    val state: Int,
)

data class TslSession(
    val name: String,
    val series: String,
    val sessionFlag: String,
    val timeToGo: String,
    val clockRunning: Boolean,
    val trackName: String,
    val fastestLapId: String,
    val classification: List<TslEntry>,
)

object TslTimingRepository {

    private val client = HttpClient.client
    private const val BASE = "https://livetiming.tsl-timing.com/results/api/sessions"

    // Event IDs
    const val EVENT_GT_CUP_TEST_DONINGTON  = 261290   // GT Cup Test (live demo)
    const val EVENT_BTCC_TEST_CROFT        = 261341   // BTCC Test Day, Croft 24-25 Mar 2026

    // 2026 BTCC season
    const val EVENT_BTCC_RD1_3_DONINGTON   = 261603   // Rd 1–3  Donington Park     18–19 Apr
    const val EVENT_BTCC_RD4_6_BRANDS_INDY = 261903   // Rd 4–6  Brands Hatch Indy   9–10 May
    const val EVENT_BTCC_RD7_9_SNETTERTON  = 262103   // Rd 7–9  Snetterton          23–24 May
    const val EVENT_BTCC_RD10_12_OULTON    = 262303   // Rd 10–12 Oulton Park          6–7 Jun
    const val EVENT_BTCC_RD13_15_THRUXTON  = 263003   // Rd 13–15 Thruxton            25–26 Jul
    const val EVENT_BTCC_RD16_18_KNOCKHILL = 263203   // Rd 16–18 Knockhill            8–9 Aug
    const val EVENT_BTCC_RD19_21_DONI_GP   = 263403   // Rd 19–21 Donington Park GP   22–23 Aug
    const val EVENT_BTCC_RD22_24_CROFT     = 263603   // Rd 22–24 Croft                5–6 Sep
    const val EVENT_BTCC_RD25_27_SILVER    = 263903   // Rd 25–27 Silverstone         26–27 Sep
    const val EVENT_BTCC_RD28_30_BRANDS_GP = 264103   // Rd 28–30 Brands Hatch GP     10–11 Oct

    suspend fun getSession(eventId: Int): TslSession? = withContext(Dispatchers.IO) {
        try {
            val body = client.newCall(
                Request.Builder()
                    .url("$BASE/$eventId/active")
                    .header("X-TSL-Event", eventId.toString())
                    .build()
            ).execute().use { it.body?.string() } ?: return@withContext null
            parse(body)
        } catch (_: Exception) {
            null
        }
    }

    private fun parse(json: String): TslSession? {
        return try {
            val root        = JSONObject(json)
            val clock       = root.optJSONObject("sessionClock")
            val track       = root.optJSONObject("track")
            val fastestLap  = root.optJSONObject("fastestLap")
            val classArr    = root.optJSONArray("classification")

            val entries = mutableListOf<TslEntry>()
            if (classArr != null) {
                for (i in 0 until classArr.length()) {
                    val e      = classArr.getJSONObject(i)
                    val result = e.optJSONObject("result") ?: JSONObject()
                    entries.add(
                        TslEntry(
                            id          = e.optString("id"),
                            no          = e.optString("no"),
                            name        = e.optString("name"),
                            team        = e.optString("team"),
                            subClass    = e.optString("subClass"),
                            position    = result.optInt("position", 0),
                            laps        = result.optInt("laps", 0),
                            raceTime    = result.optString("raceTime"),
                            fastLapTime = result.optString("fastLapTime"),
                            gap         = result.optString("gap"),
                            lastLapTime = e.optString("lastLapTime"),
                            state       = e.optInt("state", 0),
                        )
                    )
                }
            }

            TslSession(
                name          = root.optString("name"),
                series        = root.optString("series"),
                sessionFlag   = root.optString("sessionFlag", "Green"),
                timeToGo      = clock?.optString("timeToGo") ?: "",
                clockRunning  = clock?.optBoolean("running", false) ?: false,
                trackName     = track?.optString("displayName")?.ifEmpty { track.optString("name") } ?: "",
                fastestLapId  = fastestLap?.optString("id") ?: "",
                classification = entries,
            )
        } catch (_: Exception) {
            null
        }
    }
}
