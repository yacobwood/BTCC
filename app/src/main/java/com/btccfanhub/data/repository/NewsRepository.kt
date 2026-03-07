package com.btccfanhub.data.repository

import com.btccfanhub.data.model.Article
import com.btccfanhub.data.network.RssParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object NewsRepository {
    private const val PER_PAGE = 20

    suspend fun getArticles(page: Int = 1): List<Article> = withContext(Dispatchers.IO) {
        RssParser.fetchArticles(page = page, perPage = PER_PAGE)
    }

    suspend fun searchArticles(query: String): List<Article> = withContext(Dispatchers.IO) {
        RssParser.fetchArticles(page = 1, perPage = PER_PAGE, search = query)
    }

    /** Returns true if there may be more pages (fetched a full page). */
    fun isFullPage(articles: List<Article>) = articles.size >= PER_PAGE
}
