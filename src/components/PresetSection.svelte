<script>
  import { app } from '../lib/state.svelte.js'
  import { t, localName } from '../lib/i18n.js'
  import { loadPresetKey, newBlank, saveTemplate, loadTemplateFile } from '../lib/actions.js'
  import Section from './Section.svelte'

  let fileEl

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
  const keys = $derived(app.presetGroups ? (series[si]?.keys || []) : Object.keys(app.presets || {}))
  function pick(k) { app.presetKey = k; loadPresetKey(k) }
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
          <option value={k}>{localName(app.presets[k].name) || k}</option>
        {/each}
        <option value="__custom">{t('presetCustom')}</option>
      </select>
      <button class="sm ghost" style="flex:0 0 auto" title={t('btnReset')}
        onclick={() => loadPresetKey(app.presetKey)}>↻</button>
    </div>
  </div>
  <div class="addbtns">
    <button class="sm" onclick={newBlank}>{t('btnNew')}</button>
    <button class="sm" onclick={saveTemplate}>{t('btnSave')}</button>
    <button class="sm" onclick={() => fileEl.click()}>{t('btnLoad')}</button>
  </div>
  <input type="file" accept="application/json,.json" hidden bind:this={fileEl}
    onchange={e => { const f = e.currentTarget.files[0]; if (f) loadTemplateFile(f); e.currentTarget.value = '' }}>
  {#if app.presetErr}<div class="mini" style="color:var(--danger)">{t('presetLoadErr')}</div>{/if}
</Section>
