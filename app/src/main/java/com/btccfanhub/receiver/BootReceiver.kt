package com.btccfanhub.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        // goAsync() keeps the process alive until the coroutine finishes
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                WeekendPreviewScheduler.schedule(context, force = true)
            } finally {
                pending.finish()
            }
        }
    }
}
