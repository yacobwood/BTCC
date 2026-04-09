package com.btccfanhub.widget

import com.btccfanhub.R

enum class WidgetTheme(
    val label: String,
    val backgroundRes: Int,
    val previewColor: Long,
    val accentColor: Long,
) {
    // Classic themes — subtle tonal accent
    NAVY      ("Navy",       R.drawable.widget_background,           0xFF020255L, 0xFF0A1AAAL),
    DARK      ("Dark",       R.drawable.widget_background_dark,      0xFF0B0C0FL, 0xFF1E2130L),
    MIDNIGHT  ("Midnight",   R.drawable.widget_background_midnight,  0xFF0D1626L, 0xFF1A3558L),
    SLATE     ("Slate",      R.drawable.widget_background_slate,     0xFF1C1F2EL, 0xFF2E3A5CL),

    // Team themes — unique livery per team
    NAPA      ("NAPA",       R.drawable.widget_background_napa,      0xFF1A3A8FL, 0xFFF5C400L),
    VERTU     ("VERTU",      R.drawable.widget_background_vertu,     0xFF00736BL, 0xFFF26522L),
    SPEEDWORKS("Speedworks", R.drawable.widget_background_speedworks,0xFFB01020L, 0xFFFFFFFFL),
    WSR       ("WSR",        R.drawable.widget_background_wsr,       0xFF0A1628L, 0xFF1E6FE8L),
    PMR       ("PMR",        R.drawable.widget_background_pmr,       0xFF1A1A1AL, 0xFFFFCC00L),
    LASER     ("Laser",      R.drawable.widget_background_laser,     0xFF0C1E6BL, 0xFFFFFFFFL),
    PLATO     ("Plato",      R.drawable.widget_background_plato,     0xFF0E0E0EL, 0xFF9B1FD4L),
    ONE_MS    ("One MS",     R.drawable.widget_background_one,       0xFF0F0F0FL, 0xFFE8002DL),
    RESTART   ("Restart",    R.drawable.widget_background_restart,   0xFF0B1A2EL, 0xFF00C8E8L),
    ;

    companion object {
        val classics = listOf(NAVY, DARK, MIDNIGHT, SLATE)
        val teams    = listOf(NAPA, VERTU, SPEEDWORKS, WSR, PMR, LASER, PLATO, ONE_MS, RESTART)
    }
}
