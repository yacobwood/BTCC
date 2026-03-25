package com.btccfanhub.data.season

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/**
 * Fallback 2026 standings when live data from [StandingsRepository] is unavailable.
 * Live data is loaded from data/standings.json (updated by cron via the scraper).
 */
object Standings2026 {

    val drivers: List<DriverStanding> = emptyList()
    val teams: List<TeamStanding> = emptyList()
}
