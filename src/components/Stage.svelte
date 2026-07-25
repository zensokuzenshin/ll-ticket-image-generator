<script>
  import { onMount, untrack, flushSync } from 'svelte'
  import { CW, CH } from '../lib/constants.js'
  import { app, select, toggleSelect, primarySelect, selectMany, selRef, selRefs, nid } from '../lib/state.svelte.js'
  import { t, dispName } from '../lib/i18n.js'
  import { renderCanvas, hitTest, getBbox } from '../lib/render.js'
  import { serializeState } from '../lib/template.js'
  import { hist, scheduleSnapshot, snapshotNow, undo, redo } from '../lib/history.svelte.js'

  let cv, wrapEl, ctx
  let hrEl, vrEl                        // ruler canvases (top / left), absent in embed
  let drag = null                       // {ref, ox, oy} — not drawn, so not reactive
  let guideDrag = $state(null)
  let snapHit = $state(null)
  let marquee = $state(null)            // rubber-band rect {x0,y0,x1,y1,add} while dragging on empty canvas
  let marqueeSel = $state([])           // live {type,o} pairs fully inside the rect
  let cursor = $state('crosshair')

  // canvas size comes from the template (per-printer); CW/CH only pre-boot
  const cw = $derived(app.A ? app.A.cw : CW)
  const ch = $derived(app.A ? app.A.ch : CH)

  onMount(() => {
    ctx = cv.getContext('2d')
    app.canvasEl = cv
    if (app.embed) return
    fit()
    // ctrl+wheel is what browsers zoom the page on (trackpad pinch fires it too);
    // eat it anywhere in the app and zoom the canvas instead — anchored at the
    // cursor over the stage, at the stage center elsewhere (e.g. over the sidebar).
    // Svelte attaches onwheel passive → by hand.
    const anchored = (z, cx, cy) => {
      const r = wrapEl.getBoundingClientRect()
      const inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
      inside ? zoomTo(z, cx, cy) : zoomTo(z, r.left + r.width / 2, r.top + r.height / 2)
    }
    const onWheel = ev => {
      if (!ev.ctrlKey) return                              // plain wheel keeps scrolling
      ev.preventDefault()
      const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY
      anchored(app.zoom * Math.exp(-dy * 0.0015), ev.clientX, ev.clientY)
    }
    // Safari reports trackpad pinch as gesture events, not ctrl+wheel
    let gz = 1
    const onGestureStart = ev => { ev.preventDefault(); gz = app.zoom }
    const onGestureChange = ev => { ev.preventDefault(); anchored(gz * ev.scale, ev.clientX, ev.clientY) }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('gesturestart', onGestureStart)
    window.addEventListener('gesturechange', onGestureChange)
    const ro = new ResizeObserver(scheduleRulers)   // stage resize moves the paper under the rulers
    ro.observe(wrapEl)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('gesturestart', onGestureStart)
      window.removeEventListener('gesturechange', onGestureChange)
      ro.disconnect()
    }
  })

  // re-fit the view whenever the canvas size changes (template load or resize)
  $effect(() => { cw; ch; if (!app.embed && wrapEl) untrack(fit) })

  // rulers follow zoom and canvas size; scroll/resize redraws hook in via listeners
  $effect(() => { app.zoom; cw; ch; if (!app.embed) scheduleRulers() })

  // Central render: every reactive read below re-runs this effect, replacing
  // all the manual render() calls of the pre-Svelte app. serializeState() is
  // called for its reads: it touches template props the drawing itself doesn't
  // (margins, names…), so those edits also land in the undo history.
  $effect(() => {
    if (!app.A || !ctx) return
    serializeState(app.A)
    app.fontTick; app.renderTick
    renderCanvas(ctx, app.A, {
      zoom: app.zoom, selIds: app.sel.ids, showBoxes: app.showBoxes,
      showGuideLines: app.showGuideLines, guideDrag, snapHit, embed: app.embed,
      marquee, marqueeIds: marqueeSel.map(s => s.o.id),
    })
    untrack(() => scheduleSnapshot())   // history: every mutation ends in a render; dedup by serialization
  })

  function fit() { app.zoom = Math.min((wrapEl.clientWidth - 48) / cw, (wrapEl.clientHeight - 48) / ch) }

  // zoom keeping the canvas point under client (cx, cy) fixed on screen
  function zoomTo(z, cx, cy) {
    const z0 = app.zoom
    z = Math.min(2, Math.max(.05, z))
    if (z === z0) return
    const r = cv.getBoundingClientRect()
    const px = (cx - r.left) / z0, py = (cy - r.top) / z0
    flushSync(() => { app.zoom = z })                      // paper resizes now, then re-anchor
    const r2 = cv.getBoundingClientRect()
    wrapEl.scrollLeft += r2.left + px * z - cx
    wrapEl.scrollTop += r2.top + py * z - cy
  }
  function zoomStep(f) { const r = wrapEl.getBoundingClientRect(); zoomTo(app.zoom * f, r.left + r.width / 2, r.top + r.height / 2) }
  function onZoomKey(ev) {
    if (app.embed || !(ev.ctrlKey || ev.metaKey)) return   // browser zoom keys, even while typing
    if (ev.key === '=' || ev.key === '+') { ev.preventDefault(); zoomStep(1.15) }
    else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); zoomStep(1 / 1.15) }
    else if (ev.key === '0') { ev.preventDefault(); fit() }
  }

  const selInfo = $derived.by(() => {
    if (app.sel.ids.length > 1) return `${t('selPrefix')}: ${t('selMulti').replace('{n}', app.sel.ids.length)}`
    const r = selRef()
    return r ? `${t('selPrefix')}: ${dispName(r)}（X${Math.round(r.x)} Y${Math.round(r.y)}）` : ''
  })

  /* ---------- rulers: canvas-pixel scale pinned to the stage edges ---------- */
  let rulerRaf = false
  function scheduleRulers() { if (rulerRaf) return; rulerRaf = true; requestAnimationFrame(() => { rulerRaf = false; drawRulers() }) }
  function drawRulers() {
    if (!hrEl || !vrEl || !cv) return
    const cr = cv.getBoundingClientRect()
    drawRuler(hrEl, cr, true)
    drawRuler(vrEl, cr, false)
  }
  // labeled ticks every `major` canvas px (≥56 screen px so 4-digit labels fit), minors between
  function tickSteps(z) {
    let major = 10000
    for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) if (s * z >= 56) { major = s; break }
    const minor = [major / 10, major / 5, major / 2].find(m => m * z >= 5) || major
    return { major, minor }
  }
  function drawRuler(el, cr, horiz) {
    const dpr = window.devicePixelRatio || 1
    const w = el.clientWidth, h = el.clientHeight               // content box (borders live outside the bitmap)
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) { el.width = Math.round(w * dpr); el.height = Math.round(h * dpr) }
    const c = el.getContext('2d')
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const vars = getComputedStyle(el)
    const cssVar = (n, fb) => (vars.getPropertyValue(n) || '').trim() || fb
    const z = app.zoom, er = el.getBoundingClientRect()
    const len = horiz ? w : h, thick = horiz ? h : w
    const origin = horiz ? cr.left - er.left : cr.top - er.top  // screen px where canvas 0 sits
    const band = (from, size, color) => { c.fillStyle = color; horiz ? c.fillRect(from, 0, size, h) : c.fillRect(0, from, w, size) }
    band(0, len, cssVar('--panel', '#1e2128'))
    band(origin, (horiz ? cw : ch) * z, cssVar('--panel2', '#262a33'))  // lighter over the document extent
    const { major, minor } = tickSteps(z)
    c.strokeStyle = cssVar('--line', '#333845')
    c.fillStyle = cssVar('--muted', '#9aa3b2')
    c.font = '9px system-ui,sans-serif'
    c.lineWidth = 1
    c.beginPath()
    const v0 = Math.floor((0 - origin) / z / minor) * minor
    const v1 = Math.ceil((len - origin) / z / minor) * minor
    for (let v = v0; v <= v1; v += minor) {
      const p = Math.round(origin + v * z) + .5
      const maj = v % major === 0
      const start = maj ? 10 : thick - 5
      if (horiz) { c.moveTo(p, start); c.lineTo(p, thick) }
      else { c.moveTo(start, p); c.lineTo(thick, p) }
      if (maj) {
        if (horiz) c.fillText(String(v), p + 2.5, 8)
        else { c.save(); c.translate(8, p - 2.5); c.rotate(-Math.PI / 2); c.fillText(String(v), 0, 0); c.restore() }
      }
    }
    c.stroke()
  }
  // pull a new guide out of a ruler, photoshop-style: top ruler → horizontal, left → vertical
  function rulerDown(ev, axis) {
    if (!app.A || ev.button !== 0) return
    app.showGuideLines = true
    const pt = canvasPt(ev)
    app.A.guides.push({ id: nid(), axis, pos: Math.round(axis === 'x' ? pt.x : pt.y) })
    guideDrag = app.A.guides[app.A.guides.length - 1]           // the $state proxy, not the raw object
    app.secCollapsed.guides = false
    try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch (e) {}
  }
  function rulerMove(ev) {
    if (!guideDrag) return
    const pt = canvasPt(ev)
    guideDrag.pos = Math.round(guideDrag.axis === 'x' ? pt.x : pt.y)
  }

  /* ---------- pointer: guides drag, object drag with guide snapping ---------- */
  function canvasPt(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / app.zoom, y: (ev.clientY - r.top) / app.zoom } }
  function guideHit(pt) {
    const th = Math.max(5, 6 / app.zoom)
    for (let i = app.A.guides.length - 1; i >= 0; i--) {
      const g = app.A.guides[i]
      if (g.axis === 'x' ? Math.abs(pt.x - g.pos) <= th : Math.abs(pt.y - g.pos) <= th) return g
    }
    return null
  }
  function onPointerDown(ev) {
    if (!app.A || ev.button !== 0) return   // macOS ctrl+click arrives as the context-menu button
    const pt = canvasPt(ev)
    if (app.showGuideLines) { const g = guideHit(pt); if (g) { guideDrag = g; try { cv.setPointerCapture(ev.pointerId) } catch (e) {} return } }
    const h = hitTest(app.A, pt)
    const multi = ev.ctrlKey || ev.metaKey
    if (h) {
      if (multi) { toggleSelect(h[0], h[1]); if (!app.sel.ids.includes(h[1].id)) return }  // toggled off → nothing to drag
      else primarySelect(h[0], h[1])
      // drag the whole selection; group members keep their offset to the grabbed item
      const others = selRefs().filter(s => s.o !== h[1]).map(s => ({ ref: s.o, dx: s.o.x - h[1].x, dy: s.o.y - h[1].y }))
      // plain click on a multi-selection member: collapse to it on release unless dragged
      drag = { type: h[0], ref: h[1], ox: pt.x - h[1].x, oy: pt.y - h[1].y, sx: h[1].x, sy: h[1].y, others, moved: false, collapse: !multi && others.length > 0 }
      try { cv.setPointerCapture(ev.pointerId) } catch (e) {}
    }
    else {
      // empty canvas: rubber-band select, PowerPoint style (items fully inside the
      // rect; ctrl adds to the selection). A zero-size rect on release acts as the
      // old empty-click: clear, or keep when ctrl was held.
      marquee = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, add: multi }
      marqueeSel = []
      try { cv.setPointerCapture(ev.pointerId) } catch (e) {}
    }
  }
  function onPointerMove(ev) {
    if (!app.A) return
    const pt = canvasPt(ev)
    if (guideDrag) {
      guideDrag.pos = Math.round(guideDrag.axis === 'x' ? pt.x : pt.y)
      return
    }
    if (marquee) {
      marquee.x1 = pt.x; marquee.y1 = pt.y
      const x0 = Math.min(marquee.x0, pt.x), x1 = Math.max(marquee.x0, pt.x)
      const y0 = Math.min(marquee.y0, pt.y), y1 = Math.max(marquee.y0, pt.y)
      const inside = o => { const b = getBbox(o); return b && b.x >= x0 && b.y >= y0 && b.x + b.w <= x1 && b.y + b.h <= y1 }
      marqueeSel = [
        ...app.A.fields.filter(inside).map(o => ({ type: 'field', o })),
        ...app.A.images.filter(inside).map(o => ({ type: 'image', o })),
      ]
      return
    }
    if (!drag) {
      if (app.showGuideLines) { const g = guideHit(pt); cursor = g ? (g.axis === 'x' ? 'ew-resize' : 'ns-resize') : 'crosshair' }
      return
    }
    let nx = Math.round(pt.x - drag.ox), ny = Math.round(pt.y - drag.oy)
    // shift constrains the move to the dominant axis, photoshop-style; recomputed
    // every event, so swinging the pointer flips which axis is locked mid-drag
    let lock = null
    if (ev.shiftKey) {
      lock = Math.abs(nx - drag.sx) >= Math.abs(ny - drag.sy) ? 'y' : 'x'
      if (lock === 'y') ny = drag.sy; else nx = drag.sx
    }
    snapHit = null
    if (!ev.altKey && app.showGuideLines && app.A.guides.length) {
      const b = getBbox(drag.ref) || { w: 0, h: 0 }, th = Math.max(6, 8 / app.zoom), hit = { x: null, y: null }
      let bdx = null, bdy = null
      for (const g of app.A.guides) {
        if (g.axis === lock) continue                            // the locked coordinate must not snap away
        if (g.axis === 'x') { for (const c of [nx, nx + (b.w || 0) / 2, nx + (b.w || 0)]) { const d = g.pos - c
          if (Math.abs(d) <= th && (bdx === null || Math.abs(d) < Math.abs(bdx))) { bdx = d; hit.x = g } } }
        else               { for (const c of [ny, ny + (b.h || 0) / 2, ny + (b.h || 0)]) { const d = g.pos - c
          if (Math.abs(d) <= th && (bdy === null || Math.abs(d) < Math.abs(bdy))) { bdy = d; hit.y = g } } }
      }
      if (bdx !== null) { nx = Math.round(nx + bdx) }
      if (bdy !== null) { ny = Math.round(ny + bdy) }
      if (hit.x || hit.y) snapHit = hit
    }
    if (nx !== drag.ref.x || ny !== drag.ref.y) drag.moved = true
    drag.ref.x = nx; drag.ref.y = ny
    for (const o of drag.others) { o.ref.x = Math.round(nx + o.dx); o.ref.y = Math.round(ny + o.dy) }
  }
  function endGuideDrag() {
    const g = guideDrag; guideDrag = null
    const out = g.axis === 'x' ? (g.pos < 0 || g.pos > cw) : (g.pos < 0 || g.pos > ch)
    if (out) app.A.guides = app.A.guides.filter(x => x !== g)
    snapshotNow()
  }
  function onPointerUp() {
    if (guideDrag) endGuideDrag()
    if (marquee) {
      if (marquee.add) {
        const have = new Set(app.sel.ids)
        selectMany([...selRefs(), ...marqueeSel.filter(s => !have.has(s.o.id))])
      } else selectMany(marqueeSel)
      marquee = null; marqueeSel = []
    }
    if (drag) {
      if (drag.collapse && !drag.moved) select(drag.type, drag.ref)
      drag = null; snapHit = null
    }
  }

  function persistHist() { try { localStorage.setItem('tig_hist', app.histOn ? '1' : '0') } catch (e) {} }
</script>

<svelte:window onkeydown={onZoomKey} />

<main class="stage">
  <div class="stagebar">
    <div class="grp"><span>{t('stView')}</span>
      <button class="sm" onclick={() => zoomStep(1 / 1.15)}>−</button>
      <span style="min-width:42px;text-align:center">{Math.round(app.zoom * 100)}%</span>
      <button class="sm" onclick={() => zoomStep(1.15)}>＋</button>
      <button class="sm" onclick={fit}>{t('stFit')}</button>
    </div>
    <div class="grp">
      <button class="sm" title={t('ttUndo')} disabled={!hist.undo.length} onclick={undo}>↶</button>
      <button class="sm" title={t('ttRedo')} disabled={!hist.redo.length} onclick={redo}>↷</button>
    </div>
    {#if app.refSrc}
      <label class="switch"><span>{t('stRef')}</span><input type="checkbox" bind:checked={app.refOn}></label>
    {/if}
    <label class="switch"><span>{t('stGuide')}</span><input type="checkbox" bind:checked={app.showBoxes}></label>
    <label class="switch"><span>{t('stGuideLines')}</span><input type="checkbox" bind:checked={app.showGuideLines}></label>
    <label class="switch"><span>{t('stHistory')}</span><input type="checkbox" bind:checked={app.histOn} onchange={persistHist}></label>
    <span class="selinfo">{selInfo}</span>
    <span style="flex:1"></span>
    {#if app.fontState !== 'ok'}
      <span class="pill" style="color:{app.fontState === 'system' ? 'var(--danger)' : 'var(--muted)'}"
        title={app.fontState === 'system' ? t('fontSystemTt') : null}>
        {app.fontState === 'system' ? t('fontSystem') : t('fontLoading')}
      </span>
    {/if}
  </div>
  <div class="stagearea">
    {#if !app.embed}
      <div class="rulcorner"></div>
      <canvas class="ruler rul-h" title={t('rulerTip')} bind:this={hrEl}
        onpointerdown={e => rulerDown(e, 'y')} onpointermove={rulerMove} onpointerup={onPointerUp}></canvas>
      <canvas class="ruler rul-v" title={t('rulerTip')} bind:this={vrEl}
        onpointerdown={e => rulerDown(e, 'x')} onpointermove={rulerMove} onpointerup={onPointerUp}></canvas>
    {/if}
    <div class="canvaswrap" bind:this={wrapEl} onscroll={scheduleRulers}>
      <div class="paper" style="width:{cw * app.zoom}px;height:{ch * app.zoom}px">
        {#if app.refSrc}
          <img class="ref" src={app.refSrc} alt=""
            style="display:{app.refOn ? 'block' : 'none'};opacity:{app.refOpacity / 100}">
        {/if}
        <canvas bind:this={cv} width={cw} height={ch}
          style="width:{cw * app.zoom}px;height:{ch * app.zoom}px;cursor:{cursor}"
          onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp}></canvas>
      </div>
    </div>
  </div>
</main>
