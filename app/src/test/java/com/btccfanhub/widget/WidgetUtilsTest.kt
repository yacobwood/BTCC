package com.btccfanhub.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

class WidgetUtilsTest {

    // ── abbreviate ────────────────────────────────────────────────────────────

    @Test fun `abbreviate Free Practice`()      { assertEquals("FP",          abbreviate("Free Practice"))      }
    @Test fun `abbreviate Free Practice 1`()    { assertEquals("FP 1",        abbreviate("Free Practice 1"))    }
    @Test fun `abbreviate Free Practice 2`()    { assertEquals("FP 2",        abbreviate("Free Practice 2"))    }
    @Test fun `abbreviate Qualifying Race`()    { assertEquals("Quali Race",  abbreviate("Qualifying Race"))    }
    @Test fun `abbreviate Qualifying`()         { assertEquals("Quali",       abbreviate("Qualifying"))         }
    @Test fun `abbreviate Race 1 unchanged`()   { assertEquals("Race 1",      abbreviate("Race 1"))             }
    @Test fun `abbreviate Race 2 unchanged`()   { assertEquals("Race 2",      abbreviate("Race 2"))             }
    @Test fun `abbreviate empty string`()       { assertEquals("",            abbreviate(""))                   }

    @Test
    fun `abbreviate Qualifying Race takes precedence over Qualifying pattern`() {
        // "Qualifying Race" must NOT become "Quali Race" then match "Qualifying" again
        assertEquals("Quali Race", abbreviate("Qualifying Race"))
    }

    // ── localiseWidgetTime ────────────────────────────────────────────────────

    // Use a fixed summer date (BST = UTC+1)
    private val summerDate = LocalDate.of(2026, 5, 17)
    private val londonZone = ZoneId.of("Europe/London")

    @Test
    fun `localiseWidgetTime TBA returned unchanged`() {
        val result = localiseWidgetTime("TBA", summerDate, londonZone)
        assertEquals("TBA", result)
    }

    @Test
    fun `localiseWidgetTime blank string returned unchanged`() {
        val result = localiseWidgetTime("", summerDate, londonZone)
        assertEquals("", result)
    }

    @Test
    fun `localiseWidgetTime London to London has no suffix`() {
        // No timezone shift — time and date unchanged
        val result = localiseWidgetTime("14:00", summerDate, londonZone)
        assertEquals("14:00", result)
    }

    @Test
    fun `localiseWidgetTime advances to next day in far-east timezone`() {
        // 23:30 BST (= 22:30 UTC) → Tokyo UTC+9 = 07:30 next day
        val tokyo = ZoneId.of("Asia/Tokyo")
        val result = localiseWidgetTime("23:30", summerDate, tokyo)
        assertEquals("07:30+1", result)
    }

    @Test
    fun `localiseWidgetTime same day in east coast US timezone`() {
        // 23:30 BST (= 22:30 UTC) → New York UTC-4 = 18:30 same day
        val newYork = ZoneId.of("America/New_York")
        val result = localiseWidgetTime("23:30", summerDate, newYork)
        assertEquals("18:30", result)
    }

    @Test
    fun `localiseWidgetTime rolls back to previous day in far-west timezone`() {
        // 01:00 BST (= 00:00 UTC) → Los Angeles UTC-7 = 17:00 previous day
        val losAngeles = ZoneId.of("America/Los_Angeles")
        val result = localiseWidgetTime("01:00", summerDate, losAngeles)
        assertEquals("17:00-1", result)
    }

    @Test
    fun `localiseWidgetTime winter time no daylight saving`() {
        // GMT = UTC+0 in winter; 22:00 GMT → Tokyo UTC+9 = 07:00+1
        val winterDate = LocalDate.of(2026, 12, 7)
        val tokyo = ZoneId.of("Asia/Tokyo")
        val result = localiseWidgetTime("22:00", winterDate, tokyo)
        assertEquals("07:00+1", result)
    }

    @Test
    fun `localiseWidgetTime invalid time string returned unchanged`() {
        val result = localiseWidgetTime("not-a-time", summerDate, londonZone)
        assertEquals("not-a-time", result)
    }

    @Test
    fun `localiseWidgetTime midnight edge case`() {
        // 00:00 BST (= 23:00 UTC prev) — same zone, no shift expected
        val result = localiseWidgetTime("00:00", summerDate, londonZone)
        assertEquals("00:00", result)
    }
}
