package com.btccfanhub.widget

import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.btccfanhub.R
import org.json.JSONArray

class TimetableWidgetFactory(private val context: Context) : RemoteViewsService.RemoteViewsFactory {

    sealed class ListItem {
        data class Header(val day: String) : ListItem()
        data class Session(
            val series: String?,
            val session: String,
            val time: String,
            val endTime: String?,
            val laps: String?,
        ) : ListItem()
    }

    private val items = mutableListOf<ListItem>()

    override fun onCreate() { loadData() }
    override fun onDataSetChanged() { loadData() }
    override fun onDestroy() {}

    private fun loadData() {
        items.clear()
        val prefs = context.getSharedPreferences(WidgetPrefs.PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString("timetable_json_cache", null) ?: return
        try {
            val arr = JSONArray(json)
            val sat = mutableListOf<ListItem.Session>()
            val sun = mutableListOf<ListItem.Session>()
            for (i in 0 until arr.length()) {
                val s = arr.getJSONObject(i)
                val item = ListItem.Session(
                    series = s.optString("series").takeIf { it.isNotEmpty() && it != "null" },
                    session = s.optString("session"),
                    time = s.optString("time"),
                    endTime = s.optString("endTime").takeIf { it.isNotEmpty() && it != "null" },
                    laps = s.optString("laps").takeIf { it.isNotEmpty() && it != "null" },
                )
                if (s.optString("day") == "SAT") sat.add(item) else sun.add(item)
            }
            if (sat.isNotEmpty()) {
                items.add(ListItem.Header("SATURDAY"))
                items.addAll(sat)
            }
            if (sun.isNotEmpty()) {
                items.add(ListItem.Header("SUNDAY"))
                items.addAll(sun)
            }
        } catch (_: Exception) {}
    }

    override fun getCount() = items.size
    override fun getViewTypeCount() = 2
    override fun getItemId(position: Int) = position.toLong()
    override fun hasStableIds() = false
    override fun getLoadingView() = null

    override fun getViewAt(position: Int): RemoteViews {
        return when (val item = items.getOrNull(position)) {
            is ListItem.Header -> RemoteViews(context.packageName, R.layout.widget_timetable_header_row).apply {
                setTextViewText(R.id.row_day_header, item.day)
                setFillInIntent(R.id.row_root, Intent())
            }
            is ListItem.Session -> RemoteViews(context.packageName, R.layout.widget_timetable_row).apply {
                setFillInIntent(R.id.row_root, Intent())
                val series = item.series
                val isBtcc = series?.contains("British Touring Car Championship") == true
                if (series != null) {
                    setTextViewText(R.id.row_series, series)
                    setTextViewText(R.id.row_session_type, item.session)
                    setInt(R.id.row_series, "setTextColor", if (isBtcc) 0xFFFFFFFF.toInt() else 0xCCFFFFFF.toInt())
                    setViewVisibility(R.id.row_series, View.VISIBLE)
                    setViewVisibility(R.id.row_session_type, View.VISIBLE)
                    setViewVisibility(R.id.row_event, View.GONE)
                } else {
                    setTextViewText(R.id.row_event, item.session)
                    setViewVisibility(R.id.row_series, View.GONE)
                    setViewVisibility(R.id.row_session_type, View.GONE)
                    setViewVisibility(R.id.row_event, View.VISIBLE)
                }
                val timeStr = if (item.endTime != null) "${item.time} - ${item.endTime}" else item.time
                setTextViewText(R.id.row_time, timeStr)
                if (item.laps != null) {
                    val lapsDisplay = if (item.laps.matches(Regex("\\d+"))) "${item.laps} laps" else item.laps
                    setTextViewText(R.id.row_laps, lapsDisplay)
                    setViewVisibility(R.id.row_laps, View.VISIBLE)
                } else {
                    setViewVisibility(R.id.row_laps, View.GONE)
                }
            }
            null -> RemoteViews(context.packageName, R.layout.widget_timetable_row)
        }
    }
}
