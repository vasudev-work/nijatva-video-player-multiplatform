package com.nijatva.videoplayer.player

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/** The small surface the shared UI needs from a platform playback engine. */
interface VideoPlayer {
    fun open(uri: String)
    fun play()
    fun pause()
    fun seekTo(positionMs: Long)
    fun release()
    fun positionMs(): Long
    fun durationMs(): Long
    fun isPlaying(): Boolean
}

@Composable
expect fun rememberVideoPlayer(): VideoPlayer

/** The platform's video surface, drawn inside the Compose layout. */
@Composable
expect fun VideoSurface(player: VideoPlayer, modifier: Modifier)
