package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2019 BTCC standings from race results. */
object Standings2019 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Andrew Jordan", team = "BMW 330i M Sport", car = "77", points = 348, wins = 6),
        DriverStanding(position =   2, name = "Dan Cammish", team = "Honda Civic Type R", car = "27", points = 344, wins = 2),
        DriverStanding(position =   3, name = "Colin Turkington", team = "BMW 330i M Sport", car = "1", points = 340, wins = 5),
        DriverStanding(position =   4, name = "Josh Cook", team = "Honda Civic Type R", car = "66", points = 295, wins = 3),
        DriverStanding(position =   5, name = "Rory Butcher", team = "Honda Civic Type R", car = "6", points = 281, wins = 3),
        DriverStanding(position =   6, name = "Tom Ingram", team = "Toyota Corolla GR Sport", car = "80", points = 258, wins = 4),
        DriverStanding(position =   7, name = "Jason Plato", team = "Vauxhall Astra", car = "11", points = 241, wins = 1),
        DriverStanding(position =   8, name = "Matt Neal", team = "Honda Civic Type R", car = "25", points = 240, wins = 0),
        DriverStanding(position =   9, name = "Ashley Sutton", team = "Subaru Levorg GT", car = "116", points = 240, wins = 1),
        DriverStanding(position =  10, name = "Tom Chilton", team = "Ford Focus RS", car = "3", points = 209, wins = 1),
        DriverStanding(position =  11, name = "Tom Oliphant", team = "BMW 330i M Sport", car = "15", points = 178, wins = 0),
        DriverStanding(position =  12, name = "Adam Morgan", team = "Mercedes-Benz A-Class", car = "33", points = 161, wins = 0),
        DriverStanding(position =  13, name = "Sam Tordoff", team = "Honda Civic Type R", car = "600", points = 151, wins = 1),
        DriverStanding(position =  14, name = "Chris Smiley", team = "Honda Civic Type R", car = "22", points = 137, wins = 0),
        DriverStanding(position =  15, name = "Jake Hill", team = "Audi S3 Saloon", car = "24", points = 136, wins = 1),
        DriverStanding(position =  16, name = "Robert Collard", team = "Vauxhall Astra", car = "9", points = 122, wins = 0),
        DriverStanding(position =  17, name = "Stephen Jelley", team = "BMW 125i M Sport", car = "12", points = 108, wins = 1),
        DriverStanding(position =  18, name = "Aiden Moffat", team = "Mercedes-Benz A-Class", car = "16", points = 92, wins = 0),
        DriverStanding(position =  19, name = "Ollie Jackson", team = "Ford Focus RS", car = "48", points = 81, wins = 0),
        DriverStanding(position =  20, name = "Jack Goff", team = "Volkswagen CC", car = "31", points = 50, wins = 1),
        DriverStanding(position =  21, name = "Senna Proctor", team = "Subaru Levorg GT", car = "18", points = 49, wins = 0),
        DriverStanding(position =  22, name = "Bobby Thompson", team = "Volkswagen CC", car = "19", points = 34, wins = 0),
        DriverStanding(position =  23, name = "Matt Simpson", team = "Honda Civic Type R", car = "303", points = 33, wins = 0),
        DriverStanding(position =  24, name = "Mike Bushell", team = "Honda Civic Type R", car = "21", points = 26, wins = 0),
        DriverStanding(position =  25, name = "Michael Caine", team = "Ford Focus RS", car = "44", points = 16, wins = 0),
        DriverStanding(position =  26, name = "Michael Crees", team = "Volkswagen CC", car = "777", points = 11, wins = 0),
        DriverStanding(position =  27, name = "Mark Blundell", team = "Audi S3 Saloon", car = "8", points = 5, wins = 0),
        DriverStanding(position =  28, name = "Daniel Rowbottom", team = "Mercedes-Benz A-Class", car = "32", points = 5, wins = 0),
        DriverStanding(position =  29, name = "Carl Boardley", team = "Volkswagen CC", car = "41", points = 5, wins = 0),
        DriverStanding(position =  30, name = "Sam Osborne", team = "Mg6 Gt", car = "4", points = 2, wins = 0),
        DriverStanding(position =  31, name = "Rob Smith", team = "Mg6 Gt", car = "37", points = 2, wins = 0),
        DriverStanding(position =  32, name = "Nic Hamilton", team = "Ford Focus RS", car = "28", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "Honda Civic Type R", points = 1507),
        TeamStanding(position =   2, name = "BMW 330i M Sport", points = 866),
        TeamStanding(position =   3, name = "Vauxhall Astra", points = 363),
        TeamStanding(position =   4, name = "Ford Focus RS", points = 306),
        TeamStanding(position =   5, name = "Subaru Levorg GT", points = 289),
        TeamStanding(position =   6, name = "Mercedes-Benz A-Class", points = 258),
        TeamStanding(position =   7, name = "Toyota Corolla GR Sport", points = 258),
        TeamStanding(position =   8, name = "Audi S3 Saloon", points = 141),
        TeamStanding(position =   9, name = "BMW 125i M Sport", points = 108),
        TeamStanding(position =  10, name = "Volkswagen CC", points = 100),
        TeamStanding(position =  11, name = "Mg6 Gt", points = 4),
    )
}
