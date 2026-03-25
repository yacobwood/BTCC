package com.btccfanhub.ui.merch

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.data.model.MerchFeed
import com.btccfanhub.data.model.MerchItem
import com.btccfanhub.data.model.MerchSection
import com.btccfanhub.data.model.Seller
import com.btccfanhub.data.model.SellerType
import com.btccfanhub.data.model.buildAffiliateUrl
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.DriversRepository
import com.btccfanhub.data.repository.MerchRepository
import com.btccfanhub.data.repository.RaceResultsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

sealed class MerchUiState {
    object Loading : MerchUiState()
    data class Success(
        val sections: List<MerchSection>,
        val showFeaturedBanner: Boolean,
        val showRaceWeekendBanner: Boolean,
        val winnerDriverId: Int?,
    ) : MerchUiState()
    data class Error(val cachedSections: List<MerchSection>) : MerchUiState()
}

/**
 * Pure function — no Android context, no side effects — assembles ordered [MerchSection] list
 * from a [MerchFeed]. Extracted at top-level so it can be property-tested on the JVM.
 */
fun assembleSections(
    feed: MerchFeed,
    currentRound: Int?,
    isRaceWeekend: Boolean,
    winnerDriverId: Int?,
    winnerTimestampMs: Long?,
): List<MerchSection> {
    val twoHoursMs = 2 * 60 * 60 * 1000L
    val winnerActive = winnerDriverId != null &&
        winnerTimestampMs != null &&
        (System.currentTimeMillis() - winnerTimestampMs) < twoHoursMs

    fun sortItems(items: List<MerchItem>): List<MerchItem> {
        val sorted = items.sortedByDescending { it.sponsored }
        return if (winnerActive) {
            val (matching, rest) = sorted.partition { it.driverIds.contains(winnerDriverId) }
            matching + rest
        } else {
            sorted
        }
    }

    val sections = mutableListOf<MerchSection>()

    // 1. "Shop the Grid" — OFFICIAL items
    val officialItems = sortItems(feed.items.filter { it.sellerType == SellerType.OFFICIAL })
    if (officialItems.isNotEmpty()) {
        val officialSellers = feed.sellers.filter { it.sellerType == SellerType.OFFICIAL }
        sections += MerchSection("Shop the Grid", officialItems, officialSellers)
    }

    // 2. "This Weekend's Merch Drops" — only if race weekend active and currentRound != null
    if (isRaceWeekend && currentRound != null) {
        val weekendItems = sortItems(feed.items.filter { it.roundTags.contains(currentRound) })
        if (weekendItems.isNotEmpty()) {
            val weekendSellers = feed.sellers.filter { seller ->
                weekendItems.any { it.sellerName == seller.id || it.sellerName == seller.displayName }
            }
            sections += MerchSection("This Weekend's Merch Drops", weekendItems, weekendSellers)
        }
    }

    // 3. "Fan Favourites" — INDEPENDENT or COLLECTIBLE items
    val fanItems = sortItems(
        feed.items.filter {
            it.sellerType == SellerType.INDEPENDENT || it.sellerType == SellerType.COLLECTIBLE
        }
    )
    if (fanItems.isNotEmpty()) {
        val fanSellers = feed.sellers.filter {
            it.sellerType == SellerType.INDEPENDENT || it.sellerType == SellerType.COLLECTIBLE
        }
        sections += MerchSection("Fan Favourites", fanItems, fanSellers)
    }

    return sections
}

class MerchViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<MerchUiState>(MerchUiState.Loading)
    val uiState: StateFlow<MerchUiState> = _uiState.asStateFlow()

    private var allItems: List<MerchItem> = emptyList()
    private var allSellers: List<Seller> = emptyList()
    private var _driverNames = MutableStateFlow<Map<Int, String>>(emptyMap())
    val driverNames: StateFlow<Map<Int, String>> = _driverNames.asStateFlow()

    /** Drivers sorted by previous season finishing position (champion first). Triple: (number, name, imageUrl) */
    private var _sortedDrivers = MutableStateFlow<List<Triple<Int, String, String>>>(emptyList())
    val sortedDrivers: StateFlow<List<Triple<Int, String, String>>> = _sortedDrivers.asStateFlow()

    /** Teams sorted by previous season constructor standing. */
    private var _sortedTeams = MutableStateFlow<List<String>>(emptyList())
    val sortedTeams: StateFlow<List<String>> = _sortedTeams.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    fun refresh() {
        viewModelScope.launch(Dispatchers.IO) {
            _isRefreshing.value = true
            MerchRepository.invalidateCache()
            try {
                val feed = MerchRepository.fetchFeed()
                allItems = feed.items
                allSellers = feed.sellers

                val today = LocalDate.now()
                val calendarData = try { CalendarRepository.getCalendarData() } catch (_: Exception) { null }
                val currentRace = calendarData?.rounds?.firstOrNull { it.endDate >= today }
                val isRaceWeekend = currentRace != null && today >= currentRace.startDate && today <= currentRace.endDate
                val currentRound = if (isRaceWeekend) currentRace?.round else null

                val sections = assembleSections(feed, currentRound, isRaceWeekend, null, null)
                val showFeaturedBanner = sections.any { s -> s.items.any { it.sponsored } } && isRaceWeekend

                _uiState.value = MerchUiState.Success(
                    sections = sections,
                    showFeaturedBanner = showFeaturedBanner,
                    showRaceWeekendBanner = isRaceWeekend,
                    winnerDriverId = null,
                )
            } catch (_: Exception) {
                // keep existing state
            }
            _isRefreshing.value = false
        }
    }

    fun load() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val feed = MerchRepository.fetchFeed()
                allItems = feed.items
                allSellers = feed.sellers

                // Fetch driver/team data for names and championship order
                try {
                    val grid = DriversRepository.fetchGrid()
                    _driverNames.value = grid.drivers.associate { it.number to it.name }

                    // Drivers sorted by 2025 championship position (best first)
                    // Use the most recent season stat's pos field
                    val driverIdsWithMerch = allItems.flatMap { it.driverIds }.distinct().toSet()
                    val driversWithMerch = grid.drivers.filter { it.number in driverIdsWithMerch }
                    val sorted = driversWithMerch.sortedBy { driver ->
                        driver.history.maxByOrNull { it.year }?.pos ?: 999
                    }
                    _sortedDrivers.value = sorted.map { Triple(it.number, it.name, it.imageUrl) }

                    // Teams sorted by standing2025 (constructor order)
                    val teamIdsWithMerch = allItems.flatMap { it.teamIds }.distinct().toSet()
                    val teamsWithMerch = grid.teams.filter { it.name in teamIdsWithMerch }
                    _sortedTeams.value = teamsWithMerch
                        .sortedBy { if (it.standing2025 > 0) it.standing2025 else 999 }
                        .map { it.name }
                } catch (_: Exception) { /* best effort */ }

                // Determine race weekend state from CalendarRepository
                val today = LocalDate.now()
                val calendarData = try { CalendarRepository.getCalendarData() } catch (_: Exception) { null }
                val currentRace = calendarData?.rounds?.firstOrNull { it.endDate >= today }
                val isRaceWeekend = currentRace != null &&
                    today >= currentRace.startDate &&
                    today <= currentRace.endDate
                val currentRound = if (isRaceWeekend) currentRace?.round else null

                // Determine winner from most recent race result
                var winnerDriverId: Int? = null
                var winnerTimestampMs: Long? = null
                try {
                    val results = RaceResultsRepository.getResults()
                    val latestRound = results.lastOrNull { it.races.isNotEmpty() }
                    val latestRace = latestRound?.races?.lastOrNull { it.results.isNotEmpty() }
                    val winner = latestRace?.results?.firstOrNull { it.position == 1 }
                    if (winner != null) {
                        // Use the race date to estimate timestamp; if date string is parseable use it
                        val raceDateStr = latestRace.date
                        val estimatedTimestampMs = if (!raceDateStr.isNullOrBlank()) {
                            parseRaceDateToMs(raceDateStr)
                        } else {
                            null
                        }
                        val twoHoursMs = 2 * 60 * 60 * 1000L
                        if (estimatedTimestampMs != null &&
                            (System.currentTimeMillis() - estimatedTimestampMs) < twoHoursMs
                        ) {
                            winnerDriverId = winner.number
                            winnerTimestampMs = estimatedTimestampMs
                        }
                    }
                } catch (_: Exception) { /* ignore — winner promotion is best-effort */ }

                val sections = assembleSections(
                    feed = feed,
                    currentRound = currentRound,
                    isRaceWeekend = isRaceWeekend,
                    winnerDriverId = winnerDriverId,
                    winnerTimestampMs = winnerTimestampMs,
                )

                val showFeaturedBanner = sections.any { section ->
                    section.items.any { it.sponsored }
                } && isRaceWeekend
                val showRaceWeekendBanner = isRaceWeekend

                if (feed.items.isEmpty() && sections.isEmpty()) {
                    _uiState.value = MerchUiState.Error(emptyList())
                } else {
                    _uiState.value = MerchUiState.Success(
                        sections = sections,
                        showFeaturedBanner = showFeaturedBanner,
                        showRaceWeekendBanner = showRaceWeekendBanner,
                        winnerDriverId = winnerDriverId,
                    )
                }
            } catch (_: Exception) {
                val cached = (uiState.value as? MerchUiState.Success)?.sections ?: emptyList()
                _uiState.value = MerchUiState.Error(cached)
            }
        }
    }

    fun itemTapped(item: MerchItem, context: Context) {
        viewModelScope.launch {
            val (url, affiliateMissing) = buildAffiliateUrl(item)
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (_: Exception) { /* no browser installed — ignore */ }

            val sellerId = allSellers
                .firstOrNull { it.displayName == item.sellerName || it.id == item.sellerName }
                ?.id ?: item.sellerName

            Analytics.merchItemTapped(
                itemId = item.id,
                sellerId = sellerId,
                sellerType = item.sellerType.name.lowercase(),
                sponsored = item.sponsored,
                affiliateMissing = affiliateMissing,
            )
        }
    }

    fun discountCodeCopied(seller: Seller, context: Context) {
        viewModelScope.launch {
            val code = seller.discountCode ?: return@launch
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            clipboard?.setPrimaryClip(ClipData.newPlainText("Discount Code", code))
            Toast.makeText(context, "Code copied: $code", Toast.LENGTH_SHORT).show()
            Analytics.discountCodeCopied(seller.id, code)
        }
    }

    fun getDriverItems(driverId: Int): List<MerchItem> =
        allItems.filter { it.driverIds.contains(driverId) }.take(4)

    fun getTeamItems(teamName: String): List<MerchItem> =
        allItems.filter { it.teamIds.contains(teamName) }.take(4)

    fun getAllItems(): List<MerchItem> = allItems
    fun getAllSellers(): List<Seller> = allSellers

    /**
     * Attempts to parse a race date string like "27 Apr 2025" into epoch milliseconds.
     * Returns null if parsing fails.
     */
    private fun parseRaceDateToMs(dateStr: String): Long? {
        return try {
            val formatter = java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.ENGLISH)
            val date = LocalDate.parse(dateStr.trim(), formatter)
            date.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }
}
