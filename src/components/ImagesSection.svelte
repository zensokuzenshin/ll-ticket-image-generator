<script>
  import { app } from '../lib/state.svelte.js'
  import { t } from '../lib/i18n.js'
  import { addLogo, addBg } from '../lib/actions.js'
  import Section from './Section.svelte'
  import ImageCard from './ImageCard.svelte'
</script>

<Section id="images" title={t('secImages')} hint={t('imagesHint')}>
  <div>
    {#each app.A.images as im (im.id)}
      <ImageCard {im} />
    {/each}
  </div>
  <div class="addbtns">
    <button class="sm" onclick={addLogo}>{t('addLogo')}</button>
    <button class="sm" onclick={addBg}>{t('addBg')}</button>
  </div>
</Section>
