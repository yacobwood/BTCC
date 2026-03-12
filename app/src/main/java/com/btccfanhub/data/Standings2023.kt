package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2023 BTCC standings from Drivers and Teams (Excel). */
object Standings2023 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton", team = "", car = "", points = 446, wins = 0),
        DriverStanding(position =  2, name = "Tom Ingram", team = "", car = "", points = 400, wins = 0),
        DriverStanding(position =  3, name = "Jake Hill", team = "", car = "", points = 373, wins = 0),
        DriverStanding(position =  4, name = "Colin Turkington", team = "", car = "", points = 312, wins = 0),
        DriverStanding(position =  5, name = "Josh Cook", team = "", car = "", points = 268, wins = 0),
        DriverStanding(position =  6, name = "Dan Cammish", team = "", car = "", points = 253, wins = 0),
        DriverStanding(position =  7, name = "Daniel Rowbottom", team = "", car = "", points = 226, wins = 0),
        DriverStanding(position =  8, name = "Ricky Collard", team = "", car = "", points = 217, wins = 0),
        DriverStanding(position =  9, name = "Adam Morgan", team = "", car = "", points = 199, wins = 0),
        DriverStanding(position = 10, name = "Rory Butcher", team = "", car = "", points = 173, wins = 0),
        DriverStanding(position = 11, name = "Árón Taylor-Smith", team = "", car = "", points = 165, wins = 0),
        DriverStanding(position = 12, name = "Stephen Jelley", team = "", car = "", points = 141, wins = 0),
        DriverStanding(position = 13, name = "Daniel Lloyd", team = "", car = "", points = 111, wins = 0),
        DriverStanding(position = 14, name = "Tom Chilton", team = "", car = "", points = 97, wins = 0),
        DriverStanding(position = 15, name = "Andrew Watson", team = "", car = "", points = 93, wins = 0),
        DriverStanding(position = 16, name = "Aiden Moffat", team = "", car = "", points = 87, wins = 0),
        DriverStanding(position = 17, name = "Bobby Thompson", team = "", car = "", points = 74, wins = 0),
        DriverStanding(position = 18, name = "Ronan Pearson", team = "", car = "", points = 69, wins = 0),
        DriverStanding(position = 19, name = "Sam Osborne", team = "", car = "", points = 65, wins = 0),
        DriverStanding(position = 20, name = "Mikey Doble", team = "", car = "", points = 63, wins = 0),
        DriverStanding(position = 21, name = "George Gamble", team = "", car = "", points = 50, wins = 0),
        DriverStanding(position = 22, name = "Dexter Patterson", team = "", car = "", points = 41, wins = 0),
        DriverStanding(position = 23, name = "Michael Crees", team = "", car = "", points = 13, wins = 0),
        DriverStanding(position = 24, name = "Nicolas Hamilton", team = "", car = "", points = 10, wins = 0),
        DriverStanding(position = 25, name = "Daryl DeLeon", team = "", car = "", points = 6, wins = 0),
        DriverStanding(position = 26, name = "Robert Huff", team = "", car = "", points = 5, wins = 0),
        DriverStanding(position = 27, name = "James Gornall", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 28, name = "Jack Butel", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 29, name = "Will Powell", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 30, name = "Nick Halstead", team = "", car = "", points = -5, wins = 0),
        DriverStanding(position = 31, name = "Jade Edwards", team = "", car = "", points = -5, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK", points = 713),
        TeamStanding(position = 2, name = "Bristol Street Motors with Excelr8", points = 0),
        TeamStanding(position = 3, name = "Team BMW", points = 559),
        TeamStanding(position = 4, name = "One Motorsport with Starline Racing", points = 426),
        TeamStanding(position = 5, name = "TOYOTA GAZOO Racing UK", points = 0),
        TeamStanding(position = 6, name = "Laser Tools Racing with MB Motorsport", points = 381),
        TeamStanding(position = 7, name = "CarStore Power Maxed Racing", points = 342),
        TeamStanding(position = 8, name = "Autobrite Direct with Millers Oils", points = 0),
        TeamStanding(position = 9, name = "Re. Beverages and Bartercard with Team HARD", points = 113),
        TeamStanding(position = 10, name = "Go-Fix with Autoaid Breakdown", points = 66),
    )
}
