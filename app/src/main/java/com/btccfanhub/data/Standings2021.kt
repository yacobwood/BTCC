package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2021 BTCC Drivers' Championship standings (Wikipedia). */
object Standings2021 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Ashley Sutton",      team = "Laser Tools Racing", car = "1",   points = 357, wins = 5),
        DriverStanding(position =  2, name = "Colin Turkington",    team = "Team BMW", car = "2",   points = 306, wins = 4),
        DriverStanding(position =  3, name = "Josh Cook",           team = "BTC Racing", car = "66",  points = 303, wins = 5),
        DriverStanding(position =  4, name = "Tom Ingram",          team = "Ginsters Excelr8 with TradePriceCars.com", car = "80",  points = 300, wins = 3),
        DriverStanding(position =  5, name = "Jake Hill",          team = "MB Motorsport accelerated by Blue Square", car = "24",  points = 295, wins = 2),
        DriverStanding(position =  6, name = "Gordon Shedden",      team = "Halfords Racing with Cataclean", car = "52",  points = 251, wins = 2),
        DriverStanding(position =  7, name = "Rory Butcher",       team = "Toyota Gazoo Racing UK", car = "6",   points = 247, wins = 3),
        DriverStanding(position =  8, name = "Aiden Moffat",       team = "Laser Tools Racing", car = "16",  points = 230, wins = 1),
        DriverStanding(position =  9, name = "Daniel Rowbottom",   team = "Halfords Racing with Cataclean", car = "32",  points = 222, wins = 1),
        DriverStanding(position = 10, name = "Senna Proctor",       team = "BTC Racing", car = "18",  points = 206, wins = 1),
        DriverStanding(position = 11, name = "Daniel Lloyd",        team = "Adrian Flux with Power Maxed Racing", car = "123", points = 190, wins = 0),
        DriverStanding(position = 12, name = "Stephen Jelley",     team = "Team BMW", car = "12",  points = 174, wins = 0),
        DriverStanding(position = 13, name = "Adam Morgan",        team = "Car Gods with Ciceley Motorsport", car = "33",  points = 161, wins = 2),
        DriverStanding(position = 14, name = "Jason Plato",         team = "Adrian Flux with Power Maxed Racing", car = "11",  points = 156, wins = 0),
        DriverStanding(position = 15, name = "Chris Smiley",        team = "Ginsters Excelr8 with TradePriceCars.com", car = "22",  points = 138, wins = 0),
        DriverStanding(position = 16, name = "Tom Oliphant",        team = "Team BMW", car = "15",  points = 129, wins = 1),
        DriverStanding(position = 17, name = "Jack Goff",           team = "Team HARD with Autobrite Direct", car = "31",  points =  90, wins = 0),
        DriverStanding(position = 18, name = "Ollie Jackson",       team = "MB Motorsport accelerated by Blue Square", car = "48",  points =  77, wins = 0),
        DriverStanding(position = 19, name = "Tom Chilton",         team = "Car Gods with Ciceley Motorsport", car = "3",   points =  64, wins = 0),
        DriverStanding(position = 20, name = "Árón Taylor-Smith",   team = "Team HARD with Autobrite Direct", car = "40",  points =  33, wins = 0),
        DriverStanding(position = 21, name = "Dan Cammish",         team = "BTC Racing", car = "27",  points =  30, wins = 0),
        DriverStanding(position = 22, name = "Carl Boardley",       team = "Laser Tools Racing", car = "41",  points =  29, wins = 0),
        DriverStanding(position = 23, name = "Sam Osborne",        team = "Racing with Wera & Photon Group", car = "4",   points =  17, wins = 0),
        DriverStanding(position = 24, name = "Sam Smelt",          team = "Toyota Gazoo Racing UK", car = "18",  points =   5, wins = 0),
        DriverStanding(position = 25, name = "Jack Butel",         team = "Ginsters Excelr8 with TradePriceCars.com", car = "96",  points =   4, wins = 0),
        DriverStanding(position = 26, name = "Jade Edwards",      team = "PHSC with BTC Racing", car = "9",   points =   1, wins = 0),
        DriverStanding(position = 27, name = "Rick Parfitt Jr.",   team = "Ginsters Excelr8 with TradePriceCars.com", car = "62",  points =   0, wins = 0),
        DriverStanding(position = 28, name = "Jack Mitchell",      team = "Team HARD with Autobrite Direct", car = "44",  points =   0, wins = 0),
        DriverStanding(position = 29, name = "Nicolas Hamilton",    team = "Team HARD with Autobrite Direct", car = "28",  points =   0, wins = 0),
        DriverStanding(position = 30, name = "Andy Neate",         team = "MB Motorsport accelerated by Blue Square", car = "44",  points =   0, wins = 0),
        DriverStanding(position = 31, name = "Paul Rivett",        team = "Racing with Wera & Photon Group", car = "99",  points =   0, wins = 0),
        DriverStanding(position = 32, name = "Andy Wilmot",        team = "Ginsters Excelr8 with TradePriceCars.com", car = "19",  points =   0, wins = 0),
        DriverStanding(position = 33, name = "Jessica Hawkins",    team = "Racing with Wera & Photon Group", car = "26",  points =   0, wins = 0),
        DriverStanding(position = 34, name = "Nick Halstead",       team = "Ginsters Excelr8 with TradePriceCars.com", car = "22",  points =   0, wins = 0),
        DriverStanding(position = 35, name = "Glynn Geddie",       team = "Team HARD with Autobrite Direct", car = "88",  points =   0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Laser Tools Racing",                    points = 588),
        TeamStanding(position = 2, name = "BTC Racing",                           points = 531),
        TeamStanding(position = 3, name = "Halfords Racing with Cataclean",        points = 472),
        TeamStanding(position = 4, name = "Team BMW",                              points = 460),
        TeamStanding(position = 5, name = "Ginsters Excelr8 with TradePriceCars.com", points = 445),
        TeamStanding(position = 6, name = "MB Motorsport accelerated by Blue Square", points = 384),
        TeamStanding(position = 7, name = "Adrian Flux with Power Maxed Racing",   points = 362),
        TeamStanding(position = 8, name = "Toyota Gazoo Racing UK",                points = 252),
        TeamStanding(position = 9, name = "Car Gods with Ciceley Motorsport",      points = 242),
        TeamStanding(position = 10, name = "Team HARD with Autobrite Direct",      points = 94),
        TeamStanding(position = 11, name = "Team HARD with HUB Financial Solutions", points = 47),
        TeamStanding(position = 12, name = "Racing with Wera & Photon Group",       points = 28),
        TeamStanding(position = 13, name = "Excelr8 with TradePriceCars.com",       points = 12),
        TeamStanding(position = 14, name = "PHSC with BTC Racing",                  points = 3),
        TeamStanding(position = 15, name = "ROKiT Racing with iQuoto Online Trading", points = 0),
    )
}
