package com.btccfanhub.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media3.common.C
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
        const val ACTION_PAUSE = "com.btccfanhub.RADIO_PAUSE"
        const val ACTION_RESUME = "com.btccfanhub.RADIO_RESUME"
        const val ACTION_SEEK = "com.btccfanhub.RADIO_SEEK"
        const val EXTRA_URL = "stream_url"
        const val EXTRA_NAME = "station_name"
        const val EXTRA_IS_LIVE = "is_live"
        const val EXTRA_POSITION_MS = "position_ms"
        private const val CHANNEL_ID = "btcc_radio"
        private const val NOTIF_ID = 1010
        private const val PROGRESS_TICK_MS = 500L
        // Written on the main thread, read by RadioModule on the native-modules
        // thread - ExoPlayer itself may only be touched on the main looper, so
        // the module reads these snapshots instead of the player.
        @Volatile var isPlaying = false; private set
        @Volatile var isPaused = false; private set
        @Volatile var stationName = ""; private set
        @Volatile var positionMs = 0L; private set
        @Volatile var durationMs = 0L; private set
    }

    private var player: ExoPlayer? = null
    private var isLive = true
    private val handler = Handler(Looper.getMainLooper())
    private val progressTick = object : Runnable {
        override fun run() {
            player?.let {
                positionMs = it.currentPosition
                val d = it.duration
                durationMs = if (d == C.TIME_UNSET) 0L else d
            }
            handler.postDelayed(this, PROGRESS_TICK_MS)
        }
    }

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
                startPlaying(url, name, intent.getBooleanExtra(EXTRA_IS_LIVE, true))
            }
            ACTION_STOP -> stopPlaying()
            ACTION_PAUSE -> pausePlaying()
            ACTION_RESUME -> resumePlaying()
            ACTION_SEEK -> player?.let {
                it.seekTo(intent.getLongExtra(EXTRA_POSITION_MS, 0L))
                positionMs = it.currentPosition
            }
        }
        return START_STICKY
    }

    private fun startPlaying(url: String, name: String, live: Boolean) {
        Log.d("RadioService", "startPlaying: url=$url name=$name live=$live")
        player?.release()
        isLive = live

        // Live radio keeps a tiny buffer so playback stays close to real time.
        // On-demand podcasts use ExoPlayer's defaults - a 3s ceiling there would
        // just mean stuttering on any network blip.
        val loadControl = if (live) {
            DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                    1000,   // minBufferMs  - keep at least 1s buffered while playing
                    3000,   // maxBufferMs  - never build more than 3s of delay behind live
                    500,    // bufferForPlaybackMs  - start after 500ms to minimise lag
                    1000,   // bufferForPlaybackAfterRebufferMs
                )
                .build()
        } else {
            DefaultLoadControl.Builder().build()
        }

        player = ExoPlayer.Builder(this)
            .setLoadControl(loadControl)
            .build()
            .also { exo ->
                exo.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        if (state == Player.STATE_READY) {
                            Log.d("RadioService", "onPrepared, starting playback")
                        } else if (state == Player.STATE_ENDED) {
                            // Podcast finished - without this the service kept
                            // reporting isPlaying=true with its notification up.
                            stopPlaying()
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
        isPaused = false
        stationName = name
        positionMs = 0L
        durationMs = 0L
        handler.removeCallbacks(progressTick)
        handler.post(progressTick)
        startForeground(NOTIF_ID, buildNotification())
    }

    private fun pausePlaying() {
        val exo = player ?: return
        exo.pause()
        isPlaying = false
        isPaused = true
        positionMs = exo.currentPosition
        updateNotification()
    }

    private fun resumePlaying() {
        val exo = player ?: return
        exo.play()
        isPlaying = true
        isPaused = false
        updateNotification()
    }

    private fun stopPlaying() {
        handler.removeCallbacks(progressTick)
        player?.release()
        player = null
        isPlaying = false
        isPaused = false
        stationName = ""
        positionMs = 0L
        durationMs = 0L
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onTaskRemoved(rootIntent: Intent?) { stopPlaying(); super.onTaskRemoved(rootIntent) }
    override fun onDestroy() {
        handler.removeCallbacks(progressTick)
        player?.release()
        isPlaying = false
        isPaused = false
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null

    private fun updateNotification() {
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIF_ID, buildNotification())
    }

    private fun serviceIntent(action: String, requestCode: Int) = PendingIntent.getService(this, requestCode,
        Intent(this, RadioService::class.java).apply { this.action = action }, PendingIntent.FLAG_IMMUTABLE)

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(this, 0,
            Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(if (isLive) "BTCC Hub · Radio" else "BTCC Hub · Podcast")
            .setContentText(when {
                isPaused -> "Paused · $stationName"
                isLive -> "Live · $stationName"
                else -> stationName
            })
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(open)
        if (!isLive) {
            if (isPaused) builder.addAction(android.R.drawable.ic_media_play, "Play", serviceIntent(ACTION_RESUME, 2))
            else builder.addAction(android.R.drawable.ic_media_pause, "Pause", serviceIntent(ACTION_PAUSE, 1))
        }
        return builder
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", serviceIntent(ACTION_STOP, 0))
            .setOngoing(true).setSilent(true).build()
    }
}
