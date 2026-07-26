/* Presets ship as JSON under public/presets/ : presets/index.json lists the
   files, each preset references its logo by URL (images[].src). Loaded via
   fetch, so the app must be served over HTTP; on file:// loadIndex returns null
   and the app degrades to a blank template + "Load template" file picker.

   Start-up reads index.json and nothing else: a preset file is downloaded the
   first time that show is actually picked (fetchPreset), so the catalogue can
   grow without slowing the app down. loadIndex therefore never sees a preset's
   contents — everything the show list needs must come out of index.json.

   index.json is either a flat list ["a.json", …] or a two-level catalogue
     { "groups": [ { "name", "series": [ { "name", "presets": [entry, …] } ] } ] }
   group = the idol group (Aqours, Nijigasaki…), series = one event under it
   (a live, tour, fan meeting…); each preset is one show of that series. A
   preset entry is either the file path or {"file": …, "name": …}, the second
   form also giving that show's label in the list; an entry without a name is
   labelled by fetching that one preset in the background instead (see
   warmPresetNames in actions.js). Every "name" — group, series, preset — takes
   a plain string or a per-language object (see localName in i18n.js). Order in
   the file is display order, and the very first preset is the start-up
   template.

   loadIndex returns { keys, names, groups, paths }: keys is every preset key in
   catalogue order, names is key→label for the entries that gave one, groups
   mirrors the catalogue with resolved keys (null for a flat index), and paths
   is key→the file it came from, for the dev-only "save to source file".

   Build-time VITE_ASSET_BASE (e.g. in .env.production) moves presets + logos
   to another origin: point it at a root that mirrors public/ (presets/ and
   logos/ side by side). Relative images[].src values inside a preset follow
   the base; absolute/data:/root-absolute srcs are left alone. The bucket must
   allow cross-origin GET (CORS) — also for the canvas export, since logos are
   requested with crossOrigin="anonymous". Unset → same-origin paths as before. */
let BASE = import.meta.env.VITE_ASSET_BASE || ''
if (BASE && !BASE.endsWith('/')) BASE += '/'

const keyOf=f=>String(f).replace(/^.*\//,'').replace(/\.json$/i,'')
const fileOf=e=>(e&&typeof e==='object')?String(e.file||''):String(e||'')

const URLS=new Map()        // key → where to fetch it, filled in by loadIndex
const INFLIGHT=new Map()    // key → pending fetch, so one show is requested once

export async function loadIndex(){
  try{
    const list=await fetch(BASE+'presets/index.json',{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json() })
    const tree=(!Array.isArray(list)&&Array.isArray(list.groups))?list.groups:null
    const keys=[], names={}, paths={}
    URLS.clear()
    /** Register one catalogue entry; returns its key ('' = unusable entry). */
    const add=e=>{
      const f=fileOf(e); if(!f) return ''
      const key=keyOf(f)
      if(URLS.has(key)) return key                      // duplicate listing: first one wins
      const remote=/^(https?:)?\/\//i.test(f)
      URLS.set(key,remote?f:BASE+'presets/'+f)
      keys.push(key)
      if(e&&typeof e==='object'&&e.name) names[key]=e.name
      // path under public/presets/, writable in dev — but not with an asset
      // base: those come from another origin and their srcs get rewritten
      if(!remote&&!BASE) paths[key]=f
      return key
    }
    const groups=tree&&tree
      .map(g=>({name:g.name,series:(g.series||[])
        .map(s=>({name:s.name,keys:(s.presets||[]).map(add).filter(Boolean)}))
        .filter(s=>s.keys.length)}))
      .filter(g=>g.series.length)
    if(!tree) for(const e of (Array.isArray(list)?list:(list.presets||[]))) add(e)
    if(!keys.length) return null
    return {keys,names,groups:(groups&&groups.length)?groups:null,paths}
  }catch(e){ console.warn('presets/index.json not reachable:',e); return null }
}

/** One preset's template, downloaded on demand. Concurrent calls for the same
    key share a request; null = unknown key or a failed load (retryable). */
export function fetchPreset(key){
  const url=URLS.get(key)
  if(!url) return Promise.resolve(null)
  const pending=INFLIGHT.get(key)
  if(pending) return pending
  const p=fetch(url,{cache:'no-cache'})
    .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json() })
    .then(tpl=>{
      if(BASE&&tpl.images) for(const im of tpl.images)
        if(im.src && !/^(https?:|data:|blob:|\/)/i.test(im.src)) im.src=BASE+im.src
      return tpl
    })
    .catch(e=>{ console.warn('preset load failed:',key,e); return null })
    .finally(()=>INFLIGHT.delete(key))
  INFLIGHT.set(key,p)
  return p
}
