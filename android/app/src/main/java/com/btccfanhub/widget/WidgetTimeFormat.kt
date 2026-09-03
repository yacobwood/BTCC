package com.btccfanhub.widget

// Mirrors the 12-hour formatting used in TrackDetailScreen.js (to12h/formatSessionTime)
// so a session time reads identically whether it's shown in-app or on a widget.
// Falls back to the raw string for anything that isn't a plain "HH:mm" time
// (e.g. "TBA"), same as the JS side leaving non-matching strings untouched.
fun formatWidgetTime(time: String, use12Hour: Boolean): String {
    if (!use12Hour) return time
    val parts = time.split(":")
    if (parts.size != 2) return time
    val hour = parts[0].toIntOrNull() ?: return time
    val minute = parts[1].takeIf { it.length == 2 && it.all(Char::isDigit) } ?: return time
    val hour12 = if (hour % 12 == 0) 12 else hour % 12
    val period = if (hour >= 12) "pm" else "am"
    return "$hour12:$minute$period"
}
