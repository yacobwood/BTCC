package com.btccfanhub.widget

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

internal val WIDGET_TIME_FMT    = DateTimeFormatter.ofPattern("HH:mm")
internal val WIDGET_LONDON_ZONE = ZoneId.of("Europe/London")

internal fun abbreviate(name: String): String = when {
    name.contains("Free Practice")   -> name.replace("Free Practice", "FP")
    name.contains("Qualifying Race") -> name.replace("Qualifying Race", "Quali Race")
    name.contains("Qualifying")      -> name.replace("Qualifying", "Quali")
    else                             -> name
}

internal fun localiseWidgetTime(timeStr: String, date: LocalDate, deviceZone: ZoneId): String {
    if (timeStr == "TBA" || timeStr.isBlank()) return timeStr
    return runCatching {
        val londonDt = ZonedDateTime.of(date.atTime(LocalTime.parse(timeStr, WIDGET_TIME_FMT)), WIDGET_LONDON_ZONE)
        val localDt  = londonDt.withZoneSameInstant(deviceZone)
        val dayDiff  = ChronoUnit.DAYS.between(date, localDt.toLocalDate())
        val suffix   = when {
            dayDiff > 0 -> "+$dayDiff"
            dayDiff < 0 -> "$dayDiff"
            else        -> ""
        }
        localDt.format(WIDGET_TIME_FMT) + suffix
    }.getOrDefault(timeStr)
}
