/* Presets ship as JSON under public/presets/ : presets/index.json lists the
   files, each preset references its logo by URL (images[].src). Loaded via
   fetch, so the app must be served over HTTP; on file:// this returns null and
   the app degrades to a blank template + "Load template" file picker.

   Build-time VITE_ASSET_BASE (e.g. in .env.production) moves presets + logos
   to another origin: point it at a root that mirrors public/ (presets/ and
   logos/ side by side). Relative images[].src values inside a preset follow
   the base; absolute/data:/root-absolute srcs are left alone. The bucket must
   allow cross-origin GET (CORS) — also for the canvas export, since logos are
   requested with crossOrigin="anonymous". Unset → same-origin paths as before. */
let BASE = import.meta.env.VITE_ASSET_BASE || ''
if (BASE && !BASE.endsWith('/')) BASE += '/'

export async function loadPresets(){
  try{
    const list=await fetch(BASE+'presets/index.json',{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json() })
    const files=Array.isArray(list)?list:(list.presets||[])
    const out={}
    for(const f of files){
      try{
        const key=String(f).replace(/^.*\//,'').replace(/\.json$/i,'')
        const url=/^(https?:)?\/\//i.test(f) ? f : BASE+'presets/'+f
        const p=await fetch(url,{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json() })
        if(BASE&&p.images) for(const im of p.images)
          if(im.src && !/^(https?:|data:|blob:|\/)/i.test(im.src)) im.src=BASE+im.src
        out[key]=p
      }catch(e){ console.warn('preset load failed:',f,e) }
    }
    return Object.keys(out).length?out:null
  }catch(e){ console.warn('presets/index.json not reachable:',e); return null }
}
