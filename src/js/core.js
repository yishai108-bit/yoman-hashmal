import { renderOverview } from "./01-stock.js";
import { ROLE } from "./18-identity.js";
export let shared, unitMult, unitOf, fmtD, fmtDT, $, ls, byId, toastT, UID, uidTried, LOG_KINDS, actorName;
export function toast(msg){
  let t=document.querySelector(".toast");
  if(!t){ t=document.createElement("div"); t.className="toast"; t.setAttribute("role","status"); document.body.appendChild(t); }
  t.textContent=msg; t.hidden=false;
  clearTimeout(toastT); toastT=setTimeout(()=>{ t.hidden=true; },3200);
}
// חלון קופץ: יוצר את הרקע, שם בו את ה-HTML ומוסיף לדף. מחזיר את הרקע (scrim).
// opts.z: שכבה מעל חלון אחר (למשל סורק מעל טופס).
export function popup(html,opts){
  const scrim=document.createElement("div"); scrim.className="scrim";
  if(opts&&opts.z) scrim.style.zIndex=String(opts.z);
  scrim.innerHTML=html; document.body.appendChild(scrim);
  return scrim;
}
// סגירה של חלון: מחזירה close(), ומחברת אותה ל-Escape (רק לחלון העליון) וללחיצה על הרקע.
// after: מה לעשות אחרי הסגירה (למשל לעצור מצלמה).
export function closer(scrim,after){
  const k=ev=>{ if(ev.key==="Escape"&&[...document.querySelectorAll(".scrim")].pop()===scrim) close(); };
  function close(){ document.removeEventListener("keydown",k); scrim.remove(); if(after) after(); }
  document.addEventListener("keydown",k);
  scrim.addEventListener("click",e=>{ if(e.target===scrim) close(); });
  return close;
}
export function ask(msg, okLabel, color, sub){
  return new Promise(res=>{
    const scrim=popup('<div class="sheet" role="alertdialog" aria-modal="true">'
      +'<div class="grab"></div><h2>'+esc(msg)+'</h2>'
      +(sub?'<div class="note-card">'+esc(sub)+'</div>':'')
      +'<div class="acts"><button class="save" type="button" style="background:'+(color||"var(--clay)")+'">'+esc(okLabel||"מחק")+'</button>'
      +'<button class="cancel" type="button">ביטול</button></div></div>');
    const done=v=>{ scrim.remove(); res(v); };
    scrim.querySelector(".save").onclick=()=>done(true);
    scrim.querySelector(".cancel").onclick=()=>done(false);
    scrim.onclick=e=>{ if(e.target===scrim) done(false); };
    scrim.querySelector(".cancel").focus();
  });
}
export async function logAct(kind,action,summary,ref,who,data){
  if(shared.USER && UID===null && !uidTried){ uidTried=true; try{ UID=await shared.USER.id(); }catch(e){ UID=null; } }
  const rec={id:"lg"+Date.now()+Math.random().toString(36).slice(2,5),ts:Date.now(),kind,action,
    summary:String(summary||"").slice(0,240),ref:ref?String(ref):"",who:(who||actorName()).slice(0,60),uid:UID||"",
    dev:/Mobi|Android/i.test(navigator.userAgent)?"mobile":"desktop"};
  if(data){ try{ let s=JSON.stringify(data); if(s.length>6000) s=s.slice(0,6000); rec.data=s; }catch(e){} }
  try{
    if(shared.DB) await shared.DB.doc("log/"+rec.id).set(rec);
    else { shared.logs.unshift(rec); if(shared.logs.length>1500) shared.logs=shared.logs.slice(0,1500); ls.set("log",JSON.stringify(shared.logs)); }
  }catch(e){ /* היומן לא חוסם את העבודה */ }
}
/* ---------- הגדרות שהן מפה (ספקים, ברקודים, כינויים) ---------- */
// שומרים רק את המפתחות שהשתנו, על גבי מה שיש במאגר עכשיו, ולא את כל המפה מהזיכרון:
// כך שתי שמירות כמעט בו זמנית (שני מכשירים) לא מוחקות זו לזו ספק או ברקוד.
// לפי כללי הגישה רק הבעלים כותב ל-settings; למי שאינו בעלים השינוי נשאר בזיכרון בלבד,
// במקום שמירה שנכשלת (עד גרסה 51 זה הפיל את שמירת בקשת הרכש של עורך: «השמירה נכשלה» אחרי שהבקשה כבר נשמרה).
export async function mergeSettingsMap(name,patch){
  if(!patch||!Object.keys(patch).length) return;
  if(!shared.DB){ let cur={}; try{ cur=JSON.parse(ls.get(name)||"{}")||{}; }catch(e){} ls.set(name,JSON.stringify({...cur,...patch})); return; }
  if(ROLE!=="owner") return;
  const ref=shared.DB.doc("settings/"+name);
  const snap=await ref.get();
  const d=snap&&snap.exists?snap.data():null;
  const cur=d&&d.map&&typeof d.map==="object"?d.map:{};
  await ref.set({map:{...cur,...patch},ts:Date.now()});
}
export function openLog(){
  let kind="all", max=60;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="יומן פעולות"><div class="grab"></div><h2>יומן פעולות</h2>'
    +'<div class="note-card">כל שמירה, עדכון ומחיקה באפליקציה, עם השם שהוקלד, המכשיר והשעה. מחיקות שומרות עותק של מה שנמחק.</div>'
    +'<div class="chips" id="lgChips"></div><div class="stock" id="lgList"></div>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  const close=closer(scrim);
  const q=s=>scrim.querySelector(s);
  q(".cancel").onclick=close;
  async function draw(){
    const present=[...new Set(shared.logs.map(l=>l.kind))];
    q("#lgChips").innerHTML='<button type="button" class="chip2" data-k="all" aria-pressed="'+(kind==="all")+'">הכל <span class="num">'+shared.logs.length+'</span></button>'
      +present.map(k=>'<button type="button" class="chip2" data-k="'+esc(k)+'" aria-pressed="'+(kind===k)+'">'+esc(LOG_KINDS[k]||k)+'</button>').join("");
    const rows=shared.logs.filter(l=>kind==="all"||l.kind===kind).slice().sort((a,b)=>b.ts-a.ts);
    const box=q("#lgList"); box.innerHTML="";
    if(!rows.length){ box.innerHTML='<div class="empty">עוד אין פעולות ביומן. מהשמירה הבאה הכל נרשם.</div>'; return; }
    let names={};
    const uids=[...new Set(rows.slice(0,max).map(l=>l.uid).filter(Boolean))];
    if(shared.USER&&uids.length){ try{ names=await shared.USER.profiles(uids); }catch(e){ names={}; } }
    rows.slice(0,max).forEach(l=>{
      const d=new Date(l.ts); const nm=(names[l.uid]&&names[l.uid].name)||"";
      const who=l.who&&nm&&l.who!==nm ? l.who+" ("+nm+")" : (l.who||nm||"—");
      const el=document.createElement("div"); el.className="logrow";
      el.innerHTML='<b>'+esc(l.summary||"")+'</b><span class="k '+esc(l.action||"")+'">'+esc(LOG_KINDS[l.kind]||l.kind||"")+(l.action==="delete"?" · מחיקה":l.action==="edit"?" · עדכון":"")+'</span>'
        +'<span class="w">'+fmtD(d)+' '+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})+' · '+esc(who)+(l.dev==="mobile"?" · טלפון":"")+(l.data?' · <u style="cursor:pointer" data-show="'+esc(l.id)+'">מה נמחק</u>':'')+'</span>';
      const u=el.querySelector("[data-show]"); if(u) u.onclick=()=>{ try{ const o=JSON.parse(l.data); alertSheet("מה נמחק",'<pre style="white-space:pre-wrap;font-size:.78rem;direction:rtl">'+esc(JSON.stringify(o,null,1).slice(0,4000))+'</pre>'); }catch(e){} };
      box.appendChild(el);
    });
    if(rows.length>max){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent="עוד "+(rows.length-max); m.onclick=()=>{ max+=100; draw(); }; box.appendChild(m); }
  }
  q("#lgChips").onclick=e=>{ const b=e.target.closest("[data-k]"); if(!b) return; kind=b.dataset.k; max=60; draw(); };
  draw();
}
export function alertSheet(title,html){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><h2>'+esc(title)+'</h2>'+html
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
}
/* ---------- render ---------- */
export function render(){
  renderOverview();
}
// כתובת של קובץ שהועלה (תמונה, חתימה): ב-artifact /_blob/<id>, באפליקציה העצמאית כתובת ב-Storage
export function blobUrl(id){ const a=window.claude&&window.claude.__app; return a?a.blobUrl(id):"/_blob/"+id; }
export function esc(s){return String(s??"").replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));}
export function __init(){
// מצב משותף: משתנים שקובץ אחד מגדיר וקובץ אחר משנה. מרוכזים כאן כדי שהמעבר למודולים יהיה אפשרי.
shared = {};
// תעודות ברגים נרשמות ב"אלף" או ב"מאה" (0.5 אלף = 500 יחידות). כל חישוב כמויות עובר דרך המכפיל.
unitMult = u=>/אלף/.test(String(u||""))?1000:/^\s*מאה\s*$/.test(String(u||""))?100:1;
unitOf = u=>unitMult(u)>1?"יח'":(u||"");
fmtD = t=>{ const d=t instanceof Date?t:new Date(t); if(isNaN(d)) return ""; const y=d.getFullYear(); return d.getDate()+"."+(d.getMonth()+1)+(y!==new Date().getFullYear()?"."+y:""); };
fmtDT = x=>{ const m=String(x||"").match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/); if(!m) return x||""; return fmtD(new Date(+m[3],+m[2]-1,+m[1],12)); };
$ = s => document.querySelector(s);
ls = { get:k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } },
             set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };
byId = (arr,id) => arr.find(x=>x.id===id);
toastT = null;
shared.DB=null;
shared.ASSETS=null;
shared.SAMPLE=null;
shared.DOWNLOADS=null;
shared.USER=null;
shared.IS_OWNER=null;
UID = null;
shared.unsub=null;
/* ---------- יומן פעולות (audit log): מי, מתי, מה ---------- */
shared.logs=[];
uidTried = false;
LOG_KINDS = {issue:"ניפוק",count:"ספירה",progress:"ביצוע",delivery:"תעודה",move:"הוצאה",settings:"הגדרות",import:"ייבוא",backup:"גיבוי",daylog:"עובדים",boq:"כתב כמויות",cable:"כבלים",blocker:"חריג"};
actorName = ()=>(ls.get("issuer")||"").trim();
}

// CSV סטנדרטי: שדות במירכאות עם «""» למירכאה בתוך שדה ושורות חדשות בתוך מירכאות; BOM נזרק. מחזיר מערך שורות של מחרוזות (שורות ריקות נזרקות).
export function csvParse(text){
  const s=String(text||"").replace(/^﻿/,""); const rows=[]; let row=[], cur="", q=false;
  for(let i=0;i<s.length;i++){ const ch=s[i];
    if(q){ if(ch==='"'){ if(s[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; continue; }
    if(ch==='"') q=true; else if(ch===","){ row.push(cur); cur=""; } else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&s[i+1]==="\n") i++; row.push(cur); if(row.some(c=>c.trim())) rows.push(row.map(c=>c.trim())); row=[]; cur=""; } else cur+=ch; }
  row.push(cur); if(row.some(c=>c.trim())) rows.push(row.map(c=>c.trim()));
  return rows;
}
