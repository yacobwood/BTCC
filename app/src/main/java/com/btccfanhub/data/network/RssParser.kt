package com.btccfanhub.data.network

import com.btccfanhub.data.model.Article
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONException
import java.time.LocalDate
import java.time.format.DateTimeFormatter

object RssParser {

    private val client = OkHttpClient()
    private val outputDateFormat = DateTimeFormatter.ofPattern("d MMM yyyy")

    fun fetchArticleById(id: Int): Article? {
        return try {
            val request = Request.Builder()
                .url("https://www.btcc.net/wp-json/wp/v2/posts/$id?_embed=1")
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()
            val json = client.newCall(request).execute().body?.string() ?: return null
            val post = JSONObject(json)
            val title       = decodeEntities(post.getJSONObject("title").getString("rendered"))
            val link        = post.getString("link")
            val description = stripHtml(post.getJSONObject("excerpt").getString("rendered"))
            val content     = post.getJSONObject("content").getString("rendered")
            val pubDate     = formatDate(post.getString("date"))
            val embedded    = post.optJSONObject("_embedded")
            Article(title, link, description, pubDate, extractFeaturedImage(embedded), extractCategory(embedded), content)
        } catch (e: Exception) {
            null
        }
    }

    fun fetchArticles(): List<Article> {
        return try {
            val request = Request.Builder()
                .url("https://www.btcc.net/wp-json/wp/v2/posts?per_page=20&_embed=1")
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()
            val json = client.newCall(request).execute().body?.string() ?: return emptyList()
            parseJson(json)
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun parseJson(json: String): List<Article> {
        val articles = mutableListOf<Article>()
        val array = JSONArray(json)
        for (i in 0 until array.length()) {
            try {
                val post = array.getJSONObject(i)
                val title = decodeEntities(post.getJSONObject("title").getString("rendered"))
                val link = post.getString("link")
                val description = stripHtml(post.getJSONObject("excerpt").getString("rendered"))
                val content = post.getJSONObject("content").getString("rendered")
                val pubDate = formatDate(post.getString("date"))
                val embedded = post.optJSONObject("_embedded")
                val imageUrl = extractFeaturedImage(embedded)
                val category = extractCategory(embedded)
                articles.add(Article(title, link, description, pubDate, imageUrl, category, content))
            } catch (e: Exception) {
                continue
            }
        }
        return articles
    }

    private fun extractFeaturedImage(embedded: JSONObject?): String? = try {
        embedded?.getJSONArray("wp:featuredmedia")?.getJSONObject(0)?.getString("source_url")
    } catch (e: Exception) { null }

    private fun extractCategory(embedded: JSONObject?): String = try {
        embedded?.getJSONArray("wp:term")?.getJSONArray(0)?.getJSONObject(0)?.getString("name") ?: ""
    } catch (e: Exception) { "" }

    // "2026-02-27T10:02:57" → "27 Feb 2026"
    private fun formatDate(date: String): String = try {
        LocalDate.parse(date.substring(0, 10)).format(outputDateFormat)
    } catch (e: Exception) { date }

    private fun decodeEntities(text: String): String =
        text
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&#039;", "'")
            .replace("&#39;", "'")
            .replace("&#8216;", "\u2018")
            .replace("&#8217;", "\u2019")
            .replace("&#8220;", "\u201C")
            .replace("&#8221;", "\u201D")
            .replace("&#8230;", "\u2026")
            .replace("&hellip;", "\u2026")
            .replace("&nbsp;", " ")

    private fun stripHtml(html: String): String =
        decodeEntities(html.replace(Regex("<[^>]+>"), "")).trim()
}
