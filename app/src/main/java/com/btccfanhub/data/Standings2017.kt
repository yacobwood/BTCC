package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2017 BTCC standings from race results. */
object Standings2017 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Ashley Sutton", team = "Adrian Flux Subaru Racing", car = "116", points = 411, wins = 6),
        DriverStanding(position =   2, name = "Colin Turkington", team = "West Surrey Racing", car = "4", points = 373, wins = 4),
        DriverStanding(position =   3, name = "Tom Ingram", team = "Speedworks Motorsport", car = "80", points = 333, wins = 4),
        DriverStanding(position =   4, name = "Gordon Shedden", team = "Halfords Yuasa Racing", car = "52", points = 333, wins = 3),
        DriverStanding(position =   5, name = "Robert Collard", team = "West Surrey Racing", car = "5", points = 273, wins = 1),
        DriverStanding(position =   6, name = "Jack Goff", team = "AmD Tuning with Cobra Exhausts", car = "31", points = 257, wins = 1),
        DriverStanding(position =   7, name = "Matt Neal", team = "Halfords Yuasa Racing", car = "25", points = 257, wins = 2),
        DriverStanding(position =   8, name = "Mat Jackson", team = "Motorbase Performance", car = "3", points = 217, wins = 1),
        DriverStanding(position =   9, name = "Andrew Jordan", team = "West Surrey Racing", car = "77", points = 212, wins = 3),
        DriverStanding(position =  10, name = "Adam Morgan", team = "WIX Racing", car = "33", points = 194, wins = 0),
        DriverStanding(position =  11, name = "Rob Austin", team = "Toyota Avensis", car = "11", points = 177, wins = 1),
        DriverStanding(position =  12, name = "Jason Plato", team = "Power Maxed Racing", car = "99", points = 152, wins = 1),
        DriverStanding(position =  13, name = "Aiden Moffat", team = "Laser Tools Racing", car = "16", points = 127, wins = 2),
        DriverStanding(position =  14, name = "Dave Newsham", team = "AmD Tuning with Cobra Exhausts", car = "17", points = 108, wins = 0),
        DriverStanding(position =  15, name = "Tom Chilton", team = "Motorbase Performance", car = "2", points = 103, wins = 0),
        DriverStanding(position =  16, name = "Josh Cook", team = "Power Maxed Racing", car = "66", points = 84, wins = 0),
        DriverStanding(position =  17, name = "James Cole", team = "Subaru Levorg GT", car = "20", points = 82, wins = 1),
        DriverStanding(position =  18, name = "Michael Epps", team = "Team Hard", car = "12", points = 77, wins = 0),
        DriverStanding(position =  19, name = "Jake Hill", team = "BTC Racing", car = "24", points = 65, wins = 0),
        DriverStanding(position =  20, name = "Senna Proctor", team = "Vauxhall Astra", car = "18", points = 62, wins = 0),
        DriverStanding(position =  21, name = "Chris Smiley", team = "Team Hard", car = "22", points = 45, wins = 0),
        DriverStanding(position =  22, name = "Ollie Jackson", team = "Audi S3 Saloon", car = "48", points = 43, wins = 0),
        DriverStanding(position =  23, name = "Ant Whorton-Eales", team = "Audi S3 Saloon", car = "10", points = 33, wins = 0),
        DriverStanding(position =  24, name = "Matt Simpson", team = "Honda Civic Type R", car = "303", points = 30, wins = 0),
        DriverStanding(position =  25, name = "Rob Huff", team = "Team Hard", car = "37", points = 28, wins = 0),
        DriverStanding(position =  26, name = "Aron Taylor-Smith", team = "Adrian Flux Subaru Racing", car = "40", points = 25, wins = 0),
        DriverStanding(position =  27, name = "Jeff Smith", team = "Honda Civic Type R", car = "55", points = 24, wins = 0),
        DriverStanding(position =  28, name = "Martin Depper", team = "Eurotech Racing", car = "30", points = 21, wins = 0),
        DriverStanding(position =  29, name = "Rory Butcher", team = "Motorbase Performance", car = "6", points = 20, wins = 0),
        DriverStanding(position =  30, name = "Brett Smith", team = "Honda Civic Type R", car = "39", points = 13, wins = 0),
        DriverStanding(position =  31, name = "Josh Price", team = "Subaru Levorg GT", car = "28", points = 8, wins = 0),
        DriverStanding(position =  32, name = "Luke Davenport", team = "Ford Focus ST MK.III", car = "300", points = 6, wins = 0),
        DriverStanding(position =  33, name = "Daniel Lloyd", team = "Team Hard", car = "23", points = 5, wins = 0),
        DriverStanding(position =  34, name = "Stephen Jelley", team = "Team Parker Racing", car = "7", points = 2, wins = 0),
        DriverStanding(position =  35, name = "Will Burns", team = "Volkswagen CC", car = "61", points = 0, wins = 0),
        DriverStanding(position =  36, name = "Dennis Strandberg", team = "Ford Focus ST MK.III", car = "95", points = 0, wins = 0),
        DriverStanding(position =  37, name = "Stewart Lines", team = "Ford Focus ST MK.III", car = "95", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "West Surrey Racing", points = 858),
        TeamStanding(position =   2, name = "Halfords Yuasa Racing", points = 590),
        TeamStanding(position =   3, name = "Adrian Flux Subaru Racing", points = 436),
        TeamStanding(position =   4, name = "AmD Tuning with Cobra Exhausts", points = 365),
        TeamStanding(position =   5, name = "Motorbase Performance", points = 340),
        TeamStanding(position =   6, name = "Speedworks Motorsport", points = 333),
        TeamStanding(position =   7, name = "Power Maxed Racing", points = 236),
        TeamStanding(position =   8, name = "WIX Racing", points = 194),
        TeamStanding(position =   9, name = "Toyota Avensis", points = 177),
        TeamStanding(position =  10, name = "Team Hard", points = 155),
        TeamStanding(position =  11, name = "Laser Tools Racing", points = 127),
        TeamStanding(position =  12, name = "Subaru Levorg GT", points = 90),
        TeamStanding(position =  13, name = "Audi S3 Saloon", points = 76),
        TeamStanding(position =  14, name = "Honda Civic Type R", points = 67),
        TeamStanding(position =  15, name = "BTC Racing", points = 65),
        TeamStanding(position =  16, name = "Vauxhall Astra", points = 62),
        TeamStanding(position =  17, name = "Eurotech Racing", points = 21),
        TeamStanding(position =  18, name = "Ford Focus ST MK.III", points = 6),
        TeamStanding(position =  19, name = "Team Parker Racing", points = 2),
        TeamStanding(position =  20, name = "Volkswagen CC", points = 0),
    )
}
