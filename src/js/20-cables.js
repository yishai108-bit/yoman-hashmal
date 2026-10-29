import { $, actorName, alertSheet, ask, closer, csvParse, esc, fmtD, logAct, ls, popup, shared, toast, unitMult } from "./core.js";
import { fmtN } from "./01-stock.js";
import { renderAlerts } from "./06-alerts.js";
import { SITE } from "./08-settings.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { CABLE_TYPES_TEMPLATE_CSV } from "./activities-template.js";
/* ================= כבלים: תופים, משיכות, מאזן לפי סוג, סגירת תוף, מילון קיצורים =================
   תוף = ישות (מספר תוף, סוג כבל, אורך בקליטה, ספק, מיקום, מצב). משיכה = תנועה מתוף (מטרים, אזור/סטרינג, צוות, תאריך).
   הגיע = סך אורכי התופים. נמשך = סך המשיכות. במלאי = מה שנשאר בתופים פתוחים. נותר למשוך = מתוכנן − נמשך.
   סגירת תוף: אורך בקליטה − סך המשיכות = שארית. שארית גדולה = משיכות שלא נרשמו. */
export let DRUM_ST, REMAIN_WARN;
export function cableNorm(s){ return String(s||"").toLowerCase().replace(/[״"'`׳()\[\],.\-_/]/g," ").replace(/\s+/g," ").trim(); }
export function cableTypes(){ return Array.isArray(shared.CABLE_TYPES)?shared.CABLE_TYPES:[]; }
export let SUPPLIED_BY;   // מי סיפק את התוף: כשהיזם או הראשי מספקים, הקבלן אחראי על החומר ומאזן התופים מגן עליו
export function cableTypeLabel(code){ const t=cableTypes().find(x=>x.code===code); return t?t.desc:(code||"סוג לא ידוע"); }
/* קיצור בעל פה → קוד סוג כבל. קוד, תיאור או כינוי; הארוך ביותר שמופיע בטקסט מנצח («הארקה 25» לפני «25») */
export function cableTypeOf(text){
  const n=cableNorm(text); if(!n) return "";
  let best="", bestLen=0;
  for(const t of cableTypes()){
    for(const a of [t.code,t.desc,...(t.aliases||[])]){ const k=cableNorm(a); if(!k) continue;
      const hit=n===k||(" "+n+" ").includes(" "+k+" ");
      if(hit&&k.length>bestLen){ best=t.code; bestLen=k.length; } }
  }
  return best;
}
export function drumPulled(id){ return (shared.pulls||[]).filter(p=>p.drumId===id).reduce((s,p)=>s+(Number(p.meters)||0),0); }
export function drumRemain(d){ return Math.max(0,(Number(d.lengthIn)||0)-drumPulled(d.id)); }
export function drumOpen(d){ return d.status!=="empty"&&d.status!=="returned"; }
/* מאזן לפי סוג כבל. כל המסכים והבדיקות קוראים לפונקציה הזאת */
export function cableBalance(){
  const m=new Map();
  const get=code=>{ let e=m.get(code); if(!e){ const t=cableTypes().find(x=>x.code===code)||{}; e={code,desc:t.desc||code||"סוג לא ידוע",boqCode:t.boqCode||"",planned:0,arrived:0,pulled:0,stock:0,returned:0,unexplained:0,drums:0,open:0}; m.set(code,e); } return e; };
  cableTypes().forEach(t=>get(t.code));
  const byDrum=new Map((shared.drums||[]).map(d=>[d.id,d]));
  (shared.drums||[]).forEach(d=>{ const e=get(d.cableType||""); e.arrived+=Number(d.lengthIn)||0; e.drums++;
    if(drumOpen(d)){ e.open++; e.stock+=drumRemain(d); }
    else if(d.status==="returned") e.returned+=Number(d.remainderAtClose)||0;
    else e.unexplained+=Number(d.remainderAtClose)||0; });
  (shared.pulls||[]).forEach(p=>{ const d=byDrum.get(p.drumId); get(d?d.cableType||"":p.cableType||"").pulled+=Number(p.meters)||0; });
  (shared.boq||[]).forEach(l=>{ const code=String(l.code||""); if(!code) return; cableTypes().filter(t=>t.boqCode&&String(t.boqCode)===code).forEach(t=>{ get(t.code).planned+=(Number(l.qty)||0)*unitMult(l.unit); }); });
  return [...m.values()].map(e=>({...e,left:Math.max(0,e.planned-e.pulled)})).filter(e=>e.drums||e.planned||e.pulled);
}
/* שורת תעודת משלוח שהיא תוף: יש לה מספר תוף, או שהיחידה / השם אומרים «תוף». מחזיר רשומות תוף חדשות (לא שומר) */
export function drumsFromNote(rec){
  const out=[]; const ts=rec.ts||Date.now();
  (rec.lines||[]).forEach((l,i)=>{
    const isDrum=!!l.drumNo||/תוף|תופים/.test(String(l.unit||""))||/(^|\s)(תוף|תופים)(\s|$)/.test(String(l.name||""));
    if(!isDrum||!(Number(l.qty)>0)) return;
    const nos=String(l.drumNo||"").split(/[,;\s]+/).filter(Boolean);
    const unitM=/^\s*(מ['׳]?|מטר|מטרים|m)\s*$/.test(String(l.unit||""));
    const nameLen=Number((String(l.name||"").match(/(\d{2,5})\s*(?:מ['׳]?|מטר|m)(?:\s|$)/)||[])[1])||0;
    const n=unitM?Math.max(1,nos.length):Math.min(50,Math.max(1,Math.round(Number(l.qty))));
    const len=Number(l.meters)||nameLen||(unitM?Math.round(Number(l.qty)/n):0);
    for(let k=0;k<n;k++) out.push({id:"dr"+ts+"_"+i+"_"+k,drumNo:nos[k]||"",cableType:cableTypeOf(l.name),cableName:String(l.name||"").trim(),lengthIn:len,
      deliveryId:rec.id,supplier:rec.supplier||"",location:"",status:"full",ts,source:"delivery"});
  });
  return out;
}
async function saveDoc(coll,doc){
  if(shared.DB){ await shared.DB.collection(coll).doc(doc.id).set(doc); return; }
  const arr=coll==="drums"?shared.drums:shared.pulls; const i=arr.findIndex(x=>x.id===doc.id); if(i>=0) arr[i]=doc; else arr.push(doc);
  ls.set(coll,JSON.stringify(arr)); renderCables();
}
export async function saveDrums(list){ for(const d of list) await saveDoc("drums",d); }
const typeOptions=sel=>'<option value="">בחר סוג כבל</option>'+cableTypes().map(t=>'<option value="'+esc(t.code)+'"'+(t.code===sel?' selected':'')+'>'+esc(t.desc)+'</option>').join("");
const whoList=()=>[...new Set([...(shared.CREW||[]).filter(c=>c.active!==false).map(c=>c.name),...(shared.pulls||[]).map(p=>p.crew)].filter(Boolean))];
/* קליטת תוף ידנית, או השלמת תופים שנוצרו מתעודה */
export function openDrumIntake(list){
  let drums=(list&&list.length?list:[{id:"dr"+Date.now(),drumNo:"",cableType:"",cableName:"",lengthIn:"",supplier:"",location:"",status:"full",ts:Date.now(),source:"app"}]).map(d=>({...d}));
  const fromNote=!!(list&&list.length);
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="קליטת תוף"><div class="grab"></div><h2>'+(fromNote?"תופים מהתעודה":"קליטת תוף כבל")+'</h2>'
    +(fromNote?'<div class="note-card">בתעודה יש שורות של תופים. לכל תוף: המספר שמודפס עליו, סוג הכבל והאורך. כך כל משיכה יורדת מהתוף הנכון.</div>':'')
    +'<div id="drRows"></div>'+(fromNote?'':'<button class="addline" type="button" id="drAdd">+ תוף נוסף</button>')
    +'<div class="acts"><button class="save" id="drSave" type="button">שמור '+(drums.length>1?drums.length+" תופים":"תוף")+'</button><button class="cancel" type="button">'+(fromNote?"אחר כך":"ביטול")+'</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  function draw(){
    const box=q("#drRows"); box.innerHTML="";
    drums.forEach((d,i)=>{ const el=document.createElement("div"); el.className="card"; el.style.marginBottom="10px";
      el.innerHTML=(d.cableName?'<div class="hint" style="margin-bottom:6px">מהתעודה: '+esc(d.cableName)+'</div>':'')
        +'<div class="f"><label>מספר תוף</label><input type="text" data-k="drumNo" value="'+esc(d.drumNo)+'" placeholder="המספר שעל התוף" autocomplete="off"></div>'
        +'<div class="f"><label>סוג כבל</label><select data-k="cableType">'+typeOptions(d.cableType)+'</select>'
          +'<input type="text" data-k="alias" placeholder="או כתוב כמו שקוראים לו באתר, למשל «סטרינג 6 שחור»" autocomplete="off" style="margin-top:6px"></div>'
        +'<div class="f"><label>אורך בקליטה (מטר)</label><input type="text" inputmode="numeric" data-k="lengthIn" value="'+esc(d.lengthIn||"")+'" placeholder="למשל 1000"></div>'
        +'<div class="f"><label>מיקום באתר</label><input type="text" data-k="location" value="'+esc(d.location||"")+'" placeholder="חצר, אזור, מכולה" autocomplete="off"></div>'
        +'<div class="f"><label>סופק ע״י</label><select data-k="suppliedBy"><option value="">לא צוין</option>'+Object.entries(SUPPLIED_BY).map(([k,v])=>'<option value="'+k+'"'+(d.suppliedBy===k?' selected':'')+'>'+v+'</option>').join("")+'</select></div>'
        +(!fromNote&&i>0?'<button class="ghost" type="button" data-k="rm">הסר תוף</button>':'');
      el.querySelectorAll("input[data-k],select[data-k]").forEach(inp=>{ const k=inp.dataset.k;
        inp.oninput=inp.onchange=()=>{ if(k==="alias"){ const c=cableTypeOf(inp.value); if(c){ d.cableType=c; el.querySelector('select[data-k="cableType"]').value=c; } d.alias=inp.value.trim(); } else d[k]=inp.value; }; });
      const rm=el.querySelector('[data-k="rm"]'); if(rm) rm.onclick=()=>{ drums.splice(i,1); draw(); };
      box.appendChild(el); });
  }
  const add=q("#drAdd"); if(add) add.onclick=()=>{ const last=drums[drums.length-1]||{}; drums.push({id:"dr"+Date.now()+"_"+drums.length,drumNo:"",cableType:last.cableType||"",lengthIn:last.lengthIn||"",location:last.location||"",status:"full",ts:Date.now(),source:"app"}); draw(); };
  q("#drSave").onclick=async()=>{
    const bad=drums.find(d=>!String(d.drumNo).trim()||!d.cableType||!(Number(d.lengthIn)>0));
    if(bad){ toast(!String(bad.drumNo).trim()?"חסר מספר תוף.":!bad.cableType?"חסר סוג כבל.":"חסר אורך בקליטה."); return; }
    const dup=drums.find(d=>(shared.drums||[]).some(x=>x.id!==d.id&&String(x.drumNo)===String(d.drumNo).trim()));
    if(dup&&!(await ask("תוף "+dup.drumNo+" כבר רשום. לשמור בכל זאת?","שמור"))) return;
    const b=q("#drSave"); b.disabled=true; b.textContent="שומר…";
    const by=actorName();
    try{
      for(const d of drums){ const alias=d.alias; delete d.alias;
        const doc={...d,drumNo:String(d.drumNo).trim(),lengthIn:Number(d.lengthIn),location:String(d.location||"").trim(),by:d.by||by};
        await saveDoc("drums",doc);
        if(alias&&!cableTypeOf(alias)) await learnCableAlias(alias,doc.cableType); }
    }catch(e){ b.disabled=false; b.textContent="שמור"; toast("השמירה נכשלה."); return; }
    logAct("cable","add",(fromNote?"תופים מתעודה: ":"קליטת תוף: ")+drums.map(d=>d.drumNo+" · "+cableTypeLabel(d.cableType)+" · "+fmtN(d.lengthIn)+" מ׳").join(", "),drums[0].id,by);
    close(); renderCables(); toast(drums.length>1?"נשמרו "+drums.length+" תופים.":"התוף נשמר.");
  };
  draw();
}
/* משיכת כבל מתוף */
export function openPull(drumId){
  const open=(shared.drums||[]).filter(drumOpen).sort((a,b)=>String(a.drumNo).localeCompare(String(b.drumNo),"he",{numeric:true}));
  if(!open.length){ toast("אין תופים פתוחים. קולטים תוף קודם."); openDrumIntake(); return; }
  let sel=drumId&&open.find(d=>d.id===drumId)?drumId:(open.length===1?open[0].id:"");
  const today=isoOf(Date.now());
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="משיכת כבל"><div class="grab"></div><h2>משיכת כבל</h2>'
    +'<div class="f"><label for="plDrum">מאיזה תוף</label><select id="plDrum"><option value="">בחר תוף</option>'+open.map(d=>'<option value="'+esc(d.id)+'"'+(d.id===sel?' selected':'')+'>תוף '+esc(d.drumNo)+' · '+esc(cableTypeLabel(d.cableType))+' · נשארו '+fmtN(drumRemain(d))+' מ׳</option>').join("")+'</select></div>'
    +'<div class="f"><label for="plM">כמה מטר נמשכו</label><input type="text" inputmode="numeric" id="plM" placeholder="מטרים"><div class="hint" id="plHint"></div></div>'
    +'<div class="f"><label for="plArea">לאן</label><input type="text" id="plArea" placeholder="אזור, סטרינג או תעלה, למשל «שדה 2 · סטרינג 14»" autocomplete="off"></div>'
    +'<div class="f"><label for="plCrew">צוות</label><input type="text" id="plCrew" list="plCrewList" placeholder="מי משך" autocomplete="off"><datalist id="plCrewList">'+whoList().map(w=>'<option value="'+esc(w)+'"></option>').join("")+'</datalist></div>'
    +'<div class="f"><label for="plDate">תאריך</label><input type="date" id="plDate" value="'+today+'"></div>'
    +'<div class="acts"><button class="save" id="plSave" type="button" disabled>שמור משיכה</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const check=()=>{ const d=open.find(x=>x.id===q("#plDrum").value), m=Number(q("#plM").value);
    q("#plHint").innerHTML=d?(m>drumRemain(d)?'<b style="color:var(--clay)">יותר ממה שנשאר בתוף ('+fmtN(drumRemain(d))+' מ׳)</b>':'נשארו בתוף '+fmtN(drumRemain(d))+' מ׳'+(m>0?' · אחרי המשיכה '+fmtN(drumRemain(d)-m):'')):"";
    q("#plSave").disabled=!(d&&m>0); };
  q("#plDrum").onchange=check; q("#plM").oninput=check;
  q("#plSave").onclick=async()=>{
    const d=open.find(x=>x.id===q("#plDrum").value), m=Number(q("#plM").value); if(!d||!(m>0)) return;
    if(m>drumRemain(d)&&!(await ask("נרשמו יותר מטרים ממה שנשאר בתוף. לשמור?","שמור","var(--amber)","אולי האורך בקליטה לא נכון, או שזה תוף אחר."))) return;
    const after=drumRemain(d)-m, date=q("#plDate").value||today, ts=new Date(date+"T12:00:00").getTime();
    const p={id:"pl"+Date.now(),drumId:d.id,drumNo:d.drumNo,cableType:d.cableType,meters:m,area:q("#plArea").value.trim(),crew:q("#plCrew").value.trim(),date,ts,by:actorName()};
    const b=q("#plSave"); b.disabled=true; b.textContent="שומר…";
    try{ await saveDoc("pulls",p); if(d.status==="full") await saveDoc("drums",{...d,status:"inUse"}); }catch(e){ b.disabled=false; b.textContent="שמור משיכה"; toast("השמירה נכשלה."); return; }
    logAct("cable","add","משיכה: "+fmtN(m)+" מ׳ מתוף "+d.drumNo+(p.area?" ל"+p.area:"")+(p.crew?" · "+p.crew:""),p.id,p.by);
    close(); renderCables(); toast("נרשמו "+fmtN(m)+" מ׳. נשארו בתוף "+fmtN(Math.max(0,after))+" מ׳.");
  };
  check(); setTimeout(()=>q(sel?"#plM":"#plDrum").focus(),60);
}
/* סגירת תוף: ריק (השארית לא מוסברת) או הוחזר לספק (השארית חזרה) */
export function openCloseDrum(drumId){
  const d=(shared.drums||[]).find(x=>x.id===drumId); if(!d) return;
  const pulled=drumPulled(d.id), rem=Math.max(0,(Number(d.lengthIn)||0)-pulled), pct=d.lengthIn?rem/d.lengthIn:0;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="סגירת תוף"><div class="grab"></div><h2>סגירת תוף '+esc(d.drumNo)+'</h2>'
    +'<div class="dlines"><div><span>'+esc(cableTypeLabel(d.cableType))+' · אורך בקליטה</span><b>'+fmtN(d.lengthIn)+' מ׳</b></div><div><span>נמשך ('+(shared.pulls||[]).filter(p=>p.drumId===d.id).length+' משיכות)</span><b>'+fmtN(pulled)+' מ׳</b></div>'
    +'<div><span>שארית</span><b style="color:'+(pct>REMAIN_WARN?'var(--clay)':'var(--ink)')+'">'+fmtN(rem)+' מ׳ · '+Math.round(pct*100)+'%</b></div></div>'
    +(pct>REMAIN_WARN?'<div class="note-card" style="margin-top:10px">שארית מעל '+Math.round(REMAIN_WARN*100)+'% בתוף ריק אומרת בדרך כלל שיש משיכות שלא נרשמו. כדאי לבדוק מול הצוות לפני הסגירה.</div>':'')
    +'<div class="f" style="margin-top:12px"><label>מה קרה לתוף</label><div class="chips" id="cdMode"><button type="button" class="chip2" data-m="empty" aria-pressed="true">נגמר, התוף ריק</button><button type="button" class="chip2" data-m="returned" aria-pressed="false">הוחזר לספק עם שארית</button></div></div>'
    +'<div class="f"><label for="cdNote">הערה</label><input type="text" id="cdNote" placeholder="לא חובה"></div>'
    +'<div class="acts"><button class="save" id="cdSave" type="button">סגור תוף</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close; let mode="empty";
  scrim.querySelectorAll("#cdMode [data-m]").forEach(b=>b.onclick=()=>{ mode=b.dataset.m; scrim.querySelectorAll("#cdMode [data-m]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); });
  q("#cdSave").onclick=async()=>{
    const doc={...d,status:mode,closedAt:Date.now(),remainderAtClose:rem,closeNote:q("#cdNote").value.trim(),closedBy:actorName()};
    try{ await saveDoc("drums",doc); }catch(e){ toast("השמירה נכשלה."); return; }
    logAct("cable","edit","תוף "+d.drumNo+(mode==="returned"?" הוחזר לספק":" נסגר")+" · שארית "+fmtN(rem)+" מ׳ ("+Math.round(pct*100)+"%)",d.id);
    close(); renderCables(); toast(mode==="returned"?"התוף סומן «הוחזר לספק».":"התוף נסגר"+(pct>REMAIN_WARN?" עם שארית חריגה.":"."));
  };
}
/* מילון סוגי כבלים וכינויים */
export async function saveCableTypes(types){
  const doc={types:types.map(t=>({code:String(t.code).trim(),desc:String(t.desc||t.code).trim(),section:t.section||"",conductor:t.conductor||"",color:t.color||"",boqCode:String(t.boqCode||"").trim(),aliases:(t.aliases||[]).map(a=>String(a).trim()).filter(Boolean)})).filter(t=>t.code),ts:Date.now()};
  if(shared.DB) await shared.DB.doc("settings/cableTypes").set(doc); else ls.set("cableTypes",JSON.stringify(doc));
  shared.CABLE_TYPES=doc.types; renderCables();
}
export async function learnCableAlias(alias,code){
  const t=cableTypes().find(x=>x.code===code); if(!t||!cableNorm(alias)) return;
  await saveCableTypes(cableTypes().map(x=>x.code===code?{...x,aliases:[...(x.aliases||[]),alias]}:x));
}
export function parseCableTypesCsv(text){
  const rows=csvParse(text); if(!rows.length) return [];
  const H=rows[0].map(h=>h.toLowerCase()); const c=k=>H.indexOf(k);
  return rows.slice(1).map(r=>({code:r[c("code")]||"",desc:r[c("desc")]||"",section:r[c("section_mm2")]||"",conductor:r[c("conductor")]||"",color:r[c("color")]||"",boqCode:r[c("boqcode")]||"",aliases:String(r[c("aliases")]||"").split(";")})).filter(t=>t.code);
}
export function openCableTypes(){
  let types=cableTypes().map(t=>({...t,aliases:[...(t.aliases||[])]}));
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="מילון כבלים"><div class="grab"></div><h2>סוגי כבלים וכינויים</h2>'
    +'<div class="note-card">לכל סוג כבל: קוד, שם מלא, סעיף בכתב הכמויות, וכינויים כמו שקוראים לו באתר («הארקה 25», «סטרינג 6»). כינוי שמוקלד בקליטת תוף ולא מוכר נלמד לבד.</div>'
    +'<div id="ctRows"></div><button class="addline" type="button" id="ctAdd">+ סוג כבל</button>'
    +'<button class="ghost" type="button" id="ctTpl" style="width:100%;margin-top:8px">תבנית עין תמר: סוגי הכבלים מסעיפי ההסכם</button>'
    +'<div class="pick" style="margin-top:10px">ייבוא מקובץ CSV<small>code, desc, section_mm2, conductor, color, boqCode, aliases</small><input type="file" id="ctFile" accept=".csv,text/csv"></div>'
    +'<div class="acts"><button class="save" id="ctSave" type="button">שמור</button><button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  function draw(){ const box=q("#ctRows"); box.innerHTML="";
    if(!types.length) box.innerHTML='<div class="hint">עוד אין סוגי כבלים.</div>';
    types.forEach((t,i)=>{ const el=document.createElement("div"); el.className="card"; el.style.marginBottom="8px";
      el.innerHTML='<div class="row2" style="margin:0"><input type="text" data-k="code" value="'+esc(t.code)+'" placeholder="קוד" aria-label="קוד" style="flex:1"><input type="text" data-k="boqCode" value="'+esc(t.boqCode||"")+'" placeholder="סעיף בכ״כ" aria-label="סעיף בכתב הכמויות" style="flex:1"></div>'
        +'<input type="text" data-k="desc" value="'+esc(t.desc)+'" placeholder="שם מלא" aria-label="שם מלא" style="margin-top:6px">'
        +'<input type="text" data-k="aliases" value="'+esc((t.aliases||[]).join("; "))+'" placeholder="כינויים, מופרדים ב-;" aria-label="כינויים" style="margin-top:6px">'
        +'<button class="ghost" type="button" data-k="rm" style="margin-top:6px">הסר</button>';
      el.querySelectorAll("input[data-k]").forEach(inp=>inp.oninput=()=>{ const k=inp.dataset.k; t[k]=k==="aliases"?inp.value.split(";"):inp.value; });
      el.querySelector('[data-k="rm"]').onclick=()=>{ types.splice(i,1); draw(); };
      box.appendChild(el); }); }
  q("#ctAdd").onclick=()=>{ types.push({code:"",desc:"",boqCode:"",aliases:[]}); draw(); };
  q("#ctTpl").onclick=()=>{ const add=parseCableTypesCsv(CABLE_TYPES_TEMPLATE_CSV); let n=0; add.forEach(a=>{ const i=types.findIndex(t=>t.code===a.code); if(i>=0) types[i]={...types[i],...a,aliases:[...new Set([...(types[i].aliases||[]),...a.aliases])]}; else { types.push(a); n++; } }); draw(); toast(n+" סוגים חדשים מהתבנית"+(add.length-n?" · "+(add.length-n)+" עודכנו":"")+". לשמור."); };
  q("#ctFile").onchange=async e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const add=parseCableTypesCsv(await f.text());
    if(!add.length){ toast("לא נמצאו סוגי כבלים בקובץ."); return; } add.forEach(a=>{ const i=types.findIndex(t=>t.code===a.code); if(i>=0) types[i]=a; else types.push(a); }); draw(); toast("נקראו "+add.length+" סוגים. לשמור."); };
  q("#ctSave").onclick=async()=>{ if(types.some(t=>!String(t.code).trim())){ toast("לכל סוג צריך קוד."); return; }
    try{ await saveCableTypes(types); }catch(e){ toast("השמירה נכשלה."); return; }
    logAct("settings","edit","מילון כבלים עודכן · "+types.length+" סוגים","settings/cableTypes"); close(); toast("נשמר."); };
  draw();
}
export function openDrum(drumId){
  const d=(shared.drums||[]).find(x=>x.id===drumId); if(!d) return;
  const pl=(shared.pulls||[]).filter(p=>p.drumId===d.id).sort((a,b)=>b.ts-a.ts), can=ROLE!=="viewer";
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="תוף"><div class="grab"></div><h2>תוף '+esc(d.drumNo)+'</h2>'
    +'<div class="dlines"><div><span>סוג</span><b>'+esc(cableTypeLabel(d.cableType))+'</b></div><div><span>אורך בקליטה</span><b>'+fmtN(d.lengthIn)+' מ׳</b></div><div><span>נמשך</span><b>'+fmtN(drumPulled(d.id))+' מ׳</b></div>'
    +'<div><span>'+(drumOpen(d)?"נשאר":"שארית בסגירה")+'</span><b>'+fmtN(drumOpen(d)?drumRemain(d):d.remainderAtClose)+' מ׳</b></div>'+(d.location?'<div><span>מיקום</span><b>'+esc(d.location)+'</b></div>':'')+(d.suppliedBy?'<div><span>סופק ע״י</span><b>'+esc(SUPPLIED_BY[d.suppliedBy]||d.suppliedBy)+'</b></div>':'')+(d.supplier?'<div><span>ספק</span><b>'+esc(d.supplier)+'</b></div>':'')+'</div>'
    +'<div class="sechead" style="margin-top:12px"><span>משיכות</span><span>'+pl.length+'</span></div><div class="dlines">'+(pl.length?pl.map(p=>'<div><span>'+esc(isoText(p.date))+(p.area?' · '+esc(p.area):'')+(p.crew?' <small style="color:var(--ink3)">'+esc(p.crew)+'</small>':'')+'</span><b>'+fmtN(p.meters)+'</b></div>').join(""):'<div><span>עוד לא נמשך</span><b></b></div>')+'</div>'
    +(can&&(!d.drumNo||!d.cableType||!(Number(d.lengthIn)>0))?'<button class="ghost strong" id="dFix" type="button" style="width:100%;margin-top:10px">השלמת פרטי התוף</button>':'')
    +'<div class="acts">'+(can&&drumOpen(d)?'<button class="save" id="dPull" type="button">משיכה מהתוף</button><button class="ghost" id="dClose" type="button">סגירת תוף</button>':'')+'<button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  if(q("#dFix")) q("#dFix").onclick=()=>{ close(); openDrumIntake([d]); };
  if(q("#dPull")) q("#dPull").onclick=()=>{ close(); openPull(d.id); };
  if(q("#dClose")) q("#dClose").onclick=()=>{ close(); openCloseDrum(d.id); };
}
export function cablesText(){
  const L=["מאזן כבלים · "+(SITE.name||"")+" · "+fmtD(Date.now())];
  cableBalance().forEach(e=>L.push(e.desc+": הגיע "+fmtN(e.arrived)+" · נמשך "+fmtN(e.pulled)+" · במלאי "+fmtN(e.stock)+(e.planned?" · נותר למשוך "+fmtN(e.left):"")+" מ׳"));
  return L.join("\n");
}
export function renderCables(){
  const box=$("#cbList"); if(!box) return;
  const bal=cableBalance(), drums=(shared.drums||[]), open=drums.filter(drumOpen);
  const big=$("#cbBig"); if(big) big.textContent=fmtN(bal.reduce((s,e)=>s+e.stock,0));
  const sub=$("#cbSub"); if(sub) sub.innerHTML=drums.length?'<b>'+fmtN(open.length)+'</b> תופים פתוחים מתוך '+fmtN(drums.length)+' · נמשכו <b>'+fmtN(bal.reduce((s,e)=>s+e.pulled,0))+'</b> מ׳':'עוד לא נקלט תוף. קולטים תוף ידנית, או מתעודת משלוח עם שורת «תוף».';
  const warn=drums.filter(d=>d.status==="empty"&&d.lengthIn&&(Number(d.remainderAtClose)||0)/d.lengthIn>REMAIN_WARN);
  foldSum("cbal",bal.length?bal.length+" סוגים":"");
  box.innerHTML=!bal.length?'<div class="empty">אין עדיין כבלים. מגדירים סוגי כבלים במילון, וקולטים תוף ראשון.</div>'
    :bal.map(e=>{ const tot=Math.max(e.planned,e.arrived,1), w=x=>Math.min(100,x/tot*100);
      return '<div class="cbrow"><div class="cbn"><b>'+esc(e.desc)+'</b><small>'+fmtN(e.open)+' תופים פתוחים'+(e.unexplained?' · <span style="color:var(--clay)">'+fmtN(e.unexplained)+' מ׳ לא מוסברים</span>':'')+'</small></div>'
        +'<div class="cbbar" aria-hidden="true"><i class="p" style="width:'+w(e.pulled)+'%"></i><i class="s" style="width:'+w(e.stock)+'%"></i></div>'
        +'<div class="cbnums"><span>מתוכנן<b>'+(e.planned?fmtN(e.planned):"—")+'</b></span><span>הגיע<b>'+fmtN(e.arrived)+'</b></span><span>נמשך<b>'+fmtN(e.pulled)+'</b></span><span>במלאי<b>'+fmtN(e.stock)+'</b></span><span>נותר למשוך<b>'+(e.planned?fmtN(e.left):"—")+'</b></span></div></div>'; }).join("");
  const dl=$("#cbDrums"); if(dl){ dl.innerHTML="";
    const list=drums.slice().sort((a,b)=>(drumOpen(b)-drumOpen(a))||String(a.drumNo).localeCompare(String(b.drumNo),"he",{numeric:true}));
    foldSum("cdrums",drums.length?fmtN(open.length)+" פתוחים"+(warn.length?" · "+warn.length+" עם שארית חריגה":""):"");
    if(!list.length) dl.innerHTML='<div class="hint">אין תופים.</div>';
    list.slice(0,60).forEach(d=>{ const b=document.createElement("button"); b.type="button"; b.className="slip"; const r=drumOpen(d)?drumRemain(d):Number(d.remainderAtClose)||0;
      const st=drumOpen(d)?(d.status==="full"?"מלא":"בשימוש"):d.status==="returned"?"הוחזר":"ריק";
      const bad=d.status==="empty"&&d.lengthIn&&r/d.lengthIn>REMAIN_WARN;
      b.innerHTML='<b>תוף '+esc(d.drumNo||"—")+' · '+esc(cableTypeLabel(d.cableType))+'</b><span>'+st+' · '+(drumOpen(d)?'נשארו ':'שארית ')+'<b'+(bad?' style="color:var(--clay)"':'')+'>'+fmtN(r)+'</b> מתוך '+fmtN(d.lengthIn)+' מ׳'+(d.location?' · '+esc(d.location):'')+'</span>';
      b.onclick=()=>openDrum(d.id); dl.appendChild(b); }); }
  const pl=$("#cbPulls"); if(pl){ const L=(shared.pulls||[]).slice().sort((a,b)=>b.ts-a.ts).slice(0,12);
    pl.innerHTML=L.length?L.map(p=>'<div><span>'+esc(isoText(p.date))+' · תוף '+esc(p.drumNo||"")+(p.area?' · '+esc(p.area):'')+(p.crew?' <small style="color:var(--ink3)">'+esc(p.crew)+'</small>':'')+'</span><b>'+fmtN(p.meters)+' מ׳</b></div>').join(""):'<div><span>עוד לא נרשמו משיכות</span><b></b></div>'; }
  renderAlerts();
}
export function __init(){
SUPPLIED_BY = {client:"היזם",main:"הקבלן הראשי",us:"שלנו"};
DRUM_ST = {full:"מלא",inUse:"בשימוש",empty:"ריק",returned:"הוחזר לספק"};
REMAIN_WARN = 0.05;
shared.drums=[]; shared.pulls=[]; shared.CABLE_TYPES=[];
try{ shared.drums=JSON.parse(ls.get("drums")||"[]"); if(!Array.isArray(shared.drums)) shared.drums=[]; }catch(e){ shared.drums=[]; }
try{ shared.pulls=JSON.parse(ls.get("pulls")||"[]"); if(!Array.isArray(shared.pulls)) shared.pulls=[]; }catch(e){ shared.pulls=[]; }
try{ const c=JSON.parse(ls.get("cableTypes")||"null"); if(c&&Array.isArray(c.types)) shared.CABLE_TYPES=c.types; }catch(e){}
const on=(id,f)=>{ const e=$(id); if(e) e.onclick=f; };
on("#btnPull",()=>openPull()); on("#btnDrum",()=>openDrumIntake()); on("#btnCableTypes",()=>openCableTypes());
on("#btnCablesCopy",async()=>{ const t=cablesText(); try{ await navigator.clipboard.writeText(t); toast("מאזן הכבלים הועתק."); }catch(e){ alertSheet("מאזן כבלים",'<pre style="white-space:pre-wrap;font:inherit">'+esc(t)+'</pre>'); } });
}
