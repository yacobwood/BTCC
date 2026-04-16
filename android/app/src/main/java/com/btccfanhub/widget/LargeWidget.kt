package com.btccfanhub.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.RemoteViews
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.net.URL
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

class LargeWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        // Show fallback immediately
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(id, fallbackViews(context, appWidgetManager, id))
        }
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try { withTimeout(25_000L) {
                val cal = fetchCalendar(context)
                val weather = if (cal != null && cal.lat != 0.0 && cal.lng != 0.0) fetchWeather(cal.lat, cal.lng, cal.startDate, cal.endDate) else emptyList()
                val sessions = cal?.sessions
                for (id in appWidgetIds) {
                    val opts = appWidgetManager.getAppWidgetOptions(id)
                    val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                    val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180)
                    val theme = WidgetPrefs.getTheme(context, id)
                    appWidgetManager.updateAppWidget(id, buildViews(context, cal, sessions, weather, minW, minH, theme))
                }
            } } finally { pending.finish() }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        val minW = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
        val minH = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180)
        val theme = WidgetPrefs.getTheme(context, appWidgetId)

        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try { withTimeout(25_000L) {
                val cal = fetchCalendar(context)
                val weather = if (cal != null && cal.lat != 0.0 && cal.lng != 0.0) fetchWeather(cal.lat, cal.lng, cal.startDate, cal.endDate) else emptyList()
                val sessions = cal?.sessions
                appWidgetManager.updateAppWidget(appWidgetId, buildViews(context, cal, sessions, weather, minW, minH, theme))
            } } finally { pending.finish() }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        appWidgetIds.forEach { WidgetPrefs.deleteTheme(context, it) }
    }

    private fun fallbackViews(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_large)
        val opts = appWidgetManager.getAppWidgetOptions(widgetId)
        val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
        val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 180)
        val theme = WidgetPrefs.getTheme(context, widgetId)
        try { views.setImageViewBitmap(R.id.widget_livery, LiveryRenderer.buildLiveryBitmap(context, minW, minH, theme)) } catch (_: Exception) {}
        views.setTextViewText(R.id.widget_venue, "BTCC Hub")
        views.setTextViewText(R.id.widget_days, "--")
        views.setTextViewText(R.id.widget_days_label, "")
        views.setTextViewText(R.id.widget_round_label, "")
        views.setTextViewText(R.id.widget_date, "Loading...")
        clearSchedule(views)
        val intent = Intent(context, MainActivity::class.java)
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        return views
    }

    private fun buildViews(
        context: Context,
        cal: CalInfo?,
        sessions: List<Sess>?,
        weather: List<DayWeather>,
        widthDp: Int,
        heightDp: Int,
        theme: WidgetTheme,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_large)

        // Set livery bitmap background
        try {
            views.setImageViewBitmap(
                R.id.widget_livery,
                LiveryRenderer.buildLiveryBitmap(context, widthDp, heightDp, theme),
            )
        } catch (_: Exception) { /* fallback: leave livery blank */ }

        val isRaceWeekend = cal != null && LocalDate.now() >= cal.startDate && cal.eventId != 0
        val intent = if (isRaceWeekend) {
            Intent(Intent.ACTION_VIEW, Uri.parse("btccfanhub://live-timing/${cal!!.eventId}")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        } else {
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        }
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

        if (cal == null) {
            views.setTextViewText(R.id.widget_venue, "BTCC Hub")
            views.setTextViewText(R.id.widget_days, "--")
            views.setTextViewText(R.id.widget_days_label, "")
            views.setTextViewText(R.id.widget_round_label, "BTCC 2026")
            views.setTextViewText(R.id.widget_date, "No data")
            clearSchedule(views)
            return views
        }

        views.setTextViewText(R.id.widget_round_label, "ROUNDS ${cal.rStart}–${cal.rEnd} · NEXT RACE")
        views.setTextViewText(R.id.widget_venue, cal.venue)
        views.setTextViewText(R.id.widget_date, cal.dateRange)

        val days = ChronoUnit.DAYS.between(LocalDate.now(), cal.startDate)
        val isWeekend = LocalDate.now() >= cal.startDate
        when {
            isWeekend -> { views.setTextViewText(R.id.widget_days, "RACE"); views.setTextViewText(R.id.widget_days_label, "WEEKEND") }
            days <= 0L -> { views.setTextViewText(R.id.widget_days, "TODAY"); views.setTextViewText(R.id.widget_days_label, "DAY
TO GO") }
            days == 1L -> { views.setTextViewText(R.id.widget_days, "1"); views.setTextViewText(R.id.widget_days_label, "DAY
TO GO") }
            else -> { views.setTextViewText(R.id.widget_days, "$days"); views.setTextViewText(R.id.widget_days_label, "DAYS\nTO GO") }
        }

        fun weatherText(date: LocalDate): String {
            val w = weather.find { it.date == date } ?: return ""
            val rain = if (w.precipProb > 0) " · ${w.precipProb}% rain" else ""
            return "${weatherEmoji(w.weatherCode)} ${w.tempMax}°$rain"
        }

        // Bind schedule
        if (sessions != null && sessions.isNotEmpty()) {
            val sat = sessions.filter { it.day == "SAT" }
            val sun = sessions.filter { it.day == "SUN" }
            views.setTextViewText(R.id.widget_sat_header, if (sat.isNotEmpty()) "SATURDAY" else "")
            views.setTextViewText(R.id.widget_sat_weather, if (sat.isNotEmpty()) weatherText(cal.startDate) else "")
            views.setTextViewText(R.id.widget_sun_header, if (sun.isNotEmpty()) "SUNDAY" else "")
            views.setTextViewText(R.id.widget_sun_weather, if (sun.isNotEmpty()) weatherText(cal.endDate) else "")
            bindRow(views, sat, 0, R.id.widget_sat_name1, R.id.widget_sat_time1)
            bindRow(views, sat, 1, R.id.widget_sat_name2, R.id.widget_sat_time2)
            bindRow(views, sat, 2, R.id.widget_sat_name3, R.id.widget_sat_time3)
            bindRow(views, sun, 0, R.id.widget_sun_name1, R.id.widget_sun_time1)
            bindRow(views, sun, 1, R.id.widget_sun_name2, R.id.widget_sun_time2)
            bindRow(views, sun, 2, R.id.widget_sun_name3, R.id.widget_sun_time3)
        } else {
            clearSchedule(views)
        }

        return views
    }

    private fun bindRow(views: RemoteViews, sessions: List<Sess>, idx: Int, nameId: Int, timeId: Int) {
        if (idx < sessions.size) {
            val s = sessions[idx]
            views.setTextViewText(nameId, s.name)
            views.setTextViewText(timeId, s.time)
        } else {
            views.setTextViewText(nameId, "")
            views.setTextViewText(timeId, "")
        }
    }

    private fun clearSchedule(views: RemoteViews) {
        views.setTextViewText(R.id.widget_sat_header, "")
        views.setTextViewText(R.id.widget_sat_weather, "")
        views.setTextViewText(R.id.widget_sun_header, "")
        views.setTextViewText(R.id.widget_sun_weather, "")
        for (id in intArrayOf(
            R.id.widget_sat_name1, R.id.widget_sat_time1,
            R.id.widget_sat_name2, R.id.widget_sat_time2,
            R.id.widget_sat_name3, R.id.widget_sat_time3,
            R.id.widget_sun_name1, R.id.widget_sun_time1,
            R.id.widget_sun_name2, R.id.widget_sun_time2,
            R.id.widget_sun_name3, R.id.widget_sun_time3,
        )) {
            views.setTextViewText(id, "")
        }
    }

    private fun fetchWeather(lat: Double, lng: Double, startDate: LocalDate, endDate: LocalDate): List<DayWeather> {
        return try {
            val today = LocalDate.now()
            if (ChronoUnit.DAYS.between(today, startDate) > 16) return emptyList()
            val url = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lng&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=Europe/London&start_date=$startDate&end_date=$endDate"
            val json = JSONObject(URL(url).readText())
            val d = json.optJSONObject("daily") ?: return emptyList()
            val times = d.optJSONArray("time") ?: return emptyList()
            val codes = d.optJSONArray("weather_code")
            val temps = d.optJSONArray("temperature_2m_max")
            val precip = d.optJSONArray("precipitation_probability_max")
            (0 until times.length()).map { i ->
                DayWeather(LocalDate.parse(times.getString(i)), temps?.optDouble(i, 0.0)?.toInt() ?: 0, precip?.optInt(i, 0) ?: 0, codes?.optInt(i, 0) ?: 0)
            }
        } catch (_: Exception) { emptyList() }
    }

    private fun weatherEmoji(code: Int): String = when (code) {
        0, 1 -> "☀"
        2 -> "⛅"
        3 -> "☁"
        45, 48 -> "🌫"
        in 51..67, in 80..82 -> "🌧"
        in 71..77 -> "❄"
        in 95..99 -> "⛈"
        else -> "☁"
    }

    private fun fetchCalendar(context: Context): CalInfo? {
        val prefs = context.getSharedPreferences(WidgetPrefs.PREFS_NAME, Context.MODE_PRIVATE)
        val body = try {
            val text = URL("https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json").readText()
            prefs.edit().putString("calendar_json", text).apply()
            text
        } catch (_: Exception) {
            prefs.getString("calendar_json", null)
        } ?: return null
        return try {
            val rounds = JSONObject(body).optJSONArray("rounds") ?: return null
            val today = LocalDate.now()
            var result: CalInfo? = null
            for (i in 0 until rounds.length()) {
                val r = rounds.getJSONObject(i)
                if (LocalDate.parse(r.optString("endDate")) >= today) {
                    val round = r.optInt("round", 1)
                    val rStart = (round - 1) * 3 + 1
                    val startDate = LocalDate.parse(r.optString("startDate"))
                    val endDate = LocalDate.parse(r.optString("endDate"))
                    val dayFmt = DateTimeFormatter.ofPattern("d")
                    val monthYearFmt = DateTimeFormatter.ofPattern("MMM yyyy")
                    val sessArr = r.optJSONArray("sessions")
                    val sess = if (sessArr != null) (0 until sessArr.length()).map { j ->
                        val s = sessArr.getJSONObject(j)
                        Sess(s.optString("name"), s.optString("day"), s.optString("time", "TBA"))
                    } else emptyList()
                    result = CalInfo(r.optString("venue"), startDate, endDate, "${startDate.format(dayFmt)} - ${endDate.format(dayFmt)} ${endDate.format(monthYearFmt)}", rStart, rStart + 2, round, r.optInt("tslEventId", 0), sess, r.optDouble("lat", 0.0), r.optDouble("lng", 0.0))
                    break
                }
            }
            result
        } catch (_: Exception) { null }
    }

    data class CalInfo(val venue: String, val startDate: LocalDate, val endDate: LocalDate, val dateRange: String, val rStart: Int, val rEnd: Int, val round: Int, val eventId: Int = 0, val sessions: List<Sess> = emptyList(), val lat: Double = 0.0, val lng: Double = 0.0)
    data class Sess(val name: String, val day: String, val time: String)
    data class DayWeather(val date: LocalDate, val tempMax: Int, val precipProb: Int, val weatherCode: Int)
}
