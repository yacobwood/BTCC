package com.btccfanhub.ui

import com.btccfanhub.data.model.Article
import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.model.TeamStanding
import java.time.LocalDate

/**
 * Shared fake data for Compose UI tests.
 */
object TestData {

    fun article(
        id: Int = 1,
        title: String = "Test Article $id",
        category: String = "News",
    ) = Article(
        id = id,
        title = title,
        link = "https://example.com/$id",
        description = "Description for article $id",
        pubDate = "Mon, 01 Jan 2026 12:00:00 GMT",
        imageUrl = null,
        category = category,
        content = "<p>Content for article $id</p>",
    )

    fun articles(count: Int = 5) = (1..count).map { article(id = it) }

    fun race(
        round: Int = 1,
        venue: String = "Brands Hatch",
        startDate: LocalDate = LocalDate.of(2026, 4, 18),
        endDate: LocalDate = LocalDate.of(2026, 4, 19),
    ) = Race(round = round, venue = venue, startDate = startDate, endDate = endDate)

    fun races() = listOf(
        race(1, "Brands Hatch", LocalDate.of(2026, 4, 18), LocalDate.of(2026, 4, 19)),
        race(2, "Donington Park", LocalDate.of(2026, 5, 3), LocalDate.of(2026, 5, 4)),
        race(3, "Thruxton", LocalDate.of(2026, 6, 7), LocalDate.of(2026, 6, 8)),
    )

    fun driverStanding(
        position: Int = 1,
        name: String = "Tom Ingram",
        team: String = "EXCELR8 Motorsport",
        points: Int = 100,
    ) = DriverStanding(
        position = position, name = name, team = team,
        car = "Hyundai Elantra N", points = points,
    )

    fun driverStandings() = listOf(
        driverStanding(1, "Tom Ingram", "EXCELR8 Motorsport", 100),
        driverStanding(2, "Jake Hill", "Laser Tools Racing", 85),
        driverStanding(3, "Ash Sutton", "NAPA Racing UK", 72),
    )

    fun teamStandings() = listOf(
        TeamStanding(1, "EXCELR8 Motorsport", 180),
        TeamStanding(2, "Laser Tools Racing", 150),
        TeamStanding(3, "NAPA Racing UK", 130),
    )
}
