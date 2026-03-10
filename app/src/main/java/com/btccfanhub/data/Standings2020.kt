package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2020 BTCC standings — computed from race results (approximate points). */
object Standings2020 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton",    team = "", car = "116", points = 326, wins = 5),
        DriverStanding(position =  2, name = "Colin Turkington", team = "", car = "1",   points = 357, wins = 5),
        DriverStanding(position =  3, name = "Dan Cammish",      team = "", car = "27",  points = 344, wins = 4),
        DriverStanding(position =  4, name = "Tom Ingram",       team = "", car = "80",  points = 343, wins = 3),
        DriverStanding(position =  5, name = "Rory Butcher",     team = "", car = "6",   points = 319, wins = 4),
        DriverStanding(position =  6, name = "Jake Hill",        team = "", car = "24",  points = 243, wins = 0),
        DriverStanding(position =  7, name = "Josh Cook",        team = "", car = "66",  points = 187, wins = 3),
        DriverStanding(position =  8, name = "Tom Oliphant",     team = "", car = "15",  points = 187, wins = 0),
        DriverStanding(position =  9, name = "Matt Neal",        team = "", car = "25",  points = 175, wins = 0),
        DriverStanding(position = 10, name = "Adam Morgan",      team = "", car = "33",  points = 158, wins = 0),
        DriverStanding(position = 11, name = "Tom Chilton",      team = "", car = "3",   points = 133, wins = 0),
        DriverStanding(position = 12, name = "Ollie Jackson",    team = "", car = "48",  points = 118, wins = 0),
        DriverStanding(position = 13, name = "Senna Proctor",    team = "", car = "18",  points = 98,  wins = 0),
        DriverStanding(position = 14, name = "Chris Smiley",     team = "", car = "22",  points = 82,  wins = 0),
        DriverStanding(position = 15, name = "Stephen Jelley",   team = "", car = "12",  points = 60,  wins = 0),
        DriverStanding(position = 16, name = "Aiden Moffat",     team = "", car = "16",  points = 58,  wins = 0),
        DriverStanding(position = 17, name = "Michael Crees",    team = "", car = "777", points = 57,  wins = 0),
        DriverStanding(position = 18, name = "Bobby Thompson",   team = "", car = "19",  points = 42,  wins = 0),
        DriverStanding(position = 19, name = "Sam Osborne",      team = "", car = "4",   points = 18,  wins = 0),
        DriverStanding(position = 20, name = "Mike Bushell",     team = "", car = "21",  points = 11,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Honda Civic Type R",      points = 1157),
        TeamStanding(position = 2, name = "BMW 330i M Sport",        points = 544),
        TeamStanding(position = 3, name = "Ford Focus ST Mk 4",      points = 440),
        TeamStanding(position = 4, name = "Infiniti Q50",            points = 384),
        TeamStanding(position = 5, name = "Toyota Corolla GR Sport", points = 343),
        TeamStanding(position = 6, name = "Hyundai i30N",            points = 180),
        TeamStanding(position = 7, name = "Mercedes-Benz A-Class",   points = 158),
        TeamStanding(position = 8, name = "BMW 125i M Sport",        points = 68),
    )
}
