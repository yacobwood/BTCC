package com.btccfanhub.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF

/**
 * Draws team-themed livery bitmaps for widget backgrounds.
 * Ported from the original Kotlin app's CountdownWidget.buildLiveryBitmap().
 */
object LiveryRenderer {

    fun buildLiveryBitmap(
        context: Context,
        widthDp: Int,
        heightDp: Int,
        theme: WidgetTheme,
    ): Bitmap {
        val density = context.resources.displayMetrics.density
        // Cap pixel dimensions to avoid TransactionTooLargeException in RemoteViews
        val w = (widthDp * density).toInt().coerceIn(80, 800)
        val h = (heightDp * density).toInt().coerceIn(40, 600)
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

        // Base colour fill
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
