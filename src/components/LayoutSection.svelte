<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  import { setFont } from '../lib/actions.js'
  import Section from './Section.svelte'

  const num = e => parseFloat(e.currentTarget.value) || 0
</script>

<Section id="layout" title={t('secLayout')}>
  <div class="grid2">
    <div class="field"><label>{t('marL')}</label><input type="number" value={app.A.marL} oninput={e => app.A.marL = num(e)}></div>
    <div class="field"><label>{t('marR')}</label><input type="number" value={app.A.marR} oninput={e => app.A.marR = num(e)}></div>
  </div>
  <div class="field"><label>{t('fontLabel')}</label>
    <select value={app.A.font} onchange={e => setFont(e.currentTarget.value)}>
      <option value="'Noto Sans JP'">{t('fontNoto')}</option>
      <option value="'Hiragino Kaku Gothic ProN','Noto Sans JP'">{t('fontHira')}</option>
      <option value="'Yu Gothic','YuGothic','Noto Sans JP'">{t('fontYu')}</option>
      <option value="'Meiryo','Noto Sans JP'">{t('fontMeiryo')}</option>
    </select>
  </div>
  <div class="field"><label>{t('bgColor')}</label><input type="color" bind:value={app.A.bg}></div>
  <div class="mini">{@html t('layoutHint')}</div>
</Section>
