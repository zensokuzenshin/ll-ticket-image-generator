/* All user-facing operations on the working template. Components call these;
   canvas re-rendering happens automatically because the template is $state. */
import { flushSync } from 'svelte'
import { app, select, selRefs, selectMany, deselectRef, nid } from './state.svelte.js'
import { t, dispName } from './i18n.js'
import { normalize, blankPreset, templateJSON, buildStack, applyAttrLayout as applyAttr, NEW_FIELD, NEW_LOGO, NEW_BG, SAMPLE_TEXT } from './template.js'
import { loadImageObj } from './images.js'
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
      await Promise.all([400,500,700,900].map(w=>document.fonts.load(`${w} 100px 'Noto Sans JP'`,txt)))
      await document.fonts.ready
      app.fontState='ok'
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
  const c={...f,id:nid(),tag:'',name:dispName(f),y:f.y+f.lh}
  app.A.fields.splice(app.A.fields.indexOf(f)+1,0,c)
  select('field',c); snapshotNow()
}
export function deleteField(f){
  app.A.fields=app.A.fields.filter(x=>x!==f); deselectRef(f)
  snapshotNow()
}
export function fullWidthField(f){ f.text=toFullWidth(f.text) }

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
export function loadPresetKey(k){ if(app.presets&&app.presets[k]){ loadTemplate(app.presets[k]) } }

function download(blob,name){
  const url=URL.createObjectURL(blob); const a=document.createElement('a')
  a.href=url; a.download=name; a.click()
  setTimeout(()=>URL.revokeObjectURL(url),2000)
}
export function saveTemplate(){
  const out=templateJSON(app.A,dispName)
  const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'})
  download(blob,(app.A.name||'template').replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g,'_')+'.json')
}
export function loadTemplateFile(file){
  const fr=new FileReader()
  fr.onload=()=>{ try{ const tpl=JSON.parse(fr.result); app.presetKey='__custom'; loadTemplate(tpl) }catch(err){ alert(t('alertLoadFail')+err.message) } }
  fr.readAsText(file)
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
  selectMany(made)
  snapshotNow()
  return true
}
export function duplicateSel(){
  const items=selRefs(); if(!items.length) return
  const copies=[]
  for(const {type,o} of items){
    if(type==='field'){
      const c={...o,id:nid(),tag:'',name:dispName(o),y:o.y+o.lh}
      app.A.fields.splice(app.A.fields.indexOf(o)+1,0,c); copies.push({type,o:c})
    } else {
      const c={...o,id:nid(),tag:'',name:dispName(o),x:o.x+30,y:o.y+30}
      app.A.images.splice(app.A.images.indexOf(o)+1,0,c); copies.push({type,o:c})
    }
  }
  selectMany(copies); snapshotNow()
}
