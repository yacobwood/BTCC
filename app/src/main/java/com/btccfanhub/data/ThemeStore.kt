package com.btccfanhub.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object ThemeStore {
    private const val PREFS = "btcc_theme"
    private const val KEY   = "dark_mode"

    private val _isDark = MutableStateFlow(true)
    val isDark: StateFlow<Boolean> = _isDark

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        _isDark.value = prefs.getBoolean(KEY, true)
    }

    fun setDark(context: Context, dark: Boolean) {
        _isDark.value = dark
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY, dark).apply()
    }
}
