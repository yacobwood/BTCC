package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2021 BTCC standings — computed from race results (approximate points). */
object Standings2021 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton",     team = "", car = "1",   points = 346, wins = 4),
        DriverStanding(position =  2, name = "Colin Turkington",  team = "", car = "2",   points = 355, wins = 4),
        DriverStanding(position =  3, name = "Josh Cook",         team = "", car = "66",  points = 355, wins = 5),
        DriverStanding(position =  4, name = "Jake Hill",         team = "", car = "24",  points = 305, wins = 1),
        DriverStanding(position =  5, name = "Rory Butcher",      team = "", car = "6",   points = 303, wins = 4),
        DriverStanding(position =  6, name = "Tom Ingram",        team = "", car = "80",  points = 296, wins = 1),
        DriverStanding(position =  7, name = "Daniel Rowbottom",  team = "", car = "32",  points = 280, wins = 3),
        DriverStanding(position =  8, name = "Senna Proctor",     team = "", car = "18",  points = 259, wins = 3),
        DriverStanding(position =  9, name = "Gordon Shedden",    team = "", car = "52",  points = 257, wins = 2),
        DriverStanding(position = 10, name = "Aiden Moffat",      team = "", car = "16",  points = 227, wins = 2),
        DriverStanding(position = 11, name = "Daniel Lloyd",      team = "", car = "123", points = 190, wins = 0),
        DriverStanding(position = 12, name = "Tom Oliphant",      team = "", car = "15",  points = 182, wins = 1),
        DriverStanding(position = 13, name = "Adam Morgan",       team = "", car = "33",  points = 147, wins = 0),
        DriverStanding(position = 14, name = "Stephen Jelley",    team = "", car = "12",  points = 143, wins = 0),
        DriverStanding(position = 15, name = "Chris Smiley",      team = "", car = "22",  points = 136, wins = 0),
        DriverStanding(position = 16, name = "Jason Plato",       team = "", car = "11",  points = 122, wins = 0),
        DriverStanding(position = 17, name = "Ollie Jackson",     team = "", car = "48",  points = 80,  wins = 0),
        DriverStanding(position = 18, name = "Jack Goff",         team = "", car = "31",  points = 67,  wins = 0),
        DriverStanding(position = 19, name = "Tom Chilton",       team = "", car = "3",   points = 56,  wins = 0),
        DriverStanding(position = 20, name = "Dan Cammish",       team = "", car = "27",  points = 37,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Honda Civic Type R",      points = 1188),
        TeamStanding(position = 2, name = "BMW 330i M Sport",        points = 883),
        TeamStanding(position = 3, name = "Infiniti Q50",            points = 599),
        TeamStanding(position = 4, name = "Hyundai i30N",            points = 435),
        TeamStanding(position = 5, name = "Ford Focus ST Mk 4",      points = 407),
        TeamStanding(position = 6, name = "Vauxhall Astra",          points = 312),
        TeamStanding(position = 7, name = "Toyota Corolla GR Sport", points = 307),
        TeamStanding(position = 8, name = "Cupra Leon",              points = 76),
    )
}
