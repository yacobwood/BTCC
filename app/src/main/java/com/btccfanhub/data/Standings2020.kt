package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2020 BTCC standings from race results. */
object Standings2020 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Ashley Sutton", team = "Infiniti Q50", car = "116", points = 341, wins = 5),
        DriverStanding(position =   2, name = "Tom Ingram", team = "Toyota Corolla GR Sport", car = "80", points = 331, wins = 3),
        DriverStanding(position =   3, name = "Colin Turkington", team = "BMW 330i M Sport", car = "1", points = 323, wins = 4),
        DriverStanding(position =   4, name = "Dan Cammish", team = "Honda Civic Type R", car = "27", points = 303, wins = 3),
        DriverStanding(position =   5, name = "Rory Butcher", team = "Ford Focus ST Mk 4", car = "6", points = 283, wins = 3),
        DriverStanding(position =   6, name = "Tom Oliphant", team = "BMW 330i M Sport", car = "15", points = 209, wins = 1),
        DriverStanding(position =   7, name = "Jake Hill", team = "Honda Civic Type R", car = "24", points = 201, wins = 0),
        DriverStanding(position =   8, name = "Josh Cook", team = "Honda Civic Type R", car = "66", points = 179, wins = 3),
        DriverStanding(position =   9, name = "Adam Morgan", team = "Mercedes-Benz A-Class", car = "33", points = 177, wins = 1),
        DriverStanding(position =  10, name = "Tom Chilton", team = "Honda Civic Type R", car = "3", points = 175, wins = 0),
        DriverStanding(position =  11, name = "Matt Neal", team = "Honda Civic Type R", car = "25", points = 159, wins = 0),
        DriverStanding(position =  12, name = "Senna Proctor", team = "Hyundai i30N", car = "18", points = 126, wins = 0),
        DriverStanding(position =  13, name = "Ollie Jackson", team = "Ford Focus ST Mk 4", car = "48", points = 124, wins = 1),
        DriverStanding(position =  14, name = "Chris Smiley", team = "Hyundai i30N", car = "22", points = 104, wins = 0),
        DriverStanding(position =  15, name = "Aiden Moffat", team = "Infiniti Q50", car = "16", points = 81, wins = 0),
        DriverStanding(position =  16, name = "Stephen Jelley", team = "BMW 125i M Sport", car = "12", points = 66, wins = 0),
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
        DriverStanding(position =  27, name = "Nic Hamilton", team = "Volkswagen CC", car = "28", points = 1, wins = 0),
        DriverStanding(position =  28, name = "Mike Bushell", team = "Volkswagen CC", car = "21", points = 1, wins = 0),
        DriverStanding(position =  29, name = "Paul Rivett", team = "Audi S3 Saloon", car = "222", points = 1, wins = 0),
        DriverStanding(position =  30, name = "Glynn Geddie", team = "Volkswagen CC", car = "88", points = 1, wins = 0),
        DriverStanding(position =  31, name = "Tom Onslow-Cole", team = "Volkswagen CC", car = "8", points = 0, wins = 0),
        DriverStanding(position =  32, name = "Jessica Hawkins", team = "Vauxhall Astra", car = "39", points = 0, wins = 0),
        DriverStanding(position =  33, name = "Ethan Hammerton", team = "Audi S3 Saloon", car = "23", points = 0, wins = 0),
        DriverStanding(position =  34, name = "Brad Philpot", team = "Vauxhall Astra", car = "49", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "Honda Civic Type R", points = 1092),
        TeamStanding(position =   2, name = "BMW 330i M Sport", points = 532),
        TeamStanding(position =   3, name = "Infiniti Q50", points = 422),
        TeamStanding(position =   4, name = "Ford Focus ST Mk 4", points = 410),
        TeamStanding(position =   5, name = "Toyota Corolla GR Sport", points = 331),
        TeamStanding(position =   6, name = "Hyundai i30N", points = 230),
        TeamStanding(position =   7, name = "Mercedes-Benz A-Class", points = 179),
        TeamStanding(position =   8, name = "BMW 125i M Sport", points = 78),
        TeamStanding(position =   9, name = "Audi S3 Saloon", points = 56),
        TeamStanding(position =  10, name = "Volkswagen CC", points = 17),
        TeamStanding(position =  11, name = "Vauxhall Astra", points = 13),
    )
}
