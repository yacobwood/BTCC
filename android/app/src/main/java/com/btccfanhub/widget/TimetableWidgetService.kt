package com.btccfanhub.widget

import android.content.Intent
import android.widget.RemoteViewsService

class TimetableWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory =
        TimetableWidgetFactory(applicationContext)
}
