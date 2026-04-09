package com.btccfanhub.worker

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.abs

class RaceNotificationWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "btcc_race_notification"
        private const val PREFS = "btcc_prefs"
        private const val WINDOW_BEFORE = 20L
        private const val WINDOW_AFTER = 5L
        private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm")
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val raceEnabled = prefs.getBoolean("race_notifications_enabled", true)
            val qualiEnabled = prefs.getBoolean("qualifying_notifications_enabled", true)
            val fpEnabled = prefs.getBoolean("free_practice_notifications_enabled", true)
            if (!raceEnabled && !qualiEnabled && !fpEnabled) return@withContext Result.success()

            val calBody = URL("https://raw.githubusercontent.com/yacobwood/BTCC/main/data/calendar.json").readText()
            val rounds = JSONObject(calBody).optJSONArray("rounds") ?: return@withContext Result.success()
            val today = LocalDate.now()

            var roundNum = -1; var venue = ""; var startDate = today; var endDate = today
            var sessions: org.json.JSONArray? = null
            for (i in 0 until rounds.length()) {
                val r = rounds.getJSONObject(i)
                val s = LocalDate.parse(r.optString("startDate"))
                val e = LocalDate.parse(r.optString("endDate"))
                if (today in s..e) {
                    roundNum = r.optInt("round", -1); venue = r.optString("venue")
                    startDate = s; endDate = e
                    sessions = r.optJSONArray("sessions"); break
                }
            }
            if (roundNum == -1) return@withContext Result.success()
            if (sessions == null) return@withContext Result.success()

            val now = LocalTime.now()
            for (i in 0 until sessions.length()) {
                val s = sessions.getJSONObject(i)
                val name = s.optString("name"); val time = s.optString("time")
                if (time == "TBA" || time.isBlank()) continue

                val isFP = name.contains("free practice", ignoreCase = true)
                val isQuali = name.contains("qualifying", ignoreCase = true)
                val isRace = !isFP && !isQuali

                if (isFP && !fpEnabled) continue
                if (isQuali && !qualiEnabled) continue
                if (isRace && !raceEnabled) continue

                val sessionTime = try { LocalTime.parse(time, TIME_FMT) } catch (_: Exception) { continue }
                val sessionDate = if (s.optString("day") == "SAT") startDate else endDate
                if (sessionDate != today) continue

                val mins = ChronoUnit.MINUTES.between(now, sessionTime)
                if (mins !in -WINDOW_AFTER..WINDOW_BEFORE) continue

                val key = "notified_${roundNum}_$name"
                if (prefs.getBoolean(key, false)) continue

                val channel = when { isFP -> "free_practice"; isQuali -> "qualifying"; else -> "race" }
                val body = if (mins <= 0) "Now underway \u00b7 Round $roundNum, $venue"
                           else "Starting in $mins min \u00b7 Round $roundNum, $venue"

                val intent = Intent(context, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP }
                val pending = PendingIntent.getActivity(context, 2000 + abs(name.hashCode()), intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val n = NotificationCompat.Builder(context, channel)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(name).setContentText(body)
                    .setAutoCancel(true).setContentIntent(pending)
                    .setPriority(NotificationCompat.PRIORITY_HIGH).build()
                (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                    .notify(2000 + abs(name.hashCode()), n)
                prefs.edit().putBoolean(key, true).apply()
            }
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }
}
