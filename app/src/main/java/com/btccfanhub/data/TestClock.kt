package com.btccfanhub.data

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/**
 * A testable clock. When [FeatureFlagsStore.testDateTimeOverride] is set, all calls to
 * [now], [today], and [time] return the overridden value instead of the real system time.
 *
 * Use this everywhere instead of LocalDate.now() / LocalDateTime.now().
 */
object TestClock {
    fun now(): LocalDateTime =
        FeatureFlagsStore.testDateTimeOverride.value ?: LocalDateTime.now()

    fun today(): LocalDate = now().toLocalDate()

    fun time(): LocalTime = now().toLocalTime()
}
