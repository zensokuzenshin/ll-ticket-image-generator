/* Pure Canvas-2D renderer. Output is locked to CW×CH; vertical placement is
   self-calibrating (measureText ink ascent), so a line's visible top lands on
   its target Y regardless of the actual font's metrics.

   Bounding boxes are stored in a side map (id → rect) rather than on the
   reactive objects: they are a by-product of drawing, and writing them into
   $state from inside the render effect would retrigger it. */
import { CW, CH } from './constants.js'
import { wrapLine, drawTextLine, lineWidth } from './text.js'

const bboxes=new Map()
export const getBbox=o=>o?bboxes.get(o.id):null

function layoutField(ctx,A,f){
  ctx.font=`${f.weight} ${f.size}px ${A._stack}`
  const maxW=CW-f.x-A.marR
  let lines=[]
  for(const p of String(f.text).split('\n')){
    lines = f.wrap ? lines.concat(wrapLine(ctx,p,maxW)) : lines.concat([p])
  }
  return lines
}

function drawField(ctx,A,f){
  const maxW=CW-f.x-A.marR
  let size=f.size, lh=f.lh, lines
  ctx.font=`${f.weight} ${size}px ${A._stack}`
  if(f.shrink){
    // keep one line per paragraph; scale the font down so the widest fits maxW
    lines=String(f.text).split('\n')
    let widest=0; for(const ln of lines) widest=Math.max(widest,lineWidth(ctx,ln,f.ls))
    if(widest>maxW && widest>0){ const k=maxW/widest; size=Math.max(8,Math.floor(size*k)); lh=Math.round(lh*k); ctx.font=`${f.weight} ${size}px ${A._stack}` }
  } else {
    lines=layoutField(ctx,A,f)
  }
  ctx.fillStyle=f.color; ctx.textAlign='left'; ctx.textBaseline='alphabetic'
  let baseline=0,maxLW=0,top=f.y,bottom=f.y
  lines.forEach((ln,i)=>{
    const m=ctx.measureText(ln||' ')
    const asc=m.actualBoundingBoxAscent||size*0.78
    const dsc=m.actualBoundingBoxDescent||size*0.2
    if(i===0){ baseline=f.y+asc; top=f.y } else baseline+=lh
    drawTextLine(ctx,ln,f.x,baseline,f.ls)
    bottom=baseline+dsc; maxLW=Math.max(maxLW,lineWidth(ctx,ln,f.ls))
  })
  bboxes.set(f.id,{x:f.x,y:top,w:Math.max(maxLW,8),h:Math.max(bottom-top,size*0.6)})
}

function drawImageObj(ctx,im){
  if(!im._img){ bboxes.delete(im.id); return }
  try{ ctx.drawImage(im._img,im.x,im.y,im.w,im.h) }catch(e){}
  bboxes.set(im.id,{x:im.x,y:im.y,w:im.w,h:im.h})
}

/**
 * Draw the full frame. opts:
 *   zoom, selId          — selection box for this item (null → none)
 *   showBoxes            — draw every item's exact bounding box
 *   showGuideLines       — draw guides (suppressed when embed/exporting)
 *   guideDrag, snapHit   — hot guides highlighted magenta
 *   embed, exporting
 */
export function renderCanvas(ctx,A,opts){
  if(!A) return
  const {zoom=1,selId=null,showBoxes=false,showGuideLines=false,guideDrag=null,snapHit=null,embed=false,exporting=false}=opts
  ctx.clearRect(0,0,CW,CH)
  ctx.fillStyle=A.bg; ctx.fillRect(0,0,CW,CH)
  for(const im of A.images) drawImageObj(ctx,im)
  for(const f of A.fields) drawField(ctx,A,f)
  if(exporting) return
  // exact bounding box — edges coincide with the snap targets, so a snapped box sits flush on the guide
  const drawBox=(b,on)=>{ if(!b)return; ctx.strokeStyle=on?'#4d9aff':'rgba(120,160,220,.5)'; ctx.lineWidth=on?Math.max(4,4/zoom):Math.max(2,2/zoom); ctx.strokeRect(b.x,b.y,b.w,b.h) }
  if(showBoxes){ for(const im of A.images) drawBox(bboxes.get(im.id),im.id===selId); for(const f of A.fields) drawBox(bboxes.get(f.id),f.id===selId) }
  else if(selId) drawBox(bboxes.get(selId),true)
  if(!embed && showGuideLines && A.guides.length){
    const lw=Math.max(2,2/zoom)
    for(const g of A.guides){
      const hot=g===guideDrag||(snapHit&&(snapHit.x===g||snapHit.y===g))
      ctx.strokeStyle=hot?'#ff33cc':'#00c8ff'; ctx.lineWidth=hot?lw*1.8:lw
      ctx.beginPath()
      if(g.axis==='x'){ ctx.moveTo(g.pos+.5,0); ctx.lineTo(g.pos+.5,CH) }
      else            { ctx.moveTo(0,g.pos+.5); ctx.lineTo(CW,g.pos+.5) }
      ctx.stroke()
      if(g===guideDrag){ ctx.fillStyle='#ff33cc'; ctx.font=`bold ${Math.max(30,30/zoom)}px monospace`
        if(g.axis==='x') ctx.fillText('X '+g.pos, Math.min(g.pos+12,CW-220), 64)
        else             ctx.fillText('Y '+g.pos, 20, Math.max(g.pos-14,40)) }
    }
  }
}

/** Topmost item under the point: fields above images, later array items on top. */
export function hitTest(A,pt){
  for(let i=A.fields.length-1;i>=0;i--){ const b=bboxes.get(A.fields[i].id); if(b&&pt.x>=b.x-10&&pt.x<=b.x+b.w+10&&pt.y>=b.y-10&&pt.y<=b.y+b.h+10) return ['field',A.fields[i]] }
  for(let i=A.images.length-1;i>=0;i--){ const b=bboxes.get(A.images[i].id); if(b&&pt.x>=b.x&&pt.x<=b.x+b.w&&pt.y>=b.y&&pt.y<=b.y+b.h) return ['image',A.images[i]] }
  return null
}
