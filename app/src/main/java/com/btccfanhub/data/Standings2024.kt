package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2024 BTCC standings from race results. */
object Standings2024 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Jake Hill", team = "Laser Tools Racing with MB Motorsport", car = "24", points = 462, wins = 8),
        DriverStanding(position =   2, name = "Tom Ingram", team = "Bristol Street Motors", car = "80", points = 438, wins = 6),
        DriverStanding(position =   3, name = "Ashley Sutton", team = "NAPA Racing UK", car = "1", points = 392, wins = 3),
        DriverStanding(position =   4, name = "Colin Turkington", team = "BMW", car = "20", points = 369, wins = 5),
        DriverStanding(position =   5, name = "Dan Cammish", team = "NAPA Racing UK", car = "27", points = 365, wins = 1),
        DriverStanding(position =   6, name = "Josh Cook", team = "LKQ Euro Car Parts with SYNETIQ", car = "66", points = 342, wins = 2),
        DriverStanding(position =   7, name = "Árón Taylor-smith", team = "Evans Halshaw Power Maxed Racing", car = "40", points = 225, wins = 0),
        DriverStanding(position =   8, name = "Rob Huff", team = "TOYOTA GAZOO Racing UK", car = "12", points = 204, wins = 2),
        DriverStanding(position =   9, name = "Adam Morgan", team = "BMW", car = "33", points = 200, wins = 0),
        DriverStanding(position =  10, name = "Tom Chilton", team = "Bristol Street Motors", car = "3", points = 195, wins = 1),
        DriverStanding(position =  11, name = "Daniel Rowbottom", team = "NAPA Racing UK", car = "32", points = 189, wins = 0),
        DriverStanding(position =  12, name = "Aiden Moffat", team = "LKQ Euro Car Parts with SYNETIQ", car = "16", points = 150, wins = 1),
        DriverStanding(position =  13, name = "Mikey Doble", team = "Evans Halshaw Power Maxed Racing", car = "88", points = 150, wins = 0),
        DriverStanding(position =  14, name = "Andrew Watson", team = "TOYOTA GAZOO Racing UK", car = "11", points = 120, wins = 0),
        DriverStanding(position =  15, name = "Sam Osborne", team = "NAPA Racing UK", car = "77", points = 93, wins = 0),
        DriverStanding(position =  16, name = "Ronan Pearson", team = "Bristol Street Motors", car = "14", points = 80, wins = 1),
        DriverStanding(position =  17, name = "Chris Smiley", team = "Restart Racing", car = "222", points = 70, wins = 0),
        DriverStanding(position =  18, name = "Daryl Deleon", team = "Duckhams Racing with Un-Limited Motorsport", car = "18", points = 48, wins = 0),
        DriverStanding(position =  19, name = "Dan Zelos", team = "Bristol Street Motors", car = "45", points = 44, wins = 0),
        DriverStanding(position =  20, name = "Bobby Thompson", team = "Zeus Cloud Racing with WSR", car = "19", points = 37, wins = 0),
        DriverStanding(position =  21, name = "Scott Sumpton", team = "Restart Racing", car = "29", points = 20, wins = 0),
        DriverStanding(position =  22, name = "Nick Halstead", team = "Bristol Street Motors", car = "22", points = 7, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "NAPA Racing UK", points = 1039),
        TeamStanding(position =   2, name = "Bristol Street Motors", points = 764),
        TeamStanding(position =   3, name = "BMW", points = 569),
        TeamStanding(position =   4, name = "LKQ Euro Car Parts with SYNETIQ", points = 492),
        TeamStanding(position =   5, name = "Laser Tools Racing with MB Motorsport", points = 462),
        TeamStanding(position =   6, name = "Evans Halshaw Power Maxed Racing", points = 375),
        TeamStanding(position =   7, name = "TOYOTA GAZOO Racing UK", points = 324),
        TeamStanding(position =   8, name = "Restart Racing", points = 90),
        TeamStanding(position =   9, name = "Duckhams Racing with Un-Limited Motorsport", points = 48),
        TeamStanding(position =  10, name = "Zeus Cloud Racing with WSR", points = 37),
    )
}
