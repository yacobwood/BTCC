package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2020 BTCC standings from race results. */
object Standings2020 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Ashley Sutton", team = "Laser Tools Racing", car = "116", points = 341, wins = 5),
        DriverStanding(position =   2, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 331, wins = 3),
        DriverStanding(position =   3, name = "Colin Turkington", team = "West Surrey Racing", car = "1", points = 323, wins = 4),
        DriverStanding(position =   4, name = "Dan Cammish", team = "Halfords Yuasa Racing", car = "27", points = 303, wins = 3),
        DriverStanding(position =   5, name = "Rory Butcher", team = "Motorbase Performance", car = "6", points = 283, wins = 3),
        DriverStanding(position =   6, name = "Tom Oliphant", team = "West Surrey Racing", car = "15", points = 209, wins = 1),
        DriverStanding(position =   7, name = "Jake Hill", team = "BTC Racing", car = "24", points = 201, wins = 0),
        DriverStanding(position =   8, name = "Josh Cook", team = "BTC Racing", car = "66", points = 179, wins = 3),
        DriverStanding(position =   9, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 177, wins = 1),
        DriverStanding(position =  10, name = "Tom Chilton", team = "Motorbase Performance", car = "3", points = 175, wins = 0),
        DriverStanding(position =  11, name = "Matt Neal", team = "Halfords Yuasa Racing", car = "25", points = 159, wins = 0),
        DriverStanding(position =  12, name = "Senna Proctor", team = "Hyundai i30N", car = "18", points = 126, wins = 0),
        DriverStanding(position =  13, name = "Ollie Jackson", team = "Ford Focus ST Mk 4", car = "48", points = 124, wins = 1),
        DriverStanding(position =  14, name = "Chris Smiley", team = "Team Hard", car = "22", points = 104, wins = 0),
        DriverStanding(position =  15, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 81, wins = 0),
        DriverStanding(position =  16, name = "Stephen Jelley", team = "Team Parker Racing", car = "12", points = 66, wins = 0),
        DriverStanding(position =  17, name = "Michael Crees", team = "Honda Civic Type R", car = "777", points = 50, wins = 0),
        DriverStanding(position =  18, name = "Bobby Thompson", team = "Audi S3 Saloon", car = "19", points = 37, wins = 0),
        DriverStanding(position =  19, name = "Sam Osborne", team = "Honda Civic Type R", car = "4", points = 25, wins = 0),
        DriverStanding(position =  20, name = "James Gornall", team = "Audi S3 Saloon", car = "180", points = 18, wins = 0),
        DriverStanding(position =  21, name = "Rob Austin", team = "Vauxhall Astra", car = "10", points = 13, wins = 0),
        DriverStanding(position =  22, name = "Carl Boardley", team = "BMW 125i M Sport", car = "41", points = 12, wins = 0),
        DriverStanding(position =  23, name = "Jack Goff", team = "Volkswagen CC", car = "31", points = 11, wins = 0),
        DriverStanding(position =  24, name = "Andy Neate", team = "Ford Focus ST Mk 4", car = "44", points = 3, wins = 0),
        DriverStanding(position =  25, name = "Ollie Brown", team = "Volkswagen CC", car = "34", points = 3, wins = 0),
        DriverStanding(position =  26, name = "Jack Butel", team = "Mercedes-Benz A-Class", car = "32", points = 2, wins = 0),
        DriverStanding(position =  27, name = "Nic Hamilton", team = "Laser Tools Racing", car = "28", points = 1, wins = 0),
        DriverStanding(position =  28, name = "Mike Bushell", team = "Volkswagen CC", car = "21", points = 1, wins = 0),
        DriverStanding(position =  29, name = "Paul Rivett", team = "Audi S3 Saloon", car = "222", points = 1, wins = 0),
        DriverStanding(position =  30, name = "Glynn Geddie", team = "Volkswagen CC", car = "88", points = 1, wins = 0),
        DriverStanding(position =  31, name = "Tom Onslow-Cole", team = "Volkswagen CC", car = "8", points = 0, wins = 0),
        DriverStanding(position =  32, name = "Jessica Hawkins", team = "Vauxhall Astra", car = "39", points = 0, wins = 0),
        DriverStanding(position =  33, name = "Ethan Hammerton", team = "Audi S3 Saloon", car = "23", points = 0, wins = 0),
        DriverStanding(position =  34, name = "Brad Philpot", team = "Vauxhall Astra", car = "49", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "West Surrey Racing", points = 532),
        TeamStanding(position =   2, name = "Halfords Yuasa Racing", points = 462),
        TeamStanding(position =   3, name = "Motorbase Performance", points = 458),
        TeamStanding(position =   4, name = "Laser Tools Racing", points = 423),
        TeamStanding(position =   5, name = "BTC Racing", points = 380),
        TeamStanding(position =   6, name = "Speedworks Motorsport", points = 331),
        TeamStanding(position =   7, name = "WIX Racing", points = 177),
        TeamStanding(position =   8, name = "Ford Focus ST Mk 4", points = 127),
        TeamStanding(position =   9, name = "Hyundai i30N", points = 126),
        TeamStanding(position =  10, name = "Team Hard", points = 104),
        TeamStanding(position =  11, name = "Honda Civic Type R", points = 75),
        TeamStanding(position =  12, name = "Team Parker Racing", points = 66),
        TeamStanding(position =  13, name = "Audi S3 Saloon", points = 56),
        TeamStanding(position =  14, name = "Volkswagen CC", points = 16),
        TeamStanding(position =  15, name = "Vauxhall Astra", points = 13),
        TeamStanding(position =  16, name = "BMW 125i M Sport", points = 12),
        TeamStanding(position =  17, name = "Mercedes-Benz A-Class", points = 2),
    )
}
