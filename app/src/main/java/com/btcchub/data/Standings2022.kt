package com.btcchub.data

import com.btcchub.data.model.DriverStanding
import com.btcchub.data.model.TeamStanding

/** Final 2022 BTCC Drivers' Championship standings (Wikipedia). */
object Standings2022 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Tom Ingram",         team = "Bristol Street Motors with Excelr8 TradePriceCars.com", car = "80",  points = 394, wins = 6),
        DriverStanding(position =  2, name = "Ashley Sutton",      team = "NAPA Racing UK", car = "1",   points = 382, wins = 3),
        DriverStanding(position =  3, name = "Jake Hill",          team = "ROKiT MB Motorsport", car = "24",  points = 381, wins = 3),
        DriverStanding(position =  4, name = "Colin Turkington",   team = "Team BMW", car = "50",  points = 348, wins = 3),
        DriverStanding(position =  5, name = "Rory Butcher",       team = "Toyota Gazoo Racing UK", car = "6",   points = 318, wins = 1),
        DriverStanding(position =  6, name = "Josh Cook",          team = "Rich Energy BTC Racing", car = "66",  points = 296, wins = 5),
        DriverStanding(position =  7, name = "Gordon Shedden",     team = "Halfords Racing with Cataclean", car = "52",  points = 248, wins = 2),
        DriverStanding(position =  8, name = "Dan Cammish",        team = "NAPA Racing UK", car = "9",   points = 207, wins = 1),
        DriverStanding(position =  9, name = "Adam Morgan",       team = "Car Gods with Ciceley Motorsport", car = "33",  points = 193, wins = 1),
        DriverStanding(position = 10, name = "Daniel Lloyd",       team = "Bristol Street Motors with Excelr8 TradePriceCars.com", car = "123", points = 192, wins = 3),
        DriverStanding(position = 11, name = "Stephen Jelley",     team = "Toyota Gazoo Racing UK", car = "12",  points = 181, wins = 1),
        DriverStanding(position = 12, name = "Daniel Rowbottom",   team = "Halfords Racing with Cataclean", car = "32",  points = 151, wins = 0),
        DriverStanding(position = 13, name = "George Gamble",      team = "Car Gods with Ciceley Motorsport", car = "42",  points = 123, wins = 1),
        DriverStanding(position = 14, name = "Bobby Thompson",     team = "Autobrite Direct with JourneyHero", car = "19",  points =  99, wins = 0),
        DriverStanding(position = 15, name = "Tom Chilton",        team = "Bristol Street Motors with Excelr8 TradePriceCars.com", car = "3",   points =  83, wins = 0),
        DriverStanding(position = 16, name = "Ricky Collard",       team = "Toyota Gazoo Racing UK", car = "21",  points =  81, wins = 0),
        DriverStanding(position = 17, name = "Jason Plato",        team = "Rich Energy BTC Racing", car = "11",  points =  77, wins = 0),
        DriverStanding(position = 18, name = "Aiden Moffat",       team = "Laser Tools Racing", car = "16",  points =  69, wins = 0),
        DriverStanding(position = 19, name = "Ash Hand",            team = "CarStore Power Maxed Racing", car = "97",  points =  55, wins = 0),
        DriverStanding(position = 20, name = "Michael Crees",      team = "CarStore Power Maxed Racing", car = "777", points =  50, wins = 0),
        DriverStanding(position = 21, name = "Árón Taylor-Smith",  team = "Autobrite Direct with JourneyHero", car = "40",  points =  38, wins = 0),
        DriverStanding(position = 22, name = "Ollie Jackson",      team = "NAPA Racing UK", car = "48",  points =  33, wins = 0),
        DriverStanding(position = 23, name = "Dexter Patterson",   team = "Laser Tools Racing", car = "14",  points =   5, wins = 0),
        DriverStanding(position = 24, name = "James Gornall",       team = "Bristol Street Motors with Excelr8 TradePriceCars.com", car = "41",  points =   2, wins = 0),
        DriverStanding(position = 25, name = "Sam Osborne",         team = "NAPA Racing UK", car = "4",   points =   1, wins = 0),
        DriverStanding(position = 26, name = "Jade Edwards",       team = "Rich Energy BTC Racing", car = "9",   points =   1, wins = 0),
        DriverStanding(position = 27, name = "Jack Butel",         team = "Bristol Street Motors with Excelr8 TradePriceCars.com", car = "96",  points =   1, wins = 0),
        DriverStanding(position = 28, name = "Rick Parfitt Jr.",    team = "Laser Tools Racing", car = "62",  points =   0, wins = 0),
        DriverStanding(position = 29, name = "Nicolas Hamilton",    team = "Autobrite Direct with JourneyHero", car = "28",  points =   0, wins = 0),
        DriverStanding(position = 30, name = "Tom Oliphant",       team = "Autobrite Direct with JourneyHero", car = "15",  points =   0, wins = 0),
        DriverStanding(position = 31, name = "Will Powell",        team = "Autobrite Direct with JourneyHero", car = "20",  points =   0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "NAPA Racing UK",                              points = 582),
        TeamStanding(position = 2, name = "Team BMW",                                    points = 525),
        TeamStanding(position = 3, name = "Bristol Street Motors with Excelr8 TradePriceCars.com", points = 497),
        TeamStanding(position = 4, name = "Halfords Racing with Cataclean",             points = 388),
        TeamStanding(position = 5, name = "ROKiT MB Motorsport",                        points = 371),
        TeamStanding(position = 6, name = "Rich Energy BTC Racing",                      points = 366),
        TeamStanding(position = 7, name = "Car Gods with Ciceley Motorsport",           points = 324),
        TeamStanding(position = 8, name = "Toyota Gazoo Racing UK",                     points = 302),
        TeamStanding(position = 9, name = "Autobrite Direct with JourneyHero",          points = 110),
        TeamStanding(position = 10, name = "Laser Tools Racing",                        points =  74),
        TeamStanding(position = 11, name = "CarStore Power Maxed Racing",               points =  53),
        TeamStanding(position = 12, name = "Yazoo with Safuu.com Racing",               points =  48),
        TeamStanding(position = 13, name = "Apec Racing with Beavis Morgan",            points =  40),
        TeamStanding(position = 14, name = "UptonSteel with Euro Car Parts Racing",      points =   0),
    )
}
