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

class ResultsCheckWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "btcc_results_check"
        private const val PREFS = "btcc_prefs"
        private const val KEY_LAST_ROUND = "last_results_round"
        private const val KEY_ENABLED = "results_notifications_enabled"
        private const val NOTIF_ID = 1002
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val body = URL("https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results2026.json").readText()
            val rounds = JSONObject(body).getJSONArray("rounds")
            if (rounds.length() == 0) return@withContext Result.success()

            val latest = rounds.getJSONObject(rounds.length() - 1)
            val round = latest.getInt("round")
            val venue = latest.getString("venue")

            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val lastRound = prefs.getInt(KEY_LAST_ROUND, -1)
            val enabled = prefs.getBoolean(KEY_ENABLED, true)

            when {
                lastRound == -1 -> prefs.edit().putInt(KEY_LAST_ROUND, round).apply()
                round > lastRound -> {
                    prefs.edit().putInt(KEY_LAST_ROUND, round).apply()
                    if (enabled) notify(round, venue)
                }
            }
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }

    private fun notify(round: Int, venue: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(context, NOTIF_ID, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(context, "results")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Round $round results are in")
            .setContentText("$venue \u2014 tap to view full results")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIF_ID, n)
    }
}
