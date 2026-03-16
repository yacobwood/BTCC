package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2022 BTCC standings from race results. */
object Standings2022 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Tom Ingram", team = "Hyundai i30N", car = "80", points = 419, wins = 6),
        DriverStanding(position =   2, name = "Jake Hill", team = "BMW 330e M Sport", car = "24", points = 413, wins = 3),
        DriverStanding(position =   3, name = "Ashley Sutton", team = "Ford Focus ST Mk 4", car = "1", points = 408, wins = 3),
        DriverStanding(position =   4, name = "Colin Turkington", team = "BMW 330e M Sport", car = "50", points = 368, wins = 3),
        DriverStanding(position =   5, name = "Rory Butcher", team = "Toyota Corolla GR Sport", car = "6", points = 331, wins = 1),
        DriverStanding(position =   6, name = "Josh Cook", team = "Honda Civic Type R", car = "66", points = 320, wins = 5),
        DriverStanding(position =   7, name = "Gordon Shedden", team = "Honda Civic Type R", car = "52", points = 259, wins = 2),
        DriverStanding(position =   8, name = "Dan Cammish", team = "Ford Focus ST Mk 4", car = "9", points = 216, wins = 1),
        DriverStanding(position =   9, name = "Daniel Lloyd", team = "Hyundai i30N", car = "123", points = 203, wins = 3),
        DriverStanding(position =  10, name = "Adam Morgan", team = "BMW 330e M Sport", car = "33", points = 198, wins = 1),
        DriverStanding(position =  11, name = "Stephen Jelley", team = "BMW 330e M Sport", car = "12", points = 185, wins = 1),
        DriverStanding(position =  12, name = "Daniel Rowbottom", team = "Honda Civic Type R", car = "32", points = 151, wins = 0),
        DriverStanding(position =  13, name = "George Gamble", team = "BMW 330e M Sport", car = "42", points = 128, wins = 1),
        DriverStanding(position =  14, name = "Bobby Thompson", team = "Cupra Leon", car = "19", points = 100, wins = 0),
        DriverStanding(position =  15, name = "Tom Chilton", team = "Hyundai i30N", car = "3", points = 82, wins = 0),
        DriverStanding(position =  16, name = "Ricky Collard", team = "Toyota Corolla GR Sport", car = "21", points = 81, wins = 0),
        DriverStanding(position =  17, name = "Jason Plato", team = "Honda Civic Type R", car = "11", points = 80, wins = 0),
        DriverStanding(position =  18, name = "Aiden Moffat", team = "Infiniti Q50", car = "16", points = 72, wins = 0),
        DriverStanding(position =  19, name = "Ash Hand", team = "Vauxhall Astra", car = "97", points = 55, wins = 0),
        DriverStanding(position =  20, name = "Michael Crees", team = "Vauxhall Astra", car = "777", points = 50, wins = 0),
        DriverStanding(position =  21, name = "Aron Taylor-Smith", team = "Cupra Leon", car = "40", points = 38, wins = 0),
        DriverStanding(position =  22, name = "Ollie Jackson", team = "Ford Focus ST Mk 4", car = "48", points = 33, wins = 0),
        DriverStanding(position =  23, name = "Dexter Patterson", team = "Infiniti Q50", car = "17", points = 5, wins = 0),
        DriverStanding(position =  24, name = "James Gornall", team = "Hyundai i30N", car = "18", points = 2, wins = 0),
        DriverStanding(position =  25, name = "Jade Edwards", team = "Honda Civic Type R", car = "99", points = 1, wins = 0),
        DriverStanding(position =  26, name = "Sam Osborne", team = "Ford Focus ST Mk 4", car = "77", points = 1, wins = 0),
        DriverStanding(position =  27, name = "Jack Butel", team = "Hyundai i30N", car = "96", points = 1, wins = 0),
        DriverStanding(position =  28, name = "Nic Hamilton", team = "Cupra Leon", car = "28", points = 0, wins = 0),
        DriverStanding(position =  29, name = "Rick Parfitt", team = "Infiniti Q50", car = "62", points = 0, wins = 0),
        DriverStanding(position =  30, name = "Will Powell", team = "Cupra Leon", car = "20", points = 0, wins = 0),
        DriverStanding(position =  31, name = "Tom Oliphant", team = "Cupra Leon", car = "15", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "BMW 330e M Sport", points = 1292),
        TeamStanding(position =   2, name = "Honda Civic Type R", points = 811),
        TeamStanding(position =   3, name = "Hyundai i30N", points = 707),
        TeamStanding(position =   4, name = "Ford Focus ST Mk 4", points = 658),
        TeamStanding(position =   5, name = "Toyota Corolla GR Sport", points = 412),
        TeamStanding(position =   6, name = "Cupra Leon", points = 138),
        TeamStanding(position =   7, name = "Vauxhall Astra", points = 105),
        TeamStanding(position =   8, name = "Infiniti Q50", points = 77),
    )
}
