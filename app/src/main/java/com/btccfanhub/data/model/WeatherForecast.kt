package com.btccfanhub.data.model

import java.time.LocalDate

data class DayForecast(
    val date: LocalDate,
    val weatherCode: Int,
    val tempMax: Double,
    val tempMin: Double,
    val precipitationProbability: Int,
    val windSpeedMax: Double,
)
