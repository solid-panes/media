// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Melvin Carvalho
//
// media-pane.js — plays a video or a sound file, or shows a picture, in the SolidOS data browser.
// Applies to a file (not a folder) whose name ends in a known media extension, or whose content
// type the store already knows to be video/*, audio/* or image/*. Draws a card with the file name,
// its size and type (from a HEAD request with a short Accept), the browser's own player or the
// picture, and Open and Download links. If the browser cannot play the file it says so and offers
// the Open link. Sound gets its own player, one calm centred card: the cover and title from the
// file's tags (ID3v2, Vorbis comments, FLAC), a waveform to click or drag (drawn from the decoded
// file, or a plain bar when it cannot be read), back 15 s / play / forward 30 s, pills for speed,
// loop, mute, a sleep timer, Download and Open, volume, the file's type, size and length in one
// line, lock-screen controls through the Media Session API, keyboard shortcuts, and "Resume from"
// the last position (kept in localStorage, the only thing it keeps). It imports nothing, builds
// the DOM with createElement/textContent (never innerHTML), and writes nothing to the server.
//
// https://solid-panes.github.io/media/ · licence: AGPL-3.0-or-later (see LICENSE).

const KINDS = {
  video: { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime' },
  audio: { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', flac: 'audio/flac', opus: 'audio/ogg' },
  image: { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif' }
}
const LABELS = { video: 'Video', audio: 'Audio', image: 'Image' }
const ACCEPT = 'video/*, audio/*, image/*, */*;q=0.1'
const STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif'
const ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2f6fde" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l4.6-2.8z" fill="#2f6fde"/></svg>')

const CSS = `
.mdp { box-sizing: border-box; width: 100%; padding: 16px; background: #fff; color: #1f2330; font: 15px/1.45 ${STACK} }
.mdp *, .mdp *::before, .mdp *::after { box-sizing: border-box }
.mdp.media-pane { max-width: 960px; margin: 0 auto }
.mdp-card { border: 1px solid #e3e7ef; border-radius: 16px; background: #fff; box-shadow: 0 1px 2px rgba(20, 30, 60, .05), 0 8px 24px rgba(20, 30, 60, .06); overflow: hidden }
.mdp-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 14px 16px 12px }
.mdp-head[hidden] { display: none }
.mdp-title { flex: 1 1 240px; min-width: 0 }
.mdp-name { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; color: #172042; overflow-wrap: anywhere }
.mdp-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; font-size: 12.5px; font-weight: 600; color: #5b6478 }
.mdp-chip { padding: 2px 9px; border-radius: 999px; background: #eef2f9; white-space: nowrap }
.mdp-chip.mdp-kind { background: #e6efff; color: #1f55b8 }
.mdp-actions { display: flex; flex-wrap: wrap; gap: 8px; flex: 0 0 auto }
.mdp .mdp-btn { display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid #cfd9ee; background: #f5f8fe; color: #1f4fa8; font-weight: 600; font-size: 14px; text-decoration: none; white-space: nowrap }
.mdp .mdp-btn:hover { background: #e9f0fd; border-color: #b4c6ea }
.mdp .mdp-btn:focus-visible { outline: 3px solid #6f9cf0; outline-offset: 2px }
.mdp .mdp-btn.mdp-primary { background: #2f6fde; border-color: #2f6fde; color: #fff }
.mdp .mdp-btn.mdp-primary:hover { background: #255fc4 }
.mdp-stage { display: flex; justify-content: center; align-items: center; background: #f4f6fa; border-top: 1px solid #e9edf4; min-height: 120px }
.mdp-stage.mdp-dark { background: #11141b }
.mdp-stage.mdp-checker { background-color: #f7f8fb; background-image: linear-gradient(45deg, #eceff4 25%, transparent 25%, transparent 75%, #eceff4 75%), linear-gradient(45deg, #eceff4 25%, transparent 25%, transparent 75%, #eceff4 75%); background-size: 20px 20px; background-position: 0 0, 10px 10px }
.mdp-video { display: block; width: 100%; max-height: 72vh; background: #11141b }
.mdp-img { display: block; max-width: 100%; max-height: 75vh; height: auto; object-fit: contain }
.mdp-stage.mdp-sound { padding: 28px 16px }
.mdp-audio { display: block; width: 100%; max-width: 560px }
.mdp-card.mdp-card-sound { border: 0; background: transparent; box-shadow: none; overflow: visible }
.mdp-stage.mdp-sound.mdp-tuned { display: block; padding: 4px 0 8px; background: transparent; border-top: 0 }
.mdp-player { position: relative; max-width: 560px; margin: 0 auto; padding: 28px 28px 20px; border-radius: 24px; background: #fff; border: 1px solid #e4e8f0; box-shadow: 0 1px 2px rgba(20, 30, 60, .04), 0 10px 30px rgba(32, 48, 96, .08); outline: none; text-align: center }
.mdp-player:focus-visible { box-shadow: 0 0 0 3px #6f9cf0, 0 10px 30px rgba(32, 48, 96, .08) }
.mdp-cover { position: relative; width: min(100%, 320px); aspect-ratio: 1 / 1; margin: 0 auto; border-radius: 18px; overflow: hidden; background: linear-gradient(135deg, #3b7bf0, #6a4fe0 55%, #c04fb4); box-shadow: 0 10px 28px rgba(40, 50, 110, .20); display: flex; align-items: center; justify-content: center }
.mdp-cover img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover }
.mdp-cover svg { width: 38%; height: 38%; color: rgba(255, 255, 255, .9); filter: drop-shadow(0 4px 10px rgba(20, 20, 60, .18)) }
.mdp-cover::before, .mdp-cover::after { content: ""; position: absolute; border-radius: 50%; pointer-events: none }
.mdp-cover::before { width: 70%; height: 70%; left: -18%; top: -22%; background: radial-gradient(circle, rgba(255, 255, 255, .30), rgba(255, 255, 255, 0) 70%) }
.mdp-cover::after { width: 34%; height: 34%; right: 9%; bottom: 10%; border: 10px solid rgba(255, 255, 255, .16) }
.mdp-cover.mdp-has-art::before, .mdp-cover.mdp-has-art::after { display: none }
.mdp-song { margin: 22px 0 0; font-size: 22px; line-height: 1.25; font-weight: 750; letter-spacing: -.01em; color: #141a33; overflow-wrap: anywhere }
.mdp-sub { margin: 4px 0 0; font-size: 15px; color: #646d82; overflow-wrap: anywhere }
.mdp-sub[hidden], .mdp-sub [hidden] { display: none }
.mdp-resume { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin: 18px 0 0; padding: 6px 6px 6px 14px; border-radius: 16px; background: #eef3ff; color: #1f3f86; font-size: 14px; font-weight: 600; text-align: left }
.mdp-resume span { flex: 1 1 auto }
.mdp-resume[hidden] { display: none }
.mdp-scrub { position: relative; margin: 22px 0 0; height: 64px; cursor: pointer; touch-action: pan-y; border-radius: 10px; outline: none }
.mdp-scrub:focus-visible { box-shadow: 0 0 0 3px #6f9cf0 }
.mdp-scrub canvas { display: block; width: 100%; height: 100% }
.mdp-scrub .mdp-track-bar { position: absolute; left: 0; right: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 99px; background: #e2e7f0; overflow: hidden }
.mdp-scrub .mdp-fill { height: 100%; width: 0; border-radius: 99px; background: #2f6fde }
.mdp-scrub.mdp-has-wave .mdp-track-bar { display: none }
.mdp-scrub:not(.mdp-has-wave) canvas { display: none }
.mdp-scrub:not(.mdp-has-wave) { height: 44px }
.mdp-tip { position: absolute; bottom: calc(100% + 4px); padding: 2px 8px; border-radius: 8px; background: #172042; color: #fff; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; transform: translateX(-50%); pointer-events: none; white-space: nowrap; opacity: 0; transition: opacity .12s }
.mdp-scrub:hover .mdp-tip { opacity: 1 }
.mdp-times { display: flex; justify-content: space-between; margin-top: 4px; font-size: 13px; color: #646d82; font-variant-numeric: tabular-nums; text-align: left }
.mdp-transport { display: flex; align-items: center; justify-content: center; gap: 22px; margin: 14px 0 0 }
.mdp .mdp-ctl { position: relative; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-width: 48px; height: 48px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; color: #26304f; font: 700 14px/1 ${STACK}; font-variant-numeric: tabular-nums; cursor: pointer; -webkit-tap-highlight-color: transparent }
.mdp .mdp-ctl:hover { background: #f0f3f9 }
.mdp .mdp-ctl:active { transform: scale(.95) }
.mdp .mdp-ctl:focus-visible { outline: 3px solid #6f9cf0; outline-offset: 2px }
.mdp .mdp-ctl svg { width: 26px; height: 26px; display: block }
.mdp .mdp-ctl.mdp-skip { width: 56px; height: 56px; padding: 0 }
.mdp .mdp-ctl.mdp-skip svg { width: 30px; height: 30px }
.mdp .mdp-ctl.mdp-play { width: 76px; height: 76px; padding: 0; background: #2f6fde; color: #fff; box-shadow: 0 6px 18px rgba(47, 111, 222, .32) }
.mdp .mdp-ctl.mdp-play:hover { background: #255fc4 }
.mdp .mdp-ctl.mdp-play svg { width: 32px; height: 32px }
.mdp-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 18px 0 0 }
.mdp .mdp-pill { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 48px; height: 48px; padding: 0 16px; border: 1px solid #e1e6ef; border-radius: 999px; background: #fff; color: #26304f; font: 650 14px/1 ${STACK}; font-variant-numeric: tabular-nums; text-decoration: none; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent }
.mdp .mdp-pill:hover { background: #f3f6fb; border-color: #d3dbe8 }
.mdp .mdp-pill:active { transform: scale(.97) }
.mdp .mdp-pill:focus-visible { outline: 3px solid #6f9cf0; outline-offset: 2px }
.mdp .mdp-pill svg { width: 19px; height: 19px; display: block; flex: 0 0 auto }
.mdp .mdp-pill[aria-pressed="true"] { background: #eaf1ff; border-color: #9dbcf3; color: #1f55b8 }
.mdp .mdp-pill.mdp-download { background: #2f6fde; border-color: #2f6fde; color: #fff; padding: 0 20px }
.mdp .mdp-pill.mdp-download:hover { background: #255fc4; border-color: #255fc4 }
.mdp .mdp-resume .mdp-ctl { height: 44px; min-width: 44px; padding: 0 14px; background: #2f6fde; color: #fff }
.mdp .mdp-resume .mdp-ctl.mdp-dismiss { background: transparent; color: #1f3f86; padding: 0 }
.mdp .mdp-resume .mdp-ctl.mdp-dismiss svg { width: 20px; height: 20px }
.mdp-vol { display: flex; align-items: center; justify-content: center; gap: 10px; max-width: 320px; margin: 10px auto 0; color: #7a8399 }
.mdp-vol svg { width: 20px; height: 20px; flex: 0 0 auto; display: block }
.mdp-range { -webkit-appearance: none; appearance: none; flex: 1 1 auto; min-width: 0; width: auto; height: 44px; margin: 0; background: transparent; cursor: pointer; --mdp-v: 100% }
.mdp-range:focus-visible { outline: 3px solid #6f9cf0; outline-offset: 2px; border-radius: 8px }
.mdp-range::-webkit-slider-runnable-track { height: 6px; border-radius: 99px; background: linear-gradient(to right, #2f6fde var(--mdp-v), #e2e7f0 var(--mdp-v)) }
.mdp-range::-moz-range-track { height: 6px; border-radius: 99px; background: #e2e7f0 }
.mdp-range::-moz-range-progress { height: 6px; border-radius: 99px; background: #2f6fde }
.mdp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; margin-top: -10px; border-radius: 50%; background: #fff; border: 2px solid #2f6fde; box-shadow: 0 2px 6px rgba(20, 30, 60, .2) }
.mdp-range::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 2px solid #2f6fde; box-shadow: 0 2px 6px rgba(20, 30, 60, .2) }
.mdp-keys { margin: 16px 0 0; font-size: 12px; color: #8a92a6 }
.mdp-keys span { display: inline-block; margin: 0 7px; white-space: nowrap }
.mdp-keys kbd { display: inline-block; min-width: 18px; padding: 0 4px; margin: 0 1px; border: 1px solid #e1e6ef; border-radius: 5px; background: #fafbfd; font: 600 11px/16px ${STACK}; color: #5b6478; text-align: center }
.mdp-details { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid #eef1f6; font-size: 12.5px; color: #8a92a6; font-variant-numeric: tabular-nums; overflow-wrap: anywhere }
.mdp-fallback { margin: 0; padding: 28px 16px; text-align: center; color: #3d4559 }
.mdp-fallback b { display: block; margin-bottom: 4px; font-size: 16px; color: #172042 }
.mdp-fallback a { color: #1f4fa8; font-weight: 600 }
.mdp-note { margin: 0; padding: 10px 16px; border-top: 1px solid #e9edf4; font-size: 12.5px; color: #69728a; overflow-wrap: anywhere }
@media (max-width: 520px) {
  .mdp { padding: 8px }
  .mdp-head { padding: 12px 12px 10px }
  .mdp-name { font-size: 16.5px }
  .mdp-actions { width: 100% }
  .mdp .mdp-btn { flex: 1 1 0; justify-content: center }
  .mdp-player { padding: 20px 16px 16px; border-radius: 20px }
  .mdp-cover { width: min(78%, 260px); border-radius: 16px }
  .mdp-song { margin-top: 18px; font-size: 20px }
  .mdp-sub { font-size: 14.5px }
  .mdp-scrub { height: 56px; margin-top: 18px }
  .mdp-transport { gap: 14px }
  .mdp-pills { gap: 8px }
  .mdp .mdp-pill { padding: 0 14px }
  .mdp-keys { display: none }
}
`

// The path's last part, without query or fragment.
function fileName (uri) {
  let path = uri
  try { path = new URL(uri).pathname } catch (e) {}
  const last = path.split('/').pop() || ''
  try { return decodeURIComponent(last) } catch (e) { return last }
}

function extension (uri) {
  const m = /\.([a-z0-9]+)$/i.exec(fileName(uri))
  return m ? m[1].toLowerCase() : ''
}

function kindOfType (type) {
  const m = /^\s*(video|audio|image)\//i.exec(type || '')
  return m ? m[1].toLowerCase() : null
}

function kindOfExtension (ext) {
  for (const kind of Object.keys(KINDS)) if (KINDS[kind][ext]) return kind
  return null
}

// What the store already knows of the content type: a response header the fetcher kept, or a
// type triple from the IANA media-types namespace (rdflib adds one for files it has fetched).
function knownType (subject, store) {
  if (!store) return null
  try {
    const doc = subject.doc ? subject.doc() : subject
    const h = store.fetcher && store.fetcher.getHeader && store.fetcher.getHeader(doc, 'content-type')
    if (h && h.length) return String(h[0])
  } catch (e) {}
  try {
    const types = store.each(subject, store.sym('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), null, subject.doc ? subject.doc() : undefined)
    for (const t of types) {
      const m = /\/media-types\/([a-z]+\/[^#]+)/i.exec(t.uri || '')
      if (m) return m[1]
    }
  } catch (e) {}
  return null
}

function kindOf (subject, store) {
  const uri = subject && subject.uri
  if (!uri || /\/$/.test(uri.split(/[?#]/)[0])) return null // a folder
  return kindOfExtension(extension(uri)) || kindOfType(knownType(subject, store))
}

function humanSize (n) {
  if (!(n >= 0)) return null
  if (n < 1024) return n + ' B'
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024; let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ' + units[i]
}

function humanTime (s) {
  if (!isFinite(s) || s <= 0) return null
  s = Math.round(s)
  const h = Math.floor(s / 3600); const m = Math.floor(s / 60) % 60; const sec = s % 60
  const two = n => String(n).padStart(2, '0')
  return h ? h + ':' + two(m) + ':' + two(sec) : m + ':' + two(sec)
}

// m:ss (or h:mm:ss), with 0:00 for nothing yet.
function clock (s) {
  return humanTime(s) || '0:00'
}

// ---- Tags. Small readers for ID3v2 (MP3), Vorbis comments (Ogg Vorbis/Opus, FLAC) and FLAC
// pictures. They return { title, artist, album, picture: { mime, data } } with whatever they find,
// and give up quietly on anything odd. The text only ever goes into textContent.

function decodeText (bytes, enc) {
  const label = ['latin1', 'utf-16', 'utf-16be', 'utf-8'][enc] || 'latin1'
  try {
    if (label === 'utf-16') {
      const le = !(bytes[0] === 0xfe && bytes[1] === 0xff)
      const body = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff) ? bytes.subarray(2) : bytes
      return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(body)
    }
    return new TextDecoder(label).decode(bytes)
  } catch (e) { return '' }
}

function cleanText (s) {
  return s.split('\u0000').map(x => x.trim()).filter(Boolean).join(' / ').slice(0, 300)
}

// Where a null terminator ends, in encoding enc (two zero bytes on an even step for UTF-16).
function nullEnd (b, start, enc) {
  if (enc === 1 || enc === 2) {
    for (let i = start; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i
    return b.length
  }
  const i = b.indexOf(0, start)
  return i < 0 ? b.length : i
}

function unsync (b) {
  const out = []
  for (let i = 0; i < b.length; i++) { out.push(b[i]); if (b[i] === 0xff && b[i + 1] === 0) i++ }
  return Uint8Array.from(out)
}

function readId3 (bytes) {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null
  const ver = bytes[3]
  const flags = bytes[5]
  if (ver < 2 || ver > 4) return null
  const safe = (b, i) => ((b[i] & 0x7f) << 21) | ((b[i + 1] & 0x7f) << 14) | ((b[i + 2] & 0x7f) << 7) | (b[i + 3] & 0x7f)
  const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]
  const size = safe(bytes, 6)
  let tag = bytes.subarray(10, Math.min(bytes.length, 10 + size))
  if ((flags & 0x80) && ver < 4) tag = unsync(tag)
  let pos = 0
  if ((flags & 0x40) && ver === 3) pos = 4 + u32(tag, 0)
  if ((flags & 0x40) && ver === 4) pos = safe(tag, 0)
  const out = {}
  const ids = ver === 2
    ? { TT2: 'title', TP1: 'artist', TAL: 'album', PIC: 'pic' }
    : { TIT2: 'title', TPE1: 'artist', TALB: 'album', APIC: 'pic' }
  const idLen = ver === 2 ? 3 : 4
  const headLen = ver === 2 ? 6 : 10
  while (pos + headLen <= tag.length) {
    if (tag[pos] === 0) break // padding
    const id = String.fromCharCode(...tag.subarray(pos, pos + idLen))
    const fsize = ver === 2 ? (tag[pos + 3] << 16) | (tag[pos + 4] << 8) | tag[pos + 5]
      : ver === 4 ? safe(tag, pos + 4) : u32(tag, pos + 4)
    const fflags = ver === 2 ? 0 : (tag[pos + 8] << 8) | tag[pos + 9]
    let body = tag.subarray(pos + headLen, pos + headLen + fsize)
    pos += headLen + fsize
    if (!/^[A-Z0-9]+$/.test(id) || fsize <= 0) break
    const key = ids[id]
    if (!key) continue
    if (ver === 3 && (fflags & 0xc0)) continue // compressed or encrypted
    if (ver === 4) {
      if (fflags & 0x0c) continue
      if (fflags & 0x40) body = body.subarray(1) // group id
      if (fflags & 0x01) body = body.subarray(4) // data length indicator
      if (fflags & 0x02) body = unsync(body)
    } else if (ver === 3 && (fflags & 0x20)) body = body.subarray(1)
    const enc = body[0]
    if (key !== 'pic') {
      const text = cleanText(decodeText(body.subarray(1), enc))
      if (text && !out[key]) out[key] = text
      continue
    }
    let p = 1; let mime
    if (ver === 2) {
      const fmt = String.fromCharCode(...body.subarray(1, 4)).toUpperCase()
      mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg'
      p = 4
    } else {
      const e = nullEnd(body, 1, 0)
      mime = decodeText(body.subarray(1, e), 0).toLowerCase() || 'image/jpeg'
      if (!mime.includes('/')) mime = 'image/' + (mime === 'jpg' ? 'jpeg' : mime)
      p = e + 1
    }
    const type = body[p]
    p = nullEnd(body, p + 1, enc) + (enc === 1 || enc === 2 ? 2 : 1)
    const data = body.subarray(p)
    if (data.length && /^image\/(png|jpeg|gif|webp)$/.test(mime) && (!out.picture || type === 3)) out.picture = { mime, data }
  }
  return out
}

// A FLAC METADATA_BLOCK_PICTURE body.
function readFlacPicture (b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let p = 4
  const mlen = dv.getUint32(p); p += 4
  const mime = decodeText(b.subarray(p, p + mlen), 0).toLowerCase(); p += mlen
  const dlen = dv.getUint32(p); p += 4 + dlen + 16
  const len = dv.getUint32(p); p += 4
  const data = b.subarray(p, p + len)
  return /^image\/(png|jpeg|gif|webp)$/.test(mime) && data.length === len ? { mime, data } : null
}

function readVorbisComments (b, out) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let p = 0
  const vlen = dv.getUint32(p, true); p += 4 + vlen
  const n = dv.getUint32(p, true); p += 4
  const map = { TITLE: 'title', ARTIST: 'artist', ALBUM: 'album' }
  for (let i = 0; i < n && i < 500 && p + 4 <= b.length; i++) {
    const len = dv.getUint32(p, true); p += 4
    if (p + len > b.length) break
    const s = decodeText(b.subarray(p, p + len), 3); p += len
    const eq = s.indexOf('=')
    if (eq < 1) continue
    const k = s.slice(0, eq).toUpperCase(); const v = s.slice(eq + 1)
    if (map[k] && !out[map[k]]) out[map[k]] = cleanText(v)
    if (k === 'METADATA_BLOCK_PICTURE' && !out.picture) {
      try { out.picture = readFlacPicture(Uint8Array.from(atob(v), c => c.charCodeAt(0))) } catch (e) {}
    }
  }
  return out
}

function readFlac (b) {
  if (b[0] !== 0x66 || b[1] !== 0x4c || b[2] !== 0x61 || b[3] !== 0x43) return null
  const out = {}
  let p = 4
  while (p + 4 <= b.length) {
    const last = b[p] & 0x80; const type = b[p] & 0x7f
    const len = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]
    const body = b.subarray(p + 4, p + 4 + len)
    if (body.length < len) break
    try {
      if (type === 4) readVorbisComments(body, out)
      if (type === 6 && !out.picture) out.picture = readFlacPicture(body)
    } catch (e) {}
    p += 4 + len
    if (last) break
  }
  return out
}

function readOgg (b) {
  if (b[0] !== 0x4f || b[1] !== 0x67 || b[2] !== 0x67 || b[3] !== 0x53) return null
  const find = (sig) => {
    const max = Math.min(b.length, 65536) - sig.length
    outer: for (let i = 0; i < max; i++) {
      for (let j = 0; j < sig.length; j++) if (b[i + j] !== sig[j]) continue outer
      return i + sig.length
    }
    return -1
  }
  let at = find([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]) // OpusTags
  if (at < 0) at = find([0x03, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73]) // \x03vorbis
  if (at < 0) return null
  try { return readVorbisComments(b.subarray(at), {}) } catch (e) { return null }
}

function readTags (bytes) {
  try { return readId3(bytes) || readFlac(bytes) || readOgg(bytes) || {} } catch (e) { return {} }
}

// ---- Icons, drawn with createElementNS (24 × 24, currentColor).
const ICONS = {
  play: ['M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z'],
  pause: ['M7 5h3.2a.8.8 0 0 1 .8.8v12.4a.8.8 0 0 1-.8.8H7a.8.8 0 0 1-.8-.8V5.8A.8.8 0 0 1 7 5z', 'M13.8 5H17a.8.8 0 0 1 .8.8v12.4a.8.8 0 0 1-.8.8h-3.2a.8.8 0 0 1-.8-.8V5.8a.8.8 0 0 1 .8-.8z'],
  back: ['M12 4.5a8 8 0 1 1-7.4 5', 'M4.2 4.6v5h5'],
  fwd: ['M12 4.5a8 8 0 1 0 7.4 5', 'M19.8 4.6v5h-5'],
  loop: ['M17 3.5l3 3-3 3', 'M4 11.5v-1a4 4 0 0 1 4-4h12', 'M7 20.5l-3-3 3-3', 'M20 12.5v1a4 4 0 0 1-4 4H4'],
  vol: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a7.5 7.5 0 0 1 0 11'],
  mute: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M16 9.5l5 5', 'M21 9.5l-5 5'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  download: ['M12 4v11', 'M7 10.5l5 5 5-5', 'M5 19.5h14'],
  open: ['M14 4.5h5.5V10', 'M19.5 4.5L11 13', 'M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10'],
  moon: ['M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z'],
  quiet: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z'],
  note: ['M9 18V6l11-2v12', 'M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3z', 'M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z']
}
const FILLED = { play: 1, pause: 1 }

function icon (dom, name, label) {
  const NS = 'http://www.w3.org/2000/svg'
  const svg = dom.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  for (const d of ICONS[name]) {
    const path = dom.createElementNS(NS, 'path')
    path.setAttribute('d', d)
    if (FILLED[name]) path.setAttribute('fill', 'currentColor')
    else {
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', 'currentColor')
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('stroke-linejoin', 'round')
    }
    svg.appendChild(path)
  }
  if (label) { // the seconds inside the skip arrows
    const t = dom.createElementNS(NS, 'text')
    t.setAttribute('x', '12'); t.setAttribute('y', '15.6')
    t.setAttribute('text-anchor', 'middle')
    t.setAttribute('font-size', '8.4'); t.setAttribute('font-weight', '800')
    t.setAttribute('font-family', 'system-ui, sans-serif')
    t.setAttribute('fill', 'currentColor')
    t.textContent = label
    svg.appendChild(t)
  }
  return svg
}

// ---- Waveform: the loudest sample in each of n slices, scaled so the loudest slice is 1.
function peaksOf (buffer, n) {
  const peaks = new Float32Array(n)
  const len = buffer.length
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * len / n); const b = Math.floor((i + 1) * len / n)
      const step = Math.max(1, Math.floor((b - a) / 400)) // sample at most ~400 points a slice
      let m = peaks[i]
      for (let j = a; j < b; j += step) { const v = data[j] < 0 ? -data[j] : data[j]; if (v > m) m = v }
      peaks[i] = m
    }
  }
  let max = 0
  for (const v of peaks) if (v > max) max = v
  if (max > 0) for (let i = 0; i < n; i++) peaks[i] /= max
  return peaks
}

const WAVE_LIMIT = 40 * 1024 * 1024 // bigger files get the plain bar
const TAG_BYTES = 512 * 1024 // what a ranged read asks for when the whole file is too big
const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.75]
const SLEEPS = [0, 15, 30, 60] // minutes; 0 is off
const ACCEPT_AUDIO = 'audio/*, */*;q=0.1'

// Reads a response body, up to cap bytes. Returns { bytes, whole }.
async function readCapped (res, cap) {
  if (!res.body || !res.body.getReader) {
    const buf = new Uint8Array(await res.arrayBuffer())
    return { bytes: buf, whole: buf.length <= cap }
  }
  const reader = res.body.getReader()
  const chunks = []; let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); got += value.length
    if (got > cap) { try { reader.cancel() } catch (e) {} break }
  }
  const out = new Uint8Array(got); let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return { bytes: out, whole: got <= cap }
}

const pane = {
  name: 'media',
  icon: ICON,
  label (subject, context) {
    const store = context && context.session && context.session.store
    const kind = kindOf(subject, store)
    return kind ? 'Media' : null
  },
  shouldGetFocus (subject) {
    return !!kindOf(subject, null)
  },
  render (subject, context) {
    const dom = context.dom
    const store = context.session && context.session.store
    const uri = subject.uri
    const el = (tag, cls, text) => {
      const e = dom.createElement(tag)
      if (cls) e.className = cls
      if (text != null) e.textContent = text
      return e
    }

    const root = el('div', 'mdp media-pane')
    const style = el('style')
    style.textContent = CSS
    root.appendChild(style)

    const name = fileName(uri) || uri
    let kind = kindOf(subject, store) || 'video'
    const ext = extension(uri)

    const card = el('section', 'mdp-card')
    const head = el('div', 'mdp-head')
    const titleBox = el('div', 'mdp-title')
    titleBox.appendChild(el('h2', 'mdp-name', name))
    const meta = el('div', 'mdp-meta')
    // The same facts go in chips under the name, and (for sound) in one muted line in the player.
    const facts = { type: '', size: '', length: '', status: '' }
    let showFacts = null
    const chip = (text, cls, fact) => {
      const c = el('span', 'mdp-chip' + (cls ? ' ' + cls : ''), text)
      meta.appendChild(c)
      if (fact) { facts[fact] = text; if (showFacts) showFacts() }
      return c
    }
    const kindChip = chip(LABELS[kind], 'mdp-kind')
    titleBox.appendChild(meta)

    const actions = el('div', 'mdp-actions')
    const open = el('a', 'mdp-btn mdp-primary', 'Open in new tab')
    open.href = uri
    open.target = '_blank'
    open.rel = 'noopener noreferrer'
    const download = el('a', 'mdp-btn', 'Download')
    download.href = uri
    download.download = name
    download.rel = 'noopener noreferrer'
    actions.append(open, download)
    head.append(titleBox, actions)
    card.appendChild(head)

    const stage = el('div', 'mdp-stage')
    card.appendChild(stage)
    root.appendChild(card)

    const fetchFn = (store && store.fetcher && store.fetcher._fetch) || (typeof fetch === 'function' ? fetch : null)
    let durationChip = null
    function fallback (what) {
      const box = el('p', 'mdp-fallback')
      box.appendChild(el('b', null, what))
      box.append('Try opening it in a new tab, or download it. ')
      const a = el('a', null, 'Open ' + name)
      a.href = uri
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      box.appendChild(a)
      stage.className = 'mdp-stage'
      card.classList.remove('mdp-card-sound')
      head.hidden = false
      stage.replaceChildren(box)
    }

    function draw () {
      kindChip.textContent = LABELS[kind]
      card.classList.toggle('mdp-card-sound', kind === 'audio')
      head.hidden = kind === 'audio' // the sound player carries its own title, links and details
      showFacts = null
      if (kind === 'image') {
        stage.className = 'mdp-stage mdp-checker'
        const img = el('img', 'mdp-img')
        img.alt = name
        img.decoding = 'async'
        img.addEventListener('error', () => fallback('This browser can\'t show this image.'))
        img.addEventListener('load', () => {
          if (img.naturalWidth) chip(img.naturalWidth + ' × ' + img.naturalHeight)
        })
        img.src = uri
        stage.replaceChildren(img)
        return
      }
      const media = el(kind, kind === 'video' ? 'mdp-video' : 'mdp-audio')
      media.controls = true
      media.preload = 'metadata'
      if (kind === 'video') {
        media.playsInline = true
        media.setAttribute('playsinline', '')
        stage.className = 'mdp-stage mdp-dark'
      } else {
        stage.className = 'mdp-stage mdp-sound'
      }
      media.addEventListener('loadedmetadata', () => {
        const t = humanTime(media.duration)
        if (t && !durationChip) durationChip = chip(t, null, 'length')
      })
      media.addEventListener('error', () => fallback('This browser can\'t play this file.'))
      if (kind === 'audio') {
        stage.className = 'mdp-stage mdp-sound mdp-tuned'
        stage.replaceChildren()
        soundPlayer(media)
        media.src = uri
        return
      }
      media.src = uri
      stage.replaceChildren(media)
    }

    // The sound player: cover and tags, a waveform (or a bar) to seek on, and big buttons. The
    // <audio> element stays in the page, hidden, and does the playing.
    function soundPlayer (audio) {
      const win = dom.defaultView || (typeof window !== 'undefined' ? window : null)
      const nav = win && win.navigator
      audio.controls = false
      audio.hidden = true

      const player = el('div', 'mdp-player')
      player.tabIndex = 0
      player.setAttribute('role', 'group')
      player.setAttribute('aria-roledescription', 'audio player')
      player.setAttribute('aria-keyshortcuts', 'Space ArrowLeft ArrowRight ArrowUp ArrowDown M')

      // Cover, title, and "artist · album"; the file name and a cover made from it until the tags are read.
      const meta = { title: name.replace(/\.[a-z0-9]+$/i, '') || name, artist: '', album: '', art: null, artType: '' }
      const cover = el('div', 'mdp-cover')
      let hue = 0
      for (const c of name) hue = (hue * 31 + c.charCodeAt(0)) % 360
      cover.style.background = 'linear-gradient(135deg, hsl(' + hue + ', 78%, 64%), hsl(' + (hue + 45) % 360 + ', 64%, 56%) 55%, hsl(' + (hue + 95) % 360 + ', 58%, 60%))'
      cover.appendChild(icon(dom, 'note'))
      const song = el('h3', 'mdp-song', meta.title)
      const sub = el('p', 'mdp-sub'); sub.hidden = true
      const artist = el('span', 'mdp-artist'); artist.hidden = true
      const dot = el('span', null, ' · '); dot.hidden = true
      const album = el('span', 'mdp-album'); album.hidden = true
      sub.append(artist, dot, album)
      player.setAttribute('aria-label', 'Audio player: ' + meta.title)

      // "Resume from m:ss", when this file was left part way through.
      const resume = el('div', 'mdp-resume')
      resume.hidden = true
      const resumeText = el('span', null, 'Pick up where you left off')
      const ctl = (cls, iconName, label, onClick, text) => {
        const b = el('button', 'mdp-ctl' + (cls ? ' ' + cls : ''))
        b.type = 'button'
        b.setAttribute('aria-label', label)
        b.title = label
        if (iconName) b.appendChild(icon(dom, iconName, text))
        else if (text) b.textContent = text
        b.addEventListener('click', onClick)
        return b
      }
      // A pill: an icon (optional) and a word, its text kept in a span so it can change.
      const pill = (cls, iconName, text, label, onClick) => {
        const b = el(onClick ? 'button' : 'a', 'mdp-pill' + (cls ? ' ' + cls : ''))
        if (onClick) { b.type = 'button'; b.addEventListener('click', onClick) }
        b.setAttribute('aria-label', label)
        b.title = label
        if (iconName) b.appendChild(icon(dom, iconName))
        b.word = el('span', null, text)
        b.appendChild(b.word)
        return b
      }
      const relabel = (b, label, text) => {
        b.setAttribute('aria-label', label); b.title = label
        if (text != null) b.word.textContent = text
      }
      const resumeBtn = ctl('', null, 'Resume', () => { seek(saved); play(); hideResume() }, 'Resume')
      const dismiss = ctl('mdp-dismiss', 'close', 'Start from the beginning instead', () => { memo.clear(); hideResume() })
      resume.append(resumeText, resumeBtn, dismiss)

      // The waveform, with a plain bar until (or unless) it is drawn.
      const scrub = el('div', 'mdp-scrub')
      scrub.tabIndex = 0
      scrub.setAttribute('role', 'slider')
      scrub.setAttribute('aria-label', 'Seek')
      scrub.setAttribute('aria-valuemin', '0')
      scrub.setAttribute('aria-valuemax', '0')
      scrub.setAttribute('aria-valuenow', '0')
      const canvas = el('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      const bar = el('div', 'mdp-track-bar')
      const fill = el('div', 'mdp-fill')
      bar.appendChild(fill)
      const tip = el('div', 'mdp-tip')
      scrub.append(canvas, bar, tip)
      const times = el('div', 'mdp-times')
      const elapsed = el('span', null, '0:00')
      const total = el('span', null, '–:––')
      times.append(elapsed, total)

      // Back 15 s, play or pause, forward 30 s.
      const back = ctl('mdp-skip', 'back', 'Back 15 seconds', () => skip(-15), '15')
      const playBtn = ctl('mdp-play', 'play', 'Play', () => toggle())
      const fwd = ctl('mdp-skip', 'fwd', 'Forward 30 seconds', () => skip(30), '30')
      const transport = el('div', 'mdp-transport'); transport.append(back, playBtn, fwd)

      // Speed, repeat, mute, sleep timer, download and open.
      let speedAt = 0
      const speed = pill('mdp-speed', null, '1×', 'Playback speed 1×, change', () => {
        speedAt = (speedAt + 1) % SPEEDS.length
        audio.playbackRate = audio.defaultPlaybackRate = SPEEDS[speedAt]
        showSpeed()
      })
      const loop = pill('mdp-loop', 'loop', 'Loop', 'Repeat', () => { audio.loop = !audio.loop; loop.setAttribute('aria-pressed', String(audio.loop)) })
      loop.setAttribute('aria-pressed', 'false')
      const muteBtn = pill('mdp-mute', 'vol', 'Mute', 'Mute', () => { audio.muted = !audio.muted })
      muteBtn.setAttribute('aria-pressed', 'false')
      // The sleep timer: off, 15, 30, 60 minutes, then off again. It pauses when it runs out.
      let sleepAt = 0; let sleepEnd = 0; let sleepTick = 0
      const sleep = pill('mdp-sleep', 'moon', 'Sleep', 'Sleep timer off, set 15 minutes', () => {
        sleepAt = (sleepAt + 1) % SLEEPS.length
        sleepEnd = SLEEPS[sleepAt] ? Date.now() + SLEEPS[sleepAt] * 60000 : 0
        showSleep()
      })
      sleep.setAttribute('aria-pressed', 'false')
      function showSleep () {
        if (sleepTick && win) { win.clearTimeout(sleepTick); sleepTick = 0 }
        const left = sleepEnd - Date.now()
        if (sleepEnd && (left <= 0 || !root.isConnected)) {
          if (left <= 0) audio.pause()
          sleepAt = 0; sleepEnd = 0
        }
        sleep.setAttribute('aria-pressed', String(!!sleepEnd))
        if (!sleepEnd) { relabel(sleep, 'Sleep timer off, set 15 minutes', 'Sleep'); return }
        const mins = Math.ceil(left / 60000)
        const next = SLEEPS[(sleepAt + 1) % SLEEPS.length]
        relabel(sleep, 'Sleep timer: pauses in ' + mins + ' min, ' + (next ? 'set ' + next + ' minutes' : 'turn off'), 'Sleep ' + mins + 'm')
        // Wake when the minutes shown change, and right at the end.
        if (win) sleepTick = win.setTimeout(showSleep, Math.min(15000, left % 60000 || 60000) + 20)
      }
      const download = pill('mdp-download', 'download', 'Download', 'Download ' + name)
      download.href = uri
      download.download = name // a cross-origin file ignores this and simply opens
      download.rel = 'noopener noreferrer'
      const openLink = pill('mdp-open', 'open', 'Open', 'Open ' + name + ' in a new tab')
      openLink.href = uri
      openLink.target = '_blank'
      openLink.rel = 'noopener noreferrer'
      const pills = el('div', 'mdp-pills'); pills.append(speed, loop, muteBtn, sleep, download, openLink)

      // Volume, on its own row.
      const range = el('input', 'mdp-range')
      range.type = 'range'; range.min = '0'; range.max = '100'; range.step = '5'; range.value = '100'
      range.setAttribute('aria-label', 'Volume')
      range.addEventListener('input', () => setVolume(range.value / 100))
      const vol = el('div', 'mdp-vol'); vol.append(icon(dom, 'quiet'), range, icon(dom, 'vol'))

      const keys = el('p', 'mdp-keys')
      const key = (ks, what) => {
        const g = el('span')
        for (const k of ks) g.appendChild(el('kbd', null, k))
        g.append(' ' + what)
        keys.appendChild(g)
      }
      key(['Space'], 'play or pause'); key(['←', '→'], '5 s'); key(['↑', '↓'], 'volume'); key(['M'], 'mute')

      // Type, size and length, in one quiet line at the bottom.
      const details = el('p', 'mdp-details')
      details.setAttribute('aria-label', 'File details')
      showFacts = () => {
        const type = ext ? ext.toUpperCase() : facts.type ? facts.type.split('/').pop().replace(/^x-/, '').toUpperCase() : 'Audio'
        details.textContent = [type, facts.size, facts.length, facts.status].filter(Boolean).join(' · ')
      }
      showFacts()

      player.append(cover, song, sub, resume, scrub, times, transport, pills, vol, keys, details)
      stage.append(player, audio)

      // ---- Playing.
      const dur = () => (isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0)
      function play () { const p = audio.play(); if (p && p.catch) p.catch(() => {}) }
      function toggle () { if (audio.paused) play(); else audio.pause() }
      function seek (t) {
        const d = dur()
        if (!d) return
        audio.currentTime = Math.max(0, Math.min(d, t))
        paint()
      }
      function skip (by) { seek(audio.currentTime + by) }
      function setVolume (v) {
        v = Math.max(0, Math.min(1, Math.round(v * 20) / 20))
        audio.volume = v
        audio.muted = v === 0
      }

      // ---- Remembering where you were, per file, in localStorage.
      const KEY = 'mdp-resume:' + uri
      const memo = {
        get () { try { return parseFloat(win.localStorage.getItem(KEY)) } catch (e) { return NaN } },
        set (t) { try { win.localStorage.setItem(KEY, t.toFixed(1)) } catch (e) {} },
        clear () { try { win.localStorage.removeItem(KEY) } catch (e) {} }
      }
      let saved = memo.get()
      let lastSave = 0
      // Worth offering only away from both ends: 5 s in, or a tenth of a short file.
      const worth = (t, d) => t > Math.min(5, d / 10) && t < d - Math.min(5, d / 10)
      function remember () {
        const d = dur(); const t = audio.currentTime
        if (!d) return
        if (worth(t, d)) memo.set(t); else memo.clear()
        lastSave = Date.now()
      }
      function hideResume () { resume.hidden = true }

      // ---- Drawing the waveform and the times.
      let peaks = null
      let hover = -1
      let frame = 0
      function paint () {
        const d = dur()
        const f = d ? Math.min(1, audio.currentTime / d) : 0
        fill.style.width = (f * 100).toFixed(2) + '%'
        elapsed.textContent = clock(audio.currentTime)
        scrub.setAttribute('aria-valuenow', String(Math.round(audio.currentTime)))
        scrub.setAttribute('aria-valuetext', clock(audio.currentTime) + ' of ' + clock(d))
        if (peaks) wave(f)
      }
      function wave (f) {
        const w = scrub.clientWidth; const h = scrub.clientHeight
        if (!w || !h) return
        const dpr = (win && win.devicePixelRatio) || 1
        const cw = Math.round(w * dpr); const ch = Math.round(h * dpr)
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch }
        const g = canvas.getContext('2d')
        if (!g) return
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, w, h)
        const bw = w < 480 ? 2.5 : 3; const gap = 2
        const n = Math.max(1, Math.floor((w + gap) / (bw + gap)))
        const left = (w - (n * (bw + gap) - gap)) / 2
        const bars = typeof Path2D === 'function' ? new Path2D() : null
        if (!bars) return
        for (let i = 0; i < n; i++) {
          const a = Math.floor(i * peaks.length / n); const b = Math.max(a + 1, Math.floor((i + 1) * peaks.length / n))
          let v = 0
          for (let j = a; j < b; j++) if (peaks[j] > v) v = peaks[j]
          const bh = Math.max(3, Math.pow(v, 0.85) * (h - 6))
          const x = left + i * (bw + gap); const y = (h - bh) / 2
          if (bars.roundRect) bars.roundRect(x, y, bw, bh, bw / 2); else bars.rect(x, y, bw, bh)
        }
        g.fillStyle = '#cdd5e6'
        g.fill(bars)
        if (hover >= 0) {
          g.save(); g.beginPath(); g.rect(0, 0, hover * w, h); g.clip()
          g.fillStyle = 'rgba(47, 111, 222, .38)'; g.fill(bars); g.restore()
        }
        if (f > 0) {
          const grad = g.createLinearGradient(0, 0, w, 0)
          grad.addColorStop(0, '#2f6fde'); grad.addColorStop(1, '#6a4fe0')
          g.save(); g.beginPath(); g.rect(0, 0, f * w, h); g.clip()
          g.fillStyle = grad; g.fill(bars); g.restore()
        }
      }
      function tick () {
        paint()
        frame = !audio.paused && root.isConnected && win && win.requestAnimationFrame ? win.requestAnimationFrame(tick) : 0
      }
      if (win && win.ResizeObserver) new win.ResizeObserver(() => paint()).observe(scrub)

      // ---- Seeking with a click, a drag or a tap on the waveform.
      let dragging = false
      const at = (e) => {
        const r = scrub.getBoundingClientRect()
        return r.width ? Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) : 0
      }
      function showTip (f) {
        tip.textContent = clock(f * dur())
        tip.style.left = Math.max(22, Math.min(scrub.clientWidth - 22, f * scrub.clientWidth)) + 'px'
      }
      scrub.addEventListener('pointerdown', (e) => {
        if (e.button) return
        dragging = true
        try { scrub.setPointerCapture(e.pointerId) } catch (err) {}
        seek(at(e) * dur())
      })
      scrub.addEventListener('pointermove', (e) => {
        const f = at(e)
        hover = e.pointerType === 'mouse' ? f : -1
        showTip(f)
        if (dragging) seek(f * dur()); else paint()
      })
      const stopDrag = () => { dragging = false }
      scrub.addEventListener('pointerup', stopDrag)
      scrub.addEventListener('pointercancel', stopDrag)
      scrub.addEventListener('pointerleave', () => { hover = -1; paint() })

      // ---- Keys, while the player (or anything in it) has focus.
      player.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return
        const onRange = e.target === range
        if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggle() } else if (e.key === 'ArrowLeft' && !onRange) { e.preventDefault(); skip(-5) } else if (e.key === 'ArrowRight' && !onRange) { e.preventDefault(); skip(5) } else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume((audio.muted ? 0 : audio.volume) + 0.1) } else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume((audio.muted ? 0 : audio.volume) - 0.1) } else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); audio.muted = !audio.muted } else if (e.key === 'Home' && e.target === scrub) { e.preventDefault(); seek(0) } else if (e.key === 'End' && e.target === scrub) { e.preventDefault(); seek(dur()) }
      })
      // Space must not also click the focused button.
      player.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault() })

      // ---- Lock screen, headset and keyboard media keys.
      const ms = nav && nav.mediaSession
      let coverUrl = null
      function session () {
        if (!ms) return
        try {
          const MM = win.MediaMetadata
          if (MM) {
            ms.metadata = new MM({
              title: meta.title,
              artist: meta.artist,
              album: meta.album,
              artwork: coverUrl ? [{ src: coverUrl, type: meta.artType }] : [{ src: ICON, sizes: '96x96', type: 'image/svg+xml' }]
            })
          }
        } catch (e) {}
        const on = (action, fn) => { try { ms.setActionHandler(action, fn) } catch (e) {} }
        on('play', () => play())
        on('pause', () => audio.pause())
        on('stop', () => { audio.pause(); seek(0) })
        on('seekbackward', (d) => skip(-((d && d.seekOffset) || 15)))
        on('seekforward', (d) => skip((d && d.seekOffset) || 30))
        on('seekto', (d) => { if (d && isFinite(d.seekTime)) seek(d.seekTime) })
      }
      function position () {
        const d = dur()
        if (!ms || !ms.setPositionState || !d) return
        try { ms.setPositionState({ duration: d, playbackRate: audio.playbackRate || 1, position: Math.min(d, audio.currentTime) }) } catch (e) {}
      }

      // ---- The <audio> element's events.
      audio.addEventListener('play', () => {
        playBtn.replaceChildren(icon(dom, 'pause'))
        playBtn.setAttribute('aria-label', 'Pause'); playBtn.title = 'Pause'
        hideResume()
        session()
        if (ms) try { ms.playbackState = 'playing' } catch (e) {}
        if (!frame) tick()
      })
      audio.addEventListener('pause', () => {
        playBtn.replaceChildren(icon(dom, 'play'))
        playBtn.setAttribute('aria-label', 'Play'); playBtn.title = 'Play'
        if (ms) try { ms.playbackState = 'paused' } catch (e) {}
        if (frame && win.cancelAnimationFrame) win.cancelAnimationFrame(frame)
        frame = 0
        remember()
        paint()
      })
      audio.addEventListener('ended', () => { memo.clear() })
      audio.addEventListener('timeupdate', () => {
        if (!frame) paint()
        if (Date.now() - lastSave > 2000 && !audio.paused) remember()
      })
      audio.addEventListener('seeked', () => { position(); if (!dragging) remember() })
      function showSpeed () {
        const r = audio.playbackRate
        relabel(speed, 'Playback speed ' + r + '×, change', r + '×')
      }
      audio.addEventListener('ratechange', () => { showSpeed(); position() })
      audio.addEventListener('volumechange', () => {
        const v = audio.muted ? 0 : audio.volume
        range.value = String(Math.round(v * 100))
        range.style.setProperty('--mdp-v', Math.round(v * 100) + '%')
        muteBtn.replaceChild(icon(dom, audio.muted || !audio.volume ? 'mute' : 'vol'), muteBtn.firstChild)
        muteBtn.setAttribute('aria-pressed', String(audio.muted))
        relabel(muteBtn, audio.muted ? 'Unmute' : 'Mute', audio.muted ? 'Unmute' : 'Mute')
      })
      audio.addEventListener('loadedmetadata', () => {
        const d = dur()
        total.textContent = d ? clock(d) : '–:––'
        scrub.setAttribute('aria-valuemax', String(Math.round(d)))
        saved = memo.get()
        if (d && worth(saved, d) && audio.paused && audio.currentTime < 0.5) {
          resumeText.textContent = 'You were part way through.'
          resumeBtn.textContent = 'Resume from ' + clock(saved)
          resumeBtn.setAttribute('aria-label', 'Resume from ' + clock(saved)); resumeBtn.title = 'Resume from ' + clock(saved)
          resume.hidden = false
        }
        position()
        paint()
      })
      if (win) win.addEventListener('pagehide', () => { if (!audio.paused) remember() })

      // ---- Tags and the waveform, from the file's bytes (a short Accept, so no CORS preflight).
      function useTags (t) {
        if (!t) return
        if (t.title) meta.title = t.title
        if (t.artist) meta.artist = t.artist
        if (t.album) meta.album = t.album
        song.textContent = meta.title
        artist.textContent = meta.artist; artist.hidden = !meta.artist
        album.textContent = meta.album; album.hidden = !meta.album
        dot.hidden = !(meta.artist && meta.album)
        sub.hidden = !(meta.artist || meta.album)
        player.setAttribute('aria-label', 'Audio player: ' + meta.title + (meta.artist ? ', ' + meta.artist : ''))
        if (t.picture && win && win.URL && win.Blob) {
          try {
            coverUrl = win.URL.createObjectURL(new win.Blob([t.picture.data], { type: t.picture.mime }))
            meta.artType = t.picture.mime
            const img = el('img')
            img.alt = 'Cover of ' + meta.title
            img.addEventListener('error', () => { img.remove(); cover.classList.remove('mdp-has-art') })
            img.src = coverUrl
            cover.appendChild(img)
            cover.classList.add('mdp-has-art')
          } catch (e) {}
        }
        if (!audio.paused) session()
      }
      async function decode (bytes) {
        const AC = win && (win.OfflineAudioContext || win.webkitOfflineAudioContext)
        if (!AC) return
        // A low sample rate keeps a long file's decoded copy small; it is only for drawing.
        const ctx = new AC(1, 1, 8000)
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        const buffer = await new Promise((resolve, reject) => {
          const p = ctx.decodeAudioData(ab, resolve, reject)
          if (p && p.then) p.then(resolve, reject)
        })
        peaks = peaksOf(buffer, 1600)
        scrub.classList.add('mdp-has-wave')
        paint()
      }
      // A plain read first (public files, no console noise); the store's own fetch, which may
      // carry a login, when that fails.
      async function get (headers) {
        let res = null
        if (typeof fetch === 'function') { try { res = await fetch(uri, { headers }) } catch (e) {} }
        if ((!res || !res.ok) && fetchFn && fetchFn !== fetch) { try { res = await fetchFn(uri, { headers }) } catch (e) {} }
        return res
      }
      async function readBytes () {
        let res = await get({ accept: ACCEPT_AUDIO })
        if (!res || !res.ok) return
        const len = parseInt(res.headers.get('content-length'), 10)
        if (len > WAVE_LIMIT) {
          // Too big to draw: read just the start, for the tags.
          try { if (res.body && res.body.cancel) res.body.cancel() } catch (e) {}
          res = await get({ accept: ACCEPT_AUDIO, range: 'bytes=0-' + (TAG_BYTES - 1) })
          if (res && res.ok) useTags(readTags((await readCapped(res, TAG_BYTES)).bytes))
          return
        }
        const { bytes, whole } = await readCapped(res, WAVE_LIMIT)
        useTags(readTags(bytes))
        if (whole) await decode(bytes)
      }
      Promise.resolve().then(readBytes).catch(() => {}) // blocked by CORS, or not decodable: the bar stays

      paint()
    }

    draw()

    // Size and type, from a HEAD request with a short Accept (a long one needs a CORS preflight,
    // which static hosts refuse). A content type that names another kind redraws the player.
    if (fetchFn) {
      Promise.resolve()
        .then(() => fetchFn(uri, { method: 'HEAD', headers: { accept: ACCEPT } }))
        .then(res => {
          if (!res || !res.ok) {
            if (res && [401, 403, 404, 410].includes(res.status)) chip('HTTP ' + res.status, null, 'status')
            return
          }
          const type = (res.headers.get('content-type') || '').split(';')[0].trim()
          const size = humanSize(parseInt(res.headers.get('content-length'), 10))
          if (size) chip(size, null, 'size')
          if (type) chip(type, null, 'type')
          else if (ext) chip(ext.toUpperCase())
          const k = kindOfType(type)
          if (k && k !== kind && !kindOfExtension(ext)) { kind = k; durationChip = null; draw() }
        })
        .catch(() => { if (ext) chip(ext.toUpperCase()) })
    }

    return root
  }
}

export default pane
