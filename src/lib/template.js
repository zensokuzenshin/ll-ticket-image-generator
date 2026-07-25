/* Template load / normalise / (de)serialisation. A template is plain JSON
   (images[] + fields[] + guides[] + layout globals); normalize() fills every
   default so the rest of the app can assume complete objects. */
import { CW, CH } from './constants.js'
import { nid } from './state.svelte.js'
import { t } from './i18n.js'

export function buildStack(font){
  return font + ",'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic','Meiryo',system-ui,sans-serif"
}

// Items may carry `tag`, a semantic id (fld_show, img_logo…) that resolves the
// display label via t(tag); `name` is only for untagged (custom/renamed) items.
export function normalize(tpl){
  tpl.cw=Math.round(+tpl.cw)||CW; tpl.ch=Math.round(+tpl.ch)||CH
  tpl.marL=+tpl.marL||0; tpl.marR=+tpl.marR||0; tpl.bg=tpl.bg||'#ffffff'; tpl.font=tpl.font||"'Noto Sans JP'"
  tpl._stack=buildStack(tpl.font)
  tpl.images=(tpl.images||[]).map(im=>({id:im.id||nid(),tag:im.tag||'',name:im.name||'',src:im.src||'',
    x:+im.x||0,y:+im.y||0,w:+im.w||0,h:+im.h||0,fill:!!im.fill,_img:null,natW:0,natH:0}))
  tpl.fields=(tpl.fields||[]).map(f=>({id:f.id||nid(),tag:f.tag||'',key:f.key||'',name:f.name||'',
    text:f.text??'',x:+f.x||0,y:+f.y||0,size:+f.size||48,weight:+f.weight||700,
    color:f.color||'#000000',lh:+f.lh||Math.round((+f.size||48)*1.2),ls:+f.ls||0,
    wrap:f.wrap!==false,multiline:!!f.multiline,shrink:!!f.shrink,attr:!!f.attr}))
  tpl.attr = tpl.attr ? {top:+tpl.attr.top||0,labelGap:+tpl.attr.labelGap||0,pairGap:+tpl.attr.pairGap||0} : deriveAttr(tpl)
  tpl.guides=(tpl.guides||[]).map(g=>({id:g.id||nid(),axis:g.axis==='y'?'y':'x',pos:Math.round(+g.pos||0)}))
  return tpl
}

// Attribute-pair distribution: fields flagged attr:true are treated as an
// ordered run of (label,value) pairs and laid out with a uniform label→value
// gap and a uniform gap between pairs (value → next label).
export function deriveAttr(tpl){
  const st=(tpl.fields||[]).filter(f=>f.attr)
  if(st.length>=3) return {top:Math.round(st[0].y), labelGap:Math.round(st[1].y-st[0].y), pairGap:Math.round(st[2].y-st[1].y)}
  if(st.length===2) return {top:Math.round(st[0].y), labelGap:Math.round(st[1].y-st[0].y), pairGap:159}
  return {top:2443, labelGap:119, pairGap:159}
}

export function applyAttrLayout(A){
  if(!A||!A.attr) return
  const st=A.fields.filter(f=>f.attr)
  let y=A.attr.top
  for(let i=0;i+1<st.length;i+=2){ st[i].y=y; st[i+1].y=y+A.attr.labelGap; y=st[i+1].y+A.attr.pairGap }
  if(st.length%2===1) st[st.length-1].y=y
}

export function blankPreset(){
  return { name:t('newTicketName'), cw:CW, ch:CH, marL:155, marR:155, bg:'#ffffff', font:"'Noto Sans JP'", images:[],
    fields:[{ name:t('defNameFieldName'), text:t('defNamePlaceholder'), x:155, y:2852, size:120, weight:700, color:'#000000', lh:140, wrap:true, multiline:true }] }
}

/* Uploaded images are data: URLs, potentially megabytes each — inlining them
   into every history snapshot would duplicate them per edit and overflow
   localStorage when the session is persisted. serializeState() swaps any
   data: src for a stable `tigref:N` handle backed by this session-lifetime
   store; handles exist only inside snapshot strings (and the persisted
   session blob) — the working template always holds the real src. */
const srcList=[], srcMap=new Map()
function internSrc(src){
  if(!/^data:/i.test(src||'')) return src
  let r=srcMap.get(src)
  if(!r){ r='tigref:'+srcList.length; srcList.push(src); srcMap.set(src,r) }
  return r
}
export function resolveSrc(src){
  const m=/^tigref:(\d+)$/.exec(src||'')
  return m ? (srcList[+m[1]]||'') : src
}
/** Handles referenced by the given snapshot strings → {N: dataURL} table. */
export function collectSrcs(strings){
  const o={}
  for(const s of strings){ const re=/"tigref:(\d+)"/g; let m
    while((m=re.exec(s))) if(srcList[+m[1]]!=null) o[m[1]]=srcList[+m[1]] }
  return o
}
/** Refill the store from a persisted table (before its snapshots restore). */
export function seedSrcs(tbl){
  for(const k in tbl){ const i=+k
    if(Number.isInteger(i)&&i>=0&&typeof tbl[k]==='string'){ srcList[i]=tbl[k]; srcMap.set(tbl[k],'tigref:'+i) } }
}

/** Snapshot for undo history — includes ids (and tags) so selection and
    per-item identity survive restores. */
export function serializeState(A){
  if(!A) return null
  return JSON.stringify({name:A.name,cw:A.cw,ch:A.ch,marL:A.marL,marR:A.marR,bg:A.bg,font:A.font,attr:A.attr,
    guides:A.guides.map(g=>({axis:g.axis,pos:g.pos})),
    images:A.images.map(im=>({id:im.id,tag:im.tag,name:im.name,src:internSrc(im.src),x:im.x,y:im.y,w:im.w,h:im.h,fill:im.fill})),
    fields:A.fields.map(f=>({id:f.id,tag:f.tag,key:f.key,name:f.name,text:f.text,x:f.x,y:f.y,size:f.size,weight:f.weight,color:f.color,lh:f.lh,ls:f.ls,wrap:f.wrap,multiline:f.multiline,shrink:f.shrink,attr:f.attr}))})
}

/** Portable template JSON for download — no ids, display names resolved. */
export function templateJSON(A,dispName){
  return {name:A.name,cw:A.cw,ch:A.ch,marL:A.marL,marR:A.marR,bg:A.bg,font:A.font,attr:A.attr,
    guides:A.guides.map(g=>({axis:g.axis,pos:g.pos})),
    images:A.images.map(im=>({name:dispName(im),src:im.src,x:im.x,y:im.y,w:im.w,h:im.h,fill:im.fill})),
    fields:A.fields.map(f=>({key:f.key,name:dispName(f),text:f.text,x:f.x,y:f.y,size:f.size,weight:f.weight,color:f.color,lh:f.lh,ls:f.ls,wrap:f.wrap,multiline:f.multiline,shrink:f.shrink,attr:f.attr}))}
}

/* Built-in presets ship the personal fields (座席番号 / 氏名 values) empty;
   loadTemplate() fills them with this sample text for the user to overwrite.
   Keyed by tag, which templateJSON() strips on export — so user template
   files are never refilled. */
export const SAMPLE_TEXT = {
  fld_seatval: 'ときめき1号車　０１列　０１',
  fld_nameval: 'ＴＡＫＡＳＡＫＩ　ＹＵ',
}

// Default geometry for newly added items (measured from the hasu5th preset).
export const NEW_FIELD = ()=>({name:t('defNewFieldName'),text:t('defNewFieldText'),x:155,y:1591,size:80,weight:700,color:'#000000',lh:109,wrap:true})
export const NEW_LOGO  = ()=>({name:t('defLogoName'),x:0,y:136,w:1350})
export const NEW_BG    = (A)=>({name:t('defBgName'),x:0,y:0,w:A.cw,h:A.ch,fill:true})
