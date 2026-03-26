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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.ui.theme.BTCCFanHubTheme
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

        val mgr = AppWidgetManager.getInstance(this)
        val info = mgr.getAppWidgetInfo(appWidgetId)
        val widgetSize = when (info?.provider?.className) {
            SmallWidget::class.java.name -> WidgetSize.SMALL
            LargeWidget::class.java.name -> WidgetSize.LARGE
            else                         -> WidgetSize.MEDIUM
        }

        val currentTheme = WidgetPrefs.getTheme(this, appWidgetId)

        setContent {
            BTCCFanHubTheme {
                ThemePicker(
                    initial = currentTheme,
                    onConfirm = { chosenTheme ->
                        WidgetPrefs.saveTheme(this, appWidgetId, chosenTheme)
                        WidgetPrefs.saveSize(this, appWidgetId, widgetSize)
                        val appCtx = applicationContext
                        val wId = appWidgetId
                        val wSize = widgetSize
                        CoroutineScope(Dispatchers.IO).launch {
                            val m = AppWidgetManager.getInstance(appCtx)
                            val opts = m.getAppWidgetOptions(wId)
                            val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 330)
                            val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
                            val views = CountdownWidget.buildViews(appCtx, minW, minH, chosenTheme, widgetSize = wSize)
                            m.updateAppWidget(wId, views)
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
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))

        Text(
            "Widget Theme",
            fontWeight = FontWeight.Black,
            fontSize = 20.sp,
            letterSpacing = 1.sp,
            color = Color.White,
        )

        Spacer(Modifier.height(4.dp))

        Text(
            "Choose a background colour",
            fontSize = 14.sp,
            color = Color(0xFF8A8D94),
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
            onClick = { onConfirm(selected) },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = BtccYellow),
        ) {
            Text(
                "Add Widget",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = Color(0xFF0B0C0F),
            )
        }

        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.5.sp,
        color = Color(0xFF8A8D94),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun SwatchRow(
    themes: List<WidgetTheme>,
    selected: WidgetTheme,
    onSelect: (WidgetTheme) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        themes.forEach { theme ->
            ThemeSwatch(
                theme = theme,
                selected = theme == selected,
                onClick = { onSelect(theme) },
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
    val base = Color(theme.previewColor)
    val accent = Color(theme.accentColor)
    val shape = RoundedCornerShape(8.dp)

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
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
            Canvas(modifier = Modifier.matchParentSize()) {
                drawLivery(base, accent, theme)
            }
            Row(
                modifier = Modifier
                    .matchParentSize()
                    .padding(horizontal = 7.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    modifier = Modifier.weight(0.38f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("14", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black, lineHeight = 18.sp)
                    Text("DAYS\nTO GO", color = Color.White.copy(alpha = 0.75f), fontSize = 5.5.sp, lineHeight = 7.sp)
                }
                Box(Modifier.width(0.5.dp).fillMaxHeight(0.65f).padding(vertical = 2.dp))
                Spacer(Modifier.width(5.dp))
                Column(modifier = Modifier.weight(0.62f)) {
                    Text("ROUNDS 1–3", color = BtccYellow, fontSize = 4.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.2.sp)
                    Text("Brands Hatch", color = Color.White, fontSize = 7.sp, fontWeight = FontWeight.Bold, lineHeight = 8.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("5–6 Apr 2026", color = Color.White.copy(alpha = 0.6f), fontSize = 4.5.sp)
                }
            }
        }
        Text(
            theme.label,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) BtccYellow else Color(0xFF8A8D94),
        )
    }
}


// ─── Livery drawing ───────────────────────────────────────────────────────────

private fun DrawScope.drawLivery(base: Color, accent: Color, theme: WidgetTheme = WidgetTheme.NAVY) {
    val w = size.width
    val h = size.height
    drawRect(color = base)

    when (theme) {
        WidgetTheme.VERTU -> {
            val orange = Color(0xFFF26522); val navy = Color(0xFF002147)
            drawPath(Path().apply { moveTo(w * 0.72f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.44f, h); close() }, color = orange.copy(alpha = 0.95f))
            drawPath(Path().apply { moveTo(w * 0.67f, 0f); lineTo(w * 0.69f, 0f); lineTo(w * 0.41f, h); lineTo(w * 0.39f, h); close() }, color = navy.copy(alpha = 0.85f))
        }
        WidgetTheme.NAPA -> {
            val yellow = Color(0xFFF5C400); val darkBlue = Color(0xFF0F2560)
            drawPath(Path().apply { moveTo(0f, 0f); lineTo(w * 0.18f, 0f); lineTo(w * 0.05f, h); lineTo(0f, h); close() }, color = darkBlue.copy(alpha = 0.60f))
            drawPath(Path().apply { moveTo(w * 0.60f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.35f, h); close() }, color = yellow.copy(alpha = 0.95f))
            drawPath(Path().apply { moveTo(w * 0.55f, 0f); lineTo(w * 0.59f, 0f); lineTo(w * 0.34f, h); lineTo(w * 0.30f, h); close() }, color = yellow.copy(alpha = 0.50f))
        }
        WidgetTheme.LASER -> {
            val white = Color.White
            drawPath(Path().apply { moveTo(w * 0.50f, 0f); lineTo(w * 0.62f, 0f); lineTo(w * 0.38f, h); lineTo(w * 0.26f, h); close() }, color = white.copy(alpha = 0.18f))
            drawPath(Path().apply { moveTo(w * 0.50f, 0f); lineTo(w * 0.54f, 0f); lineTo(w * 0.30f, h); lineTo(w * 0.26f, h); close() }, color = white.copy(alpha = 0.70f))
            drawPath(Path().apply { moveTo(w * 0.64f, 0f); lineTo(w * 0.67f, 0f); lineTo(w * 0.43f, h); lineTo(w * 0.40f, h); close() }, color = white.copy(alpha = 0.45f))
        }
        WidgetTheme.PLATO -> {
            val purple = Color(0xFF9B1FD4); val magenta = Color(0xFFCC3399)
            drawPath(Path().apply { moveTo(w * 0.30f, 0f); lineTo(w * 0.55f, 0f); lineTo(w * 0.35f, h); lineTo(w * 0.10f, h); close() }, color = purple.copy(alpha = 0.55f))
            drawPath(Path().apply { moveTo(w * 0.55f, 0f); lineTo(w * 0.62f, 0f); lineTo(w * 0.42f, h); lineTo(w * 0.35f, h); close() }, color = magenta.copy(alpha = 0.65f))
            drawPath(Path().apply { moveTo(w * 0.72f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.55f, h); close() }, color = purple.copy(alpha = 0.40f))
            drawPath(Path().apply { moveTo(w * 0.28f, 0f); lineTo(w * 0.31f, 0f); lineTo(w * 0.11f, h); lineTo(w * 0.08f, h); close() }, color = magenta.copy(alpha = 0.80f))
        }
        WidgetTheme.SPEEDWORKS -> {
            val white = Color.White
            drawPath(Path().apply { moveTo(w * 0.48f, 0f); lineTo(w * 0.60f, 0f); lineTo(w * 0.36f, h); lineTo(w * 0.24f, h); close() }, color = white.copy(alpha = 0.15f))
            drawPath(Path().apply { moveTo(w * 0.48f, 0f); lineTo(w * 0.52f, 0f); lineTo(w * 0.28f, h); lineTo(w * 0.24f, h); close() }, color = white.copy(alpha = 0.75f))
            drawPath(Path().apply { moveTo(w * 0.78f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.58f, h); close() }, color = Color(0xFF7A0010).copy(alpha = 0.60f))
        }
        WidgetTheme.WSR -> {
            val bmwBlue = Color(0xFF1E6FE8); val lightBlue = Color(0xFF5BA3FF)
            drawPath(Path().apply { moveTo(w * 0.62f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.38f, h); close() }, color = bmwBlue.copy(alpha = 0.85f))
            drawPath(Path().apply { moveTo(w * 0.58f, 0f); lineTo(w * 0.62f, 0f); lineTo(w * 0.38f, h); lineTo(w * 0.34f, h); close() }, color = lightBlue.copy(alpha = 0.70f))
        }
        WidgetTheme.PMR -> {
            val gold = Color(0xFFFFCC00)
            drawPath(Path().apply { moveTo(w * 0.65f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.40f, h); close() }, color = gold.copy(alpha = 0.90f))
            drawPath(Path().apply { moveTo(w * 0.60f, 0f); lineTo(w * 0.64f, 0f); lineTo(w * 0.39f, h); lineTo(w * 0.35f, h); close() }, color = gold.copy(alpha = 0.45f))
        }
        WidgetTheme.ONE_MS -> {
            val red = Color(0xFFE8002D)
            drawPath(Path().apply { moveTo(w * 0.55f, 0f); lineTo(w * 0.70f, 0f); lineTo(w * 0.46f, h); lineTo(w * 0.31f, h); close() }, color = red.copy(alpha = 0.85f))
            drawPath(Path().apply { moveTo(w * 0.70f, 0f); lineTo(w * 0.73f, 0f); lineTo(w * 0.49f, h); lineTo(w * 0.46f, h); close() }, color = red.copy(alpha = 0.40f))
        }
        WidgetTheme.RESTART -> {
            val cyan = Color(0xFF00C8E8)
            drawPath(Path().apply { moveTo(w * 0.68f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.42f, h); close() }, color = cyan.copy(alpha = 0.80f))
            drawPath(Path().apply { moveTo(w * 0.63f, 0f); lineTo(w * 0.67f, 0f); lineTo(w * 0.41f, h); lineTo(w * 0.37f, h); close() }, color = cyan.copy(alpha = 0.50f))
        }
        else -> {
            drawPath(Path().apply { moveTo(w * 0.52f, 0f); lineTo(w, 0f); lineTo(w, h); lineTo(w * 0.22f, h); close() }, color = accent.copy(alpha = 0.22f))
            drawPath(Path().apply { moveTo(w * 0.52f, 0f); lineTo(w * 0.56f, 0f); lineTo(w * 0.26f, h); lineTo(w * 0.22f, h); close() }, color = accent.copy(alpha = 0.80f))
            drawPath(Path().apply { moveTo(w * 0.45f, 0f); lineTo(w * 0.47f, 0f); lineTo(w * 0.17f, h); lineTo(w * 0.15f, h); close() }, color = accent.copy(alpha = 0.35f))
        }
    }
}
