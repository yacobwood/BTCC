package com.btccfanhub.data.model

import org.junit.Assert.assertEquals
import org.junit.Test

class DriverStandingTest {

    private fun standing(team: String, teamSecondary: String?) = DriverStanding(
        position = 1, name = "Alice", team = team,
        teamSecondary = teamSecondary, car = "Honda", points = 100,
    )

    @Test
    fun `displayTeam returns team when teamSecondary is null`() {
        assertEquals("TeamA", standing("TeamA", null).displayTeam)
    }

    @Test
    fun `displayTeam returns team when teamSecondary is empty string`() {
        assertEquals("TeamA", standing("TeamA", "").displayTeam)
    }

    @Test
    fun `displayTeam formats secondary arrow primary when teamSecondary is set`() {
        assertEquals("OldTeam → TeamA", standing("TeamA", "OldTeam").displayTeam)
    }

    @Test
    fun `displayTeam uses correct arrow character`() {
        val display = standing("Current", "Previous").displayTeam
        assertEquals("Previous → Current", display)
    }
}
