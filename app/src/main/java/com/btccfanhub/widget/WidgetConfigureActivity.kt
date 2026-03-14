package com.btccfanhub.widget

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.ui.theme.BTCCFanHubTheme
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccYellow

class WidgetConfigureActivity : ComponentActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        appWidgetId = intent.extras
            ?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val current = WidgetPrefs.getTheme(this, appWidgetId)

        setContent {
            BTCCFanHubTheme {
                ThemePicker(
                    initial = current,
                    onConfirm = { chosen ->
                        WidgetPrefs.saveTheme(this, appWidgetId, chosen)
                        val appCtx = applicationContext
                        val widgetId = appWidgetId
                        CoroutineScope(Dispatchers.IO).launch {
                            val mgr = AppWidgetManager.getInstance(appCtx)
                            val opts = mgr.getAppWidgetOptions(widgetId)
                            val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 330)
                            val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
                            val views = CountdownWidget.buildViews(appCtx, minW, minH, chosen)
                            mgr.updateAppWidget(widgetId, views)
                        }
                        val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                        setResult(RESULT_OK, result)
                        finish()
                    },
                )
            }
        }
    }
}

// ─── UI ───────────────────────────────────────────────────────────────────────

@Composable
private fun ThemePicker(
    initial: WidgetTheme,
    onConfirm: (WidgetTheme) -> Unit,
) {
    var selected by remember { mutableStateOf(initial) }

    Column(
        modifier            = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))

        Text(
            "Widget Theme",
            fontWeight    = FontWeight.Black,
            fontSize      = 20.sp,
            letterSpacing = 1.sp,
            color         = Color.White,
        )

        Spacer(Modifier.height(4.dp))

        Text(
            "Choose a background colour",
            fontSize = 14.sp,
            color    = Color(0xFF8A8D94),
        )

        Spacer(Modifier.height(20.dp))

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            SectionLabel("Classic")
            Spacer(Modifier.height(10.dp))
            WidgetTheme.classics.chunked(3).forEach { row ->
                SwatchRow(row, selected) { selected = it }
                Spacer(Modifier.height(8.dp))
            }

            Spacer(Modifier.height(20.dp))

            SectionLabel("Teams")
            Spacer(Modifier.height(10.dp))
            WidgetTheme.teams.chunked(3).forEach { row ->
                SwatchRow(row, selected) { selected = it }
                Spacer(Modifier.height(8.dp))
            }
            Spacer(Modifier.height(8.dp))
        }

        Spacer(Modifier.height(12.dp))

        Button(
            onClick  = { onConfirm(selected) },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape  = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BtccYellow),
        ) {
            Text(
                "Add Widget",
                fontWeight = FontWeight.Bold,
                fontSize   = 16.sp,
                color      = Color(0xFF0B0C0F),
            )
        }

        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        fontSize      = 11.sp,
        fontWeight    = FontWeight.Bold,
        letterSpacing = 1.5.sp,
        color         = Color(0xFF8A8D94),
        modifier      = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun SwatchRow(
    themes: List<WidgetTheme>,
    selected: WidgetTheme,
    onSelect: (WidgetTheme) -> Unit,
) {
    Row(
        modifier              = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment     = Alignment.Top,
    ) {
        themes.forEach { theme ->
            ThemeSwatch(
                theme    = theme,
                selected = theme == selected,
                onClick  = { onSelect(theme) },
                modifier = Modifier.weight(1f),
            )
        }
        repeat(3 - themes.size) { Spacer(Modifier.weight(1f)) }
    }
}

@Composable
private fun ThemeSwatch(
    theme: WidgetTheme,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val base   = Color(theme.previewColor)
    val accent = Color(theme.accentColor)
    val shape  = RoundedCornerShape(8.dp)

    Column(
        modifier            = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        // ── Livery preview card ──────────────────────────────────────────────
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1.75f)
                .clip(shape)
                .then(
                    if (selected) Modifier.border(2.dp, BtccYellow, shape)
                    else Modifier.border(1.dp, Color(0xFF2A2D35), shape)
                )
                .clickable(onClick = onClick),
        ) {
            // Livery background painted with Canvas
            Canvas(modifier = Modifier.matchParentSize()) {
                drawLivery(base, accent)
            }

            // Widget content overlay
            Row(
                modifier          = Modifier
                    .matchParentSize()
                    .padding(horizontal = 7.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Countdown
                Column(
                    modifier            = Modifier.weight(0.38f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "14",
                        color      = Color.White,
                        fontSize   = 18.sp,
                        fontWeight = FontWeight.Black,
                        lineHeight = 18.sp,
                    )
                    Text(
                        "DAYS\nTO GO",
                        color      = Color.White.copy(alpha = 0.75f),
                        fontSize   = 5.5.sp,
                        lineHeight = 7.sp,
                    )
                }

                // Divider
                Box(
                    Modifier
                        .width(0.5.dp)
                        .fillMaxHeight(0.65f)
                        .padding(vertical = 2.dp)
                )

                Spacer(Modifier.width(5.dp))

                // Info
                Column(modifier = Modifier.weight(0.62f)) {
                    Text(
                        "ROUNDS 1–3",
                        color         = BtccYellow,
                        fontSize      = 4.5.sp,
                        fontWeight    = FontWeight.Bold,
                        letterSpacing = 0.2.sp,
                    )
                    Text(
                        "Brands Hatch",
                        color      = Color.White,
                        fontSize   = 7.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 8.5.sp,
                        maxLines   = 1,
                        overflow   = TextOverflow.Ellipsis,
                    )
                    Text(
                        "5–6 Apr 2026",
                        color    = Color.White.copy(alpha = 0.6f),
                        fontSize = 4.5.sp,
                    )
                }
            }
        }

        // Label
        Text(
            theme.label,
            fontSize   = 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color      = if (selected) BtccYellow else Color(0xFF8A8D94),
        )
    }
}

// ─── Livery drawing ───────────────────────────────────────────────────────────

/**
 * Draws a racing-livery style background:
 *  • Base colour fills the whole card
 *  • A wide angled accent panel sweeps across the right third
 *  • A thin bright stripe sits along the leading edge of the panel
 */
private fun DrawScope.drawLivery(base: Color, accent: Color) {
    val w = size.width
    val h = size.height

    // Base fill
    drawRect(color = base)

    // Wide diagonal accent panel (right side)
    val panelPath = Path().apply {
        moveTo(w * 0.52f, 0f)
        lineTo(w,         0f)
        lineTo(w,         h)
        lineTo(w * 0.22f, h)
        close()
    }
    drawPath(panelPath, color = accent.copy(alpha = 0.22f))

    // Sharp leading-edge stripe
    val stripePath = Path().apply {
        moveTo(w * 0.52f, 0f)
        lineTo(w * 0.56f, 0f)
        lineTo(w * 0.26f, h)
        lineTo(w * 0.22f, h)
        close()
    }
    drawPath(stripePath, color = accent.copy(alpha = 0.80f))

    // Thin secondary stripe slightly inset
    val stripe2 = Path().apply {
        moveTo(w * 0.45f, 0f)
        lineTo(w * 0.47f, 0f)
        lineTo(w * 0.17f, h)
        lineTo(w * 0.15f, h)
        close()
    }
    drawPath(stripe2, color = accent.copy(alpha = 0.35f))
}
