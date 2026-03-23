package com.btccfanhub.ui.more

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.Analytics
import com.btccfanhub.data.model.InfoPage
import com.btccfanhub.data.repository.PagesRepository
import com.btccfanhub.ui.theme.BtccYellow

private val iconMap = mapOf(
    "info" to Icons.Default.Info,
    "history" to Icons.Default.History,
    "directions_car" to Icons.Default.DirectionsCar,
    "eco" to Icons.Default.Eco,
    "leaderboard" to Icons.Default.Leaderboard,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    onSettingsClick: () -> Unit,
    onBugReportClick: () -> Unit,
    onRadioClick: () -> Unit,
    onInfoPageClick: (String) -> Unit,
) {
    val context = LocalContext.current
    var pages by remember { mutableStateOf<List<InfoPage>>(emptyList()) }

    LaunchedEffect(Unit) { Analytics.screen("more") }

    LaunchedEffect(Unit) {
        var list = PagesRepository.getPages()
        if (list.isEmpty()) list = PagesRepository.getPagesFromAssets(context)
        pages = list
    }

    Scaffold(
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = {
                    Text(
                        "MORE",
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        letterSpacing = 1.sp,
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        val isWide = LocalConfiguration.current.screenWidthDp >= 600

        if (isWide) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
                verticalAlignment = Alignment.Top,
            ) {
                MoreLeftColumn(
                    pages = pages,
                    onInfoPageClick = onInfoPageClick,
                    columnModifier = Modifier.weight(1f),
                )
                VerticalDivider(
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.fillMaxHeight().padding(vertical = 8.dp),
                )
                MoreRightColumn(
                    context = context,
                    onRadioClick = onRadioClick,
                    onSettingsClick = onSettingsClick,
                    onBugReportClick = onBugReportClick,
                    columnModifier = Modifier.weight(1f),
                )
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            ) {
                MoreLeftColumn(pages = pages, onInfoPageClick = onInfoPageClick)
                HorizontalDivider(color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(horizontal = 16.dp))
                MoreRightColumn(
                    context = context,
                    onRadioClick = onRadioClick,
                    onSettingsClick = onSettingsClick,
                    onBugReportClick = onBugReportClick,
                )
            }
        }
    }
}

@Composable
private fun MoreSectionHeader(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.ExtraBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        letterSpacing = 2.sp,
        modifier = Modifier.padding(bottom = 12.dp),
    )
}

@Composable
private fun MoreLeftColumn(
    pages: List<InfoPage>,
    onInfoPageClick: (String) -> Unit,
    columnModifier: Modifier = Modifier,
) {
    Column(modifier = columnModifier.padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(8.dp))
        MoreSectionHeader("NEW HERE?")
        MoreRow(
            label = "New to BTCC?",
            icon = Icons.Default.School,
            onClick = { Analytics.moreItemClicked("new_to_btcc"); onInfoPageClick("new-to-btcc") },
        )
        HorizontalDivider(color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(vertical = 16.dp))
        MoreSectionHeader("ABOUT BTCC")
        pages.filter { !it.id.startsWith("btcc-") && it.id != "new-to-btcc" && it.id != "championships" }.forEach { page ->
            MoreRow(
                label = page.title,
                icon = iconMap[page.icon] ?: Icons.Default.Info,
                onClick = { Analytics.moreItemClicked(page.id); onInfoPageClick(page.id) },
            )
            Spacer(Modifier.height(4.dp))
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun MoreRightColumn(
    context: android.content.Context,
    onRadioClick: () -> Unit,
    onSettingsClick: () -> Unit,
    onBugReportClick: () -> Unit,
    columnModifier: Modifier = Modifier,
) {
    Column(modifier = columnModifier.padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(8.dp))
        MoreSectionHeader("APP")
        MoreRow(label = "Radio", icon = Icons.Default.Radio, onClick = { Analytics.moreItemClicked("radio"); onRadioClick() })
        Spacer(Modifier.height(4.dp))
        MoreRow(label = "Settings", icon = Icons.Default.Settings, onClick = { Analytics.moreItemClicked("settings"); onSettingsClick() })
        Spacer(Modifier.height(4.dp))
        MoreRow(label = "Feedback & Bugs", icon = Icons.Default.BugReport, onClick = { Analytics.moreItemClicked("feedback_bugs"); onBugReportClick() })
        HorizontalDivider(color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(vertical = 16.dp))
        MoreSectionHeader("SUPPORT")
        MoreRow(
            label = "Buy me a coffee",
            icon = Icons.Default.Coffee,
            onClick = {
                Analytics.moreItemClicked("buy_me_a_coffee")
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://buymeacoffee.com/btcchub")))
            },
        )
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun MoreRow(label: String, icon: ImageVector, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = BtccYellow,
            modifier = Modifier.size(24.dp),
        )
        Spacer(Modifier.width(16.dp))
        Text(
            label,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
            modifier = Modifier.weight(1f),
        )
        Icon(
            Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
