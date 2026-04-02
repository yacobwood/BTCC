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
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters

object WeekendPreviewScheduler {

    private val FRIDAY_TIME  = LocalTime.of(15, 0) // 3:00 PM Friday
    private val TUESDAY_TIME = LocalTime.of(9, 0)  // 9:00 AM Tuesday

    suspend fun schedule(context: Context) = withContext(Dispatchers.IO) {
        val calendar = runCatching { CalendarRepository.getCalendarData() }.getOrNull() ?: return@withContext
        val am  = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = LocalDateTime.now()

        calendar.rounds.forEach { round ->
            scheduleFridayPreview(context, am, now, round)
            if (round.round >= 2) scheduleTuesdayStandings(context, am, now, round)
        }
    }

    private fun scheduleFridayPreview(
        context: Context, am: AlarmManager, now: LocalDateTime,
        round: com.btccfanhub.data.model.RaceRound,
    ) {
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(WeekendPreviewReceiver.KEY_WEEKEND_PREVIEW_ENABLED, true)) return

        val friday = round.startDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.FRIDAY))
        val triggerAt = LocalDateTime.of(friday, FRIDAY_TIME)
        if (triggerAt.isBefore(now)) return

        val intent = Intent(context, WeekendPreviewReceiver::class.java).apply {
            putExtra(WeekendPreviewReceiver.EXTRA_ROUND, round.round)
            putExtra(WeekendPreviewReceiver.EXTRA_VENUE, round.venue)
        }
        val pending = PendingIntent.getBroadcast(
            context, round.round, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt.toEpochMs(), pending)
    }

    private fun scheduleTuesdayStandings(
        context: Context, am: AlarmManager, now: LocalDateTime,
        round: com.btccfanhub.data.model.RaceRound,
    ) {
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(TuesdayStandingsReceiver.KEY_TUESDAY_STANDINGS_ENABLED, true)) return

        // Tuesday after the race weekend (endDate is Sunday, +2 days = Tuesday)
        val tuesday = round.endDate.plusDays(2)
        val triggerAt = LocalDateTime.of(tuesday, TUESDAY_TIME)
        if (triggerAt.isBefore(now)) return

        val intent = Intent(context, TuesdayStandingsReceiver::class.java).apply {
            putExtra(TuesdayStandingsReceiver.EXTRA_ROUND, round.round)
        }
        // Offset request code to avoid collision with Friday alarms
        val pending = PendingIntent.getBroadcast(
            context, round.round + 100, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt.toEpochMs(), pending)
    }

    private fun LocalDateTime.toEpochMs() =
        atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
}
