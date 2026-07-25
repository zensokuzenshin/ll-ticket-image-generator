<script>
  import { hist, jumpTo, clearHistory } from '../lib/history.svelte.js'
  import { t, dispName } from '../lib/i18n.js'

  const items = $derived(hist.present ? [...hist.undo, hist.present, ...hist.redo.slice().reverse()] : [])
  const cur = $derived(hist.undo.length)
  const label = e => t(e.k) + (e.o && dispName(e.o) ? ': ' + dispName(e.o) : '')

  let listEl
  $effect(() => {
    items.length
    const c = listEl && listEl.children[cur]
    if (c) c.scrollIntoView({ block: 'nearest' })
  })

  function clear() {
    if (!hist.present || !(hist.undo.length || hist.redo.length)) return
    if (!confirm(t('histClearConfirm'))) return
    clearHistory()
  }
</script>

<aside class="histpanel">
  <div class="hphead">
    <span>{t('stHistory')}</span>
    <button class="sm ghost" title={t('histClearTt')} onclick={clear}>{t('histClear')}</button>
  </div>
  <div class="hplist" bind:this={listEl}>
    {#each items as e, i}
      <div class="hitem" class:cur={i === cur} class:future={i > cur} title={label(e)} onclick={() => jumpTo(i)}>
        <span class="hthumb" style={e.thumb ? `background-image:url(${e.thumb})` : ''}></span>
        <span class="hlabel">{label(e)}</span>
      </div>
    {/each}
  </div>
</aside>
