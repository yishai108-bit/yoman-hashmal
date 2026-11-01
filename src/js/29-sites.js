import { $, closer, esc, fmtD, ls, popup, toast } from "./core.js";
import { contractPct } from "./01-stock.js";
import { SITE } from "./08-settings.js";
import { isoOf } from "./11-daylog.js";
import { ROLE } from "./18-identity.js";
// גרסה 25: כמה אתרים במופע אחד של חברה («מחברת אחת לכל חברה», ישי 1.11.2026).
// כל אתר הוא מרחב נפרד במאגר: sites/<id>/<collection>/... . האתר הראשון (root) נשאר בשורש המאגר,
// כך שהנתונים שכבר קיימים (עין תמר) לא זזים ולא צריכים העברה.
// shared.DB עוטף את המאגר ומוסיף את הקידומת של האתר הנוכחי לכל נתיב, ולכן שאר הקבצים לא יודעים שיש כמה אתרים.
// רשימת האתרים: settings/sites בשורש ({list:[{id,name,root?}]}), רק הבעלים כותב.
// האתר הנוכחי נשמר במכשיר (curSite); «all» = המכשיר נפתח במסך «כל האתרים».
export let SITES, CUR_SITE, RAW_DB;
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
  let list=null;
  try{ const snap=await raw.doc("settings/sites").get(); const d=snap&&snap.exists?snap.data():null; if(d&&Array.isArray(d.list)&&d.list.length) list=d.list; }catch(e){}
  SITES=(list||[{id:"main",root:true,name:""}]).map(s=>({id:String(s.id),name:String(s.name||""),root:!!s.root}));
  const want=ls.get("curSite");
  CUR_SITE=SITES.find(s=>s.id===want)||SITES[0];
  drawSiteChip();
  if(want==="all"&&SITES.length>1) setTimeout(openAllSites,0);
  return siteDb(raw,CUR_SITE);
}
export function siteName(s){ return (s===CUR_SITE&&SITE.custom?SITE.name:"")||s.name||(s===CUR_SITE?SITE.name:"")||"אתר"; }
// שם האתר שונה בהגדרות: מעדכנים גם את רשימת האתרים (אם כבר נשמרה), כדי שבורר האתרים ומסך «כל האתרים» יראו את השם החדש
export async function syncSiteName(name){
  if(!RAW_DB||!CUR_SITE||ROLE!=="owner"||!name) return;
  if(SITES.length<2) { CUR_SITE.name=name; return; }
  const list=SITES.map(s=>s===CUR_SITE?{...s,name}:s);
  try{ await saveSites(list); CUR_SITE=SITES.find(s=>s.id===CUR_SITE.id)||CUR_SITE; }catch(e){}
}
function drawSiteChip(){
  const el=$("#siteName"); if(!el) return;
  el.classList.add("site-pick"); el.setAttribute("role","button"); el.tabIndex=0;
  el.setAttribute("aria-label","החלפת אתר"+(SITES.length>1?" · "+SITES.length+" אתרים":""));
  el.onclick=openSites; el.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openSites(); } };
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
  const p=sitePrefix(s), today=isoOf(Date.now());
  const docs=async ref=>{ try{ const snap=await ref.get(); return snap.docs.map(d=>d.data()); }catch(e){ return []; } };
  const [status,day,blk,last]=await Promise.all([
    docs(RAW_DB.collection(p+"status")),
    docs(RAW_DB.collection(p+"daylog").where("date","==",today)),
    docs(RAW_DB.collection(p+"blockers")),
    docs(RAW_DB.collection(p+"log").orderBy("ts","desc").limit(1)),
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
  SITES=null; CUR_SITE=null; RAW_DB=null;
}
