package com.btccfanhub.data.model

data class SeasonStat(
    val year: Int,
    val team: String,
    val car: String,
    val pos: Int,
    val points: Int,
    val wins: Int = 0,
    val podiums: Int = 0,
    val poles: Int = 0,
    val fastestLaps: Int = 0,
    val isChampion: Boolean = false,
)

data class Driver(
    val number: Int,
    val name: String,
    val team: String,
    val car: String,
    val imageUrl: String,
    val nationality: String = "British",
    val bio: String = "",
    val dateOfBirth: String = "",   // "YYYY-MM-DD"
    val birthplace: String = "",
    val history: List<SeasonStat> = emptyList(),
)

data class TeamSeasonStat(
    val year: Int,
    val pos: Int,
    val points: Int,
)

data class Team(
    val name: String,
    val car: String,
    val entries: Int,
    val drivers: List<Driver>,
    val bio: String = "",
    val standing2025: Int = 0,
    val points2025: Int = 0,
    val carImageUrl: String = "",
    val founded: Int = 0,
    val base: String = "",
    val driversChampionships: Int = 0,
    val teamsChampionships: Int = 0,
    val history: List<TeamSeasonStat> = emptyList(),
)

data class GridData(
    val drivers: List<Driver>,
    val teams: List<Team>,
)
