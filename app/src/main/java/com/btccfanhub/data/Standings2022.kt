package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2022 BTCC standings — computed from race results (approximate points). */
object Standings2022 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Tom Ingram",        team = "", car = "80",  points = 442, wins = 7),
        DriverStanding(position =  2, name = "Jake Hill",         team = "", car = "24",  points = 465, wins = 4),
        DriverStanding(position =  3, name = "Colin Turkington",  team = "", car = "50",  points = 398, wins = 5),
        DriverStanding(position =  4, name = "Ashley Sutton",     team = "", car = "1",   points = 392, wins = 2),
        DriverStanding(position =  5, name = "Rory Butcher",      team = "", car = "6",   points = 299, wins = 2),
        DriverStanding(position =  6, name = "Dan Cammish",       team = "", car = "9",   points = 262, wins = 2),
        DriverStanding(position =  7, name = "Josh Cook",         team = "", car = "66",  points = 256, wins = 5),
        DriverStanding(position =  8, name = "Gordon Shedden",    team = "", car = "52",  points = 247, wins = 1),
        DriverStanding(position =  9, name = "Adam Morgan",       team = "", car = "33",  points = 222, wins = 0),
        DriverStanding(position = 10, name = "Daniel Rowbottom",  team = "", car = "32",  points = 191, wins = 0),
        DriverStanding(position = 11, name = "Daniel Lloyd",      team = "", car = "123", points = 184, wins = 2),
        DriverStanding(position = 12, name = "Stephen Jelley",    team = "", car = "12",  points = 183, wins = 0),
        DriverStanding(position = 13, name = "George Gamble",     team = "", car = "42",  points = 123, wins = 0),
        DriverStanding(position = 14, name = "Bobby Thompson",    team = "", car = "19",  points = 90,  wins = 0),
        DriverStanding(position = 15, name = "Ricky Collard",     team = "", car = "21",  points = 84,  wins = 0),
        DriverStanding(position = 16, name = "Tom Chilton",       team = "", car = "3",   points = 83,  wins = 0),
        DriverStanding(position = 17, name = "Jason Plato",       team = "", car = "11",  points = 80,  wins = 0),
        DriverStanding(position = 18, name = "Ash Hand",          team = "", car = "97",  points = 56,  wins = 0),
        DriverStanding(position = 19, name = "Aiden Moffat",      team = "", car = "16",  points = 52,  wins = 0),
        DriverStanding(position = 20, name = "Michael Crees",     team = "", car = "777", points = 43,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "BMW 330e M Sport",        points = 1391),
        TeamStanding(position = 2, name = "Honda Civic Type R",      points = 775),
        TeamStanding(position = 3, name = "Hyundai i30N",            points = 712),
        TeamStanding(position = 4, name = "Ford Focus ST Mk 4",      points = 670),
        TeamStanding(position = 5, name = "Toyota Corolla GR Sport", points = 383),
        TeamStanding(position = 6, name = "Cupra Leon",              points = 106),
        TeamStanding(position = 7, name = "Vauxhall Astra",          points = 99),
        TeamStanding(position = 8, name = "Infiniti Q50",            points = 64),
    )
}
