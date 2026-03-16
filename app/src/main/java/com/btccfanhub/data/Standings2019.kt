package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2019 BTCC standings from race results. */
object Standings2019 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Andrew Jordan", team = "West Surrey Racing", car = "77", points = 348, wins = 6),
        DriverStanding(position =   2, name = "Dan Cammish", team = "Halfords Yuasa Racing", car = "27", points = 344, wins = 2),
        DriverStanding(position =   3, name = "Colin Turkington", team = "West Surrey Racing", car = "1", points = 340, wins = 5),
        DriverStanding(position =   4, name = "Josh Cook", team = "BTC Racing", car = "66", points = 295, wins = 3),
        DriverStanding(position =   5, name = "Rory Butcher", team = "Motorbase Performance", car = "6", points = 281, wins = 3),
        DriverStanding(position =   6, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 258, wins = 4),
        DriverStanding(position =   7, name = "Jason Plato", team = "Power Maxed Racing", car = "11", points = 241, wins = 1),
        DriverStanding(position =   8, name = "Matt Neal", team = "Halfords Yuasa Racing", car = "25", points = 240, wins = 0),
        DriverStanding(position =   9, name = "Ashley Sutton", team = "Adrian Flux Subaru Racing", car = "116", points = 240, wins = 1),
        DriverStanding(position =  10, name = "Tom Chilton", team = "Motorbase Performance", car = "3", points = 209, wins = 1),
        DriverStanding(position =  11, name = "Tom Oliphant", team = "West Surrey Racing", car = "15", points = 178, wins = 0),
        DriverStanding(position =  12, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 161, wins = 0),
        DriverStanding(position =  13, name = "Sam Tordoff", team = "Team Hard", car = "600", points = 151, wins = 1),
        DriverStanding(position =  14, name = "Chris Smiley", team = "Team Hard", car = "22", points = 137, wins = 0),
        DriverStanding(position =  15, name = "Jake Hill", team = "BTC Racing", car = "24", points = 136, wins = 1),
        DriverStanding(position =  16, name = "Robert Collard", team = "Laser Tools Racing", car = "9", points = 122, wins = 0),
        DriverStanding(position =  17, name = "Stephen Jelley", team = "Team Parker Racing", car = "12", points = 108, wins = 1),
        DriverStanding(position =  18, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 92, wins = 0),
        DriverStanding(position =  19, name = "Ollie Jackson", team = "Ford Focus RS", car = "48", points = 81, wins = 0),
        DriverStanding(position =  20, name = "Jack Goff", team = "AmD Tuning with Cobra Exhausts", car = "31", points = 50, wins = 1),
        DriverStanding(position =  21, name = "Senna Proctor", team = "Subaru Levorg GT", car = "18", points = 49, wins = 0),
        DriverStanding(position =  22, name = "Bobby Thompson", team = "Volkswagen CC", car = "19", points = 34, wins = 0),
        DriverStanding(position =  23, name = "Matt Simpson", team = "Honda Civic Type R", car = "303", points = 33, wins = 0),
        DriverStanding(position =  24, name = "Mike Bushell", team = "Honda Civic Type R", car = "21", points = 26, wins = 0),
        DriverStanding(position =  25, name = "Michael Caine", team = "Ford Focus RS", car = "44", points = 16, wins = 0),
        DriverStanding(position =  26, name = "Michael Crees", team = "Volkswagen CC", car = "777", points = 11, wins = 0),
        DriverStanding(position =  27, name = "Mark Blundell", team = "Audi S3 Saloon", car = "8", points = 5, wins = 0),
        DriverStanding(position =  28, name = "Daniel Rowbottom", team = "BTC Racing", car = "32", points = 5, wins = 0),
        DriverStanding(position =  29, name = "Carl Boardley", team = "Volkswagen CC", car = "41", points = 5, wins = 0),
        DriverStanding(position =  30, name = "Sam Osborne", team = "Mg6 Gt", car = "4", points = 2, wins = 0),
        DriverStanding(position =  31, name = "Rob Smith", team = "Mg6 Gt", car = "37", points = 2, wins = 0),
        DriverStanding(position =  32, name = "Nic Hamilton", team = "Ford Focus RS", car = "28", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "West Surrey Racing", points = 866),
        TeamStanding(position =   2, name = "Halfords Yuasa Racing", points = 584),
        TeamStanding(position =   3, name = "Motorbase Performance", points = 490),
        TeamStanding(position =   4, name = "BTC Racing", points = 436),
        TeamStanding(position =   5, name = "Team Hard", points = 288),
        TeamStanding(position =   6, name = "Speedworks Motorsport", points = 258),
        TeamStanding(position =   7, name = "Power Maxed Racing", points = 241),
        TeamStanding(position =   8, name = "Adrian Flux Subaru Racing", points = 240),
        TeamStanding(position =   9, name = "Laser Tools Racing", points = 214),
        TeamStanding(position =  10, name = "WIX Racing", points = 161),
        TeamStanding(position =  11, name = "Team Parker Racing", points = 108),
        TeamStanding(position =  12, name = "Ford Focus RS", points = 97),
        TeamStanding(position =  13, name = "Honda Civic Type R", points = 59),
        TeamStanding(position =  14, name = "Volkswagen CC", points = 50),
        TeamStanding(position =  15, name = "AmD Tuning with Cobra Exhausts", points = 50),
        TeamStanding(position =  16, name = "Subaru Levorg GT", points = 49),
        TeamStanding(position =  17, name = "Audi S3 Saloon", points = 5),
        TeamStanding(position =  18, name = "Mg6 Gt", points = 4),
    )
}
