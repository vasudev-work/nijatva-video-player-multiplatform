package com.nijatva.videoplayer.util

fun formatTime(ms: Long): String {
    if (ms <= 0L) return "00:00"
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    fun two(v: Long) = if (v < 10) "0$v" else "$v"
    return if (h > 0) "$h:${two(m)}:${two(s)}" else "${two(m)}:${two(s)}"
}
