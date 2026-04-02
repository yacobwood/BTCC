package com.btccfanhub.receiver

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.btccfanhub.Constants
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.model.RaceSession
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.ScheduleRepository
import com.btccfanhub.worker.RaceNotificationWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters

object WeekendPreviewScheduler {

    private val FRIDAY_TIME  = LocalTime.of(15, 0)
    private val TUESDAY_TIME = LocalTime.of(9, 0)
    private val TIME_FMT     = DateTimeFormatter.ofPattern("HH:mm")
    private const val KEY_LAST_SCHEDULED = "alarm_scheduler_last_run"
    private const val THROTTLE_MS = 24 * 60 * 60 * 1000L // 24 hours

    suspend fun schedule(context: Context, force: Boolean = false) = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val lastRun = prefs.getLong(KEY_LAST_SCHEDULED, 0L)
        if (!force && System.currentTimeMillis() - lastRun < THROTTLE_MS) return@withContext

        val calendar = runCatching { CalendarRepository.getCalendarData() }.getOrNull() ?: return@withContext
        val schedule = runCatching { ScheduleRepository.getSchedule() }.getOrNull() ?: emptyMap()
        val am  = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = LocalDateTime.now()

        prefs.edit().putLong(KEY_LAST_SCHEDULED, System.currentTimeMillis()).apply()

        calendar.rounds.forEach { round ->
            scheduleFridayPreview(context, am, now, round)
            if (round.round >= 2) scheduleTuesdayStandings(context, am, now, round)
            schedule[round.round]?.let { sessions ->
                scheduleRaceSessions(context, am, now, round, sessions)
            }
        }
    }

    private fun scheduleFridayPreview(context: Context, am: AlarmManager, now: LocalDateTime, round: Race) {
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(WeekendPreviewReceiver.KEY_WEEKEND_PREVIEW_ENABLED, true)) return

        val friday = round.startDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.FRIDAY))
        val triggerAt = LocalDateTime.of(friday, FRIDAY_TIME)
        if (triggerAt.isBefore(now)) return

        val intent = Intent(context, WeekendPreviewReceiver::class.java).apply {
            putExtra(WeekendPreviewReceiver.EXTRA_ROUND, round.round)
            putExtra(WeekendPreviewReceiver.EXTRA_VENUE, round.venue)
        }
        am.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, triggerAt.toEpochMs(),
            PendingIntent.getBroadcast(context, round.round, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
        )
    }

    private fun scheduleTuesdayStandings(context: Context, am: AlarmManager, now: LocalDateTime, round: Race) {
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(TuesdayStandingsReceiver.KEY_TUESDAY_STANDINGS_ENABLED, true)) return

        val tuesday = round.endDate.plusDays(2)
        val triggerAt = LocalDateTime.of(tuesday, TUESDAY_TIME)
        if (triggerAt.isBefore(now)) return

        val intent = Intent(context, TuesdayStandingsReceiver::class.java).apply {
            putExtra(TuesdayStandingsReceiver.EXTRA_ROUND, round.round)
        }
        am.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, triggerAt.toEpochMs(),
            PendingIntent.getBroadcast(context, round.round + 100, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
        )
    }

    private fun scheduleRaceSessions(
        context: Context, am: AlarmManager, now: LocalDateTime,
        round: Race, sessions: List<RaceSession>,
    ) {
        val prefs        = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val raceEnabled  = prefs.getBoolean(RaceNotificationWorker.KEY_RACE_NOTIF_ENABLED, true)
        val qualEnabled  = prefs.getBoolean(RaceNotificationWorker.KEY_QUALIFYING_NOTIF_ENABLED, true)

        sessions.forEachIndexed { index, session ->
            if (session.time == "TBA") return@forEachIndexed
            // Skip Free Practice
            if (session.name.equals("Free Practice", ignoreCase = true)) return@forEachIndexed

            val isQualifying = session.name.contains("qualifying", ignoreCase = true)
            if (isQualifying && !qualEnabled) return@forEachIndexed
            if (!isQualifying && !raceEnabled) return@forEachIndexed

            val sessionDate: LocalDate = when (session.day) {
                "SAT" -> round.startDate
                "SUN" -> round.endDate
                else  -> return@forEachIndexed
            }
            val sessionTime = runCatching { LocalTime.parse(session.time, TIME_FMT) }.getOrNull() ?: return@forEachIndexed
            val triggerAt = LocalDateTime.of(sessionDate, sessionTime).minusMinutes(15)
            if (triggerAt.isBefore(now)) return@forEachIndexed

            val intent = Intent(context, RaceSessionReceiver::class.java).apply {
                putExtra(RaceSessionReceiver.EXTRA_ROUND, round.round)
                putExtra(RaceSessionReceiver.EXTRA_VENUE, round.venue)
                putExtra(RaceSessionReceiver.EXTRA_SESSION_NAME, session.name)
                putExtra(RaceSessionReceiver.EXTRA_IS_QUALIFYING, isQualifying)
            }
            // Request code: 200 + round*10 + session index (avoids collision with other alarms)
            val reqCode = 200 + round.round * 10 + index
            am.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP, triggerAt.toEpochMs(),
                PendingIntent.getBroadcast(context, reqCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
            )
        }
    }

    private fun LocalDateTime.toEpochMs() =
        atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
}
