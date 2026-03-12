package com.btccfanhub.data

import com.btccfanhub.data.model.Article

// Holds the article the user tapped so ArticleScreen can read it
// without encoding large HTML in navigation arguments.
object ArticleHolder {
    var current: Article? = null
}
