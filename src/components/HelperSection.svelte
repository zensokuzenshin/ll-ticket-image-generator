<script>
  import { t } from '../lib/i18n.js'
  import { applyShowInfo } from '../lib/actions.js'
  import Section from './Section.svelte'

  let date = $state('2025-11-08')
  let open = $state('16:00')
  let start = $state('17:00')
</script>

<Section id="helper" title={t('secHelper')}>
  <div class="grid2">
    <div class="field"><label>{t('lblDate')}</label><input type="date" bind:value={date}></div>
    <div class="field"><label>{t('lblStart')}</label><input type="time" bind:value={start}></div>
  </div>
  <div class="grid2">
    <div class="field"><label>{t('lblOpen')}</label><input type="time" bind:value={open}></div>
    <div class="field" style="display:flex;align-items:flex-end">
      <button style="width:100%" onclick={() => applyShowInfo(date, open, start)}>{t('btnApply')}</button>
    </div>
  </div>
  <div class="mini">{@html t('helperHint')}</div>
</Section>
