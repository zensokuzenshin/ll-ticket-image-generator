/* Dev-server-only endpoint behind the preset panel's "Save to <file>" button
   (src/lib/actions.js → saveToSource). POST /__save-preset {file, json}
   overwrites the file the loaded preset came from under public/presets/, so a
   built-in can be edited in the app instead of downloading a copy and moving it
   into place by hand.

   apply:'serve' — this never reaches a build, matching the client half, which
   is behind import.meta.env.DEV: the shipped app has no backend and never
   gains a writer. Keep the plugin first in vite.config.js so the route is
   claimed before the cloudflare plugin starts handling requests.

   `file` comes from presets/index.json (which the client trusts), but it still
   arrives over HTTP, so it is only ever resolved inside public/presets/ and
   must already exist — the endpoint overwrites presets, it never creates
   files. Preset JSON is written the way the hand-written files are: two-space
   indent, trailing newline. Nothing here reloads the page: public/ files are
   not modules, so vite's watcher has no update to send and the app keeps its
   editing state and undo history. */

import { stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROUTE='/__save-preset'
const LIMIT=8<<20            // 8 MB — presets can carry an inlined data: image

function readBody(req){
  return new Promise((resolve,reject)=>{
    let n=0
    const parts=[]
    req.on('data',c=>{
      n+=c.length
      if(n>LIMIT){ reject(new Error('body too large')); req.destroy(); return }
      parts.push(c)
    })
    req.on('end',()=>resolve(Buffer.concat(parts).toString('utf8')))
    req.on('error',reject)
  })
}

export function devSavePreset(){
  let dir, logger
  return {
    name: 'dev-save-preset',
    apply: 'serve',
    configureServer(server){
      dir=path.resolve(server.config.publicDir||path.resolve(server.config.root,'public'),'presets')
      logger=server.config.logger
      server.middlewares.use(ROUTE, async (req,res,next)=>{
        if(req.method!=='POST') return next()
        const send=(code,body)=>{
          res.statusCode=code
          res.setHeader('content-type','application/json')
          res.end(JSON.stringify(body))
        }
        try{
          const text=await readBody(req)
          let payload
          try{ payload=JSON.parse(text) }catch{ return send(400,{error:'body is not JSON'}) }
          const {file,json}=payload
          if(typeof file!=='string'||!file) return send(400,{error:'no file given'})
          if(!json||typeof json!=='object'||Array.isArray(json)) return send(400,{error:'no template given'})

          const abs=path.resolve(dir,file)
          if(abs!==path.normalize(abs)||!abs.startsWith(dir+path.sep)||!abs.endsWith('.json'))
            return send(400,{error:'not a path under presets/'})
          if(!await stat(abs).then(s=>s.isFile(),()=>false))
            return send(404,{error:file+' is not an existing preset file'})

          await writeFile(abs,JSON.stringify(json,null,2)+'\n')
          logger.info(`  preset saved  presets/${file}`,{timestamp:true})
          send(200,{ok:true,file})
        }catch(e){
          logger.error(`  preset save failed: ${e.message}`,{timestamp:true})
          send(500,{error:e.message})
        }
      })
    },
  }
}
