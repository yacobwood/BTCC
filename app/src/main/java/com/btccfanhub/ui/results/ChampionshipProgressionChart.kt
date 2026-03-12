package com.btccfanhub.ui.results

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.outlined.CheckBoxOutlineBlank
import androidx.compose.material3.Icon
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.DriverProgressionSeries
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow

private val CHART_COLORS = listOf(
    BtccYellow,
    Color(0xFF4FC3F7),
    Color(0xFF81C784),
    Color(0xFFFFB74D),
    Color(0xFFBA68C8),
    Color(0xFF4DD0E1),
    Color(0xFFFF8A65),
    Color(0xFF9575CD),
    Color(0xFF64B5F6),
    Color(0xFFA1887F),
    Color(0xFFE57373),
    Color(0xFF4DB6AC),
    Color(0xFFFFD54F),
    Color(0xFF7986CB),
    Color(0xFFF06292),
    Color(0xFFAED581),
    Color(0xFF4DD0E1),
    Color(0xFFBCAAA4),
    Color(0xFF90A4AE),
    Color(0xFFB39DDB),
)

private fun colorForIndex(index: Int): Color = CHART_COLORS[index % CHART_COLORS.size]

private val CHART_HEIGHT_DP = 240.dp
private val Y_AXIS_WIDTH_DP = 32.dp
private val X_AXIS_HEIGHT_DP = 36.dp
private const val LINE_STROKE_WIDTH = 3f
private const val POINT_RADIUS = 4f

/** Y-axis: major ticks every 50 points; top = next multiple of 50 above top driver. */
private const val Y_MAJOR_STEP = 50

private fun computeYTicks(maxPoints: Int): List<Int> {
    if (maxPoints <= 0) return listOf(0)
    val top = ((maxPoints + Y_MAJOR_STEP - 1) / Y_MAJOR_STEP) * Y_MAJOR_STEP // round up to next 50
    return (0..top step Y_MAJOR_STEP).toList()
}

@Composable
fun ChampionshipProgressionChart(
    series: List<DriverProgressionSeries>,
    roundLabels: List<String> = emptyList(),
    modifier: Modifier = Modifier,
) {
    if (series.isEmpty()) return

    val hiddenDrivers = remember { mutableStateOf<Set<String>>(emptySet()) }
    val visibleSeries = remember(series, hiddenDrivers.value) {
        series.filter { it.driver !in hiddenDrivers.value }
    }

    val maxPoints = visibleSeries.maxOfOrNull { it.cumulativePointsByRound.maxOrNull() ?: 0 } ?: 1
    val roundCount = series.maxOfOrNull { it.cumulativePointsByRound.size } ?: 0
    val yTicks = remember(maxPoints) { computeYTicks(maxPoints) }
    val yMax = (yTicks.maxOrNull() ?: 1).toFloat()
    // One label per round: always R1, R2, R3, ... directly under each vertical line
    val xLabelByRoundIndex = remember(roundCount) {
        if (roundCount <= 0) emptyMap()
        else (0 until roundCount).associate { i -> i to "R${i + 1}" }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp)
                .background(BtccCard, RoundedCornerShape(12.dp))
                .padding(12.dp),
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Chart row: Y-axis labels + canvas
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(
                        modifier = Modifier
                            .width(Y_AXIS_WIDTH_DP)
                            .height(CHART_HEIGHT_DP),
                        verticalArrangement = Arrangement.SpaceBetween,
                        horizontalAlignment = Alignment.End,
                    ) {
                        yTicks.asReversed().forEach { tick ->
                            Text(
                                text = "$tick",
                                style = MaterialTheme.typography.labelSmall,
                                color = BtccTextSecondary,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                    ProgressionLineChart(
                        series = visibleSeries,
                        fullSeries = series,
                        yTicks = yTicks,
                        yMax = yMax,
                        modifier = Modifier
                            .weight(1f)
                            .height(CHART_HEIGHT_DP),
                    )
                }
                // X-axis labels: each R1, R2, ... centered under the chart's vertical lines (same padding as chart)
                if (roundCount > 0 && xLabelByRoundIndex.isNotEmpty()) {
                    val density = LocalDensity.current
                    val chartPaddingPx = with(density) { 8.dp.toPx() }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = Y_AXIS_WIDTH_DP)
                            .height(X_AXIS_HEIGHT_DP),
                    ) {
                        for (i in 0 until roundCount) {
                            val label = xLabelByRoundIndex[i] ?: continue
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .layout { measurable, constraints ->
                                        val w = constraints.maxWidth
                                        val chartLeft = chartPaddingPx
                                        val chartW = w - 2 * chartPaddingPx
                                        val stepX = if (roundCount <= 1) 0f else chartW / (roundCount - 1).coerceAtLeast(1)
                                        val xCenter = (chartLeft + i * stepX).toInt()
                                        val looseConstraints = Constraints(0, w, 0, constraints.maxHeight)
                                        val p = measurable.measure(looseConstraints)
                                        val x = when {
                                            i == 0 -> 0
                                            i == roundCount - 1 -> (w - p.width).coerceAtLeast(0)
                                            else -> (xCenter - p.width / 2).coerceIn(0, (w - p.width).coerceAtLeast(0))
                                        }
                                        layout(w, p.height) {
                                            p.place(x, 0)
                                        }
                                    },
                                contentAlignment = Alignment.CenterStart,
                            ) {
                                Text(
                                    text = label,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = BtccTextSecondary,
                                    maxLines = 1,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    }
                }
            }
        }

        Text(
            "Tap a driver to show or hide their line on the chart",
            style = MaterialTheme.typography.labelMedium,
            color = BtccTextSecondary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
        )

        // Select all / Deselect all toggle
        val allDriverNames = remember(series) { series.map { it.driver }.toSet() }
        val allVisible = hiddenDrivers.value.isEmpty()
        val allHidden = hiddenDrivers.value == allDriverNames
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SelectAllChip(
                label = "Show all",
                modifier = Modifier.padding(end = 16.dp),
                onClick = { hiddenDrivers.value = emptySet() },
                enabled = !allVisible,
            )
            SelectAllChip(
                label = "Hide all",
                modifier = Modifier,
                onClick = { hiddenDrivers.value = allDriverNames },
                enabled = !allHidden,
            )
        }

        // Legend: tappable chips with checkbox; 2 per row for larger touch targets
        val chipsPerRow = 2
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            series.chunked(chipsPerRow).forEachIndexed { rowIndex, rowSeries ->
                val isSingleItemRow = rowSeries.size == 1
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isSingleItemRow) Arrangement.Start else Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    rowSeries.forEachIndexed { colIdx, s ->
                        val index = rowIndex * chipsPerRow + colIdx
                        val color = colorForIndex(index)
                        val isVisible = s.driver !in hiddenDrivers.value
                        LegendChip(
                            modifier = if (isSingleItemRow) Modifier.fillMaxWidth(0.5f) else Modifier.weight(1f),
                            driver = s.driver,
                            color = color,
                            finalPoints = s.cumulativePointsByRound.lastOrNull() ?: 0,
                            isVisible = isVisible,
                            onClick = {
                                hiddenDrivers.value = if (isVisible) {
                                    hiddenDrivers.value + s.driver
                                } else {
                                    hiddenDrivers.value - s.driver
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProgressionLineChart(
    series: List<DriverProgressionSeries>,
    fullSeries: List<DriverProgressionSeries>,
    yTicks: List<Int>,
    yMax: Float,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val leftPx = with(density) { 8.dp.toPx() }
    val rightPx = with(density) { 8.dp.toPx() }
    val topPx = with(density) { 4.dp.toPx() }
    val bottomPx = with(density) { 4.dp.toPx() }

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val chartLeft = leftPx
        val chartRight = w - rightPx
        val chartTop = topPx
        val chartBottom = h - bottomPx
        val chartW = chartRight - chartLeft
        val chartH = chartBottom - chartTop

        val roundCount = fullSeries.maxOfOrNull { it.cumulativePointsByRound.size } ?: 1
        val stepX = if (roundCount <= 1) 0f else chartW / (roundCount - 1).coerceAtLeast(1)

        // Grid: horizontal lines at Y ticks
        yTicks.forEach { tick ->
            val y = chartBottom - (tick.toFloat() / yMax) * chartH
            if (y in chartTop..chartBottom) {
                drawLine(
                    color = BtccTextSecondary.copy(alpha = 0.25f),
                    start = Offset(chartLeft, y),
                    end = Offset(chartRight, y),
                    strokeWidth = 1f,
                )
            }
        }
        // Grid: vertical lines at rounds
        for (i in 0 until roundCount) {
            val x = chartLeft + i * stepX
            drawLine(
                color = BtccTextSecondary.copy(alpha = 0.15f),
                start = Offset(x, chartTop),
                end = Offset(x, chartBottom),
                strokeWidth = 1f,
            )
        }

        // Lines and points per series (use fullSeries index for consistent colors)
        series.forEach { s ->
            val pts = s.cumulativePointsByRound
            if (pts.isEmpty()) return@forEach
            val colorIndex = fullSeries.indexOfFirst { it.driver == s.driver }.coerceAtLeast(0)
            val color = colorForIndex(colorIndex)

            val path = Path()
            for (i in pts.indices) {
                val x = chartLeft + i * stepX
                val y = chartBottom - (pts[i].toFloat() / yMax) * chartH
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }

            drawPath(
                path = path,
                color = color,
                style = Stroke(width = LINE_STROKE_WIDTH, cap = StrokeCap.Round),
            )

            for (i in pts.indices) {
                val x = chartLeft + i * stepX
                val y = chartBottom - (pts[i].toFloat() / yMax) * chartH
                drawCircle(color = color, radius = POINT_RADIUS, center = Offset(x, y))
            }
        }
    }
}

@Composable
private fun SelectAllChip(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    enabled: Boolean,
) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = if (enabled) BtccYellow else BtccTextSecondary,
        fontWeight = FontWeight.SemiBold,
        modifier = modifier
            .clickable(
                enabled = enabled,
                role = Role.Button,
                onClickLabel = label,
                onClick = onClick,
            )
            .padding(horizontal = 8.dp, vertical = 6.dp),
    )
}

@Composable
private fun LegendChip(
    modifier: Modifier = Modifier,
    driver: String,
    color: Color,
    finalPoints: Int,
    isVisible: Boolean,
    onClick: () -> Unit,
) {
    val alpha = if (isVisible) 1f else 0.45f
    Row(
        modifier = modifier
            .heightIn(min = 48.dp)
            .clickable(
                role = Role.Button,
                onClickLabel = if (isVisible) "Hide ${driver.split(" ").lastOrNull() ?: driver} from chart" else "Show ${driver.split(" ").lastOrNull() ?: driver} on chart",
                onClick = onClick,
            )
            .background(
                color = BtccCard,
                shape = RoundedCornerShape(10.dp),
            )
            .border(
                width = 1.dp,
                color = if (isVisible) color.copy(alpha = 0.5f) else BtccOutline,
                shape = RoundedCornerShape(10.dp),
            )
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = if (isVisible) Icons.Filled.CheckBox else Icons.Outlined.CheckBoxOutlineBlank,
            contentDescription = if (isVisible) "Shown" else "Hidden",
            tint = if (isVisible) BtccYellow else BtccTextSecondary,
            modifier = Modifier.size(22.dp),
        )
        Box(
            modifier = Modifier
                .size(12.dp)
                .background(color.copy(alpha = alpha), CircleShape),
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = driver.split(" ").lastOrNull() ?: driver,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = alpha),
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "$finalPoints pts",
                style = MaterialTheme.typography.labelSmall,
                color = BtccTextSecondary.copy(alpha = alpha),
            )
        }
    }
}
