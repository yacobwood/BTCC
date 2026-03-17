package com.btccfanhub.data.repository

import com.btccfanhub.data.network.HttpClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

/**
 * Connects to the TSL Live Timing SignalR hub for a given event.
 *
 * Protocol:
 *   POST  /results/live/negotiate?negotiateVersion=1  → connectionToken
 *   WS    wss://.../results/live?id={token}
 *   →  send handshake:          {"protocol":"json","version":1} + RS
 *   ←  receive handshake ack:   {} + RS
 *   →  registerForEvent(id):    {"type":1,"target":"registerForEvent","arguments":[id]} + RS
 *   ←  sessionUpdated / resultUpdated (type=1),  ping (type=6)
 */
class TslSignalRClient(private val eventId: Int) {

    companion object {
        private const val RS        = "\u001e"  // Record separator
        private const val BASE_HTTP = "https://livetiming.tsl-timing.com/results/live"
        private const val BASE_WS   = "wss://livetiming.tsl-timing.com/results/live"
    }

    private val _session = MutableStateFlow<TslSession?>(null)
    val session: StateFlow<TslSession?> = _session.asStateFlow()

    private val okHttp = HttpClient.client

    /**
     * Suspends until the coroutine is cancelled.
     * Fetches an initial REST snapshot, then connects via SignalR and reconnects on failure.
     */
    suspend fun connect() {
        // Immediate REST snapshot so UI has data before WS handshake completes
        _session.value = TslTimingRepository.getSession(eventId)

        while (currentCoroutineContext().isActive) {
            try {
                runConnection()
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                /* transient error — reconnect after delay */
            }
            delay(3_000)
        }
    }

    // -------------------------------------------------------------------------

    private suspend fun runConnection() = withContext(Dispatchers.IO) {
        val token = negotiate() ?: return@withContext
        val msgs  = Channel<String>(Channel.UNLIMITED)

        val ws = okHttp.newWebSocket(
            Request.Builder()
                .url("$BASE_WS?id=$token")
                .header("X-TSL-Event", eventId.toString())
                .build(),
            object : WebSocketListener() {
                override fun onOpen(ws: WebSocket, response: Response) {
                    ws.send("""{"protocol":"json","version":1}$RS""")
                }
                override fun onMessage(ws: WebSocket, text: String) {
                    text.split(RS).filter { it.isNotBlank() }.forEach { msgs.trySend(it) }
                }
                override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                    msgs.close(t)
                }
                override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                    msgs.close()
                }
            }
        )

        try {
            var handshakeDone = false
            for (raw in msgs) {
                val json = runCatching { JSONObject(raw) }.getOrNull() ?: continue
                if (!handshakeDone) {
                    handshakeDone = true
                    ws.send("""{"type":1,"target":"registerForEvent","arguments":[$eventId]}$RS""")
                    continue
                }
                when (json.optInt("type", -1)) {
                    1 -> handleInvocation(json, ws)
                    6 -> ws.send("""{"type":6}$RS""")
                }
            }
        } finally {
            ws.cancel()
        }
    }

    private fun handleInvocation(json: JSONObject, ws: WebSocket) {
        val target = json.optString("target")
        val args   = json.optJSONArray("arguments") ?: return
        when (target) {
            "sessionUpdated" -> {
                val s = args.optJSONObject(0) ?: return
                _session.value = mergeSessionUpdate(s)
            }
            "resultUpdated" -> {
                val e = args.optJSONObject(0) ?: return
                val entry = parseEntry(e) ?: return
                val cur = _session.value ?: return
                _session.value = cur.copy(
                    classification = cur.classification.map { if (it.id == entry.id) entry else it }
                )
            }
        }
    }

    /** Parse a sessionUpdated payload, falling back to the current session for any missing fields. */
    private fun mergeSessionUpdate(json: JSONObject): TslSession {
        val cur        = _session.value
        val clock      = json.optJSONObject("sessionClock")
        val track      = json.optJSONObject("track")
        val fastestLap = json.optJSONObject("fastestLap")
        val classArr   = json.optJSONArray("classification")

        val entries = if (classArr != null) {
            (0 until classArr.length()).mapNotNull { parseEntry(classArr.getJSONObject(it)) }
        } else {
            cur?.classification ?: emptyList()
        }

        return TslSession(
            name          = json.optString("name").ifEmpty { cur?.name ?: "" },
            series        = json.optString("series").ifEmpty { cur?.series ?: "" },
            sessionFlag   = json.optString("sessionFlag").ifEmpty { cur?.sessionFlag ?: "Green" },
            timeToGo      = clock?.optString("timeToGo") ?: cur?.timeToGo ?: "",
            clockRunning  = clock?.optBoolean("running", false) ?: cur?.clockRunning ?: false,
            trackName     = track?.optString("displayName")?.ifEmpty { track.optString("name") }
                            ?: cur?.trackName ?: "",
            fastestLapId  = fastestLap?.optString("id") ?: cur?.fastestLapId ?: "",
            classification = entries,
        )
    }

    private fun parseEntry(json: JSONObject): TslEntry? {
        val id = json.optString("id").ifEmpty { return null }
        val result = json.optJSONObject("result") ?: JSONObject()
        return TslEntry(
            id          = id,
            no          = json.optString("no"),
            name        = json.optString("name"),
            team        = json.optString("team"),
            subClass    = json.optString("subClass"),
            position    = result.optInt("position", 0),
            laps        = result.optInt("laps", 0),
            raceTime    = result.optString("raceTime"),
            fastLapTime = result.optString("fastLapTime"),
            gap         = result.optString("gap"),
            lastLapTime = json.optString("lastLapTime"),
            state       = json.optInt("state", 0),
        )
    }

    private fun negotiate(): String? = runCatching {
        val body = okHttp.newCall(
            Request.Builder()
                .url("$BASE_HTTP/negotiate?negotiateVersion=1")
                .post("".toRequestBody())
                .header("X-TSL-Event", eventId.toString())
                .build()
        ).execute().use { it.body?.string() } ?: return null
        JSONObject(body).optString("connectionToken").ifEmpty { null }
    }.getOrNull()
}
