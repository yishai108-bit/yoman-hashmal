import { $, LOG_KINDS, ask, esc, fmtD, logAct, ls, openLog, popup, render, shared, toast } from "./core.js";
import { CATS, catId, fmtN, renderOverview, renderStock } from "./01-stock.js";
import { FAB_LABEL } from "./05-actions.js";
import { openBoqImport, saveBoq } from "./13-purchasing.js";
import { ROLE } from "./18-identity.js";
import { DRUM_ST, cableTypeLabel, drumOpen, drumPulled, drumRemain, saveCableTypes } from "./20-cables.js";
import { BLK_KINDS } from "./21-work.js";
export let APP_VERSION, APP_ID, BACKUP_COLLS, SITE, csvOf;
export function applySite(d){
  if(!d) return;
  SITE={name:String(d.name||SITE.name),company:String(d.company||SITE.company),custom:true};
  const el=$("#siteName"); if(el) el.innerHTML='<b>'+esc(SITE.company)+'</b>'+esc(SITE.name);
  document.title="יומן חשמל · "+SITE.name;
}
export async function saveSite(doc){
  doc.ts=Date.now();
  if(shared.DB) await shared.DB.doc("settings/site").set(doc); else { ls.set("site",JSON.stringify(doc)); applySite(doc); }
}
export function openSettings(){
  const F=(id,l,v,hint,ph)=>'<div class="f"><label for="'+id+'">'+l+'</label><input type="text" id="'+id+'" value="'+esc(v??"")+'" placeholder="'+esc(ph||"")+'" autocomplete="off">'+(hint?'<div class="hint">'+hint+'</div>':'')+'</div>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="הגדרות"><div class="grab"></div><h2>הגדרות</h2>'
    +'<div class="setgrid">'
      +'<button class="ghost" type="button" id="stLog">יומן פעולות<small>מי שמר, מתי ומה</small></button>'
      +'<button class="ghost" type="button" id="stBackup">גיבוי מלא<small>קובץ JSON של כל הנתונים</small></button>'
      +'<button class="ghost" type="button" id="stZip">ייצוא לאקסל<small>כל הטבלאות ב-ZIP</small></button>'
      +'<button class="ghost" type="button" id="stBom">ייבוא כתב כמויות<small>אקסל או CSV</small></button>'
    +'</div>'
    +F("stName","שם האתר",SITE.name,"","למשל: עין תמר")
    +F("stCo","חברה",SITE.company,"","S.E.E")
    +F("stMe","השם שלך",ls.get("issuer")||"","נשמר במכשיר הזה וממולא אוטומטית כמנפיק / סופר / מדווח.","השם שלך")
    +'<div class="f" id="stDanger" hidden><label>ניהול</label><div class="setgrid">'
      +'<button class="ghost danger" type="button" id="stRestore">שחזור מגיבוי<small>כותב את כל הנתונים מקובץ JSON</small></button>'
      +'<button class="ghost" type="button" id="stDemo">איפוס תצוגת דוגמה<small>מציג שוב נתוני דוגמה במכשיר הזה</small></button>'
    +'</div></div>'
    +'<div class="acts"><button class="save" id="stSave" type="button">שמור הגדרות</button><button class="cancel" id="stCancel" type="button">סגור</button></div>'
    +'<div class="hint" style="text-align:center;margin-top:14px">יומן חשמל · גרסה '+APP_VERSION+' · הנתונים נשמרים במרחב של האפליקציה ונגישים לכל מי שקיבל קישור'+(shared.DB?'':' · <b>כרגע במכשיר הזה בלבד</b>')+'</div></div>');
  const q=s=>scrim.querySelector(s);
  q("#stLog").onclick=()=>{ scrim.remove(); openLog(); };
  q("#stBackup").onclick=()=>exportBackup();
  q("#stZip").onclick=()=>exportAllCsv();
  q("#stBom").onclick=()=>{ scrim.remove(); openBoqImport(); };
  q("#stRestore").onclick=()=>{ scrim.remove(); openRestore(); };
  q("#stDemo").onclick=()=>{ ["demoDone","demoDoneS"].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); location.reload(); };
  q("#stDanger").hidden=ROLE!=="owner";
  if(ROLE!=="owner"){ ["#stSave","#stBom"].forEach(x=>{ const e=q(x); if(e) e.hidden=true; }); scrim.querySelectorAll("#stName,#stCo").forEach(i=>i.disabled=true); }
  q("#stCancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#stSave").onclick=async()=>{
    const me=q("#stMe").value.trim(); if(me) ls.set("issuer",me);
    const site={name:q("#stName").value.trim()||SITE.name,company:q("#stCo").value.trim()||SITE.company};
    const b=q("#stSave"); b.disabled=true; b.textContent="שומר…";
    try{ await saveSite(site); }catch(e){ b.disabled=false; b.textContent="שמור הגדרות"; toast("השמירה נכשלה."); return; }
    logAct("settings","edit","הגדרות אתר: "+site.name+" · "+site.company,"settings/site",me||null);
    scrim.remove(); toast("ההגדרות נשמרו."); renderOverview();
  };
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
/* ---- גיבוי ושחזור ---- */
export async function saveFile(name,blob){
  if(shared.DOWNLOADS){ try{ await shared.DOWNLOADS.save({filename:name,data:blob}); return true; }catch(e){ if(!(e&&e.code==="declined")) toast("הייצוא לא זמין כאן כרגע."); return false; } }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); return true;
}
export function backupObject(){
  return {app:APP_ID,version:1,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),site:SITE,
    deliveries:shared.deliveries,drums:shared.drums||[],pulls:shared.pulls||[],moves:shared.moves,counts:shared.counts,issues:shared.issues,daylog:shared.daylog,crew:shared.CREW,dayinfo:shared.DAYINFO||[],status:shared.STATUS,blockers:shared.blockers||[],boq:{lines:shared.boq,source:shared.boqSource},cableTypes:shared.CABLE_TYPES,suppliers:shared.SUPPLIERS,log:shared.logs};
}
export async function exportBackup(){
  if(shared.demoStock&&!shared.deliveries.length){ toast("אין עדיין נתונים אמיתיים לגיבוי."); return; }
  const o=backupObject();
  const n=BACKUP_COLLS.reduce((s,k)=>s+(o[k]||[]).length,0);
  const name="יומן-חשמל-גיבוי-"+new Date().toISOString().slice(0,10)+".json";
  if(await saveFile(name,new Blob([JSON.stringify(o)],{type:"application/json"}))){ toast("גיבוי: "+fmtN(n)+" רשומות."); logAct("backup","add","גיבוי מלא יוצא · "+fmtN(n)+" רשומות",""); }
}
export async function exportAllCsv(){
  if(!window.JSZip){ toast("ספריית ה-ZIP לא נטענה."); return; }
  const z=new JSZip(); const d=t=>t?fmtD(t):"";
  z.file("תעודות-משלוח.csv",csvOf(["תאריך","ספק","מספר תעודה","פריט","כמות","יחידה","קטגוריה","הערה"],shared.deliveries.flatMap(n=>(n.lines||[]).map(l=>[n.dateText||d(n.ts),n.supplier,n.noteNo,l.name,l.qty,l.unit,(CATS.find(c=>c.id===catId(l.cat,l.name))||{}).label||"",n.note||""]))));
  z.file("דיווחי-ביצוע.csv",csvOf(["תאריך","פעילות","כמות","יחידה","אזור","צוות","הערה","רשם"],shared.STATUS.flatMap(a=>(a.daily||[]).filter(x=>Number(x.actual)||x.note).map(x=>[x.date,a.name,x.actual||"",a.unit||"",x.area||"",x.crew||"",x.note||"",x.by||""])).sort((a,b)=>a[0]<b[0]?-1:1)));
  z.file("חריגים.csv",csvOf(["מתאריך","סוג","חריג","אזור","מצב","נסגר","איך נסגר","רשם"],(shared.blockers||[]).map(b=>[b.date||"",BLK_KINDS[b.kind]||b.kind||"",b.text,b.area||"",b.status==="closed"?"נסגר":"פתוח",b.closedAt?d(b.closedAt):"",b.closeNote||"",b.by||""])));
  z.file("עובדים.csv",csvOf(["תאריך","שם","תפקיד","קבלן","כלי","שעות","עבודה/אזור","הגעה","יציאה","משימות"],shared.daylog.slice().sort((a,b)=>a.date<b.date?-1:1).map(w=>[w.date,w.name,w.job||"",w.contractor||"",w.machine||"",w.hours||"",w.area||"",w.arrive==="late"?"איחר"+(w.lateMin?" "+w.lateMin:""):"בזמן",w.leave==="early"?"מוקדם"+(w.earlyMin?" "+w.earlyMin:""):"בזמן",w.tasks||""])));
  z.file("ניפוקים.csv",csvOf(["תאריך","למי","מנפיק","פריט","כמות","חתימה","הערה"],shared.issues.flatMap(s=>(s.lines||[]).map(l=>[d(s.ts),s.who,s.by||"",l.name,l.qty,(s.sigAsset||s.sigUrl||s.sigData)?"כן":"לא",s.note||""]))));
  z.file("תנועות.csv",csvOf(["תאריך","פריט","כמות","כיוון","מי","חתימה","הערה"],shared.moves.map(m=>[d(m.ts),m.item,m.qty,m.dir==="in"?"החזרה":"הוצאה",m.who||"",m.dir==="in"?"":(m.sigAsset||m.sigUrl||m.sigData)?"כן":"לא",m.note||""])));
  z.file("ספירות.csv",csvOf(["תאריך","פריט","נספר","מי ספר","הערה"],shared.counts.map(c=>[d(c.ts),c.item,c.qty,c.who||"",c.note||""])));
  z.file("תופים.csv",csvOf(["מספר תוף","סוג כבל","אורך בקליטה","נמשך","נשאר / שארית","מצב","ספק","מיקום"],(shared.drums||[]).map(x=>[x.drumNo,cableTypeLabel(x.cableType),x.lengthIn,drumPulled(x.id),drumOpen(x)?drumRemain(x):x.remainderAtClose??"",DRUM_ST[x.status]||x.status,x.supplier||"",x.location||""])));
  z.file("משיכות.csv",csvOf(["תאריך","תוף","סוג כבל","מטר","לאן","צוות","רשם"],(shared.pulls||[]).slice().sort((a,b)=>a.ts-b.ts).map(p=>[p.date,p.drumNo,cableTypeLabel(p.cableType),p.meters,p.area||"",p.crew||"",p.by||""])));
  z.file("כתב-כמויות.csv",csvOf(["קוד","תיאור","יחידה","כמות"],(shared.boq||[]).map(b=>[b.code,b.name,b.unit||"",b.qty??""])));
  z.file("יומן-פעולות.csv",csvOf(["תאריך","שעה","מי","סוג","פעולה","תיאור"],shared.logs.slice().sort((a,b)=>a.ts-b.ts).map(l=>[d(l.ts),new Date(l.ts).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}),l.who||"",LOG_KINDS[l.kind]||l.kind,l.action,l.summary])));
  const blob=await z.generateAsync({type:"blob"});
  if(await saveFile("יומן-חשמל-"+new Date().toISOString().slice(0,10)+".zip",blob)) toast("11 טבלאות ב-ZIP.");
}
export function openRestore(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="שחזור מגיבוי"><div class="grab"></div><h2>שחזור מגיבוי</h2>'
    +'<div class="note-card">בוחרים קובץ גיבוי (JSON) שיוצא מהאפליקציה. הרשומות שבקובץ ייכתבו <b>בנוסף</b> לקיימות: רשומה עם אותו מזהה תוחלף, אחרות לא יימחקו. כך מעבירים אתר למרחב חדש.</div>'
    +'<div id="rsBody"><div class="pick">בחר קובץ גיבוי<small>'+APP_ID+' · JSON</small><input type="file" id="rsFile" accept=".json,application/json"></div></div>'
    +'<div class="acts"><button class="save" id="rsGo" hidden type="button">שחזר</button><button class="cancel" type="button">סגור</button></div></div>');
  const q=s=>scrim.querySelector(s); let obj=null;
  const label={deliveries:"delivery",drums:"cable",moves:"move",counts:"count",issues:"issue",daylog:"daylog",status:"progress",blockers:"blocker",log:"backup"};
  q(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#rsFile").onchange=async e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    try{ obj=JSON.parse(await f.text()); }catch(err){ q("#rsBody").innerHTML='<div class="empty">הקובץ לא נקרא.</div>'; return; }
    if(!obj||obj.app!==APP_ID){ q("#rsBody").innerHTML='<div class="empty">זה לא קובץ גיבוי של יומן חשמל.</div>'; obj=null; return; }
    q("#rsBody").innerHTML='<div class="imp-sum">'+Object.keys(label).map(k=>'<span>'+esc(LOG_KINDS[label[k]]||k)+' <b>'+((obj[k]||[]).length)+'</b></span>').join("")+'</div>'
      +'<div class="legend">מתאריך '+esc(String(obj.exportedAt||"").slice(0,10))+' · אתר: '+esc((obj.site||{}).name||"")+'</div>';
    q("#rsGo").hidden=false;
  };
  q("#rsGo").onclick=async()=>{
    if(!obj) return;
    if(!(await ask("לכתוב את כל הרשומות מהגיבוי?","שחזר","var(--amber)"))) return;
    const b=q("#rsGo"); b.disabled=true;
    const local={deliveries:shared.deliveries,drums:shared.drums,pulls:shared.pulls,moves:shared.moves,counts:shared.counts,issues:shared.issues,daylog:shared.daylog,crew:shared.CREW,dayinfo:shared.DAYINFO,status:shared.STATUS,blockers:shared.blockers,log:shared.logs};
    let n=0, fail=0;
    for(const k of BACKUP_COLLS){
      for(const doc of (obj[k]||[])){ if(!doc||!doc.id) continue; b.textContent="כותב… "+(++n);
        try{ if(shared.DB) await shared.DB.collection(k).doc(String(doc.id)).set(doc); else if(Array.isArray(local[k])){ const arr=local[k]; const i=arr.findIndex(x=>x.id===doc.id); if(i>=0) arr[i]=doc; else arr.push(doc); } }catch(e){ fail++; } }
    }
    try{ if(obj.boq&&Array.isArray(obj.boq.lines)&&obj.boq.lines.length) await saveBoq(obj.boq.lines,obj.boq.source||"מגיבוי"); if(obj.suppliers&&typeof obj.suppliers==="object"){ shared.SUPPLIERS=obj.suppliers; if(shared.DB) await shared.DB.doc("settings/suppliers").set({map:shared.SUPPLIERS,ts:Date.now()}); else ls.set("suppliers",JSON.stringify(shared.SUPPLIERS)); } }catch(e){ fail++; }
    try{ if(Array.isArray(obj.cableTypes)&&obj.cableTypes.length) await saveCableTypes(obj.cableTypes); }catch(e){ fail++; }
    try{ if(obj.site){ await saveSite({name:obj.site.name,company:obj.site.company}); } }catch(e){ fail++; }
    if(!shared.DB) Object.entries(local).forEach(([k,arr])=>{ if(Array.isArray(arr)) ls.set(k,JSON.stringify(arr)); });
    shared.demoStock=false; ls.set("demoDoneS","1"); ls.set("demoDone","1");
    logAct("backup","add","שחזור מגיבוי "+String(obj.exportedAt||"").slice(0,10)+" · "+fmtN(n)+" רשומות"+(fail?" · "+fail+" נכשלו":""),"");
    scrim.remove(); render(); renderStock(); toast("שוחזרו "+fmtN(n)+" רשומות"+(fail?", "+fail+" נכשלו":"")+".");
  };
}
/* ---- טעינת ספריות ---- */
export function loadScript(src){ return new Promise((res,rej)=>{ if(document.querySelector('script[src="'+src+'"]')) return res(); const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("load")); document.head.appendChild(s); }); }
/* ---- לשוניות ---- */
export function showTab(which){
  const tabs={over:["#tabOver","#viewOver"],day:["#tabDay","#viewDay"],cables:["#tabCables","#viewCables"],issues:["#tabIssues","#viewIssues"],stock:["#tabStock","#viewStock"],boq:["#tabBoq","#viewBoq"]};
  if(which==="con") which="over";
  if(which==="orders") which="boq";
  if(!tabs[which]) which="over";
  Object.entries(tabs).forEach(([k,[t,v]])=>{ $(t).setAttribute("aria-selected",String(k===which)); $(v).hidden=k!==which; });
  shared.fabTab=which; const fl=$("#fabLabel"); if(fl) fl.textContent=FAB_LABEL;
  ls.set("tab",which);
  window.scrollTo(0,0);
}
export function __init(){
/* ================= הגדרות אתר, גיבוי ושחזור ================= */
APP_VERSION = "9";   // 9 = דיווח בדיבור / צילום: כפתור מיקרופון, הקלטה או המיקרופון של המקלדת, תמונות, Claude מפרק לעובדים / ביצוע / חריגים / ציוד / טקסט היום עם אישור, תמונות מהשטח בדוח היומי · 8 = מבנה האתר מתוכנית: Claude קורא תמונת תוכנית (או JSON מודבק) לשדות, משטחים ותעלות במיקומם; שורות בפרופורציה לשדה · 7 = האתר לפי שלבים: איור מלמעלה (גדר, תעלות, משטחי אגירה / MVS / סקידים, שדות פאנלים) שנצבע מדיווחי הביצוע · 6 = דוח יומי כטופס הקבלן (פרטי היום, שעות כניסה/יציאה, ציוד, חתימות, ייצוא) · 1 = בסיס + כבלים · 2 = ניהול העבודה (דיווח ביצוע, פעילויות מתבנית, חריגים, סיכום יומי, דוח שבועי מורחב, קטגוריות חשמל) · 3 = פעילויות = סעיפי ההסכם (קוד סעיף, פרק, ימי עובד בהסכם ובפועל, בחירת סעיף לפי פרק בדיווח) · 4 = הכסף: חשבון חלקי לתקופה עם גיבוי, תמונה בדיווח, עבודה נוספת / עיכוב בחריגים, «שורף ימי עובד», «סופק ע״י» בתוף · 5 = שפת השטח: סיבות וסוגים מהקבוצה, ספייר / פסולת במשיכה, מילון כבלים מנורמל, סיכום יומי בסדר שלהם, «לקחתי מהמחסן»
APP_ID = "yoman-hashmal";
BACKUP_COLLS = ["deliveries","drums","pulls","moves","counts","issues","daylog","crew","dayinfo","status","blockers","log"];
SITE = {name:"עין תמר",company:"S.E.E",custom:false};
$("#btnSettings").onclick=openSettings;
csvOf = (head,rows)=>"\ufeff"+[head.join(",")].concat(rows.map(r=>r.map(c=>'"'+String(c??"").replace(/"/g,'""')+'"').join(","))).join("\r\n");
$("#tabOver").onclick=()=>showTab("over");
$("#tabStock").onclick=()=>showTab("stock");
$("#tabCables").onclick=()=>showTab("cables");
$("#tabIssues").onclick=()=>showTab("issues");
$("#tabDay").onclick=()=>showTab("day");
$("#tabBoq").onclick=()=>showTab("boq");
}
