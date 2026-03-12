package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2019 BTCC standings from Drivers and Teams (Excel). */
object Standings2019 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Colin Turkington", team = "", car = "", points = 320, wins = 5),
        DriverStanding(position =  2, name = "Andrew Jordan", team = "", car = "", points = 318, wins = 6),
        DriverStanding(position =  3, name = "Dan Cammish", team = "", car = "", points = 318, wins = 2),
        DriverStanding(position =  4, name = "Josh Cook", team = "", car = "", points = 278, wins = 3),
        DriverStanding(position =  5, name = "Rory Butcher", team = "", car = "", points = 266, wins = 3),
        DriverStanding(position =  6, name = "Tom Ingram", team = "", car = "", points = 245, wins = 4),
        DriverStanding(position =  7, name = "Jason Plato", team = "", car = "", points = 237, wins = 1),
        DriverStanding(position =  8, name = "Ashley Sutton", team = "", car = "", points = 233, wins = 1),
        DriverStanding(position =  9, name = "Matt Neal", team = "", car = "", points = 232, wins = 0),
        DriverStanding(position = 10, name = "Tom Chilton", team = "", car = "", points = 200, wins = 1),
        DriverStanding(position = 11, name = "Tom Oliphant", team = "", car = "", points = 178, wins = 0),
        DriverStanding(position = 12, name = "Adam Morgan", team = "", car = "", points = 155, wins = 0),
        DriverStanding(position = 13, name = "Sam Tordoff", team = "", car = "", points = 147, wins = 1),
        DriverStanding(position = 14, name = "Chris Smiley", team = "", car = "", points = 132, wins = 0),
        DriverStanding(position = 15, name = "Jake Hill", team = "", car = "", points = 131, wins = 1),
        DriverStanding(position = 16, name = "Rob Collard", team = "", car = "", points = 118, wins = 0),
        DriverStanding(position = 17, name = "Stephen Jelley", team = "", car = "", points = 105, wins = 1),
        DriverStanding(position = 18, name = "Aiden Moffat", team = "", car = "", points = 89, wins = 0),
        DriverStanding(position = 19, name = "Ollie Jackson", team = "", car = "", points = 81, wins = 0),
        DriverStanding(position = 20, name = "Senna Proctor", team = "", car = "", points = 49, wins = 0),
        DriverStanding(position = 21, name = "Jack Goff", team = "", car = "", points = 47, wins = 1),
        DriverStanding(position = 22, name = "Bobby Thompson", team = "", car = "", points = 35, wins = 0),
        DriverStanding(position = 23, name = "Matt Simpson", team = "", car = "", points = 33, wins = 0),
        DriverStanding(position = 24, name = "Mike Bushell", team = "", car = "", points = 27, wins = 0),
        DriverStanding(position = 25, name = "Michael Caine", team = "", car = "", points = 16, wins = 0),
        DriverStanding(position = 26, name = "Michael Crees", team = "", car = "", points = 11, wins = 0),
        DriverStanding(position = 27, name = "Mark Blundell", team = "", car = "", points = 5, wins = 0),
        DriverStanding(position = 28, name = "Daniel Rowbottom", team = "", car = "", points = 5, wins = 0),
        DriverStanding(position = 29, name = "Carl Boardley", team = "", car = "", points = 5, wins = 0),
        DriverStanding(position = 30, name = "Rob Smith", team = "", car = "", points = 2, wins = 0),
        DriverStanding(position = 31, name = "Sam Osborne", team = "", car = "", points = 2, wins = 0),
        DriverStanding(position = 32, name = "Nicolas Hamilton", team = "", car = "", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Halfords Yuasa Racing", points = 543),
        TeamStanding(position = 2, name = "Team BMW", points = 480),
        TeamStanding(position = 3, name = "Cobra Sport AmD AutoAid/RCIB Insurance", points = 426),
        TeamStanding(position = 4, name = "BTC Racing", points = 402),
        TeamStanding(position = 5, name = "Sterling Insurance with Power Maxed Racing", points = 348),
        TeamStanding(position = 6, name = "BMW Pirtek Racing", points = 307),
        TeamStanding(position = 7, name = "Team Shredded Wheat Racing with Gallagher", points = 279),
        TeamStanding(position = 8, name = "Adrian Flux Subaru Racing", points = 275),
        TeamStanding(position = 9, name = "Team Toyota GB with Ginsters", points = 238),
        TeamStanding(position = 10, name = "Mac Tools with Ciceley Motorsport", points = 155),
        TeamStanding(position = 11, name = "TradePriceCars.com", points = 133),
        TeamStanding(position = 12, name = "Team Parker Racing", points = 92),
        TeamStanding(position = 13, name = "Laser Tools Racing", points = 89),
        TeamStanding(position = 14, name = "RCIB Insurance with Fox Transport", points = 50),
        TeamStanding(position = 15, name = "GKR Scaffolding with Autobrite Direct", points = 45),
        TeamStanding(position = 16, name = "Simpson Racing", points = 33),
        TeamStanding(position = 17, name = "Motorbase Performance", points = 16),
        TeamStanding(position = 18, name = "Cataclean Racing with Ciceley Motorsport", points = 5),
        TeamStanding(position = 19, name = "Excelr8 Motorsport", points = 4),
        TeamStanding(position = 20, name = "RoKit Racing with Motorbase", points = 0),
    )
}
