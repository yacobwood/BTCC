package com.btccfanhub.data

import com.btccfanhub.data.model.RoundResult

/**
 * One driver's cumulative points after each round (index 0 = after round 1, etc.).
 */
data class DriverProgressionSeries(
    val driver: String,
    val team: String,
    val cumulativePointsByRound: List<Int>,
)

/**
 * Computes championship progression: cumulative points round-by-round for all drivers.
 * Used to drive the progression line chart. Sorted by final points descending.
 */
object ChampionshipProgressionComputer {

    fun compute(rounds: List<RoundResult>): List<DriverProgressionSeries> {
        if (rounds.isEmpty()) return emptyList()

        val sortedRounds = rounds.sortedBy { it.round }
        val allDrivers = mutableSetOf<String>()
        val teamByDriver = mutableMapOf<String, String>()

        for (round in sortedRounds) {
            for (race in round.races) {
                for (result in race.results) {
                    allDrivers.add(result.driver)
                    if (result.driver !in teamByDriver) teamByDriver[result.driver] = result.team
                }
            }
        }

        // pointsPerRound[driver] = list of points scored in each round (same order as sortedRounds)
        val pointsPerRound = allDrivers.associateWith { driver ->
            sortedRounds.map { round ->
                round.races.sumOf { race ->
                    race.results.filter { it.driver == driver }.sumOf { it.points }
                }
            }
        }

        // Cumulative per driver — runningFold starts at 0 and includes all rounds
        val cumulativeByDriver = pointsPerRound.mapValues { (_, perRound) ->
            perRound.runningFold(0) { acc, p -> acc + p }.drop(1)
        }

        val driversByPoints = cumulativeByDriver.entries
            .sortedByDescending { it.value.lastOrNull() ?: 0 }

        return driversByPoints.map { (driver, cumulative) ->
            DriverProgressionSeries(
                driver = driver,
                team = teamByDriver[driver] ?: "",
                cumulativePointsByRound = cumulative,
            )
        }
    }
}
