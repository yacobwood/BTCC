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
import java.time.temporal.ChronoUnit

class SmallWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                withTimeout(10_000L) {
                    val cal = fetchNextRace()
                    for (id in appWidgetIds) {
                        val opts = appWidgetManager.getAppWidgetOptions(id)
                        val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 40)
                        val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
                        val theme = WidgetPrefs.getTheme(context, id)
                        val views = buildViews(context, cal, minW, minH, theme)
                        appWidgetManager.updateAppWidget(id, views)
                    }
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
        val minW = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 40)
        val minH = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
        val theme = WidgetPrefs.getTheme(context, appWidgetId)

        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                withTimeout(10_000L) {
                    val cal = fetchNextRace()
                    val views = buildViews(context, cal, minW, minH, theme)
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }
            } finally { pending.finish() }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        appWidgetIds.forEach { WidgetPrefs.deleteTheme(context, it) }
    }

    private fun buildViews(
        context: Context,
        cal: Triple<LocalDate, String, Int>?,
        widthDp: Int,
        heightDp: Int,
        theme: WidgetTheme,
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_small)

        try {
            views.setImageViewBitmap(R.id.widget_livery, LiveryRenderer.buildLiveryBitmap(context, widthDp, heightDp, theme))
        } catch (_: Exception) {}

        val isWeekend = cal != null && LocalDate.now() >= cal.first && cal.third != 0
        val intent = if (isWeekend) {
            Intent(Intent.ACTION_VIEW, Uri.parse("btccfanhub://live-timing/${cal!!.third}")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        } else {
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        }
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

        if (cal != null) {
            val days = ChronoUnit.DAYS.between(LocalDate.now(), cal.first)
            val isWeekend = LocalDate.now() >= cal.first
            when {
                isWeekend -> {
                    views.setTextViewText(R.id.widget_days, "LIVE")
                    views.setTextViewText(R.id.widget_days_label, "")
                }
                days <= 0L -> {
                    views.setTextViewText(R.id.widget_days, "NOW")
                    views.setTextViewText(R.id.widget_days_label, "")
                }
                days == 1L -> {
                    views.setTextViewText(R.id.widget_days, "TMW")
                    views.setTextViewText(R.id.widget_days_label, "")
                }
                else -> {
                    views.setTextViewText(R.id.widget_days, "$days")
                    views.setTextViewText(R.id.widget_days_label, "DAYS")
                }
            }
            val short = mapOf(
                "Brands Hatch Indy" to "BHI", "Brands Hatch GP" to "BHGP",
                "Brands Hatch" to "BH", "Donington Park" to "DON",
                "Donington Park GP" to "DPGP", "Thruxton" to "THR",
                "Oulton Park" to "OUL", "Croft" to "CRO",
                "Snetterton" to "SNE", "Knockhill" to "KNO", "Silverstone" to "SIL",
            )
            views.setTextViewText(R.id.widget_venue, short[cal.second] ?: cal.second.take(3).uppercase())
        } else {
            views.setTextViewText(R.id.widget_days, "--")
            views.setTextViewText(R.id.widget_days_label, "")
            views.setTextViewText(R.id.widget_venue, "")
        }

        return views
    }

    private fun fetchNextRace(): Triple<LocalDate, String, Int>? {
        return try {
            val body = URL("https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json").readText()
            val rounds = JSONObject(body).optJSONArray("rounds") ?: return null
            val today = LocalDate.now()
            for (i in 0 until rounds.length()) {
                val r = rounds.getJSONObject(i)
                if (LocalDate.parse(r.optString("endDate")) >= today) {
                    return Triple(LocalDate.parse(r.optString("startDate")), r.optString("venue"), r.optInt("tslEventId", 0))
                }
            }
            null
        } catch (_: Exception) { null }
    }
}
