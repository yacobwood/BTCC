package com.btcchub.data

import com.btcchub.data.model.DriverStanding
import com.btcchub.data.model.TeamStanding

/** Final 2023 BTCC Drivers' Championship standings (Wikipedia). */
object Standings2023 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton",      team = "NAPA Racing UK", car = "116", points = 446, wins = 12),
        DriverStanding(position =  2, name = "Tom Ingram",        team = "Bristol Street Motors with Excelr8", car = "1",   points = 400, wins = 2),
        DriverStanding(position =  3, name = "Jake Hill",         team = "Laser Tools Racing with MB Motorsport", car = "24",  points = 373, wins = 6),
        DriverStanding(position =  4, name = "Colin Turkington",  team = "Team BMW", car = "4",   points = 312, wins = 4),
        DriverStanding(position =  5, name = "Josh Cook",         team = "One Motorsport with Starline Racing", car = "66",  points = 268, wins = 0),
        DriverStanding(position =  6, name = "Dan Cammish",       team = "NAPA Racing UK", car = "27",  points = 253, wins = 3),
        DriverStanding(position =  7, name = "Daniel Rowbottom",  team = "NAPA Racing UK", car = "32",  points = 226, wins = 1),
        DriverStanding(position =  8, name = "Ricky Collard",     team = "TOYOTA GAZOO Racing UK", car = "37",  points = 217, wins = 0),
        DriverStanding(position =  9, name = "Adam Morgan",        team = "Team BMW", car = "33",  points = 199, wins = 0),
        DriverStanding(position = 10, name = "Rory Butcher",      team = "Laser Tools Racing with MB Motorsport", car = "6",   points = 173, wins = 1),
        DriverStanding(position = 11, name = "Árón Taylor-Smith", team = "CarStore Power Maxed Racing", car = "40",  points = 165, wins = 0),
        DriverStanding(position = 12, name = "Stephen Jelley",     team = "Team BMW", car = "12",  points = 141, wins = 0),
        DriverStanding(position = 13, name = "Daniel Lloyd",     team = "Re. Beverages and Bartercard with Team HARD", car = "123", points = 111, wins = 0),
        DriverStanding(position = 14, name = "Tom Chilton",       team = "Bristol Street Motors with Excelr8", car = "3",   points =  97, wins = 1),
        DriverStanding(position = 15, name = "Andrew Watson",      team = "CarStore Power Maxed Racing", car = "11",  points =  93, wins = 0),
        DriverStanding(position = 16, name = "Aiden Moffat",      team = "One Motorsport with Starline Racing", car = "16",  points =  87, wins = 0),
        DriverStanding(position = 17, name = "Bobby Thompson",    team = "Autobrite Direct with Millers Oils", car = "19",  points =  75, wins = 0),
        DriverStanding(position = 18, name = "Ronan Pearson",     team = "Bristol Street Motors with Excelr8", car = "14",  points =  69, wins = 0),
        DriverStanding(position = 19, name = "Sam Osborne",       team = "NAPA Racing UK", car = "77",  points =  65, wins = 0),
        DriverStanding(position = 20, name = "Mikey Doble",       team = "CarStore Power Maxed Racing", car = "88",  points =  63, wins = 0),
        DriverStanding(position = 21, name = "George Gamble",     team = "TOYOTA GAZOO Racing UK", car = "42",  points =  56, wins = 0),
        DriverStanding(position = 22, name = "Dexter Patterson",  team = "Re. Beverages and Bartercard with Team HARD", car = "14",  points =  41, wins = 0),
        DriverStanding(position = 23, name = "Michael Crees",     team = "Re. Beverages and Bartercard with Team HARD", car = "777", points =  13, wins = 0),
        DriverStanding(position = 24, name = "Nicolas Hamilton",   team = "Go-Fix with Autoaid Breakdown", car = "28",  points =  10, wins = 0),
        DriverStanding(position = 25, name = "Daryl DeLeon",      team = "Re. Beverages and Bartercard with Team HARD", car = "18",  points =   6, wins = 0),
        DriverStanding(position = 26, name = "Robert Huff",       team = "Go-Fix with Autoaid Breakdown", car = "12",  points =   5, wins = 0),
        DriverStanding(position = 27, name = "James Gornall",     team = "Go-Fix with Autoaid Breakdown", car = "41",  points =   1, wins = 0),
        DriverStanding(position = 28, name = "Jack Butel",        team = "Go-Fix with Autoaid Breakdown", car = "96",  points =   0, wins = 0),
        DriverStanding(position = 29, name = "Will Powell",        team = "One Motorsport with Starline Racing", car = "20",  points =   0, wins = 0),
        DriverStanding(position = 30, name = "Nick Halstead",      team = "Bristol Street Motors with Excelr8", car = "22",  points =   0, wins = 0),
        DriverStanding(position = 31, name = "Jade Edwards",      team = "One Motorsport with Starline Racing", car = "9",   points =   0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK",                           points = 713),
        TeamStanding(position = 2, name = "Bristol Street Motors with Excelr8",       points = 564),
        TeamStanding(position = 3, name = "Team BMW",                                  points = 559),
        TeamStanding(position = 4, name = "One Motorsport with Starline Racing",      points = 426),
        TeamStanding(position = 5, name = "TOYOTA GAZOO Racing UK",                   points = 420),
        TeamStanding(position = 6, name = "Laser Tools Racing with MB Motorsport",     points = 381),
        TeamStanding(position = 7, name = "CarStore Power Maxed Racing",              points = 342),
        TeamStanding(position = 8, name = "Autobrite Direct with Millers Oils",       points = 267),
        TeamStanding(position = 9, name = "Re. Beverages and Bartercard with Team HARD", points = 113),
        TeamStanding(position = 10, name = "Go-Fix with Autoaid Breakdown",            points = 66),
    )
}
