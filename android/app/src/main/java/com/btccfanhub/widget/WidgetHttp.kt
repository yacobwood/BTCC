package com.btccfanhub.widget

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.withTimeoutOrNull
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Network fetch for widget updates.
 *
 * Widgets refresh inside a goAsync() broadcast and Android raises an ANR if
 * pending.finish() isn't called in time. A bare URL.readText() has no socket
 * timeouts and coroutine withTimeout can't interrupt blocking IO, so a stalled
 * connection used to hold the broadcast open until the ANR fired (Crashlytics
 * "nativePollOnce" ANRs, all BACKGROUND, ~hourly per device). Every fetch is now
 * bounded twice: socket timeouts end the read itself and a coroutine deadline
 * lets the caller move on even if DNS or the platform ignores those timeouts.
 */
object WidgetHttp {
    const val CONNECT_TIMEOUT_MS = 5_000
    const val READ_TIMEOUT_MS = 5_000
    const val FETCH_DEADLINE_MS = 5_000L

    /** Whole-update budget for one widget broadcast, inside Android's 10s foreground broadcast limit. */
    const val UPDATE_DEADLINE_MS = 9_000L

    // Detached so a socket that outlives the deadline doesn't keep the caller's coroutine waiting.
    private val detached = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    suspend fun fetchText(url: String, deadlineMs: Long = FETCH_DEADLINE_MS): String {
        val request = detached.async { blockingFetch(url) }
        return withTimeoutOrNull(deadlineMs) { request.await() }
            ?: run {
                request.cancel()
                throw IOException("Timed out after ${deadlineMs}ms fetching $url")
            }
    }

    internal fun blockingFetch(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = CONNECT_TIMEOUT_MS
            conn.readTimeout = READ_TIMEOUT_MS
            val code = conn.responseCode
            if (code !in 200..299) throw IOException("HTTP $code fetching $url")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }
}
