/* All user-facing operations on the working template. Components call these;
   canvas re-rendering happens automatically because the template is $state. */
import { flushSync } from 'svelte'
import { app, select, selRefs, selectMany, deselectRef, nid } from './state.svelte.js'
import { t, dispName, localName } from './i18n.js'
import { normalize, blankPreset, templateJSON, presetJSON, buildStack, applyAttrLayout as applyAttr, NEW_FIELD, NEW_LOGO, NEW_BG, SAMPLE_TEXT } from './template.js'
import { loadImageObj } from './images.js'
import { fetchPreset } from './presets.js'
import { KIT_FAMILY, DEFAULT_FONT } from './constants.js'
import { renderCanvas } from './render.js'
import { resetHistory, snapshotNow } from './history.svelte.js'
import { toFullWidth } from './text.js'

export async function loadTemplate(tpl){
  app.A=normalize(JSON.parse(JSON.stringify(tpl)))
  for(const f of app.A.fields) if(!f.text && SAMPLE_TEXT[f.tag]) f.text=SAMPLE_TEXT[f.tag]
  select(null,null)
  await Promise.all(app.A.images.map(im=>loadImageObj(im,app.A)))
  flushSync()                  // paint the new template before the history baseline takes its thumb
  resetHistory()               // a loaded template starts a fresh undo history
}

/* ---------- fonts ---------- */
export async function ensureFonts(){
  const txt=(app.A?app.A.fields.map(f=>f.text).join(''):'')+'0123456789年月日（土）公演開場演列番氏名座席'
  try{
    if(document.fonts&&document.fonts.load){
      // The Adobe kit loads async and injects its @font-face rules late, so wait
      // for it before measuring. It resolves on failure too, and the race caps
      // the wait, so a blocked or slow kit only costs the fallback to Noto.
      if(window.__tkReady) await Promise.race([window.__tkReady,new Promise(r=>setTimeout(r,3500))])
      await Promise.all([400,500,700,900].flatMap(w=>[
        document.fonts.load(`${w} 100px 'Noto Sans JP'`,txt),
        document.fonts.load(`${w} 100px 'Roboto'`,txt),
        document.fonts.load(`${w} 100px 'hiragino-kaku-gothic-pron'`,txt)]))
      await document.fonts.ready
      // Hiragino is the default, so a blocked kit silently swaps the output back
      // to Noto. Surface that through the existing warning rather than hide it.
      // document.fonts.check() cannot tell us this: it answers true for a family
      // that does not exist at all, so look for the kit's own face instead.
      let kitOk=false
      document.fonts.forEach(f=>{ if(f.family===KIT_FAMILY&&f.status==='loaded') kitOk=true })
      const wantsKit=((app.A&&app.A.font)||DEFAULT_FONT).includes(KIT_FAMILY)
      app.fontState=wantsKit&&!kitOk?'system':'ok'
    } else { app.fontState='system' }
  }catch(e){ app.fontState='system' }
  app.fontTick++               // fonts changed → repaint
}

/* ---------- fields ---------- */
export function addField(){
  const f=normalize({fields:[{...NEW_FIELD(),x:app.A.marL}]}).fields[0]
  app.A.fields.push(f); select('field',f); snapshotNow()
}
export function duplicateField(f){
  const c={...f,id:nid(),tag:'',role:'',name:dispName(f),y:f.y+f.lh,attr:0}   // the copy's pair partner wasn't copied
  app.A.fields.splice(app.A.fields.indexOf(f)+1,0,c)
  select('field',c); snapshotNow()
}
export function deleteField(f){
  app.A.fields=app.A.fields.filter(x=>x!==f); deselectRef(f)
  snapshotNow()
}
export function fullWidthField(f){ f.text=toFullWidth(f.text) }

/* ---------- label/value pairing (f.attr = shared pair id, 0 = none) ---------- */
const nextPairId=()=>app.A.fields.reduce((m,f)=>Math.max(m,+f.attr||0),0)+1
export function setFieldGrouped(f,on){ f.attr=on?nextPairId():0; snapshotNow() }
export function setFieldPartner(f,partnerId){
  const p=app.A.fields.find(x=>x.id===partnerId)
  if(!p||p===f) return
  f.attr=p.attr=nextPairId()          // previous partners (if any) stay behind as lone members
  snapshotNow()
}
/** Copies carry their pair ids along: a pair copied whole becomes a fresh
    pair; a half-copied member leaves the stack (its partner wasn't copied). */
function remapPairs(copies){
  const cnt=new Map()
  for(const f of copies) if(f.attr) cnt.set(f.attr,(cnt.get(f.attr)||0)+1)
  const fresh=new Map(); let next=nextPairId()
  for(const f of copies){ if(!f.attr) continue
    if(cnt.get(f.attr)<2){ f.attr=0; continue }
    if(!fresh.has(f.attr)) fresh.set(f.attr,next++)
    f.attr=fresh.get(f.attr) }
}

/* ---------- images ---------- */
export function addLogo(){ const im=normalize({images:[NEW_LOGO()]}).images[0]; app.A.images.push(im); select('image',im); snapshotNow() }
export function addBg(){ const im=normalize({images:[NEW_BG(app.A)]}).images[0]; app.A.images.unshift(im); snapshotNow() }
export function duplicateImage(im){
  const c={...im,id:nid(),tag:'',name:dispName(im),x:im.x+30,y:im.y+30}
  app.A.images.splice(app.A.images.indexOf(im)+1,0,c)
  select('image',c); snapshotNow()
}
export function deleteImage(im){
  app.A.images=app.A.images.filter(x=>x!==im); deselectRef(im)
  snapshotNow()
}
export function moveImage(im,dir){
  const i=app.A.images.indexOf(im)
  if(dir<0&&i>0){ app.A.images.splice(i,1); app.A.images.splice(i-1,0,im) }
  else if(dir>0&&i<app.A.images.length-1){ app.A.images.splice(i,1); app.A.images.splice(i+1,0,im) }
}
export function setImageFile(im,file){
  const fr=new FileReader()
  fr.onload=async()=>{ im.src=fr.result; im.w=0; im.h=0; await loadImageObj(im,app.A); snapshotNow() }
  fr.readAsDataURL(file)
}

/* ---------- guides ---------- */
export function addGuide(axis){
  const g={id:nid(),axis,pos:Math.round(axis==='x'?app.A.cw/2:app.A.ch/2)}
  app.A.guides.push(g)
  app.secCollapsed.guides=false
  snapshotNow()
}
export function removeGuide(g){ app.A.guides=app.A.guides.filter(x=>x!==g); snapshotNow() }

/* ---------- layout ---------- */
/* Resize the canvas (per-printer output size). With scale=true the contents
   follow: x-axis quantities (x, widths, margins, font size, letter-spacing)
   by the width ratio, y-axis quantities (y, heights, line-height, pair-stack
   gaps) by the height ratio. Font size scales with the x-axis on purpose —
   text advance widths then scale exactly with the wrap width (cw − x − marR),
   so line-break points cannot flip; an aspect change is absorbed as looser or
   tighter line-height instead. */
export function setCanvasSize(w,h,scale){
  const A=app.A
  w=Math.round(+w)||0; h=Math.round(+h)||0
  if(w<16||h<16||(w===A.cw&&h===A.ch)) return
  if(scale){
    const kx=w/A.cw, ky=h/A.ch
    const rx=v=>Math.round(v*kx), ry=v=>Math.round(v*ky)
    A.marL=rx(A.marL); A.marR=rx(A.marR)
    for(const f of A.fields){ f.x=rx(f.x); f.size=Math.max(1,rx(f.size)); f.ls=rx(f.ls)
      f.y=ry(f.y); f.lh=Math.max(1,ry(f.lh)) }
    for(const im of A.images){ im.x=rx(im.x); im.w=Math.max(1,rx(im.w)); im.y=ry(im.y); im.h=Math.max(1,ry(im.h)) }
    for(const g of A.guides) g.pos=g.axis==='x'?rx(g.pos):ry(g.pos)
    if(A.attr){ A.attr.top=ry(A.attr.top); A.attr.labelGap=ry(A.attr.labelGap); A.attr.pairGap=ry(A.attr.pairGap) }
  }
  A.cw=w; A.ch=h
  snapshotNow()
}
export function setFont(font){ app.A.font=font; app.A._stack=buildStack(font) }
export function applyAttrLayout(){ applyAttr(app.A) }
export function distributePairs(){ applyAttr(app.A); snapshotNow() }

/* ---------- presets / template files ---------- */
export function newBlank(){ app.presetKey='__custom'; loadTemplate(blankPreset()) }

/* Preset bodies are downloaded one show at a time (the catalogue itself is just
   index.json). app.presets doubles as the fetch-once cache, so re-picking a
   show — and the dev "save to source file", which refreshes an entry in place —
   costs nothing. */
export async function ensurePreset(k){
  if(!k||k==='__custom') return null
  if(app.presets[k]) return app.presets[k]
  const tpl=await fetchPreset(k)
  if(tpl) app.presets[k]=tpl
  return tpl
}

let pickToken=0
export async function loadPresetKey(k){
  if(!k||k==='__custom') return            // "(custom)" is the template in hand — nothing to fetch
  const mine=++pickToken
  app.busy++
  try{
    const tpl=await ensurePreset(k)
    if(mine!==pickToken) return             // a newer pick took over while this one downloaded
    if(!tpl){ app.presetErr=true; return }
    app.presetErr=false
    await loadTemplate(tpl)
  }finally{ app.busy-- }
}

/* Labels for shows whose index.json entry gave no name: take it from the preset
   itself, which means fetching it — quietly (no busy state; what the user asked
   for is already on screen) and only for the shows currently listed. Until that
   lands the option reads "loading", and a preset that cannot be fetched falls
   back to its key so the option is still pickable. */
const naming=new Set()
export function warmPresetNames(keys){
  for(const k of keys){
    if(app.presetNames[k]||naming.has(k)) continue
    naming.add(k)
    ensurePreset(k).then(tpl=>{ app.presetNames[k]=(tpl&&tpl.name)||k })
  }
}

function download(blob,name){
  const url=URL.createObjectURL(blob); const a=document.createElement('a')
  a.href=url; a.download=name; a.click()
  setTimeout(()=>URL.revokeObjectURL(url),2000)
}
export function saveTemplate(){
  const out=templateJSON(app.A,dispName)
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'})
  download(blob,(localName(app.A.name)||'template').replace(/[^\w\-ぁ-んァ-ヶ一-龠가-힣]/g,'_')+'.json')
}
export function loadTemplateFile(file){
  const fr=new FileReader()
  fr.onload=()=>{ try{ const tpl=JSON.parse(fr.result); app.presetKey='__custom'; loadTemplate(tpl) }catch(err){ alert(t('alertLoadFail')+err.message) } }
  fr.readAsText(file)
}

/* ---------- dev only: write back into the preset file ----------
   Overwrites the file the current preset was loaded from instead of
   downloading a copy — the vite dev server does the writing (vite-dev-save.js).
   import.meta.env.DEV is false in every build, so this and its button drop out
   of the shipped app, which still has no backend. */
export const DEV=import.meta.env.DEV
/** The file behind the loaded template, '' for anything hand-loaded or new. */
export const sourceFile=()=>(DEV&&app.presetPaths&&app.presetPaths[app.presetKey])||''
export async function saveToSource(){
  const file=sourceFile()
  if(!file) return {ok:false,error:'no source file for this template'}
  const json=presetJSON(app.A)
  try{
    const r=await fetch('/__save-preset',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({file,json})})
    const d=await r.json().catch(()=>({}))
    if(!r.ok) throw new Error(d.error||('HTTP '+r.status))
    app.presets[app.presetKey]=JSON.parse(JSON.stringify(json))   // ↻ (and re-picking) now reload what is on disk
    if(json.name) app.presetNames[app.presetKey]=json.name        // a renamed show relabels its list entry too
    return {ok:true,file}
  }catch(e){ return {ok:false,error:e.message} }
}

/* ---------- export ---------- */
export function exportImage(type){
  const cv=app.canvasEl; if(!cv||!app.A) return
  // draw a clean frame (no selection/boxes/guides), grab it, then repaint the UI chrome
  renderCanvas(cv.getContext('2d'),app.A,{exporting:true})
  const mime=type==='jpg'?'image/jpeg':'image/png', q=type==='jpg'?0.95:undefined
  const restore=()=>{ app.renderTick++ }
  const fail=()=>{ alert(t('exportTaint')); restore() }
  try{
    cv.toBlob(blob=>{
      if(!blob){ fail(); return }
      download(blob,(app.fname||'ticket')+'.'+type)
      restore()
    }, mime, q)
  }catch(e){ fail() }   // SecurityError if a cross-origin logo tainted the canvas
}

/* ============================================================
   Clipboard (Ctrl+C / X / V) for the selected canvas item.
   Uses native copy/cut/paste events → real system clipboard
   (works across tabs), with an internal fallback payload.
   ============================================================ */
let clipInternal=null
function packOne(type,o){
  return type==='field'
    ? {kind:'field',data:{tag:o.tag,key:o.key,name:o.name,text:o.text,x:o.x,y:o.y,size:o.size,weight:o.weight,color:o.color,lh:o.lh,ls:o.ls,wrap:o.wrap,multiline:o.multiline,shrink:o.shrink,attr:o.attr}}
    : {kind:'image',data:{tag:o.tag,name:o.name,src:o.src,x:o.x,y:o.y,w:o.w,h:o.h,fill:o.fill}}
}
function packSel(){
  const items=selRefs(); if(!items.length) return null
  if(items.length===1) return {__ticket:1,...packOne(items[0].type,items[0].o)}
  return {__ticket:1,kind:'multi',items:items.map(s=>packOne(s.type,s.o))}
}
export function doCopy(e){
  const p=packSel(); if(!p) return false
  clipInternal=p
  const txt=JSON.stringify(p)
  if(e&&e.clipboardData) e.clipboardData.setData('text/plain',txt)
  else if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(()=>{})
  return true
}
export function deleteSel(){
  const items=selRefs(); if(!items.length) return false
  const ids=new Set(items.map(s=>s.o.id))
  app.A.fields=app.A.fields.filter(f=>!ids.has(f.id))
  app.A.images=app.A.images.filter(im=>!ids.has(im.id))
  select(null,null); snapshotNow()
  return true
}
export function doPaste(txt){
  let p=null
  try{ const j=JSON.parse(txt); if(j&&j.__ticket) p=j }catch(e){}
  if(!p) p=clipInternal
  if(!p||(!p.data&&!p.items)) return false
  const made=[]
  for(const ent of p.kind==='multi'?p.items:[p]){
    const d=JSON.parse(JSON.stringify(ent.data))
    d.x=(+d.x||0)+30; d.y=(+d.y||0)+30
    ent.data.x=d.x; ent.data.y=d.y    // cumulative offset on repeated paste
    if(ent.kind==='field'){
      const f=normalize({fields:[d]}).fields[0]
      app.A.fields.push(f); made.push({type:'field',o:f})
    } else {
      const im=normalize({images:[d]}).images[0]
      app.A.images.push(im)
      loadImageObj(im,app.A).then(()=>{ snapshotNow() })
      made.push({type:'image',o:im})
    }
  }
  remapPairs(made.filter(m=>m.type==='field').map(m=>m.o))
  selectMany(made)
  snapshotNow()
  return true
}
export function duplicateSel(){
  const items=selRefs(); if(!items.length) return
  const copies=[]
  for(const {type,o} of items){
    if(type==='field'){
      const c={...o,id:nid(),tag:'',role:'',name:dispName(o),y:o.y+o.lh}
      app.A.fields.splice(app.A.fields.indexOf(o)+1,0,c); copies.push({type,o:c})
    } else {
      const c={...o,id:nid(),tag:'',name:dispName(o),x:o.x+30,y:o.y+30}
      app.A.images.splice(app.A.images.indexOf(o)+1,0,c); copies.push({type,o:c})
    }
  }
  remapPairs(copies.filter(c=>c.type==='field').map(c=>c.o))
  selectMany(copies); snapshotNow()
}
