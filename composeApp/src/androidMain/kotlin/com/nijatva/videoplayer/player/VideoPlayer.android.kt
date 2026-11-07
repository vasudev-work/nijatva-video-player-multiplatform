package com.nijatva.videoplayer.player

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

private class AndroidVideoPlayer(context: Context) : VideoPlayer {
    val exoPlayer: ExoPlayer = ExoPlayer.Builder(context).build()

    override fun open(uri: String) {
        exoPlayer.setMediaItem(MediaItem.fromUri(uri))
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
    }

    override fun play() { exoPlayer.play() }
    override fun pause() { exoPlayer.pause() }
    override fun seekTo(positionMs: Long) { exoPlayer.seekTo(positionMs) }
    override fun release() { exoPlayer.release() }
    override fun positionMs(): Long = exoPlayer.currentPosition
    override fun durationMs(): Long = exoPlayer.duration.coerceAtLeast(0L)
    override fun isPlaying(): Boolean = exoPlayer.isPlaying
}

@Composable
actual fun rememberVideoPlayer(): VideoPlayer {
    val context = LocalContext.current
    val player = remember { AndroidVideoPlayer(context) }
    DisposableEffect(player) { onDispose { player.release() } }
    return player
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
actual fun VideoSurface(player: VideoPlayer, modifier: Modifier) {
    val impl = player as AndroidVideoPlayer
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            PlayerView(ctx).apply {
                this.player = impl.exoPlayer
                useController = false
            }
        },
        update = { it.player = impl.exoPlayer },
    )
}
