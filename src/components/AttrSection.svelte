<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  import { applyAttrLayout, distributePairs } from '../lib/actions.js'
  import Section from './Section.svelte'

  const setAttr = (key, e) => { app.A.attr[key] = parseFloat(e.currentTarget.value) || 0; applyAttrLayout() }
</script>

<Section id="attr" title={t('secAttr')}>
  <div class="grid3">
    <div class="field"><label>{t('attrTop')}</label><input type="number" value={app.A.attr.top} oninput={e => setAttr('top', e)}></div>
    <div class="field"><label>{t('attrLabelGap')}</label><input type="number" value={app.A.attr.labelGap} oninput={e => setAttr('labelGap', e)}></div>
    <div class="field"><label>{t('attrPairGap')}</label><input type="number" value={app.A.attr.pairGap} oninput={e => setAttr('pairGap', e)}></div>
  </div>
  <div class="addbtns"><button class="sm" onclick={distributePairs}>{t('attrApply')}</button></div>
  <div class="mini">{@html t('attrHint')}</div>
</Section>
