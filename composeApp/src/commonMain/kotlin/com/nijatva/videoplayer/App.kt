package com.nijatva.videoplayer

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nijatva.videoplayer.player.VideoSurface
import com.nijatva.videoplayer.player.rememberVideoPlayer
import com.nijatva.videoplayer.ui.NijatvaTheme
import com.nijatva.videoplayer.util.formatTime
import kotlinx.coroutines.delay

@Composable
fun App() {
    NijatvaTheme {
        val player = rememberVideoPlayer()
        var url by remember { mutableStateOf("") }
        var opened by remember { mutableStateOf(false) }
        var position by remember { mutableLongStateOf(0L) }
        var duration by remember { mutableLongStateOf(0L) }
        var playing by remember { mutableStateOf(false) }
        var scrubbing by remember { mutableStateOf(false) }
        var scrub by remember { mutableStateOf(0f) }

        LaunchedEffect(opened) {
            while (opened) {
                if (!scrubbing) {
                    position = player.positionMs()
                    duration = player.durationMs()
                }
                playing = player.isPlaying()
                delay(500)
            }
        }

        Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Nijatva Video Player",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground,
                )
            }

            Box(
                modifier = Modifier.fillMaxWidth().weight(1f).background(Color.Black),
                contentAlignment = Alignment.Center,
            ) {
                if (opened) {
                    VideoSurface(player, Modifier.fillMaxSize())
                } else {
                    Text("Open a video or paste a stream URL", color = Color(0xFF9CA3AF))
                }
            }

            Column(Modifier.fillMaxWidth().padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(formatTime(if (scrubbing) scrub.toLong() else position), color = MaterialTheme.colorScheme.onBackground)
                    Slider(
                        value = if (scrubbing) scrub else position.toFloat().coerceIn(0f, duration.toFloat().coerceAtLeast(1f)),
                        onValueChange = { scrubbing = true; scrub = it },
                        onValueChangeFinished = {
                            player.seekTo(scrub.toLong())
                            scrubbing = false
                        },
                        valueRange = 0f..duration.toFloat().coerceAtLeast(1f),
                        modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                    )
                    Text(formatTime(duration), color = MaterialTheme.colorScheme.onBackground)
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Button(onClick = { if (playing) player.pause() else player.play() }, enabled = opened) {
                        Text(if (playing) "Pause" else "Play")
                    }
                    TextButton(onClick = { player.seekTo((player.positionMs() - 10_000).coerceAtLeast(0)) }, enabled = opened) {
                        Text("-10s")
                    }
                    TextButton(onClick = { player.seekTo(player.positionMs() + 10_000) }, enabled = opened) {
                        Text("+10s")
                    }
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = url,
                        onValueChange = { url = it },
                        label = { Text("Video path or stream URL") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = {
                            if (url.isNotBlank()) {
                                player.open(url.trim())
                                opened = true
                            }
                        },
                        enabled = url.isNotBlank(),
                    ) {
                        Text("Open")
                    }
                }
            }
        }
    }
}
