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

    // Team themes — team livery accent colour
    NAPA      ("NAPA",       R.drawable.widget_background_napa,      0xFF1B4332L, 0xFFF5C400L), // NAPA yellow
    VERTU     ("VERTU",      R.drawable.widget_background_vertu,     0xFF002147L, 0xFF2979CCL), // EXCELR8 blue
    SPEEDWORKS("Speedworks", R.drawable.widget_background_speedworks,0xFF5C0A0AL, 0xFFCCCCCCL), // Toyota white
    WSR       ("WSR",        R.drawable.widget_background_wsr,       0xFF0D1A35L, 0xFF3A6EC0L), // BMW blue
    PMR       ("PMR",        R.drawable.widget_background_pmr,       0xFF3D1F00L, 0xFFFFB800L), // Audi/PMR gold
    LASER     ("Laser",      R.drawable.widget_background_laser,     0xFF3D1400L, 0xFFFF6600L), // Laser orange
    PLATO     ("Plato",      R.drawable.widget_background_plato,     0xFF101014L, 0xFF9A9A9AL), // AMG silver
    ONE_MS    ("One MS",     R.drawable.widget_background_one,       0xFF4A0000L, 0xFFCC2200L), // Honda red
    RESTART   ("Restart",    R.drawable.widget_background_restart,   0xFF00264DL, 0xFF00AADCL), // Hyundai cyan
    ;

    companion object {
        val classics = listOf(NAVY, DARK, MIDNIGHT, SLATE)
        val teams    = listOf(NAPA, VERTU, SPEEDWORKS, WSR, PMR, LASER, PLATO, ONE_MS, RESTART)
    }
}
