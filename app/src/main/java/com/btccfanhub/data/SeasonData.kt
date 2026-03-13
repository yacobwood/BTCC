package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.RoundResult
import com.btccfanhub.data.model.TeamStanding

/** Single source of truth for 2014–2025: all data precomputed in season_YYYY.json, no in-app calculation. */
data class SeasonData(
    val year: Int,
    val drivers: List<DriverStanding>,
    val teams: List<TeamStanding>,
    val rounds: List<RoundResult>,
    val driverStats: List<DriverSeasonStats>,
    val progression: List<DriverProgressionSeries>,
)
