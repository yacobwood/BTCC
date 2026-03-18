package com.btccfanhub

import android.app.Application
import android.graphics.Bitmap
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import coil.size.Precision
import com.btccfanhub.data.ConnectivityObserver
import com.btccfanhub.data.NetworkDiskCache
import java.io.File

class BtccApplication : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        NetworkDiskCache.init(this)
        ConnectivityObserver.init(this)
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
                    .maxSizePercent(0.10)
                    .build()
            }
            .bitmapConfig(Bitmap.Config.RGB_565) // half memory vs ARGB_8888
            .allowHardware(true)
            .crossfade(true)
            .precision(Precision.EXACT)
            .respectCacheHeaders(false) // ignore server cache headers so images stay cached locally
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .build()
    }
}
