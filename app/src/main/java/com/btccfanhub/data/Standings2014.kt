package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2014 BTCC standings — computed from race results (approximate points). */
object Standings2014 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Colin Turkington",   team = "", car = "5",   points = 502, wins = 9),
        DriverStanding(position =  2, name = "Jason Plato",        team = "", car = "99",  points = 535, wins = 10),
        DriverStanding(position =  3, name = "Gordon Shedden",     team = "", car = "52",  points = 366, wins = 1),
        DriverStanding(position =  4, name = "Sam Tordoff",        team = "", car = "88",  points = 353, wins = 2),
        DriverStanding(position =  5, name = "Andrew Jordan",      team = "", car = "1",   points = 315, wins = 5),
        DriverStanding(position =  6, name = "Mat Jackson",        team = "", car = "6",   points = 270, wins = 1),
        DriverStanding(position =  7, name = "Robert Collard",     team = "", car = "10",  points = 246, wins = 0),
        DriverStanding(position =  8, name = "Matt Neal",          team = "", car = "4",   points = 244, wins = 1),
        DriverStanding(position =  9, name = "Adam Morgan",        team = "", car = "33",  points = 178, wins = 1),
        DriverStanding(position = 10, name = "Alain Menu",         team = "", car = "9",   points = 165, wins = 0),
        DriverStanding(position = 11, name = "Tom Ingram",         team = "", car = "80",  points = 163, wins = 0),
        DriverStanding(position = 12, name = "Rob Austin",         team = "", car = "101", points = 160, wins = 0),
        DriverStanding(position = 13, name = "Aron Taylor-Smith",  team = "", car = "40",  points = 156, wins = 0),
        DriverStanding(position = 14, name = "Fabrizio Giovanardi",team = "", car = "7",   points = 134, wins = 0),
        DriverStanding(position = 15, name = "Jack Goff",          team = "", car = "31",  points = 96,  wins = 0),
        DriverStanding(position = 16, name = "Nick Foster",        team = "", car = "18",  points = 87,  wins = 0),
        DriverStanding(position = 17, name = "Marc Hynes",         team = "", car = "888", points = 81,  wins = 0),
        DriverStanding(position = 18, name = "Dave Newsham",       team = "", car = "17",  points = 39,  wins = 0),
        DriverStanding(position = 19, name = "Jack Clarke",        team = "", car = "44",  points = 28,  wins = 0),
        DriverStanding(position = 20, name = "Hunter Abbott",      team = "", car = "54",  points = 20,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "MG6 GT",                points = 969),
        TeamStanding(position = 2, name = "BMW 125i M Sport",      points = 835),
        TeamStanding(position = 3, name = "Honda Civic Tourer",    points = 610),
        TeamStanding(position = 4, name = "Ford Focus ST",         points = 471),
        TeamStanding(position = 5, name = "Volkswagen CC",         points = 378),
        TeamStanding(position = 6, name = "Honda Civic",           points = 326),
        TeamStanding(position = 7, name = "Toyota Avensis",        points = 191),
        TeamStanding(position = 8, name = "Audi A4",               points = 180),
    )
}
