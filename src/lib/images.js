import { CW, CH } from './constants.js'

const IMG_CACHE=new Map()   // src → decoded Image; keeps undo/redo instant

/* Decode im.src into im._img (+ natural size, defaulting w/h when unset).
   Because templates are $state proxies, the natW/_img writes on load trigger
   a canvas re-render automatically. */
export function loadImageObj(im){
  return new Promise(res=>{
    if(!im.src){ im._img=null; return res() }
    const hit=IMG_CACHE.get(im.src)
    if(hit){ im._img=hit; im.natW=hit.naturalWidth; im.natH=hit.naturalHeight
      if(!im.w){ im.w=im.fill?CW:im.natW }
      if(!im.h){ im.h=im.fill?CH:Math.round(im.w*im.natH/im.natW) }
      return res() }
    const i=new Image()
    // URL-referenced logos: request with CORS so a (CORS-enabled or same-origin)
    // image can be drawn AND exported without tainting the canvas. Uploaded
    // images are data: URIs and never taint, so leave those alone.
    if(!/^data:/i.test(im.src)) i.crossOrigin='anonymous'
    i.onload=()=>{ IMG_CACHE.set(im.src,i); if(IMG_CACHE.size>24) IMG_CACHE.delete(IMG_CACHE.keys().next().value)
      im._img=i; im.natW=i.naturalWidth; im.natH=i.naturalHeight
      if(!im.w){ im.w=im.fill?CW:im.natW }
      if(!im.h){ im.h=im.fill?CH:Math.round(im.w*im.natH/im.natW) }
      res() }
    i.onerror=()=>{ im._img=null; res() }
    i.src=im.src
  })
}
