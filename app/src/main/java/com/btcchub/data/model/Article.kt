package com.btcchub.data.model

data class Article(
    val id: Int = 0,
    val title: String,
    val link: String,
    val description: String,
    val pubDate: String,
    val imageUrl: String?,
    val category: String,
    val content: String,
)
