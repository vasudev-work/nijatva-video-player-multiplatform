package com.nijatva.videoplayer.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Colors = darkColorScheme(
    primary = Color(0xFF10B981),
    onPrimary = Color(0xFF00281B),
    secondary = Color(0xFF3B82F6),
    onSecondary = Color(0xFFFFFFFF),
    tertiary = Color(0xFF22D3EE),
    background = Color(0xFF121212),
    onBackground = Color(0xFFF3F4F6),
    surface = Color(0xFF1A1A1A),
    onSurface = Color(0xFFF3F4F6),
    surfaceVariant = Color(0xFF262626),
    onSurfaceVariant = Color(0xFF9CA3AF),
)

@Composable
fun NijatvaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, content = content)
}
