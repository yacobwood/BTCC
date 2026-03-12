package com.btcchub.data.model

import java.time.LocalDate

data class CalendarData(
    val seasonStartDate: LocalDate,
    val rounds: List<Race>,
    val trackInfoMap: Map<Int, TrackInfo>,
    val liveTimingEnabled: Boolean = true,
)
