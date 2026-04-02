package com.btccfanhub.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.btccfanhub.Constants
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import com.btccfanhub.data.repository.CalendarRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.DayOfWeek
import java.time.LocalDate

class WeekendPreviewWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "btcc_weekend_preview"
        const val CHANNEL_ID = "btcc_weekend_preview_channel"
        const val KEY_WEEKEND_PREVIEW_ENABLED = "weekend_preview_notifications_enabled"
        const val EXTRA_OPEN_TRACK = "open_track"
        const val EXTRA_TRACK_ROUND = "track_round"
        private const val NOTIF_ID = 3000
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(KEY_WEEKEND_PREVIEW_ENABLED, true)) return@withContext Result.success()

            // Only fire on Fridays
            val today = LocalDate.now()
            if (today.dayOfWeek != DayOfWeek.FRIDAY) return@withContext Result.success()

            val tomorrow = today.plusDays(1)
            val calendar = CalendarRepository.getCalendarData()
            val round = calendar.rounds.firstOrNull { it.startDate == tomorrow }
                ?: return@withContext Result.success()

            // Deduplicate — only notify once per round
            val key = "weekend_preview_notified_${round.round}"
            if (prefs.getBoolean(key, false)) return@withContext Result.success()

            ensureChannel()
            notify(round.round, round.venue)
            prefs.edit().putBoolean(key, true).apply()

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun ensureChannel() {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Race Weekend Preview",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Friday reminder before each BTCC race weekend"
            }
            nm.createNotificationChannel(channel)
        }
    }

    private fun notify(round: Int, venue: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_OPEN_TRACK, true)
            putExtra(EXTRA_TRACK_ROUND, round)
        }
        val pending = PendingIntent.getActivity(
            context,
            NOTIF_ID + round,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Race weekend ahead! 🏁")
            .setContentText("Round $round at $venue starts tomorrow. Get ready for this weekend's racing!")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID + round, notification)
    }
}
