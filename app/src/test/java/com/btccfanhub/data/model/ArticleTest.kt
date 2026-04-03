package com.btccfanhub.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ArticleTest {

    @Test
    fun `article default id is zero`() {
        val article = Article(
            title = "Test",
            link = "https://example.com",
            description = "Desc",
            pubDate = "Mon, 01 Jan 2026",
            imageUrl = null,
            category = "News",
            content = "<p>Content</p>",
        )
        assertEquals(0, article.id)
    }

    @Test
    fun `article imageUrl can be null`() {
        val article = Article(
            id = 1,
            title = "Test",
            link = "https://example.com",
            description = "Desc",
            pubDate = "Mon, 01 Jan 2026",
            imageUrl = null,
            category = "News",
            content = "",
        )
        assertNull(article.imageUrl)
    }

    @Test
    fun `article copy preserves fields`() {
        val original = Article(
            id = 5,
            title = "Original",
            link = "https://example.com/5",
            description = "Desc",
            pubDate = "Tue, 02 Jan 2026",
            imageUrl = "https://img.com/5.jpg",
            category = "Race Report",
            content = "<p>Race</p>",
        )
        val copy = original.copy(title = "Updated")
        assertEquals("Updated", copy.title)
        assertEquals(5, copy.id)
        assertEquals("Race Report", copy.category)
    }
}
