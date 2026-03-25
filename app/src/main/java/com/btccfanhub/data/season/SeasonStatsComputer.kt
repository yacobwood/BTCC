package com.btccfanhub.data

import com.btccfanhub.data.model.RoundResult

data class DriverSeasonStats(
    val driver: String,
    val team: String,
    val races: Int,
    val wins: Int,
    val podiums: Int,
    val poles: Int,
    val fastestLaps: Int,
    val dnfs: Int,
)

object SeasonStatsComputer {

    fun compute(rounds: List<RoundResult>): List<DriverSeasonStats> {
        data class Acc(
            var team: String = "",
            var races: Int = 0,
            var wins: Int = 0,
            var podiums: Int = 0,
            var poles: Int = 0,
            var fastestLaps: Int = 0,
            var dnfs: Int = 0,
        )

        val map = LinkedHashMap<String, Acc>()

        for (round in rounds) {
            // Count poles from round-level polePosition string OR from Race 1 driver with pole=true
            val poleSitter = round.polePosition
                ?: round.races.firstOrNull { it.label.contains("1") }
                    ?.results?.firstOrNull { it.pole }?.driver
            poleSitter?.let { driver ->
                map.getOrPut(driver) { Acc() }.poles++
            }
            for (race in round.races) {
                for (result in race.results) {
                    val acc = map.getOrPut(result.driver) { Acc() }
                    if (acc.team.isEmpty()) acc.team = result.team
                    acc.races++
                    when {
                        result.position == 1      -> { acc.wins++; acc.podiums++ }
                        result.position in 2..3   -> acc.podiums++
                        result.position <= 0      -> acc.dnfs++
                    }
                    if (result.fastestLap) acc.fastestLaps++
                }
            }
        }

        return map.entries
            .map { (driver, acc) ->
                DriverSeasonStats(
                    driver      = driver,
                    team        = acc.team,
                    races       = acc.races,
                    wins        = acc.wins,
                    podiums     = acc.podiums,
                    poles       = acc.poles,
                    fastestLaps = acc.fastestLaps,
                    dnfs        = acc.dnfs,
                )
            }
            .sortedWith(
                compareByDescending<DriverSeasonStats> { it.wins }
                    .thenByDescending { it.podiums }
                    .thenByDescending { it.poles }
                    .thenByDescending { it.races }
            )
    }
}
