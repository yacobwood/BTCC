package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2023 BTCC standings — hardcoded, never changes. */
object Standings2023 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton",       team = "", car = "116", points = 446, wins = 16),
        DriverStanding(position =  2, name = "Tom Ingram",          team = "", car = "1",   points = 400, wins = 1),
        DriverStanding(position =  3, name = "Jake Hill",           team = "", car = "24",  points = 372, wins = 8),
        DriverStanding(position =  4, name = "Colin Turkington",    team = "", car = "4",   points = 312, wins = 1),
        DriverStanding(position =  5, name = "Josh Cook",           team = "", car = "66",  points = 268, wins = 0),
        DriverStanding(position =  6, name = "Dan Cammish",         team = "", car = "27",  points = 253, wins = 3),
        DriverStanding(position =  7, name = "Daniel Rowbottom",    team = "", car = "32",  points = 226, wins = 0),
        DriverStanding(position =  8, name = "Ricky Collard",       team = "", car = "37",  points = 217, wins = 0),
        DriverStanding(position =  9, name = "Adam Morgan",         team = "", car = "33",  points = 199, wins = 0),
        DriverStanding(position = 10, name = "Rory Butcher",        team = "", car = "6",   points = 173, wins = 0),
        DriverStanding(position = 11, name = "Aron Taylor-Smith",   team = "", car = "40",  points =   0, wins = 0),
        DriverStanding(position = 12, name = "Stephen Jelley",      team = "", car = "12",  points =   0, wins = 0),
        DriverStanding(position = 13, name = "Daniel Lloyd",        team = "", car = "123", points =   0, wins = 0),
        DriverStanding(position = 14, name = "Andrew Watson",       team = "", car = "11",  points =   0, wins = 0),
        DriverStanding(position = 15, name = "Tom Chilton",         team = "", car = "3",   points =   0, wins = 1),
        DriverStanding(position = 16, name = "Bobby Thompson",      team = "", car = "19",  points =   0, wins = 0),
        DriverStanding(position = 17, name = "Mikey Doble",         team = "", car = "88",  points =   0, wins = 0),
        DriverStanding(position = 18, name = "Ronan Pearson",       team = "", car = "14",  points =   0, wins = 0),
        DriverStanding(position = 19, name = "Sam Osborne",         team = "", car = "77",  points =   0, wins = 0),
        DriverStanding(position = 20, name = "Aiden Moffat",        team = "", car = "16",  points =   0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK",                              points = 713),
        TeamStanding(position = 2, name = "Bristol Street Motors with EXCELR8",          points = 564),
        TeamStanding(position = 3, name = "Team BMW",                                    points = 559),
        TeamStanding(position = 4, name = "One Motorsport with Starline Racing",         points = 426),
        TeamStanding(position = 5, name = "TOYOTA GAZOO Racing UK",                      points = 420),
        TeamStanding(position = 6, name = "Laser Tools Racing with MB Motorsport",       points = 381),
        TeamStanding(position = 7, name = "CarStore Power Maxed Racing",                 points = 342),
        TeamStanding(position = 8, name = "Autobrite Direct with Millers Oils",          points = 267),
    )
}
