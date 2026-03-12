package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2016 BTCC standings from Drivers and Teams (Excel). */
object Standings2016 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Gordon Shedden", team = "", car = "", points = 308, wins = 4),
        DriverStanding(position =  2, name = "Sam Tordoff", team = "", car = "", points = 306, wins = 2),
        DriverStanding(position =  3, name = "Mat Jackson", team = "", car = "", points = 292, wins = 5),
        DriverStanding(position =  4, name = "Colin Turkington", team = "", car = "", points = 289, wins = 5),
        DriverStanding(position =  5, name = "Rob Collard", team = "", car = "", points = 278, wins = 2),
        DriverStanding(position =  6, name = "Matt Neal", team = "", car = "", points = 275, wins = 3),
        DriverStanding(position =  7, name = "Jason Plato", team = "", car = "", points = 256, wins = 1),
        DriverStanding(position =  8, name = "Andrew Jordan", team = "", car = "", points = 255, wins = 2),
        DriverStanding(position =  9, name = "Adam Morgan", team = "", car = "", points = 241, wins = 2),
        DriverStanding(position = 10, name = "Tom Ingram", team = "", car = "", points = 220, wins = 2),
        DriverStanding(position = 11, name = "Jack Goff", team = "", car = "", points = 193, wins = 0),
        DriverStanding(position = 12, name = "Josh Cook", team = "", car = "", points = 175, wins = 0),
        DriverStanding(position = 13, name = "Ashley Sutton", team = "", car = "", points = 162, wins = 1),
        DriverStanding(position = 14, name = "Aiden Moffat", team = "", car = "", points = 138, wins = 0),
        DriverStanding(position = 15, name = "Árón Smith", team = "", car = "", points = 132, wins = 1),
        DriverStanding(position = 16, name = "Rob Austin", team = "", car = "", points = 129, wins = 0),
        DriverStanding(position = 17, name = "Jake Hill", team = "", car = "", points = 83, wins = 0),
        DriverStanding(position = 18, name = "Jeff Smith", team = "", car = "", points = 55, wins = 0),
        DriverStanding(position = 19, name = "Hunter Abbott", team = "", car = "", points = 38, wins = 0),
        DriverStanding(position = 20, name = "Daniel Lloyd", team = "", car = "", points = 36, wins = 0),
        DriverStanding(position = 21, name = "Martin Depper", team = "", car = "", points = 28, wins = 0),
        DriverStanding(position = 22, name = "Dave Newsham", team = "", car = "", points = 28, wins = 0),
        DriverStanding(position = 23, name = "Dan Welch", team = "", car = "", points = 23, wins = 0),
        DriverStanding(position = 24, name = "Michael Epps", team = "", car = "", points = 23, wins = 0),
        DriverStanding(position = 25, name = "James Cole", team = "", car = "", points = 15, wins = 0),
        DriverStanding(position = 26, name = "Ollie Jackson", team = "", car = "", points = 14, wins = 0),
        DriverStanding(position = 27, name = "Warren Scott", team = "", car = "", points = 7, wins = 0),
        DriverStanding(position = 28, name = "Alex Martin", team = "", car = "", points = 3, wins = 0),
        DriverStanding(position = 29, name = "Matt Simpson", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 30, name = "Chris Smiley", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 31, name = "Stewart Lines", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 32, name = "Kelvin Fletcher", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 33, name = "Michael Caine", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 34, name = "Andy Neate", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 35, name = "Tony Gilham", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 36, name = "Mark Howard", team = "", car = "", points = -3, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Team JCT600 with GardX", points = 574),
        TeamStanding(position = 2, name = "Halfords Yuasa Racing", points = 557),
        TeamStanding(position = 3, name = "Motorbase Performance", points = 538),
        TeamStanding(position = 4, name = "Silverline Subaru BMR Racing", points = 531),
        TeamStanding(position = 5, name = "MG Racing RCIB Insurance", points = 332),
        TeamStanding(position = 6, name = "WIX Racing", points = 234),
        TeamStanding(position = 7, name = "Speedworks Motorsport", points = 202),
        TeamStanding(position = 8, name = "Team IHG Rewards Club", points = 192),
        TeamStanding(position = 9, name = "Laser Tools Racing", points = 137),
        TeamStanding(position = 10, name = "Handy Motorsport", points = 136),
        TeamStanding(position = 11, name = "RCIB Insurance Racing", points = 116),
        TeamStanding(position = 12, name = "Team BKR", points = 110),
        TeamStanding(position = 13, name = "Eurotech Racing", points = 105),
        TeamStanding(position = 14, name = "Power Maxed Racing", points = 68),
        TeamStanding(position = 15, name = "Goodestone Racing", points = 26),
        TeamStanding(position = 16, name = "AmD Tuning", points = 16),
        TeamStanding(position = 17, name = "Dextra Racing with Team Parker", points = 5),
        TeamStanding(position = 18, name = "TLC Racing", points = 1),
        TeamStanding(position = 19, name = "Maximum Motorsport", points = 0),
    )
}
