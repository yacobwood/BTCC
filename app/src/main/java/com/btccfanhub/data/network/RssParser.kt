package com.btccfanhub.data.network

import com.btccfanhub.data.NetworkDiskCache
import com.btccfanhub.data.model.Article
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONException
import java.net.URLEncoder
import java.time.LocalDate
import java.time.format.DateTimeFormatter

object RssParser {

    private val client = HttpClient.client
    private val outputDateFormat = DateTimeFormatter.ofPattern("d MMM yyyy")

    fun fetchArticleById(id: Int): Article? {
        return try {
            val request = Request.Builder()
                .url("https://www.btcc.net/wp-json/wp/v2/posts/$id?_embed=1")
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()
            val json = client.newCall(request).execute().body?.string() ?: return null
            val post = JSONObject(json)
            val id          = post.getInt("id")
            val title       = decodeEntities(post.getJSONObject("title").getString("rendered"))
            val link        = post.getString("link")
            val description = stripHtml(post.getJSONObject("excerpt").getString("rendered"))
            val content     = post.getJSONObject("content").getString("rendered")
            val pubDate     = formatDate(post.getString("date"))
            val embedded    = post.optJSONObject("_embedded")
            Article(id, title, link, description, pubDate, extractFeaturedImage(embedded, content), extractCategory(embedded), content)
        } catch (e: Exception) {
            null
        }
    }

    fun fetchArticleBySlug(slug: String): Article? {
        return try {
            val request = Request.Builder()
                .url("https://www.btcc.net/wp-json/wp/v2/posts?slug=$slug&_embed=1")
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()
            val json = client.newCall(request).execute().body?.string() ?: return null
            val array = JSONArray(json)
            if (array.length() == 0) return null
            val post = array.getJSONObject(0)
            val id          = post.getInt("id")
            val title       = decodeEntities(post.getJSONObject("title").getString("rendered"))
            val link        = post.getString("link")
            val description = stripHtml(post.getJSONObject("excerpt").getString("rendered"))
            val content     = post.getJSONObject("content").getString("rendered")
            val pubDate     = formatDate(post.getString("date"))
            val embedded    = post.optJSONObject("_embedded")
            Article(id, title, link, description, pubDate, extractFeaturedImage(embedded, content), extractCategory(embedded), content)
        } catch (e: Exception) {
            null
        }
    }

    fun fetchArticles(page: Int = 1, perPage: Int = 20, search: String = ""): List<Article> {
        val isMainFeed = page == 1 && search.isBlank()
        return try {
            val url = buildString {
                append("https://www.btcc.net/wp-json/wp/v2/posts?per_page=$perPage&page=$page&_embed=1")
                if (search.isNotBlank()) append("&search=${URLEncoder.encode(search, "UTF-8")}")
            }
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()
            val json = client.newCall(request).execute().body?.string()
                ?: return if (isMainFeed) cachedArticles() else emptyList()
            if (isMainFeed) NetworkDiskCache.write("news_page1", json)
            parseJson(json)
        } catch (e: Exception) {
            if (isMainFeed) cachedArticles() else emptyList()
        }
    }

    private fun cachedArticles(): List<Article> =
        NetworkDiskCache.read("news_page1")?.let { runCatching { parseJson(it) }.getOrNull() } ?: emptyList()

    private fun parseJson(json: String): List<Article> {
        val articles = mutableListOf<Article>()
        val array = JSONArray(json)
        for (i in 0 until array.length()) {
            try {
                val post = array.getJSONObject(i)
                val id = post.getInt("id")
                val title = decodeEntities(post.getJSONObject("title").getString("rendered"))
                val link = post.getString("link")
                val description = stripHtml(post.getJSONObject("excerpt").getString("rendered"))
                val content = post.getJSONObject("content").getString("rendered")
                val pubDate = formatDate(post.getString("date"))
                val embedded = post.optJSONObject("_embedded")
                val imageUrl = extractFeaturedImage(embedded, content)
                val category = extractCategory(embedded)
                articles.add(Article(id, title, link, description, pubDate, imageUrl, category, content))
            } catch (e: Exception) {
                continue
            }
        }
        return articles
    }

    /** Fetches all image attachments for a post — used for gallery-style posts whose
     *  content.rendered contains no inline images. */
    fun fetchGalleryImages(postId: Int): List<String> {
        return try {
            val url = "https://www.btcc.net/wp-json/wp/v2/media" +
                    "?parent=$postId&per_page=50&orderby=menu_order&order=asc&_fields=source_url"
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()
            val json = client.newCall(request).execute().body?.string() ?: return emptyList()
            val array = JSONArray(json)
            (0 until array.length()).map { array.getJSONObject(it).getString("source_url") }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** Scrapes the article page HTML to extract NextGEN Gallery images (and other plugin images)
     *  that don't appear as WordPress media attachments. */
    fun fetchPageImages(pageUrl: String): List<String> {
        return try {
            val request = Request.Builder()
                .url(pageUrl)
                .header("User-Agent", "BTCCFanHub/1.0 Android")
                .build()
            val html = client.newCall(request).execute().body?.string() ?: return emptyList()
            val seen = linkedSetOf<String>()
            val imageExtRegex = Regex("""\.(jpe?g|png|webp|gif)(\b|$|-nggid)""", RegexOption.IGNORE_CASE)

            fun isGalleryImage(v: String) =
                !v.startsWith("data:") &&
                "/thumbs/thumbs-" !in v &&  // skip NGG thumbnail variants
                (v.contains("wp-content/gallery") || v.contains("nggid"))

            fun String.resolve() = if (startsWith("http")) this else "https://www.btcc.net$this"

            // Scan <img> tags — prefer data-original/data-src (full-size) over src (thumbnail)
            val imgAttrPriority = listOf("data-original", "data-src", "data-lazy-src", "src")
            for (imgMatch in Regex("""<img\b[^>]*>""", RegexOption.IGNORE_CASE).findAll(html)) {
                for (attr in imgAttrPriority) {
                    val v = Regex("""$attr="([^"]+)"""").find(imgMatch.value)?.groupValues?.get(1)
                    if (v != null && isGalleryImage(v)) { seen.add(v.resolve()); break }
                }
            }

            // Scan <a> tags — NextGEN Gallery puts the full-size cached URL in href or data-src
            val aAttrPriority = listOf("data-src", "data-original", "href")
            for (aMatch in Regex("""<a\b[^>]*>""", RegexOption.IGNORE_CASE).findAll(html)) {
                for (attr in aAttrPriority) {
                    val v = Regex("""$attr="([^"]+)"""").find(aMatch.value)?.groupValues?.get(1)
                    if (v != null && isGalleryImage(v) && imageExtRegex.containsMatchIn(v)) {
                        seen.add(v.resolve()); break
                    }
                }
            }

            // Scan inline <script> tags — NextGEN Gallery 3.x stores image JSON here
            for (scriptMatch in Regex(
                """<script\b[^>]*>(.*?)</script>""",
                setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
            ).findAll(html)) {
                val body = scriptMatch.groupValues[1]
                if (!body.contains("ngg", ignoreCase = true) &&
                    !body.contains("gallery", ignoreCase = true)) continue
                // Extract quoted image URL strings; normalize JSON-escaped slashes (\/ → /)
                for (m in Regex(""""([^"]+\.(?:jpe?g|png|webp|gif)[^"]*)"""", RegexOption.IGNORE_CASE).findAll(body)) {
                    val v = m.groupValues[1].replace("\\/", "/")
                    if (isGalleryImage(v) && imageExtRegex.containsMatchIn(v)) seen.add(v.resolve())
                }
            }

            deduplicateNggImages(seen.toList())
        } catch (e: Exception) {
            emptyList()
        }
    }

    // Each NGG image appears at multiple cached resolutions AND as an original.
    // Prefer original files (not in /cache/); if only cached exist, keep one per nggid.
    private fun deduplicateNggImages(urls: List<String>): List<String> {
        val originals = urls.filter { "/cache/" !in it && "ngg0dyn" !in it }
        if (originals.isNotEmpty()) {
            return originals.distinctBy { it.substringAfterLast("/").substringBefore("?").lowercase() }
        }
        val byKey = linkedMapOf<String, String>()
        val nggIdRegex = Regex("""nggid(\d+)""", RegexOption.IGNORE_CASE)
        for (url in urls) {
            val key = nggIdRegex.find(url)?.groupValues?.get(1)
                ?: url.substringAfterLast("/").substringBefore("?").lowercase()
            if (key !in byKey) byKey[key] = url
        }
        return byKey.values.toList()
    }

    private val imgSrcRegex = Regex("""<img[^>]+src=["']([^"']+)["']""", RegexOption.IGNORE_CASE)

    private fun extractFeaturedImage(embedded: JSONObject?, content: String = ""): String? {
        val fromMedia = try {
            embedded?.getJSONArray("wp:featuredmedia")?.getJSONObject(0)?.getString("source_url")
        } catch (e: Exception) { null }
        if (!fromMedia.isNullOrEmpty()) return fromMedia
        return imgSrcRegex.find(content)?.groupValues?.get(1)
    }

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
