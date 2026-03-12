package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2020 BTCC standings from Drivers and Teams (Excel). */
object Standings2020 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton", team = "", car = "", points = 350, wins = 5),
        DriverStanding(position =  2, name = "Colin Turkington", team = "", car = "", points = 336, wins = 5),
        DriverStanding(position =  3, name = "Dan Cammish", team = "", car = "", points = 334, wins = 4),
        DriverStanding(position =  4, name = "Tom Ingram", team = "", car = "", points = 326, wins = 3),
        DriverStanding(position =  5, name = "Rory Butcher", team = "", car = "", points = 286, wins = 3),
        DriverStanding(position =  6, name = "Tom Oliphant", team = "", car = "", points = 228, wins = 1),
        DriverStanding(position =  7, name = "Jake Hill", team = "", car = "", points = 212, wins = 0),
        DriverStanding(position =  8, name = "Adam Morgan", team = "", car = "", points = 206, wins = 1),
        DriverStanding(position =  9, name = "Josh Cook", team = "", car = "", points = 196, wins = 3),
        DriverStanding(position = 10, name = "Tom Chilton", team = "", car = "", points = 184, wins = 0),
        DriverStanding(position = 11, name = "Matt Neal", team = "", car = "", points = 181, wins = 0),
        DriverStanding(position = 12, name = "Ollie Jackson", team = "", car = "", points = 152, wins = 2),
        DriverStanding(position = 13, name = "Senna Proctor", team = "", car = "", points = 141, wins = 0),
        DriverStanding(position = 14, name = "Chris Smiley", team = "", car = "", points = 106, wins = 0),
        DriverStanding(position = 15, name = "Aiden Moffat", team = "", car = "", points = 105, wins = 0),
        DriverStanding(position = 16, name = "Stephen Jelley", team = "", car = "", points = 72, wins = 0),
        DriverStanding(position = 17, name = "Michael Crees", team = "", car = "", points = 50, wins = 0),
        DriverStanding(position = 18, name = "Bobby Thompson", team = "", car = "", points = 44, wins = 0),
        DriverStanding(position = 19, name = "Sam Osborne", team = "", car = "", points = 29, wins = 0),
        DriverStanding(position = 20, name = "James Gornall", team = "", car = "", points = 18, wins = 0),
        DriverStanding(position = 21, name = "Carl Boardley", team = "", car = "", points = 18, wins = 0),
        DriverStanding(position = 22, name = "Rob Austin", team = "", car = "", points = 13, wins = 0),
        DriverStanding(position = 23, name = "Jack Goff", team = "", car = "", points = 11, wins = 0),
        DriverStanding(position = 24, name = "Ollie Brown", team = "", car = "", points = 3, wins = 0),
        DriverStanding(position = 25, name = "Andy Neate", team = "", car = "", points = 3, wins = 0),
        DriverStanding(position = 26, name = "Jack Butel", team = "", car = "", points = 2, wins = 0),
        DriverStanding(position = 27, name = "Mike Bushell", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 28, name = "Paul Rivett", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 29, name = "Nicolas Hamilton", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 30, name = "Glynn Geddie", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 31, name = "Tom Onslow-Cole", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 32, name = "Ethan Hammerton", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 33, name = "Jessica Hawkins", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 34, name = "Bradley Philpot", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 35, name = "Jade Edwards", team = "", car = "", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Team BMW", points = 550),
        TeamStanding(position = 2, name = "Halfords Yuasa Racing", points = 505),
        TeamStanding(position = 3, name = "Laser Tools Racing", points = 439),
        TeamStanding(position = 4, name = "Motorbase Performance", points = 426),
        TeamStanding(position = 5, name = "BTC Racing", points = 371),
        TeamStanding(position = 6, name = "Toyota Gazoo Racing UK with Ginsters", points = 316),
        TeamStanding(position = 7, name = "Excelr8 Motorsport", points = 246),
        TeamStanding(position = 8, name = "Carlube TripleR Racing with Mac Tools", points = 207),
        TeamStanding(position = 9, name = "MB Motorsport accelerated by Blue Square", points = 0),
        TeamStanding(position = 10, name = "Team Parker Racing", points = 72),
        TeamStanding(position = 11, name = "GKR TradePriceCars.com", points = 63),
        TeamStanding(position = 12, name = "The Clever Baggers with BTC Racing", points = 0),
        TeamStanding(position = 13, name = "HUB Financial Solutions with Team HARD", points = 19),
        TeamStanding(position = 14, name = "RCIB Insurance with Fox Transport", points = 16),
        TeamStanding(position = 15, name = "Power Maxed Car Care Racing", points = 13),
        TeamStanding(position = 16, name = "ROKiT Racing with Team HARD", points = 1),
    )
}
