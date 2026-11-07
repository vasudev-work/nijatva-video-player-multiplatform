# Nijatva Video Player — multiplatform

One product, several platforms, built from a single Compose Multiplatform codebase.

| Platform | How it plays | Artifact |
|---|---|---|
| **Android** | AndroidX Media3 (ExoPlayer) | `app-debug.apk` |
| **Windows** | libVLC via vlcj | `.msi` installer |
| **macOS** | libVLC via vlcj | `.dmg` installer |
| **Linux** | libVLC via vlcj | `.deb` package |
| **Web** | HTML5 `<video>` (plain HTML/JS, no build step) | static site |

> **iOS is not built yet.** A runnable iOS app needs an Xcode project *and* an Apple
> Developer signing certificate — neither can be produced without your Apple account.
> The shared Compose UI is iOS-ready; the AVPlayer surface and Xcode project are the
> next step once signing is available.

## Layout

```
composeApp/
  src/commonMain/kotlin/com/nijatva/videoplayer/
    App.kt                 # shared UI: player, seek bar, transport, URL box
    ui/Theme.kt            # green + blue + white + black palette
    player/VideoPlayer.kt  # expect: VideoPlayer + VideoSurface
  src/androidMain/...      # Media3 implementation + MainActivity
  src/desktopMain/...      # vlcj implementation + main()
web/                       # standalone HTML5 player (index.html + app.js)
.github/workflows/build.yml# CI: Android APK, 3 desktop installers, web bundle
```

The shared code only knows a tiny interface:

```kotlin
interface VideoPlayer {
    fun open(uri: String); fun play(); fun pause(); fun seekTo(positionMs: Long)
    fun release(); fun positionMs(): Long; fun durationMs(): Long; fun isPlaying(): Boolean
}
```

Each platform provides `rememberVideoPlayer()` and `VideoSurface()`; everything else
(the whole UI) is common.

## Build

```bash
./gradlew :composeApp:assembleDebug        # Android APK
./gradlew :composeApp:run                  # run the desktop app
./gradlew :composeApp:packageDeb           # Linux   (on Linux)
./gradlew :composeApp:packageDmg           # macOS   (on macOS)
./gradlew :composeApp:packageMsi           # Windows (on Windows)
```

Installers must be produced on their own OS — that is why CI runs a three-OS matrix.
Every push to `main` publishes all artifacts under the **Actions** tab.

### Desktop needs VLC

The desktop build uses libVLC through vlcj. Install VLC on the machine, or bundle
libVLC into the package (`nativeDistributions.appResourcesRoot`). Without libVLC the
window opens but playback fails.

### Web

`web/` is a static page — open `index.html` in a browser, or host the folder anywhere.
It supports a local file playlist, stream URLs, speed, fullscreen and keyboard
shortcuts (Space, ←/→).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
