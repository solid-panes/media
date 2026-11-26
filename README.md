# media

A dynamic SolidOS pane that plays video and sound and shows pictures, read-only.

Loads at runtime by link, with no build or release.

**Try it** in the pane runner or in the SolidOS data browser:

| Sample | Pane runner | SolidOS browser |
|---|---|---|
| Test pattern, MP4 (video) | [open](https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Ftest-pattern.mp4) | [open](https://solidos.org/docs/browser/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Ftest-pattern.mp4) |
| Test pattern, WebM (video) | [open](https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Ftest-pattern.webm) | [open](https://solidos.org/docs/browser/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Ftest-pattern.webm) |
| Arpeggio, MP3 (audio) | [open](https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Farpeggio.mp3) | [open](https://solidos.org/docs/browser/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Farpeggio.mp3) |
| Arpeggio, Ogg Opus (audio) | [open](https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Farpeggio.ogg) | [open](https://solidos.org/docs/browser/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Farpeggio.ogg) |
| Panes, SVG (image) | [open](https://jss.live/pane-runner/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Fpanes.svg) | [open](https://solidos.org/docs/browser/?pane=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fmedia-pane.js&uri=https%3A%2F%2Fsolid-panes.github.io%2Fmedia%2Fsamples%2Fpanes.svg) |

The page asks before it runs a pane from a site it has not seen. Allow it, and the file opens.

## What it does

- Opens files by their extension:
  - video: `mp4`, `m4v`, `webm`, `ogv`, `mov`
  - audio: `mp3`, `ogg`, `oga`, `wav`, `m4a`, `flac`, `opus`
  - images: `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`, `avif`
- Also opens a file with no such extension when the store already knows its content type is `video/*`, `audio/*` or `image/*`. It leaves folders alone.
- Shows a card with the file name, its size and type (asked for with a `HEAD` request), the length of a video or sound, and the size of a picture.
- Plays a video with the browser's own controls, or shows the picture, sized to fit the window.
- Plays sound in its own player:
  - a **waveform** of the whole file to click, tap or drag to any point (a plain bar for files over 40 MB, or when the server does not allow the file to be read);
  - title, artist, album and **cover art** from the file's tags (ID3v2 in MP3, Vorbis comments in Ogg and FLAC), or the file name;
  - big buttons: play and pause, back 15 s, forward 30 s, speed (0.75× to 2×), repeat, mute, and a volume slider;
  - keys while it has focus: <kbd>Space</kbd> play or pause, <kbd>←</kbd> <kbd>→</kbd> 5 s, <kbd>↑</kbd> <kbd>↓</kbd> volume, <kbd>M</kbd> mute;
  - the phone's lock screen and the keyboard's media keys work too (Media Session);
  - it remembers where you stopped, in this browser only, and offers **Resume from m:ss**.
- If the browser cannot play the file, it says so and gives a link to open it.
- **Open in new tab** and **Download** buttons.
- Reads the file and writes nothing to it; the only thing it keeps is the place you stopped, in the browser's local storage.

## Load it

```js
panes.register((await import('https://solid-panes.github.io/media/media-pane.js')).default)
```

or `jss start ... --panes https://solid-panes.github.io/media/media-pane.js`.

## Early days

- Which formats play is up to the browser: most play MP4 (H.264), WebM, MP3 and Ogg; `mov`, `flac` and some others vary. When one does not play, the card says so.
- The player loads the file straight from its address, so a file that needs you to be logged in to your pod may not play yet.

## Licence

[MIT](LICENSE), copyright Melvin Carvalho.

The samples are made for this repository: `tools/samples.sh` generates the video and sound with ffmpeg and tags the sound, the cover art is `tools/cover.svg`, and `samples/panes.svg` is drawn by hand. The share card (`og.png`) is rendered by `tools/og.mjs`; its font, Atkinson Hyperlegible, is under the SIL Open Font License.
