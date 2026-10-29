import { esc, logAct, mergeSettingsMap, popup, shared, toast } from "./core.js";
import { shortName, stockRows } from "./01-stock.js";
import { loadScript } from "./08-settings.js";
export let BC_FORMATS;
// הפריטים שאפשר להצמיד אליהם ברקוד: כתב הכמויות (קוד = סעיף) ואחריו פריטי המלאי (קוד = השם)
export function bcItems(){
  const out=[], seen=new Set();
  (shared.boq||[]).forEach(l=>{ const name=(l.name||"").trim(); if(!name||seen.has(name)) return; seen.add(name); out.push({code:String(l.code||name),no:l.supCode||"",name}); });
  stockRows().forEach(r=>{ if(!r.name||seen.has(r.name)) return; seen.add(r.name); out.push({code:r.name,no:"",name:r.name}); });
  return out;
}
export function matchBarcode(text){
  const t=String(text||"").trim(); if(!t) return null;
  const items=bcItems();
  if(shared.BARCODES[t]){ const k=items.find(x=>x.code===shared.BARCODES[t]); if(k) return k; }
  const norm=s=>String(s||"").replace(/\s+/g,"").toUpperCase();
  const T=norm(t);
  return items.find(x=>x.no&&norm(x.no)===T)||items.find(x=>x.no&&(T.includes(norm(x.no))||norm(x.no).includes(T)&&T.length>=6))||items.find(x=>norm(x.code)===T)||null;
}
export async function saveBarcode(text,code){
  shared.BARCODES[text]=code;
  try{ await mergeSettingsMap("barcodes",{[text]:code}); }catch(e){}
  logAct("settings","edit","ברקוד הוצמד לפריט: "+text+" → "+code,"settings/barcodes");
}
export function beep(){
  try{ const A=window.AudioContext||window.webkitAudioContext; if(!A) return; const ac=beep.ac||(beep.ac=new A()); const o=ac.createOscillator(), g=ac.createGain();
    o.frequency.value=1480; g.gain.value=0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.09); }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate(50); }catch(e){}
}
export function openBarcodeScanner(opts){
  opts=opts||{}; const mode=opts.mode||"count";
  const hits=new Map();   // text → {text,item,n,per}
  let det=null, zx=null, stream=null, loop=null, lastText="", lastAt=0, busy=false, live=false;
  const root=document.createElement("div"); root.className="scan"; root.setAttribute("role","dialog"); root.setAttribute("aria-modal","true"); root.setAttribute("aria-label","סריקת ברקודים");
  root.innerHTML='<div class="scan-top"><span id="bcTitle">סריקת ברקודים · '+(mode==="count"?"ספירת קרטונים":"קליטת קרטונים")+'</span><button type="button" id="bcClose" aria-label="סגור">✕</button></div>'
    +'<div class="scan-stage" id="bcStage" style="padding:0"><div class="bc-cam"><video id="bcVideo" playsinline autoplay muted></video><div class="bc-frame"></div><div class="bc-last" id="bcLast" hidden></div></div></div>'
    +'<div class="scan-bot" id="bcBot"></div><input type="file" accept="image/*" capture="environment" id="bcFile" hidden>';
  document.body.appendChild(root);
  const q=s=>root.querySelector(s); const video=q("#bcVideo");
  function close(){ stop(); document.removeEventListener("keydown",esck); root.remove(); }
  function esck(ev){ if(ev.key==="Escape") close(); }
  document.addEventListener("keydown",esck);
  q("#bcClose").onclick=()=>{ finish(); };
  function stop(){ if(loop){ clearInterval(loop); loop=null; } try{ if(zx) zx.reset(); }catch(e){} zx=null; if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } }
  function finish(){ const out=[...hits.values()]; close(); if(opts.onDone) opts.onDone(out); }
  function drawBot(){
    const list=[...hits.values()];
    q("#bcBot").innerHTML='<div class="hint3" id="bcHint">'+(live?"כוון את המצלמה לברקוד שעל האריזה או על התוף. כל סריקה = יחידה אחת.":"צלם ברקוד אחד, או כמה אריזות בתמונה אחת: כל ברקוד שמזוהה = יחידה. אם הברקוד לא נקרא, המק״ט המודפס נקרא מהתמונה.")+'</div>'
      +(list.length?'<div class="bc-list">'+list.map(h=>'<div class="bc-row" data-t="'+esc(h.text)+'"><div class="t"><b>'+esc(h.item?shortName(h.item.name):"לא מזוהה: "+h.text)+'</b><span>'+(h.item?'מק״ט '+esc(h.item.code)+' · '+esc(h.text):'<u data-assign="'+esc(h.text)+'">הצמד לפריט</u>')+(mode==="lines"?' · <input type="text" inputmode="numeric" data-per="'+esc(h.text)+'" value="'+esc(h.per||"")+'" placeholder="יח׳ בקרטון" style="width:92px;padding:5px 6px;font-size:.8rem;background:#222;color:#fff;border:1px solid #555">':'')+'</span></div>'
        +'<div class="n"><button type="button" data-dec="'+esc(h.text)+'" aria-label="פחות">−</button><b>'+h.n+'</b><button type="button" data-inc="'+esc(h.text)+'" aria-label="עוד">+</button></div></div>').join("")+'</div>':'')
      +'<div class="scan-row">'+(live?'':'<button class="ghost" type="button" id="bcShoot"><i class="ic ic-cam"></i>צלם ברקוד</button>')+'<button class="ghost" type="button" id="bcManual">הקלד מק״ט</button><button class="save" type="button" id="bcDone">סיום'+(list.length?' · '+list.reduce((s,h)=>s+h.n,0)+' יחידות':'')+'</button></div>';
    q("#bcDone").onclick=finish;
    const sh=q("#bcShoot"); if(sh) sh.onclick=()=>q("#bcFile").click();
    q("#bcManual").onclick=()=>manual();
    q("#bcBot").querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>{ hits.get(b.dataset.inc).n++; drawBot(); });
    q("#bcBot").querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>{ const h=hits.get(b.dataset.dec); h.n--; if(h.n<=0) hits.delete(b.dataset.dec); drawBot(); });
    q("#bcBot").querySelectorAll("[data-assign]").forEach(u=>u.onclick=()=>assign(u.dataset.assign));
    q("#bcBot").querySelectorAll("[data-per]").forEach(i=>i.oninput=e=>{ hits.get(i.dataset.per).per=e.target.value; });
  }
  function onDecode(text,count,force){
    text=String(text||"").trim(); if(!text) return;
    const now=Date.now(); if(!force&&text===lastText&&now-lastAt<2500){ return; } lastText=text; lastAt=now;
    beep();
    const item=matchBarcode(text);
    const h=hits.get(text)||{text,item,n:0,per:item&&Number(item.carton)>0?item.carton:""}; h.n+=Math.max(1,Number(count)||1); if(!h.item&&item) h.item=item; hits.set(text,h);
    const L=q("#bcLast"); if(L){ L.hidden=false; L.textContent=(item?shortName(item.name):"ברקוד לא מוכר: "+text)+" · "+h.n; clearTimeout(onDecode.t); onDecode.t=setTimeout(()=>{ L.hidden=true; },1800); }
    drawBot();
  }
  function assign(text){
    const scrim=popup('<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><h2>איזה פריט זה?</h2><div class="note-card">ברקוד: <b>'+esc(text)+'</b>. בחר פעם אחת, והאפליקציה תזכור.</div><div class="stock" id="asList">'
      +bcItems().map(k=>'<button type="button" class="slip" data-code="'+esc(k.code)+'"><b>'+esc(shortName(k.name))+'</b><span>מק״ט '+esc(k.code)+(k.no?' · '+esc(k.no):'')+'</span></button>').join("")+'</div>'
      +'<div class="acts"><button class="cancel" type="button" style="flex:1">ביטול</button></div></div>',{z:80});
    scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
    scrim.querySelector("#asList").onclick=async e=>{ const b=e.target.closest("[data-code]"); if(!b) return; const k=bcItems().find(x=>x.code===b.dataset.code); if(!k) return;
      await saveBarcode(text,k.code); const h=hits.get(text); if(h){ h.item=k; if(!h.per&&Number(k.carton)>0) h.per=k.carton; } scrim.remove(); drawBot(); toast("נשמר: "+shortName(k.name)); };
  }
  function manual(){
    const scrim=popup('<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><h2>הוסף פריט ידנית</h2><div class="stock" id="mnList">'
      +bcItems().map(k=>'<button type="button" class="slip" data-code="'+esc(k.code)+'"><b>'+esc(shortName(k.name))+'</b><span>מק״ט '+esc(k.code)+'</span></button>').join("")+'</div>'
      +'<div class="acts"><button class="cancel" type="button" style="flex:1">ביטול</button></div></div>',{z:80});
    scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
    scrim.querySelector("#mnList").onclick=e=>{ const b=e.target.closest("[data-code]"); if(!b) return; const k=bcItems().find(x=>x.code===b.dataset.code); if(!k) return;
      const key="manual:"+k.code; const h=hits.get(key)||{text:key,item:k,n:0,per:Number(k.carton)>0?k.carton:""}; h.n++; hits.set(key,h); scrim.remove(); drawBot(); };
  }
  async function decodeBlob(blob){
    let txt=null;
    try{ if(det){ const bmp=await createImageBitmap(blob); const r=await det.detect(bmp);
      if(r&&r.length){ const cnt=new Map(); r.forEach(x=>{ const v=String(x.rawValue||"").trim(); if(v) cnt.set(v,(cnt.get(v)||0)+1); });
        if(cnt.size){ cnt.forEach((n,v)=>onDecode(v,n,true)); if(r.length>1) toast("זוהו "+r.length+" ברקודים בתמונה."); return; } } } }catch(e){}
    if(!txt){ try{ if(!window.ZXing) await loadScript("https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js");
      const hints=new Map(); hints.set(ZXing.DecodeHintType.TRY_HARDER,true); const rd=new ZXing.BrowserMultiFormatReader(hints); const u=URL.createObjectURL(blob);
      try{ const r=await rd.decodeFromImageUrl(u); txt=r&&r.getText?r.getText():null; }catch(e){} URL.revokeObjectURL(u); }catch(e){} }
    if(!txt&&shared.SAMPLE){ try{ const out=await shared.SAMPLE.json('בתמונה מדבקה של אריזה או תוף כבל באתר חשמל. החזר רק JSON: {"itemNo":"<מספר הפריט / מק״ט / מספר התוף המודפס ליד הברקוד, או null>","qty":<כמות בקרטון אם מודפסת, מספר, או null>}. אל תמציא.',{images:blob,modelTier:"quick"});
      if(out&&out.itemNo){ txt=String(out.itemNo); if(out.qty&&!hits.has(txt)){ const k=matchBarcode(txt); if(k&&!Number(k.carton)) hits.set(txt,{text:txt,item:k,n:0,per:Number(out.qty)||""}); } } }catch(e){} }
    if(txt) onDecode(txt,1,true); else toast("לא זוהה ברקוד בתמונה. נסה קרוב יותר, או הקלד מק״ט.");
  }
  q("#bcFile").onchange=e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=""; if(f) decodeBlob(f); };
  async function start(){
    try{ if(window.BarcodeDetector){ const sup=await BarcodeDetector.getSupportedFormats().catch(()=>[]); const fm=BC_FORMATS.filter(f=>sup.includes(f)); det=new BarcodeDetector(fm.length?{formats:fm}:undefined); } }catch(e){ det=null; }
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
      video.srcObject=stream; await video.play().catch(()=>{}); live=true;
    }catch(e){ live=false; }
    if(live){
      if(det){ loop=setInterval(async()=>{ if(busy||video.readyState<2) return; busy=true; try{ const r=await det.detect(video); if(r&&r.length) onDecode(r[0].rawValue); }catch(e){} busy=false; },180); }
      else { try{ if(!window.ZXing) await loadScript("https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js");
          const hints=new Map(); hints.set(ZXing.DecodeHintType.TRY_HARDER,true); zx=new ZXing.BrowserMultiFormatReader(hints,250);
          await zx.decodeFromStream(stream,video,(res)=>{ if(res&&res.getText) onDecode(res.getText()); }); }
        catch(e){ live=false; stop(); } }
    }
    if(!live){ q("#bcStage").innerHTML='<div class="scan-pick"><label><i class="ic ic-scan big"></i>צלם ברקוד<input type="file" accept="image/*" capture="environment"></label><label><i class="ic ic-gal big"></i>מהגלריה<input type="file" accept="image/*" multiple></label><div class="hint3" style="grid-column:1/3">צילום של מדבקת הקרטון, או של כמה קרטונים יחד. הברקוד, או המק״ט המודפס לידו, נקרא מהתמונה.</div></div>';
      const ins=q("#bcStage").querySelectorAll("input"); ins[0].onchange=q("#bcFile").onchange; ins[1].onchange=async e=>{ const fs=[...e.target.files]; e.target.value=""; for(const f of fs) await decodeBlob(f); }; }
    drawBot();
  }
  start();
  return {close,decode:onDecode};
}
export function __init(){
/* ================= סורק ברקודים: מק״טים על אריזות ותוויות תופים ================= */
shared.BARCODES={};
   // ברקוד → קוד פריט (סעיף בכתב הכמויות או שם פריט במלאי), נלמד
BC_FORMATS = ["code_128","code_39","ean_13","ean_8","upc_a","upc_e","itf","codabar","qr_code","data_matrix","pdf417","aztec"];
}
