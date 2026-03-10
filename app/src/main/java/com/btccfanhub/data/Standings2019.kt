package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2019 BTCC standings — computed from race results (approximate points). */
object Standings2019 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Colin Turkington",  team = "", car = "1",   points = 415, wins = 8),
        DriverStanding(position =  2, name = "Dan Cammish",       team = "", car = "27",  points = 412, wins = 1),
        DriverStanding(position =  3, name = "Andrew Jordan",     team = "", car = "77",  points = 402, wins = 7),
        DriverStanding(position =  4, name = "Ashley Sutton",     team = "", car = "116", points = 259, wins = 2),
        DriverStanding(position =  5, name = "Tom Ingram",        team = "", car = "80",  points = 258, wins = 4),
        DriverStanding(position =  6, name = "Jason Plato",       team = "", car = "11",  points = 255, wins = 1),
        DriverStanding(position =  7, name = "Rory Butcher",      team = "", car = "6",   points = 238, wins = 2),
        DriverStanding(position =  8, name = "Matt Neal",         team = "", car = "25",  points = 230, wins = 0),
        DriverStanding(position =  9, name = "Sam Tordoff",       team = "", car = "600", points = 220, wins = 3),
        DriverStanding(position = 10, name = "Josh Cook",         team = "", car = "66",  points = 211, wins = 2),
        DriverStanding(position = 11, name = "Tom Oliphant",      team = "", car = "15",  points = 191, wins = 0),
        DriverStanding(position = 12, name = "Tom Chilton",       team = "", car = "3",   points = 183, wins = 0),
        DriverStanding(position = 13, name = "Chris Smiley",      team = "", car = "22",  points = 181, wins = 0),
        DriverStanding(position = 14, name = "Adam Morgan",       team = "", car = "33",  points = 138, wins = 0),
        DriverStanding(position = 15, name = "Jake Hill",         team = "", car = "24",  points = 114, wins = 0),
        DriverStanding(position = 16, name = "Robert Collard",    team = "", car = "9",   points = 92,  wins = 0),
        DriverStanding(position = 17, name = "Ollie Jackson",     team = "", car = "48",  points = 76,  wins = 0),
        DriverStanding(position = 18, name = "Senna Proctor",     team = "", car = "18",  points = 67,  wins = 0),
        DriverStanding(position = 19, name = "Stephen Jelley",    team = "", car = "12",  points = 64,  wins = 0),
        DriverStanding(position = 20, name = "Aiden Moffat",      team = "", car = "16",  points = 52,  wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Honda Civic Type R",       points = 1561),
        TeamStanding(position = 2, name = "BMW 330i M Sport",         points = 1008),
        TeamStanding(position = 3, name = "Vauxhall Astra",           points = 347),
        TeamStanding(position = 4, name = "Subaru Levorg GT",         points = 326),
        TeamStanding(position = 5, name = "Ford Focus RS",            points = 277),
        TeamStanding(position = 6, name = "Toyota Corolla GR Sport",  points = 258),
        TeamStanding(position = 7, name = "Mercedes-Benz A-Class",    points = 195),
        TeamStanding(position = 8, name = "Audi S3 Saloon",           points = 116),
    )
}
