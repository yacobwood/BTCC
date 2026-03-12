package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2021 BTCC standings from Drivers and Teams (Excel). */
object Standings2021 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton", team = "", car = "", points = 357, wins = 0),
        DriverStanding(position =  2, name = "Colin Turkington", team = "", car = "", points = 306, wins = 0),
        DriverStanding(position =  3, name = "Josh Cook", team = "", car = "", points = 303, wins = 0),
        DriverStanding(position =  4, name = "Tom Ingram", team = "", car = "", points = 300, wins = 0),
        DriverStanding(position =  5, name = "Jake Hill", team = "", car = "", points = 295, wins = 0),
        DriverStanding(position =  6, name = "Gordon Shedden", team = "", car = "", points = 251, wins = 0),
        DriverStanding(position =  7, name = "Rory Butcher", team = "", car = "", points = 247, wins = 0),
        DriverStanding(position =  8, name = "Aiden Moffat", team = "", car = "", points = 230, wins = 0),
        DriverStanding(position =  9, name = "Daniel Rowbottom", team = "", car = "", points = 222, wins = 0),
        DriverStanding(position = 10, name = "Senna Proctor", team = "", car = "", points = 206, wins = 0),
        DriverStanding(position = 11, name = "Daniel Lloyd", team = "", car = "", points = 190, wins = 0),
        DriverStanding(position = 12, name = "Stephen Jelley", team = "", car = "", points = 174, wins = 0),
        DriverStanding(position = 13, name = "Adam Morgan", team = "", car = "", points = 161, wins = 0),
        DriverStanding(position = 14, name = "Jason Plato", team = "", car = "", points = 156, wins = 0),
        DriverStanding(position = 15, name = "Chris Smiley", team = "", car = "", points = 138, wins = 0),
        DriverStanding(position = 16, name = "Tom Oliphant", team = "", car = "", points = 129, wins = 0),
        DriverStanding(position = 17, name = "Jack Goff", team = "", car = "", points = 90, wins = 0),
        DriverStanding(position = 18, name = "Ollie Jackson", team = "", car = "", points = 77, wins = 0),
        DriverStanding(position = 19, name = "Tom Chilton", team = "", car = "", points = 64, wins = 0),
        DriverStanding(position = 20, name = "Árón Taylor-Smith", team = "", car = "", points = 33, wins = 0),
        DriverStanding(position = 21, name = "Dan Cammish", team = "", car = "", points = 30, wins = 0),
        DriverStanding(position = 22, name = "Carl Boardley", team = "", car = "", points = 29, wins = 0),
        DriverStanding(position = 23, name = "Sam Osborne", team = "", car = "", points = 16, wins = 0),
        DriverStanding(position = 24, name = "Sam Smelt", team = "", car = "", points = 5, wins = 0),
        DriverStanding(position = 25, name = "Jack Butel", team = "", car = "", points = 4, wins = 0),
        DriverStanding(position = 26, name = "Jade Edwards", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 27, name = "Rick Parfitt Jr.", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 28, name = "Jack Mitchell", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 29, name = "Nicolas Hamilton", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 30, name = "Andy Neate", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 31, name = "Paul Rivett", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 32, name = "Andy Wilmot", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 33, name = "Jessica Hawkins", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 34, name = "Nick Halstead", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 35, name = "Glynn Geddie", team = "", car = "", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Laser Tools Racing", points = 588),
        TeamStanding(position = 2, name = "BTC Racing", points = 531),
        TeamStanding(position = 3, name = "Halfords Racing with Cataclean", points = 472),
        TeamStanding(position = 4, name = "Team BMW", points = 460),
        TeamStanding(position = 5, name = "Ginsters Excelr8 with TradePriceCars.com", points = 445),
        TeamStanding(position = 6, name = "MB Motorsport accelerated by Blue Square", points = 384),
        TeamStanding(position = 7, name = "Adrian Flux with Power Maxed Racing", points = 362),
        TeamStanding(position = 8, name = "Toyota Gazoo Racing UK", points = 252),
        TeamStanding(position = 9, name = "Car Gods with Ciceley Motorsport", points = 242),
        TeamStanding(position = 10, name = "Team HARD with Autobrite Direct", points = 0),
        TeamStanding(position = 11, name = "Team HARD with HUB Financial Solutions", points = 47),
        TeamStanding(position = 12, name = "Racing with Wera & Photon Group", points = 28),
        TeamStanding(position = 13, name = "Excelr8 with TradePriceCars.com", points = 12),
        TeamStanding(position = 14, name = "PHSC with BTC Racing", points = 3),
        TeamStanding(position = 15, name = "ROKiT Racing with iQuoto Online Trading", points = 0),
    )
}
