<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  import { addField } from '../lib/actions.js'
  import Section from './Section.svelte'
  import FieldCard from './FieldCard.svelte'
</script>

<Section id="fields" title={t('secFields')}>
  <div>
    {#each app.A.fields as f (f.id)}
      <FieldCard {f} />
    {/each}
  </div>
  <div class="addbtns"><button class="sm" onclick={addField}>{t('addField')}</button></div>
</Section>
