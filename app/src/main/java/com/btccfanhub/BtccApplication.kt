package com.btccfanhub

import android.app.Application
import android.graphics.Bitmap
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import coil.size.Precision

class BtccApplication : Application(), ImageLoaderFactory {
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
