package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2017 BTCC standings — computed from race results (approximate points). */
object Standings2017 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton",     team = "", car = "116", points = 421, wins = 7),
        DriverStanding(position =  2, name = "Colin Turkington",  team = "", car = "4",   points = 352, wins = 2),
        DriverStanding(position =  3, name = "Tom Ingram",        team = "", car = "80",  points = 350, wins = 3),
        DriverStanding(position =  4, name = "Jack Goff",         team = "", car = "31",  points = 319, wins = 4),
        DriverStanding(position =  5, name = "Gordon Shedden",    team = "", car = "52",  points = 301, wins = 1),
        DriverStanding(position =  6, name = "Matt Neal",         team = "", car = "25",  points = 291, wins = 3),
        DriverStanding(position =  7, name = "Robert Collard",    team = "", car = "5",   points = 240, wins = 1),
        DriverStanding(position =  8, name = "Adam Morgan",       team = "", car = "33",  points = 198, wins = 0),
        DriverStanding(position =  9, name = "Mat Jackson",       team = "", car = "3",   points = 195, wins = 0),
        DriverStanding(position = 10, name = "Rob Austin",        team = "", car = "11",  points = 183, wins = 1),
        DriverStanding(position = 11, name = "Jason Plato",       team = "", car = "99",  points = 164, wins = 2),
        DriverStanding(position = 12, name = "Andrew Jordan",     team = "", car = "77",  points = 157, wins = 1),
        DriverStanding(position = 13, name = "Aiden Moffat",      team = "", car = "16",  points = 157, wins = 2),
        DriverStanding(position = 14, name = "Tom Chilton",       team = "", car = "2",   points = 107, wins = 0),
        DriverStanding(position = 15, name = "Josh Cook",         team = "", car = "66",  points = 107, wins = 0),
        DriverStanding(position = 16, name = "James Cole",        team = "", car = "20",  points = 103, wins = 2),
        DriverStanding(position = 17, name = "Jeff Smith",        team = "", car = "55",  points = 71,  wins = 1),
        DriverStanding(position = 18, name = "Jake Hill",         team = "", car = "24",  points = 68,  wins = 0),
        DriverStanding(position = 19, name = "Dave Newsham",      team = "", car = "17",  points = 68,  wins = 0),
        DriverStanding(position = 20, name = "Michael Epps",      team = "", car = "12",  points = 67,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Honda Civic Type R",    points = 1038),
        TeamStanding(position = 2, name = "BMW 125i M Sport",      points = 749),
        TeamStanding(position = 3, name = "Subaru Levorg GT",      points = 707),
        TeamStanding(position = 4, name = "Toyota Avensis",        points = 533),
        TeamStanding(position = 5, name = "Mercedes-Benz A-Class", points = 355),
        TeamStanding(position = 6, name = "Ford Focus ST",         points = 222),
        TeamStanding(position = 7, name = "Vauxhall Astra",        points = 167),
        TeamStanding(position = 8, name = "MG6 GT",                points = 141),
    )
}
