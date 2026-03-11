package com.btccfanhub.data.model

data class RaceSession(
    val name: String,       // "Free Practice 1", "Qualifying", "Race 1", etc.
    val day: String,        // "SAT" or "SUN"
    val time: String,       // "09:00" or "TBA"
)

data class LapRecord(
    val driver: String,
    val time: String,
    val speed: String,   // e.g. "106.39 mph"
    val year: Int,
)

data class TrackInfo(
    val round: Int,
    val venue: String,
    val location: String,           // e.g. "Castle Donington, Leicestershire"
    val country: String,            // e.g. "England"
    val lengthMiles: String,        // e.g. "1.957 mi"
    val lengthKm: String,           // e.g. "3.149 km"
    val corners: Int,
    val about: String,
    val btccFact: String,           // short BTCC-specific note
    val imageUrl: String = "",
    val layoutImageUrl: String = "",
    val raceImages: List<String> = emptyList(),
    val firstBtccYear: Int? = null,
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val qualifyingRecord: LapRecord? = null,
    val raceRecord: LapRecord? = null,
    val sessions: List<RaceSession> = emptyList(),
)
