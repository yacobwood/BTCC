package com.btcchub.data

import com.btcchub.data.model.DriverStanding
import com.btcchub.data.model.TeamStanding

/** Final 2024 BTCC Drivers' Championship standings (Wikipedia). */
object Standings2024 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Jake Hill",          team = "Laser Tools Racing with MB Motorsport", car = "24",  points = 421, wins = 8),
        DriverStanding(position =  2, name = "Tom Ingram",        team = "Team Bristol Street Motors", car = "80",  points = 413, wins = 6),
        DriverStanding(position =  3, name = "Ashley Sutton",     team = "NAPA Racing UK", car = "1",   points = 365, wins = 3),
        DriverStanding(position =  4, name = "Colin Turkington",  team = "Team BMW", car = "4",   points = 346, wins = 5),
        DriverStanding(position =  5, name = "Dan Cammish",       team = "NAPA Racing UK", car = "27",  points = 346, wins = 1),
        DriverStanding(position =  6, name = "Josh Cook",         team = "LKQ Euro Car Parts with SYNETIQ", car = "66",  points = 327, wins = 2),
        DriverStanding(position =  7, name = "Árón Taylor-Smith", team = "Evans Halshaw Power Maxed Racing", car = "40",  points = 224, wins = 0),
        DriverStanding(position =  8, name = "Adam Morgan",       team = "Team BMW", car = "33",  points = 201, wins = 0),
        DriverStanding(position =  9, name = "Rob Huff",          team = "Toyota Gazoo Racing UK", car = "12",  points = 195, wins = 2),
        DriverStanding(position = 10, name = "Tom Chilton",       team = "Team Bristol Street Motors", car = "3",   points = 187, wins = 0),
        DriverStanding(position = 11, name = "Daniel Rowbottom",   team = "NAPA Racing UK", car = "32",  points = 186, wins = 0),
        DriverStanding(position = 12, name = "Mikey Doble",      team = "Evans Halshaw Power Maxed Racing", car = "88",  points = 148, wins = 0),
        DriverStanding(position = 13, name = "Aiden Moffat",       team = "Toyota Gazoo Racing UK", car = "16",  points = 137, wins = 1),
        DriverStanding(position = 14, name = "Andrew Watson",      team = "Toyota Gazoo Racing UK", car = "11",  points = 120, wins = 0),
        DriverStanding(position = 15, name = "Sam Osborne",      team = "NAPA Racing UK", car = "77",  points =  93, wins = 0),
        DriverStanding(position = 16, name = "Ronan Pearson",     team = "Team Bristol Street Motors", car = "14",  points =  77, wins = 0),
        DriverStanding(position = 17, name = "Chris Smiley",     team = "Restart Racing", car = "22",  points =  70, wins = 0),
        DriverStanding(position = 18, name = "Daryl DeLeon",      team = "Duckhams Racing with Bartercard", car = "18",  points =  48, wins = 0),
        DriverStanding(position = 19, name = "Dan Zelos",        team = "Team Bristol Street Motors", car = "26",  points =  44, wins = 0),
        DriverStanding(position = 20, name = "Bobby Thompson",     team = "Zeus Cloud Racing with WSR", car = "19",  points =  34, wins = 0),
        DriverStanding(position = 21, name = "Scott Sumpton",     team = "Restart Racing", car = "40",  points =  20, wins = 0),
        DriverStanding(position = 22, name = "Nick Halstead",     team = "Team Bristol Street Motors", car = "22",  points =   7, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK",                     points = 724),
        TeamStanding(position = 2, name = "Team Bristol Street Motors",          points = 609),
        TeamStanding(position = 3, name = "Team BMW",                            points = 560),
        TeamStanding(position = 4, name = "LKQ Euro Car Parts with SYNETIQ",     points = 497),
        TeamStanding(position = 5, name = "Evans Halshaw Power Maxed Racing",   points = 427),
        TeamStanding(position = 6, name = "Laser Tools Racing with MB Motorsport", points = 412),
        TeamStanding(position = 7, name = "Toyota Gazoo Racing UK",               points = 367),
        TeamStanding(position = 8, name = "Restart Racing",                      points = 181),
        TeamStanding(position = 9, name = "Duckhams Racing with Bartercard",    points = 85),
        TeamStanding(position = 10, name = "Zeus Cloud Racing with WSR",         points = 34),
    )
}
