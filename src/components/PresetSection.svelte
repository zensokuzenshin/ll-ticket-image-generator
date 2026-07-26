<script>
  import { untrack } from 'svelte'
  import { app } from '../lib/state.svelte.js'
  import { t, localName } from '../lib/i18n.js'
  import { loadPresetKey, warmPresetNames, newBlank, saveTemplate, loadTemplateFile, DEV, sourceFile, saveToSource } from '../lib/actions.js'
  import Section from './Section.svelte'

  let fileEl

  /* Dev server only: write the template straight back into its preset file
     instead of downloading it. DEV is false in every build, so the block below
     is compiled out of the shipped app. */
  const src = $derived(DEV ? sourceFile() : '')     // reads app.presetPaths/presetKey → stays in sync
  let devMsg = $state('')
  let devTimer
  async function devSave() {
    const r = await saveToSource()
    devMsg = r.ok ? 'saved to ' + r.file : 'failed: ' + r.error
    clearTimeout(devTimer); devTimer = setTimeout(() => devMsg = '', 4000)
  }

  /* Catalogue cascade (group → event → show). gi/si point into
     app.presetGroups and follow the active preset; while "(custom)" is shown
     they simply keep their last position. Flat index (no groups) → the
     preset select alone, as before. */
  let gi = $state(0), si = $state(0)
  $effect(() => {
    const gs = app.presetGroups; if (!gs) return
    for (let g = 0; g < gs.length; g++)
      for (let s = 0; s < gs[g].series.length; s++)
        if (gs[g].series[s].keys.includes(app.presetKey)) { gi = g; si = s; return }
  })
  const series = $derived(app.presetGroups ? (app.presetGroups[gi]?.series || []) : [])
  const keys = $derived(app.presetGroups ? (series[si]?.keys || []) : app.presetKeys)
  function pick(k) { app.presetKey = k; loadPresetKey(k) }

  /* Show labels come from index.json, so the list can be built without
     downloading anything; warmPresetNames fills in the entries that omit one. */
  const label = k => localName(app.presetNames[k]) || t('loading')
  $effect(() => { const ks = keys; untrack(() => warmPresetNames(ks)) })
</script>

<Section id="preset" title={t('secPreset')} hint={t('presetHint')}>
  {#if app.presetGroups}
    <div class="field">
      <label>{t('selGroup')}</label>
      <select bind:value={gi} onchange={() => { si = 0; pick(app.presetGroups[gi].series[0].keys[0]) }}>
        {#each app.presetGroups as g, i (i)}
          <option value={i}>{localName(g.name)}</option>
        {/each}
      </select>
    </div>
    <div class="field">
      <label>{t('selSeries')}</label>
      <select bind:value={si} onchange={() => pick(series[si].keys[0])}>
        {#each series as s, i (i)}
          <option value={i}>{localName(s.name)}</option>
        {/each}
      </select>
    </div>
  {/if}
  <div class="field">
    <label>{t('selPreset')}</label>
    <div class="row" style="align-items:center">
      <select bind:value={app.presetKey} onchange={() => loadPresetKey(app.presetKey)}>
        {#each keys as k (k)}
          <option value={k}>{label(k)}</option>
        {/each}
        <option value="__custom">{t('presetCustom')}</option>
      </select>
      <button class="sm ghost" style="flex:0 0 auto" title={t('btnReset')}
        onclick={() => loadPresetKey(app.presetKey)}>↻</button>
      {#if app.showBusy}<span class="spinner" title={t('loading')}></span>{/if}
    </div>
  </div>
  <div class="addbtns">
    <button class="sm" onclick={newBlank}>{t('btnNew')}</button>
    <button class="sm" onclick={saveTemplate}>{t('btnSave')}</button>
    <button class="sm" onclick={() => fileEl.click()}>{t('btnLoad')}</button>
  </div>
  {#if DEV}
    <div class="addbtns">
      <button class="sm" disabled={!src} onclick={devSave}
        title={src ? 'overwrite public/presets/' + src : 'only for templates loaded from presets/'}>
        {devMsg || (src ? 'Save to ' + src : 'Save to source file')}
      </button>
    </div>
  {/if}
  <input type="file" accept="application/json,.json" hidden bind:this={fileEl}
    onchange={e => { const f = e.currentTarget.files[0]; if (f) loadTemplateFile(f); e.currentTarget.value = '' }}>
  {#if app.presetErr}<div class="mini" style="color:var(--danger)">{t('presetLoadErr')}</div>{/if}
</Section>
