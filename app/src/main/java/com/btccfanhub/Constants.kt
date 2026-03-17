package com.btccfanhub

object Constants {
    const val PREFS_NAME = "btcc_prefs"

    /** Index of the first championship race number for a given round (rounds contain 3 races). */
    fun firstRaceNumberForRound(round: Int) = (round - 1) * 3 + 1
}
