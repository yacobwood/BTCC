package com.btccfanhub.data.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RssParserTest {

    // ── formatDate ────────────────────────────────────────────────────────────

    @Test
    fun `formatDate parses full ISO datetime`() {
        assertEquals("27 Feb 2026", RssParser.formatDate("2026-02-27T10:02:57"))
    }

    @Test
    fun `formatDate parses first of month without leading zero`() {
        assertEquals("1 Dec 2024", RssParser.formatDate("2024-12-01T00:00:00"))
    }

    @Test
    fun `formatDate handles bare date string`() {
        assertEquals("15 Jan 2025", RssParser.formatDate("2025-01-15"))
    }

    @Test
    fun `formatDate returns original string on invalid input`() {
        assertEquals("not-a-date", RssParser.formatDate("not-a-date"))
    }

    @Test
    fun `formatDate returns original string when too short`() {
        assertEquals("2026", RssParser.formatDate("2026"))
    }

    // ── decodeEntities ────────────────────────────────────────────────────────

    @Test fun `decodeEntities amp`()          { assertEquals("&",      RssParser.decodeEntities("&amp;"))    }
    @Test fun `decodeEntities lt`()           { assertEquals("<",      RssParser.decodeEntities("&lt;"))     }
    @Test fun `decodeEntities gt`()           { assertEquals(">",      RssParser.decodeEntities("&gt;"))     }
    @Test fun `decodeEntities quot`()         { assertEquals("\"",     RssParser.decodeEntities("&quot;"))   }
    @Test fun `decodeEntities apos`()         { assertEquals("'",      RssParser.decodeEntities("&apos;"))   }
    @Test fun `decodeEntities numeric 039`()  { assertEquals("'",      RssParser.decodeEntities("&#039;"))   }
    @Test fun `decodeEntities numeric 39`()   { assertEquals("'",      RssParser.decodeEntities("&#39;"))    }
    @Test fun `decodeEntities left single`()  { assertEquals("\u2018", RssParser.decodeEntities("&#8216;"))  }
    @Test fun `decodeEntities right single`() { assertEquals("\u2019", RssParser.decodeEntities("&#8217;"))  }
    @Test fun `decodeEntities left double`()  { assertEquals("\u201C", RssParser.decodeEntities("&#8220;"))  }
    @Test fun `decodeEntities right double`() { assertEquals("\u201D", RssParser.decodeEntities("&#8221;"))  }
    @Test fun `decodeEntities numeric ellipsis`() { assertEquals("\u2026", RssParser.decodeEntities("&#8230;"))  }
    @Test fun `decodeEntities hellip`()       { assertEquals("\u2026", RssParser.decodeEntities("&hellip;")) }
    @Test fun `decodeEntities nbsp`()         { assertEquals(" ",      RssParser.decodeEntities("&nbsp;"))   }

    @Test
    fun `decodeEntities handles multiple entities in one string`() {
        assertEquals("a & b < c", RssParser.decodeEntities("a &amp; b &lt; c"))
    }

    @Test
    fun `decodeEntities returns plain text unchanged`() {
        assertEquals("hello world", RssParser.decodeEntities("hello world"))
    }

    @Test
    fun `decodeEntities empty string`() {
        assertEquals("", RssParser.decodeEntities(""))
    }

    // ── stripHtml ─────────────────────────────────────────────────────────────

    @Test
    fun `stripHtml removes paragraph tags`() {
        assertEquals("Hello", RssParser.stripHtml("<p>Hello</p>"))
    }

    @Test
    fun `stripHtml removes tags and decodes entities`() {
        assertEquals("Hello & World", RssParser.stripHtml("<b>Hello &amp; World</b>"))
    }

    @Test
    fun `stripHtml leaves plain text unchanged`() {
        assertEquals("No tags", RssParser.stripHtml("No tags"))
    }

    @Test
    fun `stripHtml trims surrounding whitespace`() {
        assertEquals("Padded", RssParser.stripHtml("  <p>  Padded  </p>  "))
    }

    @Test
    fun `stripHtml self-closing tags become empty`() {
        assertEquals("", RssParser.stripHtml("<br/><br/>"))
    }

    @Test
    fun `stripHtml handles nested tags`() {
        assertEquals("text", RssParser.stripHtml("<div><span>text</span></div>"))
    }

    // ── deduplicateNggImages ──────────────────────────────────────────────────

    @Test
    fun `deduplicateNggImages empty list returns empty`() {
        assertTrue(RssParser.deduplicateNggImages(emptyList()).isEmpty())
    }

    @Test
    fun `deduplicateNggImages distinct originals returned unchanged`() {
        val urls = listOf(
            "https://btcc.net/wp-content/gallery/race1/photo1.jpg",
            "https://btcc.net/wp-content/gallery/race1/photo2.jpg",
        )
        assertEquals(urls, RssParser.deduplicateNggImages(urls))
    }

    @Test
    fun `deduplicateNggImages deduplicates originals by filename case-insensitively`() {
        val urls = listOf(
            "https://btcc.net/gallery/Photo1.jpg",
            "https://btcc.net/gallery/photo1.jpg",  // same filename, different case
            "https://btcc.net/gallery/photo2.jpg",
        )
        val result = RssParser.deduplicateNggImages(urls)
        assertEquals(2, result.size)
        assertTrue(result.any { it.endsWith("photo2.jpg") })
    }

    @Test
    fun `deduplicateNggImages prefers originals over cached variants`() {
        val original = "https://btcc.net/wp-content/gallery/race/photo1.jpg"
        val cached   = "https://btcc.net/wp-content/gallery/cache/nggid0001-600x400.jpg"
        val result = RssParser.deduplicateNggImages(listOf(original, cached))
        assertEquals(listOf(original), result)
    }

    @Test
    fun `deduplicateNggImages deduplicates cached by nggid keeping first`() {
        val urls = listOf(
            "https://btcc.net/cache/nggid0001-600x400-0-00.jpg",
            "https://btcc.net/cache/nggid0001-300x200-0-00.jpg",  // same nggid
            "https://btcc.net/cache/nggid0002-600x400-0-00.jpg",
        )
        val result = RssParser.deduplicateNggImages(urls)
        assertEquals(2, result.size)
        assertTrue(result.any { "nggid0001" in it })
        assertTrue(result.any { "nggid0002" in it })
    }

    @Test
    fun `deduplicateNggImages keeps first cached url for each nggid`() {
        val first  = "https://btcc.net/cache/nggid0042-large.jpg"
        val second = "https://btcc.net/cache/nggid0042-thumb.jpg"
        val result = RssParser.deduplicateNggImages(listOf(first, second))
        assertEquals(listOf(first), result)
    }

    @Test
    fun `deduplicateNggImages ngg0dyn urls treated as cached`() {
        val ngg0dyn  = "https://btcc.net/index.php?ngg0dyn=1&nggid0001"
        val original = "https://btcc.net/wp-content/gallery/race/photo.jpg"
        val result = RssParser.deduplicateNggImages(listOf(ngg0dyn, original))
        assertEquals(listOf(original), result)
    }
}
