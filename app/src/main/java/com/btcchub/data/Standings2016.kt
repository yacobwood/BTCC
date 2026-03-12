package com.btcchub.data

import com.btcchub.data.model.DriverStanding
import com.btcchub.data.model.TeamStanding

/** Final 2016 BTCC Drivers' Championship standings (Wikipedia). */
object Standings2016 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Gordon Shedden",    team = "Halfords Yuasa Racing", car = "52",  points = 308, wins = 4),
        DriverStanding(position =  2, name = "Sam Tordoff",       team = "Team JCT600 with GardX", car = "600", points = 306, wins = 2),
        DriverStanding(position =  3, name = "Mat Jackson",       team = "Motorbase Performance", car = "7",   points = 292, wins = 5),
        DriverStanding(position =  4, name = "Colin Turkington", team = "Silverline Subaru BMR Racing", car = "4",   points = 289, wins = 5),
        DriverStanding(position =  5, name = "Rob Collard",       team = "Team JCT600 with GardX", car = "5",   points = 278, wins = 2),
        DriverStanding(position =  6, name = "Matt Neal",         team = "Halfords Yuasa Racing", car = "25",  points = 275, wins = 3),
        DriverStanding(position =  7, name = "Jason Plato",       team = "Silverline Subaru BMR Racing", car = "99",  points = 256, wins = 1),
        DriverStanding(position =  8, name = "Andrew Jordan",     team = "Motorbase Performance", car = "77",  points = 255, wins = 2),
        DriverStanding(position =  9, name = "Adam Morgan",       team = "WIX Racing", car = "33",  points = 241, wins = 2),
        DriverStanding(position = 10, name = "Tom Ingram",         team = "Handy Motorsport", car = "80",  points = 220, wins = 2),
        DriverStanding(position = 11, name = "Jack Goff",         team = "Team IHG Rewards Club", car = "31",  points = 193, wins = 0),
        DriverStanding(position = 12, name = "Josh Cook",         team = "MG Racing RCIB Insurance", car = "66",  points = 175, wins = 0),
        DriverStanding(position = 13, name = "Ashley Sutton",     team = "MG Racing RCIB Insurance", car = "116", points = 162, wins = 1),
        DriverStanding(position = 14, name = "Aiden Moffat",      team = "Laser Tools Racing", car = "16",  points = 138, wins = 0),
        DriverStanding(position = 15, name = "Árón Taylor-Smith",  team = "Team BKR", car = "40",  points = 132, wins = 1),
        DriverStanding(position = 16, name = "Rob Austin",        team = "Handy Motorsport", car = "11",  points = 129, wins = 0),
        DriverStanding(position = 17, name = "Jake Hill",          team = "RCIB Insurance Racing", car = "24",  points =  83, wins = 0),
        DriverStanding(position = 18, name = "Jeff Smith",        team = "Eurotech Racing", car = "55",  points =  55, wins = 0),
        DriverStanding(position = 19, name = "Hunter Abbott",    team = "Power Maxed Racing", car = "54",  points =  38, wins = 0),
        DriverStanding(position = 20, name = "Daniel Lloyd",     team = "Eurotech Racing", car = "23",  points =  36, wins = 0),
        DriverStanding(position = 21, name = "Martin Depper",    team = "Eurotech Racing", car = "30",  points =  28, wins = 0),
        DriverStanding(position = 22, name = "Dave Newsham",      team = "Power Maxed Racing", car = "17",  points =  28, wins = 0),
        DriverStanding(position = 23, name = "Dan Welch",        team = "Goodestone Racing", car = "12",  points =  23, wins = 0),
        DriverStanding(position = 24, name = "Michael Epps",     team = "RCIB Insurance Racing", car = "12",  points =  23, wins = 0),
        DriverStanding(position = 25, name = "James Cole",        team = "Silverline Subaru BMR Racing", car = "20",  points =  16, wins = 0),
        DriverStanding(position = 26, name = "Ollie Jackson",     team = "AmD Tuning", car = "48",  points =  14, wins = 0),
        DriverStanding(position = 27, name = "Warren Scott",     team = "Silverline Subaru BMR Racing", car = "",   points =   7, wins = 0),
        DriverStanding(position = 28, name = "Alex Martin",       team = "Dextra Racing with Team Parker", car = "",   points =   3, wins = 0),
        DriverStanding(position = 29, name = "Matt Simpson",      team = "Speedworks Motorsport", car = "303", points =   1, wins = 0),
        DriverStanding(position = 30, name = "Chris Smiley",      team = "TLC Racing", car = "22",  points =   0, wins = 0),
        DriverStanding(position = 31, name = "Stewart Lines",     team = "Maximum Motorsport", car = "12",  points =   0, wins = 0),
        DriverStanding(position = 32, name = "Kelvin Fletcher",   team = "Power Maxed Racing", car = "",   points =   0, wins = 0),
        DriverStanding(position = 33, name = "Michael Caine",     team = "TLC Racing", car = "",   points =   0, wins = 0),
        DriverStanding(position = 34, name = "Andy Neate",        team = "Halfords Yuasa Racing", car = "",   points =   0, wins = 0),
        DriverStanding(position = 35, name = "Tony Gilham",       team = "TLC Racing", car = "",   points =   0, wins = 0),
        DriverStanding(position = 36, name = "Mark Howard",       team = "Team BKR", car = "",   points =  -3, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Team JCT600 with GardX",       points = 574),
        TeamStanding(position = 2, name = "Halfords Yuasa Racing",        points = 557),
        TeamStanding(position = 3, name = "Motorbase Performance",        points = 538),
        TeamStanding(position = 4, name = "Silverline Subaru BMR Racing",  points = 531),
        TeamStanding(position = 5, name = "MG Racing RCIB Insurance",      points = 332),
        TeamStanding(position = 6, name = "WIX Racing",                   points = 234),
        TeamStanding(position = 7, name = "Speedworks Motorsport",        points = 202),
        TeamStanding(position = 8, name = "Team IHG Rewards Club",        points = 192),
        TeamStanding(position = 9, name = "Laser Tools Racing",           points = 137),
        TeamStanding(position = 10, name = "Handy Motorsport",             points = 136),
        TeamStanding(position = 11, name = "RCIB Insurance Racing",        points = 116),
        TeamStanding(position = 12, name = "Team BKR",                     points = 110),
        TeamStanding(position = 13, name = "Eurotech Racing",             points = 105),
        TeamStanding(position = 14, name = "Power Maxed Racing",          points = 68),
        TeamStanding(position = 15, name = "Goodestone Racing",           points = 26),
        TeamStanding(position = 16, name = "AmD Tuning",                  points = 16),
        TeamStanding(position = 17, name = "Dextra Racing with Team Parker", points = 5),
        TeamStanding(position = 18, name = "TLC Racing",                  points = 1),
        TeamStanding(position = 19, name = "Maximum Motorsport",          points = 0),
    )
}
