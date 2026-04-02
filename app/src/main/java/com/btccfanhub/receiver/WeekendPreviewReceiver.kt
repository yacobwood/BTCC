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

class WeekendPreviewReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "btcc_weekend_preview_channel"
        const val EXTRA_ROUND = "weekend_preview_round"
        const val EXTRA_VENUE = "weekend_preview_venue"
        const val EXTRA_OPEN_TRACK = "open_track"
        const val EXTRA_TRACK_ROUND = "track_round"
        const val KEY_WEEKEND_PREVIEW_ENABLED = "weekend_preview_notifications_enabled"
        private const val NOTIF_BASE_ID = 3000
    }

    override fun onReceive(context: Context, intent: Intent) {
        val round = intent.getIntExtra(EXTRA_ROUND, -1)
        val venue = intent.getStringExtra(EXTRA_VENUE) ?: return
        if (round == -1) return

        ensureChannel(context)

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_OPEN_TRACK, true)
            putExtra(EXTRA_TRACK_ROUND, round)
        }
        val pending = PendingIntent.getActivity(
            context,
            NOTIF_BASE_ID + round,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Race weekend ahead!")
            .setContentText("Round $round at $venue starts tomorrow. Get ready for this weekend's racing!")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
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
                "Race Weekend Preview",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Friday reminder before each BTCC race weekend"
            }
        )
    }
}
