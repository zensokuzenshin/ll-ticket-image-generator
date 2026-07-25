const IMG_CACHE=new Map()   // src → decoded Image; keeps undo/redo instant

/* Decode im.src into im._img (+ natural size, defaulting w/h when unset —
   fill images default to the owning template A's canvas size). Because
   templates are $state proxies, the natW/_img writes on load trigger a canvas
   re-render automatically. */
export function loadImageObj(im,A){
  const defSize=()=>{
    if(!im.w){ im.w=im.fill?A.cw:im.natW }
    if(!im.h){ im.h=im.fill?A.ch:Math.round(im.w*im.natH/im.natW) }
  }
  return new Promise(res=>{
    if(!im.src){ im._img=null; return res() }
    const hit=IMG_CACHE.get(im.src)
    if(hit){ im._img=hit; im.natW=hit.naturalWidth; im.natH=hit.naturalHeight
      defSize()
      return res() }
    const i=new Image()
    // URL-referenced logos: request with CORS so a (CORS-enabled or same-origin)
    // image can be drawn AND exported without tainting the canvas. Uploaded
    // images are data: URIs and never taint, so leave those alone.
    if(!/^data:/i.test(im.src)) i.crossOrigin='anonymous'
    i.onload=()=>{ IMG_CACHE.set(im.src,i); if(IMG_CACHE.size>24) IMG_CACHE.delete(IMG_CACHE.keys().next().value)
      im._img=i; im.natW=i.naturalWidth; im.natH=i.naturalHeight
      defSize()
      res() }
    i.onerror=()=>{ im._img=null; res() }
    i.src=im.src
  })
}
