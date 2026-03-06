package com.btccfanhub.data.model

data class SeasonStat(
    val year: Int,
    val team: String,
    val car: String,
    val pos: Int,
    val points: Int,
    val wins: Int = 0,
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
    val history: List<SeasonStat> = emptyList(),
)

data class Team(
    val name: String,
    val car: String,
    val entries: Int,
    val drivers: List<Driver>,
    val bio: String = "",
    val standing2025: Int = 0,
    val points2025: Int = 0,
)

data class GridData(
    val drivers: List<Driver>,
    val teams: List<Team>,
)
