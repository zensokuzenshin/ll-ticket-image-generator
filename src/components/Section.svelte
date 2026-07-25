<script>
  import { app } from '../lib/state.svelte.js'
  let { id, title, children } = $props()
</script>

<section class="sec" class:collapsed={app.secCollapsed[id]}>
  <h2 onclick={() => app.secCollapsed[id] = !app.secCollapsed[id]}>
    <span class="tw">▾</span> <span>{title}</span>
  </h2>
  <div class="secbody">{@render children()}</div>
</section>
