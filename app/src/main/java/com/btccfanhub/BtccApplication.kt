package com.btccfanhub

import android.app.Application
import android.graphics.Bitmap
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import coil.size.Precision
import java.io.File

class BtccApplication : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        copyBundledDriverImages()
    }

    /** Copy compressed driver WebPs from assets to filesDir so Coil can load by file path. */
    private fun copyBundledDriverImages() {
        try {
            val list = assets.list("driver_images") ?: return
            val webps = list.filter { it.endsWith(".webp") }
            if (webps.isEmpty()) return
            val outDir = File(filesDir, "driver_images")
            if (outDir.exists() && (outDir.list()?.size ?: 0) >= webps.size) return
            if (!outDir.exists()) outDir.mkdirs()
            for (name in webps) {
                val out = File(outDir, name)
                assets.open("driver_images/$name").use { input ->
                    out.outputStream().use { input.copyTo(it) }
                }
            }
        } catch (_: Exception) { /* no bundled images */ }
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.20)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizePercent(0.10) // ~200MB - let's be generous with those massive images
                    .build()
            }
            // MASSIVE IMAGE OPTIMIZATIONS
            .bitmapConfig(Bitmap.Config.RGB_565) // Half memory usage vs ARGB_8888
            .allowHardware(true) // Render on GPU
            .crossfade(true)
            .precision(Precision.EXACT) // FORCE exact resize to tiny target dimension IMMEDIATELY
            .respectCacheHeaders(false) // IGNORE strict server headers, keep things in cache!
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .build()
    }
}
