<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  import { addGuide, removeGuide } from '../lib/actions.js'
  import Section from './Section.svelte'
</script>

<Section id="guides" title={t('secGuides')} hint={t('guideHint')}>
  <div>
    {#each app.A.guides as g (g.id)}
      <div class="guiderow">
        <span class="pill">{g.axis === 'x' ? '│' : '─'}</span>
        <input type="number" value={g.pos} oninput={e => g.pos = Math.round(parseFloat(e.currentTarget.value) || 0)}>
        <button class="sm ghost danger" title="✕" onclick={() => removeGuide(g)}>✕</button>
      </div>
    {/each}
  </div>
  <div class="addbtns">
    <button class="sm" onclick={() => addGuide('x')}>{t('addGuideV')}</button>
    <button class="sm" onclick={() => addGuide('y')}>{t('addGuideH')}</button>
  </div>
</Section>
