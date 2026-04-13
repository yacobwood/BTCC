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

open class CountdownWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val p = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try { withTimeout(10_000L) {
                val cal = fetchCal(ctx)
                for (id in ids) {
                    val o = mgr.getAppWidgetOptions(id)
                    val w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
                    val h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
                    val t = WidgetPrefs.getTheme(ctx, id)
                    mgr.updateAppWidget(id, build(ctx, cal, w, h, t))
                }
            } } finally { p.finish() }
        }
    }
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, o: Bundle) {
        onUpdate(ctx, mgr, intArrayOf(id))
    }
    override fun onDeleted(ctx: Context, ids: IntArray) {
        ids.forEach { WidgetPrefs.deleteTheme(ctx, it) }
    }
    private fun build(ctx: Context, cal: Cal?, w: Int, h: Int, theme: WidgetTheme): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_countdown)
        try { v.setImageViewBitmap(R.id.widget_livery, LiveryRenderer.buildLiveryBitmap(ctx, w, h, theme)) } catch (_: Exception) {}

        // Deep-link to live timing on race weekends, otherwise just open the app
        val isWeekend = cal != null && LocalDate.now() >= cal.start && cal.eventId != 0
        val intent = if (isWeekend) {
            Intent(Intent.ACTION_VIEW, Uri.parse("btccfanhub://live-timing/${cal!!.eventId}")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        } else {
            Intent(ctx, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
        }
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(ctx, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

        if (cal != null) {
            v.setTextViewText(R.id.widget_round_label, "ROUNDS ${cal.rs}\u2013${cal.re} \u00b7 NEXT RACE")
            v.setTextViewText(R.id.widget_venue, cal.venue)
            v.setTextViewText(R.id.widget_date, cal.dates)
            val days = ChronoUnit.DAYS.between(LocalDate.now(), cal.start)
            val wknd = LocalDate.now() >= cal.start
            when {
                wknd -> { v.setTextViewText(R.id.widget_days, "RACE"); v.setTextViewText(R.id.widget_days_label, "WEEKEND") }
                days <= 0L -> { v.setTextViewText(R.id.widget_days, "TODAY"); v.setTextViewText(R.id.widget_days_label, "") }
                days == 1L -> { v.setTextViewText(R.id.widget_days, "TMW"); v.setTextViewText(R.id.widget_days_label, "") }
                else -> { v.setTextViewText(R.id.widget_days, "$days"); v.setTextViewText(R.id.widget_days_label, "DAYS") }
            }
        } else {
            v.setTextViewText(R.id.widget_venue, "BTCC Hub"); v.setTextViewText(R.id.widget_days, "--")
            v.setTextViewText(R.id.widget_days_label, ""); v.setTextViewText(R.id.widget_date, ""); v.setTextViewText(R.id.widget_round_label, "")
        }
        return v
    }
    private fun fetchCal(ctx: Context): Cal? {
        val prefs = ctx.getSharedPreferences("widget_cache", Context.MODE_PRIVATE)
        val body = try {
            val text = URL("https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json").readText()
            prefs.edit().putString("calendar_json", text).apply()
            text
        } catch (_: Exception) {
            prefs.getString("calendar_json", null)
        } ?: return null
        return try {
            val rounds = JSONObject(body).optJSONArray("rounds")
            val today = LocalDate.now()
            var result: Cal? = null
            if (rounds != null) for (i in 0 until rounds.length()) {
                val r = rounds.getJSONObject(i)
                val end = LocalDate.parse(r.optString("endDate"))
                if (end >= today) {
                    val rnd = r.optInt("round", 1); val rs = (rnd - 1) * 3 + 1
                    val start = LocalDate.parse(r.optString("startDate"))
                    val df = DateTimeFormatter.ofPattern("d"); val mf = DateTimeFormatter.ofPattern("MMM yyyy")
                    result = Cal(r.optString("venue"), start, "${start.format(df)} - ${end.format(df)} ${end.format(mf)}", rs, rs + 2, r.optInt("tslEventId", 0))
                    break
                }
            }
            result
        } catch (_: Exception) { null }
    }
    data class Cal(val venue: String, val start: LocalDate, val dates: String, val rs: Int, val re: Int, val eventId: Int)
}
