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

data class TimetableRow(
    val day: String,
    val time: String,
    val endTime: String?,
    val series: String?,
    val session: String,
    val laps: String?,
)

data class TimetableCalInfo(
    val venue: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val dateRange: String,
    val rStart: Int,
    val rEnd: Int,
    val round: Int,
    val timetable: List<TimetableRow> = emptyList(),
)

class TimetableWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(id, fallbackViews(context, appWidgetManager, id))
        }
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try { withTimeout(25_000L) {
                val cal = fetchCalendar(context)
                for (id in appWidgetIds) {
                    val opts = appWidgetManager.getAppWidgetOptions(id)
                    val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                    val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 300)
                    val theme = WidgetPrefs.getTheme(context, id)
                    try {
                        appWidgetManager.updateAppWidget(id, buildViews(context, cal, id, minW, minH, theme))
                    } catch (_: Exception) {
                        appWidgetManager.updateAppWidget(id, fallbackViews(context, appWidgetManager, id))
                    }
                }
                appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_timetable_list)
            } } catch (_: Exception) {
                for (id in appWidgetIds) {
                    try { appWidgetManager.updateAppWidget(id, fallbackViews(context, appWidgetManager, id)) } catch (_: Exception) {}
                }
            } finally { pending.finish() }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        val minW = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
        val minH = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 300)
        val theme = WidgetPrefs.getTheme(context, appWidgetId)
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try { withTimeout(25_000L) {
                val cal = fetchCalendar(context)
                try {
                    appWidgetManager.updateAppWidget(appWidgetId, buildViews(context, cal, appWidgetId, minW, minH, theme))
                    appWidgetManager.notifyAppWidgetViewDataChanged(intArrayOf(appWidgetId), R.id.widget_timetable_list)
                } catch (_: Exception) {
                    appWidgetManager.updateAppWidget(appWidgetId, fallbackViews(context, appWidgetManager, appWidgetId))
                }
            } } catch (_: Exception) {
                try { appWidgetManager.updateAppWidget(appWidgetId, fallbackViews(context, appWidgetManager, appWidgetId)) } catch (_: Exception) {}
            } finally { pending.finish() }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        appWidgetIds.forEach { WidgetPrefs.deleteTheme(context, it) }
    }

    private fun fallbackViews(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_timetable)
        val opts = appWidgetManager.getAppWidgetOptions(widgetId)
        val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
        val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 300)
        val theme = WidgetPrefs.getTheme(context, widgetId)
        try { views.setImageViewBitmap(R.id.widget_livery, LiveryRenderer.buildLiveryBitmap(context, minW, minH, theme)) } catch (_: Exception) {}
        views.setTextViewText(R.id.widget_venue, "BTCC Hub")
        views.setTextViewText(R.id.widget_days, "--")
        views.setTextViewText(R.id.widget_days_label, "")
        views.setTextViewText(R.id.widget_round_label, "")
        views.setTextViewText(R.id.widget_date, "Loading...")
        val intent = Intent(context, MainActivity::class.java)
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, widgetId, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        return views
    }

    private fun buildViews(
        context: Context,
        cal: TimetableCalInfo?,
        widgetId: Int,
        widthDp: Int,
        heightDp: Int,
        theme: WidgetTheme,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_timetable)

        try {
            views.setImageViewBitmap(R.id.widget_livery, LiveryRenderer.buildLiveryBitmap(context, widthDp, heightDp, theme))
        } catch (_: Exception) {}

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, widgetId, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

        if (cal == null) {
            views.setTextViewText(R.id.widget_venue, "BTCC Hub")
            views.setTextViewText(R.id.widget_days, "--")
            views.setTextViewText(R.id.widget_days_label, "")
            views.setTextViewText(R.id.widget_round_label, "BTCC 2026")
            views.setTextViewText(R.id.widget_date, "No data")
            return views
        }

        views.setTextViewText(R.id.widget_round_label, "ROUNDS ${cal.rStart}–${cal.rEnd} · NEXT RACE")
        views.setTextViewText(R.id.widget_venue, cal.venue)
        views.setTextViewText(R.id.widget_date, cal.dateRange)

        val days = ChronoUnit.DAYS.between(LocalDate.now(), cal.startDate)
        val isWeekend = LocalDate.now() >= cal.startDate
        when {
            isWeekend -> { views.setTextViewText(R.id.widget_days, "RACE"); views.setTextViewText(R.id.widget_days_label, "WEEKEND") }
            days <= 0L -> { views.setTextViewText(R.id.widget_days, "TODAY"); views.setTextViewText(R.id.widget_days_label, "") }
            days == 1L -> { views.setTextViewText(R.id.widget_days, "1"); views.setTextViewText(R.id.widget_days_label, "DAY\nTO GO") }
            else -> { views.setTextViewText(R.id.widget_days, "$days"); views.setTextViewText(R.id.widget_days_label, "DAYS\nTO GO") }
        }

        // Wire ListView to the RemoteViewsService — unique URI per widget ID prevents adapter reuse
        val serviceIntent = Intent(context, TimetableWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        views.setRemoteAdapter(R.id.widget_timetable_list, serviceIntent)
        views.setEmptyView(R.id.widget_timetable_list, R.id.widget_timetable_empty)

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        views.setPendingIntentTemplate(
            R.id.widget_timetable_list,
            PendingIntent.getActivity(context, widgetId + 1000, tapIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
        )

        return views
    }

    companion object {
        fun fetchCalendar(context: Context): TimetableCalInfo? {
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
                for (i in 0 until rounds.length()) {
                    val r = rounds.getJSONObject(i)
                    val endDate = LocalDate.parse(r.optString("endDate"))
                    if (endDate >= today) {
                        val round = r.optInt("round", 1)
                        val rStart = (round - 1) * 3 + 1
                        val startDate = LocalDate.parse(r.optString("startDate"))
                        val dayFmt = DateTimeFormatter.ofPattern("d")
                        val monthYearFmt = DateTimeFormatter.ofPattern("MMM yyyy")
                        val ftArr = r.optJSONArray("fullTimetable")
                        val timetable = if (ftArr != null) (0 until ftArr.length()).map { j ->
                            val s = ftArr.getJSONObject(j)
                            TimetableRow(
                                day = s.optString("day"),
                                time = s.optString("time"),
                                endTime = s.optString("endTime").takeIf { it.isNotEmpty() && it != "null" },
                                series = s.optString("series").takeIf { it.isNotEmpty() && it != "null" },
                                session = s.optString("session"),
                                laps = s.optString("laps").takeIf { it.isNotEmpty() && it != "null" },
                            )
                        } else emptyList()
                        // Cache timetable JSON for the RemoteViewsFactory (cross-process read)
                        prefs.edit().putString("timetable_json_cache", ftArr?.toString() ?: "[]").apply()
                        return TimetableCalInfo(
                            venue = r.optString("venue"),
                            startDate = startDate,
                            endDate = endDate,
                            dateRange = "${startDate.format(dayFmt)} - ${endDate.format(dayFmt)} ${endDate.format(monthYearFmt)}",
                            rStart = rStart,
                            rEnd = rStart + 2,
                            round = round,
                            timetable = timetable,
                        )
                    }
                }
                null
            } catch (_: Exception) { null }
        }
    }
}
