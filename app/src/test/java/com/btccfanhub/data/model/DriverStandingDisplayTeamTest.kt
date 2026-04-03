package com.btccfanhub.data.model

import org.junit.Assert.assertEquals
import org.junit.Test

class DriverStandingDisplayTeamTest {

    @Test
    fun `displayTeam returns team when no secondary`() {
        val standing = DriverStanding(
            position = 1, name = "Tom Ingram",
            team = "EXCELR8", car = "Hyundai", points = 100,
        )
        assertEquals("EXCELR8", standing.displayTeam)
    }

    @Test
    fun `displayTeam shows arrow when secondary exists`() {
        val standing = DriverStanding(
            position = 1, name = "Driver",
            team = "CHROME", teamSecondary = "RCIB",
            car = "BMW", points = 50,
        )
        assertEquals("RCIB → CHROME", standing.displayTeam)
    }

    @Test
    fun `displayTeam ignores empty secondary`() {
        val standing = DriverStanding(
            position = 1, name = "Driver",
            team = "NAPA", teamSecondary = "",
            car = "Ford", points = 30,
        )
        assertEquals("NAPA", standing.displayTeam)
    }

    @Test
    fun `displayTeam ignores null secondary`() {
        val standing = DriverStanding(
            position = 1, name = "Driver",
            team = "Laser Tools", teamSecondary = null,
            car = "BMW", points = 80,
        )
        assertEquals("Laser Tools", standing.displayTeam)
    }
}
