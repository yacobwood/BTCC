package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2022 BTCC standings from race results. */
object Standings2022 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 419, wins = 6),
        DriverStanding(position =   2, name = "Jake Hill", team = "BTC Racing", car = "24", points = 413, wins = 3),
        DriverStanding(position =   3, name = "Ashley Sutton", team = "NAPA Racing UK", car = "1", points = 408, wins = 3),
        DriverStanding(position =   4, name = "Colin Turkington", team = "West Surrey Racing", car = "50", points = 368, wins = 3),
        DriverStanding(position =   5, name = "Rory Butcher", team = "Motorbase Performance", car = "6", points = 331, wins = 1),
        DriverStanding(position =   6, name = "Josh Cook", team = "BTC Racing", car = "66", points = 320, wins = 5),
        DriverStanding(position =   7, name = "Gordon Shedden", team = "Team Dynamics", car = "52", points = 259, wins = 2),
        DriverStanding(position =   8, name = "Dan Cammish", team = "NAPA Racing UK", car = "9", points = 216, wins = 1),
        DriverStanding(position =   9, name = "Daniel Lloyd", team = "Team Hard", car = "123", points = 203, wins = 3),
        DriverStanding(position =  10, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 198, wins = 1),
        DriverStanding(position =  11, name = "Stephen Jelley", team = "Team Parker Racing", car = "12", points = 185, wins = 1),
        DriverStanding(position =  12, name = "Daniel Rowbottom", team = "BTC Racing", car = "32", points = 151, wins = 0),
        DriverStanding(position =  13, name = "George Gamble", team = "BMW 330e M Sport", car = "42", points = 128, wins = 1),
        DriverStanding(position =  14, name = "Bobby Thompson", team = "Cupra Leon", car = "19", points = 100, wins = 0),
        DriverStanding(position =  15, name = "Tom Chilton", team = "Motorbase Performance", car = "3", points = 82, wins = 0),
        DriverStanding(position =  16, name = "Ricky Collard", team = "Laser Tools Racing", car = "21", points = 81, wins = 0),
        DriverStanding(position =  17, name = "Jason Plato", team = "Power Maxed Racing", car = "11", points = 80, wins = 0),
        DriverStanding(position =  18, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 72, wins = 0),
        DriverStanding(position =  19, name = "Ash Hand", team = "Vauxhall Astra", car = "97", points = 55, wins = 0),
        DriverStanding(position =  20, name = "Michael Crees", team = "Vauxhall Astra", car = "777", points = 50, wins = 0),
        DriverStanding(position =  21, name = "Aron Taylor-Smith", team = "Power Maxed Racing", car = "40", points = 38, wins = 0),
        DriverStanding(position =  22, name = "Ollie Jackson", team = "Ford Focus ST Mk 4", car = "48", points = 33, wins = 0),
        DriverStanding(position =  23, name = "Dexter Patterson", team = "Infiniti Q50", car = "17", points = 5, wins = 0),
        DriverStanding(position =  24, name = "James Gornall", team = "Hyundai i30N", car = "18", points = 2, wins = 0),
        DriverStanding(position =  25, name = "Jade Edwards", team = "Honda Civic Type R", car = "99", points = 1, wins = 0),
        DriverStanding(position =  26, name = "Sam Osborne", team = "AmD Tuning with Cobra Exhausts", car = "77", points = 1, wins = 0),
        DriverStanding(position =  27, name = "Jack Butel", team = "Hyundai i30N", car = "96", points = 1, wins = 0),
        DriverStanding(position =  28, name = "Nic Hamilton", team = "Laser Tools Racing", car = "28", points = 0, wins = 0),
        DriverStanding(position =  29, name = "Rick Parfitt", team = "Infiniti Q50", car = "62", points = 0, wins = 0),
        DriverStanding(position =  30, name = "Will Powell", team = "Cupra Leon", car = "20", points = 0, wins = 0),
        DriverStanding(position =  31, name = "Tom Oliphant", team = "West Surrey Racing", car = "15", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "BTC Racing", points = 884),
        TeamStanding(position =   2, name = "NAPA Racing UK", points = 624),
        TeamStanding(position =   3, name = "Speedworks Motorsport", points = 419),
        TeamStanding(position =   4, name = "Motorbase Performance", points = 413),
        TeamStanding(position =   5, name = "West Surrey Racing", points = 368),
        TeamStanding(position =   6, name = "Team Dynamics", points = 259),
        TeamStanding(position =   7, name = "Team Hard", points = 203),
        TeamStanding(position =   8, name = "WIX Racing", points = 198),
        TeamStanding(position =   9, name = "Team Parker Racing", points = 185),
        TeamStanding(position =  10, name = "Laser Tools Racing", points = 153),
        TeamStanding(position =  11, name = "BMW 330e M Sport", points = 128),
        TeamStanding(position =  12, name = "Power Maxed Racing", points = 118),
        TeamStanding(position =  13, name = "Vauxhall Astra", points = 105),
        TeamStanding(position =  14, name = "Cupra Leon", points = 100),
        TeamStanding(position =  15, name = "Ford Focus ST Mk 4", points = 33),
        TeamStanding(position =  16, name = "Infiniti Q50", points = 5),
        TeamStanding(position =  17, name = "Hyundai i30N", points = 3),
        TeamStanding(position =  18, name = "Honda Civic Type R", points = 1),
        TeamStanding(position =  19, name = "AmD Tuning with Cobra Exhausts", points = 1),
    )
}
