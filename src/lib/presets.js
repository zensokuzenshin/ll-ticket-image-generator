/* Presets ship as JSON under public/presets/ : presets/index.json lists the
   files, each preset references its logo by URL (images[].src). Loaded via
   fetch, so the app must be served over HTTP; on file:// this returns null and
   the app degrades to a blank template + "Load template" file picker.

   index.json is either a flat list ["a.json", …] or a two-level catalogue
     { "groups": [ { "name", "series": [ { "name", "presets": ["a.json", …] } ] } ] }
   group = the idol group (Aqours, Nijigasaki…), series = one event under it
   (a live, tour, fan meeting…); each preset is one show of that series. Both
   "name"s take a plain
   string or a per-language object (see localName in i18n.js). Order in the
   file is display order, and the very first preset is the start-up template.
   loadPresets returns { presets, groups } — presets is the flat key→template
   map either way; groups mirrors the catalogue with resolved keys (entries
   that fail to load are dropped), or null for a flat index.

   Build-time VITE_ASSET_BASE (e.g. in .env.production) moves presets + logos
   to another origin: point it at a root that mirrors public/ (presets/ and
   logos/ side by side). Relative images[].src values inside a preset follow
   the base; absolute/data:/root-absolute srcs are left alone. The bucket must
   allow cross-origin GET (CORS) — also for the canvas export, since logos are
   requested with crossOrigin="anonymous". Unset → same-origin paths as before. */
let BASE = import.meta.env.VITE_ASSET_BASE || ''
if (BASE && !BASE.endsWith('/')) BASE += '/'

const keyOf=f=>String(f).replace(/^.*\//,'').replace(/\.json$/i,'')

export async function loadPresets(){
  try{
    const list=await fetch(BASE+'presets/index.json',{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json() })
    const tree=(!Array.isArray(list)&&Array.isArray(list.groups))?list.groups:null
    const files=tree ? tree.flatMap(g=>(g.series||[]).flatMap(s=>s.presets||[]))
                     : (Array.isArray(list)?list:(list.presets||[]))
    const out={}
    for(const f of files){
      try{
        const key=keyOf(f)
        if(out[key]) continue
        const url=/^(https?:)?\/\//i.test(f) ? f : BASE+'presets/'+f
        const p=await fetch(url,{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json() })
        if(BASE&&p.images) for(const im of p.images)
          if(im.src && !/^(https?:|data:|blob:|\/)/i.test(im.src)) im.src=BASE+im.src
        out[key]=p
      }catch(e){ console.warn('preset load failed:',f,e) }
    }
    if(!Object.keys(out).length) return null
    const groups=tree&&tree
      .map(g=>({name:g.name,series:(g.series||[])
        .map(s=>({name:s.name,keys:(s.presets||[]).map(keyOf).filter(k=>out[k])}))
        .filter(s=>s.keys.length)}))
      .filter(g=>g.series.length)
    return {presets:out, groups:(groups&&groups.length)?groups:null}
  }catch(e){ console.warn('presets/index.json not reachable:',e); return null }
}
