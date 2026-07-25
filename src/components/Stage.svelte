<script>
  import { onMount, untrack } from 'svelte'
  import { CW, CH } from '../lib/constants.js'
  import { app, select, selRef } from '../lib/state.svelte.js'
  import { t, dispName } from '../lib/i18n.js'
  import { renderCanvas, hitTest, getBbox } from '../lib/render.js'
  import { serializeState } from '../lib/template.js'
  import { hist, scheduleSnapshot, snapshotNow, undo, redo } from '../lib/history.svelte.js'

  let cv, wrapEl, ctx
  let drag = null                       // {ref, ox, oy} — not drawn, so not reactive
  let guideDrag = $state(null)
  let snapHit = $state(null)
  let cursor = $state('crosshair')

  onMount(() => {
    ctx = cv.getContext('2d')
    app.canvasEl = cv
    if (!app.embed) fit()
  })

  // Central render: every reactive read below re-runs this effect, replacing
  // all the manual render() calls of the pre-Svelte app. serializeState() is
  // called for its reads: it touches template props the drawing itself doesn't
  // (margins, roles, names…), so those edits also land in the undo history.
  $effect(() => {
    if (!app.A || !ctx) return
    serializeState(app.A)
    app.fontTick; app.renderTick
    renderCanvas(ctx, app.A, {
      zoom: app.zoom, selId: app.sel.id, showBoxes: app.showBoxes,
      showGuideLines: app.showGuideLines, guideDrag, snapHit, embed: app.embed,
    })
    untrack(() => scheduleSnapshot())   // history: every mutation ends in a render; dedup by serialization
  })

  function fit() { app.zoom = Math.min((wrapEl.clientWidth - 48) / CW, (wrapEl.clientHeight - 48) / CH) }

  const selInfo = $derived.by(() => {
    const r = selRef()
    return r ? `${t('selPrefix')}: ${dispName(r)}（X${Math.round(r.x)} Y${Math.round(r.y)}）` : ''
  })

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
    if (!app.A) return
    const pt = canvasPt(ev)
    if (app.showGuideLines) { const g = guideHit(pt); if (g) { guideDrag = g; try { cv.setPointerCapture(ev.pointerId) } catch (e) {} return } }
    const h = hitTest(app.A, pt)
    if (h) { select(h[0], h[1]); drag = { ref: h[1], ox: pt.x - h[1].x, oy: pt.y - h[1].y }; try { cv.setPointerCapture(ev.pointerId) } catch (e) {} }
    else select(null, null)
  }
  function onPointerMove(ev) {
    if (!app.A) return
    const pt = canvasPt(ev)
    if (guideDrag) {
      guideDrag.pos = Math.round(guideDrag.axis === 'x' ? pt.x : pt.y)
      return
    }
    if (!drag) {
      if (app.showGuideLines) { const g = guideHit(pt); cursor = g ? (g.axis === 'x' ? 'ew-resize' : 'ns-resize') : 'crosshair' }
      return
    }
    let nx = Math.round(pt.x - drag.ox), ny = Math.round(pt.y - drag.oy)
    snapHit = null
    if (!ev.altKey && app.showGuideLines && app.A.guides.length) {
      const b = getBbox(drag.ref) || { w: 0, h: 0 }, th = Math.max(6, 8 / app.zoom), hit = { x: null, y: null }
      let bdx = null, bdy = null
      for (const g of app.A.guides) {
        if (g.axis === 'x') { for (const c of [nx, nx + (b.w || 0) / 2, nx + (b.w || 0)]) { const d = g.pos - c
          if (Math.abs(d) <= th && (bdx === null || Math.abs(d) < Math.abs(bdx))) { bdx = d; hit.x = g } } }
        else               { for (const c of [ny, ny + (b.h || 0) / 2, ny + (b.h || 0)]) { const d = g.pos - c
          if (Math.abs(d) <= th && (bdy === null || Math.abs(d) < Math.abs(bdy))) { bdy = d; hit.y = g } } }
      }
      if (bdx !== null) { nx = Math.round(nx + bdx) }
      if (bdy !== null) { ny = Math.round(ny + bdy) }
      if (hit.x || hit.y) snapHit = hit
    }
    drag.ref.x = nx; drag.ref.y = ny
  }
  function onPointerUp() {
    if (guideDrag) {
      const g = guideDrag; guideDrag = null
      const out = g.axis === 'x' ? (g.pos < 0 || g.pos > CW) : (g.pos < 0 || g.pos > CH)
      if (out) app.A.guides = app.A.guides.filter(x => x !== g)
      snapshotNow()
    }
    if (drag) { drag = null; snapHit = null }
  }

  function persistHist() { try { localStorage.setItem('tig_hist', app.histOn ? '1' : '0') } catch (e) {} }
</script>

<main class="stage">
  <div class="stagebar">
    <span class="pill">2000 × 3200</span>
    <div class="grp"><span>{t('stView')}</span>
      <button class="sm" onclick={() => app.zoom = Math.max(.05, app.zoom / 1.15)}>−</button>
      <span style="min-width:42px;text-align:center">{Math.round(app.zoom * 100)}%</span>
      <button class="sm" onclick={() => app.zoom = Math.min(2, app.zoom * 1.15)}>＋</button>
      <button class="sm" onclick={fit}>{t('stFit')}</button>
    </div>
    <div class="grp">
      <button class="sm" title={t('ttUndo')} disabled={!hist.undo.length} onclick={undo}>↶</button>
      <button class="sm" title={t('ttRedo')} disabled={!hist.redo.length} onclick={redo}>↷</button>
    </div>
    <label class="switch"><span>{t('stRef')}</span><input type="checkbox" bind:checked={app.refOn}></label>
    <label class="switch"><span>{t('stGuide')}</span><input type="checkbox" bind:checked={app.showBoxes}></label>
    <label class="switch"><span>{t('stGuideLines')}</span><input type="checkbox" bind:checked={app.showGuideLines}></label>
    <label class="switch"><span>{t('stHistory')}</span><input type="checkbox" bind:checked={app.histOn} onchange={persistHist}></label>
    <span class="selinfo">{selInfo}</span>
    <span style="flex:1"></span>
    <span class="pill" style="color:{app.fontState === 'ok' ? 'var(--ok)' : 'var(--muted)'}">
      {app.fontState === 'ok' ? 'Noto Sans JP ✓' : app.fontState === 'system' ? t('fontSystem') : t('fontLoading')}
    </span>
  </div>
  <div class="canvaswrap" bind:this={wrapEl}>
    <div class="paper" style="width:{CW * app.zoom}px;height:{CH * app.zoom}px">
      {#if app.refSrc}
        <img class="ref" src={app.refSrc} alt=""
          style="display:{app.refOn ? 'block' : 'none'};opacity:{app.refOpacity / 100}">
      {/if}
      <canvas bind:this={cv} width={CW} height={CH}
        style="width:{CW * app.zoom}px;height:{CH * app.zoom}px;cursor:{cursor}"
        onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp}></canvas>
    </div>
  </div>
</main>
