package com.btcchub.data.model

import java.time.LocalDate

data class Race(
    val round: Int,
    val venue: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
)
