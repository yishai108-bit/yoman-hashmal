import { $, actorName, ask, closer, csvParse, esc, fmtD, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { SITE, csvOf, loadScript, saveFile } from "./08-settings.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { renderSiteBuild } from "./19-site-build.js";
import { openWorkReport, photoSrc } from "./21-work.js";
import { renderSiteStages } from "./24-site-stages.js";
import { ACTIVITY_TEMPLATE_CSV } from "./activities-template.js";
export let isWorkday;
   // א׳–ה׳
// תבנית הפעילויות של עין תמר: סעיפי ההסכם (docs/templates/activities.csv, מוטמע ב-activities-template.js): קוד סעיף, שם קצר, יחידה, כמות, ימי עובד בהסכם; תאריך התחלה וימי עבודה ריקים עד שממלאים.
export const ACTIVITY_TEMPLATE=parseActivitiesCsv(ACTIVITY_TEMPLATE_CSV);
// קבוצות (פרקים) שסגרו בלשונית ביצוע; לא נשמר, רק למסך הזה
const closedGroups=new Set();
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
  // planned = יש ימי עבודה בתכנון; בלי זה אין «נדרש ליום» ואין «בפיגור». ימי עובד: מההסכם (manDays) מול מה שדווח ב«עובדים» בדיווחי הביצוע
  const planned=wd>0, manPlan=Number(a.manDays)||0, manDone=daily.reduce((s,d)=>s+(Number(d.workers)||0),0);
  const last7=daily.filter(d=>d.date>isoOf(Date.now()-7*864e5)&&Number(d.actual)).reduce((s,d)=>s+Number(d.actual),0);
  const lastDate=(daily.filter(d=>Number(d.actual)).pop()||{}).date||"";
  // שורף: הסעיף צרך חלק גדול יותר מימי העובד שבהסכם מאשר מהכמות (מעל 15 נקודות). שם הרווח נשחק
  const pct=total?done/total:0, manPct=manPlan?manDone/manPlan:null, burn=manPlan>0&&manDone>=2&&manPct-pct>0.15;
  return {complete:total>0&&remaining===0,noQty:total<=0,done,first,passed,left,pct,reqOrig,reqNow,last7,lastDate,remaining,daily,planned,manPlan,manDone,manPct,burn};
}
export function renderStatus(){
  const el=$("#statusList"); if(!el) return; el.innerHTML="";
  const A=(shared.demoStock?[]:shared.STATUS).slice().sort((a,b)=>(a.order||0)-(b.order||0)); const hol=statusHolidays();
  renderSiteBuild(); renderSiteStages(); if(shared.renderStorage) shared.renderStorage();   // כרטיס האגירה (28-storage) נבנה מאותם סעיפים
  if(!A.length){ foldSum("status",""); el.innerHTML='<div class="empty" style="padding:16px">אין עדיין סעיפים. «תבנית פעילויות» למטה טוענת את 89 סעיפי ההסכם של עין תמר לפי פרקים (הארקה ומאריכים, תחנות MVS, תשתיות מ״ג, חדר חשמל, אבטחה, אגירה, חשמל זמני) עם הכמויות וימי העובד מההסכם. מוחקים מה שלא רלוונטי ומתקנים כמויות.</div>'; return; }
  // קבוצות (DC, AC, הארקה…) לפי סדר ההופעה; בתוך קבוצה לפי סדר הפעילויות
  const gi=new Map(); A.forEach(a=>{ const g=a.group||""; if(!gi.has(g)) gi.set(g,gi.size); }); const anyG=gi.size>1||(gi.size===1&&!gi.has(""));
  if(anyG) A.sort((a,b)=>(gi.get(a.group||"")-gi.get(b.group||""))||((a.order||0)-(b.order||0)));
  let behind=0, doneN=0, lastG=null;
  A.forEach(a=>{ const c=statusCalc(a,hol); const late=c.remaining>0&&c.planned&&(c.reqNow===null||(c.reqOrig&&c.reqNow>c.reqOrig*1.25)); if(c.complete) doneN++; else if(late) behind++;
    const g=a.group||"אחר";
    if(anyG&&g!==lastG){ lastG=g; const G=A.filter(x=>(x.group||"אחר")===g), gd=G.filter(x=>statusCalc(x,hol).remaining===0).length;
      // כותרת פרק: לחיצה מקפלת את הסעיפים שלו (89 סעיפים בעין תמר — בלי קיפול אי אפשר למצוא כלום)
      const h=document.createElement("button"); h.type="button"; h.className="grouphead"+(closedGroups.has(g)?" closed":""); h.setAttribute("aria-expanded",String(!closedGroups.has(g)));
      h.innerHTML='<i style="background:var(--pv)"></i>'+esc(g)+'<span>'+gd+' / '+G.length+'</span><span class="chev">▾</span>';
      h.onclick=()=>{ if(closedGroups.has(g)) closedGroups.delete(g); else closedGroups.add(g); renderStatus(); }; el.appendChild(h); }
    if(anyG&&closedGroups.has(g)) return;
    const col=c.complete?"var(--sage)":late?"var(--clay)":(c.planned&&c.reqOrig&&c.reqNow>c.reqOrig)?"var(--amber)":"var(--ink)";
    // שלוש שורות בלבד (גרסה 18): שם, פס, ושורה אחת של מצב. ימי עובד, 7 ימים ועדכון אחרון נמצאים בלחיצה על הסעיף
    const state=c.noQty?'בלי כמות: מוסיפים ב«תבנית פעילויות»':c.complete?'הושלם':!c.planned?'בלי לוח זמנים':c.left?'צריך <b style="color:'+col+'">'+fmtN(c.reqNow)+' ליום</b> · נותרו '+c.left+' ימים':'<b style="color:var(--clay)">נגמרו ימי העבודה</b> · חסרים '+fmtN(c.remaining);
    const b=document.createElement("button"); b.type="button"; b.className="slip st";
    b.innerHTML='<b class="st-nm">'+(a.code?'<span class="code">'+esc(a.code)+'</span>':'')+esc(a.name)+'</b>'
      +'<span class="st-bar"><i style="width:'+Math.min(100,Math.round(c.pct*100))+'%;background:'+col+'"></i></span>'
      +'<span class="st-meta"><span class="num"><b style="color:'+col+'">'+fmtN(c.done)+'</b> / '+fmtN(a.total)+(a.unit?' '+esc(a.unit):'')+' · '+Math.round(c.pct*100)+'%</span> · '+state
      +(c.burn?' · <b style="color:var(--clay)">שורף: '+Math.round(c.manPct*100)+'% מימי העובד מול '+Math.round(c.pct*100)+'% ביצוע</b>':'')+'</span>';
    b.onclick=()=>openStatusEntry(a); el.appendChild(b); });
  foldSum("status",(behind?behind+" בפיגור":"")+(doneN?(behind?" · ":"")+doneN+" הושלמו":"")||A.length+" פעילויות");
}
export async function saveStatus(a){
  try{ if(shared.DB) await shared.DB.doc("status/"+a.id).set(a); else { shared.STATUS=shared.STATUS.filter(x=>x.id!==a.id).concat(a); ls.set("status",JSON.stringify(shared.STATUS)); } }catch(e){ toast("השמירה נכשלה."); return false; }
  renderStatus(); return true;
}
export function openStatusEntry(a){
  a=shared.STATUS.find(x=>x.id===a.id)||a; const hol=statusHolidays(); const c=statusCalc(a,hol); const U=a.unit?' '+esc(a.unit):'';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="סטטוס פעילות"><div class="grab"></div><h2>'+(a.code?'<span class="code">'+esc(a.code)+'</span> ':'')+esc(a.name)+'</h2>'
    +(a.desc?'<div class="hint" style="margin:-6px 0 12px;white-space:pre-line">'+esc(a.desc)+'</div>':'')
    +'<div class="kv"><span>בוצע <b>'+fmtN(c.done)+'</b> מתוך '+fmtN(a.total)+U+'</span><span>'+Math.round(c.pct*100)+'%</span>'
    +(c.planned?'<span>ימי עבודה: עברו <b>'+c.passed+'</b> · נותרו <b>'+c.left+'</b></span>'+(c.remaining?'<span>צריך <b>'+(c.reqNow===null?"—":fmtN(c.reqNow))+'</b> ליום (תכנון '+fmtN(c.reqOrig)+')</span>':'<span style="color:var(--sage)">הושלם</span>'):(c.remaining?'<span>בלי לוח זמנים: תאריך התחלה וימי עבודה נקבעים ב«תבנית פעילויות»</span>':'<span style="color:var(--sage)">הושלם</span>'))
    +(c.manPlan||c.manDone?'<span>ימי עובד: <b>'+fmtN(c.manDone)+'</b> בפועל / '+(c.manPlan?fmtN(c.manPlan)+' בהסכם':'—')+'</span>':'')+'</div>'
    +(ROLE!=="viewer"?'<button class="ghost strong" id="seWork" type="button" style="width:100%;margin-bottom:14px">דיווח ביצוע: כמות, אזור וצוות</button>'
      +'<div class="f"><label>רישום מהיר: סך הכול ליום</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input type="date" id="seDate" value="'+isoOf(Date.now())+'"><input type="text" id="seQty" inputmode="decimal" placeholder="כמות"></div><input type="text" id="seNote" placeholder="הערה (למשל: שדה 3, חג)" style="margin-top:8px"><button class="save" id="seSave" type="button" style="margin-top:8px;width:100%">שמור</button><div class="hint">מחליף רישום מהיר קודם של אותו יום. דיווחי ביצוע (עם אזור וצוות) נשארים לצדו.</div></div>':'')
    +'<div class="sechead"><span>רישומים אחרונים</span><span>'+c.daily.filter(d=>Number(d.actual)).length+' רישומים</span></div><div class="dlines" id="seList">'+c.daily.slice().reverse().filter(d=>Number(d.actual)||d.note).slice(0,30).map(d=>'<div data-d="'+esc(d.date)+'"'+(d.id?' data-i="'+esc(d.id)+'"':'')+'><span>'+esc(isoText(d.date))+(d.area||d.crew||d.workers||d.note||photoSrc(d)?' <small style="color:var(--ink3)">'+esc([d.area,d.crew,d.workers?d.workers+" עובדים":"",d.note,photoSrc(d)?"📷":""].filter(Boolean).join(" · "))+'</small>':'')+'</span><b>'+(Number(d.actual)?fmtN(d.actual):'—')+'</b></div>').join("")+'</div>'
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
  const rows=csvParse(text); if(!rows.length) return [];
  const H={code:/^(code|סעיף|מס.? ?סעיף|קוד)$/i,name:/^(name|פעילות|שם)$/i,unit:/^(unit|יחידה)$/i,total:/^(total|כמות|סה.?כ|כמות כללית)$/i,manDays:/^(mandays|man_days|ימי עובד)$/i,start:/^(start|התחלה|תאריך התחלה)$/i,workDays:/^(workdays|ימי עבודה|ימי עבודה לפעולה)$/i,group:/^(group|קבוצה|פרק)$/i,desc:/^(desc|description|תיאור|פירוט)$/i};
  const idx={}; Object.entries(H).forEach(([k,re])=>{ idx[k]=rows[0].findIndex(h=>re.test(h)); });
  const hasHead=idx.name>=0; if(!hasHead){ Object.keys(H).forEach(k=>idx[k]=-1); idx.name=0; idx.unit=1; idx.total=2; idx.start=3; idx.workDays=4; idx.group=5; }
  const g=(r,k)=>idx[k]>=0?String(r[idx[k]]||"").trim():"";
  const iso=s=>{ let m=s.match(/^(\d{4})-(\d\d)-(\d\d)$/); if(m) return s; m=s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/); return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):""; };
  return rows.slice(hasHead?1:0).map(r=>({code:g(r,"code"),name:g(r,"name"),unit:g(r,"unit"),total:Number(g(r,"total").replace(/,/g,""))||0,manDays:Number(g(r,"manDays"))||0,start:iso(g(r,"start")),workDays:Number(g(r,"workDays"))||0,group:g(r,"group"),desc:g(r,"desc")})).filter(r=>r.name&&(r.total>0||r.code||r.group));
}
export async function saveActivities(rows){
  const now=Date.now(); let order=Math.max(0,...shared.STATUS.map(a=>Number(a.order)||0)), n=0, fail=0, i=0;
  const clean=rows.map(r=>({code:String(r.code||"").trim(),name:String(r.name||"").trim(),unit:String(r.unit||"").trim(),total:Number(String(r.total).replace(/,/g,""))||0,manDays:Number(r.manDays)||0,workDays:Number(r.workDays)||0,start:/^\d{4}-\d\d-\d\d$/.test(r.start||"")?r.start:"",group:String(r.group||"").trim(),desc:String(r.desc||"").trim()})).filter(r=>r.name&&(r.total>0||r.code||r.group));
  if(!clean.length){ toast("צריך לפחות פעילות אחת עם שם וכמות."); return false; }
  // פעילות קיימת מזוהה לפי קוד הסעיף, ובלי קוד לפי השם; הדיווחים (daily) שלה נשמרים
  for(const r of clean){ const ex=shared.STATUS.find(a=>(r.code&&a.code)?a.code===r.code:a.name===r.name);
    const doc={...(ex||{id:"st"+now.toString(36)+"_"+(++i),order:++order,daily:[],source:"תבנית"}),...r,start:r.start||(ex&&ex.start)||"",updated:now};
    try{ if(shared.DB) await shared.DB.doc("status/"+doc.id).set(doc); else shared.STATUS=shared.STATUS.filter(x=>x.id!==doc.id).concat(doc); n++; }catch(e){ fail++; } }
  if(!shared.DB) ls.set("status",JSON.stringify(shared.STATUS));
  if(!n){ toast("השמירה נכשלה."); return false; }
  if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }   // מופע ריק: הסעיפים שנשמרו הם הנתון האמיתי הראשון, לא מציגים עוד דוגמה
  logAct("progress","edit","פעילויות: נשמרו "+n+(fail?" · "+fail+" נכשלו":""),"status"); renderStatus(); return n;
}
export function openActivityTemplate(){
  if(ROLE!=="owner"){ toast("פעילויות — בעלים בלבד."); return; }
  // הפעילויות הקיימות קודם (לעריכה), ואחריהן שורות התבנית שעוד אין
  const key=a=>a.code||a.name; const ex=new Map(shared.STATUS.map(a=>[key(a),a]));
  let rows=shared.STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(a=>({code:a.code||"",name:a.name,unit:a.unit||"",total:a.total,manDays:a.manDays||"",start:a.start||"",workDays:a.workDays||0,group:a.group||"",desc:a.desc||""})).concat(ACTIVITY_TEMPLATE.filter(t=>!ex.has(key(t))).map(r=>({...r,manDays:r.manDays||""})));
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="פעילויות"><div class="grab"></div><h2>פעילויות הפרויקט</h2>'
    +'<div class="note-card">תבנית סעיפי ההסכם של עין תמר: '+ACTIVITY_TEMPLATE.length+' סעיפים לפי פרקים, עם קוד סעיף, כמות וימי עובד מההסכם. מתקנים כמות, מוסיפים תאריך התחלה וימי עבודה למה שמתחיל, מוחקים מה שלא רלוונטי, ושומרים. סעיף שכבר קיים (אותו קוד) מתעדכן והדיווחים שלו נשמרים. אפשר גם לייבא CSV: code,name,unit,total,manDays,start,workDays,group,desc.</div>'
    +'<div id="atRows"></div><button class="addline" id="atAdd" type="button" style="margin-top:8px">+ פעילות</button>'
    +'<div class="pick" style="margin-top:10px;padding:14px">ייבוא מקובץ CSV<small>מחליף את הרשימה שלמעלה</small><input type="file" id="atFile" accept=".csv,text/csv"></div>'
    +'<div class="acts"><button class="save" id="atSave" type="button">שמור פעילויות</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const draw=()=>{ let lastG=null; q("#atRows").innerHTML=rows.map((r,i)=>{ const g=r.group||"", k=r.code||r.name;
      const head=g!==lastG?(lastG=g,'<div class="grouphead"><i style="background:var(--pv)"></i>'+esc(g||"בלי פרק")+'</div>'):"";   // כותרת פרק בין הסעיפים
      return head+'<div class="atrow" data-i="'+i+'"><input type="text" data-k="code" value="'+esc(r.code||"")+'" placeholder="סעיף" aria-label="סעיף"><input type="text" data-k="name" value="'+esc(r.name)+'" placeholder="פעילות" aria-label="פעילות"><button type="button" class="x" aria-label="מחק">×</button>'
      +'<input type="text" data-k="total" inputmode="decimal" value="'+esc(r.total||"")+'" placeholder="כמות" aria-label="כמות"><input type="text" data-k="unit" value="'+esc(r.unit||"")+'" placeholder="יחידה" aria-label="יחידה"><input type="text" data-k="manDays" inputmode="numeric" value="'+esc(r.manDays||"")+'" placeholder="ימי עובד בהסכם" aria-label="ימי עובד בהסכם">'
      +'<input type="date" data-k="start" value="'+esc(r.start||"")+'" aria-label="התחלה"><input type="text" data-k="workDays" inputmode="numeric" value="'+esc(r.workDays||"")+'" placeholder="ימי עבודה" aria-label="ימי עבודה"><input type="text" data-k="group" value="'+esc(r.group||"")+'" placeholder="פרק / קבוצה" aria-label="פרק / קבוצה">'
      +(ex.has(k)?'<small class="was">קיימת · '+fmtN(statusCalc(ex.get(k),new Set()).done)+' דווחו, נשמרים</small>':'')+'</div>'; }).join("")||'<div class="empty">אין שורות. הוסף פעילות או ייבא CSV.</div>';
    scrim.querySelectorAll(".atrow input").forEach(inp=>inp.oninput=()=>{ rows[+inp.closest(".atrow").dataset.i][inp.dataset.k]=inp.value; });
    scrim.querySelectorAll(".atrow .x").forEach(x=>x.onclick=()=>{ rows.splice(+x.closest(".atrow").dataset.i,1); draw(); }); };
  q("#atAdd").onclick=()=>{ rows.push({code:"",name:"",unit:"",total:"",manDays:"",start:"",workDays:"",group:rows.length?rows[rows.length-1].group||"":"",desc:""}); draw(); const L=scrim.querySelectorAll('.atrow input[data-k="name"]'); if(L.length) L[L.length-1].focus(); };
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
  const sum=csvOf(["פרק","סעיף","פעילות","יחידה","כמות כללית","בוצע","יתרה","אחוז","ימי עובד בהסכם","ימי עובד בפועל","ימי עבודה לפעולה","עברו","נותרו","נדרש ליום מקורי","נדרש ליום עדכני","עדכון אחרון"],A.map(a=>{ const c=statusCalc(a,hol); return [a.group||"",a.code||"",a.name,a.unit||"",a.total,c.done,c.remaining,Math.round(c.pct*100)+"%",a.manDays||"",c.manDone||"",a.workDays||"",c.passed,c.left,c.reqOrig||"",c.reqNow===null?"":c.reqNow,c.lastDate?isoText(c.lastDate):""]; }));
  const det=csvOf(["סעיף","פעילות","תאריך","כמות ביצוע","אזור","צוות","עובדים","הערה","רשם"],A.flatMap(a=>(a.daily||[]).filter(d=>Number(d.actual)||d.note).map(d=>[a.code||"",a.name,isoText(d.date),d.actual||"",d.area||"",d.crew||"",d.workers||"",d.note||"",d.by||""])));
  saveFile("סטטוס-התקדמות-"+isoOf(Date.now())+".csv",new Blob(["﻿סטטוס התקדמות "+SITE.name+" · "+fmtD(Date.now())+"\r\n"+sum.replace(/^﻿/,"")+"\r\n\r\nפירוט יומי\r\n"+det.replace(/^﻿/,"")],{type:"text/csv"})); };
}
