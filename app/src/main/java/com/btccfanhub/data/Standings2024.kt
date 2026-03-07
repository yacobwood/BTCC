package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2024 BTCC standings — hardcoded, never changes. */
object Standings2024 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ash Sutton",           team = "", car = "1",   points = 457, wins = 6),
        DriverStanding(position =  2, name = "Tom Ingram",           team = "", car = "80",  points = 431, wins = 5),
        DriverStanding(position =  3, name = "Dan Cammish",          team = "", car = "27",  points = 342, wins = 2),
        DriverStanding(position =  4, name = "Jake Hill",            team = "", car = "3",   points = 309, wins = 3),
        DriverStanding(position =  5, name = "Adam Morgan",          team = "", car = "33",  points = 268, wins = 0),
        DriverStanding(position =  6, name = "Colin Turkington",     team = "", car = "12",  points = 261, wins = 0),
        DriverStanding(position =  7, name = "Josh Cook",            team = "", car = "66",  points = 247, wins = 2),
        DriverStanding(position =  8, name = "Rory Butcher",         team = "", car = "24",  points = 216, wins = 0),
        DriverStanding(position =  9, name = "Aiden Moffat",         team = "", car = "16",  points = 210, wins = 2),
        DriverStanding(position = 10, name = "Stephen Jelley",       team = "", car = "11",  points = 196, wins = 0),
        DriverStanding(position = 11, name = "Senna Proctor",        team = "", car = "18",  points = 188, wins = 0),
        DriverStanding(position = 12, name = "Gordon Shedden",       team = "", car = "52",  points = 183, wins = 0),
        DriverStanding(position = 13, name = "Daryl DeLeon",         team = "", car = "2",   points = 165, wins = 1),
        DriverStanding(position = 14, name = "Daniel Lloyd",         team = "", car = "123", points = 158, wins = 0),
        DriverStanding(position = 15, name = "Mikey Doble",          team = "", car = "88",  points = 156, wins = 0),
        DriverStanding(position = 16, name = "Chris Smiley",         team = "", car = "22",  points = 142, wins = 0),
        DriverStanding(position = 17, name = "Daniel Rowbottom",     team = "", car = "32",  points = 135, wins = 0),
        DriverStanding(position = 18, name = "Tom Chilton",          team = "", car = "17",  points = 116, wins = 0),
        DriverStanding(position = 19, name = "Áron Taylor-Smith",    team = "", car = "40",  points =  98, wins = 1),
        DriverStanding(position = 20, name = "Ashley Sutton",        team = "", car = "116", points =  91, wins = 1),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =  1, name = "NAPA Racing UK",                                  points = 799),
        TeamStanding(position =  2, name = "Team Dynamics",                                   points = 678),
        TeamStanding(position =  3, name = "WSR",                                             points = 461),
        TeamStanding(position =  4, name = "Restart Racing",                                  points = 425),
        TeamStanding(position =  5, name = "Laser Tools Racing with MB Motorsport",           points = 371),
        TeamStanding(position =  6, name = "TOYOTA GAZOO Racing UK with IAA",                 points = 319),
        TeamStanding(position =  7, name = "One Motorsport",                                  points = 247),
        TeamStanding(position =  8, name = "Motor Parts Direct with Power Maxed Racing",      points = 214),
    )
}
