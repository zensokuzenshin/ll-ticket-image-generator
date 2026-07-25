/* UI localisation. The TICKET content stays as entered (it is the printed
   data); only the tool's own UI is translated. Strings live in
   src/locales/<code>.json — to add a language, drop a new JSON there with the
   same keys ("_name" is its native name); it is picked up automatically by
   the language selector and browser detection. Default language follows the
   browser and falls back to Korean. t() reads app.lang, so any template
   expression using it re-evaluates when the language changes. */
import { app } from './state.svelte.js'

const DEFAULT_LANG = 'ko'

const files = import.meta.glob('../locales/*.json', { eager: true })
const codeOf = p => p.replace(/^.*\/|\.json$/g, '')
export const I18N = {}
for (const p of Object.keys(files).sort((a, b) => {          // default language first (heads the selector)
  const ca = codeOf(a), cb = codeOf(b)
  return ca === DEFAULT_LANG ? -1 : cb === DEFAULT_LANG ? 1 : ca < cb ? -1 : 1
})) I18N[codeOf(p)] = files[p].default || files[p]

export function t(k){
  const L = I18N[app.lang] || I18N[DEFAULT_LANG]
  if (L && L[k]) return L[k]
  for (const c in I18N) if (I18N[c][k]) return I18N[c][k]
  return k
}
/* Item display label: `tag` is a semantic id (fld_show, img_logo…) resolved
   through the dictionaries; `name` is the user-given fallback for untagged
   (custom/renamed) items. */
export function dispName(o){ return (o&&o.tag) ? t(o.tag) : ((o&&o.name)||'') }

export function detectLang(){
  try{ const s=localStorage.getItem('tig_lang'); if(s&&I18N[s]) return s }catch(e){}
  const cs=(navigator.languages&&navigator.languages.length)?navigator.languages:[navigator.language||'']
  for(let c of cs){ c=(c||'').toLowerCase(); for(const k in I18N) if(c.indexOf(k)===0) return k }
  return DEFAULT_LANG
}

export function setLang(l){
  app.lang=l
  try{ localStorage.setItem('tig_lang',l) }catch(e){}
}
