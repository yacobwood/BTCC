package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2025 BTCC standings — hardcoded, never changes. */
object Standings2025 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Tom Ingram",          team = "", car = "80",  points = 462, wins = 7),
        DriverStanding(position =  2, name = "Ashley Sutton",       team = "", car = "116", points = 428, wins = 5),
        DriverStanding(position =  3, name = "Dan Cammish",         team = "", car = "27",  points = 307, wins = 3),
        DriverStanding(position =  4, name = "Jake Hill",           team = "", car = "1",   points = 295, wins = 3),
        DriverStanding(position =  5, name = "Daniel Rowbottom",    team = "", car = "32",  points = 277, wins = 3),
        DriverStanding(position =  6, name = "Adam Morgan",         team = "", car = "33",  points = 241, wins = 0),
        DriverStanding(position =  7, name = "Tom Chilton",         team = "", car = "3",   points = 230, wins = 2),
        DriverStanding(position =  8, name = "Charles Rainford",    team = "", car = "99",  points = 179, wins = 1),
        DriverStanding(position =  9, name = "Gordon Shedden",      team = "", car = "52",  points = 177, wins = 1),
        DriverStanding(position = 10, name = "Senna Proctor",       team = "", car = "18",  points = 167, wins = 0),
        DriverStanding(position = 11, name = "Aiden Moffat",        team = "", car = "16",  points = 166, wins = 0),
        DriverStanding(position = 12, name = "Josh Cook",           team = "", car = "66",  points = 160, wins = 1),
        DriverStanding(position = 13, name = "Daryl DeLeon",        team = "", car = "2",   points = 149, wins = 1),
        DriverStanding(position = 14, name = "Chris Smiley",        team = "", car = "22",  points = 140, wins = 0),
        DriverStanding(position = 15, name = "Daniel Lloyd",        team = "", car = "123", points = 128, wins = 1),
        DriverStanding(position = 16, name = "Sam Osborne",         team = "", car = "77",  points = 108, wins = 1),
        DriverStanding(position = 17, name = "Áron Taylor-Smith",   team = "", car = "40",  points = 103, wins = 0),
        DriverStanding(position = 18, name = "Mikey Doble",         team = "", car = "88",  points = 100, wins = 1),
        DriverStanding(position = 19, name = "James Dorlin",        team = "", car = "132", points =  47, wins = 0),
        DriverStanding(position = 20, name = "Dexter Patterson",    team = "", car = "17",  points =  42, wins = 0),
        DriverStanding(position = 21, name = "Ronan Pearson",       team = "", car = "14",  points =  29, wins = 0),
        DriverStanding(position = 22, name = "Max Buxton",          team = "", car = "19",  points =   8, wins = 0),
        DriverStanding(position = 23, name = "Max Hall",            team = "", car = "93",  points =   7, wins = 0),
        DriverStanding(position = 24, name = "Stephen Jelley",      team = "", car = "12",  points =   7, wins = 0),
        DriverStanding(position = 25, name = "Michael Crees",       team = "", car = "777", points =   5, wins = 0),
        DriverStanding(position = 26, name = "Finn Leslie",         team = "", car = "26",  points =   4, wins = 0),
        DriverStanding(position = 27, name = "Nick Halstead",       team = "", car = "50",  points =   4, wins = 0),
        DriverStanding(position = 28, name = "Nic Hamilton",        team = "", car = "28",  points =   0, wins = 0),
        DriverStanding(position = 29, name = "Ryan Bensley",        team = "", car = "54",  points =   0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =  1, name = "NAPA Racing UK",                                  points = 775),
        TeamStanding(position =  2, name = "Team VERTU",                                      points = 773),
        TeamStanding(position =  3, name = "LKQ Euro Car Parts Racing with WSR",              points = 462),
        TeamStanding(position =  4, name = "Restart Racing",                                  points = 386),
        TeamStanding(position =  5, name = "Laser Tools Racing with MB Motorsport",           points = 319),
        TeamStanding(position =  6, name = "TOYOTA GAZOO Racing UK with IAA",                 points = 266),
        TeamStanding(position =  7, name = "WSR",                                             points = 215),
        TeamStanding(position =  8, name = "Motor Parts Direct with Power Maxed Racing",      points = 190),
        TeamStanding(position =  9, name = "One Motorsport",                                  points = 156),
        TeamStanding(position = 10, name = "ROKiT Racing with Un-Limited Motorsport",         points = 144),
        TeamStanding(position = 11, name = "Powder Monkey Brewing Co with Esidock",           points =  32),
    )
}
