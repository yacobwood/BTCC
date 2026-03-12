package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2025 BTCC standings from Drivers and Teams (Excel). */
object Standings2025 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Tom Ingram", team = "", car = "", points = 462, wins = 0),
        DriverStanding(position =  2, name = "Ashley Sutton", team = "", car = "", points = 428, wins = 1),
        DriverStanding(position =  3, name = "Dan Cammish", team = "", car = "", points = 307, wins = 0),
        DriverStanding(position =  4, name = "Jake Hill", team = "", car = "", points = 295, wins = 0),
        DriverStanding(position =  5, name = "Daniel Rowbottom", team = "", car = "", points = 277, wins = 1),
        DriverStanding(position =  6, name = "Adam Morgan", team = "", car = "", points = 241, wins = 0),
        DriverStanding(position =  7, name = "Tom Chilton", team = "", car = "", points = 230, wins = 0),
        DriverStanding(position =  8, name = "Charles Rainford", team = "", car = "", points = 179, wins = 0),
        DriverStanding(position =  9, name = "Gordon Shedden", team = "", car = "", points = 177, wins = 0),
        DriverStanding(position = 10, name = "Senna Proctor", team = "", car = "", points = 167, wins = 0),
        DriverStanding(position = 11, name = "Aiden Moffat", team = "", car = "", points = 166, wins = 0),
        DriverStanding(position = 12, name = "Josh Cook", team = "", car = "", points = 160, wins = 0),
        DriverStanding(position = 13, name = "Daryl DeLeon", team = "", car = "", points = 149, wins = 0),
        DriverStanding(position = 14, name = "Chris Smiley", team = "", car = "", points = 140, wins = 0),
        DriverStanding(position = 15, name = "Daniel Lloyd", team = "", car = "", points = 128, wins = 0),
        DriverStanding(position = 16, name = "Sam Osborne", team = "", car = "", points = 108, wins = 0),
        DriverStanding(position = 17, name = "Árón Taylor-Smith", team = "", car = "", points = 103, wins = 0),
        DriverStanding(position = 18, name = "Mikey Doble", team = "", car = "", points = 100, wins = 0),
        DriverStanding(position = 19, name = "James Dorlin", team = "", car = "", points = 47, wins = 0),
        DriverStanding(position = 20, name = "Dexter Patterson", team = "", car = "", points = 42, wins = 0),
        DriverStanding(position = 21, name = "Ronan Pearson", team = "", car = "", points = 29, wins = 0),
        DriverStanding(position = 22, name = "Max Buxton", team = "", car = "", points = 8, wins = 0),
        DriverStanding(position = 23, name = "Max Hall", team = "", car = "", points = 7, wins = 0),
        DriverStanding(position = 24, name = "Stephen Jelley", team = "", car = "", points = 7, wins = 0),
        DriverStanding(position = 25, name = "Michael Crees", team = "", car = "", points = 5, wins = 0),
        DriverStanding(position = 26, name = "Finn Leslie", team = "", car = "", points = 4, wins = 0),
        DriverStanding(position = 27, name = "Nick Halstead", team = "", car = "", points = 4, wins = 0),
        DriverStanding(position = 28, name = "Nicolas Hamilton", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 29, name = "Ryan Bensley", team = "", car = "", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK", points = 775),
        TeamStanding(position = 2, name = "Team VERTU", points = 773),
        TeamStanding(position = 3, name = "LKQ Euro Car Parts Racing with WSR", points = 462),
        TeamStanding(position = 4, name = "Restart Racing", points = 386),
        TeamStanding(position = 5, name = "Laser Tools Racing with MB Motorsport", points = 319),
        TeamStanding(position = 5, name = "Toyota Gazoo Racing UK with IAA", points = 266),
        TeamStanding(position = 7, name = "West Surrey Racing", points = 215),
        TeamStanding(position = 8, name = "Motor Parts Direct with Power Maxed Racing", points = 190),
        TeamStanding(position = 9, name = "One Motorsport", points = 156),
        TeamStanding(position = 10, name = "ROKiT Racing with Un-Limited Motorsport", points = 144),
        TeamStanding(position = 11, name = "Powder Monkey Brewing Co with Esidock", points = 32),
    )
}
