package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2017 BTCC Drivers' Championship standings (Wikipedia). */
object Standings2017 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton",       team = "Adrian Flux Subaru Racing", car = "116", points = 372, wins = 6),
        DriverStanding(position =  2, name = "Colin Turkington",    team = "Team BMW", car = "4",   points = 351, wins = 4),
        DriverStanding(position =  3, name = "Tom Ingram",          team = "Speedworks Motorsport", car = "80",  points = 311, wins = 4),
        DriverStanding(position =  4, name = "Gordon Shedden",      team = "Halfords Yuasa Racing", car = "52",  points = 309, wins = 3),
        DriverStanding(position =  5, name = "Rob Collard",          team = "BMW Pirtek Racing", car = "5",   points = 256, wins = 1),
        DriverStanding(position =  6, name = "Jack Goff",           team = "Eurotech Racing", car = "31",  points = 245, wins = 1),
        DriverStanding(position =  7, name = "Matt Neal",           team = "Halfords Yuasa Racing", car = "25",  points = 243, wins = 2),
        DriverStanding(position =  8, name = "Mat Jackson",         team = "Team Shredded Wheat Racing with DUO", car = "3",   points = 210, wins = 1),
        DriverStanding(position =  9, name = "Andrew Jordan",        team = "BMW Pirtek Racing", car = "77",  points = 203, wins = 3),
        DriverStanding(position = 10, name = "Adam Morgan",         team = "Ciceley Motorsport with MAC Tools", car = "33",  points = 187, wins = 0),
        DriverStanding(position = 11, name = "Rob Austin",         team = "Handy Motorsport", car = "11",  points = 174, wins = 1),
        DriverStanding(position = 12, name = "Jason Plato",         team = "Adrian Flux Subaru Racing", car = "99",  points = 146, wins = 1),
        DriverStanding(position = 13, name = "Aiden Moffat",        team = "Laser Tools Racing", car = "16",  points = 121, wins = 2),
        DriverStanding(position = 14, name = "Dave Newsham",        team = "BTC Norlin Racing", car = "17",  points = 108, wins = 0),
        DriverStanding(position = 15, name = "Tom Chilton",         team = "Power Maxed Racing", car = "2",   points = 105, wins = 0),
        DriverStanding(position = 16, name = "James Cole",          team = "Adrian Flux Subaru Racing", car = "20",  points =  79, wins = 1),
        DriverStanding(position = 17, name = "Michael Epps",        team = "Autoaid/RCIB Insurance Racing", car = "12",  points =  77, wins = 0),
        DriverStanding(position = 18, name = "Josh Cook",           team = "MG Racing RCIB Insurance", teamSecondary = "Team Parker Racing with Maximum Motorsport", car = "66",  points =  76, wins = 0),
        DriverStanding(position = 19, name = "Senna Proctor",       team = "Power Maxed Racing", car = "18",  points =  63, wins = 0),
        DriverStanding(position = 20, name = "Jake Hill",            team = "TAG Racing", car = "24",  points =  60, wins = 0),
        DriverStanding(position = 21, name = "Chris Smiley",         team = "BTC Norlin Racing", car = "22",  points =  45, wins = 0),
        DriverStanding(position = 22, name = "Ollie Jackson",       team = "AmDtuning.com with Cobra Exhausts", car = "48",  points =  42, wins = 0),
        DriverStanding(position = 23, name = "Ant Whorton-Eales",   team = "AmDtuning.com with Cobra Exhausts", car = "19",  points =  34, wins = 0),
        DriverStanding(position = 24, name = "Matt Simpson",        team = "Simpson Racing", car = "303", points =  30, wins = 0),
        DriverStanding(position = 25, name = "Robert Huff",          team = "Power Maxed Racing", car = "12",  points =  26, wins = 0),
        DriverStanding(position = 26, name = "Jeff Smith",          team = "Eurotech Racing", car = "55",  points =  25, wins = 0),
        DriverStanding(position = 27, name = "Árón Taylor-Smith",   team = "MG Racing RCIB Insurance", car = "40",  points =  25, wins = 0),
        DriverStanding(position = 28, name = "Martin Depper",       team = "Team Shredded Wheat Racing with DUO", car = "30",  points =  22, wins = 0),
        DriverStanding(position = 29, name = "Rory Butcher",        team = "Team Shredded Wheat Racing with DUO", car = "6",   points =  20, wins = 0),
        DriverStanding(position = 30, name = "Brett Smith",         team = "Eurotech Racing", car = "99",  points =  13, wins = 0),
        DriverStanding(position = 31, name = "Josh Price",         team = "A-Plan Academy", car = "28",  points =   9, wins = 0),
        DriverStanding(position = 32, name = "Luke Davenport",      team = "Team Shredded Wheat Racing with DUO", car = "12",  points =   6, wins = 0),
        DriverStanding(position = 33, name = "Daniel Lloyd",        team = "MG Racing RCIB Insurance", car = "26",  points =   6, wins = 0),
        DriverStanding(position = 34, name = "Stephen Jelley",      team = "Team Parker Racing with Maximum Motorsport", car = "12",  points =   2, wins = 0),
        DriverStanding(position = 35, name = "Will Burns",          team = "Autoaid/RCIB Insurance Racing", car = "23",  points =   0, wins = 0),
        DriverStanding(position = 36, name = "Dennis Strandberg",    team = "Team Parker Racing with Maximum Motorsport", car = "600", points =   0, wins = 0),
        DriverStanding(position = 37, name = "Stewart Lines",       team = "Team Parker Racing with Maximum Motorsport", car = "12",  points =   0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Team BMW",                              points = 594),
        TeamStanding(position = 2, name = "Halfords Yuasa Racing",                   points = 545),
        TeamStanding(position = 3, name = "Adrian Flux Subaru Racing",               points = 513),
        TeamStanding(position = 4, name = "Speedworks Motorsport",                   points = 307),
        TeamStanding(position = 5, name = "Eurotech Racing",                         points = 286),
        TeamStanding(position = 6, name = "Team Shredded Wheat Racing with DUO",    points = 235),
        TeamStanding(position = 7, name = "Power Maxed Racing",                      points = 201),
        TeamStanding(position = 8, name = "BMW Pirtek Racing",                       points = 200),
        TeamStanding(position = 9, name = "Ciceley Motorsport with MAC Tools",       points = 191),
        TeamStanding(position = 10, name = "Handy Motorsport",                        points = 173),
        TeamStanding(position = 11, name = "BTC Norlin Racing",                       points = 162),
        TeamStanding(position = 12, name = "Laser Tools Racing",                     points = 124),
        TeamStanding(position = 13, name = "Autoaid/RCIB Insurance Racing",         points = 82),
        TeamStanding(position = 14, name = "AmDtuning.com with Cobra Exhausts",      points = 79),
        TeamStanding(position = 15, name = "TAG Racing",                             points = 68),
        TeamStanding(position = 16, name = "MG Racing RCIB Insurance",               points = 64),
        TeamStanding(position = 17, name = "Team Parker Racing with Maximum Motorsport", points = 61),
        TeamStanding(position = 18, name = "Simpson Racing",                         points = 27),
        TeamStanding(position = 19, name = "A-Plan Academy",                         points = 8),
    )
}
