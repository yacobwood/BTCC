package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2023 BTCC standings from race results. */
object Standings2023 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Ashley Sutton", team = "Ford Focus ST MK.III", car = "116", points = 494, wins = 12),
        DriverStanding(position =   2, name = "Tom Ingram", team = "Hyundai i30N", car = "1", points = 433, wins = 2),
        DriverStanding(position =   3, name = "Jake Hill", team = "BMW 330i M Sport", car = "24", points = 406, wins = 6),
        DriverStanding(position =   4, name = "Colin Turkington", team = "BMW 330i M Sport", car = "4", points = 329, wins = 4),
        DriverStanding(position =   5, name = "Josh Cook", team = "Honda Civic Type R", car = "66", points = 272, wins = 0),
        DriverStanding(position =   6, name = "Dan Cammish", team = "Ford Focus ST MK.III", car = "27", points = 266, wins = 3),
        DriverStanding(position =   7, name = "Daniel Rowbottom", team = "Ford Focus ST MK.III", car = "32", points = 233, wins = 1),
        DriverStanding(position =   8, name = "Ricky Collard", team = "Toyota Corolla GR Sport", car = "37", points = 217, wins = 0),
        DriverStanding(position =   9, name = "Adam Morgan", team = "BMW 330i M Sport", car = "33", points = 205, wins = 0),
        DriverStanding(position =  10, name = "Rory Butcher", team = "Toyota Corolla GR Sport", car = "6", points = 180, wins = 1),
        DriverStanding(position =  11, name = "Aron Taylor-Smith", team = "Vauxhall Astra", car = "40", points = 169, wins = 0),
        DriverStanding(position =  12, name = "Stephen Jelley", team = "BMW 330i M Sport", car = "12", points = 141, wins = 0),
        DriverStanding(position =  13, name = "Daniel Lloyd", team = "Cupra Leon", car = "123", points = 110, wins = 0),
        DriverStanding(position =  14, name = "Bobby Thompson", team = "Cupra Leon", car = "19", points = 108, wins = 0),
        DriverStanding(position =  15, name = "Tom Chilton", team = "Hyundai i30N", car = "3", points = 106, wins = 1),
        DriverStanding(position =  16, name = "Andrew Watson", team = "Vauxhall Astra", car = "11", points = 97, wins = 0),
        DriverStanding(position =  17, name = "Aiden Moffat", team = "Honda Civic Type R", car = "16", points = 88, wins = 0),
        DriverStanding(position =  18, name = "Ronan Pearson", team = "Hyundai i30N", car = "14", points = 67, wins = 0),
        DriverStanding(position =  19, name = "Sam Osborne", team = "Ford Focus ST MK.III", car = "77", points = 66, wins = 0),
        DriverStanding(position =  20, name = "George Gamble", team = "Toyota Corolla GR Sport", car = "42", points = 65, wins = 0),
        DriverStanding(position =  21, name = "Mikey Doble", team = "Vauxhall Astra", car = "88", points = 62, wins = 0),
        DriverStanding(position =  22, name = "Dexter Patterson", team = "Cupra Leon", car = "17", points = 41, wins = 0),
        DriverStanding(position =  23, name = "Michael Crees", team = "Cupra Leon", car = "777", points = 13, wins = 0),
        DriverStanding(position =  24, name = "Nic Hamilton", team = "Cupra Leon", car = "28", points = 10, wins = 0),
        DriverStanding(position =  25, name = "Nick Halstead", team = "Hyundai i30N", car = "22", points = 10, wins = 0),
        DriverStanding(position =  26, name = "Daryl DeLeon", team = "Cupra Leon", car = "18", points = 6, wins = 0),
        DriverStanding(position =  27, name = "Rob Huff", team = "Cupra Leon", car = "79", points = 5, wins = 0),
        DriverStanding(position =  28, name = "James Gornall", team = "Cupra Leon", car = "180", points = 1, wins = 0),
        DriverStanding(position =  29, name = "Will Powell", team = "Honda Civic Type R", car = "70", points = 0, wins = 0),
        DriverStanding(position =  30, name = "Jack Butel", team = "Cupra Leon", car = "96", points = 0, wins = 0),
        DriverStanding(position =  31, name = "Jade Edwards", team = "Honda Civic Type R", car = "99", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "BMW 330i M Sport", points = 1081),
        TeamStanding(position =   2, name = "Ford Focus ST MK.III", points = 1059),
        TeamStanding(position =   3, name = "Hyundai i30N", points = 616),
        TeamStanding(position =   4, name = "Toyota Corolla GR Sport", points = 462),
        TeamStanding(position =   5, name = "Honda Civic Type R", points = 360),
        TeamStanding(position =   6, name = "Vauxhall Astra", points = 328),
        TeamStanding(position =   7, name = "Cupra Leon", points = 294),
    )
}
