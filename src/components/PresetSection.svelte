<script>
  import { app } from '../lib/state.svelte.js'
  import { t, localName } from '../lib/i18n.js'
  import { loadPresetKey, newBlank, saveTemplate, loadTemplateFile } from '../lib/actions.js'
  import Section from './Section.svelte'

  let fileEl
</script>

<Section id="preset" title={t('secPreset')} hint={t('presetHint')}>
  <div class="field">
    <label>{t('selPreset')}</label>
    <div class="row" style="align-items:center">
      <select bind:value={app.presetKey} onchange={() => loadPresetKey(app.presetKey)}>
        {#each Object.keys(app.presets || {}) as k (k)}
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
