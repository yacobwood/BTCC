package com.btccfanhub.data.model

import java.time.LocalDate

data class Race(
    val round: Int,
    val venue: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val tslEventId: Int = 0,
)
