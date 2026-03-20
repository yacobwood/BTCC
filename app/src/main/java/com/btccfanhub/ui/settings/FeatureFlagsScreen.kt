package com.btccfanhub.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.FeatureFlagsStore
import com.btccfanhub.ui.theme.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter

private val displayFmt = DateTimeFormatter.ofPattern("EEE d MMM yyyy  HH:mm")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeatureFlagsScreen(onBack: () -> Unit = {}) {
    val testOverride by FeatureFlagsStore.testDateTimeOverride.collectAsState()

    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var stagedDate by remember { mutableStateOf<LocalDate?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = {
                    Column {
                        Text(
                            "TEST MODE",
                            fontWeight    = FontWeight.Black,
                            fontSize      = 18.sp,
                            letterSpacing = 1.sp,
                        )
                        Text(
                            "Race weekend simulation",
                            color      = BtccYellow,
                            fontSize   = 11.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onBackground,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
            )
        },
        containerColor = BtccBackground,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Spacer(Modifier.height(8.dp))

            Text(
                "Simulate a specific date and time to test race weekend behaviour across the app and widget.",
                color    = BtccTextSecondary,
                fontSize = 13.sp,
                lineHeight = 20.sp,
            )

            // Current override display
            if (testOverride != null) {
                Row(
                    modifier          = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "SIMULATED DATE/TIME",
                            fontSize      = 10.sp,
                            fontWeight    = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                            color         = BtccYellow,
                        )
                        Text(
                            testOverride!!.format(displayFmt),
                            fontSize   = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color      = BtccTextPrimary,
                            modifier   = Modifier.padding(top = 4.dp),
                        )
                    }
                    IconButton(onClick = { FeatureFlagsStore.setTestDateTime(null) }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = BtccTextSecondary)
                    }
                }
                HorizontalDivider(color = BtccOutline)
            }

            Button(
                onClick = { showDatePicker = true },
                colors  = ButtonDefaults.buttonColors(containerColor = BtccYellow, contentColor = BtccNavy),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (testOverride != null) "Change date/time" else "Set date/time",
                    fontWeight = FontWeight.Bold,
                )
            }

            if (testOverride != null) {
                OutlinedButton(
                    onClick = { FeatureFlagsStore.setTestDateTime(null) },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Clear — use real time", color = BtccTextSecondary)
                }
            }
        }
    }

    // Date picker
    if (showDatePicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = (testOverride?.toLocalDate() ?: LocalDate.now())
                .toEpochDay() * 86_400_000L,
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val millis = state.selectedDateMillis
                    if (millis != null) {
                        stagedDate = LocalDate.ofEpochDay(millis / 86_400_000L)
                        showDatePicker = false
                        showTimePicker = true
                    }
                }) { Text("Next") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = state)
        }
    }

    // Time picker
    if (showTimePicker) {
        val existingTime = testOverride?.toLocalTime() ?: LocalTime.now()
        val state = rememberTimePickerState(
            initialHour   = existingTime.hour,
            initialMinute = existingTime.minute,
            is24Hour      = true,
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val date = stagedDate ?: LocalDate.now()
                    FeatureFlagsStore.setTestDateTime(
                        LocalDateTime.of(date, LocalTime.of(state.hour, state.minute))
                    )
                    showTimePicker = false
                }) { Text("Set") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            },
            title = { Text("Pick time") },
            text  = { TimePicker(state = state) },
        )
    }
}
