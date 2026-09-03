package com.btccfanhub.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import com.btccfanhub.R
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Hands RN settings that a home-screen widget needs across to the native side -
// widgets run in a separate process and can't read AsyncStorage directly (see
// project memory: iOS widgets use an App Group UserDefaults for the same reason).
class WidgetSettingsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "WidgetSettings"

    @ReactMethod
    fun setUse12HourTime(use12Hour: Boolean) {
        WidgetPrefs.setUse12HourTime(ctx, use12Hour)
        refreshWidgets()
    }

    // Re-triggers each widget provider's onUpdate/onDataSetChanged so the new
    // preference is reflected immediately rather than waiting for the next
    // scheduled refresh. No-ops for widget types the user hasn't placed.
    private fun refreshWidgets() {
        val mgr = AppWidgetManager.getInstance(ctx)

        val timetableIds = mgr.getAppWidgetIds(ComponentName(ctx, TimetableWidget::class.java))
        if (timetableIds.isNotEmpty()) {
            mgr.notifyAppWidgetViewDataChanged(timetableIds, R.id.widget_timetable_list)
            ctx.sendBroadcast(Intent(ctx, TimetableWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, timetableIds)
            })
        }

        val largeIds = mgr.getAppWidgetIds(ComponentName(ctx, LargeWidget::class.java))
        if (largeIds.isNotEmpty()) {
            ctx.sendBroadcast(Intent(ctx, LargeWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, largeIds)
            })
        }
    }
}
