// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Melvin Carvalho
//
// media-pane.js — plays a video or a sound file, or shows a picture, in the SolidOS data browser.
// Applies to a file (not a folder) whose name ends in a known media extension, or whose content
// type the store already knows to be video/*, audio/* or image/*. Draws a card with the file name,
// its size and type (from a HEAD request with a short Accept), the browser's own player or the
// picture, and Open and Download links. If the browser cannot play the file it says so and offers
// the Open link. It imports nothing, builds the DOM with createElement/textContent (never
// innerHTML), and writes nothing.
//
// https://solid-panes.github.io/media/ · licence: MIT (see LICENSE).

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
    const chip = (text, cls) => { const c = el('span', 'mdp-chip' + (cls ? ' ' + cls : ''), text); meta.appendChild(c); return c }
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
      stage.replaceChildren(box)
    }

    function draw () {
      kindChip.textContent = LABELS[kind]
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
        if (t && !durationChip) durationChip = chip(t)
      })
      media.addEventListener('error', () => fallback('This browser can\'t play this file.'))
      media.src = uri
      stage.replaceChildren(media)
    }
    draw()

    // Size and type, from a HEAD request with a short Accept (a long one needs a CORS preflight,
    // which static hosts refuse). A content type that names another kind redraws the player.
    const fetchFn = (store && store.fetcher && store.fetcher._fetch) || (typeof fetch === 'function' ? fetch : null)
    if (fetchFn) {
      Promise.resolve()
        .then(() => fetchFn(uri, { method: 'HEAD', headers: { accept: ACCEPT } }))
        .then(res => {
          if (!res || !res.ok) {
            if (res && [401, 403, 404, 410].includes(res.status)) chip('HTTP ' + res.status)
            return
          }
          const type = (res.headers.get('content-type') || '').split(';')[0].trim()
          const size = humanSize(parseInt(res.headers.get('content-length'), 10))
          if (size) chip(size)
          if (type) chip(type)
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
