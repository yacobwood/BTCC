package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2021 BTCC standings from race results. */
object Standings2021 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Ashley Sutton", team = "Laser Tools Racing", car = "1", points = 379, wins = 5),
        DriverStanding(position =   2, name = "Colin Turkington", team = "West Surrey Racing", car = "2", points = 324, wins = 4),
        DriverStanding(position =   3, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 323, wins = 3),
        DriverStanding(position =   4, name = "Josh Cook", team = "BTC Racing", car = "66", points = 320, wins = 5),
        DriverStanding(position =   5, name = "Jake Hill", team = "BTC Racing", car = "24", points = 313, wins = 2),
        DriverStanding(position =   6, name = "Gordon Shedden", team = "Team Dynamics", car = "52", points = 266, wins = 2),
        DriverStanding(position =   7, name = "Rory Butcher", team = "Motorbase Performance", car = "6", points = 265, wins = 3),
        DriverStanding(position =   8, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 238, wins = 1),
        DriverStanding(position =   9, name = "Daniel Rowbottom", team = "BTC Racing", car = "32", points = 230, wins = 1),
        DriverStanding(position =  10, name = "Senna Proctor", team = "Honda Civic Type R", car = "18", points = 218, wins = 1),
        DriverStanding(position =  11, name = "Daniel Lloyd", team = "Team Hard", car = "123", points = 199, wins = 0),
        DriverStanding(position =  12, name = "Stephen Jelley", team = "Team Parker Racing", car = "12", points = 174, wins = 0),
        DriverStanding(position =  13, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 171, wins = 2),
        DriverStanding(position =  14, name = "Jason Plato", team = "Power Maxed Racing", car = "11", points = 159, wins = 0),
        DriverStanding(position =  15, name = "Chris Smiley", team = "Team Hard", car = "22", points = 138, wins = 0),
        DriverStanding(position =  16, name = "Tom Oliphant", team = "West Surrey Racing", car = "15", points = 135, wins = 1),
        DriverStanding(position =  17, name = "Jack Goff", team = "AmD Tuning with Cobra Exhausts", car = "31", points = 93, wins = 0),
        DriverStanding(position =  18, name = "Ollie Jackson", team = "Ford Focus ST Mk 4", car = "48", points = 78, wins = 0),
        DriverStanding(position =  19, name = "Tom Chilton", team = "Motorbase Performance", car = "3", points = 63, wins = 0),
        DriverStanding(position =  20, name = "Dan Cammish", team = "Halfords Yuasa Racing", car = "27", points = 33, wins = 0),
        DriverStanding(position =  21, name = "Aron Taylor-Smith", team = "Power Maxed Racing", car = "40", points = 33, wins = 0),
        DriverStanding(position =  22, name = "Carl Boardley", team = "Infiniti Q50", car = "41", points = 29, wins = 0),
        DriverStanding(position =  23, name = "Sam Osborne", team = "AmD Tuning with Cobra Exhausts", car = "4", points = 16, wins = 0),
        DriverStanding(position =  24, name = "Sam Smelt", team = "Toyota Corolla GR Sport", car = "23", points = 5, wins = 0),
        DriverStanding(position =  25, name = "Jack Butel", team = "Hyundai i30N", car = "96", points = 4, wins = 0),
        DriverStanding(position =  26, name = "Jade Edwards", team = "Honda Civic Type R", car = "99", points = 1, wins = 0),
        DriverStanding(position =  27, name = "Glynn Geddie", team = "Cupra Leon", car = "88", points = 0, wins = 0),
        DriverStanding(position =  28, name = "Andy Neate", team = "Ford Focus ST Mk 4", car = "44", points = 0, wins = 0),
        DriverStanding(position =  29, name = "Rick Parfitt", team = "Hyundai i30N", car = "62", points = 0, wins = 0),
        DriverStanding(position =  30, name = "Nic Hamilton", team = "Laser Tools Racing", car = "28", points = 0, wins = 0),
        DriverStanding(position =  31, name = "Jessica Hawkins", team = "Ford Focus ST Mk 4", car = "21", points = 0, wins = 0),
        DriverStanding(position =  32, name = "Jack Mitchell", team = "Cupra Leon", car = "19", points = 0, wins = 0),
        DriverStanding(position =  33, name = "Paul Rivett", team = "Ford Focus ST Mk 4", car = "20", points = 0, wins = 0),
        DriverStanding(position =  34, name = "Nick Halstead", team = "Hyundai i30N", car = "42", points = 0, wins = 0),
        DriverStanding(position =  35, name = "Andy Wilmot", team = "Hyundai i30N", car = "55", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "BTC Racing", points = 863),
        TeamStanding(position =   2, name = "Laser Tools Racing", points = 617),
        TeamStanding(position =   3, name = "West Surrey Racing", points = 459),
        TeamStanding(position =   4, name = "Team Hard", points = 337),
        TeamStanding(position =   5, name = "Motorbase Performance", points = 328),
        TeamStanding(position =   6, name = "Speedworks Motorsport", points = 323),
        TeamStanding(position =   7, name = "Team Dynamics", points = 266),
        TeamStanding(position =   8, name = "Honda Civic Type R", points = 219),
        TeamStanding(position =   9, name = "Power Maxed Racing", points = 192),
        TeamStanding(position =  10, name = "Team Parker Racing", points = 174),
        TeamStanding(position =  11, name = "WIX Racing", points = 171),
        TeamStanding(position =  12, name = "AmD Tuning with Cobra Exhausts", points = 109),
        TeamStanding(position =  13, name = "Ford Focus ST Mk 4", points = 78),
        TeamStanding(position =  14, name = "Halfords Yuasa Racing", points = 33),
        TeamStanding(position =  15, name = "Infiniti Q50", points = 29),
        TeamStanding(position =  16, name = "Toyota Corolla GR Sport", points = 5),
        TeamStanding(position =  17, name = "Hyundai i30N", points = 4),
        TeamStanding(position =  18, name = "Cupra Leon", points = 0),
    )
}
