import { hit, panelQ, renderOverview } from "./01-stock.js";
import { renderPanelBal } from "./05-panels.js";
import { ROLE } from "./18-identity.js";
export let shared, unitMult, unitOf, BLAME, DEMO, fmtD, fmtDT, $, ls, byId, toastT, UID, uidTried, LOG_KINDS, actorName, draft;
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
  renderOverview(); renderPanelBal();
  const rows = shared.demoMode ? DEMO : shared.records;
  $("#demoBar").hidden = !shared.demoMode;
  $("#listLabel").textContent = shared.demoMode ? "רשומות לדוגמה" : "רשומות";
  $("#listCount").textContent = rows.length ? rows.length + " פאנלים" : "";

  const counts = {};
  BLAME.forEach(b => counts[b.id] = rows.filter(r=>r.blame===b.id).length);
  const total = rows.length;
  const unknown = counts.unknown;
  const claimable = BLAME.filter(b=>b.claim).reduce((s,b)=>s+counts[b.id],0);
  const weekAgo = Date.now()-7*86400000;
  const week = rows.filter(r=>r.ts>=weekAgo).length;

  $("#hUnknown").textContent = unknown;
  $("#sTotal").textContent = total;
  $("#sClaim").textContent = claimable;
  $("#sWeek").textContent = week;

  const bar = $("#bar"), keys = $("#keys");
  bar.innerHTML=""; keys.innerHTML="";
  BLAME.forEach(b=>{
    if(!counts[b.id]) return;
    const s=document.createElement("span");
    s.style.flex = counts[b.id];
    s.style.background = b.color;
    s.title = b.label + " · " + counts[b.id];
    bar.appendChild(s);
    const k=document.createElement("span");
    k.innerHTML = '<i style="background:'+b.color+'"></i>'+b.label+'<b class="num">'+counts[b.id]+'</b>';
    keys.appendChild(k);
  });
  if(!total){ bar.innerHTML='<span style="flex:1;background:var(--line2)"></span>'; }

  const list=$("#list"); list.innerHTML="";
  if(!rows.length){
    list.innerHTML='<div class="empty">אין עדיין רשומות.<br>לחץ על «רישום פאנל שבור» כדי להתחיל.</div>';
    return;
  }
  const shownP = rows.filter(r=>hit(r.serial,panelQ)||hit(r.note,panelQ))
                     .sort((a,b)=>b.ts-a.ts);
  $("#listCount").textContent = shownP.length? shownP.length+" פאנלים" : "";
  if(!shownP.length){
    list.innerHTML='<div class="empty">אין פאנל שמתאים לחיפוש.</div>'; return;
  }
  shownP.slice(0,shared.panelMax).forEach(r=>{
    const b = byId(BLAME,r.blame) || byId(BLAME,"unknown");
    const el=document.createElement("div");
    el.className="rec"+(r.blame==="unknown"?" unknown":"");
    const dsrc = r.damageAsset ? "/_blob/"+r.damageAsset : r.damageUrl;
    const img = dsrc
      ? '<img class="thumb" src="'+dsrc+'" alt="">'
      : '<div class="thumb"></div>';
    const bits=[ r.note, fmtD(r.ts) ].filter(Boolean);
    el.innerHTML = img
      + '<div class="sn">'+esc(r.serial||"ללא מספר סידורי")+'</div>'
      + '<div class="side"><span class="chip '+b.cls+'">'+esc(r.blame==="unknown"&&r.blameOther ? "אחר: "+r.blameOther : b.label)+'</span>'
      + (r.demo?'':'<button class="del" data-del="'+r.id+'">מחק</button>')+'</div>'
      + '<div class="meta">'+bits.map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>';
    list.appendChild(el);
  });
  if(shownP.length>shared.panelMax){
    const b=document.createElement("button");
    b.className="more"; b.type="button";
    b.textContent="הצג עוד "+(shownP.length-shared.panelMax);
    b.onclick=()=>{shared.panelMax+=40; render();};
    list.appendChild(b);
  }
}
export function esc(s){return String(s??"").replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));}
export function openSheet(){
  draft = {serial:"",blame:"",blameOther:"",note:"",
           labelBlob:null,damageBlob:null,labelUrl:"",damageUrl:""};
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="רישום פאנל שבור">'
  + '<div class="grab"></div><h2>רישום פאנל שבור</h2>'
  + '<div class="f"><label>תמונות</label><div class="shots">'
    + '<div class="shot" id="shotLabel"><i class="ic ic-cam big"></i>צלם את המדבקה<input type="file" accept="image/*" capture="environment" id="fLabel" aria-label="תמונת המדבקה"></div>'
    + '<div class="shot" id="shotDamage"><i class="ic ic-cam big"></i>צלם את הנזק<input type="file" accept="image/*" capture="environment" id="fDamage" aria-label="תמונת הנזק"></div>'
  + '</div><div class="ai" id="aiLine"></div></div>'
  + '<div class="f"><label for="iSerial">מספר סידורי</label>'
    + '<input type="text" class="sn" id="iSerial" inputmode="latin" autocomplete="off" placeholder="צלם את המדבקה או הקלד">'
    + '<div class="hint">אחרי צילום המדבקה המספר ימולא לבד — תמיד בדוק אותו מול הפאנל.</div></div>'
  + '<div class="f"><label>מי שבר</label><div class="opts" id="oBlame"></div>'
    + '<input type="text" id="iOther" placeholder="פירוט — מי או מה" style="margin-top:8px" hidden></div>'
  + '<div class="f"><label for="iNote">הערה / תיאור</label>'
    + '<textarea id="iNote" placeholder="מה קרה, איפה, מתי התגלה, סוג הנזק"></textarea></div>'
  + '<div class="acts"><button class="save" id="bSave" disabled>שמור רשומה</button>'
    + '<button class="cancel" id="bCancel">ביטול</button></div></div>');

  opts("#oBlame",BLAME,"blame");
  scrim.querySelector("#iSerial").oninput = e => {draft.serial=e.target.value.trim(); check();};
  scrim.querySelector("#iNote").oninput  = e => draft.note=e.target.value;
  scrim.querySelector("#iOther").oninput = e => draft.blameOther=e.target.value.trim();
  scrim.querySelector("#fLabel").onchange  = e => shot(e,"label");
  scrim.querySelector("#fDamage").onchange = e => shot(e,"damage");
  scrim.querySelector("#bCancel").onclick = close;
  scrim.querySelector("#bSave").onclick = save;
  scrim.onclick = e => { if(e.target===scrim) close(); };
  document.addEventListener("keydown", esckey);

  function opts(sel,items,key){
    const box=scrim.querySelector(sel);
    items.forEach(it=>{
      const b=document.createElement("button");
      b.className="opt"; b.type="button"; b.setAttribute("aria-pressed","false");
      b.innerHTML = it.label + (it.note?'<small>'+it.note+'</small>':'');
      b.onclick=()=>{
        box.querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed","false"));
        b.setAttribute("aria-pressed","true"); draft[key]=it.id;
        if(key==="blame"){ const o=scrim.querySelector("#iOther"); o.hidden = it.id!=="unknown"; if(!o.hidden) o.focus(); }
        check();
      };
      box.appendChild(b);
    });
  }
  function check(){
    scrim.querySelector("#bSave").disabled = !(draft.serial && draft.blame);
  }
  async function shot(e,which){
    const file=e.target.files&&e.target.files[0]; if(!file) return;
    const url=URL.createObjectURL(file);
    draft[which+"Blob"]=file; draft[which+"Url"]=url;
    const box=scrim.querySelector(which==="label"?"#shotLabel":"#shotDamage");
    box.querySelectorAll("img,.tag").forEach(n=>n.remove());
    const img=new Image(); img.src=url; img.alt="";
    const tag=document.createElement("div"); tag.className="tag";
    tag.textContent = which==="label"?"מדבקה":"נזק";
    box.appendChild(img); box.appendChild(tag);
    if(which==="label") readSerial(file);
  }
  async function readSerial(file){
    const line=scrim.querySelector("#aiLine");
    if(!shared.SAMPLE){ line.textContent="הקלד את המספר הסידורי ידנית."; return; }
    line.textContent="קורא את המדבקה…";
    try{
      const out = await shared.SAMPLE.json(
        "בתמונה מדבקה של פאנל סולארי. החזר רק JSON: "
        + '{"serial":"<המספר הסידורי המלא בדיוק כפי שמופיע, או null>"}. '
        + "המספר הסידורי הוא בדרך כלל המחרוזת הארוכה ביותר של אותיות לטיניות וספרות, "
        + "לרוב מתחת לברקוד. אל תמציא. אם לא קריא — null.",
        {images:file, modelTier:"quick"}
      );
      if(out && out.serial){
        draft.serial=String(out.serial).trim();
        scrim.querySelector("#iSerial").value=draft.serial;
        line.textContent="נקרא מהמדבקה — בדוק שזה נכון";
        check();
      } else {
        line.textContent="לא הצלחתי לקרוא — הקלד ידנית";
      }
    }catch(err){
      line.textContent = err && err.code==="not_granted"
        ? "קריאה אוטומטית לא זמינה — הקלד ידנית"
        : "לא הצלחתי לקרוא — הקלד ידנית";
    }
  }
  async function save(){
    const btn=scrim.querySelector("#bSave");
    btn.disabled=true; btn.textContent="שומר…";
    const rec={ id:"p"+Date.now()+Math.random().toString(36).slice(2,6),
      serial:draft.serial, blame:draft.blame, blameOther:draft.blame==="unknown"?(draft.blameOther||""):"", note:draft.note||"",
      ts:Date.now(), labelAsset:"", damageAsset:"", labelUrl:"", damageUrl:"" };
    try{
      if(shared.ASSETS){
        if(draft.labelBlob){ const a=await shared.ASSETS.upload(draft.labelBlob);
          rec.labelAsset=a.id; rec.labelUrl=a.url; }
        if(draft.damageBlob){ const a=await shared.ASSETS.upload(draft.damageBlob);
          rec.damageAsset=a.id; rec.damageUrl=a.url; }
      }
    }catch(e){ /* keep the record even if a photo fails */ }
    try{
      if(shared.DB) await shared.DB.collection("panels").doc(rec.id).set(rec);
      else { shared.records.push(rec); ls.set("panels",JSON.stringify(shared.records)); }
    }catch(e){
      btn.disabled=false; btn.textContent="שמור רשומה";
      toast("השמירה נכשלה. נסה שוב."); return;
    }
    logAct("panel","add","פאנל שבור "+rec.serial+" · "+((byId(BLAME,rec.blame)||{}).label||rec.blame),rec.id);
    if(shared.demoMode){ shared.demoMode=false; ls.set("demoDone","1"); }
    close(); render();
  }
  function esckey(ev){ if(ev.key==="Escape") close(); }
  function close(){
    document.removeEventListener("keydown",esckey);
    scrim.remove();
  }
}
export function __init(){
// מצב משותף: משתנים שקובץ אחד מגדיר וקובץ אחר משנה. מרוכזים כאן כדי שהמעבר למודולים יהיה אפשרי.
shared = {};
// תעודות ברגים נרשמות ב"אלף" או ב"מאה" (0.5 אלף = 500 יחידות). כל חישוב כמויות עובר דרך המכפיל.
unitMult = u=>/אלף/.test(String(u||""))?1000:/^\s*מאה\s*$/.test(String(u||""))?100:1;
unitOf = u=>unitMult(u)>1?"יח'":(u||"");
BLAME = [
  {id:"supplier",   label:"ספק / יצרן",   cls:"c-supplier",   color:"var(--sage-fill)",  claim:true},
  {id:"carrier",    label:"מוביל",        cls:"c-carrier",    color:"var(--info-fill)",    claim:true},
  {id:"contractor", label:"מלגזן הקבלן",  cls:"c-contractor", color:"var(--amber-fill)", claim:true},
  {id:"ours",       label:"המלגזן שלנו",  cls:"c-ours",       color:"var(--ink3)",  claim:false},
  {id:"unknown",    label:"אחר",          cls:"c-unknown",    color:"var(--pv)",  claim:false},
];
DEMO = [
  {id:"d1",serial:"JKM72N-540-2416A00871",blame:"contractor",
   note:"נפל מהמזלג בפריקה — שורה 14",ts:Date.now()-86400000*2,demo:true},
  {id:"d2",serial:"JKM72N-540-2416A00902",blame:"unknown",
   note:"נמצא שבור בערימה באחסון הצפוני",ts:Date.now()-86400000*5,demo:true},
  {id:"d3",serial:"JKM72N-540-2416A01144",blame:"carrier",
   note:"משטח פגוע בהגעה, צולם מול הנהג",ts:Date.now()-86400000*9,demo:true},
];
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
shared.records=[];
shared.unsub=null;
shared.demoMode=true;
/* ---------- יומן פעולות (audit log): מי, מתי, מה ---------- */
shared.logs=[];
uidTried = false;
LOG_KINDS = {issue:"ניפוק",count:"ספירה",progress:"ביצוע",delivery:"תעודה",move:"הוצאה",concrete:"בטון",panel:"פאנל שבור",panelbal:"מאזן פאנלים",kit:"כמויות לשולחן",prices:"מחירים",settings:"הגדרות",import:"ייבוא",backup:"גיבוי",daylog:"יומיות",order:"בקשת רכש"};
actorName = ()=>(ls.get("issuer")||"").trim();
/* ---------- form ---------- */
draft = null;
/* ---------- actions ---------- */
$("#btnAdd").onclick = openSheet;
$("#btnClearDemo").onclick = ()=>{ shared.demoMode=false; ls.set("demoDone","1"); render(); };
$("#list").onclick = async e => {
  const id = e.target.dataset && e.target.dataset.del; if(!id) return;
  if(!(await ask("למחוק את הרשומה?"))) return;
  const old=byId(shared.records,id);
  try{
    if(shared.DB) await shared.DB.collection("panels").doc(id).delete();
    else { shared.records=shared.records.filter(r=>r.id!==id);
           ls.set("panels",JSON.stringify(shared.records)); render(); }
  }catch(err){ toast("המחיקה נכשלה."); return; }
  logAct("panel","delete","נמחק פאנל שבור "+(old?old.serial:id),id,null,old);
};
$("#btnCsv").onclick = async ()=>{
  const rows = shared.demoMode ? DEMO : shared.records;
  if(!rows.length){ toast("אין רשומות לייצוא."); return; }
  const head=["מספר סידורי","מי שבר","הערה / תיאור","תאריך"];
  const lines=[head.join(",")].concat(rows.slice().sort((a,b)=>b.ts-a.ts).map(r=>{
    const b=byId(BLAME,r.blame)||byId(BLAME,"unknown");
    return [r.serial,(r.blame==="unknown"&&r.blameOther)?"אחר: "+r.blameOther:b.label,r.note||"",
      fmtD(r.ts)]
      .map(c=>'"'+String(c??"").replace(/"/g,'""')+'"').join(",");
  }));
  const csv="﻿"+lines.join("\r\n");
  const name="פאנלים-שבורים-"+new Date().toISOString().slice(0,10)+".csv";
  if(shared.DOWNLOADS){
    try{ await shared.DOWNLOADS.save({filename:name,data:new Blob([csv],{type:"text/csv"})}); return; }
    catch(e){ if(!(e && e.code==="declined")) toast("הייצוא לא זמין כאן כרגע."); return; }
  }
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download=name; a.click();
};
}
