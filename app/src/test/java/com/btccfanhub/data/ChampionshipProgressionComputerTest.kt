package com.btccfanhub.data

import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.model.RoundResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChampionshipProgressionComputerTest {

    // ── helpers ──────────────────────────────────────────────────────────────

    private fun result(driver: String, team: String, points: Int) = DriverResult(
        position = 1, number = 1, driver = driver, team = team,
        laps = 10, time = "", gap = null, bestLap = "", points = points,
    )

    private fun race(vararg results: DriverResult) =
        RaceEntry(label = "Race 1", results = results.toList())

    private fun round(round: Int, vararg races: RaceEntry) =
        RoundResult(round = round, venue = "Test", date = "", races = races.toList())

    // ── empty input ───────────────────────────────────────────────────────────

    @Test
    fun `empty rounds returns empty list`() {
        assertTrue(ChampionshipProgressionComputer.compute(emptyList()).isEmpty())
    }

    // ── single round ──────────────────────────────────────────────────────────

    @Test
    fun `single round single driver`() {
        val result = ChampionshipProgressionComputer.compute(
            listOf(round(1, race(result("Alice", "TeamA", 20))))
        )
        assertEquals(1, result.size)
        assertEquals("Alice", result[0].driver)
        assertEquals("TeamA", result[0].team)
        assertEquals(listOf(20), result[0].cumulativePointsByRound)
    }

    @Test
    fun `single round two drivers sorted by points descending`() {
        val result = ChampionshipProgressionComputer.compute(
            listOf(round(1, race(result("Alice", "TeamA", 17), result("Bob", "TeamB", 20))))
        )
        assertEquals("Bob",   result[0].driver)
        assertEquals("Alice", result[1].driver)
    }

    // ── cumulative accumulation ───────────────────────────────────────────────

    @Test
    fun `cumulative points accumulate across rounds`() {
        val result = ChampionshipProgressionComputer.compute(listOf(
            round(1, race(result("Alice", "TeamA", 20))),
            round(2, race(result("Alice", "TeamA", 17))),
            round(3, race(result("Alice", "TeamA", 15))),
        ))
        assertEquals(listOf(20, 37, 52), result[0].cumulativePointsByRound)
    }

    @Test
    fun `zero points in a round does not reduce cumulative`() {
        val result = ChampionshipProgressionComputer.compute(listOf(
            round(1, race(result("Alice", "TeamA", 20))),
            round(2, race(result("Alice", "TeamA", 0))),
        ))
        assertEquals(listOf(20, 20), result[0].cumulativePointsByRound)
    }

    @Test
    fun `driver absent from a round is treated as zero points for that round`() {
        val result = ChampionshipProgressionComputer.compute(listOf(
            round(1, race(result("Alice", "TeamA", 20))),
            round(2, race(result("Alice", "TeamA", 17), result("Bob", "TeamB", 20))),
        ))
        val alice = result.first { it.driver == "Alice" }
        val bob   = result.first { it.driver == "Bob" }
        assertEquals(listOf(20, 37), alice.cumulativePointsByRound)
        assertEquals(listOf(0,  20), bob.cumulativePointsByRound)
    }

    // ── round ordering ────────────────────────────────────────────────────────

    @Test
    fun `rounds are sorted by round number before computing`() {
        // Provide round 2 before round 1 — cumulative should still be [20, 37]
        val result = ChampionshipProgressionComputer.compute(listOf(
            round(2, race(result("Alice", "TeamA", 17))),
            round(1, race(result("Alice", "TeamA", 20))),
        ))
        assertEquals(listOf(20, 37), result[0].cumulativePointsByRound)
    }

    // ── multiple races per round ──────────────────────────────────────────────

    @Test
    fun `points from multiple races within a round are summed`() {
        val result = ChampionshipProgressionComputer.compute(listOf(
            round(1,
                race(result("Alice", "TeamA", 20)),
                race(result("Alice", "TeamA", 17)),
            )
        ))
        assertEquals(listOf(37), result[0].cumulativePointsByRound)
    }

    // ── team assignment ───────────────────────────────────────────────────────

    @Test
    fun `team is taken from first appearance`() {
        val result = ChampionshipProgressionComputer.compute(listOf(
            round(1, race(result("Alice", "TeamA", 20))),
            round(2, race(result("Alice", "TeamB", 17))), // team changes — first wins
        ))
        assertEquals("TeamA", result.first { it.driver == "Alice" }.team)
    }

    // ── final sorting ─────────────────────────────────────────────────────────

    @Test
    fun `three drivers sorted by total points descending`() {
        val result = ChampionshipProgressionComputer.compute(listOf(
            round(1, race(
                result("C", "T", 15),
                result("A", "T", 20),
                result("B", "T", 17),
            ))
        ))
        assertEquals(listOf("A", "B", "C"), result.map { it.driver })
    }
}
