package com.btccfanhub.data.model

data class DriverStanding(
    val position: Int,
    val name: String,
    val team: String,
    val teamSecondary: String? = null, // previous team if driver moved mid-season
    val car: String,
    val points: Int,
    val wins: Int = 0,
) {
    /** Display string for team(s), e.g. "RCIB → CHROME" when driver moved mid-season. */
    val displayTeam: String
        get() = if (teamSecondary != null && teamSecondary.isNotEmpty())
            "$teamSecondary → $team" else team
}
