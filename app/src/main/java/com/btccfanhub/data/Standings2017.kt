package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2017 BTCC standings from race results. */
object Standings2017 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Ashley Sutton", team = "Subaru Levorg GT", car = "116", points = 411, wins = 6),
        DriverStanding(position =   2, name = "Colin Turkington", team = "BMW 125i M Sport", car = "4", points = 373, wins = 4),
        DriverStanding(position =   3, name = "Tom Ingram", team = "Toyota Avensis", car = "80", points = 333, wins = 4),
        DriverStanding(position =   4, name = "Gordon Shedden", team = "Honda Civic Type R", car = "52", points = 333, wins = 3),
        DriverStanding(position =   5, name = "Robert Collard", team = "BMW 125i M Sport", car = "5", points = 273, wins = 1),
        DriverStanding(position =   6, name = "Jack Goff", team = "Honda Civic Type R", car = "31", points = 257, wins = 1),
        DriverStanding(position =   7, name = "Matt Neal", team = "Honda Civic Type R", car = "25", points = 257, wins = 2),
        DriverStanding(position =   8, name = "Mat Jackson", team = "Ford Focus ST MK.III", car = "3", points = 217, wins = 1),
        DriverStanding(position =   9, name = "Andrew Jordan", team = "BMW 125i M Sport", car = "77", points = 212, wins = 3),
        DriverStanding(position =  10, name = "Adam Morgan", team = "Mercedes-Benz A-Class", car = "33", points = 194, wins = 0),
        DriverStanding(position =  11, name = "Rob Austin", team = "Toyota Avensis", car = "11", points = 177, wins = 1),
        DriverStanding(position =  12, name = "Jason Plato", team = "Subaru Levorg GT", car = "99", points = 152, wins = 1),
        DriverStanding(position =  13, name = "Aiden Moffat", team = "Mercedes-Benz A-Class", car = "16", points = 127, wins = 2),
        DriverStanding(position =  14, name = "Dave Newsham", team = "Chevrolet Cruze 4dr", car = "17", points = 108, wins = 0),
        DriverStanding(position =  15, name = "Tom Chilton", team = "Vauxhall Astra", car = "2", points = 103, wins = 0),
        DriverStanding(position =  16, name = "Josh Cook", team = "Mg6 Gt", car = "66", points = 84, wins = 0),
        DriverStanding(position =  17, name = "James Cole", team = "Subaru Levorg GT", car = "20", points = 82, wins = 1),
        DriverStanding(position =  18, name = "Michael Epps", team = "Volkswagen CC", car = "12", points = 77, wins = 0),
        DriverStanding(position =  19, name = "Jake Hill", team = "Volkswagen CC", car = "24", points = 65, wins = 0),
        DriverStanding(position =  20, name = "Senna Proctor", team = "Vauxhall Astra", car = "18", points = 62, wins = 0),
        DriverStanding(position =  21, name = "Chris Smiley", team = "Chevrolet Cruze 4dr", car = "22", points = 45, wins = 0),
        DriverStanding(position =  22, name = "Ollie Jackson", team = "Audi S3 Saloon", car = "48", points = 43, wins = 0),
        DriverStanding(position =  23, name = "Ant Whorton-Eales", team = "Audi S3 Saloon", car = "10", points = 33, wins = 0),
        DriverStanding(position =  24, name = "Matt Simpson", team = "Honda Civic Type R", car = "303", points = 30, wins = 0),
        DriverStanding(position =  25, name = "Rob Huff", team = "Vauxhall Astra", car = "37", points = 28, wins = 0),
        DriverStanding(position =  26, name = "Aron Taylor-Smith", team = "Mg6 Gt", car = "40", points = 25, wins = 0),
        DriverStanding(position =  27, name = "Jeff Smith", team = "Honda Civic Type R", car = "55", points = 24, wins = 0),
        DriverStanding(position =  28, name = "Martin Depper", team = "Ford Focus ST MK.III", car = "30", points = 21, wins = 0),
        DriverStanding(position =  29, name = "Rory Butcher", team = "Ford Focus ST MK.III", car = "6", points = 20, wins = 0),
        DriverStanding(position =  30, name = "Brett Smith", team = "Honda Civic Type R", car = "39", points = 13, wins = 0),
        DriverStanding(position =  31, name = "Josh Price", team = "Subaru Levorg GT", car = "28", points = 8, wins = 0),
        DriverStanding(position =  32, name = "Luke Davenport", team = "Ford Focus ST MK.III", car = "300", points = 6, wins = 0),
        DriverStanding(position =  33, name = "Daniel Lloyd", team = "Mg6 Gt", car = "23", points = 5, wins = 0),
        DriverStanding(position =  34, name = "Stephen Jelley", team = "Ford Focus ST MK.III", car = "7", points = 2, wins = 0),
        DriverStanding(position =  35, name = "Will Burns", team = "Volkswagen CC", car = "61", points = 0, wins = 0),
        DriverStanding(position =  36, name = "Dennis Strandberg", team = "Ford Focus ST MK.III", car = "95", points = 0, wins = 0),
        DriverStanding(position =  37, name = "Stewart Lines", team = "Ford Focus ST MK.III", car = "95", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "Honda Civic Type R", points = 914),
        TeamStanding(position =   2, name = "BMW 125i M Sport", points = 858),
        TeamStanding(position =   3, name = "Subaru Levorg GT", points = 653),
        TeamStanding(position =   4, name = "Toyota Avensis", points = 510),
        TeamStanding(position =   5, name = "Mercedes-Benz A-Class", points = 321),
        TeamStanding(position =   6, name = "Ford Focus ST MK.III", points = 266),
        TeamStanding(position =   7, name = "Vauxhall Astra", points = 193),
        TeamStanding(position =   8, name = "Chevrolet Cruze 4dr", points = 153),
        TeamStanding(position =   9, name = "Volkswagen CC", points = 142),
        TeamStanding(position =  10, name = "Mg6 Gt", points = 114),
        TeamStanding(position =  11, name = "Audi S3 Saloon", points = 76),
    )
}
