import { $, actorName, ask, closer, esc, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { photoPicker, photoSrc, workAreas } from "./21-work.js";
import { currentLayout, layoutTargets } from "./24-site-stages.js";
/* ================= סגירת תעלה: מקטע → תמונה לכל שכבה → אישור מפקח =================
   הסכסוך הכי חוזר בקבוצת השטח: «כיסיתם בלי שראיתי». כאן כל מקטע תעלה שנסגר נרשם עם ארבע תמונות, שכבה-שכבה
   (כבילה, חול, סרט סימון, כיסוי), ומי מהפיקוח אישר ומתי. אוסף trenchclose: {id, date, trench, trenchId (מהמפה),
   seg, meters, layers:{cables|sand|tape|cover:{photo…}}, approved, inspector, approvedAt, note}. הרשימה בכרטיס
   «סגירת תעלות», השורה בסיכום היומי (21-work קורא דרך shared.trenchLines), והנספח בחשבון החלקי (22-bill).
   מטרים ותמונות בלבד, בלי מחירים. */
export let LAYERS;
export function trenchDocs(){ return (shared.TRENCH||[]).slice().sort((a,b)=>(a.date||"")<(b.date||"")?1:(a.date||"")>(b.date||"")?-1:(b.ts||0)-(a.ts||0)); }
export function layersDone(t){ return LAYERS.filter(([k])=>t.layers&&photoSrc(t.layers[k])).length; }
export function trenchLabel(t){ return (t.trench||"תעלה")+(t.seg?" · "+t.seg:""); }
export function trenchStatusText(t){ return t.approved?"אושר ע״י "+(t.inspector||"המפקח")+(t.approvedAt?" ב-"+isoText(t.approvedAt):""):"ממתין לאישור מפקח"; }
export async function saveTrench(doc){
  try{ if(shared.DB) await shared.DB.collection("trenchclose").doc(doc.id).set(doc); else { shared.TRENCH=(shared.TRENCH||[]).filter(x=>x.id!==doc.id).concat(doc); ls.set("trenchclose",JSON.stringify(shared.TRENCH)); } }
  catch(e){ toast("השמירה נכשלה."); return false; }
  renderTrench(); return true;
}
export function openTrenchClose(existing){
  const t=existing?JSON.parse(JSON.stringify(existing)):{id:"tc"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date:shared.dayISO||isoOf(Date.now()),trench:"",trenchId:"",seg:"",meters:0,layers:{},approved:false,inspector:"",approvedAt:"",note:""};
  t.layers=t.layers||{}; const edit=!!existing;
  const L0=currentLayout(), TR=L0?layoutTargets(L0).filter(x=>x.kind==="trench"):[];
  const dl=(id,a)=>'<datalist id="'+id+'">'+[...new Set(a.filter(Boolean))].map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist>';
  const pks=LAYERS.map(([k,lab])=>({k,lab,pk:photoPicker("tcP_"+k,t.layers[k])}));
  const scrim=popup('<div class="sheet pr-sheet" role="dialog" aria-modal="true" aria-label="סגירת תעלה"><div class="grab"></div><h2>'+(edit?"עדכון סגירת תעלה":"סגירת תעלה")+'</h2>'
    +'<div class="note-card">מקטע שנסגר: תמונה לכל שכבה לפני שמכסים את הבאה, ומי מהפיקוח אישר. זה הגיבוי כשמישהו אומר «כיסיתם בלי שראיתי».</div>'
    +'<div class="f"><label for="tcTrench">תעלה</label>'+(TR.length?'<select id="tcSel" aria-label="תעלה מהמפה"><option value="">בחר מהמפה…</option>'+TR.map(x=>'<option value="'+esc(x.id)+'"'+(t.trenchId===x.id?' selected':'')+'>'+esc(x.name)+'</option>').join("")+'</select>':'')
    +'<input type="text" id="tcTrench" list="tcTrenches" autocomplete="off" placeholder="למשל: תעלה B1 · תעלה ראשית צפון" value="'+esc(t.trench||"")+'"'+(TR.length?' style="margin-top:8px"':'')+'>'+dl("tcTrenches",[...TR.map(x=>x.name),...workAreas()])+'</div>'
    +'<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px"><div class="f"><label for="tcSeg">מקטע</label><input type="text" id="tcSeg" autocomplete="off" placeholder="למשל: שוחה 3 עד 4 · 0–120" value="'+esc(t.seg||"")+'"></div><div class="f"><label for="tcMeters">מטרים</label><input type="text" id="tcMeters" inputmode="decimal" placeholder="אורך" value="'+(Number(t.meters)?esc(t.meters):"")+'"></div></div>'
    +'<div class="f"><label for="tcDate">תאריך הסגירה</label><input type="date" id="tcDate" value="'+esc(t.date||"")+'"></div>'
    +'<div class="sechead"><span>שכבות: תמונה לכל אחת</span><span id="tcLayN"></span></div>'
    +pks.map(p=>'<div class="tc-layer" data-k="'+p.k+'"><div class="tc-lab"><b>'+esc(p.lab)+'</b></div>'+p.pk.html.replace('<label>תמונה (לא חובה)</label>','')+'</div>').join("")
    +'<div class="f" style="margin-top:12px"><label>אישור מפקח</label><div class="opts" id="tcAppr"><button class="opt" type="button" data-v="0" aria-pressed="'+!t.approved+'">ממתין לאישור</button><button class="opt" type="button" data-v="1" aria-pressed="'+!!t.approved+'">אושר</button></div></div>'
    +'<div id="tcApprF"'+(t.approved?'':' hidden')+' style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px"><div class="f"><label for="tcInsp">מי אישר</label><input type="text" id="tcInsp" autocomplete="off" placeholder="שם המפקח" value="'+esc(t.inspector||"")+'"></div><div class="f"><label for="tcApprDate">מתי</label><input type="date" id="tcApprDate" value="'+esc(t.approvedAt||"")+'"></div></div>'
    +'<div class="f"><label for="tcNote">הערה (לא חובה)</label><input type="text" id="tcNote" placeholder="למשל: אושר בטלפון, יחתום מחר" value="'+esc(t.note||"")+'"></div>'
    +'<div class="acts pr-acts"><button class="save" id="tcSave" type="button">'+(edit?"שמור עדכון":"שמור סגירה")+'</button>'+(edit&&ROLE==="owner"?'<button class="cancel danger" id="tcDel" type="button">מחק</button>':'')+'<button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel:not(.danger)").onclick=close;
  const binds=pks.map(p=>({k:p.k,b:p.pk.bind(scrim)}));
  // «2 / 4»: כמה שכבות כבר עם תמונה (קיימת או שנבחרה עכשיו)
  const layN=()=>{ const n=LAYERS.filter(([k])=>scrim.querySelector("#tcP_"+k+"Box .pthumb")).length; q("#tcLayN").textContent=n+" / "+LAYERS.length; }; layN();
  scrim.querySelectorAll(".tc-layer input[type=file]").forEach(i=>i.addEventListener("change",()=>setTimeout(layN,0)));
  scrim.querySelectorAll(".tc-layer .ghost").forEach(b=>b.addEventListener("click",()=>setTimeout(layN,0)));
  const sel=q("#tcSel"); if(sel) sel.onchange=()=>{ const x=TR.find(y=>y.id===sel.value); if(x) q("#tcTrench").value=x.name; };
  let approved=!!t.approved;
  q("#tcAppr").onclick=e=>{ const b=e.target.closest("[data-v]"); if(!b) return; approved=b.dataset.v==="1"; q("#tcAppr").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===b))); q("#tcApprF").hidden=!approved; if(approved&&!q("#tcApprDate").value) q("#tcApprDate").value=isoOf(Date.now()); };
  q("#tcSave").onclick=async()=>{
    const trench=q("#tcTrench").value.trim(); if(!trench){ toast("איזו תעלה?"); return; }
    const date=q("#tcDate").value; if(!date){ toast("תאריך?"); return; }
    if(approved&&!q("#tcInsp").value.trim()){ toast("מי אישר?"); return; }
    const doc={...t,trench,trenchId:(sel&&sel.value)||(TR.find(x=>x.name===trench)||{}).id||"",seg:q("#tcSeg").value.trim(),meters:Number(String(q("#tcMeters").value).replace(",","."))||0,date,
      approved,inspector:approved?q("#tcInsp").value.trim():"",approvedAt:approved?(q("#tcApprDate").value||isoOf(Date.now())):"",note:q("#tcNote").value.trim(),by:t.by||actorName(),ts:t.ts||Date.now(),updated:Date.now()};
    const b=q("#tcSave"); b.disabled=true; b.textContent="שומר…";
    // כל שכבה: התמונה מועלית למאגר הקבצים, או נשמרת מוקטנת כשאין מאגר; שכבה בלי תמונה לא נשמרת
    for(const {k,b:pb} of binds){ const lay={...(doc.layers[k]||{})}; await pb.apply(lay); if(photoSrc(lay)) doc.layers[k]={...lay,ts:lay.ts||Date.now()}; else delete doc.layers[k]; }
    if(!(await saveTrench(doc))){ b.disabled=false; b.textContent=edit?"שמור עדכון":"שמור סגירה"; return; }
    logAct("progress",edit?"edit":"add","סגירת תעלה: "+trenchLabel(doc)+(doc.meters?" · "+fmtN(doc.meters)+" מ׳":"")+" · "+layersDone(doc)+"/"+LAYERS.length+" שכבות · "+trenchStatusText(doc),doc.id);
    close(); toast("נשמר: "+trenchLabel(doc)+" · "+trenchStatusText(doc));
  };
  const del=q("#tcDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את סגירת התעלה הזו?","מחק","var(--clay)"))) return;
    try{ if(shared.DB) await shared.DB.collection("trenchclose").doc(t.id).delete(); else { shared.TRENCH=(shared.TRENCH||[]).filter(x=>x.id!==t.id); ls.set("trenchclose",JSON.stringify(shared.TRENCH)); } }catch(e){ toast("המחיקה נכשלה."); return; }
    logAct("progress","delete","נמחקה סגירת תעלה: "+trenchLabel(t),t.id,null,t); close(); renderTrench(); };
  if(!edit) setTimeout(()=>{ if(!scrim.contains(document.activeElement)) q("#tcTrench").focus(); },60);
}
/* הכרטיס: ממתינים לאישור קודם, אחר כך מה שאושר לאחרונה */
export function renderTrench(){
  const el=$("#tcList"); if(!el) return; const T=trenchDocs(), wait=T.filter(t=>!t.approved), ok=T.filter(t=>t.approved);
  foldSum("tc",T.length?[wait.length?wait.length+" ממתינים לאישור":"",ok.length?ok.length+" אושרו":""].filter(Boolean).join(" · "):"");
  el.innerHTML=T.length?"":'<div class="empty" style="padding:14px">אין עדיין סגירות תעלה. לפני שמכסים: תמונה לכל שכבה (כבילה, חול, סרט, כיסוי), ואז «אושר» עם שם המפקח. זה מה שמציגים כששואלים «מי ראה את זה לפני הכיסוי».</div>';
  [...wait,...ok.slice(0,10)].forEach(t=>{ const n=layersDone(t); const b=document.createElement("button"); b.type="button"; b.className="slip tc"+(t.approved?" ok":"");
    b.innerHTML='<b>'+esc(trenchLabel(t))+'</b><span class="qn">'+(Number(t.meters)?fmtN(t.meters)+' <small>מ׳</small>':'')+'</span>'
      +'<span class="tc-lays">'+LAYERS.map(([k,lab])=>{ const on=t.layers&&photoSrc(t.layers[k]); return '<i class="'+(on?'on':'')+'">'+(on?'✓':'·')+' '+esc(lab)+'</i>'; }).join("")+'</span>'
      +'<span>'+esc(isoText(t.date))+' · '+n+'/'+LAYERS.length+' שכבות מצולמות · '+esc(trenchStatusText(t))+(t.note?' · '+esc(t.note):'')+'</span>';
    b.onclick=()=>{ if(ROLE!=="viewer") openTrenchClose(t); }; el.appendChild(b); });
  if(ok.length>10){ const m=document.createElement("div"); m.className="hint"; m.style.padding="4px 2px"; m.textContent="ועוד "+(ok.length-10)+" שאושרו. כולם בחשבון החלקי."; el.appendChild(m); }
}
/* שורה לסיכום היומי: מה נסגר היום, ומה אושר היום */
export function trenchLines(iso){
  const T=trenchDocs().filter(t=>t.date===iso||t.approvedAt===iso); if(!T.length) return [];
  return ["סגירת תעלה: "+T.map(t=>trenchLabel(t)+(Number(t.meters)?" "+fmtN(t.meters)+" מ׳":"")+", "+layersDone(t)+"/"+LAYERS.length+" שכבות מצולמות, "+(t.approved?"אושר ע״י "+t.inspector:"ממתין לאישור מפקח")).join(" · ")];
}
/* לחשבון החלקי: הסגירות בתקופה */
export function trenchInPeriod(start,end){ return trenchDocs().filter(t=>t.date>=start&&t.date<=end).sort((a,b)=>a.date<b.date?-1:1); }
export function __init(){
  LAYERS=[["cables","כבילה הונחה"],["sand","חול / ריפוד"],["tape","סרט סימון"],["cover","כיסוי / הגנה"]];
  try{ shared.TRENCH=JSON.parse(ls.get("trenchclose")||"[]"); if(!Array.isArray(shared.TRENCH)) shared.TRENCH=[]; }catch(e){ shared.TRENCH=[]; }
  shared.renderTrench=renderTrench; shared.trenchLines=trenchLines;   // 18-identity ו-21-work קוראים דרך shared, בלי ייבוא מעגלי
  const b=$("#btnTrench"); if(b) b.onclick=()=>openTrenchClose();
  renderTrench();
}
