package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2017 BTCC standings from Drivers and Teams (Excel). */
object Standings2017 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton", team = "", car = "", points = 372, wins = 6),
        DriverStanding(position =  2, name = "Colin Turkington", team = "", car = "", points = 351, wins = 4),
        DriverStanding(position =  3, name = "Tom Ingram", team = "", car = "", points = 311, wins = 4),
        DriverStanding(position =  4, name = "Gordon Shedden", team = "", car = "", points = 309, wins = 3),
        DriverStanding(position =  5, name = "Rob Collard", team = "", car = "", points = 256, wins = 1),
        DriverStanding(position =  6, name = "Jack Goff", team = "", car = "", points = 245, wins = 1),
        DriverStanding(position =  7, name = "Matt Neal", team = "", car = "", points = 243, wins = 2),
        DriverStanding(position =  8, name = "Mat Jackson", team = "", car = "", points = 210, wins = 1),
        DriverStanding(position =  9, name = "Andrew Jordan", team = "", car = "", points = 203, wins = 3),
        DriverStanding(position = 10, name = "Adam Morgan", team = "", car = "", points = 187, wins = 0),
        DriverStanding(position = 11, name = "Rob Austin", team = "", car = "", points = 174, wins = 1),
        DriverStanding(position = 12, name = "Jason Plato", team = "", car = "", points = 146, wins = 1),
        DriverStanding(position = 13, name = "Aiden Moffat", team = "", car = "", points = 121, wins = 2),
        DriverStanding(position = 14, name = "Dave Newsham", team = "", car = "", points = 108, wins = 0),
        DriverStanding(position = 15, name = "Tom Chilton", team = "", car = "", points = 100, wins = 0),
        DriverStanding(position = 16, name = "James Cole", team = "", car = "", points = 79, wins = 1),
        DriverStanding(position = 17, name = "Michael Epps", team = "", car = "", points = 77, wins = 0),
        DriverStanding(position = 18, name = "Josh Cook", team = "", car = "", points = 75, wins = 0),
        DriverStanding(position = 19, name = "Senna Proctor", team = "", car = "", points = 63, wins = 0),
        DriverStanding(position = 20, name = "Jake Hill", team = "", car = "", points = 63, wins = 0),
        DriverStanding(position = 21, name = "Chris Smiley", team = "", car = "", points = 45, wins = 0),
        DriverStanding(position = 22, name = "Ollie Jackson", team = "", car = "", points = 42, wins = 0),
        DriverStanding(position = 23, name = "Ant Whorton-Eales", team = "", car = "", points = 34, wins = 0),
        DriverStanding(position = 24, name = "Matt Simpson", team = "", car = "", points = 30, wins = 0),
        DriverStanding(position = 25, name = "Robert Huff", team = "", car = "", points = 26, wins = 0),
        DriverStanding(position = 26, name = "Jeff Smith", team = "", car = "", points = 25, wins = 0),
        DriverStanding(position = 27, name = "Árón Taylor-Smith", team = "", car = "", points = 25, wins = 0),
        DriverStanding(position = 28, name = "Martin Depper", team = "", car = "", points = 22, wins = 0),
        DriverStanding(position = 29, name = "Rory Butcher", team = "", car = "", points = 20, wins = 0),
        DriverStanding(position = 30, name = "Brett Smith", team = "", car = "", points = 13, wins = 0),
        DriverStanding(position = 31, name = "Josh Price", team = "", car = "", points = 9, wins = 0),
        DriverStanding(position = 32, name = "Luke Davenport", team = "", car = "", points = 6, wins = 0),
        DriverStanding(position = 33, name = "Daniel Lloyd", team = "", car = "", points = 6, wins = 0),
        DriverStanding(position = 34, name = "Stephen Jelley", team = "", car = "", points = 2, wins = 0),
        DriverStanding(position = 35, name = "Will Burns", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 36, name = "Dennis Strandberg", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 37, name = "Stewart Lines", team = "", car = "", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Team BMW", points = 594),
        TeamStanding(position = 2, name = "Halfords Yuasa Racing", points = 545),
        TeamStanding(position = 3, name = "Adrian Flux Subaru Racing", points = 513),
        TeamStanding(position = 4, name = "Speedworks Motorsport", points = 307),
        TeamStanding(position = 5, name = "Eurotech Racing", points = 286),
        TeamStanding(position = 6, name = "Team Shredded Wheat Racing with DUO", points = 235),
        TeamStanding(position = 7, name = "Power Maxed Racing", points = 201),
        TeamStanding(position = 8, name = "BMW Pirtek Racing", points = 200),
        TeamStanding(position = 9, name = "Ciceley Motorsport with MAC Tools", points = 191),
        TeamStanding(position = 10, name = "Handy Motorsport", points = 173),
        TeamStanding(position = 11, name = "BTC Norlin Racing", points = 162),
        TeamStanding(position = 12, name = "Laser Tools Racing", points = 124),
        TeamStanding(position = 13, name = "Autoaid/RCIB Insurance Racing", points = 82),
        TeamStanding(position = 14, name = "AmDtuning.com with Cobra Exhausts", points = 79),
        TeamStanding(position = 15, name = "TAG Racing", points = 68),
        TeamStanding(position = 16, name = "MG Racing RCIB Insurance", points = 64),
        TeamStanding(position = 17, name = "Team Parker Racing with Maximum Motorsport", points = 61),
        TeamStanding(position = 18, name = "Simpson Racing", points = 27),
        TeamStanding(position = 19, name = "A-Plan Academy", points = 8),
    )
}
