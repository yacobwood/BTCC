package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2014 BTCC standings from Drivers and Teams (Excel). */
object Standings2014 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Colin Turkington", team = "eBay Motors", car = "5", points = 434, wins = 8),
        DriverStanding(position =  2, name = "Jason Plato", team = "MG KX Clubcard Fuel Save", car = "99", points = 399, wins = 6),
        DriverStanding(position =  3, name = "Gordon Shedden", team = "Honda Yuasa Racing", car = "52", points = 349, wins = 3),
        DriverStanding(position =  4, name = "Mat Jackson", team = "Airwaves Racing", car = "6", points = 316, wins = 2),
        DriverStanding(position =  5, name = "Andrew Jordan", team = "Pirtek Racing", car = "1", points = 310, wins = 4),
        DriverStanding(position =  6, name = "Rob Collard", team = "eBay Motors", car = "10", points = 277, wins = 1),
        DriverStanding(position =  7, name = "Sam Tordoff", team = "MG KX Clubcard Fuel Save", car = "88", points = 255, wins = 1),
        DriverStanding(position =  8, name = "Matt Neal", team = "Honda Yuasa Racing", car = "4", points = 207, wins = 1),
        DriverStanding(position =  9, name = "Árón Smith", team = "CHROME Edition Restart Racing", car = "40", points = 201, wins = 2),
        DriverStanding(position = 10, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 185, wins = 1),
        DriverStanding(position = 11, name = "Alain Menu", team = "CHROME Edition Restart Racing", car = "9", points = 176, wins = 0),
        DriverStanding(position = 12, name = "Rob Austin", team = "Exocet Racing", car = "101", points = 147, wins = 1),
        DriverStanding(position = 13, name = "Fabrizio Giovanardi", team = "Airwaves Racing", car = "7", points = 138, wins = 0),
        DriverStanding(position = 14, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 121, wins = 0),
        DriverStanding(position = 15, name = "Jack Goff", team = "CHROME Edition Restart Racing", teamSecondary = "RCIB Insurance Racing", car = "31", points = 119, wins = 0),
        DriverStanding(position = 16, name = "Nick Foster", team = "eBay Motors", car = "18", points = 101, wins = 0),
        DriverStanding(position = 17, name = "Dave Newsham", team = "AmD Tuning.com", car = "17", points = 70, wins = 0),
        DriverStanding(position = 18, name = "Marc Hynes", team = "Quantel BiFold Racing", car = "888", points = 54, wins = 0),
        DriverStanding(position = 19, name = "Jack Clarke", team = "Crabbie's Racing", car = "44", points = 50, wins = 0),
        DriverStanding(position = 20, name = "Hunter Abbott", team = "AlcoSense Breathalysers Racing", car = "54", points = 20, wins = 0),
        DriverStanding(position = 21, name = "Warren Scott", team = "CHROME Edition Restart Racing", car = "39", points = 19, wins = 0),
        DriverStanding(position = 22, name = "Glynn Geddie", team = "United Autosports", car = "21", points = 15, wins = 0),
        DriverStanding(position = 23, name = "Martin Depper", team = "Pirtek Racing", car = "30", points = 14, wins = 0),
        DriverStanding(position = 24, name = "Lea Wood", team = "Houseman Racing", car = "43", points = 10, wins = 0),
        DriverStanding(position = 25, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 6, wins = 0),
        DriverStanding(position = 26, name = "James Cole", team = "United Autosports", car = "20", points = 5, wins = 0),
        DriverStanding(position = 27, name = "Robb Holland", team = "Rotek Racing", car = "67", points = 2, wins = 0),
        DriverStanding(position = 28, name = "Ollie Jackson", team = "STP Racing with Sopp & Sopp", car = "48", points = 0, wins = 0),
        DriverStanding(position = 29, name = "Luke Hines", team = "United Autosports", car = "23", points = 0, wins = 0),
        DriverStanding(position = 30, name = "Simon Belcher", team = "Handy Motorsport", car = "11", points = 0, wins = 0),
        DriverStanding(position = 31, name = "Chris Stockton", team = "Power Maxed Racing", car = "28", points = 0, wins = 0),
        DriverStanding(position = 32, name = "Daniel Welch", team = "STP Racing with Sopp & Sopp", car = "12", points = -40, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "eBay Motors", points = 724),
        TeamStanding(position = 2, name = "MG KX Clubcard Fuel Save", points = 643),
        TeamStanding(position = 3, name = "Honda Yuasa Racing", points = 555),
        TeamStanding(position = 4, name = "Airwaves Racing", points = 465),
        TeamStanding(position = 5, name = "CHROME Edition Restart Racing", points = 417),
        TeamStanding(position = 6, name = "Pirtek Racing", points = 325),
        TeamStanding(position = 7, name = "WIX Racing", points = 190),
        TeamStanding(position = 8, name = "Exocet Racing", points = 146),
        TeamStanding(position = 9, name = "Speedworks Motorsport", points = 124),
        TeamStanding(position = 10, name = "AmD Tuning.com", points = 76),
        TeamStanding(position = 11, name = "RCIB Insurance Racing", points = 69),
        TeamStanding(position = 12, name = "Quantel BiFold Racing", points = 67),
        TeamStanding(position = 13, name = "Crabbie's Racing", points = 57),
        TeamStanding(position = 14, name = "United Autosports", points = 22),
        TeamStanding(position = 15, name = "AlcoSense Breathalysers Racing", points = 22),
        TeamStanding(position = 16, name = "Houseman Racing", points = 13),
        TeamStanding(position = 17, name = "Laser Tools Racing", points = 11),
        TeamStanding(position = 18, name = "Rotek Racing", points = 4),
        TeamStanding(position = 19, name = "Handy Motorsport", points = 0),
        TeamStanding(position = 20, name = "Power Maxed Racing", points = 0),
        TeamStanding(position = 21, name = "STP Racing with Sopp & Sopp", points = 0),
    )
}
