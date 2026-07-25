<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  import { setFont, setCanvasSize } from '../lib/actions.js'
  import Section from './Section.svelte'

  const num = e => parseFloat(e.currentTarget.value) || 0

  // Canvas size commits on change (not per keystroke — a scaled resize is a
  // one-shot transform, intermediate typed values would wreck the layout).
  let scaleOn = $state(true)
  function commitSize(e, axis) {
    const w = axis === 'w' ? num(e) : app.A.cw
    const h = axis === 'h' ? num(e) : app.A.ch
    setCanvasSize(w, h, scaleOn)
    e.currentTarget.value = axis === 'w' ? app.A.cw : app.A.ch   // snap back if rejected
  }
</script>

<Section id="layout" title={t('secLayout')} hint={t('layoutHint')}>
  <div class="grid2">
    <div class="field"><label>{t('canvasW')}</label><input type="number" min="16" value={app.A.cw} onchange={e => commitSize(e, 'w')}></div>
    <div class="field"><label>{t('canvasH')}</label><input type="number" min="16" value={app.A.ch} onchange={e => commitSize(e, 'h')}></div>
  </div>
  <label class="switch" style="margin:2px 0 10px"><input type="checkbox" bind:checked={scaleOn}>{t('cbScaleOnResize')}</label>
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
</Section>
