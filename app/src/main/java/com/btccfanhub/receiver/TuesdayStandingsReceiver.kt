package com.btccfanhub.receiver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.worker.ResultsCheckWorker

class TuesdayStandingsReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "btcc_tuesday_standings_channel"
        const val EXTRA_ROUND = "tuesday_standings_round"
        const val KEY_TUESDAY_STANDINGS_ENABLED = "tuesday_standings_notifications_enabled"
        // Tab index 4 = CHART in ResultsScreen
        const val RESULTS_TAB_CHART = 4
        private const val NOTIF_BASE_ID = 4000
    }

    override fun onReceive(context: Context, intent: Intent) {
        val round = intent.getIntExtra(EXTRA_ROUND, -1)
        if (round == -1) return

        ensureChannel(context)
        Analytics.notificationDelivered("tuesday_standings")

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(ResultsCheckWorker.EXTRA_OPEN_RESULTS, true)
            putExtra(ResultsCheckWorker.EXTRA_RESULTS_ROUND, 0)
            putExtra(ResultsCheckWorker.EXTRA_RESULTS_TAB, RESULTS_TAB_CHART)
        }
        val pending = PendingIntent.getActivity(
            context,
            NOTIF_BASE_ID + round,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("How did Round $round shake up the standings?")
            .setContentText("Check the championship progression chart to see how the points changed.")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_BASE_ID + round, notification)
    }

    private fun ensureChannel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Standings Update",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Tuesday reminder to check how the latest round affected the championship"
            }
        )
    }
}
