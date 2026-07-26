import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'

import { cloudflare } from "@cloudflare/vite-plugin";
import { devSavePreset } from './vite-dev-save.js'

export default defineConfig({
  plugins: [devSavePreset(), svelte(), viteSingleFile(), cloudflare()],
})
