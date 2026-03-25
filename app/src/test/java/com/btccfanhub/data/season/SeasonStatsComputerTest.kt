package com.btccfanhub.data.season

import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.model.RoundResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SeasonStatsComputerTest {

    // ── helpers ──────────────────────────────────────────────────────────────

    private fun result(
        driver: String,
        team: String = "Team",
        position: Int = 1,
        fastestLap: Boolean = false,
        pole: Boolean = false,
    ) = DriverResult(
        position = position, number = 1, driver = driver, team = team,
        laps = 10, time = "", gap = null, bestLap = "", points = 20,
        fastestLap = fastestLap, pole = pole,
    )

    private fun race(vararg results: DriverResult) =
        RaceEntry(label = "Race 1", results = results.toList())

    private fun race(label: String, vararg results: DriverResult) =
        RaceEntry(label = label, results = results.toList())

    private fun round(vararg races: RaceEntry, pole: String? = null) =
        RoundResult(round = 1, venue = "Test", date = "", races = races.toList(), polePosition = pole)

    // ── empty input ───────────────────────────────────────────────────────────

    @Test
    fun `empty rounds returns empty list`() {
        assertTrue(SeasonStatsComputer.compute(emptyList()).isEmpty())
    }

    // ── win / podium counting ─────────────────────────────────────────────────

    @Test
    fun `position 1 counts as win and podium`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", position = 1))))
        ).first()
        assertEquals(1, stats.wins)
        assertEquals(1, stats.podiums)
    }

    @Test
    fun `position 2 counts as podium but not win`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", position = 2))))
        ).first()
        assertEquals(0, stats.wins)
        assertEquals(1, stats.podiums)
    }

    @Test
    fun `position 3 counts as podium`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", position = 3))))
        ).first()
        assertEquals(0, stats.wins)
        assertEquals(1, stats.podiums)
    }

    @Test
    fun `position 4 is not a podium`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", position = 4))))
        ).first()
        assertEquals(0, stats.wins)
        assertEquals(0, stats.podiums)
    }

    // ── DNF counting ──────────────────────────────────────────────────────────

    @Test
    fun `position 0 counts as dnf`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", position = 0))))
        ).first()
        assertEquals(1, stats.dnfs)
    }

    @Test
    fun `negative position counts as dnf`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", position = -1))))
        ).first()
        assertEquals(1, stats.dnfs)
    }

    @Test
    fun `position 4 and above does not count as dnf`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", position = 4))))
        ).first()
        assertEquals(0, stats.dnfs)
    }

    // ── fastest lap ───────────────────────────────────────────────────────────

    @Test
    fun `fastest lap flag increments fastestLaps`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", fastestLap = true))))
        ).first()
        assertEquals(1, stats.fastestLaps)
    }

    @Test
    fun `no fastest lap flag leaves fastestLaps at zero`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", fastestLap = false))))
        ).first()
        assertEquals(0, stats.fastestLaps)
    }

    // ── pole position ─────────────────────────────────────────────────────────

    @Test
    fun `pole from round polePosition field`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice")), pole = "Alice"))
        ).first()
        assertEquals(1, stats.poles)
    }

    @Test
    fun `pole from Race 1 result pole flag when polePosition is null`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race("Race 1", result("Alice", pole = true))))
        ).first()
        assertEquals(1, stats.poles)
    }

    @Test
    fun `pole flag on Race 2 is not counted`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race("Race 2", result("Alice", pole = true))))
        ).first()
        assertEquals(0, stats.poles)
    }

    @Test
    fun `round polePosition takes precedence over race 1 pole flag`() {
        val rounds = listOf(
            round(race("Race 1", result("Alice", pole = true)), pole = "Bob")
        )
        val stats = SeasonStatsComputer.compute(rounds)
        val alice = stats.first { it.driver == "Alice" }
        val bob   = stats.first { it.driver == "Bob" }
        assertEquals(0, alice.poles) // polePosition overrides race flag
        assertEquals(1, bob.poles)
    }

    // ── race count ────────────────────────────────────────────────────────────

    @Test
    fun `races count increments for each result entry`() {
        val rounds = listOf(
            round(
                race(result("Alice"), result("Bob")),
                race(result("Alice"), result("Bob")),
            )
        )
        val stats = SeasonStatsComputer.compute(rounds)
        assertEquals(2, stats.first { it.driver == "Alice" }.races)
        assertEquals(2, stats.first { it.driver == "Bob" }.races)
    }

    // ── sorting ───────────────────────────────────────────────────────────────

    @Test
    fun `sorted by wins descending`() {
        val rounds = listOf(
            round(
                race("Race 1", result("Alice", position = 2)),
                race("Race 2", result("Bob", position = 1)),
            )
        )
        val stats = SeasonStatsComputer.compute(rounds)
        assertEquals("Bob",   stats[0].driver)
        assertEquals("Alice", stats[1].driver)
    }

    @Test
    fun `sorted by podiums when wins are equal`() {
        val rounds = listOf(
            round(
                race(result("Alice", position = 4)),
                race(result("Bob", position = 2)),
            )
        )
        assertEquals("Bob", SeasonStatsComputer.compute(rounds)[0].driver)
    }

    @Test
    fun `sorted by poles when wins and podiums are equal`() {
        // Both drivers have no wins / podiums; Bob has a pole, Alice doesn't
        val rounds = listOf(
            round(
                race("Race 1", result("Alice", position = 4, pole = false)),
                pole = "Bob",
            )
        )
        val stats = SeasonStatsComputer.compute(rounds)
        assertEquals("Bob",   stats[0].driver)
        assertEquals("Alice", stats[1].driver)
    }

    // ── team assignment ───────────────────────────────────────────────────────

    @Test
    fun `team recorded from first race result`() {
        val stats = SeasonStatsComputer.compute(
            listOf(round(race(result("Alice", team = "TeamAlpha"))))
        ).first()
        assertEquals("TeamAlpha", stats.team)
    }
}
