package com.btccfanhub.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow

/**
 * A two-option pill-style toggle.
 *
 * @param options  Exactly two labels, e.g. listOf("On", "Off") or listOf("km", "miles")
 * @param selectedIndex  0 = first option selected, 1 = second
 * @param onSelectionChanged  Callback with the new selected index
 */
@Composable
fun PillToggle(
    options: List<String>,
    selectedIndex: Int,
    onSelectionChanged: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    require(options.size == 2) { "PillToggle requires exactly 2 options" }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(BtccSurface)
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        options.forEachIndexed { index, label ->
            val selected = index == selectedIndex
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(if (selected) BtccYellow else BtccSurface)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { onSelectionChanged(index) }
                    .padding(horizontal = 20.dp, vertical = 8.dp),
            ) {
                Text(
                    text = label,
                    color = if (selected) BtccNavy else BtccTextSecondary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
            }
        }
    }
}
