package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2016 BTCC standings from race results. */
object Standings2016 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Gordon Shedden", team = "Honda Civic Type R", car = "52", points = 331, wins = 4),
        DriverStanding(position =   2, name = "Sam Tordoff", team = "BMW 125i M Sport", car = "600", points = 328, wins = 2),
        DriverStanding(position =   3, name = "Mat Jackson", team = "Ford Focus ST MK.III", car = "7", points = 319, wins = 5),
        DriverStanding(position =   4, name = "Colin Turkington", team = "Subaru Levorg GT", car = "4", points = 314, wins = 5),
        DriverStanding(position =   5, name = "Matt Neal", team = "Honda Civic Type R", car = "25", points = 293, wins = 3),
        DriverStanding(position =   6, name = "Robert Collard", team = "BMW 125i M Sport", car = "100", points = 288, wins = 2),
        DriverStanding(position =   7, name = "Jason Plato", team = "Subaru Levorg GT", car = "99", points = 270, wins = 1),
        DriverStanding(position =   8, name = "Andrew Jordan", team = "Ford Focus ST MK.III", car = "77", points = 269, wins = 2),
        DriverStanding(position =   9, name = "Adam Morgan", team = "Mercedes-Benz A-Class", car = "33", points = 249, wins = 2),
        DriverStanding(position =  10, name = "Tom Ingram", team = "Toyota Avensis", car = "80", points = 229, wins = 2),
        DriverStanding(position =  11, name = "Jack Goff", team = "BMW 125i M Sport", car = "31", points = 193, wins = 0),
        DriverStanding(position =  12, name = "Josh Cook", team = "Mg6 Gt", car = "66", points = 179, wins = 0),
        DriverStanding(position =  13, name = "Ashley Sutton", team = "Mg6 Gt", car = "116", points = 163, wins = 1),
        DriverStanding(position =  14, name = "Aiden Moffat", team = "Mercedes-Benz A-Class", car = "16", points = 140, wins = 0),
        DriverStanding(position =  15, name = "Aron Taylor-Smith", team = "Volkswagen CC", car = "40", points = 137, wins = 1),
        DriverStanding(position =  16, name = "Rob Austin", team = "Toyota Avensis", car = "11", points = 137, wins = 0),
        DriverStanding(position =  17, name = "Jake Hill", team = "Toyota Avensis", car = "24", points = 83, wins = 0),
        DriverStanding(position =  18, name = "Jeff Smith", team = "Honda Civic Type R", car = "55", points = 58, wins = 0),
        DriverStanding(position =  19, name = "Hunter Abbott", team = "Chevrolet Cruze 5dr", car = "54", points = 37, wins = 0),
        DriverStanding(position =  20, name = "Daniel Lloyd", team = "Honda Civic Type R", car = "23", points = 36, wins = 0),
        DriverStanding(position =  21, name = "Martin Depper", team = "Honda Civic Type R", car = "30", points = 28, wins = 0),
        DriverStanding(position =  22, name = "Dave Newsham", team = "Chevrolet Cruze 4dr", car = "71", points = 28, wins = 0),
        DriverStanding(position =  23, name = "Dan Welch", team = "Proton Persona", car = "17", points = 23, wins = 0),
        DriverStanding(position =  24, name = "Michael Epps", team = "Toyota Avensis", car = "12", points = 23, wins = 0),
        DriverStanding(position =  25, name = "James Cole", team = "Subaru Levorg GT", car = "20", points = 14, wins = 0),
        DriverStanding(position =  26, name = "Ollie Jackson", team = "Audi S3 Saloon", car = "48", points = 14, wins = 0),
        DriverStanding(position =  27, name = "Matt Simpson", team = "Honda Civic Type R", car = "303", points = 7, wins = 0),
        DriverStanding(position =  28, name = "Warren Scott", team = "Subaru Levorg GT", car = "39", points = 7, wins = 0),
        DriverStanding(position =  29, name = "Alex Martin", team = "Ford Focus ST MK.III", car = "14", points = 3, wins = 0),
        DriverStanding(position =  30, name = "Andy Neate", team = "Honda Civic Type R", car = "57", points = 0, wins = 0),
        DriverStanding(position =  31, name = "Stewart Lines", team = "Ford Focus ST MK.III", car = "95", points = 0, wins = 0),
        DriverStanding(position =  32, name = "Mark Howard", team = "Volkswagen CC", car = "38", points = 0, wins = 0),
        DriverStanding(position =  33, name = "Chris Smiley", team = "Toyota Avensis", car = "22", points = 0, wins = 0),
        DriverStanding(position =  34, name = "Kelvin Fletcher", team = "Chevrolet Cruze 5dr", car = "84", points = 0, wins = 0),
        DriverStanding(position =  35, name = "Michael Caine", team = "Toyota Avensis", car = "88", points = 0, wins = 0),
        DriverStanding(position =  36, name = "Tony Gilham", team = "Toyota Avensis", car = "34", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "BMW 125i M Sport", points = 809),
        TeamStanding(position =   2, name = "Honda Civic Type R", points = 753),
        TeamStanding(position =   3, name = "Subaru Levorg GT", points = 605),
        TeamStanding(position =   4, name = "Ford Focus ST MK.III", points = 591),
        TeamStanding(position =   5, name = "Toyota Avensis", points = 472),
        TeamStanding(position =   6, name = "Mercedes-Benz A-Class", points = 389),
        TeamStanding(position =   7, name = "Mg6 Gt", points = 342),
        TeamStanding(position =   8, name = "Volkswagen CC", points = 137),
        TeamStanding(position =   9, name = "Chevrolet Cruze 5dr", points = 37),
        TeamStanding(position =  10, name = "Chevrolet Cruze 4dr", points = 28),
        TeamStanding(position =  11, name = "Proton Persona", points = 23),
        TeamStanding(position =  12, name = "Audi S3 Saloon", points = 14),
    )
}
