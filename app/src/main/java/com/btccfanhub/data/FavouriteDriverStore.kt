package com.btccfanhub.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object FavouriteDriverStore {

    private const val PREFS_NAME = "btcc_prefs"
    private const val KEY        = "favourite_driver"

    private val _driver = MutableStateFlow<String?>(null)
    val driver: StateFlow<String?> = _driver

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        _driver.value = prefs.getString(KEY, null)
    }

    fun toggle(context: Context, name: String) {
        val next = if (_driver.value == name) null else name
        _driver.value = next
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .apply { if (next == null) remove(KEY) else putString(KEY, next) }
            .apply()
    }
}
