<script>
  import { app } from '../lib/state.svelte.js'
  import { t, setLang, I18N } from '../lib/i18n.js'
  import { exportImage } from '../lib/actions.js'
  import PresetSection from './PresetSection.svelte'
  import HelperSection from './HelperSection.svelte'
  import FieldsSection from './FieldsSection.svelte'
  import AttrSection from './AttrSection.svelte'
  import GuidesSection from './GuidesSection.svelte'
  import ImagesSection from './ImagesSection.svelte'
  import LayoutSection from './LayoutSection.svelte'
  import RefSection from './RefSection.svelte'
</script>

<aside class="sidebar">
  <div class="topbar">
    <div class="titlerow">
      <h1>{t('appTitle')}</h1>
      <select class="langsel" title={t('langSel')} bind:value={app.lang} onchange={() => setLang(app.lang)}>
        {#each Object.keys(I18N) as code}<option value={code}>{I18N[code]._name || code}</option>{/each}
      </select>
    </div>
    <div class="sz">{@html t('outputSizeLine')}</div>
    <div class="exportRow">
      <input type="text" style="flex:2" title={t('fileName')} bind:value={app.fname}>
      <button class="primary" style="flex:1.4" onclick={() => exportImage('png')}>{t('savePng')}</button>
      <button class="sm" onclick={() => exportImage('jpg')}>JPG</button>
    </div>
  </div>

  <PresetSection />
  <HelperSection />
  {#if app.A}
    <FieldsSection />
    <AttrSection />
    <GuidesSection />
    <ImagesSection />
    <LayoutSection />
  {/if}
  <RefSection />

  <div class="sec" style="border:none">
    <div class="hintbox">{@html t('opsBox')}</div>
  </div>
</aside>
