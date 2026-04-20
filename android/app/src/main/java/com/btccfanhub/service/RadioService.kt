package com.btccfanhub.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.btccfanhub.MainActivity

class RadioService : Service() {
    companion object {
        const val ACTION_PLAY = "com.btccfanhub.RADIO_PLAY"
        const val ACTION_STOP = "com.btccfanhub.RADIO_STOP"
        const val EXTRA_URL = "stream_url"
        const val EXTRA_NAME = "station_name"
        private const val CHANNEL_ID = "btcc_radio"
        private const val NOTIF_ID = 1010
        var isPlaying = false; private set
        var stationName = ""; private set
    }

    private var player: MediaPlayer? = null

    override fun onCreate() {
        super.onCreate()
        val ch = NotificationChannel(CHANNEL_ID, "BTCC Radio", NotificationManager.IMPORTANCE_LOW).apply {
            setSound(null, null)
        }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY -> {
                val url = intent.getStringExtra(EXTRA_URL) ?: return START_NOT_STICKY
                val name = intent.getStringExtra(EXTRA_NAME) ?: "Radio"
                startPlaying(url, name)
            }
            ACTION_STOP -> stopPlaying()
        }
        return START_STICKY
    }

    private fun startPlaying(url: String, name: String) {
        Log.d("RadioService", "startPlaying: url=$url name=$name")
        player?.release()

        player = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            setOnPreparedListener { mp ->
                Log.d("RadioService", "onPrepared, starting playback")
                mp.start()
            }
            setOnErrorListener { _, what, extra ->
                Log.e("RadioService", "onError: what=$what extra=$extra")
                stopPlaying()
                true
            }
            setDataSource(url)
            prepareAsync()
        }

        isPlaying = true
        stationName = name
        startForeground(NOTIF_ID, buildNotification(name))
    }

    private fun stopPlaying() {
        player?.release()
        player = null
        isPlaying = false
        stationName = ""
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) { stopPlaying(); super.onTaskRemoved(rootIntent) }
    override fun onDestroy() { player?.release(); isPlaying = false; super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(name: String): Notification {
        val open = PendingIntent.getActivity(this, 0,
            Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stop = PendingIntent.getService(this, 0,
            Intent(this, RadioService::class.java).apply { action = ACTION_STOP }, PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BTCC Hub · Radio")
            .setContentText("Live · $name")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(open)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stop)
            .setOngoing(true).setSilent(true).build()
    }
}
