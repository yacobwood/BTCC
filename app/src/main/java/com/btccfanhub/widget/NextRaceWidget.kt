package com.btccfanhub.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import com.btccfanhub.data.repository.CalendarRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

class NextRaceWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val views = buildViews(context)
                for (id in appWidgetIds) {
                    appWidgetManager.updateAppWidget(id, views)
                }
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        private val DAY_FMT        = DateTimeFormatter.ofPattern("d")
        private val MONTH_YEAR_FMT = DateTimeFormatter.ofPattern("MMM yyyy")

        private suspend fun buildViews(context: Context): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.next_race_widget)

            // Tap to open app
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            val today = LocalDate.now()
            val calendar = try { CalendarRepository.getCalendarData() } catch (e: Exception) { null }
            val nextRace = calendar?.rounds?.firstOrNull { it.endDate >= today }

            if (nextRace == null) {
                views.setTextViewText(R.id.widget_round, "BTCC 2026")
                views.setTextViewText(R.id.widget_venue, "Season complete")
                views.setTextViewText(R.id.widget_dates, "")
                views.setTextViewText(R.id.widget_countdown, "")
                views.setTextViewText(R.id.widget_countdown_label, "")
                return views
            }

            val isWeekend  = today >= nextRace.startDate
            val daysUntil  = ChronoUnit.DAYS.between(today, nextRace.startDate)
            val dateString = "${nextRace.startDate.format(DAY_FMT)} - ${nextRace.endDate.format(DAY_FMT)} ${nextRace.endDate.format(MONTH_YEAR_FMT)}"

            views.setTextViewText(R.id.widget_round, "ROUND ${nextRace.round}")
            views.setTextViewText(R.id.widget_venue, nextRace.venue)
            views.setTextViewText(R.id.widget_dates, dateString)

            when {
                isWeekend    -> {
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
                    views.setTextViewText(R.id.widget_countdown_label, "DAYS\nTO GO")
                    views.setTextColor(R.id.widget_countdown, 0xFFFFFFFF.toInt())
                }
            }

            return views
        }

        /** Call this to force-refresh all placed instances of the widget. */
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, NextRaceWidget::class.java))
            if (ids.isEmpty()) return
            val pending = Intent(context, NextRaceWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(pending)
        }
    }
}
