<script>
  import { app, select } from '../lib/state.svelte.js'
  import { t, dispName } from '../lib/i18n.js'
  import { duplicateImage, deleteImage, moveImage, setImageFile } from '../lib/actions.js'

  let { im } = $props()
  let nmEl, cardEl
  const selected = $derived(app.sel.id === im.id)

  $effect(() => { const s = dispName(im); if (nmEl && document.activeElement !== nmEl) nmEl.textContent = s })
  $effect(() => { if (selected && cardEl) cardEl.scrollIntoView({ block: 'nearest' }) })

  const num = e => parseFloat(e.currentTarget.value) || 0
</script>

<div class="card" class:sel={selected} bind:this={cardEl} onmousedown={() => select('image', im)}>
  <div class="hd">
    <span class="nm" contenteditable="true" spellcheck="false" bind:this={nmEl}
      oninput={() => { im.name = nmEl.textContent; im.tag = '' }}></span>
    <div class="tools">
      <button class="sm ghost" title={t('ttBack')} onclick={() => moveImage(im, -1)}>▲</button>
      <button class="sm ghost" title={t('ttFront')} onclick={() => moveImage(im, 1)}>▼</button>
      <button class="sm ghost danger" title={t('ttDel')} onclick={() => deleteImage(im)}>✕</button>
    </div>
  </div>
  <div class="thumb" style={im.src ? `background-image:url(${im.src})` : ''}></div>
  <div class="field" style="margin:0 0 8px">
    <input type="file" accept="image/*"
      onchange={e => { const file = e.currentTarget.files[0]; if (file) setImageFile(im, file) }}>
  </div>
  <div class="grid4">
    <div><label>{t('lblW')}</label>
      <input type="number" value={im.w} oninput={e => { im.w = num(e); if (im.natW) im.h = Math.round(im.w * im.natH / im.natW) }}>
    </div>
    <div><label>{t('lblH')}</label><input type="number" value={im.h} oninput={e => im.h = num(e)}></div>
    <div><label>X</label><input type="number" value={im.x} oninput={e => im.x = num(e)}></div>
    <div><label>Y</label><input type="number" value={im.y} oninput={e => im.y = num(e)}></div>
  </div>
  <div class="addbtns" style="margin-top:7px">
    <button class="sm" onclick={() => { if (im.natW) im.h = Math.round(im.w * im.natH / im.natW) }}>{t('btnAspect')}</button>
    <button class="sm" onclick={() => im.x = Math.round((app.A.cw - im.w) / 2)}>{t('btnCenter')}</button>
    <button class="sm" onclick={() => { im.x = 0; im.y = 0; im.w = app.A.cw; im.h = app.A.ch; im.fill = true }}>{t('btnFill')}</button>
  </div>
</div>
