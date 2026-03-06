package com.btccfanhub.data.model

data class DriverResult(
    val position: Int,      // 0 = DNF / NC
    val number: Int,
    val driver: String,
    val team: String,
    val laps: Int,
    val time: String,       // e.g. "27:11.648" or "DNF"
    val gap: String?,       // null for P1
    val bestLap: String,    // e.g. "1:08.011"
    val points: Int,
)

data class RaceEntry(
    val label: String,          // "Race 1", "Race 2", "Race 3"
    val results: List<DriverResult>,
    val fullRaceUrl: String? = null,
)

data class RoundResult(
    val round: Int,
    val venue: String,
    val date: String,           // e.g. "18 Apr 2026"
    val races: List<RaceEntry>,
    val r_id: String? = null,
)
