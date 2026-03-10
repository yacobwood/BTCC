package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2018 BTCC standings — computed from race results (approximate points). */
object Standings2018 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Colin Turkington",  team = "", car = "2",   points = 286, wins = 1),
        DriverStanding(position =  2, name = "Dan Cammish",       team = "", car = "27",  points = 323, wins = 3),
        DriverStanding(position =  3, name = "Sam Tordoff",       team = "", car = "600", points = 275, wins = 2),
        DriverStanding(position =  4, name = "Jack Goff",         team = "", car = "31",  points = 274, wins = 5),
        DriverStanding(position =  5, name = "Andrew Jordan",     team = "", car = "77",  points = 252, wins = 1),
        DriverStanding(position =  6, name = "Tom Chilton",       team = "", car = "3",   points = 246, wins = 0),
        DriverStanding(position =  7, name = "Matt Neal",         team = "", car = "25",  points = 241, wins = 2),
        DriverStanding(position =  8, name = "Ashley Sutton",     team = "", car = "1",   points = 238, wins = 5),
        DriverStanding(position =  9, name = "Tom Ingram",        team = "", car = "80",  points = 220, wins = 2),
        DriverStanding(position = 10, name = "Adam Morgan",       team = "", car = "33",  points = 200, wins = 2),
        DriverStanding(position = 11, name = "Josh Cook",         team = "", car = "66",  points = 194, wins = 3),
        DriverStanding(position = 12, name = "Brett Smith",       team = "", car = "39",  points = 167, wins = 1),
        DriverStanding(position = 13, name = "Chris Smiley",      team = "", car = "22",  points = 165, wins = 0),
        DriverStanding(position = 14, name = "Matt Simpson",      team = "", car = "303", points = 145, wins = 2),
        DriverStanding(position = 15, name = "Senna Proctor",     team = "", car = "18",  points = 132, wins = 1),
        DriverStanding(position = 16, name = "Rob Austin",        team = "", car = "11",  points = 102, wins = 0),
        DriverStanding(position = 17, name = "Aiden Moffat",      team = "", car = "16",  points = 100, wins = 0),
        DriverStanding(position = 18, name = "Tom Oliphant",      team = "", car = "15",  points = 87,  wins = 0),
        DriverStanding(position = 19, name = "James Cole",        team = "", car = "20",  points = 80,  wins = 0),
        DriverStanding(position = 20, name = "Ricky Collard",     team = "", car = "55",  points = 67,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Honda Civic Type R",    points = 1392),
        TeamStanding(position = 2, name = "BMW 125i M Sport",      points = 692),
        TeamStanding(position = 3, name = "Ford Focus RS",         points = 601),
        TeamStanding(position = 4, name = "Mercedes-Benz A-Class", points = 387),
        TeamStanding(position = 5, name = "Vauxhall Astra",        points = 326),
        TeamStanding(position = 6, name = "Subaru Levorg GT",      points = 290),
        TeamStanding(position = 7, name = "Toyota Avensis",        points = 220),
        TeamStanding(position = 8, name = "Alfa Romeo Giulietta",  points = 102),
    )
}
