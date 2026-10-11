package com.btccfanhub.service

import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class RadioModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "RadioService"

    @ReactMethod
    fun play(url: String, name: String, isLive: Boolean) {
        val intent = Intent(ctx, RadioService::class.java).apply {
            action = RadioService.ACTION_PLAY
            putExtra(RadioService.EXTRA_URL, url)
            putExtra(RadioService.EXTRA_NAME, name)
            putExtra(RadioService.EXTRA_IS_LIVE, isLive)
        }
        ctx.startForegroundService(intent)
    }

    @ReactMethod
    fun stop() = send(RadioService.ACTION_STOP)

    @ReactMethod
    fun pause() = send(RadioService.ACTION_PAUSE)

    @ReactMethod
    fun resume() = send(RadioService.ACTION_RESUME)

    @ReactMethod
    fun seekTo(positionMs: Double) {
        ctx.startService(Intent(ctx, RadioService::class.java).apply {
            action = RadioService.ACTION_SEEK
            putExtra(RadioService.EXTRA_POSITION_MS, positionMs.toLong())
        })
    }

    @ReactMethod
    fun isPlaying(promise: Promise) {
        promise.resolve(RadioService.isPlaying)
    }

    @ReactMethod
    fun getStationName(promise: Promise) {
        promise.resolve(RadioService.stationName)
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("isPlaying", RadioService.isPlaying)
            putBoolean("isPaused", RadioService.isPaused)
            putString("stationName", RadioService.stationName)
            putDouble("positionMs", RadioService.positionMs.toDouble())
            putDouble("durationMs", RadioService.durationMs.toDouble())
        })
    }

    private fun send(action: String) {
        ctx.startService(Intent(ctx, RadioService::class.java).apply { this.action = action })
    }
}
