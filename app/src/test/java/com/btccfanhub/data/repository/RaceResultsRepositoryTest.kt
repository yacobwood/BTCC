package com.btccfanhub.data.repository

import com.btccfanhub.data.model.RoundResult
import org.junit.Assert.assertEquals
import org.junit.Test

class RaceResultsRepositoryTest {

    // ── pointsFromPosition ────────────────────────────────────────────────────

    @Test fun `position 1 scores 20 points`()  { assertEquals(20, RaceResultsRepository.pointsFromPosition(1))  }
    @Test fun `position 2 scores 17 points`()  { assertEquals(17, RaceResultsRepository.pointsFromPosition(2))  }
    @Test fun `position 3 scores 15 points`()  { assertEquals(15, RaceResultsRepository.pointsFromPosition(3))  }
    @Test fun `position 4 scores 13 points`()  { assertEquals(13, RaceResultsRepository.pointsFromPosition(4))  }
    @Test fun `position 5 scores 11 points`()  { assertEquals(11, RaceResultsRepository.pointsFromPosition(5))  }
    @Test fun `position 6 scores 10 points`()  { assertEquals(10, RaceResultsRepository.pointsFromPosition(6))  }
    @Test fun `position 7 scores 9 points`()   { assertEquals(9,  RaceResultsRepository.pointsFromPosition(7))  }
    @Test fun `position 8 scores 8 points`()   { assertEquals(8,  RaceResultsRepository.pointsFromPosition(8))  }
    @Test fun `position 9 scores 7 points`()   { assertEquals(7,  RaceResultsRepository.pointsFromPosition(9))  }
    @Test fun `position 10 scores 6 points`()  { assertEquals(6,  RaceResultsRepository.pointsFromPosition(10)) }
    @Test fun `position 11 scores 5 points`()  { assertEquals(5,  RaceResultsRepository.pointsFromPosition(11)) }
    @Test fun `position 12 scores 4 points`()  { assertEquals(4,  RaceResultsRepository.pointsFromPosition(12)) }
    @Test fun `position 13 scores 3 points`()  { assertEquals(3,  RaceResultsRepository.pointsFromPosition(13)) }
    @Test fun `position 14 scores 2 points`()  { assertEquals(2,  RaceResultsRepository.pointsFromPosition(14)) }
    @Test fun `position 15 scores 1 point`()   { assertEquals(1,  RaceResultsRepository.pointsFromPosition(15)) }
    @Test fun `position 16 scores 0 points`()  { assertEquals(0,  RaceResultsRepository.pointsFromPosition(16)) }
    @Test fun `position 0 scores 0 points`()   { assertEquals(0,  RaceResultsRepository.pointsFromPosition(0))  }
    @Test fun `negative position scores 0`()   { assertEquals(0,  RaceResultsRepository.pointsFromPosition(-1)) }

    // ── pointsWithBonuses ─────────────────────────────────────────────────────

    @Test
    fun `position 1 no bonuses scores 20`() {
        assertEquals(20, RaceResultsRepository.pointsWithBonuses(1, false, false, false, false))
    }

    @Test
    fun `fastest lap adds 1 point`() {
        assertEquals(21, RaceResultsRepository.pointsWithBonuses(1, fastestLap = true, leadLap = false, pole = false, isRace1 = false))
    }

    @Test
    fun `lead lap adds 1 point`() {
        assertEquals(21, RaceResultsRepository.pointsWithBonuses(1, fastestLap = false, leadLap = true, pole = false, isRace1 = false))
    }

    @Test
    fun `pole adds 1 point in race 1`() {
        assertEquals(21, RaceResultsRepository.pointsWithBonuses(1, fastestLap = false, leadLap = false, pole = true, isRace1 = true))
    }

    @Test
    fun `pole does NOT add point in race 2 or 3`() {
        assertEquals(20, RaceResultsRepository.pointsWithBonuses(1, fastestLap = false, leadLap = false, pole = true, isRace1 = false))
    }

    @Test
    fun `all bonuses in race 1 adds 3 points`() {
        assertEquals(23, RaceResultsRepository.pointsWithBonuses(1, fastestLap = true, leadLap = true, pole = true, isRace1 = true))
    }

    @Test
    fun `all bonuses in race 2 adds 2 points (no pole)`() {
        assertEquals(22, RaceResultsRepository.pointsWithBonuses(1, fastestLap = true, leadLap = true, pole = true, isRace1 = false))
    }

    @Test
    fun `outside points positions still earns bonus points`() {
        // Position 16 scores 0 base; fastest+lead = +2
        assertEquals(2, RaceResultsRepository.pointsWithBonuses(16, fastestLap = true, leadLap = true, pole = false, isRace1 = false))
    }

    @Test
    fun `position 0 with bonuses earns only bonus points`() {
        assertEquals(1, RaceResultsRepository.pointsWithBonuses(0, fastestLap = true, leadLap = false, pole = false, isRace1 = false))
    }

    // ── reorder2023RoundsToChartOrder ─────────────────────────────────────────

    private fun round(venue: String, round: Int = 1) =
        RoundResult(round = round, venue = venue, date = "", races = emptyList())

    private val ALL_2023_VENUES = listOf(
        "Donington Park", "Brands Hatch Indy", "Snetterton", "Thruxton",
        "Oulton Park", "Croft", "Knockhill", "Donington Park GP",
        "Silverstone", "Brands Hatch GP",
    )

    @Test
    fun `2023 rounds reordered to chart order with correct round numbers`() {
        // Supply venues in reverse so any in-order pass would fail
        val shuffled = ALL_2023_VENUES.reversed().mapIndexed { i, v -> round(v, i + 1) }
        val reordered = RaceResultsRepository.reorder2023RoundsToChartOrder(shuffled)

        assertEquals(ALL_2023_VENUES, reordered.map { it.venue })
        assertEquals((1..10).toList(), reordered.map { it.round })
    }

    @Test
    fun `reorder returns original list when a venue is missing`() {
        // Only 9 of 10 venues — missing Croft
        val incomplete = ALL_2023_VENUES.filter { it != "Croft" }
            .mapIndexed { i, v -> round(v, i + 1) }

        val result = RaceResultsRepository.reorder2023RoundsToChartOrder(incomplete)
        assertEquals(incomplete.map { it.venue }, result.map { it.venue })
    }

    @Test
    fun `reorder returns original list when rounds list is empty`() {
        val result = RaceResultsRepository.reorder2023RoundsToChartOrder(emptyList())
        assertEquals(emptyList<RoundResult>(), result)
    }
}
