package com.btcchub.data.repository

import com.btcchub.data.model.DayForecast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.time.LocalDate
import java.time.temporal.ChronoUnit

object WeatherRepository {

    private val client = OkHttpClient()

    private data class CacheKey(val round: Int, val today: LocalDate)
    private data class CacheEntry(val data: List<DayForecast>, val time: Long)

    private val cache = mutableMapOf<CacheKey, CacheEntry>()
    private const val TTL = 60 * 60_000L // 1 hour
    private const val MAX_FORECAST_DAYS = 16L

    suspend fun getForecast(
        round: Int,
        lat: Double,
        lng: Double,
        startDate: LocalDate,
        endDate: LocalDate,
    ): List<DayForecast>? = withContext(Dispatchers.IO) {
        val today = LocalDate.now()
        if (ChronoUnit.DAYS.between(today, startDate) > MAX_FORECAST_DAYS) return@withContext null

        val key = CacheKey(round, today)
        val now = System.currentTimeMillis()
        cache[key]?.takeIf { now - it.time < TTL }?.let { return@withContext it.data }

        try {
            val url = "https://api.open-meteo.com/v1/forecast" +
                "?latitude=$lat&longitude=$lng" +
                "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max" +
                "&timezone=Europe/London" +
                "&start_date=$startDate&end_date=$endDate"

            val body = client.newCall(
                Request.Builder().url(url)
                    .header("User-Agent", "BTCCFanHub/1.0 Android")
                    .build()
            ).execute().use { it.body?.string() } ?: return@withContext null

            val result = parse(body)
            cache[key] = CacheEntry(result, now)
            result
        } catch (_: Exception) {
            null
        }
    }

    private fun parse(json: String): List<DayForecast> {
        val daily = JSONObject(json).getJSONObject("daily")
        val dates   = daily.getJSONArray("time")
        val codes   = daily.getJSONArray("weather_code")
        val maxTemp = daily.getJSONArray("temperature_2m_max")
        val minTemp = daily.getJSONArray("temperature_2m_min")
        val precip  = daily.getJSONArray("precipitation_probability_max")
        val wind    = daily.getJSONArray("wind_speed_10m_max")

        return (0 until dates.length()).map { i ->
            DayForecast(
                date                     = LocalDate.parse(dates.getString(i)),
                weatherCode              = codes.optInt(i, 0),
                tempMax                  = maxTemp.optDouble(i, 0.0),
                tempMin                  = minTemp.optDouble(i, 0.0),
                precipitationProbability = precip.optInt(i, 0),
                windSpeedMax             = wind.optDouble(i, 0.0),
            )
        }
    }
}
