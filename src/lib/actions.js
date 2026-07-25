/* All user-facing operations on the working template. Components call these;
   canvas re-rendering happens automatically because the template is $state. */
import { flushSync } from 'svelte'
import { CW, CH } from './constants.js'
import { app, select, selRef, nid } from './state.svelte.js'
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
  await Promise.all(app.A.images.map(loadImageObj))
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
  app.A.fields=app.A.fields.filter(x=>x!==f); if(app.sel.id===f.id) select(null,null)
  snapshotNow()
}
export function fullWidthField(f){ f.text=toFullWidth(f.text) }

/* ---------- images ---------- */
export function addLogo(){ const im=normalize({images:[NEW_LOGO()]}).images[0]; app.A.images.push(im); select('image',im); snapshotNow() }
export function addBg(){ const im=normalize({images:[NEW_BG()]}).images[0]; app.A.images.unshift(im); snapshotNow() }
export function duplicateImage(im){
  const c={...im,id:nid(),tag:'',name:dispName(im),x:im.x+30,y:im.y+30}
  app.A.images.splice(app.A.images.indexOf(im)+1,0,c)
  select('image',c); snapshotNow()
}
export function deleteImage(im){
  app.A.images=app.A.images.filter(x=>x!==im); if(app.sel.id===im.id) select(null,null)
  snapshotNow()
}
export function moveImage(im,dir){
  const i=app.A.images.indexOf(im)
  if(dir<0&&i>0){ app.A.images.splice(i,1); app.A.images.splice(i-1,0,im) }
  else if(dir>0&&i<app.A.images.length-1){ app.A.images.splice(i,1); app.A.images.splice(i+1,0,im) }
}
export function setImageFile(im,file){
  const fr=new FileReader()
  fr.onload=async()=>{ im.src=fr.result; im.w=0; im.h=0; await loadImageObj(im); snapshotNow() }
  fr.readAsDataURL(file)
}

/* ---------- guides ---------- */
export function addGuide(axis){
  const g={id:nid(),axis,pos:Math.round(axis==='x'?CW/2:CH/2)}
  app.A.guides.push(g)
  app.secCollapsed.guides=false
  snapshotNow()
}
export function removeGuide(g){ app.A.guides=app.A.guides.filter(x=>x!==g); snapshotNow() }

/* ---------- layout ---------- */
export function setFont(font){ app.A.font=font; app.A._stack=buildStack(font) }
export function applyAttrLayout(){ applyAttr(app.A) }
export function distributePairs(){ applyAttr(app.A); snapshotNow() }

/* ---------- show-info helper ---------- */
const WD=['日','月','火','水','木','金','土']
export function applyShowInfo(d,open,start){
  if(!d) return
  const [Y,M,D]=d.split('-').map(Number); const wd=WD[new Date(Y,M-1,D).getDay()]
  const map={ show:`${M}月${D}日（${wd}）${start}公演`, date:`${Y}年${M}月${D}日（${wd}）${start}`, times:`[開場] ${open}　[開演] ${start}` }
  let hit=false
  app.A.fields.forEach(f=>{ if(map[f.role]!==undefined){ f.text=map[f.role]; hit=true } })
  if(!hit){ alert(t('alertNoRole')); return }
  snapshotNow()
}

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
function packSel(){
  const o=selRef(); if(!o) return null
  return app.sel.type==='field'
    ? {__ticket:1,kind:'field',data:{tag:o.tag,key:o.key,role:o.role,name:o.name,text:o.text,x:o.x,y:o.y,size:o.size,weight:o.weight,color:o.color,lh:o.lh,ls:o.ls,wrap:o.wrap,multiline:o.multiline,shrink:o.shrink,attr:o.attr}}
    : {__ticket:1,kind:'image',data:{tag:o.tag,name:o.name,src:o.src,x:o.x,y:o.y,w:o.w,h:o.h,fill:o.fill}}
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
  const o=selRef(); if(!o) return false
  if(app.sel.type==='field') deleteField(o); else deleteImage(o)
  return true
}
export function doPaste(txt){
  let p=null
  try{ const j=JSON.parse(txt); if(j&&j.__ticket) p=j }catch(e){}
  if(!p) p=clipInternal
  if(!p||!p.data) return false
  const d=JSON.parse(JSON.stringify(p.data))
  d.x=(+d.x||0)+30; d.y=(+d.y||0)+30
  p.data.x=d.x; p.data.y=d.y          // cumulative offset on repeated paste
  if(p.kind==='field'){
    const f=normalize({fields:[d]}).fields[0]
    app.A.fields.push(f); select('field',f)
  } else {
    const im=normalize({images:[d]}).images[0]
    app.A.images.push(im)
    loadImageObj(im).then(()=>{ snapshotNow() })
    select('image',im)
  }
  snapshotNow()
  return true
}
export function duplicateSel(){
  const o=selRef(); if(!o) return
  app.sel.type==='field'?duplicateField(o):duplicateImage(o)
}
