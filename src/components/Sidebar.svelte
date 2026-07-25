<script>
  import { app } from '../lib/state.svelte.js'
  import { t, setLang, I18N } from '../lib/i18n.js'
  import { exportImage } from '../lib/actions.js'
  import PresetSection from './PresetSection.svelte'
  import FieldsSection from './FieldsSection.svelte'
  import AttrSection from './AttrSection.svelte'
  import GuidesSection from './GuidesSection.svelte'
  import ImagesSection from './ImagesSection.svelte'
  import LayoutSection from './LayoutSection.svelte'
  import RefSection from './RefSection.svelte'

  const GITHUB = 'https://github.com/zensokuzenshin/ll-ticket-image-generator'

  // the readout here is the only size display; editing lives in the Layout section
  function gotoLayout() {
    app.secCollapsed.layout = false
    requestAnimationFrame(() =>
      document.getElementById('sec-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
</script>

<aside class="sidebar">
  <div class="topbar">
    <div class="titlerow">
      <h1>{t('appTitle')}</h1>
      <a class="gh" href={GITHUB} target="_blank" rel="noopener" title="GitHub" aria-label="GitHub">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
      <button class="qm" title={t('ttHelp')} onclick={() => app.showHelp = !app.showHelp}>?</button>
      <select class="langsel" title={t('langSel')} bind:value={app.lang} onchange={() => setLang(app.lang)}>
        {#each Object.keys(I18N) as code}<option value={code}>{I18N[code]._name || code}</option>{/each}
      </select>
    </div>
    <div class="sz" role="button" tabindex="0" title={t('secLayout')}
      onclick={gotoLayout} onkeydown={e => e.key === 'Enter' && gotoLayout()}>
      {t('outputSize')} <b>{app.A ? `${app.A.cw} × ${app.A.ch}` : '… × …'} px</b>
    </div>
    <div class="exportRow">
      <input type="text" style="flex:2" title={t('fileName')} bind:value={app.fname}>
      <button class="primary" style="flex:1.4" onclick={() => exportImage('png')}>{t('savePng')}</button>
      <button class="sm" onclick={() => exportImage('jpg')}>JPG</button>
    </div>
  </div>

  <PresetSection />
  {#if app.A}
    <FieldsSection />
    <AttrSection />
    <GuidesSection />
    <ImagesSection />
    <LayoutSection />
  {/if}
  <RefSection />

  {#if app.showHelp}
    <div class="modalback" onclick={() => app.showHelp = false}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={t('ttHelp')} onclick={e => e.stopPropagation()}>
        <div class="modalhead">
          <span>{t('ttHelp')}</span>
          <button class="sm ghost" onclick={() => app.showHelp = false}>✕</button>
        </div>
        <div class="modalbody">{@html t('opsBox')}</div>
      </div>
    </div>
  {/if}
</aside>
