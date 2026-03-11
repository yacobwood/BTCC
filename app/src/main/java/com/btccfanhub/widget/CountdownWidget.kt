package com.btccfanhub.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import com.btccfanhub.data.model.RaceSession
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.ScheduleRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

class CountdownWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                for (id in appWidgetIds) {
                    val opts = appWidgetManager.getAppWidgetOptions(id)
                    val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 40)
                    val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
                    val views = buildViews(context, minW, minH)
                    appWidgetManager.updateAppWidget(id, views)
                }
            } finally {
                pending.finish()
            }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val minW = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 40)
                val minH = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
                val views = buildViews(context, minW, minH)
                appWidgetManager.updateAppWidget(appWidgetId, views)
            } finally {
                pending.finish()
            }
        }
    }

    private enum class SizeClass { SMALL, WIDE, WIDE_TALL }

    companion object {
        private val DAY_FMT        = DateTimeFormatter.ofPattern("d")
        private val MONTH_YEAR_FMT = DateTimeFormatter.ofPattern("MMM yyyy")

        private val SAT_NAME_IDS = intArrayOf(R.id.widget_sat_name1, R.id.widget_sat_name2, R.id.widget_sat_name3)
        private val SAT_TIME_IDS = intArrayOf(R.id.widget_sat_time1, R.id.widget_sat_time2, R.id.widget_sat_time3)
        private val SUN_NAME_IDS = intArrayOf(R.id.widget_sun_name1, R.id.widget_sun_name2, R.id.widget_sun_name3)
        private val SUN_TIME_IDS = intArrayOf(R.id.widget_sun_time1, R.id.widget_sun_time2, R.id.widget_sun_time3)

        private suspend fun buildViews(
            context: Context,
            minWidth: Int = 40,
            minHeight: Int = 40,
        ): RemoteViews {
            val wide = minWidth >= 180
            val tall = minHeight >= 110
            val sizeClass = when {
                wide && tall -> SizeClass.WIDE_TALL
                wide         -> SizeClass.WIDE
                else         -> SizeClass.SMALL
            }

            val layoutId = when (sizeClass) {
                SizeClass.WIDE_TALL -> R.layout.next_race_weather_widget
                SizeClass.WIDE      -> R.layout.next_race_widget
                SizeClass.SMALL     -> R.layout.countdown_widget
            }
            val views = RemoteViews(context.packageName, layoutId)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 2, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            val today = LocalDate.now()
            val calendar = try { CalendarRepository.getCalendarData() } catch (_: Exception) { null }
            val nextRace = calendar?.rounds?.firstOrNull { it.endDate >= today }

            if (nextRace == null) {
                views.setTextViewText(R.id.widget_countdown, "")
                views.setTextViewText(R.id.widget_countdown_label, "SEASON\nOVER")
                when (sizeClass) {
                    SizeClass.SMALL -> {
                        views.setTextViewText(R.id.widget_venue, "")
                        views.setViewVisibility(R.id.widget_round, View.GONE)
                        views.setViewVisibility(R.id.widget_dates, View.GONE)
                    }
                    SizeClass.WIDE -> {
                        views.setTextViewText(R.id.widget_round, "BTCC 2026")
                        views.setTextViewText(R.id.widget_venue, "Season complete")
                        views.setTextViewText(R.id.widget_dates, "")
                    }
                    SizeClass.WIDE_TALL -> {
                        views.setTextViewText(R.id.widget_round, "BTCC 2026")
                        views.setTextViewText(R.id.widget_venue, "Season complete")
                        views.setTextViewText(R.id.widget_dates, "")
                        views.setViewVisibility(R.id.widget_divider, View.GONE)
                        views.setViewVisibility(R.id.widget_schedule_row, View.GONE)
                        views.setViewVisibility(R.id.widget_no_schedule, View.VISIBLE)
                        views.setTextViewText(R.id.widget_no_schedule, "See you next season!")
                    }
                }
                return views
            }

            val isWeekend = today >= nextRace.startDate
            val daysUntil = ChronoUnit.DAYS.between(today, nextRace.startDate)
            val rStart = (nextRace.round - 1) * 3 + 1
            val rEnd   = nextRace.round * 3
            val dateString = "${nextRace.startDate.format(DAY_FMT)} - ${nextRace.endDate.format(DAY_FMT)} ${nextRace.endDate.format(MONTH_YEAR_FMT)}"

            when {
                isWeekend -> {
                    views.setTextViewText(R.id.widget_countdown, "RACE")
                    views.setTextViewText(R.id.widget_countdown_label, "WEEKEND")
                    views.setTextColor(R.id.widget_countdown, 0xFFF5C400.toInt())
                }
                daysUntil == 1L -> {
                    views.setTextViewText(R.id.widget_countdown, "TMW")
                    views.setTextViewText(R.id.widget_countdown_label, "")
                    views.setTextColor(R.id.widget_countdown, 0xFFF5C400.toInt())
                }
                else -> {
                    views.setTextViewText(R.id.widget_countdown, "$daysUntil")
                    views.setTextViewText(
                        R.id.widget_countdown_label,
                        if (sizeClass == SizeClass.SMALL) "DAYS" else "DAYS\nTO GO",
                    )
                    views.setTextColor(R.id.widget_countdown, 0xFFFFFFFF.toInt())
                }
            }

            when (sizeClass) {
                SizeClass.SMALL -> {
                    views.setTextViewText(R.id.widget_venue, nextRace.venue)
                    views.setViewVisibility(R.id.widget_venue, if (minHeight >= 50) View.VISIBLE else View.GONE)

                    if (minHeight >= 100) {
                        views.setTextViewText(R.id.widget_round, "ROUNDS $rStart - $rEnd")
                        views.setViewVisibility(R.id.widget_round, View.VISIBLE)
                    } else {
                        views.setViewVisibility(R.id.widget_round, View.GONE)
                    }

                    views.setViewVisibility(R.id.widget_dates, View.GONE)
                }

                SizeClass.WIDE -> {
                    views.setTextViewText(R.id.widget_round, "ROUNDS $rStart - $rEnd")
                    views.setTextViewText(R.id.widget_venue, nextRace.venue)
                    views.setTextViewText(R.id.widget_dates, dateString)
                    views.setViewVisibility(R.id.widget_info_section, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_dates, if (minHeight >= 80) View.VISIBLE else View.GONE)
                }

                SizeClass.WIDE_TALL -> {
                    views.setTextViewText(R.id.widget_round, "ROUNDS $rStart - $rEnd")
                    views.setTextViewText(R.id.widget_venue, nextRace.venue)
                    views.setTextViewText(R.id.widget_dates, dateString)

                    val schedule = try { ScheduleRepository.getSchedule() } catch (_: Exception) { null }
                    val sessions = schedule?.get(nextRace.round)

                    if (sessions != null && sessions.isNotEmpty()) {
                        views.setViewVisibility(R.id.widget_divider, View.VISIBLE)
                        views.setViewVisibility(R.id.widget_schedule_row, View.VISIBLE)
                        views.setViewVisibility(R.id.widget_no_schedule, View.GONE)
                        bindSessions(views, sessions.filter { it.day == "SAT" }, SAT_NAME_IDS, SAT_TIME_IDS)
                        bindSessions(views, sessions.filter { it.day == "SUN" }, SUN_NAME_IDS, SUN_TIME_IDS)
                    } else {
                        views.setViewVisibility(R.id.widget_divider, View.VISIBLE)
                        views.setViewVisibility(R.id.widget_schedule_row, View.GONE)
                        views.setViewVisibility(R.id.widget_no_schedule, View.VISIBLE)
                    }
                }
            }

            return views
        }

        private fun bindSessions(
            views: RemoteViews,
            sessions: List<RaceSession>,
            nameIds: IntArray,
            timeIds: IntArray,
        ) {
            for (i in nameIds.indices) {
                if (i < sessions.size) {
                    views.setTextViewText(nameIds[i], abbreviate(sessions[i].name))
                    views.setTextViewText(timeIds[i], sessions[i].time)
                    views.setViewVisibility(nameIds[i], View.VISIBLE)
                    views.setViewVisibility(timeIds[i], View.VISIBLE)
                } else {
                    views.setViewVisibility(nameIds[i], View.GONE)
                    views.setViewVisibility(timeIds[i], View.GONE)
                }
            }
        }

        private fun abbreviate(name: String): String = when {
            name.startsWith("Free Practice") -> name.replace("Free Practice", "FP")
            else -> name
        }

        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, CountdownWidget::class.java))
            if (ids.isEmpty()) return
            val broadcast = Intent(context, CountdownWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(broadcast)
        }
    }
}
