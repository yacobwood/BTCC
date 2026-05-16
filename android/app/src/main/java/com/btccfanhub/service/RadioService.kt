package com.btccfanhub.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import com.btccfanhub.MainActivity

@UnstableApi
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

    private var player: ExoPlayer? = null

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

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                1000,   // minBufferMs  - keep at least 1s buffered while playing
                3000,   // maxBufferMs  - never build more than 3s of delay behind live
                500,    // bufferForPlaybackMs  - start after 500ms to minimise lag
                1000,   // bufferForPlaybackAfterRebufferMs
            )
            .build()

        player = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            .build()
            .also { exo ->
                exo.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == Player.STATE_READY) {
                            Log.d("RadioService", "onPrepared, starting playback")
                        }
                    }
                    override fun onPlayerError(error: PlaybackException) {
                        Log.e("RadioService", "onError: ${error.message}")
                        stopPlaying()
                    }
                })
                exo.setMediaItem(MediaItem.fromUri(url))
                exo.playWhenReady = true
                exo.prepare()
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
