<script>
  import { app, select } from '../lib/state.svelte.js'
  import { t, dispName } from '../lib/i18n.js'
  import { duplicateField, deleteField, fullWidthField } from '../lib/actions.js'

  let { f } = $props()
  let open = $state(false)
  let nmEl, cardEl
  const selected = $derived(app.sel.id === f.id)

  // contenteditable name: written only while not being edited (a reactive text
  // child would reset the caret on every keystroke)
  $effect(() => { const s = dispName(f); if (nmEl && document.activeElement !== nmEl) nmEl.textContent = s })
  // keep the card in view when the item is selected from the canvas
  $effect(() => { if (selected && cardEl) cardEl.scrollIntoView({ block: 'nearest' }) })

  const num = e => parseFloat(e.currentTarget.value) || 0
</script>

<div class="card" class:sel={selected} class:open bind:this={cardEl}
  onmousedown={() => select('field', f)} onfocusin={() => select('field', f)}>
  <div class="hd">
    <span class="nm" contenteditable="true" spellcheck="false" bind:this={nmEl}
      oninput={() => { f.name = nmEl.textContent; f.tag = '' }}></span>
    <div class="tools">
      <button class="sm ghost" title={t('ttFw')} onclick={() => fullWidthField(f)}>{t('fwShort')}</button>
      <button class="sm ghost" title={t('ttDup')} onclick={() => duplicateField(f)}>⎘</button>
      <button class="sm ghost" title={t('ttAdv')} onclick={() => open = !open}>⚙</button>
      <button class="sm ghost danger" title={t('ttDel')} onclick={() => deleteField(f)}>✕</button>
    </div>
  </div>
  <div class="field" style="margin:0">
    {#if f.multiline}
      <textarea rows="2" bind:value={f.text}></textarea>
    {:else}
      <input type="text" bind:value={f.text}>
    {/if}
  </div>
  <div class="adv">
    <div class="grid4">
      <div><label>{t('lblSize')}</label><input type="number" value={f.size} oninput={e => f.size = num(e)}></div>
      <div><label>X</label><input type="number" value={f.x} oninput={e => f.x = num(e)}></div>
      <div><label>Y</label><input type="number" value={f.y} oninput={e => f.y = num(e)}></div>
      <div><label>{t('lblLh')}</label><input type="number" value={f.lh} oninput={e => f.lh = num(e)}></div>
    </div>
    <div class="grid4" style="margin-top:7px;align-items:end">
      <div><label>{t('lblWeight')}</label>
        <select bind:value={f.weight}>
          <option value={400}>400</option><option value={500}>500</option>
          <option value={700}>700</option><option value={900}>900</option>
        </select>
      </div>
      <div><label>{t('lblLs')}</label><input type="number" value={f.ls} oninput={e => f.ls = num(e)}></div>
      <div><label>{t('lblColor')}</label><input type="color" bind:value={f.color}></div>
      <div><label>{t('lblRole')}</label>
        <select bind:value={f.role}>
          <option value="none">—</option><option value="show">show</option>
          <option value="date">date</option><option value="times">times</option>
        </select>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:8px">
      <label class="switch" style="color:var(--muted)"><input type="checkbox" bind:checked={f.wrap}>{t('cbWrap')}</label>
      <label class="switch" style="color:var(--muted)"><input type="checkbox" bind:checked={f.multiline}>{t('cbMultiline')}</label>
      <label class="switch" style="color:var(--muted)"><input type="checkbox" bind:checked={f.shrink}>{t('cbShrink')}</label>
      <label class="switch" style="color:var(--muted)"><input type="checkbox" bind:checked={f.attr}>{t('cbAttr')}</label>
    </div>
  </div>
</div>
