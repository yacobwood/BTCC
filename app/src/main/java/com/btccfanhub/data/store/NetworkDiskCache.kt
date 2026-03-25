package com.btccfanhub.data.store

import android.content.Context
import java.io.File

/**
 * Lightweight disk cache for raw JSON responses from the network.
 * Each entry is a single file under filesDir/network_cache/<key>.json.
 * Initialised once in BtccApplication.onCreate().
 */
object NetworkDiskCache {

    private lateinit var dir: File

    fun init(context: Context) {
        dir = File(context.filesDir, "network_cache").also { it.mkdirs() }
    }

    fun write(key: String, json: String) {
        runCatching { File(dir, "$key.json").writeText(json) }
    }

    fun read(key: String): String? {
        val f = File(dir, "$key.json")
        return if (f.exists()) runCatching { f.readText() }.getOrNull() else null
    }
}
