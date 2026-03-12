package com.btcchub.data

import com.btcchub.data.model.DriverStanding
import com.btcchub.data.model.TeamStanding

/** Final 2019 BTCC Drivers' Championship standings (Wikipedia). */
object Standings2019 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =  1, name = "Colin Turkington",   team = "Team BMW", car = "1",   points = 320, wins = 5),
        DriverStanding(position =  2, name = "Andrew Jordan",      team = "BMW Pirtek Racing", car = "77",  points = 318, wins = 6),
        DriverStanding(position =  3, name = "Dan Cammish",        team = "Halfords Yuasa Racing", car = "27",  points = 318, wins = 2),
        DriverStanding(position =  4, name = "Josh Cook",          team = "BTC Racing", car = "66",  points = 278, wins = 3),
        DriverStanding(position =  5, name = "Rory Butcher",       team = "Cobra Sport AmD AutoAid/RCIB Insurance", car = "6",   points = 266, wins = 3),
        DriverStanding(position =  6, name = "Tom Ingram",         team = "Team Toyota GB with Ginsters", car = "80",  points = 245, wins = 4),
        DriverStanding(position =  7, name = "Jason Plato",        team = "Sterling Insurance with Power Maxed Racing", car = "11",  points = 237, wins = 1),
        DriverStanding(position =  8, name = "Ashley Sutton",      team = "Adrian Flux Subaru Racing", car = "116", points = 233, wins = 1),
        DriverStanding(position =  9, name = "Matt Neal",          team = "Halfords Yuasa Racing", car = "25",  points = 232, wins = 0),
        DriverStanding(position = 10, name = "Tom Chilton",       team = "Team Shredded Wheat Racing with Gallagher", car = "3",   points = 200, wins = 1),
        DriverStanding(position = 11, name = "Tom Oliphant",       team = "Team BMW", car = "15",  points = 178, wins = 0),
        DriverStanding(position = 12, name = "Adam Morgan",       team = "Mac Tools with Ciceley Motorsport", car = "33",  points = 155, wins = 0),
        DriverStanding(position = 13, name = "Sam Tordoff",       team = "Cobra Sport AmD AutoAid/RCIB Insurance", car = "600", points = 147, wins = 1),
        DriverStanding(position = 14, name = "Chris Smiley",       team = "BTC Racing", car = "22",  points = 132, wins = 0),
        DriverStanding(position = 15, name = "Jake Hill",         team = "TradePriceCars.com", car = "24",  points = 131, wins = 1),
        DriverStanding(position = 16, name = "Rob Collard",       team = "Sterling Insurance with Power Maxed Racing", car = "9",   points = 118, wins = 0),
        DriverStanding(position = 17, name = "Stephen Jelley",    team = "Team Parker Racing", car = "12",  points = 105, wins = 1),
        DriverStanding(position = 18, name = "Aiden Moffat",      team = "Laser Tools Racing", car = "16",  points =  89, wins = 0),
        DriverStanding(position = 19, name = "Ollie Jackson",     team = "Team Shredded Wheat Racing with Gallagher", car = "48",  points =  81, wins = 0),
        DriverStanding(position = 20, name = "Senna Proctor",     team = "Adrian Flux Subaru Racing", car = "18",  points =  49, wins = 0),
        DriverStanding(position = 21, name = "Jack Goff",         team = "RCIB Insurance with Fox Transport", car = "31",  points =  47, wins = 1),
        DriverStanding(position = 22, name = "Bobby Thompson",    team = "GKR Scaffolding with Autobrite Direct", car = "19",  points =  35, wins = 0),
        DriverStanding(position = 23, name = "Matt Simpson",      team = "Simpson Racing", car = "303", points =  33, wins = 0),
        DriverStanding(position = 24, name = "Mike Bushell",      team = "Cobra Sport AmD AutoAid/RCIB Insurance", car = "12",  points =  27, wins = 0),
        DriverStanding(position = 25, name = "Michael Caine",     team = "Motorbase Performance", car = "27",  points =  16, wins = 0),
        DriverStanding(position = 26, name = "Michael Crees",     team = "GKR Scaffolding with Autobrite Direct", car = "99",  points =  11, wins = 0),
        DriverStanding(position = 27, name = "Mark Blundell",     team = "TradePriceCars.com", car = "8",   points =   5, wins = 0),
        DriverStanding(position = 28, name = "Daniel Rowbottom",  team = "Cataclean Racing with Ciceley Motorsport", car = "32",  points =   5, wins = 0),
        DriverStanding(position = 29, name = "Carl Boardley",     team = "RCIB Insurance with Fox Transport", car = "41",  points =   5, wins = 0),
        DriverStanding(position = 30, name = "Rob Smith",         team = "Excelr8 Motorsport", car = "40",  points =   2, wins = 0),
        DriverStanding(position = 31, name = "Sam Osborne",       team = "Excelr8 Motorsport", car = "4",   points =   2, wins = 0),
        DriverStanding(position = 32, name = "Nicolas Hamilton",  team = "ROKiT Racing with Motorbase", car = "28",  points =   0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position = 1, name = "Halfords Yuasa Racing",              points = 543),
        TeamStanding(position = 2, name = "Team BMW",                            points = 480),
        TeamStanding(position = 3, name = "Cobra Sport AmD AutoAid/RCIB Insurance", points = 426),
        TeamStanding(position = 4, name = "BTC Racing",                         points = 402),
        TeamStanding(position = 5, name = "Sterling Insurance with Power Maxed Racing", points = 348),
        TeamStanding(position = 6, name = "BMW Pirtek Racing",                  points = 307),
        TeamStanding(position = 7, name = "Team Shredded Wheat Racing with Gallagher", points = 279),
        TeamStanding(position = 8, name = "Adrian Flux Subaru Racing",          points = 275),
        TeamStanding(position = 9, name = "Team Toyota GB with Ginsters",        points = 238),
        TeamStanding(position = 10, name = "Mac Tools with Ciceley Motorsport",  points = 155),
        TeamStanding(position = 11, name = "TradePriceCars.com",                 points = 133),
        TeamStanding(position = 12, name = "Team Parker Racing",                 points =  92),
        TeamStanding(position = 13, name = "Laser Tools Racing",                 points =  89),
        TeamStanding(position = 14, name = "RCIB Insurance with Fox Transport", points =  50),
        TeamStanding(position = 15, name = "GKR Scaffolding with Autobrite Direct", points = 45),
        TeamStanding(position = 16, name = "Simpson Racing",                     points =  33),
        TeamStanding(position = 17, name = "Motorbase Performance",             points =  16),
        TeamStanding(position = 18, name = "Cataclean Racing with Ciceley Motorsport", points = 5),
        TeamStanding(position = 19, name = "Excelr8 Motorsport",                points =   4),
        TeamStanding(position = 20, name = "ROKiT Racing with Motorbase",       points =   0),
    )
}
