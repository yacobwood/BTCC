package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2016 BTCC standings from race results. */
object Standings2016 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Gordon Shedden", team = "Halfords Yuasa Racing", car = "52", points = 331, wins = 4),
        DriverStanding(position =   2, name = "Sam Tordoff", team = "West Surrey Racing", car = "600", points = 328, wins = 2),
        DriverStanding(position =   3, name = "Mat Jackson", team = "Motorbase Performance", car = "7", points = 319, wins = 5),
        DriverStanding(position =   4, name = "Colin Turkington", team = "West Surrey Racing", car = "4", points = 314, wins = 5),
        DriverStanding(position =   5, name = "Matt Neal", team = "Halfords Yuasa Racing", car = "25", points = 293, wins = 3),
        DriverStanding(position =   6, name = "Robert Collard", team = "West Surrey Racing", car = "100", points = 288, wins = 2),
        DriverStanding(position =   7, name = "Jason Plato", team = "Team BMR", car = "99", points = 270, wins = 1),
        DriverStanding(position =   8, name = "Andrew Jordan", team = "AmD Tuning with Cobra Exhausts", car = "77", points = 269, wins = 2),
        DriverStanding(position =   9, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 249, wins = 2),
        DriverStanding(position =  10, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 229, wins = 2),
        DriverStanding(position =  11, name = "Jack Goff", team = "Halfords Yuasa Racing", car = "31", points = 193, wins = 0),
        DriverStanding(position =  12, name = "Josh Cook", team = "Power Maxed Racing", car = "66", points = 179, wins = 0),
        DriverStanding(position =  13, name = "Ashley Sutton", team = "Motorbase Performance", car = "116", points = 163, wins = 1),
        DriverStanding(position =  14, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 140, wins = 0),
        DriverStanding(position =  15, name = "Aron Taylor-Smith", team = "Team BMR", car = "40", points = 137, wins = 1),
        DriverStanding(position =  16, name = "Rob Austin", team = "Exocet AlcoSense Racing", car = "11", points = 137, wins = 0),
        DriverStanding(position =  17, name = "Jake Hill", team = "Eurotech Racing", car = "24", points = 83, wins = 0),
        DriverStanding(position =  18, name = "Jeff Smith", team = "Eurotech Racing", car = "55", points = 58, wins = 0),
        DriverStanding(position =  19, name = "Hunter Abbott", team = "AlcoSense Racing", car = "54", points = 37, wins = 0),
        DriverStanding(position =  20, name = "Daniel Lloyd", team = "Honda Civic Type R", car = "23", points = 36, wins = 0),
        DriverStanding(position =  21, name = "Martin Depper", team = "Halfords Yuasa Racing", car = "30", points = 28, wins = 0),
        DriverStanding(position =  22, name = "Dave Newsham", team = "AmD Tuning with Cobra Exhausts", car = "71", points = 28, wins = 0),
        DriverStanding(position =  23, name = "Dan Welch", team = "Proton Persona", car = "17", points = 23, wins = 0),
        DriverStanding(position =  24, name = "Michael Epps", team = "Toyota Avensis", car = "12", points = 23, wins = 0),
        DriverStanding(position =  25, name = "James Cole", team = "Motorbase Performance", car = "20", points = 14, wins = 0),
        DriverStanding(position =  26, name = "Ollie Jackson", team = "Audi S3 Saloon", car = "48", points = 14, wins = 0),
        DriverStanding(position =  27, name = "Matt Simpson", team = "Honda Civic Type R", car = "303", points = 7, wins = 0),
        DriverStanding(position =  28, name = "Warren Scott", team = "Team BMR", car = "39", points = 7, wins = 0),
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
        TeamStanding(position =   1, name = "West Surrey Racing", points = 930),
        TeamStanding(position =   2, name = "Halfords Yuasa Racing", points = 845),
        TeamStanding(position =   3, name = "Motorbase Performance", points = 496),
        TeamStanding(position =   4, name = "Team BMR", points = 414),
        TeamStanding(position =   5, name = "AmD Tuning with Cobra Exhausts", points = 297),
        TeamStanding(position =   6, name = "WIX Racing", points = 249),
        TeamStanding(position =   7, name = "Speedworks Motorsport", points = 229),
        TeamStanding(position =   8, name = "Power Maxed Racing", points = 179),
        TeamStanding(position =   9, name = "Eurotech Racing", points = 141),
        TeamStanding(position =  10, name = "Laser Tools Racing", points = 140),
        TeamStanding(position =  11, name = "Exocet AlcoSense Racing", points = 137),
        TeamStanding(position =  12, name = "Honda Civic Type R", points = 43),
        TeamStanding(position =  13, name = "AlcoSense Racing", points = 37),
        TeamStanding(position =  14, name = "Proton Persona", points = 23),
        TeamStanding(position =  15, name = "Toyota Avensis", points = 23),
        TeamStanding(position =  16, name = "Audi S3 Saloon", points = 14),
        TeamStanding(position =  17, name = "Ford Focus ST MK.III", points = 3),
        TeamStanding(position =  18, name = "Volkswagen CC", points = 0),
        TeamStanding(position =  19, name = "Chevrolet Cruze 5dr", points = 0),
    )
}
