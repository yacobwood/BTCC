package com.btccfanhub.widget

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.app.Activity
import com.btccfanhub.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WidgetConfigureActivity : Activity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private var selectedTheme = WidgetTheme.NAVY
    private val swatchViews = mutableMapOf<WidgetTheme, ImageView>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        appWidgetId = intent.extras
            ?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setContentView(R.layout.activity_widget_configure)

        val grid = findViewById<LinearLayout>(R.id.theme_grid)
        val density = resources.displayMetrics.density

        addSectionLabel(grid, "CLASSIC")
        addThemeRows(grid, WidgetTheme.classics, density)

        addSpacer(grid, 16, density)
        addSectionLabel(grid, "TEAMS")
        addThemeRows(grid, WidgetTheme.teams, density)

        updateSelection()

        findViewById<Button>(R.id.btn_confirm).setOnClickListener { confirm() }
    }

    private fun addSectionLabel(parent: LinearLayout, text: String) {
        val tv = TextView(this).apply {
            this.text = text
            setTextColor(Color.parseColor("#8A8D94"))
            textSize = 11f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            letterSpacing = 0.15f
        }
        parent.addView(tv, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { bottomMargin = (8 * resources.displayMetrics.density).toInt() })
    }

    private fun addSpacer(parent: LinearLayout, dp: Int, density: Float) {
        val spacer = android.view.View(this)
        parent.addView(spacer, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, (dp * density).toInt(),
        ))
    }

    private fun addThemeRows(parent: LinearLayout, themes: List<WidgetTheme>, density: Float) {
        themes.chunked(3).forEach { row ->
            val rowLayout = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            row.forEach { theme ->
                val cell = createSwatchCell(theme, density)
                rowLayout.addView(cell, LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f,
                ).apply { marginEnd = (8 * density).toInt() })
            }
            // Fill empty slots
            repeat(3 - row.size) {
                val spacer = android.view.View(this)
                rowLayout.addView(spacer, LinearLayout.LayoutParams(
                    0, 0, 1f,
                ).apply { marginEnd = (8 * density).toInt() })
            }
            parent.addView(rowLayout, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = (8 * density).toInt() })
        }
    }

    private fun createSwatchCell(theme: WidgetTheme, density: Float): LinearLayout {
        val cell = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }

        val swatchH = (56 * density).toInt()
        val swatch = ImageView(this).apply {
            val bmp = LiveryRenderer.buildLiveryBitmap(this@WidgetConfigureActivity, 120, 56, theme)
            setImageBitmap(bmp)
            scaleType = ImageView.ScaleType.FIT_XY
            val bg = GradientDrawable().apply {
                cornerRadius = 8 * density
            }
            background = bg
            clipToOutline = true
            outlineProvider = object : android.view.ViewOutlineProvider() {
                override fun getOutline(view: android.view.View, outline: android.graphics.Outline) {
                    outline.setRoundRect(0, 0, view.width, view.height, 8 * density)
                }
            }
        }
        swatchViews[theme] = swatch
        swatch.setOnClickListener {
            selectedTheme = theme
            updateSelection()
        }
        cell.addView(swatch, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, swatchH,
        ))

        val label = TextView(this).apply {
            text = theme.label
            setTextColor(Color.parseColor("#8A8D94"))
            textSize = 11f
            gravity = Gravity.CENTER
        }
        cell.addView(label, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { topMargin = (4 * density).toInt() })

        cell.tag = label // store label ref for selection update
        return cell
    }

    private fun updateSelection() {
        val yellow = Color.parseColor("#FEBD02")
        val border = Color.parseColor("#2A2D35")
        val density = resources.displayMetrics.density

        swatchViews.forEach { (theme, iv) ->
            val isSelected = theme == selectedTheme
            val bg = GradientDrawable().apply {
                cornerRadius = 8 * density
                setStroke(
                    if (isSelected) (2 * density).toInt() else (1 * density).toInt(),
                    if (isSelected) yellow else border,
                )
            }
            iv.foreground = bg

            val label = (iv.parent as? LinearLayout)?.tag as? TextView
            label?.setTextColor(if (isSelected) yellow else Color.parseColor("#8A8D94"))
            label?.setTypeface(label.typeface, if (isSelected) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
        }
    }

    private fun confirm() {
        WidgetPrefs.saveTheme(this, appWidgetId, selectedTheme)

        val mgr = AppWidgetManager.getInstance(this)
        val info = mgr.getAppWidgetInfo(appWidgetId)
        val widgetSize = when (info?.provider?.className) {
            SmallWidget::class.java.name -> WidgetSize.SMALL
            LargeWidget::class.java.name -> WidgetSize.LARGE
            else -> WidgetSize.MEDIUM
        }
        WidgetPrefs.saveSize(this, appWidgetId, widgetSize)

        // Trigger an immediate widget update
        val ids = intArrayOf(appWidgetId)
        val updateIntent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            component = info?.provider
        }
        sendBroadcast(updateIntent)

        val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        setResult(RESULT_OK, result)
        finish()
    }
}
