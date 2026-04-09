package com.btccfanhub.service

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class RadioModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "RadioService"

    @ReactMethod
    fun play(url: String, name: String) {
        val intent = Intent(ctx, RadioService::class.java).apply {
            action = RadioService.ACTION_PLAY
            putExtra(RadioService.EXTRA_URL, url)
            putExtra(RadioService.EXTRA_NAME, name)
        }
        ctx.startForegroundService(intent)
    }

    @ReactMethod
    fun stop() {
        ctx.startService(Intent(ctx, RadioService::class.java).apply {
            action = RadioService.ACTION_STOP
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
}
