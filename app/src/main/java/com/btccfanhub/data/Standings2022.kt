package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2022 BTCC standings from Drivers and Teams (Excel). */
object Standings2022 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Tom Ingram", team = "", car = "", points = 394, wins = 0),
        DriverStanding(position =  2, name = "Ashley Sutton", team = "", car = "", points = 382, wins = 0),
        DriverStanding(position =  3, name = "Jake Hill", team = "", car = "", points = 381, wins = 0),
        DriverStanding(position =  4, name = "Colin Turkington", team = "", car = "", points = 348, wins = 0),
        DriverStanding(position =  5, name = "Rory Butcher", team = "", car = "", points = 318, wins = 0),
        DriverStanding(position =  6, name = "Josh Cook", team = "", car = "", points = 296, wins = 0),
        DriverStanding(position =  7, name = "Gordon Shedden", team = "", car = "", points = 248, wins = 0),
        DriverStanding(position =  8, name = "Dan Cammish", team = "", car = "", points = 207, wins = 0),
        DriverStanding(position =  9, name = "Adam Morgan", team = "", car = "", points = 193, wins = 0),
        DriverStanding(position = 10, name = "Daniel Lloyd", team = "", car = "", points = 192, wins = 0),
        DriverStanding(position = 11, name = "Stephen Jelley", team = "", car = "", points = 181, wins = 0),
        DriverStanding(position = 12, name = "Daniel Rowbottom", team = "", car = "", points = 151, wins = 0),
        DriverStanding(position = 13, name = "George Gamble", team = "", car = "", points = 123, wins = 0),
        DriverStanding(position = 14, name = "Bobby Thompson", team = "", car = "", points = 99, wins = 0),
        DriverStanding(position = 15, name = "Tom Chilton", team = "", car = "", points = 83, wins = 0),
        DriverStanding(position = 16, name = "Ricky Collard", team = "", car = "", points = 81, wins = 0),
        DriverStanding(position = 17, name = "Jason Plato", team = "", car = "", points = 77, wins = 0),
        DriverStanding(position = 18, name = "Aiden Moffat", team = "", car = "", points = 69, wins = 0),
        DriverStanding(position = 19, name = "Ash Hand", team = "", car = "", points = 55, wins = 0),
        DriverStanding(position = 20, name = "Michael Crees", team = "", car = "", points = 50, wins = 0),
        DriverStanding(position = 21, name = "Árón Taylor-Smith", team = "", car = "", points = 38, wins = 0),
        DriverStanding(position = 22, name = "Ollie Jackson", team = "", car = "", points = 33, wins = 0),
        DriverStanding(position = 23, name = "Dexter Patterson", team = "", car = "", points = 5, wins = 0),
        DriverStanding(position = 24, name = "James Gornall", team = "", car = "", points = 2, wins = 0),
        DriverStanding(position = 25, name = "Sam Osborne", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 26, name = "Jade Edwards", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 27, name = "Jack Butel", team = "", car = "", points = 1, wins = 0),
        DriverStanding(position = 28, name = "Rick Parfitt Jr.", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 29, name = "Nicolas Hamilton", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 30, name = "Tom Oliphant", team = "", car = "", points = 0, wins = 0),
        DriverStanding(position = 31, name = "Will Powell", team = "", car = "", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK", points = 582),
        TeamStanding(position = 2, name = "Team BMW", points = 525),
        TeamStanding(position = 3, name = "Bristol Street Motors with Excelr8 TradePriceCars.com", points = 497),
        TeamStanding(position = 4, name = "Halfords Racing with Cataclean", points = 388),
        TeamStanding(position = 5, name = "ROKiT MB Motorsport", points = 371),
        TeamStanding(position = 6, name = "Rich Energy BTC Racing", points = 366),
        TeamStanding(position = 7, name = "Car Gods with Ciceley Motorsport", points = 324),
        TeamStanding(position = 8, name = "Toyota Gazoo Racing UK", points = 302),
        TeamStanding(position = 9, name = "Autobrite Direct with JourneyHero", points = 110),
        TeamStanding(position = 10, name = "Laser Tools Racing", points = 74),
        TeamStanding(position = 11, name = "CarStore Power Maxed Racing", points = 53),
        TeamStanding(position = 12, name = "Yazoo with Safuu.com Racing", points = 48),
        TeamStanding(position = 13, name = "Apec Racing with Beavis Morgan", points = 40),
        TeamStanding(position = 14, name = "UptonSteel with Euro Car Parts Racing", points = 0),
    )
}
