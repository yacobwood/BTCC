package com.btccfanhub.data

import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.TeamStanding

/** Final 2018 BTCC standings from race results. */
object Standings2018 {

    val drivers: List<DriverStanding> = listOf(
        DriverStanding(position =   1, name = "Colin Turkington", team = "BMW 125i M Sport", car = "2", points = 313, wins = 1),
        DriverStanding(position =   2, name = "Tom Ingram", team = "Toyota Avensis", car = "80", points = 292, wins = 3),
        DriverStanding(position =   3, name = "Ashley Sutton", team = "Subaru Levorg GT", car = "1", points = 281, wins = 6),
        DriverStanding(position =   4, name = "Tom Chilton", team = "Ford Focus RS", car = "3", points = 266, wins = 1),
        DriverStanding(position =   5, name = "Josh Cook", team = "Vauxhall Astra", car = "66", points = 251, wins = 2),
        DriverStanding(position =   6, name = "Adam Morgan", team = "Mercedes-Benz A-Class", car = "33", points = 250, wins = 3),
        DriverStanding(position =   7, name = "Andrew Jordan", team = "BMW 125i M Sport", car = "77", points = 244, wins = 1),
        DriverStanding(position =   8, name = "Dan Cammish", team = "Honda Civic Type R", car = "27", points = 228, wins = 2),
        DriverStanding(position =   9, name = "Jack Goff", team = "Honda Civic Type R", car = "31", points = 219, wins = 2),
        DriverStanding(position =  10, name = "Matt Neal", team = "Honda Civic Type R", car = "25", points = 216, wins = 2),
        DriverStanding(position =  11, name = "Sam Tordoff", team = "Ford Focus RS", car = "600", points = 204, wins = 1),
        DriverStanding(position =  12, name = "Senna Proctor", team = "Vauxhall Astra", car = "18", points = 174, wins = 1),
        DriverStanding(position =  13, name = "Chris Smiley", team = "Honda Civic Type R", car = "22", points = 160, wins = 1),
        DriverStanding(position =  14, name = "Rob Austin", team = "Alfa Romeo Giulietta", car = "11", points = 123, wins = 0),
        DriverStanding(position =  15, name = "Aiden Moffat", team = "Mercedes-Benz A-Class", car = "16", points = 122, wins = 1),
        DriverStanding(position =  16, name = "Matt Simpson", team = "Honda Civic Type R", car = "303", points = 115, wins = 1),
        DriverStanding(position =  17, name = "Rory Butcher", team = "Mg6 Gt", car = "6", points = 99, wins = 0),
        DriverStanding(position =  18, name = "Robert Collard", team = "BMW 125i M Sport", car = "5", points = 90, wins = 1),
        DriverStanding(position =  19, name = "Daniel Lloyd", team = "Honda Civic Type R", car = "26", points = 83, wins = 1),
        DriverStanding(position =  20, name = "Brett Smith", team = "Honda Civic Type R", car = "39", points = 69, wins = 0),
        DriverStanding(position =  21, name = "James Cole", team = "Ford Focus RS", car = "20", points = 67, wins = 0),
        DriverStanding(position =  22, name = "Mike Bushell", team = "Volkswagen CC", car = "21", points = 63, wins = 0),
        DriverStanding(position =  23, name = "Tom Oliphant", team = "Mercedes-Benz A-Class", car = "15", points = 62, wins = 0),
        DriverStanding(position =  24, name = "Ollie Jackson", team = "Audi S3 Saloon", car = "48", points = 55, wins = 0),
        DriverStanding(position =  25, name = "Ricky Collard", team = "BMW 125i M Sport", car = "55", points = 47, wins = 0),
        DriverStanding(position =  26, name = "Jake Hill", team = "Volkswagen CC", car = "24", points = 32, wins = 0),
        DriverStanding(position =  27, name = "Jason Plato", team = "Subaru Levorg GT", car = "99", points = 28, wins = 0),
        DriverStanding(position =  28, name = "Bobby Thompson", team = "Volkswagen CC", car = "19", points = 17, wins = 0),
        DriverStanding(position =  29, name = "Tom Boardman", team = "Mg6 Gt", car = "12", points = 14, wins = 0),
        DriverStanding(position =  30, name = "James Nash", team = "Honda Civic Type R", car = "14", points = 6, wins = 0),
        DriverStanding(position =  31, name = "Ant Whorton-Eales", team = "Mg6 Gt", car = "10", points = 6, wins = 0),
        DriverStanding(position =  32, name = "Stephen Jelley", team = "BMW 125i M Sport", car = "60", points = 4, wins = 0),
        DriverStanding(position =  33, name = "Glynn Geddie", team = "Mg6 Gt", car = "41", points = 1, wins = 0),
        DriverStanding(position =  34, name = "Michael Caine", team = "Volkswagen CC", car = "44", points = 0, wins = 0),
        DriverStanding(position =  35, name = "Josh Price", team = "Subaru Levorg GT", car = "28", points = 0, wins = 0),
        DriverStanding(position =  36, name = "Sam Smelt", team = "Audi S3 Saloon", car = "23", points = 0, wins = 0),
        DriverStanding(position =  37, name = "Dan Welch", team = "Volkswagen CC", car = "17", points = 0, wins = 0),
        DriverStanding(position =  38, name = "Ollie Pidgley", team = "Volkswagen CC", car = "43", points = 0, wins = 0),
        DriverStanding(position =  39, name = "Carl Boardley", team = "Volkswagen CC", car = "42", points = 0, wins = 0),
        DriverStanding(position =  40, name = "Josh Caygill", team = "Mg6 Gt", car = "54", points = 0, wins = 0),
        DriverStanding(position =  41, name = "Ethan Hammerton", team = "Volkswagen CC", car = "32", points = 0, wins = 0),
    )

    val teams: List<TeamStanding> = listOf(
        TeamStanding(position =   1, name = "Honda Civic Type R", points = 1096),
        TeamStanding(position =   2, name = "BMW 125i M Sport", points = 698),
        TeamStanding(position =   3, name = "Ford Focus RS", points = 537),
        TeamStanding(position =   4, name = "Mercedes-Benz A-Class", points = 434),
        TeamStanding(position =   5, name = "Vauxhall Astra", points = 425),
        TeamStanding(position =   6, name = "Subaru Levorg GT", points = 309),
        TeamStanding(position =   7, name = "Toyota Avensis", points = 292),
        TeamStanding(position =   8, name = "Alfa Romeo Giulietta", points = 123),
        TeamStanding(position =   9, name = "Mg6 Gt", points = 120),
        TeamStanding(position =  10, name = "Volkswagen CC", points = 112),
        TeamStanding(position =  11, name = "Audi S3 Saloon", points = 55),
    )
}
