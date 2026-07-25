<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  import Section from './Section.svelte'

  function loadRef(e) {
    const file = e.currentTarget.files[0]; if (!file) return
    const fr = new FileReader()
    fr.onload = () => { app.refSrc = fr.result; app.refOn = true }
    fr.readAsDataURL(file)
  }
</script>

<Section id="ref" title={t('secRef')}>
  <div class="field"><label>{t('refLoad')}</label><input type="file" accept="image/*" onchange={loadRef}></div>
  <div class="field">
    <label>{t('opacity')} <span>{app.refOpacity}%</span></label>
    <input type="range" min="0" max="100" bind:value={app.refOpacity}>
  </div>
  <div class="mini">{@html t('refHint')}</div>
</Section>
