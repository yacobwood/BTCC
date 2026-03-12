package com.btcchub.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.btcchub.MainActivity
import com.btcchub.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

class ResultsCheckWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME       = "btcc_results_check"
        const val CHANNEL_ID      = "btcc_results_channel"
        const val KEY_LAST_ROUND  = "last_results_round"
        const val KEY_RESULTS_NOTIF_ENABLED = "results_notifications_enabled"
        const val EXTRA_OPEN_RESULTS = "open_results"
        const val EXTRA_RESULTS_ROUND = "results_round"
        private const val NOTIF_ID = 1002
        private const val RESULTS_URL =
            "https://raw.githubusercontent.com/yacobwood/BTCC/main/data/results.json"
    }

    private val client = OkHttpClient()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url(RESULTS_URL)
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()

            val body = client.newCall(request).execute().use { it.body?.string() }
                ?: return@withContext Result.retry()

            val json   = JSONObject(body)
            val rounds = json.getJSONArray("rounds")
            val count  = rounds.length()
            if (count == 0) return@withContext Result.success()

            val latest = rounds.getJSONObject(count - 1)
            val round  = latest.getInt("round")
            val venue  = latest.getString("venue")

            val prefs     = context.getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
            val lastRound = prefs.getInt(KEY_LAST_ROUND, -1)
            val enabled   = prefs.getBoolean(KEY_RESULTS_NOTIF_ENABLED, true)

            when {
                lastRound == -1 -> {
                    prefs.edit().putInt(KEY_LAST_ROUND, round).apply()
                }
                round > lastRound -> {
                    prefs.edit().putInt(KEY_LAST_ROUND, round).apply()
                    if (enabled) notify(round, venue)
                }
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun ensureChannel() {
        val prefs = context.getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_RESULTS_NOTIF_ENABLED, true)) return

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Results Alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Notifications when new BTCC round results are published"
            }
            nm.createNotificationChannel(channel)
        }
    }

    private fun notify(round: Int, venue: String) {
        ensureChannel()

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_OPEN_RESULTS, true)
            putExtra(EXTRA_RESULTS_ROUND, round)
        }
        val pending = PendingIntent.getActivity(
            context, NOTIF_ID, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Round $round results are in")
            .setContentText("$venue — tap to view full results")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, notification)
    }
}
