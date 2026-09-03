package com.btccfanhub.widget

import android.content.Context

object WidgetPrefs {
    const val PREFS_NAME = "com.btccfanhub.widget.prefs"
    private const val KEY_THEME  = "theme_"
    private const val KEY_SIZE   = "size_"
    private const val KEY_USE_12_HOUR_TIME = "use_12_hour_time"

    fun setUse12HourTime(context: Context, use12Hour: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_USE_12_HOUR_TIME, use12Hour).apply()
    }

    fun getUse12HourTime(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_USE_12_HOUR_TIME, false)

    fun saveTheme(context: Context, widgetId: Int, theme: WidgetTheme) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString("$KEY_THEME$widgetId", theme.name).apply()
    }

    fun getTheme(context: Context, widgetId: Int): WidgetTheme {
        val name = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString("$KEY_THEME$widgetId", null)
        return name?.let { runCatching { WidgetTheme.valueOf(it) }.getOrNull() } ?: WidgetTheme.NAVY
    }

    fun saveSize(context: Context, widgetId: Int, size: WidgetSize) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString("$KEY_SIZE$widgetId", size.name).apply()
    }

    fun getSize(context: Context, widgetId: Int): WidgetSize {
        val name = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString("$KEY_SIZE$widgetId", null)
        return name?.let { runCatching { WidgetSize.valueOf(it) }.getOrNull() } ?: WidgetSize.MEDIUM
    }

    fun deleteTheme(context: Context, widgetId: Int) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove("$KEY_THEME$widgetId")
            .remove("$KEY_SIZE$widgetId")
            .apply()
    }
}
