package com.btccfanhub.data.model

data class DriverStanding(
    val position: Int,
    val name: String,
    val team: String,
    val car: String,
    val points: Int,
    val wins: Int = 0,
)
