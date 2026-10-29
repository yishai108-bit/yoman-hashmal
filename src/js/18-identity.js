import { $, esc, logAct, ls, popup, render, shared, toast } from "./core.js";
import { renderOverview, renderStock } from "./01-stock.js";
import { renderSlips } from "./03-issues.js";
import { SITE, applySite, showTab } from "./08-settings.js";
import { renderDay } from "./11-daylog.js";
import { tidyUI } from "./12-ui-cleanup.js";
import { renderBoq } from "./13-purchasing.js";
export let ROLE, ME, ROLE_LABEL, lockShown, hiddenAt, NET, watch;
export function applyRole(){
  document.body.classList.remove("r-owner","r-editor","r-viewer"); document.body.classList.add("r-"+ROLE);
  document.querySelectorAll('[data-w]').forEach(el=>{ const need=el.dataset.w; el.classList.toggle("w-edit",need==="edit"); el.classList.toggle("w-owner",need==="owner"); });
}
export async function loadIdentity(){
  if(!shared.USER){ ROLE="owner"; applyRole(); return; }
  try{ ME=await shared.USER.me(); }catch(e){ ME=null; }
  ROLE = ME&&ME.isOwner ? "owner" : ME&&ME.canEdit ? "editor" : "viewer";
  if(ME&&ME.name&&!ls.get("issuer")) ls.set("issuer",ME.name.split(" ")[0]);
  applyRole();
  const c=$("#whoChip");
  if(c&&ME){ c.hidden=false; c.innerHTML='<img src="'+ME.avatarUrl+'" alt=""><span class="nm"></span>';
    c.querySelector(".nm").textContent=(ME.name||"משתמש").split(" ")[0];
    const r=document.createElement("span"); r.className="rl"; r.textContent=ROLE_LABEL[ROLE]; c.querySelector(".nm").appendChild(r);
    c.onclick=openWho; }
  if(ROLE==="viewer"&&shared.fabTab) { const f=$("#fab"); if(f) f.hidden=true; }
  render(); renderStock();
}
export function openWho(){
  const rows=[["owner","בעלים","הכל: ניפוק, ספירה, תעודות, מחיקות, הגדרות, מחירים, שחזור"],["editor","עריכה (מפקחים)","ניפוק, ספירה, דיווח ביצוע, קליטת תעודות. בלי מחיקות, הגדרות ומחירים"],["viewer","צפייה (מנהלים)","רואה הכל בזמן אמת, לא משנה כלום"]];
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><h2>מי מחובר</h2>'
    +'<div class="kv" style="align-items:center"><img src="'+(ME?ME.avatarUrl:"")+'" alt="" style="width:48px;height:48px;border-radius:50%"><span><b id="wName"></b><br><span class="role-badge role-'+ROLE+'">'+ROLE_LABEL[ROLE]+'</span></span></div>'
    +'<div class="note-card">הכניסה היא חשבון Claude של כל משתמש. נותנים גישה מתפריט <b>Share</b> לפי מייל: «צפייה» או «עריכה». ההרשאות נאכפות בשרת, לא רק במסך.</div>'
    +'<div class="stock">'+rows.map(r=>'<div class="slip" style="cursor:default'+(r[0]===ROLE?';border-color:var(--pv)':'')+'"><b>'+r[1]+'</b><span>'+r[2]+'</span></div>').join("")+'</div>'
    +'<div class="acts"><button class="save" type="button" id="wPin">'+(ls.get("pin")?"שינוי / ביטול קוד PIN":"נעילה בקוד PIN בטלפון הזה")+'</button><button class="cancel" type="button">סגור</button></div></div>');
  scrim.querySelector("#wName").textContent=ME&&ME.name||"משתמש";
  scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  scrim.querySelector("#wPin").onclick=()=>{ scrim.remove(); if(ls.get("pin")) pinMenu(); else setPin(); };
}
export async function pinHash(pin){ const salt=ls.get("pinSalt")||(()=>{ const v=Math.random().toString(36).slice(2); ls.set("pinSalt",v); return v; })();
  try{ const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+":"+pin)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join(""); }catch(e){ return salt+pin; } }
export function pinScreen(title,sub,onPin){
  const el=document.createElement("div"); el.className="lock"; el.setAttribute("role","dialog"); el.setAttribute("aria-modal","true");
  el.innerHTML='<div class="brand">'+esc(SITE.company||"S.E.E")+'</div>'+(ME&&ME.avatarUrl?'<img src="'+ME.avatarUrl+'" alt="">':'')
    +'<h2></h2><div class="sub"></div><div class="dots"><i></i><i></i><i></i><i></i></div>'
    +'<div class="pad">'+[1,2,3,4,5,6,7,8,9].map(n=>'<button type="button" data-n="'+n+'">'+n+'</button>').join("")+'<button type="button" class="ghostk" data-x="1">'+(onPin.cancel?"ביטול":"")+'</button><button type="button" data-n="0">0</button><button type="button" class="ghostk" data-b="1">מחק</button></div>';
  el.querySelector("h2").textContent=title; el.querySelector(".sub").textContent=sub;
  document.body.appendChild(el);
  let v="";
  const dots=()=>el.querySelectorAll(".dots i").forEach((d,i)=>d.classList.toggle("on",i<v.length));
  const push=async n=>{ if(v.length>=4) return; v+=n; dots(); if(v.length===4){ const ok=await onPin(v); if(ok===false){ const d=el.querySelector(".dots"); d.classList.add("err"); try{ navigator.vibrate&&navigator.vibrate(120); }catch(e){} setTimeout(()=>{ d.classList.remove("err"); v=""; dots(); },380); } else el.remove(); } };
  el.querySelector(".pad").onclick=e=>{ const b=e.target.closest("button"); if(!b) return; if(b.dataset.n) push(b.dataset.n); else if(b.dataset.b){ v=v.slice(0,-1); dots(); } else if(b.dataset.x&&onPin.cancel){ el.remove(); onPin.cancel(); } };
  const kd=e=>{ if(!document.body.contains(el)){ document.removeEventListener("keydown",kd); return; } if(/^\d$/.test(e.key)) push(e.key); else if(e.key==="Backspace"){ v=v.slice(0,-1); dots(); } };
  document.addEventListener("keydown",kd);
  return el;
}
export function setPin(){
  let first=null;
  const f=async p=>{ if(!first){ first=p; setTimeout(()=>pinScreen("שוב, לאישור","אותו קוד פעם נוספת",g),10); return true; } return true; };
  f.cancel=()=>{};
  const g=async p=>{ if(p!==first){ toast("הקודים לא תואמים. נסה שוב."); return true; } ls.set("pin",await pinHash(p)); toast("נקבע קוד PIN לטלפון הזה."); logAct("settings","edit","נקבע קוד PIN במכשיר","pin"); return true; };
  g.cancel=()=>{};
  pinScreen("קוד PIN חדש","4 ספרות. נשמר רק בטלפון הזה",f);
}
export function pinMenu(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><h2>קוד PIN</h2><div class="note-card">האפליקציה ננעלת בפתיחה ואחרי 5 דקות ברקע. הקוד שמור רק בטלפון הזה.</div>'
    +'<div class="acts"><button class="save" type="button" id="pChange">שנה קוד</button><button class="cancel danger" type="button" id="pOff">בטל נעילה</button></div></div>'); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  scrim.querySelector("#pChange").onclick=()=>{ scrim.remove(); setPin(); };
  scrim.querySelector("#pOff").onclick=()=>{ scrim.remove(); const h=async p=>{ if(await pinHash(p)!==ls.get("pin")) return false; try{ localStorage.removeItem("pin"); }catch(e){} toast("הנעילה בוטלה."); return true; }; h.cancel=()=>{}; pinScreen("הקש את הקוד הנוכחי","כדי לבטל את הנעילה",h); };
}
export function lockIfNeeded(){
  if(!ls.get("pin")||lockShown) return; lockShown=true;
  const name=ME&&ME.name?ME.name.split(" ")[0]:"";
  pinScreen(name?"שלום "+name:"יומן אתר","הקש קוד PIN",async p=>{ if(await pinHash(p)!==ls.get("pin")) return false; lockShown=false; return true; });
}
export function drawNet(){
  const bar=$("#netBar"); if(!bar) return;
  const stale=NET.cacheSince&&Date.now()-NET.cacheSince>45000;
  const msg = NET.offline ? "אין חיבור לאינטרנט. הנתונים כאן אולי לא מעודכנים, ושמירה עלולה להיכשל."
    : NET.dead ? "החיבור למאגר הנתונים נותק. הנתונים כאן אולי לא מעודכנים. רענן כדי להתחבר מחדש."
    : NET.noDb ? "אין חיבור למאגר הנתונים. מה שנשמר עכשיו נשאר במכשיר הזה בלבד ולא מגיע לאחרים."
    : stale ? "החיבור למאגר איטי. ייתכן שהנתונים לא מעודכנים." : "";
  bar.hidden=!msg; $("#netMsg").textContent=msg;
  document.body.classList.toggle("net-off",!!msg);
  document.body.style.setProperty("--netH",msg?bar.offsetHeight+"px":"0px");
}
export function netErr(e){ NET.dead++; drawNet(); }
export function netSeen(snap){ const c=!!(snap&&snap.metadata&&snap.metadata.fromCache); if(!c) NET.cacheSince=0; else if(!NET.cacheSince) NET.cacheSince=Date.now(); }
export function __init(){
/* ================= זהות, תפקיד, קוד PIN ================= */
ROLE = "owner";
ME = null;
ROLE_LABEL = {owner:"בעלים",editor:"עריכה",viewer:"צפייה"};
lockShown = false;
hiddenAt = 0;
document.addEventListener("visibilitychange",()=>{ if(document.hidden) hiddenAt=Date.now(); else if(hiddenAt&&Date.now()-hiddenAt>5*60000) lockIfNeeded(); });
/* ---------- boot ---------- */
shared.demoStock = !ls.get("demoDoneS");
try{ shared.deliveries=JSON.parse(ls.get("deliveries")||"[]"); }catch(e){ shared.deliveries=[]; }
try{ shared.moves=JSON.parse(ls.get("moves")||"[]"); }catch(e){ shared.moves=[]; }
try{ shared.counts=JSON.parse(ls.get("counts")||"[]"); }catch(e){ shared.counts=[]; }
try{ shared.issues=JSON.parse(ls.get("issues")||"[]"); }catch(e){ shared.issues=[]; }
try{ shared.daylog=JSON.parse(ls.get("daylog")||"[]"); }catch(e){ shared.daylog=[]; }
try{ shared.CREW=JSON.parse(ls.get("crew")||"[]"); if(!Array.isArray(shared.CREW)) shared.CREW=[]; }catch(e){ shared.CREW=[]; }
try{ shared.STATUS=JSON.parse(ls.get("status")||"[]"); if(!Array.isArray(shared.STATUS)) shared.STATUS=[]; }catch(e){ shared.STATUS=[]; }
try{ const b=JSON.parse(ls.get("boq")||"null"); if(b&&Array.isArray(b.lines)){ shared.boq=b.lines; shared.boqSource=b.source||""; } }catch(e){}
try{ const a=JSON.parse(ls.get("aliases")||"null"); if(a&&typeof a==="object") shared.ALIASES=a; }catch(e){}
try{ const m=JSON.parse(ls.get("suppliers")||"null"); if(m&&typeof m==="object") shared.SUPPLIERS=m; }catch(e){}
try{ shared.imported=new Set(JSON.parse(ls.get("imports")||"[]")); }catch(e){ shared.imported=new Set(); }
try{ shared.logs=JSON.parse(ls.get("log")||"[]"); if(!Array.isArray(shared.logs)) shared.logs=[]; }catch(e){ shared.logs=[]; }
try{ const bcm=JSON.parse(ls.get("barcodes")||"null"); if(bcm&&typeof bcm==="object") shared.BARCODES=bcm; }catch(e){}
try{ const s=JSON.parse(ls.get("site")||"null"); if(s&&typeof s==="object") applySite(s); }catch(e){}
lockIfNeeded();
tidyUI();
showTab(ls.get("tab")||"over");
render();
 renderStock();
 renderDay();
 renderBoq();
/* ---------- מצב חיבור למאגר ---------- */
// אין חיבור לאינטרנט, האזנה למאגר שמתה, או מאגר שלא נטען בכלל: מראים פס אדום למעלה.
// עד גרסה 51 השגיאות נבלעו בשקט והעובד ראה נתונים ישנים כאילו הם עדכניים.
NET = {offline:navigator.onLine===false, dead:0, noDb:false, cacheSince:0};
watch = (ref,next)=>ref.onSnapshot(snap=>{ netSeen(snap); next(snap); },netErr);
window.addEventListener("online",()=>{ NET.offline=false; drawNet(); });
window.addEventListener("offline",()=>{ NET.offline=true; drawNet(); });
window.addEventListener("resize",()=>{ if(!$("#netBar").hidden) drawNet(); });
setInterval(drawNet,15000);
$("#netRe").onclick=()=>location.reload();
drawNet();
(async ()=>{
  const localOnly = () => { NET.noDb=true; drawNet(); $("#dbNote").innerHTML = " <b>נשמר במכשיר הזה בלבד.</b>"; };
  if(!window.claude || !claude.use) { localOnly(); return; }
  $("#app").classList.add("skel"); const unskel=()=>$("#app").classList.remove("skel"); setTimeout(unskel,4000);
  [shared.DB,shared.ASSETS,shared.SAMPLE,shared.DOWNLOADS,shared.USER] = await Promise.all([
    claude.use("db").catch(()=>null),
    claude.use("assets").catch(()=>null),
    claude.use("sample").catch(()=>null),
    claude.use("downloads").catch(()=>null),
    claude.use("user").catch(()=>null),
  ]);
  if(shared.USER){ try{ shared.IS_OWNER=await shared.USER.isOwner(); }catch(e){ shared.IS_OWNER=null; } }
  await loadIdentity();
  if(lockShown){ const l=document.querySelector(".lock img"); if(!l&&ME&&ME.avatarUrl){ const lk=document.querySelector(".lock"); if(lk){ const im=new Image(); im.src=ME.avatarUrl; im.alt=""; lk.insertBefore(im,lk.children[1]); const h=lk.querySelector("h2"); if(h&&ME.name) h.textContent="שלום "+ME.name.split(" ")[0]; } } }
  if(shared.SAMPLE){
    const lim = await shared.SAMPLE.limits().catch(()=>null);
    if(!lim || !lim.images) shared.SAMPLE = null;
  }
  if(!shared.DB) localOnly();
  if(shared.DB){
    watch(shared.DB.collection("deliveries"),snap=>{
      shared.deliveries = snap.docs.map(d=>Object.assign({id:d.id},d.data()));
      if(shared.deliveries.length){ shared.demoStock=false; ls.set("demoDoneS","1"); }
      renderStock(); renderBoq();
    });
    watch(shared.DB.collection("moves"),snap=>{
      shared.moves = snap.docs.map(d=>Object.assign({id:d.id},d.data()));
      renderStock();
    });
    watch(shared.DB.collection("counts"),snap=>{
      shared.counts = snap.docs.map(d=>Object.assign({id:d.id},d.data()));
      renderStock();
    });
    watch(shared.DB.collection("issues"),snap=>{
      shared.issues = snap.docs.map(d=>Object.assign({id:d.id},d.data()));
      renderSlips(); renderOverview(); unskel();
    });
    watch(shared.DB.collection("daylog"),snap=>{ shared.daylog=snap.docs.map(d=>Object.assign({id:d.id},d.data())); renderDay(); });
    watch(shared.DB.collection("crew"),snap=>{ shared.CREW=snap.docs.map(d=>Object.assign({id:d.id},d.data())); renderDay(); });
    watch(shared.DB.collection("status"),snap=>{ shared.STATUS=snap.docs.map(d=>Object.assign({id:d.id},d.data())); renderOverview(); });
    watch(shared.DB.doc("settings/boq"),snap=>{ const d=snap&&snap.exists?snap.data():null; if(d&&Array.isArray(d.lines)){ shared.boq=d.lines; shared.boqSource=d.source||""; renderBoq(); } });
    watch(shared.DB.doc("settings/aliases"),snap=>{ const d=snap&&snap.exists?snap.data():null; if(d&&d.map&&typeof d.map==="object") shared.ALIASES=d.map; });
    watch(shared.DB.doc("settings/suppliers"),snap=>{ const d=snap&&snap.exists?snap.data():null; if(d&&d.map&&typeof d.map==="object") shared.SUPPLIERS=d.map; });
    watch(shared.DB.collection("imports"),snap=>{ shared.imported = new Set(snap.docs.map(d=>d.id)); });
    watch(shared.DB.doc("settings/site"),snap=>{
      const d = snap && snap.exists ? snap.data() : null;
      if(d){ applySite(d); renderOverview(); }
    });
    watch(shared.DB.doc("settings/barcodes"),snap=>{ const d=snap&&snap.exists?snap.data():null; if(d&&d.map&&typeof d.map==="object") shared.BARCODES=d.map; });
    watch(shared.DB.collection("log").orderBy("ts","desc").limit(400),snap=>{
      shared.logs = snap.docs.map(d=>Object.assign({id:d.id},d.data()));
    });
  }
})();
}
