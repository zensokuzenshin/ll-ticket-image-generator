/* History (undo / redo), Photoshop-style.
   Snapshot-based: the working template serializes (with ids, so selection
   survives restores); the canvas render effect schedules a debounced snapshot,
   so continuous edits (typing, dragging, nudging) coalesce into one entry,
   while discrete ops call snapshotNow() for an immediate commit.

   Entries are {s,k,o,thumb}: serialized state, an i18n label key for the
   action that produced it (derived by diffing against the previous state, so
   no mutation site needs to announce itself), the affected item's display
   name, and a tiny canvas thumbnail. */
import { app } from './state.svelte.js'
import { normalize, serializeState } from './template.js'
import { loadImageObj } from './images.js'

const HIST_MAX=100
export const hist = $state({ undo:[], redo:[], present:null })
let histTimer=null, restoring=false

function makeThumb(){
  try{
    const cv=app.canvasEl; if(!cv) return ''
    const tc=document.createElement('canvas'); tc.width=20; tc.height=32
    tc.getContext('2d').drawImage(cv,0,0,tc.width,tc.height)
    return tc.toDataURL('image/jpeg',.6)
  }catch(e){ return '' }        // tainted canvas (CORS) → entry without thumb
}
const nameRef=o=>o?{tag:o.tag||'',name:o.name||''}:null

function diffLabel(prevS,curS){
  try{
    const a=JSON.parse(prevS), b=JSON.parse(curS)
    const byId=arr=>new Map(arr.map(o=>[o.id,o]))
    const aF=byId(a.fields), bF=byId(b.fields), aI=byId(a.images), bI=byId(b.images)
    const added=b.fields.find(f=>!aF.has(f.id))||b.images.find(im=>!aI.has(im.id))
    if(added) return {k:'histAdd',o:nameRef(added)}
    const removed=a.fields.find(f=>!bF.has(f.id))||a.images.find(im=>!bI.has(im.id))
    if(removed) return {k:'histDelete',o:nameRef(removed)}
    // before the guide/item checks: a scaled resize also moves guides and items
    if(a.cw!==b.cw||a.ch!==b.ch) return {k:'histCanvas',o:null}
    if(b.guides.length!==a.guides.length) return {k:b.guides.length>a.guides.length?'histGuideAdd':'histGuideDel'}
    if(JSON.stringify(a.guides)!==JSON.stringify(b.guides)) return {k:'histGuideMove'}
    if(a.fields.map(f=>f.id).join()!==b.fields.map(f=>f.id).join()||
       a.images.map(im=>im.id).join()!==b.images.map(im=>im.id).join()) return {k:'histReorder'}
    const changed=[]            // [obj, changedKeys, kind]
    for(const f of b.fields){ const p=aF.get(f.id)
      const ks=Object.keys(f).filter(kk=>JSON.stringify(f[kk])!==JSON.stringify(p[kk])); if(ks.length) changed.push([f,ks,'field']) }
    for(const im of b.images){ const p=aI.get(im.id)
      const ks=Object.keys(im).filter(kk=>JSON.stringify(im[kk])!==JSON.stringify(p[kk])); if(ks.length) changed.push([im,ks,'image']) }
    if(changed.length===1){
      const [o,ks,kind]=changed[0], only=set=>ks.every(kk=>set.includes(kk))
      if(kind==='image'&&ks.includes('src')) return {k:'histImage',o:nameRef(o)}
      if(ks.includes('text')) return {k:'histText',o:nameRef(o)}
      if(only(['x','y'])) return {k:'histMove',o:nameRef(o)}
      if(kind==='image'&&only(['x','y','w','h','fill'])) return {k:'histResize',o:nameRef(o)}
      return {k:'histStyle',o:nameRef(o)}
    }
    if(changed.length>1){
      if(changed.every(c=>c[1].every(kk=>kk==='text'))) return {k:'histText',o:null}       // date/time helper
      if(changed.every(c=>c[0].attr&&c[1].every(kk=>kk==='y'))) return {k:'histPairs',o:null} // distribute
    }
    if(JSON.stringify(a.attr)!==JSON.stringify(b.attr)) return {k:'histPairs',o:null}
    if(a.name!==b.name) return {k:'histRename',o:null}
    if(a.marL!==b.marL||a.marR!==b.marR||a.font!==b.font||a.bg!==b.bg) return {k:'histLayout',o:null}
  }catch(e){}
  return {k:'histEdit',o:null}
}

function commit(s){
  const e={s,...diffLabel(hist.present.s,s),thumb:makeThumb()}
  hist.undo.push(hist.present); if(hist.undo.length>HIST_MAX) hist.undo.shift()
  hist.present=e; hist.redo.length=0
}

export function snapshotNow(){ if(restoring||!app.A||!hist.present) return; clearTimeout(histTimer); const s=serializeState(app.A); if(s&&s!==hist.present.s) commit(s) }

export function scheduleSnapshot(){
  if(restoring||!app.A||!hist.present) return
  clearTimeout(histTimer)
  histTimer=setTimeout(()=>{ const s=serializeState(app.A); if(s&&s!==hist.present.s) commit(s) },350)
}

export function resetHistory(){
  clearTimeout(histTimer); hist.undo=[]; hist.redo=[]
  const s=serializeState(app.A)
  hist.present=s?{s,k:'histOpen',o:app.A?{name:app.A.name}:null,thumb:makeThumb()}:null
}

async function restoreState(s){
  restoring=true; clearTimeout(histTimer)
  const selId=app.sel.id
  app.A=normalize(JSON.parse(s))
  await Promise.all(app.A.images.map(im=>loadImageObj(im,app.A)))
  const f=app.A.fields.find(x=>x.id===selId), im=app.A.images.find(x=>x.id===selId)
  app.sel.type=f?'field':im?'image':null
  app.sel.id=(f||im)?selId:null
  restoring=false; clearTimeout(histTimer)
}

export function undo(){
  if(restoring||!app.A) return
  snapshotNow()                       // flush a mid-debounce edit so Ctrl+Z right after typing undoes the typing
  if(!hist.undo.length) return
  hist.redo.push(hist.present); hist.present=hist.undo.pop(); restoreState(hist.present.s)
}

export function redo(){
  if(restoring||!app.A||!hist.redo.length) return
  hist.undo.push(hist.present); hist.present=hist.redo.pop(); restoreState(hist.present.s)
}

// Jump to an absolute position in the timeline (index into the panel list;
// hist.undo.length is "now"). A pending debounced edit is flushed first — if
// that flush truncates the redo side, the walk simply stops at the newest state.
export function jumpTo(i){
  if(restoring||!app.A||!hist.present) return
  snapshotNow()
  if(i===hist.undo.length) return
  while(hist.undo.length>i){ hist.redo.push(hist.present); hist.present=hist.undo.pop() }
  while(hist.undo.length<i&&hist.redo.length){ hist.undo.push(hist.present); hist.present=hist.redo.pop() }
  restoreState(hist.present.s)
}

export function clearHistory(){ hist.undo=[]; hist.redo=[] }
