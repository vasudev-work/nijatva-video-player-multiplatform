package com.nijatva.videoplayer

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application

fun main() = application {
    Window(onCloseRequest = ::exitApplication, title = "Nijatva Video Player") {
        App()
    }
}
