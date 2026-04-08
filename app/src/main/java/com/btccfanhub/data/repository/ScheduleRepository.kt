package com.btccfanhub.data.repository

import com.btccfanhub.data.model.RaceSession

object ScheduleRepository {

    suspend fun getSchedule(): Map<Int, List<RaceSession>> {
        val calendar = CalendarRepository.getCalendarData()
        return calendar.rounds.associate { it.round to it.sessions }
    }
}
