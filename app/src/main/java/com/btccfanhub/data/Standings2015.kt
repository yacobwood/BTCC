package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2015 BTCC standings from race results. */
object Standings2015 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Gordon Shedden", team = "Honda Civic Type R", car = "52", points = 370, wins = 4),
        DriverStanding(position =   2, name = "Jason Plato", team = "Volkswagen CC", car = "99", points = 369, wins = 6),
        DriverStanding(position =   3, name = "Matt Neal", team = "Honda Civic Type R", car = "25", points = 336, wins = 3),
        DriverStanding(position =   4, name = "Colin Turkington", team = "Volkswagen CC", car = "1", points = 326, wins = 4),
        DriverStanding(position =   5, name = "Andrew Jordan", team = "Mg6 Gt", car = "77", points = 287, wins = 0),
        DriverStanding(position =   6, name = "Adam Morgan", team = "Mercedes-Benz A-Class", car = "33", points = 276, wins = 1),
        DriverStanding(position =   7, name = "Sam Tordoff", team = "BMW 125i M Sport", car = "7", points = 276, wins = 2),
        DriverStanding(position =   8, name = "Andy Priaulx", team = "BMW 125i M Sport", car = "111", points = 263, wins = 2),
        DriverStanding(position =   9, name = "Jack Goff", team = "Mg6 Gt", car = "31", points = 247, wins = 1),
        DriverStanding(position =  10, name = "Robert Collard", team = "BMW 125i M Sport", car = "6", points = 245, wins = 3),
        DriverStanding(position =  11, name = "Aron Taylor-Smith", team = "Volkswagen CC", car = "40", points = 220, wins = 0),
        DriverStanding(position =  12, name = "Mat Jackson", team = "Ford Focus ST MK.III", car = "4", points = 216, wins = 4),
        DriverStanding(position =  13, name = "Tom Ingram", team = "Toyota Avensis", car = "80", points = 181, wins = 0),
        DriverStanding(position =  14, name = "Rob Austin", team = "Audi A4", car = "101", points = 118, wins = 0),
        DriverStanding(position =  15, name = "Josh Cook", team = "Chevrolet Cruze 5dr", car = "66", points = 95, wins = 0),
        DriverStanding(position =  16, name = "Dave Newsham", team = "Chevrolet Cruze 5dr", car = "17", points = 95, wins = 0),
        DriverStanding(position =  17, name = "Aiden Moffat", team = "Mercedes-Benz A-Class", car = "16", points = 76, wins = 0),
        DriverStanding(position =  18, name = "Martin Depper", team = "Honda Civic", car = "30", points = 55, wins = 0),
        DriverStanding(position =  19, name = "James Cole", team = "Ford Focus ST MK.III", car = "44", points = 32, wins = 0),
        DriverStanding(position =  20, name = "Jeff Smith", team = "Honda Civic", car = "55", points = 31, wins = 0),
        DriverStanding(position =  21, name = "Warren Scott", team = "Volkswagen CC", car = "39", points = 24, wins = 0),
        DriverStanding(position =  22, name = "Hunter Abbott", team = "Audi A4", car = "54", points = 23, wins = 0),
        DriverStanding(position =  23, name = "Mike Bushell", team = "Ford Focus ST MK.III", car = "21", points = 22, wins = 0),
        DriverStanding(position =  24, name = "Nick Foster", team = "BMW 125i M Sport", car = "8", points = 4, wins = 0),
        DriverStanding(position =  25, name = "Alex Martin", team = "Ford Focus ST MK.III", car = "14", points = 3, wins = 0),
        DriverStanding(position =  26, name = "Barry Horne", team = "Ford Focus ST MK.III", car = "114", points = 3, wins = 0),
        DriverStanding(position =  27, name = "Robb Holland", team = "Toyota Avensis", car = "67", points = 2, wins = 0),
        DriverStanding(position =  28, name = "Simon Belcher", team = "Toyota Avensis", car = "11", points = 1, wins = 0),
        DriverStanding(position =  29, name = "Kieran Gallagher", team = "Toyota Avensis", car = "23", points = 1, wins = 0),
        DriverStanding(position =  30, name = "Derek Palmer", team = "Infiniti Q50", car = "22", points = 1, wins = 0),
        DriverStanding(position =  31, name = "Dan Welch", team = "Proton Persona", car = "13", points = 1, wins = 0),
        DriverStanding(position =  32, name = "Tony Gilham", team = "Toyota Avensis", car = "34", points = 1, wins = 0),
        DriverStanding(position =  33, name = "Alain Menu", team = "Volkswagen CC", car = "9", points = 1, wins = 0),
        DriverStanding(position =  34, name = "Stewart Lines", team = "Toyota Avensis", car = "95", points = 0, wins = 0),
        DriverStanding(position =  35, name = "Richard Hawken", team = "Infiniti Q50", car = "84", points = 0, wins = 0),
        DriverStanding(position =  36, name = "Martin Donnelly", team = "Infiniti Q50", car = "85", points = 0, wins = 0),
        DriverStanding(position =  37, name = "Andy Wilmot", team = "Proton Persona", car = "12", points = 0, wins = 0),
        DriverStanding(position =  38, name = "Max Coates", team = "Infiniti Q50", car = "71", points = 0, wins = 0),
        DriverStanding(position =  39, name = "Nic Hamilton", team = "Audi S3 Saloon", car = "28", points = 0, wins = 0),
        DriverStanding(position =  40, name = "Jake Hill", team = "Audi S3 Saloon", car = "29", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "Volkswagen CC", points = 940),
        TeamStanding(position =   2, name = "BMW 125i M Sport", points = 788),
        TeamStanding(position =   3, name = "Honda Civic Type R", points = 706),
        TeamStanding(position =   4, name = "Mg6 Gt", points = 534),
        TeamStanding(position =   5, name = "Mercedes-Benz A-Class", points = 352),
        TeamStanding(position =   6, name = "Ford Focus ST MK.III", points = 276),
        TeamStanding(position =   7, name = "Chevrolet Cruze 5dr", points = 190),
        TeamStanding(position =   8, name = "Toyota Avensis", points = 186),
        TeamStanding(position =   9, name = "Audi A4", points = 141),
        TeamStanding(position =  10, name = "Honda Civic", points = 86),
        TeamStanding(position =  11, name = "Infiniti Q50", points = 1),
        TeamStanding(position =  12, name = "Proton Persona", points = 1),
        TeamStanding(position =  13, name = "Audi S3 Saloon", points = 0),
    )
}
