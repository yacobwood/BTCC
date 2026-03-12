package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2024 BTCC standings from Drivers and Teams (Excel). */
object Standings2024 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Jake Hill", team = "", car = "", points = 421, wins = 0),
        DriverStanding(position =  2, name = "Tom Ingram", team = "", car = "", points = 413, wins = 0),
        DriverStanding(position =  3, name = "Ashley Sutton", team = "", car = "", points = 365, wins = 0),
        DriverStanding(position =  4, name = "Colin Turkington", team = "", car = "", points = 346, wins = 0),
        DriverStanding(position =  5, name = "Dan Cammish", team = "", car = "", points = 346, wins = 0),
        DriverStanding(position =  6, name = "Josh Cook", team = "", car = "", points = 327, wins = 0),
        DriverStanding(position =  7, name = "Árón Taylor-Smith", team = "", car = "", points = 224, wins = 0),
        DriverStanding(position =  8, name = "Adam Morgan", team = "", car = "", points = 201, wins = 0),
        DriverStanding(position =  9, name = "Rob Huff", team = "", car = "", points = 195, wins = 0),
        DriverStanding(position = 10, name = "Tom Chilton", team = "", car = "", points = 187, wins = 0),
        DriverStanding(position = 11, name = "Daniel Rowbottom", team = "", car = "", points = 186, wins = 0),
        DriverStanding(position = 12, name = "Mikey Doble", team = "", car = "", points = 148, wins = 0),
        DriverStanding(position = 13, name = "Aiden Moffat", team = "", car = "", points = 138, wins = 0),
        DriverStanding(position = 14, name = "Andrew Watson", team = "", car = "", points = 120, wins = 0),
        DriverStanding(position = 15, name = "Sam Osborne", team = "", car = "", points = 93, wins = 0),
        DriverStanding(position = 16, name = "Ronan Pearson", team = "", car = "", points = 77, wins = 0),
        DriverStanding(position = 17, name = "Chris Smiley", team = "", car = "", points = 70, wins = 0),
        DriverStanding(position = 18, name = "Daryl DeLeon", team = "", car = "", points = 48, wins = 0),
        DriverStanding(position = 19, name = "Dan Zelos", team = "", car = "", points = 44, wins = 0),
        DriverStanding(position = 20, name = "Bobby Thompson", team = "", car = "", points = 34, wins = 0),
        DriverStanding(position = 21, name = "Scott Sumpton", team = "", car = "", points = 20, wins = 0),
        DriverStanding(position = 22, name = "Nick Halstead", team = "", car = "", points = 7, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK", points = 724),
        TeamStanding(position = 2, name = "Team Bristol Street Motors", points = 609),
        TeamStanding(position = 3, name = "Team BMW", points = 560),
        TeamStanding(position = 4, name = "LKQ Euro Car Parts with SYNETIQ", points = 497),
        TeamStanding(position = 5, name = "Evans Halshaw Power Maxed Racing", points = 427),
        TeamStanding(position = 6, name = "Laser Tools Racing with MB Motorsport", points = 412),
        TeamStanding(position = 7, name = "Toyota Gazoo Racing UK", points = 367),
        TeamStanding(position = 8, name = "Restart Racing", points = 181),
        TeamStanding(position = 9, name = "Duckhams Racing with Bartercard", points = 85),
        TeamStanding(position = 10, name = "Zeus Cloud Racing with WSR", points = 34),
    )
}
