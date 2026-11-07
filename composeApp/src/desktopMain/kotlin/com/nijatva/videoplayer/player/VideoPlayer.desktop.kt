package com.nijatva.videoplayer.player

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.awt.SwingPanel
import uk.co.caprica.vlcj.player.component.EmbeddedMediaPlayerComponent

/**
 * Desktop playback through libVLC (vlcj). VLC must be installed on the machine
 * (or libVLC bundled into the package) for this to work.
 */
class DesktopVideoPlayer : VideoPlayer {
    val component = EmbeddedMediaPlayerComponent()
    private val media get() = component.mediaPlayer()

    override fun open(uri: String) { media.media().play(uri) }
    override fun play() { media.controls().play() }
    override fun pause() { media.controls().pause() }
    override fun seekTo(positionMs: Long) { media.controls().setTime(positionMs) }
    override fun release() { component.release() }
    override fun positionMs(): Long = media.status().time()
    override fun durationMs(): Long = media.status().length()
    override fun isPlaying(): Boolean = media.status().isPlaying
}

@Composable
actual fun rememberVideoPlayer(): VideoPlayer = remember { DesktopVideoPlayer() }

@Composable
actual fun VideoSurface(player: VideoPlayer, modifier: Modifier) {
    val impl = player as DesktopVideoPlayer
    SwingPanel(modifier = modifier, factory = { impl.component })
}
