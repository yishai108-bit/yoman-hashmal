import { $, ask, csvParse, esc, fmtDT, logAct, ls, mergeSettingsMap, popup, shared, toast, unitMult } from "./core.js";
import { CATLIST, CATS, catGuess, catId, fmtN, shortSup } from "./01-stock.js";
import { loadScript } from "./08-settings.js";
import { ROLE } from "./18-identity.js";
import { BOQ_CABLES_TEMPLATE_CSV } from "./activities-template.js";
export let supNorm, boqName, sameItem, normName, supKey, supMatch, aliasKey, aliasTimer, aliasPending;
/* הקטלוג: לכל פריט בכתב הכמויות — תוכנן (כתב כמויות) מול הגיע (תעודות משלוח מקושרות). */
export function catalog(){
  const m=new Map(), byCode=new Map();
  const get=(k)=>{ let e=m.get(k); if(!e){ e={name:k,code:"",codes:[],sku:"",unit:"",cat:"",group:"",planned:0,arrived:0,sups:new Map(),src:[]}; m.set(k,e); } return e; };
  shared.boq.forEach(l=>{ const k=(l.name||"").trim(); if(!k) return; const e=get(k); e.planned+=Number(l.qty)||0;
    if(l.code){ const c=String(l.code); if(!e.code) e.code=c; if(!e.codes.includes(c)) e.codes.push(c); byCode.set(c,e); }
    if(l.sku&&!e.sku) e.sku=String(l.sku); if(l.unit&&!e.unit) e.unit=l.unit; if(l.cat) e.cat=l.cat; if(l.group&&!e.group) e.group=String(l.group);
    if(l.supplier) e.sups.set(supNorm(l.supplier),(e.sups.get(supNorm(l.supplier))||0)+2);
    if(!e.src.includes("boq")) e.src.push("boq"); });
  (shared.demoStock?[]:shared.deliveries).forEach(n=>(n.lines||[]).forEach(l=>{ const k=(l.name||"").trim(); if(!k) return;
    const e=(l.boq&&byCode.get(String(l.boq)))||get(k);
    e.arrived+=(Number(l.qty)||0)*unitMult(l.unit); const sp=supNorm(n.supplier); if(sp) e.sups.set(sp,(e.sups.get(sp)||0)+1);
    if(l.unit&&!e.unit) e.unit=l.unit; if(l.cat&&!e.cat) e.cat=l.cat; }));
  return [...m.values()].map(e=>{
    e.supplier=shared.SUPPLIERS[e.name]||([...e.sups.entries()].sort((a,b)=>b[1]-a[1])[0]||[])[0]||"";
    e.unit=e.unit||"יח'"; e.cat=catId(e.cat,e.name); e.arrived=Math.max(0,e.arrived);
    e.remaining=Math.max(0,e.planned-e.arrived);
    return e;
  }).sort((a,b)=>a.name.localeCompare(b.name,"he"));
}
/* לשונית כתב כמויות: תוכנן מול הגיע, לפי קטגוריה */
export function renderBoq(){
  const box=$("#boqList"); if(!box) return;
  const sum=$("#boqSum"), q=(($("#boqQ")||{}).value||"").trim().toLowerCase();
  const all=catalog().filter(e=>e.planned>0);
  const bb=$("#boqBig"), tp=all.reduce((t,e)=>t+Math.min(1,e.planned?e.arrived/e.planned:0),0); if(bb){ bb.textContent=all.length?Math.round(tp/all.length*100)+"%":"—"; bb.style.color=all.length?"var(--info)":"var(--line)"; }   // בלי כתב כמויות: קו אפור, לא פס כחול שנראה כמו תקלה
  if(sum) sum.innerHTML=all.length?'<span>פריטים <b>'+fmtN(all.length)+'</b></span><span>הגיעו במלואם <b>'+fmtN(all.filter(e=>e.arrived>=e.planned).length)+'</b></span><span>חסרים <b>'+fmtN(all.filter(e=>e.arrived<e.planned).length)+'</b></span>':"";
  const rows=all.filter(e=>!q||(e.name+" "+e.codes.join(" ")+" "+e.supplier).toLowerCase().includes(q));
  if(!all.length){ box.innerHTML='<div class="empty">עוד אין כתב כמויות. מייבאים קובץ אקסל או CSV, ומאז כל תעודת משלוח מתקשרת לסעיף שלה ורואים מה הגיע ומה חסר.</div>'; return; }
  if(!rows.length){ box.innerHTML='<div class="empty">אין פריט שמתאים לחיפוש.</div>'; return; }
  const groups=new Map(); rows.forEach(e=>{ const g=e.group||((CATS.find(c=>c.id===e.cat)||{}).label)||"אחר"; if(!groups.has(g)) groups.set(g,[]); groups.get(g).push(e); });
  box.innerHTML=[...groups.entries()].map(([g,list])=>'<div class="boqgrp"><h3>'+esc(g)+' <small>'+list.length+'</small></h3>'
    +list.map(e=>{ const pct=e.planned?Math.min(100,Math.round(e.arrived/e.planned*100)):0, done=e.arrived>=e.planned;
      return '<div class="boqrow'+(done?' done':'')+'"><div class="bn"><b>'+esc(e.name)+'</b>'+(e.code?' <small>'+esc(e.code)+'</small>':'')+(e.supplier?'<small> · '+esc(e.supplier)+'</small>':'')+'</div>'
        +'<div class="bq"><span>'+fmtN(e.arrived)+' / '+fmtN(e.planned)+' '+esc(e.unit)+'</span><div class="bar"><i style="width:'+pct+'%"></i></div></div></div>'; }).join("")+'</div>').join("");
}
export async function saveBoq(lines,source){
  const doc={lines:lines.map(l=>{ const o={name:String(l.name).trim(),code:l.code?String(l.code):"",qty:Number(l.qty)||0,unit:l.unit||"יח'",cat:catId(l.cat,l.name),supplier:l.supplier||""};
      ["en","po","sku","group","note"].forEach(k=>{ if(l[k]) o[k]=String(l[k]); }); if(Number(l.poQty)) o.poQty=Number(l.poQty); if(l.received!=null&&isFinite(Number(l.received))) o.received=Number(l.received); return o; }),source:source||shared.boqSource,ts:Date.now()};
  if(shared.DB) await shared.DB.doc("settings/boq").set(doc); else { shared.boq=doc.lines; shared.boqSource=doc.source; ls.set("boq",JSON.stringify(doc)); }
  logAct("settings","edit","כתב כמויות עודכן · "+doc.lines.length+" פריטים · "+doc.source,"settings/boq");
}
/* קריאה דטרמיניסטית של EBOQ (גיליון הרכש של חשמל): Item Number · Material Short Text (אנגלית) · 2nd Language (עברית) · תיאור · Unit · Note (=כמות נדרשת) · Quantity PO · ספק · מס הזמנה · מק״ט ספק · הערה.
   rows = שורות הגיליון כטקסט מעוצב (SheetJS header:1, raw:false). מחזיר null אם זה לא המבנה הזה. */
export function parseEboq(rows){
  const clean=v=>String(v==null?"":v).replace(/\s+/g," ").trim();
  const num=v=>{ const mm=clean(v).replace(/,/g,"").match(/-?\d+(?:\.\d+)?/); return mm?Number(mm[0]):0; };
  const HEB=/[֐-׿]/, GENERIC=["סט","הארקה","כבל","צינור","קופסא","שרוול"];
  const hi=rows.findIndex(r=>(r||[]).some(c=>/item number/i.test(clean(c)))); if(hi<0) return null;
  const H=rows[hi].map(c=>clean(c).toLowerCase());
  const col=(...names)=>{ for(const n of names){ const i=H.indexOf(n.toLowerCase()); if(i>=0) return i; } for(const n of names){ const i=H.findIndex(h=>h.includes(n.toLowerCase())); if(i>=0) return i; } return -1; };
  const cI=col("item number"), cEn=col("material short text"), cHe=col("material short text (2nd language)"), cDesc=col("תיאור"), cCalc=col("הערת חישוב"),
        cUnit=col("unit"), cNote=col("note"), cPo=col("quantity po"), cSup=col("ספק"), cPoNo=col("מס הזמנה"), cSku=cPoNo>=0?cPoNo+1:-1, cRem=cPoNo>=0?cPoNo+2:-1;
  if(cHe<0&&cEn<0||cSup<0) return null;
  const lines=[]; let section="", prev=null, last="";
  const codeOf=s=>{ s=clean(s); if(!s) return ["",false]; if(/^\d+$/.test(s)) return [s,true]; let mm=s.match(/^(\d+)\.(\d+)$/); if(!mm) return [s,false];
    if(mm[2].length>2){ s=Number(s).toFixed(2).replace(/0$/,""); mm=s.match(/^(\d+)\.(\d+)$/); }
    if(mm[2].length===2) return [s,false];                                   // "6.70" כפי שמעוצב בגיליון
    const one=mm[1]+"."+mm[2], two=mm[1]+"."+mm[2]+"0";                       // "6.7": 6.7 או 6.70 — לפי הסדר בסעיף
    const gt=c=>{ const k=c.split(".").map(Number); return !prev||k[0]>prev[0]||(k[0]===prev[0]&&k[1]>prev[1]); };
    return [gt(one)?one:two,false]; };
  for(let ri=hi+1;ri<rows.length;ri++){
    const r=rows[ri]||[]; const v=i=>i>=0&&i<r.length?r[i]:"";
    const en=clean(v(cEn)), he=clean(v(cHe)); let desc=clean(v(cDesc)); const calc=clean(v(cCalc));
    if(!(he||en)) continue;
    let [code,isSec]=codeOf(v(cI));
    if(isSec){ section=en||he; prev=null; continue; }
    let unit=clean(v(cUnit)), qty=num(v(cNote)), sup=clean(v(cSup)), po=clean(v(cPoNo)), sku=clean(v(cSku)), rem=clean(v(cRem));
    const poRaw=clean(v(cPo)); let poQty=HEB.test(poRaw)?0:num(poRaw);
    if(!qty&&/^\d+(\.\d+)?$/.test(desc)){ qty=num(desc); desc=""; }                 // שורות שנוספו ידנית: הכמות בעמודת התיאור
    if(!po){ const c=r.map(clean).find(s=>/^PO\d{6,}$/.test(s)); if(c) po=c; }
    if(code){ const mm=code.match(/^(\d+)\.(\d+)$/); if(mm) prev=[+mm[1],+mm[2]]; last=code; }
    else { const base=last||"0.0"; let n=0; do{ n++; code=base+"abcdefghij"[n-1]; }while(lines.some(l=>l.code===code)&&n<10); }
    if(sup==="-") sup=""; if(po==="-") po=""; if(sku==="-") sku="";
    const um={m:"מטר","מ'":"מטר",pcs:"יח'","יח":"יח'",set:"סט",kg:"ק\"ג","-":""}; unit=unit?(um[unit.toLowerCase()]!==undefined?um[unit.toLowerCase()]:unit):"";
    if(!unit) unit=/cable|כבל|wire|גיד|conduit|צינור|קוברה|יק|n2xy|na2x|fiber|סיב/i.test(he+" "+en)?"מטר":"יח'";
    const cat=/fire|כיבוי|בטיחות|ציוד מגן/i.test(section+" "+he)?"consumables":catGuess(he+" "+en);
    let name=he&&HEB.test(he)?he:en&&HEB.test(en)?en:he&&en?he+" · "+en:(he||en);
    if(name.length<=5||GENERIC.includes(name)){ if(en&&en!==name) name+=" · "+en; if(desc&&desc.length<=14){ name+=" · "+desc; desc=""; } }
    const rm=rem.match(/(\d[\d,\.]*)\s*מתוך\s*(\d[\d,\.]*)/); const received=rm?num(rm[1]):null;
    lines.push({name,en,code,qty,unit,cat,supplier:sup,po,poQty:poQty||(po?qty:0),sku,group:section,note:[desc,calc,rem].filter(Boolean).join(" · "),received});
  }
  return lines.length?{lines}:null;
}
export function learnAlias(sup,name,code){ const k=aliasKey(sup,name); if(!normName(name)||shared.ALIASES[k]===code) return; shared.ALIASES[k]=code; aliasPending[k]=code;
  clearTimeout(aliasTimer); aliasTimer=setTimeout(async()=>{ const p=aliasPending; aliasPending={}; try{ await mergeSettingsMap("aliases",p); }catch(e){} },1500); }
export async function mapLinesToBoq(supplier,lines){
  const res={n:0,err:""}; if(!shared.boq.length||!lines||!lines.length) return res;
  const codes=new Set(shared.boq.map(l=>String(l.code)));
  const byName=new Map(shared.boq.map(l=>[normName(l.name),String(l.code)])), skus=shared.boq.filter(l=>l.sku&&String(l.sku).length>=5).map(l=>[String(l.sku).toLowerCase(),String(l.code)]);
  const todo=[];
  lines.forEach((l,i)=>{ if(l.boq) return; const k=normName(l.name); if(!k) return;
    const al=shared.ALIASES[aliasKey(supplier,l.name)]; if(al&&codes.has(al)){ l.boq=al; l.boqConf="alias"; res.n++; return; }
    if(byName.has(k)){ l.boq=byName.get(k); l.boqConf="sure"; res.n++; return; }
    const sk=skus.find(([x])=>k.includes(x)); if(sk){ l.boq=sk[1]; l.boqConf="sure"; res.n++; return; }
    todo.push(i); });
  if(!todo.length) return res;
  if(!shared.SAMPLE){ res.err="no-ai"; return res; }
  const sp=shortSup(supplier||"");
  const mine=shared.boq.filter(l=>l.code&&supMatch(supplier,l.supplier)), rest=shared.boq.filter(l=>l.code&&!mine.includes(l));
  const row=(l,star)=>(star?"* ":"")+l.code+" | "+l.name+((l.en&&l.en!==l.name)?" | "+l.en:"")+" | "+(l.unit||"")+(l.sku?" | מק״ט ספק "+l.sku:"")+" | "+(l.supplier||"-");
  const cands=[...mine.map(l=>row(l,true)),...rest.map(l=>row(l,false))];
  try{
    const out=await shared.SAMPLE.json("אתה מקשר שורות מתעודת משלוח של אתר סולארי לפריטים בכתב הכמויות של החשמל (EBOQ).\n"
      +"חשוב: השמות בתעודה הם שמות הקטלוג של הספק והם שונים מאוד מהשמות בכתב הכמויות (שמות המתכנן, לפעמים באנגלית). התאם לפי מהות המוצר: סוג (כבל / גיד / נעל כבל / בורג / דיסקית / אום / עוגן / שקע / מפסק / גוף תאורה / צינור / קוברה / יק״ע / שוחה / סיב אופטי…), חתך או מידה (3x2.5, 1x16, M10, M12x40, קוטר 50/75), חומר (נחושת, אלומיניום, נירוסטה A2, פלדה מגולוונת), צבע/תת-סוג (צהוב-ירוק, שטוחה/קפיץ/חורצת, עם פטמות/בלי). מותג, אריזה (מארז של 100, תוף, חבילה), יחידה (אלף/מטר/יח׳) וניסוח לא משנים. רמזים: D933=בורג משושה, D125/D9021=דיסקית שטוחה, D127=דיסקית קפיץ, D6798=דיסקית חורצת/כוכב, NYAF/H07V=גיד PVC, N2XY=כבל נחושת, NA2XY=כבל אלומיניום, צ'י=צהוב ירוק, קדח 10.5=חור M10.\n\n"
      +"פריטי ה-EBOQ (קוד | שם | שם באנגלית | יחידה | מק״ט ספק | ספק). שורות עם * הן של הספק של התעודה — עדיפות להן, אבל אותו מוצר יכול להופיע גם אצל ספק אחר:\n"+cands.join("\n")
      +"\n\nשורות התעודה"+(sp?" (ספק: "+sp+")":"")+" בפורמט אינדקס | שם | כמות:\n"+todo.map(i=>i+" | "+lines[i].name+" | "+(lines[i].qty||"")+" "+(lines[i].unit||"")).join("\n")
      +'\n\nלכל שורת תעודה החזר את קוד פריט ה-EBOQ המתאים ורמת ביטחון: "sure" כשזה בבירור אותו מוצר, "likely" כשזה כנראה אותו פריט (למשל גמיש מול קשיח, דגם אחר של אותו מוצר, מידה קרובה שהוזמנה במקום). null כשאין פריט כזה בכתב הכמויות (סרטי בידוד, ג׳ל השחלה, תופים, כלי עבודה, פריטי אינסטלציה). החזר רק JSON: {"map":[{"i":<אינדקס>,"code":"<קוד או null>","conf":"<sure|likely>"}]}',{modelTier:"complex"});
    (out&&Array.isArray(out.map)?out.map:[]).forEach(r=>{ const i=Number(r.i); if(!lines[i]||lines[i].boq) return; const c=r.code!=null?String(r.code).trim():""; if(c&&codes.has(c)){ lines[i].boq=c; lines[i].boqConf=r.conf==="likely"?"likely":"sure"; res.n++; learnAlias(supplier,lines[i].name,c); } });
  }catch(e){ res.err=(e&&e.code)||"ai"; }
  return res;
}
export async function linkNoteToBoq(rec,quiet,mark,coll){
  coll=coll||"deliveries";
  if(!shared.boq.length||!rec||rec.source==="bom"||!(rec.lines||[]).length||!(rec.lines||[]).some(l=>!l.boq&&!l.skip)) return 0;
  const lines=rec.lines.map(l=>({...l})); const r=await mapLinesToBoq(rec.supplier,lines.filter(l=>!l.skip));
  if(r.err&&r.err!=="no-ai"&&!quiet) toast(r.err==="not_granted"?"הקישור האוטומטי לא אושר בתצוגה הזאת.":r.err==="rate_limited"?"יותר מדי קריאות AI — נסה עוד דקה.":"הקישור האוטומטי נכשל ("+r.err+").");
  if(!r.n&&!mark) return r.err?-1:0;
  const patch=r.n?{lines}:{}; if(mark&&!r.err) patch.boqChecked=Date.now();
  if(!Object.keys(patch).length) return 0;
  try{ if(shared.DB) await shared.DB.doc(coll+"/"+rec.id).update(patch); else { const arr=shared.deliveries; const d=arr.find(x=>x.id===rec.id); if(d){ Object.assign(d,patch); ls.set("deliveries",JSON.stringify(arr)); renderBoq(); } } }catch(e){ return 0; }
  if(!quiet&&r.n) toast(r.n===1?"שורה אחת קושרה לפריט מכתב הכמויות":r.n+" שורות קושרו לפריטי כתב הכמויות");
  return r.err?-1:r.n;
}
export async function linkAllNotesToBoq(force){
  if(!shared.boq.length){ toast("אין כתב כמויות. ייבא קודם."); return; }
  const todo=[...(shared.demoStock?[]:shared.deliveries).filter(n=>n.source!=="bom"&&(force||!n.boqChecked)&&(n.lines||[]).some(l=>!l.boq)).map(n=>({rec:n,coll:"deliveries"}))].sort((a,b)=>b.rec.ts-a.rec.ts);
  if(!todo.length){ toast("אין שורות לא מקושרות."); return; }
  if(!shared.SAMPLE){ toast("קישור אוטומטי לא זמין בתצוגה הזאת — אפשר לקשר ידנית."); return; }
  if(!(await ask("לעבור עם AI על "+todo.length+" תעודות ולקשר את השורות לפריטי כתב הכמויות? קישור «כנראה» מסומן בסימן שאלה ואפשר לתקן ידנית.","קשר"))) return;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="קישור לכתב הכמויות"><div class="grab"></div><h2>קישור תעודות לכתב הכמויות</h2><div class="prog"><i id="lkBar" style="width:2%"></i></div><div class="prog-t"><span id="lkTxt">מתחיל…</span></div><div class="dlines" id="lkLog" style="max-height:40vh;overflow:auto"></div><div class="acts"><button class="cancel" type="button" id="lkStop">עצור</button></div></div>'); let stop=false; scrim.querySelector("#lkStop").onclick=()=>{ stop=true; };
  let done=0, linked=0, failed=0; const max=Math.min(todo.length,80);
  for(const {rec,coll} of todo.slice(0,80)){ if(stop) break;
    scrim.querySelector("#lkTxt").textContent=(done+1)+"/"+max+" · "+(rec.supplier||"")+" · קושרו "+linked;
    scrim.querySelector("#lkBar").style.width=Math.round(100*(done+1)/max)+"%";
    let r=0; try{ r=await linkNoteToBoq(rec,true,true,coll); }catch(e){ r=-1; }
    if(r<0) failed++; else linked+=r;
    const row=document.createElement("div"); row.innerHTML='<span>'+(coll==="pos"?esc(rec.no)+' · ':'')+esc(shortSup(rec.supplier||"ספק לא ידוע"))+' · '+esc(fmtDT(rec.dateText)||"")+'</span><b style="color:'+(r<0?"var(--clay)":r?"var(--sage)":"var(--ink3)")+'">'+(r<0?"נכשל":r?r+" קושרו":"אין התאמה")+'</b>'; scrim.querySelector("#lkLog").prepend(row);
    done++;
  }
  scrim.querySelector("#lkTxt").textContent="סיום: "+done+" תעודות · "+linked+" שורות קושרו"+(failed?" · "+failed+" נכשלו":"");
  scrim.querySelector("#lkStop").textContent="סגור"; scrim.querySelector("#lkStop").onclick=()=>scrim.remove();
  logAct("settings","edit","קישור תעודות לכתב הכמויות: "+done+" תעודות, "+linked+" שורות"+(failed?", "+failed+" נכשלו":""),"settings/boq");
  renderBoq();
}
/* קישור ידני: רשימת שורות התעודות, חיפוש פריט מכתב הכמויות לכל שורה, «לא בכתב הכמויות», וביטול קישור. כל קישור ידני נלמד ככינוי לפעם הבאה. */
export function openBoqLinker(prefill){
  if(!shared.boq.length){ toast("אין כתב כמויות. ייבא קודם."); return; }
  const cat=catalog().filter(c=>c.codes.length); let mode="open", qtxt=(prefill||"").toLowerCase(), shown=40, onlySup=true;
  const boqSups=[...new Set(shared.boq.map(l=>l.supplier).filter(Boolean))]; const isBoqSup=sup=>boqSups.some(x=>supMatch(sup,x));
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="קישור תעודות לכתב הכמויות"><div class="grab"></div><h2>תעודות משלוח ↔ כתב כמויות</h2>'
    +'<div class="note-card">שמות בתעודה הם של הספק, שמות בכתב הכמויות של המתכנן. כל שורה שתקשר כאן נלמדת: בפעם הבאה שאותו פריט מגיע מאותו ספק הוא מתקשר לבד. «לא בכתב הכמויות» = פריט שלא מופיע בכתב הכמויות (ציוד, סרטים, תופים).</div>'
    +(shared.SAMPLE&&ROLE!=="viewer"?'<button class="ghost" type="button" id="lkAuto" style="width:100%;margin-bottom:8px">קישור אוטומטי עם AI לכל מה שלא מקושר</button>':'')
    +'<div class="chips" id="lkMode" style="margin-bottom:8px"><button type="button" class="chip2" data-m="open" aria-pressed="true">לא מקושר</button><button type="button" class="chip2" data-m="linked" aria-pressed="false">מקושר</button><button type="button" class="chip2" data-m="likely" aria-pressed="false">כנראה ?</button><button type="button" class="chip2" data-m="none" aria-pressed="false">לא בכתב הכמויות</button><button type="button" class="chip2" id="lkSup" aria-pressed="true">רק ספקי כתב הכמויות</button></div>'
    +'<div class="search" style="margin-bottom:8px"><input type="text" id="lkQ" placeholder="חפש שורה לפי שם או ספק" autocomplete="off"><span class="ico">⌕</span></div>'
    +'<div id="lkList"></div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const q=s=>scrim.querySelector(s);
  const close=()=>scrim.remove(); q(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  const auto=q("#lkAuto"); if(auto) auto.onclick=async()=>{ await linkAllNotesToBoq(true); draw(); };
  q("#lkMode").onclick=e=>{ const b=e.target.closest("[data-m]"); if(!b) return; mode=b.dataset.m; shown=40; scrim.querySelectorAll("#lkMode .chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); draw(); };
  q("#lkQ").oninput=e=>{ qtxt=e.target.value.trim().toLowerCase(); shown=40; draw(); }; if(prefill) q("#lkQ").value=prefill;
  q("#lkSup").onclick=()=>{ onlySup=!onlySup; q("#lkSup").setAttribute("aria-pressed",String(onlySup)); shown=40; draw(); };
  async function setLink(rec,idx,code,conf,coll){
    coll=coll||"deliveries";
    const lines=rec.lines.map(l=>({...l})); if(code){ lines[idx].boq=code; lines[idx].boqConf=conf||"manual"; } else { delete lines[idx].boq; delete lines[idx].boqConf; }
    try{ if(shared.DB) await shared.DB.doc(coll+"/"+rec.id).update({lines}); else { rec.lines=lines; ls.set("deliveries",JSON.stringify(shared.deliveries)); } }catch(e){ toast("השמירה נכשלה."); return; }
    rec.lines=lines; if(code&&code!=="-") learnAlias(rec.supplier,lines[idx].name,code);
    logAct(coll==="pos"?"order":"delivery","edit",(code?(code==="-"?"סומן לא בכתב הכמויות: ":"קושר לכתב הכמויות "+code+": "):"בוטל קישור: ")+lines[idx].name+" · "+(coll==="pos"?rec.no:shortSup(rec.supplier||"")),rec.id);
    draw(); renderBoq();
  }
  function draw(){
    const box=q("#lkList"); box.innerHTML="";
    const rows=[]; const src=[...(shared.demoStock?[]:shared.deliveries).filter(n=>n.source!=="bom").map(n=>[n,"deliveries"])].sort((a,b)=>b[0].ts-a[0].ts);
    src.forEach(([n,coll])=>(n.lines||[]).forEach((l,i)=>{ if(l.skip) return;
      const st=!l.boq?"open":l.boq==="-"?"none":l.boqConf==="likely"?"likely":"linked";
      if(mode==="linked"?(st!=="linked"&&st!=="likely"):st!==mode) return;
      if(qtxt&&!((l.name||"").toLowerCase().includes(qtxt)||(n.supplier||"").toLowerCase().includes(qtxt)||(n.no||"").toLowerCase().includes(qtxt))) return;
      if(onlySup&&!qtxt&&st==="open"&&coll==="deliveries"&&!isBoqSup(n.supplier)) return;
      rows.push({n,l,i,st,coll}); }));
    if(!rows.length){ box.innerHTML='<div class="empty">'+(mode==="open"?"הכל מקושר.":"אין שורות.")+'</div>'; return; }
    rows.slice(0,shown).forEach(({n,l,i,st,coll})=>{
      const r=document.createElement("div"); r.className="dline"; r.style.gridTemplateColumns="1fr";
      const item=l.boq&&l.boq!=="-"?cat.find(c=>c.codes.includes(String(l.boq))):null;
      r.innerHTML='<div><b style="font-size:.9rem">'+esc(l.name)+'</b><div class="hint" style="margin:2px 0 6px">'+(coll==="pos"?'<b style="color:var(--info)">'+esc(n.no)+'</b> · ':'תעודה · ')+esc(shortSup(n.supplier||"ספק לא ידוע"))+' · '+esc(fmtDT(n.dateText)||"")+' · '+fmtN(l.qty)+' '+esc(l.unit||"")+'</div>'
        +(item?'<div class="hint" style="color:var(--ink)">→ '+esc(item.name)+' <small style="color:var(--ink3)">סעיף '+esc(l.boq)+(st==="likely"?' · כנראה ?':'')+'</small></div>':st==="none"?'<div class="hint">לא בכתב הכמויות</div>':'')
        +'<div class="row2" style="margin:6px 0 0"><button class="ghost" type="button" data-a="pick" style="flex:1">'+(item?"שנה קישור":"קשר לפריט מכתב הכמויות")+'</button>'+(item||st==="none"?'<button class="ghost" type="button" data-a="clear">בטל קישור</button>':'<button class="ghost" type="button" data-a="none">לא בכתב הכמויות</button>')+'</div><div class="stock" data-pick hidden style="margin-top:6px"></div></div>';
      r.querySelector('[data-a="pick"]').onclick=()=>{ const pk=r.querySelector("[data-pick]"); if(!pk.hidden){ pk.hidden=true; return; } pk.hidden=false;
        pk.innerHTML='<div class="search" style="margin-bottom:6px"><input type="text" placeholder="חפש פריט מכתב הכמויות: שם, סעיף, מק״ט, אנגלית" autocomplete="off"><span class="ico">⌕</span></div><div data-res></div>';
        const inp=pk.querySelector("input"), res=pk.querySelector("[data-res]");
        const show=()=>{ const t=inp.value.trim().toLowerCase(); res.innerHTML="";
          let list=cat; if(t) list=cat.filter(c=>c.name.toLowerCase().includes(t)||c.codes.some(x=>x.toLowerCase().startsWith(t))||(c.sku&&c.sku.toLowerCase().includes(t))||shared.boq.some(b=>c.codes.includes(String(b.code))&&(b.en||"").toLowerCase().includes(t)));
          else { const sp=n.supplier; list=cat.filter(c=>shared.boq.some(b=>c.codes.includes(String(b.code))&&supMatch(sp,b.supplier))); if(!list.length) list=cat; }
          list.slice(0,8).forEach(c=>{ const b=document.createElement("button"); b.type="button"; b.className="slip"; b.innerHTML='<b>'+esc(c.name)+'</b><span>סעיף '+esc(c.codes.join(", "))+(c.supplier?' · '+esc(c.supplier):'')+' · תוכנן '+fmtN(c.planned)+' '+esc(c.unit)+'</span>'; b.onclick=()=>setLink(n,i,c.codes[0],"manual",coll); res.appendChild(b); });
          if(!list.length) res.innerHTML='<div class="hint">אין פריט כזה.</div>'; };
        inp.oninput=show; show(); inp.focus(); };
      const nb=r.querySelector('[data-a="none"]'); if(nb) nb.onclick=()=>setLink(n,i,"-","manual",coll);
      const cb=r.querySelector('[data-a="clear"]'); if(cb) cb.onclick=()=>setLink(n,i,null,null,coll);
      box.appendChild(r); });
    if(rows.length>shown){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent="עוד "+(rows.length-shown); m.onclick=()=>{ shown+=40; draw(); }; box.appendChild(m); }
    const h=document.createElement("div"); h.className="hint"; h.textContent=rows.length+" שורות"; box.prepend(h);
  }
  draw();
}
export function boqTemplateLines(){
  const rows=csvParse(BOQ_CABLES_TEMPLATE_CSV); if(!rows.length) return []; const H=rows[0].map(h=>h.toLowerCase()), ix=k=>H.indexOf(k);
  return rows.slice(1).map(r=>({code:String(r[ix("code")]||"").trim(),name:String(r[ix("name")]||"").trim(),qty:Number(String(r[ix("qty")]||"").replace(/,/g,""))||0,unit:r[ix("unit")]||"",group:r[ix("group")]||""})).filter(l=>l.name&&l.qty>0);
}
export const BOQ_TPL=boqTemplateLines();
export function openBoqImport(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ייבוא כתב כמויות"><div class="grab"></div><h2>ייבוא כתב כמויות</h2>'
    +'<div class="note-card">כתב הכמויות של העבודה: xlsx או csv. גיליון בפורמט EBOQ נקרא ישירות; קובץ אחר נקרא בעזרת AI, ואתה מאשר. כתב הכמויות הוא תכנון, לא מלאי: ממנו רואים מה כבר הגיע לאתר ומה עוד חסר.</div>'
    +(shared.boq.length?'<div class="legend">כרגע בכתב הכמויות: <b>'+shared.boq.length+'</b> פריטים ('+esc(shared.boqSource||"")+'). קובץ חדש מתווסף; פריט עם אותו מק״ט או שם מתעדכן.</div>':'')
    +'<div id="bqBody"><div class="pick">בחר קובץ כתב כמויות<small>xlsx / xls / csv</small><input type="file" id="bqFile" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></div></div>'
    +(BOQ_TPL.length?'<button type="button" class="linkbtn" id="bqTpl">תבנית עין תמר: '+BOQ_TPL.length+' שורות כבלים מסעיפי ההסכם ›</button>':'')
    +'<div class="acts"><button class="save" id="bqGo" hidden type="button">שמור לכתב הכמויות</button><button class="cancel" type="button">סגור</button></div></div>');
  const q=s=>scrim.querySelector(s); let out=null;
  q(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  // תבנית הכבלים מההסכם (docs/templates/boq-electrical.csv): כמויות בלבד, בלי מחירים ובלי ספקים. רק במופע שיש לו תבנית עם כמויות (כתב הכמויות מציג שורות עם כמות בלבד)
  if(q("#bqTpl")) q("#bqTpl").onclick=async()=>{
    const lines=BOQ_TPL.map(l=>({code:l.code,name:l.name,qty:l.qty,unit:l.unit,cat:"cables",group:l.group}));
    if(!await ask("להוסיף "+lines.length+" שורות כבלים מסעיפי ההסכם לכתב הכמויות? שורה עם אותו סעיף מתעדכנת, השאר נשארות.")) return;
    const keys=new Set(lines.map(l=>l.code)); const merged=shared.boq.filter(x=>!(x.code&&keys.has(x.code))).concat(lines);
    try{ await saveBoq(merged,[shared.boqSource,"תבנית עין תמר — כבלים"].filter(Boolean).filter((s,i,a)=>a.indexOf(s)===i).join(" · ").slice(0,120)); }catch(e){ toast("השמירה נכשלה."); return; }
    scrim.remove(); toast("נוספו "+lines.length+" שורות כבלים מההסכם לכתב הכמויות."); renderBoq();
  };
  q("#bqFile").onchange=async e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    q("#bqBody").innerHTML='<div class="prog"><i style="width:25%"></i></div><div class="prog-t"><span>קורא את הקובץ…</span></div>';
    let text="", det=null;
    try{
      if(/\.csv$/i.test(f.name)) text=await f.text();
      else { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"); const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
        for(const n of wb.SheetNames.slice(0,4)){ try{ det=parseEboq(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,defval:""})); }catch(err){ det=null; } if(det) break; }
        if(!det) text=wb.SheetNames.slice(0,4).map(n=>"### "+n+"\n"+XLSX.utils.sheet_to_csv(wb.Sheets[n],{blankrows:false})).join("\n\n"); }
    }catch(err){ q("#bqBody").innerHTML='<div class="empty">לא הצלחתי לקרוא את הקובץ.</div>'; return; }
    if(det){ out={source:(f.name.replace(/\.[^.]+$/,"").replace(/[_\-]+/g," ").trim()||"EBOQ"),lines:det.lines,det:true}; show(); return; }
    if(!shared.SAMPLE){ q("#bqBody").innerHTML='<div class="empty">הפורמט לא זוהה, וקריאה אוטומטית לא זמינה בתצוגה הזאת.</div>'; return; }
    text=text.split("\n").filter(l=>l.replace(/[,\s]/g,"").length).slice(0,400).map(l=>l.slice(0,300)).join("\n");
    q("#bqBody").innerHTML='<div class="prog"><i style="width:60%"></i></div><div class="prog-t"><span>מזהה פריטים, כמויות וקטגוריות…</span></div>';
    try{
      out=await shared.SAMPLE.json("להלן כתב כמויות של עבודות חשמל באתר סולארי, כ-CSV. החזר רק JSON: "
        +'{"source":"<שם המסמך/המתכנן והתאריך אם מופיעים>","lines":[{"name":"<שם פריט קצר וברור בעברית, עם מידה/דגם אם יש>","code":"<מק״ט או מספר סעיף, או null>","qty":<כמות מתוכננת, מספר>,"unit":"<יחידה: יח\', מטר, ק\\"ג, מ\\"ק, סט>","cat":"<קטגוריה>","supplier":"<ספק אם מצוין, אחרת null>"}]}. '
        +"cat חייב להיות אחד מאלה בדיוק: "+CATLIST+". כל כבל, מוליך או תוף=cables; תעלות, צנרת, קופסאות, מחברים, ממירים, לוחות, מהדקים, הארקה, שקעים=install; ברגים, דיבלים, אזיקונים, סרטי בידוד, סימון, שילוט, ציוד מגן=consumables; מקדחות, מפתחות, מכשירי בדיקה, כלי ידיים=tools. "
        +"קח רק שורות פריטים אמיתיות עם כמות, דלג על כותרות וסיכומים. אל תמציא. עד 120 שורות.\n\n"+text,{modelTier:"complex"});
    }catch(err){ q("#bqBody").innerHTML='<div class="empty">'+(err&&err.code==="not_granted"?"קריאה אוטומטית לא זמינה.":"הקריאה נכשלה. נסה שוב.")+'</div>'; return; }
    out.lines=(out&&Array.isArray(out.lines)?out.lines:[]).filter(l=>l&&l.name&&Number(l.qty)>0).map(l=>({name:String(l.name).trim(),code:l.code?String(l.code):"",qty:Number(l.qty),unit:l.unit||"יח'",cat:catId(l.cat,l.name),supplier:l.supplier||""}));
    show();
  };
  function show(){
    const lines=out.lines;
    if(!lines.length){ q("#bqBody").innerHTML='<div class="empty">לא נמצאו פריטים.</div>'; return; }
    const byCat=new Map(); lines.forEach(l=>byCat.set(l.cat,(byCat.get(l.cat)||0)+1));
    const withPo=lines.filter(l=>l.po).length, noQty=lines.filter(l=>!Number(l.qty)).length, sups=new Set(lines.map(l=>l.supplier).filter(Boolean)).size;
    q("#bqBody").innerHTML=(out.det?'<div class="legend">נקרא ישירות מגיליון הרכש, בלי AI: <b>'+lines.length+'</b> פריטים · <b>'+withPo+'</b> עם מספר הזמנה · <b>'+sups+'</b> ספקים'+(noQty?' · '+noQty+' בלי כמות (רכש ראשוני)':'')+'</div>':'')
      +'<div class="imp-sum"><span>פריטים <b>'+lines.length+'</b></span>'+[...byCat.entries()].map(([c,n])=>'<span>'+esc((CATS.find(x=>x.id===c)||{}).label||c)+' <b>'+n+'</b></span>').join("")+'</div>'
      +'<div class="dlines">'+lines.slice(0,80).map(l=>'<div><span>'+esc(l.name)+(l.code?' <small style="color:var(--ink3)">'+esc(l.code)+'</small>':'')+' <small style="color:var(--ink3)">· '+esc(l.supplier||(CATS.find(x=>x.id===l.cat)||{}).label||"")+(l.po?' · '+esc(l.po):'')+'</small></span><b>'+fmtN(l.qty)+' '+esc(l.unit)+'</b></div>').join("")+(lines.length>80?'<div><span>ועוד '+(lines.length-80)+'</span><b></b></div>':'')+'</div>';
    q("#bqGo").hidden=false;
  }
  q("#bqGo").onclick=async()=>{
    if(!out) return; const b=q("#bqGo"); b.disabled=true; b.textContent="שומר…";
    const keys=new Set(out.lines.map(l=>l.code||l.name)); const merged=shared.boq.filter(x=>!keys.has(x.code||x.name)&&!out.lines.some(l=>l.name===x.name&&!l.code)).concat(out.lines);
    try{ await saveBoq(merged,[shared.boqSource,out.source].filter(Boolean).filter((s,i,a)=>a.indexOf(s)===i).join(" · ").slice(0,120)); }catch(e){ toast("השמירה נכשלה."); b.disabled=false; b.textContent="שמור לכתב הכמויות"; return; }
    scrim.remove(); toast("נשמרו "+out.lines.length+" פריטים לכתב הכמויות."); renderBoq();
    if(ROLE!=="viewer"&&(shared.demoStock?[]:shared.deliveries).some(n=>n.source!=="bom"&&(n.lines||[]).some(l=>!l.boq))) setTimeout(()=>openBoqLinker(),400);
  };
}
export function __init(){
/* ================= כתב כמויות: קטלוג וקישור תעודות משלוח ================= */
shared.boq=[];
shared.boqSource="";
shared.STATUS=[];
shared.SUPPLIERS={};
supNorm = s=>shortSup(s);
const bq=$("#boqQ"); if(bq) bq.oninput=()=>renderBoq();
const bi=$("#btnBoqImport"); if(bi) bi.onclick=()=>openBoqImport();
const bl=$("#btnBoqLink"); if(bl) bl.onclick=()=>openBoqLinker();
boqName = code=>{ const l=shared.boq.find(x=>String(x.code)===String(code)); return l?(l.name||"").trim():""; };
sameItem = (x,l)=>(x.boq&&l.boq&&(String(x.boq)===String(l.boq)||boqName(x.boq)===boqName(l.boq)))||((x.name||"").trim()===(l.name||"").trim());
/* קישור שורות תעודת משלוח לפריטי כתב הכמויות.
   שמות בתעודה = שמות הקטלוג של הספק; שמות בכתב הכמויות = שמות המתכנן. לכן: 1) כינויים שנלמדו (ספק|שם → סעיף), 2) שם/מק״ט ספק מדויק, 3) AI לפי מהות המוצר, 4) קישור ידני. */
normName = s=>String(s||"").toLowerCase().replace(/[״"'`׳]/g,"").replace(/\s+/g," ").trim();
supKey = s=>String(s||"").toLowerCase().replace(/[.\-'"״׳()]/g,"").replace(/\s+/g," ").trim();
supMatch = (noteSup,eboqSup)=>{ const a=supKey(noteSup), b=supKey(eboqSup); if(!a||!b||b.length<3) return false; if(a.includes(b)) return true; const w=b.split(" ")[0]; return w.length>=3&&a.includes(w); };
shared.ALIASES={};
aliasKey = (sup,name)=>supKey(shortSup(sup||""))+"|"+normName(name);
aliasTimer = null;
aliasPending = {};
}
