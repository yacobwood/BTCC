package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2025 BTCC standings from race results. */
object Standings2025 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Tom Ingram", team = "Vertu", car = "80", points = 502, wins = 7),
        DriverStanding(position =   2, name = "Ashley Sutton", team = "NAPA Racing UK", car = "116", points = 463, wins = 5),
        DriverStanding(position =   3, name = "Dan Cammish", team = "NAPA Racing UK", car = "27", points = 330, wins = 3),
        DriverStanding(position =   4, name = "Jake Hill", team = "Laser Tools Racing", car = "1", points = 310, wins = 3),
        DriverStanding(position =   5, name = "Daniel Rowbottom", team = "NAPA Racing UK", car = "32", points = 292, wins = 3),
        DriverStanding(position =   6, name = "Adam Morgan", team = "Vertu", car = "33", points = 253, wins = 0),
        DriverStanding(position =   7, name = "Tom Chilton", team = "Vertu", car = "3", points = 240, wins = 2),
        DriverStanding(position =   8, name = "Josh Cook", team = "TOYOTA GAZOO Racing UK", car = "66", points = 198, wins = 1),
        DriverStanding(position =   9, name = "Charles Rainford", team = "LKQ Euro Car Parts Racing", car = "99", points = 184, wins = 1),
        DriverStanding(position =  10, name = "Gordon Shedden", team = "TOYOTA GAZOO Racing UK", car = "52", points = 182, wins = 1),
        DriverStanding(position =  11, name = "Senna Proctor", team = "Vertu", car = "18", points = 170, wins = 0),
        DriverStanding(position =  12, name = "Aiden Moffat", team = "LKQ Euro Car Parts Racing", car = "16", points = 164, wins = 0),
        DriverStanding(position =  13, name = "Daryl DeLeon", team = "WSR", car = "2", points = 150, wins = 1),
        DriverStanding(position =  14, name = "Chris Smiley", team = "Restart Racing", car = "22", points = 140, wins = 0),
        DriverStanding(position =  15, name = "Daniel Lloyd", team = "Restart Racing", car = "123", points = 131, wins = 1),
        DriverStanding(position =  16, name = "Árón Taylor-Smith", team = "TOYOTA GAZOO Racing UK", car = "40", points = 117, wins = 0),
        DriverStanding(position =  17, name = "Sam Osborne", team = "NAPA Racing UK", car = "77", points = 112, wins = 1),
        DriverStanding(position =  18, name = "Mikey Doble", team = "Power Maxed Racing", car = "88", points = 109, wins = 1),
        DriverStanding(position =  19, name = "James Dorlin", team = "TOYOTA GAZOO Racing UK", car = "132", points = 47, wins = 0),
        DriverStanding(position =  20, name = "Dexter Patterson", team = "ROKiT Racing", car = "17", points = 42, wins = 0),
        DriverStanding(position =  21, name = "Ronan Pearson", team = "TOYOTA GAZOO Racing UK", car = "14", points = 29, wins = 0),
        DriverStanding(position =  22, name = "Max Buxton", team = "TOYOTA GAZOO Racing UK", car = "19", points = 8, wins = 0),
        DriverStanding(position =  23, name = "Max Hall", team = "ROKiT Racing", car = "93", points = 7, wins = 0),
        DriverStanding(position =  24, name = "Stephen Jelley", team = "ROKiT Racing", car = "12", points = 7, wins = 0),
        DriverStanding(position =  25, name = "Michael Crees", team = "Vertu", car = "777", points = 5, wins = 0),
        DriverStanding(position =  26, name = "Nick Halstead", team = "Power Maxed Racing", car = "50", points = 4, wins = 0),
        DriverStanding(position =  27, name = "Finn Leslie", team = "TOYOTA GAZOO Racing UK", car = "26", points = 4, wins = 0),
        DriverStanding(position =  28, name = "Nicolas Hamilton", team = "Powder Monkey Racing", car = "28", points = 0, wins = 0),
        DriverStanding(position =  29, name = "Ryan Bensley", team = "Vertu", car = "54", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "NAPA Racing UK", points = 1197),
        TeamStanding(position =   2, name = "Vertu", points = 1170),
        TeamStanding(position =   3, name = "TOYOTA GAZOO Racing UK", points = 585),
        TeamStanding(position =   4, name = "LKQ Euro Car Parts Racing", points = 348),
        TeamStanding(position =   5, name = "Laser Tools Racing", points = 310),
        TeamStanding(position =   6, name = "Restart Racing", points = 271),
        TeamStanding(position =   7, name = "WSR", points = 150),
        TeamStanding(position =   8, name = "Power Maxed Racing", points = 113),
        TeamStanding(position =   9, name = "ROKiT Racing", points = 56),
        TeamStanding(position =  10, name = "Powder Monkey Racing", points = 0),
    )
}
