package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2016 BTCC standings — computed from race results (approximate points). */
object Standings2016 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Gordon Shedden",    team = "", car = "52",  points = 327, wins = 4),
        DriverStanding(position =  2, name = "Colin Turkington",  team = "", car = "4",   points = 380, wins = 8),
        DriverStanding(position =  3, name = "Tom Ingram",        team = "", car = "80",  points = 322, wins = 4),
        DriverStanding(position =  4, name = "Jason Plato",       team = "", car = "99",  points = 285, wins = 2),
        DriverStanding(position =  5, name = "Sam Tordoff",       team = "", car = "600", points = 277, wins = 2),
        DriverStanding(position =  6, name = "Mat Jackson",       team = "", car = "7",   points = 272, wins = 2),
        DriverStanding(position =  7, name = "Matt Neal",         team = "", car = "25",  points = 251, wins = 1),
        DriverStanding(position =  8, name = "Andrew Jordan",     team = "", car = "77",  points = 246, wins = 2),
        DriverStanding(position =  9, name = "Adam Morgan",       team = "", car = "33",  points = 236, wins = 1),
        DriverStanding(position = 10, name = "Ashley Sutton",     team = "", car = "116", points = 217, wins = 2),
        DriverStanding(position = 11, name = "Josh Cook",         team = "", car = "66",  points = 206, wins = 0),
        DriverStanding(position = 12, name = "Robert Collard",    team = "", car = "100", points = 200, wins = 2),
        DriverStanding(position = 13, name = "Jack Goff",         team = "", car = "31",  points = 197, wins = 0),
        DriverStanding(position = 14, name = "Aron Taylor-Smith", team = "", car = "40",  points = 137, wins = 0),
        DriverStanding(position = 15, name = "Rob Austin",        team = "", car = "11",  points = 123, wins = 0),
        DriverStanding(position = 16, name = "Aiden Moffat",      team = "", car = "16",  points = 117, wins = 0),
        DriverStanding(position = 17, name = "Hunter Abbott",     team = "", car = "54",  points = 79,  wins = 0),
        DriverStanding(position = 18, name = "Jake Hill",         team = "", car = "24",  points = 66,  wins = 0),
        DriverStanding(position = 19, name = "Daniel Lloyd",      team = "", car = "23",  points = 66,  wins = 0),
        DriverStanding(position = 20, name = "Jeff Smith",        team = "", car = "55",  points = 59,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Honda Civic Type R",    points = 733),
        TeamStanding(position = 2, name = "Subaru Levorg GT",      points = 692),
        TeamStanding(position = 3, name = "BMW 125i M Sport",      points = 674),
        TeamStanding(position = 4, name = "Toyota Avensis",        points = 526),
        TeamStanding(position = 5, name = "Ford Focus ST",         points = 518),
        TeamStanding(position = 6, name = "MG6 GT",                points = 423),
        TeamStanding(position = 7, name = "Mercedes-Benz A-Class", points = 353),
        TeamStanding(position = 8, name = "Volkswagen CC",         points = 137),
    )
}
