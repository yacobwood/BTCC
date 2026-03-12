package com.btccfanhub.data.model

data class ContentBlock(
    val type: String,
    val body: String = "",
    val url: String = "",
)

data class InfoPage(
    val id: String,
    val title: String,
    val icon: String = "",
    val sections: List<ContentBlock> = emptyList(),
)
