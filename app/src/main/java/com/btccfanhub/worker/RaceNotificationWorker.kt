package com.btccfanhub.worker

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.btccfanhub.Constants
import com.btccfanhub.MainActivity
import kotlin.math.abs
import com.btccfanhub.R
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.ScheduleRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

class RaceNotificationWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME   = "btcc_race_notification"
        const val CHANNEL_ID            = "btcc_race_channel"
        const val CHANNEL_ID_QUALIFYING = "btcc_qualifying_channel"
        const val KEY_RACE_NOTIF_ENABLED        = "race_notifications_enabled"
        const val KEY_QUALIFYING_NOTIF_ENABLED  = "qualifying_notifications_enabled"
        private const val NOTIF_BASE_ID  = 2000
        // Notify if session starts within next 20 min, or started up to 5 min ago
        private const val WINDOW_BEFORE_MIN = 20L
        private const val WINDOW_AFTER_MIN  = 5L
        private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm")
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val prefs = context.getSharedPreferences(
                Constants.PREFS_NAME, Context.MODE_PRIVATE
            )
            val raceEnabled       = prefs.getBoolean(KEY_RACE_NOTIF_ENABLED, true)
            val qualifyingEnabled = prefs.getBoolean(KEY_QUALIFYING_NOTIF_ENABLED, true)
            if (!raceEnabled && !qualifyingEnabled) return@withContext Result.success()

            val calendar = CalendarRepository.getCalendarData()
            val today    = LocalDate.now()
            val round    = calendar.rounds.firstOrNull { today in it.startDate..it.endDate }
                ?: return@withContext Result.success()

            val sessions = ScheduleRepository.getSchedule()[round.round]
                ?: return@withContext Result.success()

            val now = LocalTime.now()

            sessions.forEach { session ->
                if (session.time == "TBA") return@forEach

                val isQualifying = session.name.contains("qualifying", ignoreCase = true)
                if (isQualifying && !qualifyingEnabled) return@forEach
                if (!isQualifying && !raceEnabled) return@forEach

                val sessionTime = try {
                    LocalTime.parse(session.time, TIME_FMT)
                } catch (e: Exception) { return@forEach }

                val sessionDate = when (session.day) {
                    "SAT" -> round.startDate
                    "SUN" -> round.endDate
                    else  -> return@forEach
                }
                if (sessionDate != today) return@forEach

                val minutesUntil = ChronoUnit.MINUTES.between(now, sessionTime)
                if (minutesUntil !in -WINDOW_AFTER_MIN..WINDOW_BEFORE_MIN) return@forEach

                val key = "notified_${round.round}_${session.name}"
                if (prefs.getBoolean(key, false)) return@forEach

                notify(round.round, round.venue, session.name, minutesUntil, isQualifying)
                prefs.edit().putBoolean(key, true).apply()
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun notify(round: Int, venue: String, sessionName: String, minutesUntil: Long, isQualifying: Boolean) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(
            context,
            NOTIF_BASE_ID + abs(sessionName.hashCode()),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val body = when {
            minutesUntil <= 0 -> "Now underway · Round $round, $venue"
            else              -> "Starting in $minutesUntil min · Round $round, $venue"
        }

        val channelId = if (isQualifying) CHANNEL_ID_QUALIFYING else CHANNEL_ID

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(sessionName)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_BASE_ID + abs(sessionName.hashCode()), notification)
    }
}
