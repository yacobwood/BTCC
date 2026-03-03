package com.btccfanhub.data.model

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
)
