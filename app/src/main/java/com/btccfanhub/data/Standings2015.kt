package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2015 BTCC standings from race results. */
object Standings2015 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Gordon Shedden", team = "Honda Yuasa Racing", car = "52", points = 370, wins = 4),
        DriverStanding(position =   2, name = "Jason Plato", team = "Team BMR", car = "99", points = 369, wins = 6),
        DriverStanding(position =   3, name = "Matt Neal", team = "Honda Yuasa Racing", car = "25", points = 336, wins = 3),
        DriverStanding(position =   4, name = "Colin Turkington", team = "Team BMR", car = "1", points = 326, wins = 4),
        DriverStanding(position =   5, name = "Andrew Jordan", team = "MG Racing RCIB Insurance", car = "77", points = 287, wins = 0),
        DriverStanding(position =   6, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 276, wins = 1),
        DriverStanding(position =   7, name = "Sam Tordoff", team = "Team JCT600 with GardX", car = "7", points = 276, wins = 2),
        DriverStanding(position =   8, name = "Andy Priaulx", team = "Team IHG Rewards Club", car = "111", points = 263, wins = 2),
        DriverStanding(position =   9, name = "Jack Goff", team = "MG Racing RCIB Insurance", car = "31", points = 247, wins = 1),
        DriverStanding(position =  10, name = "Robert Collard", team = "Team JCT600 with GardX", car = "6", points = 245, wins = 3),
        DriverStanding(position =  11, name = "Aron Taylor-Smith", team = "Team BMR", car = "40", points = 220, wins = 0),
        DriverStanding(position =  12, name = "Mat Jackson", team = "Motorbase Performance", car = "4", points = 216, wins = 4),
        DriverStanding(position =  13, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 181, wins = 0),
        DriverStanding(position =  14, name = "Rob Austin", team = "Exocet AlcoSense Racing", car = "101", points = 118, wins = 0),
        DriverStanding(position =  15, name = "Josh Cook", team = "Power Maxed Racing", car = "66", points = 95, wins = 0),
        DriverStanding(position =  16, name = "Dave Newsham", team = "AmD Tuning", car = "17", points = 95, wins = 0),
        DriverStanding(position =  17, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 76, wins = 0),
        DriverStanding(position =  18, name = "Martin Depper", team = "Eurotech Racing", car = "30", points = 55, wins = 0),
        DriverStanding(position =  19, name = "James Cole", team = "Motorbase Performance", car = "44", points = 32, wins = 0),
        DriverStanding(position =  20, name = "Jeff Smith", team = "Eurotech Racing", car = "55", points = 31, wins = 0),
        DriverStanding(position =  21, name = "Warren Scott", team = "Team BMR", car = "39", points = 24, wins = 0),
        DriverStanding(position =  22, name = "Hunter Abbott", team = "AlcoSense Racing", car = "54", points = 23, wins = 0),
        DriverStanding(position =  23, name = "Mike Bushell", team = "Team Hard", car = "21", points = 22, wins = 0),
        DriverStanding(position =  24, name = "Nick Foster", team = "Team JCT600 with GardX", car = "8", points = 4, wins = 0),
        DriverStanding(position =  25, name = "Alex Martin", team = "Ford Focus ST MK.III", car = "14", points = 3, wins = 0),
        DriverStanding(position =  26, name = "Barry Horne", team = "Ford Focus ST MK.III", car = "114", points = 3, wins = 0),
        DriverStanding(position =  27, name = "Robb Holland", team = "Toyota Avensis", car = "67", points = 2, wins = 0),
        DriverStanding(position =  28, name = "Simon Belcher", team = "Toyota Avensis", car = "11", points = 1, wins = 0),
        DriverStanding(position =  29, name = "Kieran Gallagher", team = "Toyota Avensis", car = "23", points = 1, wins = 0),
        DriverStanding(position =  30, name = "Derek Palmer", team = "Infiniti Q50", car = "22", points = 1, wins = 0),
        DriverStanding(position =  31, name = "Dan Welch", team = "Proton Persona", car = "13", points = 1, wins = 0),
        DriverStanding(position =  32, name = "Tony Gilham", team = "Toyota Avensis", car = "34", points = 1, wins = 0),
        DriverStanding(position =  33, name = "Alain Menu", team = "Team BMR", car = "9", points = 1, wins = 0),
        DriverStanding(position =  34, name = "Stewart Lines", team = "Toyota Avensis", car = "95", points = 0, wins = 0),
        DriverStanding(position =  35, name = "Richard Hawken", team = "Infiniti Q50", car = "84", points = 0, wins = 0),
        DriverStanding(position =  36, name = "Martin Donnelly", team = "Infiniti Q50", car = "85", points = 0, wins = 0),
        DriverStanding(position =  37, name = "Andy Wilmot", team = "Proton Persona", car = "12", points = 0, wins = 0),
        DriverStanding(position =  38, name = "Max Coates", team = "Infiniti Q50", car = "71", points = 0, wins = 0),
        DriverStanding(position =  39, name = "Nic Hamilton", team = "Audi S3 Saloon", car = "28", points = 0, wins = 0),
        DriverStanding(position =  40, name = "Jake Hill", team = "Eurotech Racing", car = "29", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "Team BMR", points = 940),
        TeamStanding(position =   2, name = "Honda Yuasa Racing", points = 706),
        TeamStanding(position =   3, name = "MG Racing RCIB Insurance", points = 534),
        TeamStanding(position =   4, name = "Team JCT600 with GardX", points = 525),
        TeamStanding(position =   5, name = "WIX Racing", points = 276),
        TeamStanding(position =   6, name = "Team IHG Rewards Club", points = 263),
        TeamStanding(position =   7, name = "Motorbase Performance", points = 248),
        TeamStanding(position =   8, name = "Speedworks Motorsport", points = 181),
        TeamStanding(position =   9, name = "Exocet AlcoSense Racing", points = 118),
        TeamStanding(position =  10, name = "Power Maxed Racing", points = 95),
        TeamStanding(position =  11, name = "AmD Tuning", points = 95),
        TeamStanding(position =  12, name = "Eurotech Racing", points = 86),
        TeamStanding(position =  13, name = "Laser Tools Racing", points = 76),
        TeamStanding(position =  14, name = "AlcoSense Racing", points = 23),
        TeamStanding(position =  15, name = "Team Hard", points = 22),
        TeamStanding(position =  16, name = "Ford Focus ST MK.III", points = 6),
        TeamStanding(position =  17, name = "Toyota Avensis", points = 5),
        TeamStanding(position =  18, name = "Infiniti Q50", points = 1),
        TeamStanding(position =  19, name = "Proton Persona", points = 1),
        TeamStanding(position =  20, name = "Audi S3 Saloon", points = 0),
    )
}
