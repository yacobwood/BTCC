package com.btccfanhub.receiver

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.btccfanhub.Constants
import com.btccfanhub.data.repository.CalendarRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters

object WeekendPreviewScheduler {

    private val NOTIFY_TIME = LocalTime.of(15, 0) // 3:00 PM

    suspend fun schedule(context: Context) = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(WeekendPreviewReceiver.KEY_WEEKEND_PREVIEW_ENABLED, true)) return@withContext

        val calendar = runCatching { CalendarRepository.getCalendarData() }.getOrNull() ?: return@withContext
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = LocalDateTime.now()

        calendar.rounds.forEach { round ->
            // Friday before the race weekend start date
            val raceStart = round.startDate
            val friday = raceStart.with(TemporalAdjusters.previousOrSame(DayOfWeek.FRIDAY))
            val triggerAt = LocalDateTime.of(friday, NOTIFY_TIME)

            // Skip if already in the past
            if (triggerAt.isBefore(now)) return@forEach

            val triggerMs = triggerAt
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()

            val intent = Intent(context, WeekendPreviewReceiver::class.java).apply {
                putExtra(WeekendPreviewReceiver.EXTRA_ROUND, round.round)
                putExtra(WeekendPreviewReceiver.EXTRA_VENUE, round.venue)
            }
            val pending = PendingIntent.getBroadcast(
                context,
                round.round,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pending)
        }
    }
}
