package com.btccfanhub.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import com.btccfanhub.Constants
import com.btccfanhub.MainActivity
import com.btccfanhub.R
import com.btccfanhub.data.FeatureFlagsStore
import com.btccfanhub.data.TestClock
import com.btccfanhub.data.model.RaceSession
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.ScheduleRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

class CountdownWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                withTimeout(10_000L) {
                    for (id in appWidgetIds) {
                        val opts = appWidgetManager.getAppWidgetOptions(id)
                        val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 40)
                        val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
                        val theme = WidgetPrefs.getTheme(context, id)
                        val views = buildViews(context, minW, minH, theme)
                        appWidgetManager.updateAppWidget(id, views)
                    }
                }
            } finally {
                pending.finish()
            }
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                withTimeout(10_000L) {
                    val minW = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 40)
                    val minH = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 40)
                    val theme = WidgetPrefs.getTheme(context, appWidgetId)
                    val views = buildViews(context, minW, minH, theme)
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }
            } finally {
                pending.finish()
            }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        appWidgetIds.forEach { WidgetPrefs.deleteTheme(context, it) }
    }

    private enum class SizeClass { SMALL, WIDE, WIDE_TALL }

    companion object {

        private val DAY_FMT        = DateTimeFormatter.ofPattern("d")
        private val MONTH_YEAR_FMT = DateTimeFormatter.ofPattern("MMM yyyy")

        const val EXTRA_LIVE_TIMING_EVENT_ID = "extra_live_timing_event_id"

        private val SAT_NAME_IDS = intArrayOf(R.id.widget_sat_name1, R.id.widget_sat_name2, R.id.widget_sat_name3)
        private val SAT_TIME_IDS = intArrayOf(R.id.widget_sat_time1, R.id.widget_sat_time2, R.id.widget_sat_time3)
        private val SUN_NAME_IDS = intArrayOf(R.id.widget_sun_name1, R.id.widget_sun_name2, R.id.widget_sun_name3)
        private val SUN_TIME_IDS = intArrayOf(R.id.widget_sun_time1, R.id.widget_sun_time2, R.id.widget_sun_time3)

        internal suspend fun buildViews(
            context: Context,
            minWidth: Int = 40,
            minHeight: Int = 40,
            theme: WidgetTheme = WidgetTheme.NAVY,
        ): RemoteViews {
            val wide = minWidth >= 110  // anything wider than ~1.5 cells goes wide
            val tall = minHeight >= 200
            val sizeClass = when {
                wide && tall -> SizeClass.WIDE_TALL
                wide         -> SizeClass.WIDE
                else         -> SizeClass.SMALL
            }

            val layoutId = when (sizeClass) {
                SizeClass.WIDE_TALL -> R.layout.next_race_weather_widget
                SizeClass.WIDE      -> R.layout.next_race_widget
                SizeClass.SMALL     -> R.layout.countdown_widget
            }
            val views = RemoteViews(context.packageName, layoutId)
            views.setImageViewBitmap(
                R.id.widget_livery,
                buildLiveryBitmap(context, minWidth, minHeight, theme),
            )

            // For themes where the accent panel is bright, override muted grey text to white
            val needsWhiteMuted = theme in listOf(
                WidgetTheme.VERTU, WidgetTheme.NAPA, WidgetTheme.LASER,
                WidgetTheme.SPEEDWORKS, WidgetTheme.WSR, WidgetTheme.PMR,
                WidgetTheme.ONE_MS, WidgetTheme.RESTART, WidgetTheme.PLATO,
            )
            if (needsWhiteMuted) {
                val mutedWhite = 0xCCFFFFFF.toInt()
                views.setTextColor(R.id.widget_countdown_label, mutedWhite)
                views.setTextColor(R.id.widget_dates, mutedWhite)
                if (sizeClass != SizeClass.SMALL) {
                    for (id in SAT_TIME_IDS) views.setTextColor(id, mutedWhite)
                    for (id in SUN_TIME_IDS) views.setTextColor(id, mutedWhite)
                }
            }

            val today = LocalDate.now()
            val calendar = try { CalendarRepository.getCalendarData() } catch (_: Exception) { null }
            val nextRace = calendar?.rounds?.firstOrNull { it.endDate >= today }

            // Read test mode directly from SharedPreferences so it works even when the
            // app process hasn't run FeatureFlagsStore.init() (e.g. widget-only update).
            val testMode = context.getSharedPreferences("feature_flags", Context.MODE_PRIVATE)
                .getBoolean(FeatureFlagsStore.KEY_WIDGET_RACE_WEEKEND, false)
            val effectiveToday = if (testMode) nextRace?.startDate ?: today else today

            // Deep-link to live timing during a race weekend, otherwise open the app home
            val isWeekendNow = nextRace != null && effectiveToday >= nextRace.startDate && nextRace.tslEventId != 0
            val tapIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                if (isWeekendNow) putExtra(EXTRA_LIVE_TIMING_EVENT_ID, nextRace!!.tslEventId)
            }
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(
                    context, 2, tapIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                ),
            )

            if (nextRace == null) {
                views.setTextViewText(R.id.widget_countdown, "")
                views.setTextViewText(R.id.widget_countdown_label, "SEASON\nOVER")
                when (sizeClass) {
                    SizeClass.SMALL -> {
                        views.setTextViewText(R.id.widget_venue, "")
                        views.setViewVisibility(R.id.widget_round, View.GONE)
                        views.setViewVisibility(R.id.widget_dates, View.GONE)
                    }
                    SizeClass.WIDE -> {
                        views.setTextViewText(R.id.widget_round, "BTCC 2026")
                        views.setTextViewText(R.id.widget_venue, "Season complete")
                        views.setTextViewText(R.id.widget_dates, "")
                    }
                    SizeClass.WIDE_TALL -> {
                        views.setTextViewText(R.id.widget_round, "BTCC 2026")
                        views.setTextViewText(R.id.widget_venue, "Season complete")
                        views.setTextViewText(R.id.widget_dates, "")
                        views.setViewVisibility(R.id.widget_divider, View.GONE)
                        views.setViewVisibility(R.id.widget_schedule_row, View.GONE)
                        views.setViewVisibility(R.id.widget_no_schedule, View.VISIBLE)
                        views.setTextViewText(R.id.widget_no_schedule, "See you next season!")
                    }
                }
                return views
            }

            val isWeekend = effectiveToday >= nextRace.startDate
            val daysUntil = ChronoUnit.DAYS.between(effectiveToday, nextRace.startDate)
            val rStart = Constants.firstRaceNumberForRound(nextRace.round)
            val rEnd   = nextRace.round * 3
            val dateString = "${nextRace.startDate.format(DAY_FMT)} - ${nextRace.endDate.format(DAY_FMT)} ${nextRace.endDate.format(MONTH_YEAR_FMT)}"

            val schedule = try { ScheduleRepository.getSchedule() } catch (_: Exception) { null }
            val sessions = if (testMode) {
                // Fake sessions relative to now so nextSessionInfo() time comparisons work correctly
                val now = java.time.LocalTime.now()
                val fmt = java.time.format.DateTimeFormatter.ofPattern("HH:mm")
                listOf(
                    RaceSession("Free Practice",  "SAT", now.minusMinutes(10).format(fmt)),
                    RaceSession("Qualifying",      "SAT", now.plusMinutes(25).format(fmt)),
                    RaceSession("Qualifying Race", "SUN", now.plusMinutes(90).format(fmt)),
                    RaceSession("Race 1",          "SUN", now.plusMinutes(150).format(fmt)),
                    RaceSession("Race 2",          "SUN", now.plusMinutes(210).format(fmt)),
                    RaceSession("Race 3",          "SUN", now.plusMinutes(270).format(fmt)),
                )
            } else {
                schedule?.get(nextRace.round)
            }
            val sessionInfo = if (isWeekend && sessions != null) nextSessionInfo(sessions, nextRace, if (testMode) LocalDate.now() else null) else null

            when {
                isWeekend && sessionInfo != null -> {
                    val (sessionName, timeDisplay, isLive) = sessionInfo
                    if (isLive) {
                        views.setTextViewText(R.id.widget_countdown, "LIVE")
                        views.setTextColor(R.id.widget_countdown, 0xFF00C853.toInt())
                        views.setTextViewText(R.id.widget_countdown_label, sessionName)
                    } else {
                        views.setTextViewText(R.id.widget_countdown, timeDisplay)
                        views.setTextColor(R.id.widget_countdown, 0xFFF5C400.toInt())
                        views.setTextViewText(R.id.widget_countdown_label, sessionName)
                    }
                }
                isWeekend -> {
                    views.setTextViewText(R.id.widget_countdown, "RACE")
                    views.setTextViewText(R.id.widget_countdown_label, "WEEKEND")
                    views.setTextColor(R.id.widget_countdown, 0xFFF5C400.toInt())
                }
                daysUntil == 1L -> {
                    views.setTextViewText(R.id.widget_countdown, "TMW")
                    views.setTextViewText(R.id.widget_countdown_label, "")
                    views.setTextColor(R.id.widget_countdown, 0xFFF5C400.toInt())
                }
                else -> {
                    views.setTextViewText(R.id.widget_countdown, "$daysUntil")
                    views.setTextViewText(
                        R.id.widget_countdown_label,
                        if (sizeClass == SizeClass.SMALL) "DAYS" else "DAYS\nTO GO",
                    )
                    views.setTextColor(R.id.widget_countdown, 0xFFFFFFFF.toInt())
                }
            }

            when (sizeClass) {
                SizeClass.SMALL -> {
                    views.setTextViewText(R.id.widget_venue, nextRace.venue)
                    views.setViewVisibility(R.id.widget_venue, if (minHeight >= 50) View.VISIBLE else View.GONE)
                    if (minHeight >= 100) {
                        views.setTextViewText(R.id.widget_round, "ROUNDS $rStart - $rEnd")
                        views.setViewVisibility(R.id.widget_round, View.VISIBLE)
                    } else {
                        views.setViewVisibility(R.id.widget_round, View.GONE)
                    }
                    views.setViewVisibility(R.id.widget_dates, View.GONE)
                }

                SizeClass.WIDE -> {
                    views.setTextViewText(R.id.widget_round, "ROUNDS $rStart - $rEnd")
                    views.setTextViewText(R.id.widget_venue, nextRace.venue)
                    views.setViewVisibility(R.id.widget_info_section, View.VISIBLE)

                    if (isWeekend && sessionInfo != null) {
                        val (_, _, isLive) = sessionInfo
                        views.setTextViewText(R.id.widget_dates, if (isLive) "ON NOW" else "UP NEXT")
                        views.setViewVisibility(R.id.widget_dates, View.VISIBLE)
                        views.setViewVisibility(R.id.widget_divider, View.GONE)
                        views.setViewVisibility(R.id.widget_schedule_row, View.GONE)
                        views.setViewVisibility(R.id.widget_no_schedule, View.GONE)
                    } else {
                        views.setTextViewText(R.id.widget_dates, dateString)
                        views.setViewVisibility(R.id.widget_dates, if (minHeight >= 80) View.VISIBLE else View.GONE)
                        if (sessions != null && sessions.isNotEmpty() && minHeight >= 130) {
                            views.setViewVisibility(R.id.widget_divider, View.VISIBLE)
                            views.setViewVisibility(R.id.widget_schedule_row, View.VISIBLE)
                            views.setViewVisibility(R.id.widget_no_schedule, View.GONE)
                            bindSessions(views, sessions.filter { it.day == "SAT" }, SAT_NAME_IDS, SAT_TIME_IDS)
                            bindSessions(views, sessions.filter { it.day == "SUN" }, SUN_NAME_IDS, SUN_TIME_IDS)
                        } else {
                            views.setViewVisibility(R.id.widget_divider, View.GONE)
                            views.setViewVisibility(R.id.widget_schedule_row, View.GONE)
                            views.setViewVisibility(R.id.widget_no_schedule, View.GONE)
                        }
                    }
                }

                SizeClass.WIDE_TALL -> {
                    views.setTextViewText(R.id.widget_round, "ROUNDS $rStart - $rEnd")
                    views.setTextViewText(R.id.widget_venue, nextRace.venue)

                    if (isWeekend && sessionInfo != null) {
                        val (_, _, isLive) = sessionInfo
                        views.setTextViewText(R.id.widget_dates, if (isLive) "ON NOW" else "UP NEXT")
                        views.setViewVisibility(R.id.widget_dates, View.VISIBLE)
                        views.setViewVisibility(R.id.widget_divider, View.GONE)
                        views.setViewVisibility(R.id.widget_schedule_row, View.GONE)
                        views.setViewVisibility(R.id.widget_no_schedule, View.GONE)
                    } else {
                        views.setTextViewText(R.id.widget_dates, dateString)
                        if (sessions != null && sessions.isNotEmpty()) {
                            views.setViewVisibility(R.id.widget_divider, View.VISIBLE)
                            views.setViewVisibility(R.id.widget_schedule_row, View.VISIBLE)
                            views.setViewVisibility(R.id.widget_no_schedule, View.GONE)
                            bindSessions(views, sessions.filter { it.day == "SAT" }, SAT_NAME_IDS, SAT_TIME_IDS)
                            bindSessions(views, sessions.filter { it.day == "SUN" }, SUN_NAME_IDS, SUN_TIME_IDS)
                        } else {
                            views.setViewVisibility(R.id.widget_divider, View.VISIBLE)
                            views.setViewVisibility(R.id.widget_schedule_row, View.GONE)
                            views.setViewVisibility(R.id.widget_no_schedule, View.VISIBLE)
                        }
                    }
                }
            }

            return views
        }

        /**
         * During a race weekend, find the next (or currently live) session.
         * Returns Triple(sessionName, countdownText, isLive).
         * Sessions are assumed to last ~90 minutes.
         */
        private fun nextSessionInfo(
            sessions: List<RaceSession>,
            race: com.btccfanhub.data.model.Race,
            testDateOverride: LocalDate? = null,
        ): Triple<String, String, Boolean>? {
            val now = java.time.LocalDateTime.now()
            val sessionDuration = java.time.Duration.ofMinutes(90)
            val timeFmt = java.time.format.DateTimeFormatter.ofPattern("HH:mm")

            // In test mode, map all sessions to today so time comparisons work correctly.
            // Normally SAT → startDate, SUN → endDate.
            fun dayDate(day: String) = when {
                testDateOverride != null -> testDateOverride
                day.uppercase() == "SUN" -> race.endDate
                else -> race.startDate
            }

            data class SessionWithTime(val session: RaceSession, val start: java.time.LocalDateTime)

            val timed = sessions.mapNotNull { s ->
                if (s.time == "TBA" || s.time.isBlank()) return@mapNotNull null
                runCatching {
                    val t = java.time.LocalTime.parse(s.time, timeFmt)
                    SessionWithTime(s, dayDate(s.day).atTime(t))
                }.getOrNull()
            }.sortedBy { it.start }

            // Find a live session (started within last 90 min and not yet ended)
            val live = timed.firstOrNull { it.start <= now && now < it.start.plus(sessionDuration) }
            if (live != null) {
                val minsLeft = java.time.Duration.between(now, live.start.plus(sessionDuration)).toMinutes()
                return Triple(abbreviate(live.session.name), "${minsLeft}m left", true)
            }

            // Find the next upcoming session today or tomorrow
            val next = timed.firstOrNull { it.start > now } ?: return null
            val minsUntil = java.time.Duration.between(now, next.start).toMinutes()
            val display = when {
                minsUntil < 60  -> "${minsUntil}m"
                minsUntil < 120 -> "${minsUntil / 60}h ${minsUntil % 60}m"
                else            -> next.session.time
            }
            return Triple(abbreviate(next.session.name), display, false)
        }

        private fun bindSessions(
            views: RemoteViews,
            sessions: List<RaceSession>,
            nameIds: IntArray,
            timeIds: IntArray,
        ) {
            for (i in nameIds.indices) {
                if (i < sessions.size) {
                    val session = sessions[i]
                    views.setTextViewText(nameIds[i], abbreviate(session.name))
                    views.setTextViewText(timeIds[i], session.time)
                    views.setTextColor(timeIds[i], 0xFFFFFFFF.toInt())
                    views.setViewVisibility(nameIds[i], View.VISIBLE)
                    views.setViewVisibility(timeIds[i], View.VISIBLE)
                } else {
                    views.setViewVisibility(nameIds[i], View.GONE)
                    views.setViewVisibility(timeIds[i], View.GONE)
                }
            }
        }

        private fun abbreviate(name: String): String = when {
            name.contains("Free Practice") -> name.replace("Free Practice", "FP")
            name.contains("Qualifying Race") -> name.replace("Qualifying Race", "Quali Race")
            name.contains("Qualifying") -> name.replace("Qualifying", "Quali")
            else -> name
        }

        private fun buildLiveryBitmap(
            context: Context,
            widthDp: Int,
            heightDp: Int,
            theme: WidgetTheme,
        ): Bitmap {
            val density = context.resources.displayMetrics.density
            val w = (widthDp * density).toInt().coerceAtLeast(80)
            val h = (heightDp * density).toInt().coerceAtLeast(40)
            val cornerRadius = 16f * density

            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)

            val wf = w.toFloat()
            val hf = h.toFloat()

            val clipPath = Path().apply {
                addRoundRect(RectF(0f, 0f, wf, hf), cornerRadius, cornerRadius, Path.Direction.CW)
            }
            canvas.clipPath(clipPath)

            paint.color = theme.previewColor.toInt()
            canvas.drawRect(0f, 0f, wf, hf, paint)

            // Per-team livery drawing
            when (theme) {

                WidgetTheme.VERTU -> {
                    // Teal base, orange right panel, thin navy inset stripe
                    paint.color = withAlpha(0xFFF26522L, 0.95f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.72f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.44f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFF002147L, 0.85f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.67f, 0f); lineTo(wf * 0.69f, 0f); lineTo(wf * 0.41f, hf); lineTo(wf * 0.39f, hf); close()
                    }, paint)
                }

                WidgetTheme.NAPA -> {
                    // Royal blue base, bold yellow right panel + dark shadow left
                    paint.color = withAlpha(0xFF0F2560L, 0.60f)
                    canvas.drawPath(Path().apply {
                        moveTo(0f, 0f); lineTo(wf * 0.18f, 0f); lineTo(wf * 0.05f, hf); lineTo(0f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFF5C400L, 0.95f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.60f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.35f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFF5C400L, 0.50f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.55f, 0f); lineTo(wf * 0.59f, 0f); lineTo(wf * 0.34f, hf); lineTo(wf * 0.30f, hf); close()
                    }, paint)
                }

                WidgetTheme.LASER -> {
                    // Deep blue base, two white diagonal stripes
                    paint.color = withAlpha(0xFFFFFFFFL, 0.18f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.50f, 0f); lineTo(wf * 0.62f, 0f); lineTo(wf * 0.38f, hf); lineTo(wf * 0.26f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFFFFFFFL, 0.70f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.50f, 0f); lineTo(wf * 0.54f, 0f); lineTo(wf * 0.30f, hf); lineTo(wf * 0.26f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFFFFFFFL, 0.45f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.64f, 0f); lineTo(wf * 0.67f, 0f); lineTo(wf * 0.43f, hf); lineTo(wf * 0.40f, hf); close()
                    }, paint)
                }

                WidgetTheme.PLATO -> {
                    // Cataclean camo: purple + magenta diagonal bands on near-black
                    paint.color = withAlpha(0xFF9B1FD4L, 0.55f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.30f, 0f); lineTo(wf * 0.55f, 0f); lineTo(wf * 0.35f, hf); lineTo(wf * 0.10f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFCC3399L, 0.65f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.55f, 0f); lineTo(wf * 0.62f, 0f); lineTo(wf * 0.42f, hf); lineTo(wf * 0.35f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFF9B1FD4L, 0.40f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.72f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.55f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFCC3399L, 0.80f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.28f, 0f); lineTo(wf * 0.31f, 0f); lineTo(wf * 0.11f, hf); lineTo(wf * 0.08f, hf); close()
                    }, paint)
                }

                WidgetTheme.SPEEDWORKS -> {
                    // Toyota red base, white diagonal slash + darker red shadow right
                    paint.color = withAlpha(0xFFFFFFFFL, 0.15f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.48f, 0f); lineTo(wf * 0.60f, 0f); lineTo(wf * 0.36f, hf); lineTo(wf * 0.24f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFFFFFFFL, 0.75f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.48f, 0f); lineTo(wf * 0.52f, 0f); lineTo(wf * 0.28f, hf); lineTo(wf * 0.24f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFF7A0010L, 0.60f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.78f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.58f, hf); close()
                    }, paint)
                }

                WidgetTheme.WSR -> {
                    // Dark navy base, BMW blue panel + light-blue leading stripe
                    paint.color = withAlpha(0xFF1E6FE8L, 0.85f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.62f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.38f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFF5BA3FFL, 0.70f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.58f, 0f); lineTo(wf * 0.62f, 0f); lineTo(wf * 0.38f, hf); lineTo(wf * 0.34f, hf); close()
                    }, paint)
                }

                WidgetTheme.PMR -> {
                    // Charcoal base, gold diagonal panel
                    paint.color = withAlpha(0xFFFFCC00L, 0.90f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.65f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.40f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFFFCC00L, 0.45f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.60f, 0f); lineTo(wf * 0.64f, 0f); lineTo(wf * 0.39f, hf); lineTo(wf * 0.35f, hf); close()
                    }, paint)
                }

                WidgetTheme.ONE_MS -> {
                    // Black base, bold red diagonal slash
                    paint.color = withAlpha(0xFFE8002DL, 0.85f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.55f, 0f); lineTo(wf * 0.70f, 0f); lineTo(wf * 0.46f, hf); lineTo(wf * 0.31f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFFE8002DL, 0.40f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.70f, 0f); lineTo(wf * 0.73f, 0f); lineTo(wf * 0.49f, hf); lineTo(wf * 0.46f, hf); close()
                    }, paint)
                }

                WidgetTheme.RESTART -> {
                    // Dark navy base, cyan diagonal panel
                    paint.color = withAlpha(0xFF00C8E8L, 0.80f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.68f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.42f, hf); close()
                    }, paint)
                    paint.color = withAlpha(0xFF00C8E8L, 0.50f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.63f, 0f); lineTo(wf * 0.67f, 0f); lineTo(wf * 0.41f, hf); lineTo(wf * 0.37f, hf); close()
                    }, paint)
                }

                else -> {
                    // Classic themes — subtle tonal accent diagonal
                    paint.color = withAlpha(theme.accentColor, 0.22f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.52f, 0f); lineTo(wf, 0f); lineTo(wf, hf); lineTo(wf * 0.22f, hf); close()
                    }, paint)
                    paint.color = withAlpha(theme.accentColor, 0.80f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.52f, 0f); lineTo(wf * 0.56f, 0f); lineTo(wf * 0.26f, hf); lineTo(wf * 0.22f, hf); close()
                    }, paint)
                    paint.color = withAlpha(theme.accentColor, 0.35f)
                    canvas.drawPath(Path().apply {
                        moveTo(wf * 0.45f, 0f); lineTo(wf * 0.47f, 0f); lineTo(wf * 0.17f, hf); lineTo(wf * 0.15f, hf); close()
                    }, paint)
                }
            }

            return bmp
        }

        private fun withAlpha(color: Long, alpha: Float): Int {
            val a = (alpha * 255).toInt().coerceIn(0, 255)
            return (color.toInt() and 0x00FFFFFF) or (a shl 24)
        }
    }
}
