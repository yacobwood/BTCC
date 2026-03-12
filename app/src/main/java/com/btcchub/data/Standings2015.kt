package com.btcchub.data

import com.btcchub.data.model.DriverStanding
import com.btcchub.data.model.TeamStanding

/** Final 2015 BTCC standings — Drivers' Championship per Wikipedia. */
object Standings2015 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Gordon Shedden",    team = "Honda Yuasa Racing", car = "52",  points = 348, wins = 4),
        DriverStanding(position =  2, name = "Jason Plato",       team = "Team BMR RCIB Insurance", car = "99",  points = 344, wins = 6),
        DriverStanding(position =  3, name = "Matt Neal",         team = "Honda Yuasa Racing", car = "25",  points = 317, wins = 3),
        DriverStanding(position =  4, name = "Colin Turkington",  team = "Team BMR RCIB Insurance", car = "1",   points = 310, wins = 4),
        DriverStanding(position =  5, name = "Andrew Jordan",     team = "MG Triple Eight Racing", car = "77",  points = 274, wins = 0),
        DriverStanding(position =  6, name = "Sam Tordoff",       team = "Team JCT600 with GardX", car = "7",   points = 270, wins = 2),
        DriverStanding(position =  7, name = "Adam Morgan",       team = "WIX Racing", car = "33",  points = 267, wins = 1),
        DriverStanding(position =  8, name = "Andy Priaulx",       team = "Team JCT600 with GardX", car = "111", points = 256, wins = 2),
        DriverStanding(position =  9, name = "Jack Goff",          team = "MG Triple Eight Racing", car = "31",  points = 252, wins = 1),
        DriverStanding(position = 10, name = "Rob Collard",        team = "Team JCT600 with GardX", car = "6",   points = 226, wins = 3),
        DriverStanding(position = 11, name = "Árón Smith",         team = "Team BMR RCIB Insurance", car = "40",  points = 209, wins = 0),
        DriverStanding(position = 12, name = "Mat Jackson",       team = "Motorbase Performance", car = "4",   points = 200, wins = 4),
        DriverStanding(position = 13, name = "Tom Ingram",         team = "Speedworks Motorsport", car = "80",  points = 163, wins = 0),
        DriverStanding(position = 14, name = "Rob Austin",         team = "Exocet AlcoSense Racing", car = "101", points = 120, wins = 0),
        DriverStanding(position = 15, name = "Josh Cook",          team = "Power Maxed Racing", car = "66",  points = 95,  wins = 0),
        DriverStanding(position = 16, name = "Dave Newsham",      team = "Power Maxed Racing", car = "17",  points = 95,  wins = 0),
        DriverStanding(position = 17, name = "Aiden Moffat",       team = "Laser Tools Racing", car = "16",  points = 77,  wins = 0),
        DriverStanding(position = 18, name = "Martin Depper",     team = "Eurotech Racing", car = "30",  points = 53,  wins = 0),
        DriverStanding(position = 19, name = "James Cole",         team = "Motorbase Performance", car = "44",  points = 32,  wins = 0),
        DriverStanding(position = 20, name = "Jeff Smith",         team = "Eurotech Racing", car = "55",  points = 31,  wins = 0),
        DriverStanding(position = 21, name = "Hunter Abbott",       team = "Exocet AlcoSense Racing", car = "54",  points = 23,  wins = 0),
        DriverStanding(position = 22, name = "Warren Scott",      team = "Team BMR RCIB Insurance", car = "39",  points = 23,  wins = 0),
        DriverStanding(position = 23, name = "Mike Bushell",       team = "AmD Tuning", car = "12",  points = 14,  wins = 0),
        DriverStanding(position = 24, name = "Nick Foster",         team = "Team JCT600 with GardX", car = "18",  points = 4,   wins = 0),
        DriverStanding(position = 25, name = "Barry Horne",        team = "Dextra Racing", car = "114", points = 3,   wins = 0),
        DriverStanding(position = 26, name = "Robb Holland",       team = "Handy Motorsport", car = "67",  points = 2,   wins = 0),
        DriverStanding(position = 27, name = "Simon Belcher",      team = "Handy Motorsport", car = "11",  points = 1,   wins = 0),
        DriverStanding(position = 28, name = "Daniel Welch",       team = "Welch Motorsport", car = "12",  points = 1,   wins = 0),
        DriverStanding(position = 29, name = "Kieran Gallagher",    team = "RCIB Insurance Racing", car = "24",  points = 1,   wins = 0),
        DriverStanding(position = 30, name = "Tony Gilham",        team = "RCIB Insurance Racing", car = "34",  points = 1,   wins = 0),
        DriverStanding(position = 31, name = "Alain Menu",         team = "Team BMR RCIB Insurance", car = "9",   points = 1,   wins = 0),
        DriverStanding(position = 32, name = "Alex Martin",        team = "Dextra Racing", car = "27",  points = 0,   wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Team BMR RCIB Insurance",     points = 733),
        TeamStanding(position = 2, name = "Honda Yuasa Racing",           points = 657),
        TeamStanding(position = 3, name = "MG Triple Eight Racing",     points = 518),
        TeamStanding(position = 4, name = "Team JCT600 with GardX",      points = 470),
        TeamStanding(position = 5, name = "WIX Racing",                  points = 267),
        TeamStanding(position = 6, name = "Team IHG Rewards Club",        points = 246),
        TeamStanding(position = 7, name = "Motorbase Performance",        points = 223),
        TeamStanding(position = 8, name = "Power Maxed Racing",            points = 209),
        TeamStanding(position = 9, name = "Speedworks Motorsport",       points = 183),
        TeamStanding(position = 10, name = "Exocet AlcoSense Racing",    points = 152),
        TeamStanding(position = 11, name = "Eurotech Racing",             points = 95),
        TeamStanding(position = 12, name = "Laser Tools Racing",         points = 87),
        TeamStanding(position = 13, name = "AmD Tuning",                points = 16),
        TeamStanding(position = 14, name = "Dextra Racing",              points = 8),
        TeamStanding(position = 15, name = "Handy Motorsport",          points = 5),
        TeamStanding(position = 16, name = "Houseman Racing",           points = 3),
        TeamStanding(position = 17, name = "Support Our Paras Racing",  points = 1),
        TeamStanding(position = 18, name = "RCIB Insurance Racing",      points = 1),
        TeamStanding(position = 19, name = "Welch Motorsport",           points = 0),
    )
}
