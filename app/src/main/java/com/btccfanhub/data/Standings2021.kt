package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2021 BTCC standings from race results. */
object Standings2021 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Ashley Sutton", team = "Infiniti Q50", car = "1", points = 379, wins = 5),
        DriverStanding(position =   2, name = "Colin Turkington", team = "BMW 330i M Sport", car = "2", points = 324, wins = 4),
        DriverStanding(position =   3, name = "Tom Ingram", team = "Hyundai i30N", car = "80", points = 323, wins = 3),
        DriverStanding(position =   4, name = "Josh Cook", team = "Honda Civic Type R", car = "66", points = 320, wins = 5),
        DriverStanding(position =   5, name = "Jake Hill", team = "Ford Focus ST Mk 4", car = "24", points = 313, wins = 2),
        DriverStanding(position =   6, name = "Gordon Shedden", team = "Honda Civic Type R", car = "52", points = 266, wins = 2),
        DriverStanding(position =   7, name = "Rory Butcher", team = "Toyota Corolla GR Sport", car = "6", points = 265, wins = 3),
        DriverStanding(position =   8, name = "Aiden Moffat", team = "Infiniti Q50", car = "16", points = 238, wins = 1),
        DriverStanding(position =   9, name = "Daniel Rowbottom", team = "Honda Civic Type R", car = "32", points = 230, wins = 1),
        DriverStanding(position =  10, name = "Senna Proctor", team = "Honda Civic Type R", car = "18", points = 218, wins = 1),
        DriverStanding(position =  11, name = "Daniel Lloyd", team = "Vauxhall Astra", car = "123", points = 199, wins = 0),
        DriverStanding(position =  12, name = "Stephen Jelley", team = "BMW 330i M Sport", car = "12", points = 174, wins = 0),
        DriverStanding(position =  13, name = "Adam Morgan", team = "BMW 330i M Sport", car = "33", points = 171, wins = 2),
        DriverStanding(position =  14, name = "Jason Plato", team = "Vauxhall Astra", car = "11", points = 159, wins = 0),
        DriverStanding(position =  15, name = "Chris Smiley", team = "Hyundai i30N", car = "22", points = 138, wins = 0),
        DriverStanding(position =  16, name = "Tom Oliphant", team = "BMW 330i M Sport", car = "15", points = 135, wins = 1),
        DriverStanding(position =  17, name = "Jack Goff", team = "Cupra Leon", car = "31", points = 93, wins = 0),
        DriverStanding(position =  18, name = "Ollie Jackson", team = "Ford Focus ST Mk 4", car = "48", points = 78, wins = 0),
        DriverStanding(position =  19, name = "Tom Chilton", team = "BMW 330i M Sport", car = "3", points = 63, wins = 0),
        DriverStanding(position =  20, name = "Dan Cammish", team = "Honda Civic Type R", car = "27", points = 33, wins = 0),
        DriverStanding(position =  21, name = "Aron Taylor-Smith", team = "Cupra Leon", car = "40", points = 33, wins = 0),
        DriverStanding(position =  22, name = "Carl Boardley", team = "Infiniti Q50", car = "41", points = 29, wins = 0),
        DriverStanding(position =  23, name = "Sam Osborne", team = "Ford Focus ST Mk 4", car = "4", points = 16, wins = 0),
        DriverStanding(position =  24, name = "Sam Smelt", team = "Toyota Corolla GR Sport", car = "23", points = 5, wins = 0),
        DriverStanding(position =  25, name = "Jack Butel", team = "Hyundai i30N", car = "96", points = 4, wins = 0),
        DriverStanding(position =  26, name = "Jade Edwards", team = "Honda Civic Type R", car = "99", points = 1, wins = 0),
        DriverStanding(position =  27, name = "Glynn Geddie", team = "Cupra Leon", car = "88", points = 0, wins = 0),
        DriverStanding(position =  28, name = "Andy Neate", team = "Ford Focus ST Mk 4", car = "44", points = 0, wins = 0),
        DriverStanding(position =  29, name = "Rick Parfitt", team = "Hyundai i30N", car = "62", points = 0, wins = 0),
        DriverStanding(position =  30, name = "Nic Hamilton", team = "Cupra Leon", car = "28", points = 0, wins = 0),
        DriverStanding(position =  31, name = "Jessica Hawkins", team = "Ford Focus ST Mk 4", car = "21", points = 0, wins = 0),
        DriverStanding(position =  32, name = "Jack Mitchell", team = "Cupra Leon", car = "19", points = 0, wins = 0),
        DriverStanding(position =  33, name = "Paul Rivett", team = "Ford Focus ST Mk 4", car = "20", points = 0, wins = 0),
        DriverStanding(position =  34, name = "Nick Halstead", team = "Hyundai i30N", car = "42", points = 0, wins = 0),
        DriverStanding(position =  35, name = "Andy Wilmot", team = "Hyundai i30N", car = "55", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "Honda Civic Type R", points = 1068),
        TeamStanding(position =   2, name = "BMW 330i M Sport", points = 867),
        TeamStanding(position =   3, name = "Infiniti Q50", points = 646),
        TeamStanding(position =   4, name = "Hyundai i30N", points = 465),
        TeamStanding(position =   5, name = "Ford Focus ST Mk 4", points = 407),
        TeamStanding(position =   6, name = "Vauxhall Astra", points = 358),
        TeamStanding(position =   7, name = "Toyota Corolla GR Sport", points = 270),
        TeamStanding(position =   8, name = "Cupra Leon", points = 126),
    )
}
