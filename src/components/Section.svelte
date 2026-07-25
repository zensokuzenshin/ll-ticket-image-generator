<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  let { id, title, hint = '', children } = $props()

  let showHint = $state(false)
  function toggleHint(e) {
    e.stopPropagation()                       // the whole h2 collapses the section
    showHint = !showHint
    if (showHint) app.secCollapsed[id] = false
  }
</script>

<section class="sec" id="sec-{id}" class:collapsed={app.secCollapsed[id]}>
  <h2 onclick={() => app.secCollapsed[id] = !app.secCollapsed[id]}>
    <span class="tw">▾</span> <span>{title}</span>
    {#if hint}<button class="qm" title={t('ttHelp')} onclick={toggleHint}>?</button>{/if}
  </h2>
  <div class="secbody">
    {#if hint && showHint}<div class="mini" style="margin:0 0 10px">{@html hint}</div>{/if}
    {@render children()}
  </div>
</section>
