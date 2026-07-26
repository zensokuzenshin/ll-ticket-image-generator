<script>
  import { onMount } from 'svelte'
  import { app, select, selRef, selRefs } from './lib/state.svelte.js'
  import { I18N, detectLang } from './lib/i18n.js'
  import { loadIndex } from './lib/presets.js'
  import { blankPreset } from './lib/template.js'
  import { loadTemplate, loadPresetKey, ensureFonts, exportImage, saveTemplate, applyAttrLayout,
           doCopy, doPaste, deleteSel, duplicateSel } from './lib/actions.js'
  import { undo, redo, restoreSession, persistNow, flushSnapshot } from './lib/history.svelte.js'
  import Sidebar from './components/Sidebar.svelte'
  import Stage from './components/Stage.svelte'
  import HistoryPanel from './components/HistoryPanel.svelte'

  const params = new URLSearchParams(location.search)
  app.embed = params.has('embed')
  app.lang = detectLang()
  const qlang = params.get('lang'); if (qlang && I18N[qlang]) app.lang = qlang
  {
    let saved = null; try { saved = localStorage.getItem('tig_hist') } catch (e) {}
    // no stored choice → visible on wide screens, hidden on narrow ones
    app.histOn = saved !== null ? saved === '1' : matchMedia('(min-width:1280px)').matches
  }

  $effect(() => { document.documentElement.lang = app.lang === 'ja' ? 'ja' : app.lang })
  $effect(() => { document.body.classList.toggle('embed', app.embed) })

  // font (re)load, debounced while ticket text is being typed
  let fontTimer
  $effect(() => {
    if (!app.A) return
    app.A.fields.map(f => f.text).join('')
    clearTimeout(fontTimer); fontTimer = setTimeout(ensureFonts, 400)
  })

  // A load that finishes quickly (anything already cached) must not flash a
  // spinner, so the visible state trails app.busy by a beat.
  let busyTimer
  $effect(() => {
    clearTimeout(busyTimer)
    if (app.busy) busyTimer = setTimeout(() => app.showBusy = true, 150)
    else app.showBusy = false
  })

  onMount(async () => {
    try {
      // only the catalogue: the shows themselves are fetched as they are picked
      const idx = await loadIndex()
      if (idx) {
        app.presetKeys = idx.keys
        app.presetNames = idx.names
        app.presetGroups = idx.groups
        app.presetPaths = idx.paths
      } else app.presetErr = true             // fetch failed (e.g. file://) → blank template + "load a file"

      // an explicit ?preset= (or embed/scripted use) beats the saved session
      const qpreset = params.get('preset')
      const restored = !qpreset && !app.embed && await restoreSession()
      if (!restored) {
        const firstKey = (qpreset && app.presetKeys.includes(qpreset)) ? qpreset : app.presetKeys[0]
        if (firstKey) { app.presetKey = firstKey; await loadPresetKey(firstKey) }
        if (!app.A) { app.presetKey = '__custom'; await loadTemplate(blankPreset()) }
      }
      ensureFonts()
      if (params.has('boxes')) app.showBoxes = true
      const qd = params.get('distribute')               // ?distribute=top,labelGap,pairGap
      if (qd && app.A.attr) {
        const p = qd.split(',').map(Number)
        if (p[0]) app.A.attr.top = p[0]; if (p[1]) app.A.attr.labelGap = p[1]; if (p[2]) app.A.attr.pairGap = p[2]
        applyAttrLayout()
      }
      if (app.embed) { app.zoom = 1; window.__ready = true }
    } finally { app.busy-- }                  // app.busy starts at 1: the boot load is one of them
  })

  /* ---------- keyboard ---------- */
  const editable = el => !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)
  function editingCtx() { return editable(document.activeElement) }
  // leaving a control ends that edit: whatever is typed next is a new history entry
  function onFocusOut(ev) { if (editable(ev.target)) flushSnapshot() }
  function onKeydown(ev) {
    // arrow-key nudge for the selected item(s) (never while typing)
    const rs = selRefs()
    if (rs.length && !editingCtx()) {
      const s = ev.shiftKey ? 10 : 1; let dx = 0, dy = 0
      if (ev.key === 'ArrowLeft') dx = -s; else if (ev.key === 'ArrowRight') dx = s
      else if (ev.key === 'ArrowUp') dy = -s; else if (ev.key === 'ArrowDown') dy = s
      if (dx || dy) { for (const { o } of rs) { o.x += dx; o.y += dy } ev.preventDefault(); return }
    }
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase()
    if (mod && k === 'z') { if (editingCtx()) return                    // native text undo in inputs
      ev.preventDefault(); ev.shiftKey ? redo() : undo() }
    else if (mod && k === 'y') { if (editingCtx()) return
      ev.preventDefault(); redo() }
    else if (mod && k === 'd') { if (editingCtx() || !selRef()) return
      ev.preventDefault(); duplicateSel() }
    else if (mod && k === 's') {                                        // always eat Ctrl+S (browser save dialog)
      ev.preventDefault(); ev.shiftKey ? saveTemplate() : exportImage('png') }
    else if (mod && ev.key === ';') {                                   // toggle guide lines (Photoshop habit)
      ev.preventDefault(); app.showGuideLines = !app.showGuideLines }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { if (editingCtx() || !selRef()) return
      ev.preventDefault(); deleteSel() }
    else if (ev.key === 'Escape') {
      if (app.showHelp) { app.showHelp = false; return }
      if (editingCtx()) { document.activeElement.blur(); return }
      if (selRef()) select(null, null) }
  }

  /* ---------- clipboard (system-level, works across tabs) ---------- */
  function onCopy(e) { if (editingCtx() || String(document.getSelection())) return; if (doCopy(e)) e.preventDefault() }
  function onCut(e) { if (editingCtx() || String(document.getSelection())) return; if (doCopy(e)) { deleteSel(); e.preventDefault() } }
  function onPaste(e) { if (editingCtx()) return; const txt = e.clipboardData ? e.clipboardData.getData('text/plain') : ''; if (doPaste(txt)) e.preventDefault() }
</script>

<svelte:window onkeydown={onKeydown} onpagehide={persistNow} />
<svelte:document oncopy={onCopy} oncut={onCut} onpaste={onPaste} onfocusout={onFocusOut} />

<div class="shell" class:embed={app.embed} class:histoff={!app.histOn}>
  <Sidebar />
  <Stage />
  <HistoryPanel />
</div>
