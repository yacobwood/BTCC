package com.btccfanhub.widget

import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket

class WidgetHttpTest {
    private val cleanup = mutableListOf<() -> Unit>()

    @After
    fun tearDown() = cleanup.forEach { runCatching(it) }

    /** Minimal one-response-per-connection HTTP server on a real local socket. */
    private fun server(status: Int, body: String): String {
        val socket = ServerSocket(0)
        Thread {
            runCatching {
                while (true) socket.accept().use { conn ->
                    val reader = conn.getInputStream().bufferedReader()
                    while (reader.readLine().orEmpty().isNotEmpty()) { /* drain request headers */ }
                    val bytes = body.toByteArray()
                    conn.getOutputStream().apply {
                        write("HTTP/1.1 $status X\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
                        write(bytes)
                        flush()
                    }
                }
            }
        }.apply { isDaemon = true }.start()
        cleanup += { socket.close() }
        return "http://127.0.0.1:${socket.localPort}/calendar.json"
    }

    /** Accepts connections but never sends a byte - the stalled network that caused the ANRs. */
    private fun silentServer(): String {
        val socket = ServerSocket(0)
        val held = mutableListOf<Socket>()
        Thread { runCatching { while (true) held += socket.accept() } }.apply { isDaemon = true }.start()
        cleanup += { held.forEach { it.close() }; socket.close() }
        return "http://127.0.0.1:${socket.localPort}/calendar.json"
    }

    @Test
    fun returnsBodyOnSuccess() = runBlocking {
        assertEquals("{\"rounds\":[]}", WidgetHttp.fetchText(server(200, "{\"rounds\":[]}")))
    }

    @Test
    fun throwsOnHttpError() = runBlocking {
        try {
            WidgetHttp.fetchText(server(404, "missing"))
            fail("expected IOException")
        } catch (e: IOException) {
            assertTrue(e.message!!.contains("HTTP 404"))
        }
    }

    @Test
    fun givesUpOnStalledServerWithinDeadline() = runBlocking {
        val started = System.nanoTime()
        try {
            WidgetHttp.fetchText(silentServer(), deadlineMs = 500)
            fail("expected IOException")
        } catch (e: IOException) {
            assertTrue(e.message!!.contains("Timed out"))
        }
        val elapsedMs = (System.nanoTime() - started) / 1_000_000
        assertTrue("took ${elapsedMs}ms", elapsedMs < 2_000)
    }

    @Test
    fun deadlinesFitInsideTheBroadcastLimit() {
        // Large widget fetches calendar then weather in sequence; both must fit the update budget,
        // which itself must stay under Android's 10s foreground broadcast ANR limit.
        assertTrue(WidgetHttp.FETCH_DEADLINE_MS + 3_000L < WidgetHttp.UPDATE_DEADLINE_MS)
        assertTrue(WidgetHttp.UPDATE_DEADLINE_MS < 10_000L)
        assertTrue(WidgetHttp.CONNECT_TIMEOUT_MS + 0L <= WidgetHttp.FETCH_DEADLINE_MS)
    }
}
