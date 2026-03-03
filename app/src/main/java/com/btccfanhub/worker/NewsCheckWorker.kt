package com.btccfanhub.worker

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray

class NewsCheckWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME        = "btcc_news_check"
        const val WORK_NAME_TEST   = "btcc_news_check_test"
        const val CHANNEL_ID       = "btcc_news_channel"
        const val PREFS_NAME       = "btcc_prefs"
        const val KEY_LAST_ID      = "last_news_id"
        const val KEY_FORCE_NOTIFY = "force_notify"
        private const val NOTIF_ID = 1001
    }

    private val client = OkHttpClient()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("https://www.btcc.net/wp-json/wp/v2/posts?per_page=1&_embed=1")
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()

            val body = client.newCall(request).execute().use { it.body?.string() }
                ?: return@withContext Result.retry()

            val array = JSONArray(body)
            if (array.length() == 0) return@withContext Result.success()

            val post  = array.getJSONObject(0)
            val id    = post.getInt("id")
            val title = post.getJSONObject("title").getString("rendered")
                .replace(Regex("<[^>]+>"), "")
                .replace("&amp;", "&").replace("&#8217;", "\u2019")
                .replace("&#8216;", "\u2018").replace("&#8220;", "\u201C")
                .replace("&#8221;", "\u201D").replace("&hellip;", "\u2026")
                .trim()

            val forceNotify = inputData.getBoolean(KEY_FORCE_NOTIFY, false)
            val prefs       = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lastId      = prefs.getInt(KEY_LAST_ID, -1)

            when {
                forceNotify -> {
                    // Test run — always notify with the current article
                    prefs.edit().putInt(KEY_LAST_ID, id).apply()
                    notify(title)
                }
                lastId == -1 -> {
                    // First run — store current article, no notification
                    prefs.edit().putInt(KEY_LAST_ID, id).apply()
                }
                id != lastId -> {
                    prefs.edit().putInt(KEY_LAST_ID, id).apply()
                    notify(title)
                }
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun notify(title: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pending = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText("New article on BTCC.net")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, notification)
    }
}
