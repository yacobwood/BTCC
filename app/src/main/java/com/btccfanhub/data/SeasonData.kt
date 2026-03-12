package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.RoundResult
import com.btccfanhub.data.model.TeamStanding

/** Single source of truth for a season: drivers, teams, and round-by-round results from Excel. */
data class SeasonData(
    val year: Int,
    val drivers: List<DriverStanding>,
    val teams: List<TeamStanding>,
    val rounds: List<RoundResult>,
)
