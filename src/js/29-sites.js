import { $, closer, esc, fmtD, ls, popup, toast } from "./core.js";
import { contractPct } from "./01-stock.js";
import { SITE, setSiteName } from "./08-settings.js";
import { isoOf } from "./11-daylog.js";
import { ROLE } from "./18-identity.js";
// גרסה 25: כמה אתרים במופע אחד של חברה («מחברת אחת לכל חברה», ישי 1.11.2026).
// כל אתר הוא מרחב נפרד במאגר: sites/<id>/<collection>/... . האתר הראשון (root) נשאר בשורש המאגר,
// כך שהנתונים שכבר קיימים (עין תמר) לא זזים ולא צריכים העברה.
// shared.DB עוטף את המאגר ומוסיף את הקידומת של האתר הנוכחי לכל נתיב, ולכן שאר הקבצים לא יודעים שיש כמה אתרים.
// רשימת האתרים: settings/sites בשורש ({list:[{id,name,root?}]}), רק הבעלים כותב.
// האתר הנוכחי נשמר במכשיר (curSite); «all» = המכשיר נפתח במסך «כל האתרים».
// אפליקציה עצמאית (src/app/shim.js, בנייה --app): האתרים באים מהשרת לפי החברות של המשתמש, ובפתיחה יש מסך «האתרים שלי».
export let SITES, CUR_SITE, RAW_DB, APP;
// לבדיקות ולמסוף: window מקבל עותק של הערכים בזמן הטעינה, לא את העדכונים
export function sitesList(){ return SITES||[]; }
export function sitePrefix(s){ return !s||s.root?"":"sites/"+s.id+"/"; }
export function siteDb(raw,s){
  const p=sitePrefix(s); if(!raw||!p) return raw;
  return {collection:x=>raw.collection(p+x), doc:x=>raw.doc(p+x)};
}
// נקרא פעם אחת אחרי שהמאגר נטען, לפני כל ההאזנות. מחזיר את המאגר של האתר הנוכחי.
export async function loadSites(raw){
  RAW_DB=raw;
  APP=raw&&raw.__app&&window.claude&&window.claude.__app||null;
  if(APP) return loadAppSites();
  let list=null;
  try{ const snap=await raw.doc("settings/sites").get(); const d=snap&&snap.exists?snap.data():null; if(d&&Array.isArray(d.list)&&d.list.length) list=d.list; }catch(e){}
  SITES=(list||[{id:"main",root:true,name:""}]).map(s=>({id:String(s.id),name:String(s.name||""),root:!!s.root}));
  const want=ls.get("curSite");
  CUR_SITE=SITES.find(s=>s.id===want)||SITES[0];
  drawSiteChip();
  if(want==="all"&&SITES.length>1) setTimeout(openAllSites,0);
  return siteDb(raw,CUR_SITE);
}
/* ---------- אפליקציה עצמאית: «האתרים שלי» ---------- */
async function loadAppSites(){
  SITES=APP.sites().map(s=>({id:s.id,name:s.name,location:s.location,photo:s.photo,role:s.role,root:false}));
  if(!SITES.length){ noSites(); return new Promise(()=>{}); }
  let s=SITES.find(x=>x.id===ls.get("curSite"));
  if(!s) s=await pickSite();
  CUR_SITE=s; ls.set("curSite",s.id);
  const db=APP.open(s.id); setSiteName(s.name);
  // שם האתר בכותרת מהשרת עד שנטען settings/site של האתר (אם יש)
  const el=$("#siteName"); if(el){ el.innerHTML='<b>'+esc(SITE.company)+'</b>'+esc(s.name); document.title=(APP.name||"יומן חשמל")+" · "+s.name; }
  drawSiteChip();
  return db;
}
function noSites(){
  const el=document.createElement("div"); el.className="my-sites"; el.setAttribute("role","main");
  el.innerHTML=mysHead()+'<div class="mys-empty"><b>עוד אין לך אתרים</b><span>מי שמנהל את האתר צריך להזמין את המייל שלך. אחרי ההזמנה נכנסים שוב.</span><button type="button" class="ghost" id="mysOut">יציאה</button></div>';
  document.body.appendChild(el); el.querySelector("#mysOut").onclick=()=>APP.signOut();
}
function mysHead(){ return '<div class="mys-top"><div><small>'+esc(SITE.company)+'</small><h1>האתרים שלי</h1></div><button type="button" class="mys-out" id="mysOutTop">יציאה</button></div>'; }
// איור ברירת מחדל לכרטיס אתר: שמיים, שורות פאנלים, תחנת ממירים. הצבעים מהמותג (משתנים ב-CSS), בלי קבצים חיצוניים.
export function siteArt(seed){
  let h=0; for(const ch of String(seed||"")) h=(h*31+ch.charCodeAt(0))>>>0;
  const rnd=()=>((h=(h*1103515245+12345)>>>0)/4294967296);
  let rows=""; for(let r=0;r<4;r++){ const y=70+r*22, n=5+Math.floor(rnd()*3); for(let i=0;i<n;i++){ const x=18+i*(300/n)+r*6; rows+='<path d="M'+x.toFixed(1)+' '+y+'l'+(300/n-10).toFixed(1)+' 0l-8 14l-'+(300/n-10).toFixed(1)+' 0z" fill="var(--pv)" opacity="'+(0.55+r*0.12).toFixed(2)+'"/>'; } }
  const c1=40+rnd()*200;
  return '<svg viewBox="0 0 340 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="340" height="170" fill="#E6EEF5"/>'
    +'<rect y="62" width="340" height="108" fill="#EDE6D6"/><circle cx="'+(280-rnd()*40).toFixed(0)+'" cy="30" r="13" fill="var(--brand)" opacity=".85"/>'
    +'<path d="M'+c1.toFixed(0)+' 32h34a8 8 0 0 0-14-6a10 10 0 0 0-20 6z" fill="#fff"/>'+rows
    +'<rect x="292" y="44" width="30" height="20" rx="2" fill="#fff" stroke="var(--ink3)" stroke-width="1.2"/><path d="M296 50h22M296 56h22" stroke="var(--ink3)" stroke-width="1"/></svg>';
}
function pickSite(){
  return new Promise(resolve=>{
    document.querySelectorAll(".my-sites").forEach(x=>x.remove());
    const el=document.createElement("div"); el.className="my-sites"; el.setAttribute("role","main");
    const owner=SITES.some(s=>s.role==="owner");
    el.innerHTML=mysHead()+'<div class="mys-body"><label class="mys-search"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input type="search" id="mysQ" placeholder="חיפוש" aria-label="חיפוש אתר"></label>'
      +'<div class="mys-grid" id="mysGrid"></div>'+(owner?'<button type="button" class="ghost mys-add" id="mysAdd">+ אתר חדש</button>':'')+'</div>';
    document.body.appendChild(el); document.body.classList.add("mys-on");
    el.querySelector("#mysOutTop").onclick=()=>APP.signOut();
    const grid=el.querySelector("#mysGrid");
    const cards=SITES.map(s=>{
      const c=document.createElement("button"); c.type="button"; c.className="mys-card"; c.dataset.q=(s.name+" "+s.location).toLowerCase();
      c.innerHTML='<span class="mys-pic">'+(s.photo?'<img alt="" src="'+esc(s.photo)+'">':siteArt(s.id))+'<em class="mys-badge" hidden></em></span>'
        +'<span class="mys-txt"><b>'+esc(s.name)+'</b><span>'+esc(s.location||"")+'</span></span><span class="mys-meta"></span>';
      c.onclick=()=>{ el.remove(); document.body.classList.remove("mys-on"); resolve(s); };
      grid.appendChild(c); return c;
    });
    el.querySelector("#mysQ").oninput=e=>{ const v=e.target.value.trim().toLowerCase(); cards.forEach(c=>{ c.hidden=!!v&&!c.dataset.q.includes(v); }); };
    if(el.querySelector("#mysAdd")) el.querySelector("#mysAdd").onclick=async()=>{
      const name=(prompt("שם האתר החדש")||"").trim(); if(!name) return;
      const loc=(prompt("מיקום (לא חובה)")||"").trim();
      try{ await APP.addSite(name,loc); }catch(e){ toast("לא נוצר: אין הרשאה או שאין חיבור."); return; }
      SITES=APP.sites().map(s=>({id:s.id,name:s.name,location:s.location,photo:s.photo,role:s.role,root:false}));
      el.remove(); pickSite().then(resolve);
    };
    // מצב קצר לכל אתר: חריגים פתוחים (תג אדום, כמו «משימות פתוחות»), התקדמות ועובדים היום. נטען אחרי שהכרטיסים כבר על המסך.
    SITES.forEach((s,i)=>siteSummary(s).then(m=>{
      const b=cards[i].querySelector(".mys-badge"); if(m.open){ b.hidden=false; b.textContent=m.open+(m.open===1?" חריג פתוח":" חריגים פתוחים"); }
      cards[i].querySelector(".mys-meta").innerHTML=(m.pct===null?'':'<span><b class="num">'+Math.round(m.pct*100)+'%</b> התקדמות</span>')+'<span><b class="num">'+m.workers+'</b> עובדים היום</span>';
    }).catch(()=>{}));
  });
}
// באפליקציה: לחיצה על שם האתר בכותרת חוזרת ל«האתרים שלי»
export function backToSites(){ try{ localStorage.removeItem("curSite"); }catch(e){} location.reload(); }
export function siteName(s){ return (s===CUR_SITE&&SITE.custom?SITE.name:"")||s.name||(s===CUR_SITE?SITE.name:"")||"אתר"; }
// שם האתר שונה בהגדרות: מעדכנים גם את רשימת האתרים (אם כבר נשמרה), כדי שבורר האתרים ומסך «כל האתרים» יראו את השם החדש
export async function syncSiteName(name){
  if(APP||!RAW_DB||!CUR_SITE||ROLE!=="owner"||!name) return;
  if(SITES.length<2) { CUR_SITE.name=name; return; }
  const list=SITES.map(s=>s===CUR_SITE?{...s,name}:s);
  try{ await saveSites(list); CUR_SITE=SITES.find(s=>s.id===CUR_SITE.id)||CUR_SITE; }catch(e){}
}
function drawSiteChip(){
  const el=$("#siteName"); if(!el) return;
  el.classList.add("site-pick"); el.setAttribute("role","button"); el.tabIndex=0;
  el.setAttribute("aria-label","החלפת אתר"+(SITES.length>1?" · "+SITES.length+" אתרים":""));
  const go=APP?backToSites:openSites;
  el.onclick=go; el.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); go(); } };
}
export function goSite(id){
  ls.set("curSite",id);
  if(id!=="all"&&CUR_SITE&&id===CUR_SITE.id){ document.querySelectorAll(".scrim").forEach(x=>x.remove()); return; }
  if(id==="all"){ openAllSites(); return; }
  location.reload();
}
async function saveSites(list){
  await RAW_DB.doc("settings/sites").set({list:list.map(s=>({id:s.id,name:s.name,...(s.root?{root:true}:{})})),ts:Date.now()});
  SITES=list;
}
export function openSites(){
  if(!SITES) { toast("רשימת האתרים זמינה כשהאפליקציה מחוברת למאגר."); return; }
  const owner=ROLE==="owner"&&!!RAW_DB;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="אתרים"><div class="grab"></div><h2>האתרים של '+esc(SITE.company)+'</h2>'
    +'<div class="stock" id="siList"></div>'
    +(SITES.length>1?'<button class="ghost sites-all" type="button" id="siAll">כל האתרים במסך אחד<small>מה קרה היום בכל אתר</small></button>':'')
    +(owner?'<div class="f"><label for="siNew">אתר חדש</label><div style="display:flex;gap:8px"><input type="text" id="siNew" placeholder="שם האתר, למשל: נגב 3" autocomplete="off" style="flex:1"><button class="save" type="button" id="siAdd" style="flex:0 0 auto;padding:0 18px">הוסף</button></div><div class="hint">כל אתר נפתח ריק ונפרד: עובדים, כבלים, מלאי, סעיפים ומפה משלו. כל מי שיש לו את הקישור רואה את כל האתרים.</div></div>':'')
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  const close=closer(scrim), q=s=>scrim.querySelector(s);
  q(".cancel").onclick=close;
  const box=q("#siList");
  SITES.forEach(s=>{
    const b=document.createElement("button"); b.type="button"; b.className="site-row"+(s===CUR_SITE?" on":"");
    b.innerHTML='<b>'+esc(siteName(s))+'</b><span>'+(s===CUR_SITE?"האתר הפתוח":"פתח")+'</span>';
    b.onclick=()=>goSite(s.id); box.appendChild(b);
  });
  if(q("#siAll")) q("#siAll").onclick=()=>{ close(); goSite("all"); };
  if(q("#siAdd")) q("#siAdd").onclick=async()=>{
    const name=q("#siNew").value.trim(); if(!name){ q("#siNew").focus(); return; }
    if(SITES.some(s=>siteName(s)===name)){ toast("כבר יש אתר בשם הזה."); return; }
    const id="s"+Date.now().toString(36);
    // הרשימה נשמרת לראשונה: האתר שכבר קיים (בשורש) נכנס אליה בשמו הנוכחי
    const list=SITES.map(s=>({...s,name:siteName(s)})).concat({id,name,root:false});
    try{
      await RAW_DB.doc("sites/"+id+"/settings/site").set({name,company:SITE.company,ts:Date.now()});
      await saveSites(list);
    }catch(e){ toast("השמירה נכשלה."); return; }
    toast("נוסף: "+name); close(); openSites();
  };
}
// מסך «כל האתרים»: כרטיס לכל אתר עם התקדמות חוזית, עובדים היום, חריגים פתוחים ודיווח אחרון.
// קורא ישירות מהמאגר (בלי קידומת), פעם אחת בכל פתיחה, ומרענן בלחיצה.
export async function siteSummary(s){
  const D=APP?RAW_DB.forSite(s.id):siteDb(RAW_DB,s), today=isoOf(Date.now());
  const docs=async ref=>{ try{ const snap=await ref.get(); return snap.docs.map(d=>d.data()); }catch(e){ return []; } };
  const [status,day,blk,last]=await Promise.all([
    docs(D.collection("status")),
    docs(D.collection("daylog").where("date","==",today)),
    docs(D.collection("blockers")),
    docs(D.collection("log").orderBy("ts","desc").limit(1)),
  ]);
  const open=blk.filter(b=>b.status!=="closed"&&b.kind!=="extra"&&b.kind!=="delay");
  return {pct:contractPct(status), workers:day.length, crews:new Set(day.map(w=>w.contractor||"")).size,
    open:open.length, urgent:open.filter(b=>b.kind==="safety").length, lastTs:last[0]?last[0].ts:0};
}
export function openAllSites(){
  if(!RAW_DB||!SITES) return;
  document.querySelectorAll(".scrim.sites-scrim").forEach(x=>x.remove());
  const scrim=popup('<div class="sheet sites-sheet" role="dialog" aria-modal="true" aria-label="כל האתרים"><div class="grab"></div>'
    +'<h2>כל האתרים · '+esc(SITE.company)+'</h2><div class="sub" id="saSum" style="margin:-4px 0 12px;color:var(--ink3)">טוען…</div>'
    +'<div class="sites-grid" id="saGrid"></div>'
    +'<div class="acts"><button class="ghost" type="button" id="saRe" style="flex:1">רענן</button><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  scrim.classList.add("sites-scrim");
  const close=closer(scrim,()=>{ if(ls.get("curSite")==="all") ls.set("curSite",CUR_SITE.id); }), q=x=>scrim.querySelector(x);
  q(".cancel").onclick=close;
  async function draw(){
    const grid=q("#saGrid"); grid.innerHTML="";
    const cards=SITES.map(s=>{ const c=document.createElement("button"); c.type="button"; c.className="site-card"; c.innerHTML='<b>'+esc(siteName(s))+'</b><span class="pc">…</span>'; c.onclick=()=>goSite(s.id); grid.appendChild(c); return c; });
    const sums=await Promise.all(SITES.map(s=>siteSummary(s)));
    const today=isoOf(Date.now()); let W=0, O=0, quiet=0;
    sums.forEach((m,i)=>{
      W+=m.workers; O+=m.open; const fresh=m.lastTs&&isoOf(m.lastTs)===today; if(!fresh) quiet++;
      cards[i].innerHTML='<b>'+esc(siteName(SITES[i]))+'</b>'
        +'<span class="pc num">'+(m.pct===null?"—":Math.round(m.pct*100)+"%")+'</span><span class="cap">התקדמות חוזית</span>'
        +'<span class="row"><i>עובדים היום</i><em class="num">'+m.workers+(m.crews>1?' · '+m.crews+' צוותים':'')+'</em></span>'
        +'<span class="row"><i>חריגים פתוחים</i><em class="num'+(m.urgent?' bad':'')+'">'+m.open+'</em></span>'
        +'<span class="row"><i>דיווח אחרון</i><em class="'+(fresh?'':'warn')+'">'+(m.lastTs?(fresh?"היום":fmtD(m.lastTs)):"אין עדיין")+'</em></span>';
      if(SITES[i]===CUR_SITE) cards[i].classList.add("on");
    });
    q("#saSum").textContent=SITES.length+" אתרים · "+W+" עובדים היום · "+O+" חריגים פתוחים"+(quiet?" · "+quiet+" בלי דיווח היום":"");
  }
  q("#saRe").onclick=draw;
  draw();
}
export function __init(){
  SITES=null; CUR_SITE=null; RAW_DB=null; APP=null;
}
