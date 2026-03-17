package com.btccfanhub

object Constants {
    const val PREFS_NAME = "btcc_prefs"

    const val SHARE_BASE_URL = "https://btcchub.vercel.app"
    const val SHARE_NEWS_PATH = "news"

    /** Index of the first championship race number for a given round (rounds contain 3 races). */
    fun firstRaceNumberForRound(round: Int) = (round - 1) * 3 + 1
}
