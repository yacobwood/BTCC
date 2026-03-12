package com.btcchub.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btcchub.BuildConfig
import com.btcchub.ui.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request

// Replace with your Formspree form ID from formspree.io
private const val FORMSPREE_ENDPOINT = "https://formspree.io/f/xqeyanjk"

private val categories = listOf("Bug", "Crash", "UI Issue", "Feature Request", "Other")

private enum class SubmitState { Idle, Loading, Success, Error }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BugReportScreen(onBack: () -> Unit = {}, onReturnToNews: () -> Unit = {}) {
    var selectedCategory by remember { mutableStateOf(categories[0]) }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var steps by remember { mutableStateOf("") }
    var submitState by remember { mutableStateOf(SubmitState.Idle) }
    val scope = rememberCoroutineScope()

    if (submitState == SubmitState.Success) {
        SuccessScreen(onReturnToNews = onReturnToNews)
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "RAISE A BUG",
                        fontWeight    = FontWeight.Black,
                        fontSize      = 18.sp,
                        letterSpacing = 1.sp,
                    )
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
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {

            // Category
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionLabel("CATEGORY")
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    categories.take(3).forEach { cat ->
                        CategoryChip(
                            label    = cat,
                            selected = selectedCategory == cat,
                            onClick  = { selectedCategory = cat },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    categories.drop(3).forEach { cat ->
                        CategoryChip(
                            label    = cat,
                            selected = selectedCategory == cat,
                            onClick  = { selectedCategory = cat },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    val remainder = categories.drop(3).size % 3
                    if (remainder != 0) {
                        Spacer(modifier = Modifier.weight((3 - remainder).toFloat()))
                    }
                }
            }

            // Title
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionLabel("TITLE")
                OutlinedTextField(
                    value         = title,
                    onValueChange = { title = it },
                    placeholder   = { Text("Brief summary of the issue", color = BtccTextSecondary) },
                    singleLine    = true,
                    modifier      = Modifier.fillMaxWidth(),
                    colors        = formFieldColors(),
                    shape         = RoundedCornerShape(10.dp),
                )
            }

            // Description
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionLabel("DESCRIPTION")
                OutlinedTextField(
                    value         = description,
                    onValueChange = { description = it },
                    placeholder   = { Text("What happened? What did you expect to happen?", color = BtccTextSecondary) },
                    minLines      = 4,
                    modifier      = Modifier.fillMaxWidth(),
                    colors        = formFieldColors(),
                    shape         = RoundedCornerShape(10.dp),
                )
            }

            // Steps to reproduce
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionLabel("STEPS TO REPRODUCE")
                OutlinedTextField(
                    value         = steps,
                    onValueChange = { steps = it },
                    placeholder   = { Text("1. Open the app\n2. Tap on...\n3. ...", color = BtccTextSecondary) },
                    minLines      = 3,
                    modifier      = Modifier.fillMaxWidth(),
                    colors        = formFieldColors(),
                    shape         = RoundedCornerShape(10.dp),
                )
            }

            // Submit button
            val canSubmit = title.isNotBlank() && description.isNotBlank() &&
                    submitState != SubmitState.Loading && submitState != SubmitState.Success

            Button(
                onClick = {
                    submitState = SubmitState.Loading
                    scope.launch {
                        submitState = submitReport(
                            category    = selectedCategory,
                            title       = title,
                            description = description,
                            steps       = steps,
                        )
                    }
                },
                enabled  = canSubmit,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor         = BtccYellow,
                    contentColor           = BtccBackground,
                    disabledContainerColor = BtccOutline,
                    disabledContentColor   = BtccTextSecondary,
                ),
                shape = RoundedCornerShape(10.dp),
            ) {
                if (submitState == SubmitState.Loading) {
                    CircularProgressIndicator(
                        modifier  = Modifier.size(20.dp),
                        color     = BtccBackground,
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Submit Report", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }

            if (submitState == SubmitState.Error) {
                Text(
                    "Something went wrong. Please try again.",
                    color    = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp,
                )
            }

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun SuccessScreen(onReturnToNews: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground)
            .padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(BtccYellow),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint     = BtccBackground,
                    modifier = Modifier.size(44.dp),
                )
            }

            Text(
                "Report Submitted",
                color      = BtccTextPrimary,
                fontSize   = 24.sp,
                fontWeight = FontWeight.Black,
                textAlign  = TextAlign.Center,
            )

            Text(
                "Thanks for the feedback.\nWe'll look into it as soon as possible.",
                color     = BtccTextSecondary,
                fontSize  = 15.sp,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
            )

            Spacer(Modifier.height(8.dp))

            Button(
                onClick  = onReturnToNews,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BtccYellow,
                    contentColor   = BtccBackground,
                ),
                shape = RoundedCornerShape(10.dp),
            ) {
                Text("Return to News", fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
        }
    }
}

private suspend fun submitReport(
    category: String,
    title: String,
    description: String,
    steps: String,
): SubmitState = withContext(Dispatchers.IO) {
    return@withContext try {
        val body = FormBody.Builder()
            .add("category", category)
            .add("subject", "[$category] $title — BTCC Fan Hub v${BuildConfig.VERSION_NAME}")
            .add("title", title)
            .add("description", description)
            .add("steps", steps.ifBlank { "Not provided" })
            .add("app_version", BuildConfig.VERSION_NAME)
            .build()

        val request = Request.Builder()
            .url(FORMSPREE_ENDPOINT)
            .header("Accept", "application/json")
            .post(body)
            .build()

        val response = OkHttpClient().newCall(request).execute()
        if (response.isSuccessful) SubmitState.Success else SubmitState.Error
    } catch (e: Exception) {
        SubmitState.Error
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style         = MaterialTheme.typography.labelSmall,
        fontWeight    = FontWeight.ExtraBold,
        color         = BtccTextSecondary,
        letterSpacing = 2.sp,
    )
}

@Composable
private fun CategoryChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val bg     = if (selected) BtccYellow else BtccCard
    val border = if (selected) BtccYellow else BtccOutline
    val text   = if (selected) BtccBackground else BtccTextPrimary

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun formFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor      = BtccYellow,
    unfocusedBorderColor    = BtccOutline,
    focusedTextColor        = BtccTextPrimary,
    unfocusedTextColor      = BtccTextPrimary,
    cursorColor             = BtccYellow,
    focusedContainerColor   = BtccCard,
    unfocusedContainerColor = BtccCard,
)
