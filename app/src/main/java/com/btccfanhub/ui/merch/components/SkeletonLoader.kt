package com.btccfanhub.ui.merch.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.btccfanhub.ui.theme.BtccCard

@Composable
fun SkeletonLoader(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "skeleton")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 800),
            repeatMode = RepeatMode.Reverse
        ),
        label = "skeletonAlpha"
    )

    Column(modifier = modifier.padding(16.dp)) {
        // Section header shimmer
        Box(
            modifier = Modifier
                .width(120.dp)
                .height(24.dp)
                .alpha(alpha)
                .clip(RoundedCornerShape(4.dp))
                .background(BtccCard)
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(top = 12.dp)
        ) {
            repeat(3) {
                Box(
                    modifier = Modifier
                        .size(width = 160.dp, height = 200.dp)
                        .alpha(alpha)
                        .clip(RoundedCornerShape(8.dp))
                        .background(BtccCard)
                )
            }
        }
    }
}
