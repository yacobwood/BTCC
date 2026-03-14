package com.btccfanhub.widget

import android.content.Context

object WidgetPrefs {
    private const val PREFS_NAME = "com.btccfanhub.widget.prefs"
    private const val KEY_THEME  = "theme_"

    fun saveTheme(context: Context, widgetId: Int, theme: WidgetTheme) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString("$KEY_THEME$widgetId", theme.name).apply()
    }

    fun getTheme(context: Context, widgetId: Int): WidgetTheme {
        val name = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString("$KEY_THEME$widgetId", null)
        return name?.let { runCatching { WidgetTheme.valueOf(it) }.getOrNull() } ?: WidgetTheme.NAVY
    }

    fun deleteTheme(context: Context, widgetId: Int) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove("$KEY_THEME$widgetId").apply()
    }
}
