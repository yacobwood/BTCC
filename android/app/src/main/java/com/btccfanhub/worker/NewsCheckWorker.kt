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
import org.json.JSONArray
import java.net.URL

class NewsCheckWorker(
    private val context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    companion object {
        const val WORK_NAME = "btcc_news_check"
        private const val PREFS = "btcc_prefs"
        private const val KEY_LAST_ID = "last_news_id"
        private const val KEY_ENABLED = "notifications_enabled"
        private const val NOTIF_ID = 1001
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val body = URL("https://www.btcc.net/wp-json/wp/v2/posts?per_page=1&_embed=1").readText()
            val arr = JSONArray(body)
            if (arr.length() == 0) return@withContext Result.success()

            val post = arr.getJSONObject(0)
            val id = post.getInt("id")
            val title = post.getJSONObject("title").getString("rendered")
                .replace(Regex("<[^>]+>"), "").replace("&amp;", "&")
                .replace("&#8217;", "\u2019").replace("&#8216;", "\u2018")
                .replace("&#8220;", "\u201C").replace("&#8221;", "\u201D")
                .replace("&hellip;", "\u2026").trim()

            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val lastId = prefs.getInt(KEY_LAST_ID, -1)
            val enabled = prefs.getBoolean(KEY_ENABLED, true)

            when {
                lastId == -1 -> prefs.edit().putInt(KEY_LAST_ID, id).apply()
                id != lastId -> {
                    prefs.edit().putInt(KEY_LAST_ID, id).apply()
                    if (enabled) notify(title)
                }
            }
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }

    private fun notify(title: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pending = PendingIntent.getActivity(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(context, "news")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("New article on BTCC.net")
            .setContentText(title)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIF_ID, n)
    }
}
