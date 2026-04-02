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
import com.btccfanhub.worker.RaceNotificationWorker

class RaceSessionReceiver : BroadcastReceiver() {

    companion object {
        const val EXTRA_ROUND             = "session_round"
        const val EXTRA_VENUE             = "session_venue"
        const val EXTRA_SESSION_NAME      = "session_name"
        const val EXTRA_IS_QUALIFYING     = "session_is_qualifying"
        const val EXTRA_IS_FREE_PRACTICE  = "session_is_free_practice"
        private const val NOTIF_BASE_ID = 5000
    }

    override fun onReceive(context: Context, intent: Intent) {
        val round           = intent.getIntExtra(EXTRA_ROUND, -1)
        val venue           = intent.getStringExtra(EXTRA_VENUE) ?: return
        val sessionName     = intent.getStringExtra(EXTRA_SESSION_NAME) ?: return
        val isQualifying    = intent.getBooleanExtra(EXTRA_IS_QUALIFYING, false)
        val isFreePractice  = intent.getBooleanExtra(EXTRA_IS_FREE_PRACTICE, false)
        if (round == -1) return

        val channelId = when {
            isFreePractice -> RaceNotificationWorker.CHANNEL_ID_FREE_PRACTICE
            isQualifying   -> RaceNotificationWorker.CHANNEL_ID_QUALIFYING
            else           -> RaceNotificationWorker.CHANNEL_ID
        }
        ensureChannel(context, channelId, isQualifying, isFreePractice)

        val notifType = when {
            isFreePractice -> "free_practice"
            isQualifying   -> "qualifying"
            else           -> "race"
        }
        Analytics.notificationDelivered(notifType, venue)

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("notif_type", notifType)
        }
        val pending = PendingIntent.getActivity(
            context,
            NOTIF_BASE_ID + round * 10 + sessionName.hashCode().and(0xF),
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(sessionName)
            .setContentText("Starting in 15 min · Round $round, $venue")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_BASE_ID + round * 10 + sessionName.hashCode().and(0xF), notification)
    }

    private fun ensureChannel(context: Context, channelId: String, isQualifying: Boolean, isFreePractice: Boolean) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(channelId) != null) return
        val (name, desc, importance) = when {
            isFreePractice -> Triple("Free Practice Alerts", "Notifications when BTCC free practice is about to start", NotificationManager.IMPORTANCE_DEFAULT)
            isQualifying   -> Triple("Qualifying Alerts", "Notifications when BTCC qualifying is about to start", NotificationManager.IMPORTANCE_HIGH)
            else           -> Triple("Race Alerts", "Notifications when BTCC race sessions are about to start", NotificationManager.IMPORTANCE_HIGH)
        }
        nm.createNotificationChannel(
            NotificationChannel(channelId, name, importance).apply { description = desc }
        )
    }
}
