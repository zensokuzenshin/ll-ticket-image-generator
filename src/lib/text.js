/* Text helpers: CJK tokenisation, kinsoku line-breaking, letter-spaced
   measurement/drawing. All measurement goes through the passed 2D context,
   whose font must already be set by the caller. */

export function isCJK(ch){
  const c=ch.codePointAt(0)
  return (c>=0x2E80&&c<=0x303F)||(c>=0x3040&&c<=0x30FF)||(c>=0x3400&&c<=0x4DBF)||
         (c>=0x4E00&&c<=0x9FFF)||(c>=0xF900&&c<=0xFAFF)||(c>=0xFF00&&c<=0xFFEF)||
         (c>=0x20000&&c<=0x2FA1F)
}

export function tokenize(text){
  const toks=[]; let buf=''
  for(const ch of text){
    if(isCJK(ch)){ if(buf){toks.push(buf);buf=''} toks.push(ch) }
    else if(ch===' '){ if(buf){toks.push(buf);buf=''} toks.push(' ') }
    else buf+=ch
  }
  if(buf) toks.push(buf)
  return toks
}

// Kinsoku: chars that may not BEGIN a line (closing brackets, small kana,
// punctuation, prolong mark) / may not END a line (opening brackets).
const NO_START=new Set([...')]｝〕〉》」』】〙〗）］｝、。，．・ー〜～？！?!:;…‥。、,.ヽヾゝゞ々ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ'])
const NO_END=new Set([...'([｛〔〈《「『【〘〖（［｛'])
const lastCh=s=>{ const a=[...s]; return a[a.length-1]||'' }

export function wrapLine(ctx,text,maxW){
  const toks=tokenize(text); const lines=[]; let cur=''
  for(const t of toks){
    const test=cur+t
    if(cur && ctx.measureText(test).width>maxW){
      // don't start a new line with a no-start char: keep it on this line (allow slight overflow)
      if(t.length===1 && NO_START.has(t)){ cur=test; continue }
      // don't end a line with a no-end char: carry it down to the next line
      let carry=''
      while(cur.length>1 && NO_END.has(lastCh(cur))){ const a=[...cur]; carry=a.pop()+carry; cur=a.join('') }
      lines.push(cur); cur=carry+((t===' ')?'':t)
    } else cur=test
  }
  lines.push(cur)
  return lines
}

export function drawTextLine(ctx,text,x,baseline,ls){
  if(!ls){ ctx.fillText(text,x,baseline); return }
  let cx=x
  for(const ch of text){ ctx.fillText(ch,cx,baseline); cx+=ctx.measureText(ch).width+ls }
}

export function lineWidth(ctx,text,ls){
  if(!ls) return ctx.measureText(text).width
  let w=0; for(const ch of text) w+=ctx.measureText(ch).width+ls; return Math.max(0,w-ls)
}

export function toFullWidth(s){
  return String(s).replace(/[!-~]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xFEE0)).replace(/ /g,'　')
}
