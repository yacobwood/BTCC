package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2015 BTCC standings — computed from race results (approximate points). */
object Standings2015 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Gordon Shedden",    team = "", car = "52",  points = 403, wins = 4),
        DriverStanding(position =  2, name = "Colin Turkington",  team = "", car = "1",   points = 352, wins = 5),
        DriverStanding(position =  3, name = "Jason Plato",       team = "", car = "99",  points = 351, wins = 5),
        DriverStanding(position =  4, name = "Andy Priaulx",      team = "", car = "111", points = 311, wins = 4),
        DriverStanding(position =  5, name = "Matt Neal",         team = "", car = "25",  points = 292, wins = 0),
        DriverStanding(position =  6, name = "Aron Taylor-Smith", team = "", car = "40",  points = 286, wins = 1),
        DriverStanding(position =  7, name = "Andrew Jordan",     team = "", car = "77",  points = 272, wins = 0),
        DriverStanding(position =  8, name = "Adam Morgan",       team = "", car = "33",  points = 269, wins = 0),
        DriverStanding(position =  9, name = "Sam Tordoff",       team = "", car = "7",   points = 268, wins = 2),
        DriverStanding(position = 10, name = "Mat Jackson",       team = "", car = "4",   points = 261, wins = 7),
        DriverStanding(position = 11, name = "Jack Goff",         team = "", car = "31",  points = 239, wins = 0),
        DriverStanding(position = 12, name = "Robert Collard",    team = "", car = "6",   points = 221, wins = 2),
        DriverStanding(position = 13, name = "Tom Ingram",        team = "", car = "80",  points = 170, wins = 0),
        DriverStanding(position = 14, name = "Rob Austin",        team = "", car = "101", points = 110, wins = 0),
        DriverStanding(position = 15, name = "Dave Newsham",      team = "", car = "17",  points = 103, wins = 0),
        DriverStanding(position = 16, name = "Josh Cook",         team = "", car = "66",  points = 96,  wins = 0),
        DriverStanding(position = 17, name = "Aiden Moffat",      team = "", car = "16",  points = 54,  wins = 0),
        DriverStanding(position = 18, name = "Martin Depper",     team = "", car = "30",  points = 39,  wins = 0),
        DriverStanding(position = 19, name = "James Cole",        team = "", car = "44",  points = 26,  wins = 0),
        DriverStanding(position = 20, name = "Hunter Abbott",     team = "", car = "54",  points = 19,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Volkswagen CC",         points = 1014),
        TeamStanding(position = 2, name = "BMW 125i M Sport",      points = 800),
        TeamStanding(position = 3, name = "Honda Civic Type R",    points = 695),
        TeamStanding(position = 4, name = "MG6 GT",                points = 511),
        TeamStanding(position = 5, name = "Mercedes-Benz A-Class", points = 323),
        TeamStanding(position = 6, name = "Ford Focus ST",         points = 306),
        TeamStanding(position = 7, name = "Chevrolet Cruze",       points = 199),
        TeamStanding(position = 8, name = "Toyota Avensis",        points = 173),
    )
}
