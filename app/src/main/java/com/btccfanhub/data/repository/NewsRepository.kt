package com.btccfanhub.data.repository

import com.btccfanhub.data.model.Article
import com.btccfanhub.data.network.RssParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object NewsRepository {
    suspend fun getArticles(): List<Article> = withContext(Dispatchers.IO) {
        RssParser.fetchArticles()
    }
}
