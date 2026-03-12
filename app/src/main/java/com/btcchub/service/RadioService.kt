package com.btcchub.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.btcchub.MainActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class RadioService : Service() {

    companion object {
        const val ACTION_PLAY         = "com.btcchub.RADIO_PLAY"
        const val ACTION_STOP         = "com.btcchub.RADIO_STOP"
        const val EXTRA_STREAM_URL    = "stream_url"
        const val EXTRA_STATION_NAME  = "station_name"

        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID      = "btcc_radio_channel"

        private val _isPlaying = MutableStateFlow(false)
        val isPlaying: StateFlow<Boolean> = _isPlaying

        private val _currentStation = MutableStateFlow("")
        val currentStation: StateFlow<String> = _currentStation
    }

    private var player: ExoPlayer? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY -> {
                val url  = intent.getStringExtra(EXTRA_STREAM_URL)   ?: return START_NOT_STICKY
                val name = intent.getStringExtra(EXTRA_STATION_NAME) ?: "BTCC Radio"
                startPlaying(url, name)
            }
            ACTION_STOP -> stopPlaying()
        }
        return START_STICKY
    }

    private fun startPlaying(url: String, stationName: String) {
        if (player == null) {
            player = ExoPlayer.Builder(this).build().also { p ->
                p.addListener(object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) {
                        stopPlaying()
                    }
                })
            }
        }
        player!!.apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
            play()
        }
        _isPlaying.value     = true
        _currentStation.value = stationName
        startForeground(NOTIFICATION_ID, buildNotification(stationName))
    }

    private fun stopPlaying() {
        player?.stop()
        player?.release()
        player                = null
        _isPlaying.value      = false
        _currentStation.value = ""
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        stopPlaying()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        player?.release()
        player           = null
        _isPlaying.value = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "BTCC Radio",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Live radio stream controls"
            setSound(null, null)
        }
        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    private fun buildNotification(stationName: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val stopIntent = PendingIntent.getService(
            this, 0,
            Intent(this, RadioService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BTCC Fan Hub · Radio")
            .setContentText("Live · $stationName")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }
}
