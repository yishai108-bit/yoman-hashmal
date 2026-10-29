import { $, actorName, ask, closer, esc, fmtD, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { SITE, csvOf, loadScript, saveFile } from "./08-settings.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { renderSiteBuild } from "./19-site-build.js";
import { openWorkReport } from "./21-work.js";
export let isWorkday;
   // א׳–ה׳
// תבנית פעילויות החשמל של אתר סולארי (docs/templates/activities.csv). הכמויות והתאריכים הם נקודת פתיחה; מתקנים לפרויקט לפני השמירה.
export const ACTIVITY_TEMPLATE=[
  {name:"משיכת כבלי DC",unit:"מ׳",total:50000,start:"2026-11-23",workDays:60,group:"DC"},
  {name:"חיבורי סטרינגים",unit:"יח׳",total:1200,start:"2026-11-30",workDays:55,group:"DC"},
  {name:"קופסאות חיבורים",unit:"יח׳",total:40,start:"2026-12-07",workDays:30,group:"DC"},
  {name:"חיבור ממירים",unit:"יח׳",total:20,start:"2026-12-14",workDays:25,group:"AC"},
  {name:"הארקה",unit:"מ׳",total:8000,start:"2026-11-23",workDays:40,group:"הארקה"},
  {name:"תעלות ושרוולים",unit:"מ׳",total:1500,start:"2026-11-23",workDays:30,group:"תשתית"},
  {name:"כבלי AC",unit:"מ׳",total:3000,start:"2026-12-14",workDays:20,group:"AC"},
  {name:"מתח גבוה",unit:"תא",total:4,start:"2027-01-04",workDays:10,group:"MV"},
  {name:"בדיקות סטרינגים",unit:"יח׳",total:1200,start:"2026-12-21",workDays:30,group:"בדיקות"},
];
export function statusHolidays(){ const h=new Set(); shared.STATUS.forEach(a=>(a.daily||[]).forEach(d=>{ if(d.holiday) h.add(d.date); })); return h; }
export function workdaysBetween(fromIso,toIso,hol){ let n=0; if(!fromIso||fromIso>toIso) return 0; for(let t=new Date(fromIso+"T12:00:00").getTime(); t<=new Date(toIso+"T12:00:00").getTime(); t+=864e5){ const iso=isoOf(t); if(isWorkday(iso)&&!(hol&&hol.has(iso))) n++; } return n; }
export function statusCalc(a,hol){
  const daily=(a.daily||[]).slice().sort((x,y)=>x.date<y.date?-1:1);
  const done=daily.reduce((s,d)=>s+(Number(d.actual)||0),0);
  const first=a.start||(daily.find(d=>Number(d.actual))||{}).date||"";
  const today=isoOf(Date.now()); const total=Number(a.total)||0, wd=Number(a.workDays)||0;
  const passed=first?workdaysBetween(first,today,hol):0, left=Math.max(0,wd-passed);
  const remaining=Math.max(0,total-done);
  const reqOrig=wd?Math.round(total/wd):0, reqNow=remaining?(left?Math.ceil(remaining/left):null):0;
  const last7=daily.filter(d=>d.date>isoOf(Date.now()-7*864e5)&&Number(d.actual)).reduce((s,d)=>s+Number(d.actual),0);
  const lastDate=(daily.filter(d=>Number(d.actual)).pop()||{}).date||"";
  return {done,first,passed,left,pct:total?done/total:0,reqOrig,reqNow,last7,lastDate,remaining,daily};
}
export function renderStatus(){
  const el=$("#statusList"); if(!el) return; el.innerHTML="";
  const A=(shared.demoStock?[]:shared.STATUS).slice().sort((a,b)=>(a.order||0)-(b.order||0)); const hol=statusHolidays();
  renderSiteBuild();
  if(!A.length){ foldSum("status",""); el.innerHTML='<div class="empty" style="padding:16px">אין עדיין פעילויות. «תבנית פעילויות» למטה טוענת את פעילויות החשמל של אתר סולארי (משיכת DC, חיבורי סטרינגים, הארקה, ממירים, בדיקות) עם כמויות ותאריכים לתיקון. אפשר גם לייבא את קובץ הסטטוס של החברה.</div>'; return; }
  // קבוצות (DC, AC, הארקה…) לפי סדר ההופעה; בתוך קבוצה לפי סדר הפעילויות
  const gi=new Map(); A.forEach(a=>{ const g=a.group||""; if(!gi.has(g)) gi.set(g,gi.size); }); const anyG=gi.size>1||(gi.size===1&&!gi.has(""));
  if(anyG) A.sort((a,b)=>(gi.get(a.group||"")-gi.get(b.group||""))||((a.order||0)-(b.order||0)));
  let behind=0, doneN=0, lastG=null;
  A.forEach(a=>{ const c=statusCalc(a,hol); if(c.remaining===0) doneN++; else if(c.reqNow===null||(c.reqOrig&&c.reqNow>c.reqOrig*1.25)) behind++;
    if(anyG&&(a.group||"אחר")!==lastG){ lastG=a.group||"אחר"; const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--pv)"></i>'+esc(lastG)+'<span>'+A.filter(x=>(x.group||"אחר")===lastG).length+'</span>'; el.appendChild(h); }
    const col=c.remaining===0?"var(--sage)":(c.reqNow===null||(c.reqOrig&&c.reqNow>c.reqOrig*1.25))?"var(--clay)":(c.reqOrig&&c.reqNow>c.reqOrig)?"var(--amber)":"var(--ink)";
    const b=document.createElement("button"); b.type="button"; b.className="slip";
    b.innerHTML='<b>'+esc(a.name)+' <span class="num" style="color:'+col+'">'+fmtN(c.done)+'</span><small style="color:var(--ink3)"> / '+fmtN(a.total)+(a.unit?' '+esc(a.unit):'')+' · '+Math.round(c.pct*100)+'%</small></b>'
      +'<span style="display:block;height:6px;border-radius:3px;background:var(--line2);margin:6px 0 4px;overflow:hidden"><i style="display:block;height:100%;width:'+Math.min(100,Math.round(c.pct*100))+'%;background:'+col+'"></i></span>'
      +'<span>'+(c.remaining===0?'הושלם':(c.left?'נותרו '+c.left+' ימי עבודה · צריך <b style="color:'+col+'">'+fmtN(c.reqNow)+' ליום</b> (תכנון '+fmtN(c.reqOrig)+')':'<b style="color:var(--clay)">נגמרו ימי העבודה</b> · חסרים '+fmtN(c.remaining)))+(c.last7?' · 7 ימים אחרונים: '+fmtN(c.last7):'')+(c.lastDate?' · עדכון אחרון '+esc(isoText(c.lastDate)):'')+'</span>';
    b.onclick=()=>openStatusEntry(a); el.appendChild(b); });
  foldSum("status",(behind?behind+" בפיגור":"")+(doneN?(behind?" · ":"")+doneN+" הושלמו":"")||A.length+" פעילויות");
}
export async function saveStatus(a){
  try{ if(shared.DB) await shared.DB.doc("status/"+a.id).set(a); else { shared.STATUS=shared.STATUS.filter(x=>x.id!==a.id).concat(a); ls.set("status",JSON.stringify(shared.STATUS)); } }catch(e){ toast("השמירה נכשלה."); return false; }
  renderStatus(); return true;
}
export function openStatusEntry(a){
  a=shared.STATUS.find(x=>x.id===a.id)||a; const hol=statusHolidays(); const c=statusCalc(a,hol); const U=a.unit?' '+esc(a.unit):'';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="סטטוס פעילות"><div class="grab"></div><h2>'+esc(a.name)+'</h2>'
    +'<div class="kv"><span>בוצע <b>'+fmtN(c.done)+'</b> מתוך '+fmtN(a.total)+U+'</span><span>'+Math.round(c.pct*100)+'%</span><span>ימי עבודה: עברו <b>'+c.passed+'</b> · נותרו <b>'+c.left+'</b></span>'+(c.remaining?'<span>צריך <b>'+(c.reqNow===null?"—":fmtN(c.reqNow))+'</b> ליום (תכנון '+fmtN(c.reqOrig)+')</span>':'<span style="color:var(--sage)">הושלם</span>')+'</div>'
    +(ROLE!=="viewer"?'<button class="ghost strong" id="seWork" type="button" style="width:100%;margin-bottom:14px">דיווח ביצוע: כמות, אזור וצוות</button>'
      +'<div class="f"><label>רישום מהיר: סך הכול ליום</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input type="date" id="seDate" value="'+isoOf(Date.now())+'"><input type="text" id="seQty" inputmode="decimal" placeholder="כמות"></div><input type="text" id="seNote" placeholder="הערה (למשל: שדה 3, חג)" style="margin-top:8px"><button class="save" id="seSave" type="button" style="margin-top:8px;width:100%">שמור</button><div class="hint">מחליף רישום מהיר קודם של אותו יום. דיווחי ביצוע (עם אזור וצוות) נשארים לצדו.</div></div>':'')
    +'<div class="sechead"><span>רישומים אחרונים</span><span>'+c.daily.filter(d=>Number(d.actual)).length+' רישומים</span></div><div class="dlines" id="seList">'+c.daily.slice().reverse().filter(d=>Number(d.actual)||d.note).slice(0,30).map(d=>'<div data-d="'+esc(d.date)+'"'+(d.id?' data-i="'+esc(d.id)+'"':'')+'><span>'+esc(isoText(d.date))+(d.area||d.crew||d.note?' <small style="color:var(--ink3)">'+esc([d.area,d.crew,d.note].filter(Boolean).join(" · "))+'</small>':'')+'</span><b>'+(Number(d.actual)?fmtN(d.actual):'—')+'</b></div>').join("")+'</div>'
    +'<div class="acts">'+(ROLE==="owner"?'<button class="cancel danger" id="seDel" type="button">מחק פעילות</button>':'')+'<button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const q=x=>scrim.querySelector(x); const close=()=>scrim.remove();
  q(".cancel:not(.danger)").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  const wk=q("#seWork"); if(wk) wk.onclick=()=>{ close(); openWorkReport({activityId:a.id}); };
  scrim.querySelectorAll("#seList [data-d]").forEach(r=>r.onclick=()=>{ if(!q("#seDate")) return;
    if(r.dataset.i){ const d=(a.daily||[]).find(x=>x.id===r.dataset.i); close(); openWorkReport({activityId:a.id,entry:d}); return; }   // דיווח ביצוע: נפתח לעריכה
    const d=(a.daily||[]).find(x=>x.date===r.dataset.d&&!x.id); q("#seDate").value=r.dataset.d; q("#seQty").value=d&&Number(d.actual)?d.actual:""; q("#seNote").value=d?(d.note||""):""; q("#seQty").focus(); });
  const sv=q("#seSave"); if(sv) sv.onclick=async()=>{ const date=q("#seDate").value, qty=Number(String(q("#seQty").value).replace(",","."))||0, note=q("#seNote").value.trim(); if(!date){ toast("תאריך?"); return; }
    // הרישום המהיר הוא סך היום בלי אזור וצוות; דיווחי ביצוע (עם id) של אותו יום נשארים לצדו
    const daily=(a.daily||[]).filter(d=>!(d.date===date&&!d.id)); if(qty||note) daily.push({date,actual:qty,note,by:actorName(),ts:Date.now()});
    const doc={...a,daily:daily.sort((x,y)=>x.date<y.date?-1:1),updated:Date.now()}; sv.disabled=true;
    if(await saveStatus(doc)){ logAct("progress","add","סטטוס "+a.name+": "+fmtN(qty)+" ב-"+isoText(date)+(note?" · "+note:""),a.id); close(); } else sv.disabled=false; };
  const del=q("#seDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את הפעילות "+a.name+" מהסטטוס?","מחק","var(--clay)"))) return; try{ if(shared.DB) await shared.DB.doc("status/"+a.id).delete(); else { shared.STATUS=shared.STATUS.filter(x=>x.id!==a.id); ls.set("status",JSON.stringify(shared.STATUS)); } }catch(e){ toast("המחיקה נכשלה."); return; } close(); renderStatus(); };
}
/* ייבוא קובץ הסטטוס של החברה: גיליון לכל פעילות; בצד שמאל כמות כללית/ימי עבודה, ובבלוקים שבועיים תאריך · כמות ביצוע · כמות נדרשת · דגל יום עבודה */
export function parseStatusWorkbook(wb){
  const out=[]; let order=0;
  wb.SheetNames.forEach(n=>{ if(/מפה/.test(n)) return; const ws=wb.Sheets[n]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
    const left={}; rows.slice(0,16).forEach(r=>{ if(r&&typeof r[0]==="string"&&r[1]!=null) left[r[0].trim()]=r[1]; });
    const total=Number(left["כמות כללית"]); if(!total) return;
    const daily=[]; const toIso=v=>{ if(v instanceof Date) return isoOf(v.getTime()); if(typeof v==="number"&&v>40000&&v<60000){ const d=XLSX.SSF.parse_date_code(v); return d?d.y+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0"):""; } return ""; };
    rows.forEach((r,ri)=>{ if(!r) return; r.forEach((v,ci)=>{ if(ri===0&&ci===0) return; const iso=toIso(v); if(!iso) return; const act=r[ci+1], req=r[ci+2];
      if(typeof act==="number"||typeof act==="string"||(req!=null&&typeof req==="number")) daily.push({date:iso,actual:typeof act==="number"?act:0,note:typeof act==="string"?act.trim():"",holiday:typeof act==="string"&&!!act.trim()}); }); });
    const seen=new Set(); const dd=daily.filter(d=>!seen.has(d.date)&&seen.add(d.date)).filter(d=>d.actual||d.note).sort((a,b)=>a.date<b.date?-1:1);
    out.push({id:"st_"+(++order),order,name:n.trim(),total,workDays:Number(left["ימי עבודה לפעולה"])||0,start:(dd.find(d=>d.actual)||{}).date||"",daily:dd,source:"קובץ סטטוס"}); });
  return out;
}
/* פעילויות מתבנית או מ-CSV (name,unit,total,start,workDays,group). פעילות קיימת (אותו שם) מתעדכנת והרישומים שלה נשמרים. */
export function parseActivitiesCsv(text){
  const rows=String(text||"").replace(/^﻿/,"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{ const out=[]; let cur="",q=false; for(const ch of l){ if(ch==='"'){ q=!q; continue; } if(ch===","&&!q){ out.push(cur.trim()); cur=""; } else cur+=ch; } out.push(cur.trim()); return out; });
  if(!rows.length) return [];
  const H={name:/^(name|פעילות|שם)$/i,unit:/^(unit|יחידה)$/i,total:/^(total|כמות|סה.?כ|כמות כללית)$/i,start:/^(start|התחלה|תאריך התחלה)$/i,workDays:/^(workdays|ימי עבודה|ימי עבודה לפעולה)$/i,group:/^(group|קבוצה)$/i};
  const idx={}; Object.entries(H).forEach(([k,re])=>{ idx[k]=rows[0].findIndex(h=>re.test(h)); });
  const hasHead=idx.name>=0; if(!hasHead){ idx.name=0; idx.unit=1; idx.total=2; idx.start=3; idx.workDays=4; idx.group=5; }
  const g=(r,k)=>idx[k]>=0?String(r[idx[k]]||""):"";
  const iso=s=>{ let m=s.match(/^(\d{4})-(\d\d)-(\d\d)$/); if(m) return s; m=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/); return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):""; };
  return rows.slice(hasHead?1:0).map(r=>({name:g(r,"name"),unit:g(r,"unit"),total:Number(g(r,"total").replace(/,/g,""))||0,start:iso(g(r,"start")),workDays:Number(g(r,"workDays"))||0,group:g(r,"group")})).filter(r=>r.name&&r.total>0);
}
export async function saveActivities(rows){
  const now=Date.now(); let order=Math.max(0,...shared.STATUS.map(a=>Number(a.order)||0)), n=0, fail=0, i=0;
  const clean=rows.map(r=>({name:String(r.name||"").trim(),unit:String(r.unit||"").trim(),total:Number(String(r.total).replace(/,/g,""))||0,workDays:Number(r.workDays)||0,start:/^\d{4}-\d\d-\d\d$/.test(r.start||"")?r.start:"",group:String(r.group||"").trim()})).filter(r=>r.name&&r.total>0);
  if(!clean.length){ toast("צריך לפחות פעילות אחת עם שם וכמות."); return false; }
  for(const r of clean){ const ex=shared.STATUS.find(a=>a.name===r.name);
    const doc={...(ex||{id:"st"+now.toString(36)+"_"+(++i),order:++order,daily:[],source:"תבנית"}),...r,start:r.start||(ex&&ex.start)||"",updated:now};
    try{ if(shared.DB) await shared.DB.doc("status/"+doc.id).set(doc); else shared.STATUS=shared.STATUS.filter(x=>x.id!==doc.id).concat(doc); n++; }catch(e){ fail++; } }
  if(!shared.DB) ls.set("status",JSON.stringify(shared.STATUS));
  if(!n){ toast("השמירה נכשלה."); return false; }
  logAct("progress","edit","פעילויות: נשמרו "+n+(fail?" · "+fail+" נכשלו":""),"status"); renderStatus(); return n;
}
export function openActivityTemplate(){
  if(ROLE!=="owner"){ toast("פעילויות — בעלים בלבד."); return; }
  // הפעילויות הקיימות קודם (לעריכה), ואחריהן שורות התבנית שעוד אין
  const ex=new Map(shared.STATUS.map(a=>[a.name,a]));
  let rows=shared.STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(a=>({name:a.name,unit:a.unit||"",total:a.total,start:a.start||"",workDays:a.workDays||0,group:a.group||""})).concat(ACTIVITY_TEMPLATE.filter(t=>!ex.has(t.name)).map(r=>({...r})));
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="פעילויות"><div class="grab"></div><h2>פעילויות הפרויקט</h2>'
    +'<div class="note-card">תבנית פעילויות החשמל של אתר סולארי. מתקנים כמות, ימי עבודה ותאריך התחלה לפרויקט הזה, מוחקים מה שלא רלוונטי, ושומרים. פעילות שכבר קיימת (אותו שם) מתעדכנת והדיווחים שלה נשמרים. אפשר גם לייבא CSV: name,unit,total,start,workDays,group.</div>'
    +'<div id="atRows"></div><button class="addline" id="atAdd" type="button" style="margin-top:8px">+ פעילות</button>'
    +'<div class="pick" style="margin-top:10px;padding:14px">ייבוא מקובץ CSV<small>מחליף את הרשימה שלמעלה</small><input type="file" id="atFile" accept=".csv,text/csv"></div>'
    +'<div class="acts"><button class="save" id="atSave" type="button">שמור פעילויות</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const draw=()=>{ q("#atRows").innerHTML=rows.map((r,i)=>'<div class="atrow" data-i="'+i+'"><input type="text" data-k="name" value="'+esc(r.name)+'" placeholder="פעילות" aria-label="פעילות"><button type="button" class="x" aria-label="מחק">×</button>'
      +'<input type="text" data-k="total" inputmode="decimal" value="'+esc(r.total||"")+'" placeholder="כמות" aria-label="כמות"><input type="text" data-k="unit" value="'+esc(r.unit||"")+'" placeholder="יחידה" aria-label="יחידה"><input type="text" data-k="workDays" inputmode="numeric" value="'+esc(r.workDays||"")+'" placeholder="ימי עבודה" aria-label="ימי עבודה">'
      +'<input type="date" data-k="start" value="'+esc(r.start||"")+'" aria-label="התחלה"><input type="text" data-k="group" value="'+esc(r.group||"")+'" placeholder="קבוצה (DC, AC, הארקה)" aria-label="קבוצה">'
      +(ex.has(r.name)?'<small class="was">קיימת · '+fmtN(statusCalc(ex.get(r.name),new Set()).done)+' דווחו, נשמרים</small>':'')+'</div>').join("")||'<div class="empty">אין שורות. הוסף פעילות או ייבא CSV.</div>';
    scrim.querySelectorAll(".atrow input").forEach(inp=>inp.oninput=()=>{ rows[+inp.closest(".atrow").dataset.i][inp.dataset.k]=inp.value; });
    scrim.querySelectorAll(".atrow .x").forEach(x=>x.onclick=()=>{ rows.splice(+x.closest(".atrow").dataset.i,1); draw(); }); };
  q("#atAdd").onclick=()=>{ rows.push({name:"",unit:"",total:"",start:"",workDays:"",group:""}); draw(); const L=scrim.querySelectorAll('.atrow input[data-k="name"]'); if(L.length) L[L.length-1].focus(); };
  q("#atFile").onchange=async e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const R=parseActivitiesCsv(await f.text()); if(!R.length){ toast("לא נמצאו פעילויות בקובץ (צריך עמודות name ו-total)."); return; } rows=R; draw(); toast(R.length+" פעילויות מהקובץ. בדוק ושמור."); };
  q("#atSave").onclick=async()=>{ const b=q("#atSave"); b.disabled=true; b.textContent="שומר…"; const n=await saveActivities(rows); if(n===false){ b.disabled=false; b.textContent="שמור פעילויות"; return; } close(); toast("נשמרו "+n+" פעילויות."); };
  draw();
}
export function openStatusImport(){
  if(ROLE!=="owner"){ toast("ייבוא סטטוס — בעלים בלבד."); return; }
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ייבוא סטטוס"><div class="grab"></div><h2>ייבוא קובץ סטטוס התקדמות</h2><div class="note-card">קובץ הסטטוס של החברה (xlsx): גיליון לכל פעילות עם "כמות כללית", "ימי עבודה לפעולה" והבלוקים השבועיים. נקרא ישירות. רישומים יומיים שהוזנו באפליקציה בתאריכים שאינם בקובץ נשמרים.</div>'
    +'<div id="siBody"><div class="pick">בחר קובץ סטטוס<small>xlsx</small><input type="file" id="siFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div></div>'
    +'<div class="acts"><button class="save" id="siGo" hidden type="button">שמור סטטוס</button><button class="cancel" type="button">סגור</button></div></div>'); const q=x=>scrim.querySelector(x); let out=null;
  q(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#siFile").onchange=async e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; q("#siBody").innerHTML='<div class="prog"><i style="width:40%"></i></div><div class="prog-t"><span>קורא את הקובץ…</span></div>';
    try{ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"); const wb=XLSX.read(await f.arrayBuffer(),{type:"array",cellDates:true}); out=parseStatusWorkbook(wb); }catch(err){ out=null; }
    if(!out||!out.length){ q("#siBody").innerHTML='<div class="empty">זה לא נראה כמו קובץ הסטטוס (לא נמצאו גיליונות עם "כמות כללית").</div>'; return; }
    const hol=new Set(); q("#siBody").innerHTML='<div class="dlines">'+out.map(a=>{ const c=statusCalc(a,hol); return '<div><span>'+esc(a.name)+' <small style="color:var(--ink3)">· '+a.daily.filter(d=>d.actual).length+' ימים · '+a.workDays+' ימי עבודה</small></span><b>'+fmtN(c.done)+' / '+fmtN(a.total)+'</b></div>'; }).join("")+'</div>'; q("#siGo").hidden=false; };
  q("#siGo").onclick=async()=>{ if(!out) return; const b=q("#siGo"); b.disabled=true; b.textContent="שומר…";
    for(const a of out){ const ex=shared.STATUS.find(x=>x.name===a.name); const keep=ex?(ex.daily||[]).filter(d=>!a.daily.some(f=>f.date===d.date)):[]; const doc={...(ex||{}),...a,id:ex?ex.id:a.id,daily:a.daily.concat(keep).sort((x,y)=>x.date<y.date?-1:1),ts:Date.now()};
      try{ if(shared.DB) await shared.DB.doc("status/"+doc.id).set(doc); else { shared.STATUS=shared.STATUS.filter(x=>x.id!==doc.id).concat(doc); } }catch(e){} }
    if(!shared.DB) ls.set("status",JSON.stringify(shared.STATUS));
    logAct("progress","edit","יובא קובץ סטטוס התקדמות: "+out.length+" פעילויות","status"); scrim.remove(); toast("נשמרו "+out.length+" פעילויות."); renderStatus(); };
}
export function __init(){
/* ================= סטטוס התקדמות — כל הפעילויות (מבנה קובץ הסטטוס של החברה) ================= */
isWorkday = iso=>new Date(iso+"T12:00:00").getDay()<=4;
$("#btnStatusImp").onclick=openStatusImport;
const at=$("#btnActTpl"); if(at) at.onclick=openActivityTemplate;
$("#btnStatusCsv").onclick=()=>{ const hol=statusHolidays(); const A=shared.STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0)); if(!A.length){ toast("אין סטטוס."); return; }
  const sum=csvOf(["קבוצה","פעילות","יחידה","כמות כללית","בוצע","יתרה","אחוז","ימי עבודה לפעולה","עברו","נותרו","נדרש ליום מקורי","נדרש ליום עדכני","עדכון אחרון"],A.map(a=>{ const c=statusCalc(a,hol); return [a.group||"",a.name,a.unit||"",a.total,c.done,c.remaining,Math.round(c.pct*100)+"%",a.workDays,c.passed,c.left,c.reqOrig,c.reqNow===null?"":c.reqNow,c.lastDate?isoText(c.lastDate):""]; }));
  const det=csvOf(["פעילות","תאריך","כמות ביצוע","אזור","צוות","הערה","רשם"],A.flatMap(a=>(a.daily||[]).filter(d=>Number(d.actual)||d.note).map(d=>[a.name,isoText(d.date),d.actual||"",d.area||"",d.crew||"",d.note||"",d.by||""])));
  saveFile("סטטוס-התקדמות-"+isoOf(Date.now())+".csv",new Blob(["﻿סטטוס התקדמות "+SITE.name+" · "+fmtD(Date.now())+"\r\n"+sum.replace(/^﻿/,"")+"\r\n\r\nפירוט יומי\r\n"+det.replace(/^﻿/,"")],{type:"text/csv"})); };
}
