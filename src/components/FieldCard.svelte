<script>
  import { app, select, toggleSelect } from '../lib/state.svelte.js'
  import { t, dispName } from '../lib/i18n.js'
  import { duplicateField, deleteField, fullWidthField, setFieldGrouped, setFieldPartner } from '../lib/actions.js'

  let { f } = $props()
  let open = $state(false)
  let nmEl, cardEl
  const selected = $derived(app.sel.ids.includes(f.id))
  // label/value pairing: the field sharing this pair id, and the fields still
  // free to pair with (not already in a complete pair)
  const partner = $derived(f.attr ? app.A.fields.find(x => x !== f && x.attr === f.attr) || null : null)
  const candidates = $derived.by(() => {
    if (!f.attr) return []
    const n = new Map()
    for (const x of app.A.fields) if (x.attr) n.set(x.attr, (n.get(x.attr) || 0) + 1)
    return app.A.fields.filter(x => x !== f && (x === partner || (n.get(x.attr) || 0) < 2))
  })

  // contenteditable name: written only while not being edited (a reactive text
  // child would reset the caret on every keystroke)
  $effect(() => { const s = dispName(f); if (nmEl && document.activeElement !== nmEl) nmEl.textContent = s })
  // keep the card in view when the item is selected from the canvas (primary only,
  // so a multi-selection doesn't fight over the scroll position)
  $effect(() => { if (app.sel.id === f.id && cardEl) cardEl.scrollIntoView({ block: 'nearest' }) })

  const num = e => parseFloat(e.currentTarget.value) || 0
</script>

<div class="card" class:sel={selected} class:open bind:this={cardEl}
  onmousedown={e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); toggleSelect('field', f) } else select('field', f) }}
  onfocusin={() => select('field', f)}>
  <div class="hd">
    <span class="nm" contenteditable="true" spellcheck="false" bind:this={nmEl}
      oninput={() => { f.name = nmEl.textContent; f.tag = '' }}></span>
    <div class="tools">
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
    <div class="grid3" style="margin-top:7px;align-items:end">
      <div><label>{t('lblWeight')}</label>
        <select bind:value={f.weight}>
          <option value={400}>400</option><option value={500}>500</option>
          <option value={700}>700</option><option value={900}>900</option>
        </select>
      </div>
      <div><label>{t('lblLs')}</label><input type="number" value={f.ls} oninput={e => f.ls = num(e)}></div>
      <div><label>{t('lblColor')}</label><input type="color" bind:value={f.color}></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:8px;align-items:center">
      <label class="switch" style="color:var(--muted)"><input type="checkbox" bind:checked={f.wrap}>{t('cbWrap')}</label>
      <label class="switch" style="color:var(--muted)"><input type="checkbox" bind:checked={f.multiline}>{t('cbMultiline')}</label>
      <label class="switch" style="color:var(--muted)"><input type="checkbox" bind:checked={f.shrink}>{t('cbShrink')}</label>
      <label class="switch" style="color:var(--muted)"><input type="checkbox" checked={!!f.attr}
        onchange={e => setFieldGrouped(f, e.currentTarget.checked)}>{t('cbAttr')}</label>
      {#if f.attr}
        <select class="pairsel" value={partner ? partner.id : ''}
          onchange={e => setFieldPartner(f, e.currentTarget.value)}>
          <option value="" disabled>{t('attrPartnerPick')}</option>
          {#each candidates as c (c.id)}<option value={c.id}>{dispName(c)}</option>{/each}
        </select>
      {/if}
      <button class="sm" style="margin-left:auto" title={t('ttFw')} onclick={() => fullWidthField(f)}>{t('fwShort')}</button>
    </div>
  </div>
</div>
