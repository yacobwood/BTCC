package com.btccfanhub.service

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener
import java.io.IOException
import java.io.InputStream
import java.net.Socket
import javax.net.ssl.SSLSocketFactory

/**
 * A DataSource that opens a raw TCP socket to handle Icecast/Shoutcast streams.
 * Android's built-in HTTP stack rejects the "ICY 200 OK" response that Icecast
 * servers send instead of "HTTP/1.1 200 OK". This bypasses that stack entirely.
 * Also works for standard HTTP/HTTPS streams.
 */
class IcyDataSource : DataSource {
    private var socket: Socket? = null
    private var inputStream: InputStream? = null
    private var openedUri: Uri? = null

    override fun open(dataSpec: DataSpec): Long {
        val uri = dataSpec.uri
        openedUri = uri
        val host = uri.host ?: throw IOException("No host: $uri")
        val scheme = uri.scheme?.lowercase() ?: "http"
        val port = when {
            uri.port != -1 -> uri.port
            scheme == "https" -> 443
            else -> 80
        }
        val path = uri.path?.takeIf { it.isNotEmpty() } ?: "/"
        val query = uri.query?.let { "?$it" } ?: ""

        val s: Socket = if (scheme == "https") {
            (SSLSocketFactory.getDefault() as SSLSocketFactory).createSocket(host, port)
        } else {
            Socket(host, port)
        }
        socket = s

        val request = "GET $path$query HTTP/1.0\r\n" +
                "Host: $host:$port\r\n" +
                "Icy-MetaData: 0\r\n" +
                "User-Agent: Mozilla/5.0\r\n" +
                "Connection: close\r\n\r\n"

        s.getOutputStream().apply {
            write(request.toByteArray(Charsets.ISO_8859_1))
            flush()
        }

        inputStream = s.getInputStream().also { skipHeaders(it) }
        return C.LENGTH_UNSET.toLong()
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (length == 0) return 0
        return inputStream?.read(buffer, offset, length)?.takeIf { it != -1 }
            ?: C.RESULT_END_OF_INPUT
    }

    override fun getUri(): Uri? = openedUri
    override fun addTransferListener(transferListener: TransferListener) {}

    override fun close() {
        inputStream = null
        try { socket?.close() } catch (_: Exception) {}
        socket = null
    }

    private fun skipHeaders(input: InputStream) {
        // Consume bytes until \r\n\r\n — works for both "ICY 200 OK" and "HTTP/1.x 200 OK"
        var state = 0
        while (true) {
            val b = input.read()
            if (b == -1) return
            state = when {
                b == '\r'.code && state == 0 -> 1
                b == '\n'.code && state == 1 -> 2
                b == '\r'.code && state == 2 -> 3
                b == '\n'.code && state == 3 -> return // end of headers
                b == '\r'.code -> 1
                else -> 0
            }
        }
    }
}

class IcyDataSourceFactory : DataSource.Factory {
    override fun createDataSource(): DataSource = IcyDataSource()
}
