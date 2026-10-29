import { $, actorName, ask, closer, esc, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN, holders, loadImg, realNotes } from "./01-stock.js";
import { siteLabel } from "./03-issues.js";
import { renderAlerts } from "./06-alerts.js";
import { canvasBlob } from "./09-doc-scanner.js";
import { dayRows, isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ACTIVITY_TEMPLATE, openActivityTemplate, openStatusEntry, saveStatus, statusCalc, statusHolidays } from "./16-status.js";
import { ROLE } from "./18-identity.js";
import { cableTypeLabel } from "./20-cables.js";
/* ================= ניהול העבודה: דיווח ביצוע יומי, חריגים, סיכום יומי =================
   דיווח ביצוע = רישום אחד בפעילות: תאריך, כמות, אזור, צוות. נכנס ל-daily של הפעילות (status/<id>) לצד הרישומים
   המהירים, ומשם לסטטוס, ל«האתר נבנה», לסיכום הקבלן, לסיכום היומי ולדוח השבועי. רישום עם id הוא דיווח ביצוע;
   רישום בלי id הוא הרישום המהיר הישן (סך היום), ורק אותו הרישום המהיר מחליף.
   חריג = מה שתוקע (חוסר חומר, תקלה, החלטה שמחכה), וגם מה שמגיע לחשבון: עבודה נוספת / שינוי, והמתנה / עיכוב שאינו באחריותנו (ימי עובד שאבדו).
   אוסף blockers. תוקע: פתוח עד שסוגרים, ומופיע בסיכום היומי ובדוח השבועי. לחשבון: נכנס לחשבון החלקי של התקופה (22-bill.js). */
export let BLK_KINDS, INSTRUCTORS, DELAY_CAUSES;
export function workRows(iso){
  return shared.STATUS.flatMap(a=>(a.daily||[]).filter(d=>d.date===iso&&(Number(d.actual)||d.note)).map(d=>({...d,activity:a}))).sort((x,y)=>(x.ts||0)-(y.ts||0));
}
export function workCrews(){ return [...new Set([...shared.STATUS.flatMap(a=>(a.daily||[]).map(d=>d.crew)),...(shared.CREW||[]).map(c=>c.contractor),...shared.daylog.map(w=>w.contractor),...(shared.pulls||[]).map(p=>p.crew)].filter(Boolean))].slice(0,40); }
export function workAreas(){ return [...new Set([...shared.STATUS.flatMap(a=>(a.daily||[]).map(d=>d.area)),...(shared.pulls||[]).map(p=>p.area),...shared.daylog.map(w=>w.area)].filter(Boolean))].slice(0,40); }
/* לחשבון: עבודה נוספת / עיכוב. ימי עובד = עובדים × שעות / 8; בלי שעות = יום שלם לכל עובד */
export function isClaim(b){ return !!b&&(b.kind==="extra"||b.kind==="delay"); }
export function claimManDays(b){ const w=Number(b.workers)||0, h=Number(b.hours)||0; return w?Math.round((h?w*h/8:w)*10)/10:0; }
/* תמונה על רשומה (דיווח ביצוע, חריג): photo = מזהה במאגר הקבצים (נקרא מ-/_blob/), photoUrl, או photoData = data URL מוקטן כשאין מאגר */
export function photoSrc(r){ return r?(r.photo?"/_blob/"+r.photo:(r.photoUrl||r.photoData||"")):""; }
export async function photoBlob(file,max,q){ const im=await loadImg(file); const w=im.naturalWidth||im.width, hh=im.naturalHeight||im.height, k=Math.min(1,(max||1600)/Math.max(w,hh));
  const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(hh*k)); c.getContext("2d").drawImage(im,0,0,c.width,c.height); return canvasBlob(c,q||0.8); }
export async function photoFields(file){ const bl=await photoBlob(file,1600,0.8);
  if(shared.ASSETS&&shared.DB){ const a=await shared.ASSETS.upload(bl); return {photo:a.id,photoUrl:a.url}; }
  const th=await photoBlob(bl,480,0.6); return {photoData:await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(th); })}; }
/* בוחר תמונה משותף: html לשיבוץ בחלון, ו-bind(scrim) שמחזיר apply(doc) שמעלה / מסיר את התמונה על המסמך לפני השמירה */
export function photoPicker(id,existing){
  const src=photoSrc(existing);
  const html='<div class="f"><label>תמונה (לא חובה)</label><div class="pph" id="'+id+'Box">'+(src?'<img src="'+esc(src)+'" alt="" class="pthumb">':'')
    +'<label class="pbtn"><input type="file" id="'+id+'" accept="image/*" hidden>'+(src?'החלף תמונה':'צלם / בחר תמונה')+'</label>'+(src?'<button type="button" class="ghost" id="'+id+'Rm">הסר</button>':'')+'</div></div>';
  return {html,bind(scrim){ let file=null, removed=false; const box=scrim.querySelector("#"+id+"Box"), inp=scrim.querySelector("#"+id), rm=scrim.querySelector("#"+id+"Rm");
    inp.onchange=()=>{ file=inp.files&&inp.files[0]||null; removed=false; const old=box.querySelector(".pthumb"); if(old) old.remove(); if(file){ const im=document.createElement("img"); im.className="pthumb"; im.alt=""; im.src=URL.createObjectURL(file); box.prepend(im); } };
    if(rm) rm.onclick=()=>{ removed=true; file=null; const old=box.querySelector(".pthumb"); if(old) old.remove(); rm.remove(); };
    return {async apply(doc){ if(removed){ delete doc.photo; delete doc.photoUrl; delete doc.photoData; }
      if(file){ try{ const f=await photoFields(file); delete doc.photo; delete doc.photoUrl; delete doc.photoData; Object.assign(doc,f); }catch(e){ toast("התמונה לא נשמרה."); } } return doc; }}; }};
}
/* דיווח ביצוע: preset = {activityId, date, entry (לעריכה), area, crew} */
/* אפשרויות בחירת סעיף: לפי פרק (optgroup) בסדר ההופעה, עם קוד הסעיף לפני השם */
export function actOptions(A,selId){
  const groups=new Map(); A.forEach(a=>{ const g=a.group||""; if(!groups.has(g)) groups.set(g,[]); groups.get(g).push(a); });
  const opt=a=>'<option value="'+esc(a.id)+'"'+(a.id===selId?' selected':'')+'>'+esc((a.code?a.code+' · ':'')+a.name)+(a.unit?' · '+esc(a.unit):'')+'</option>';
  return [...groups.entries()].map(([g,L])=>g?'<optgroup label="'+esc(g)+'">'+L.map(opt).join("")+'</optgroup>':L.map(opt).join("")).join("");
}
// סעיף מכתיבה חופשית: אותו ניסוח (בלי רווחים כפולים, אותיות קטנות) = אותו סעיף; חדש נוצר בפרק «דיווח חופשי» בלי כמות בהסכם
const normName=s=>String(s||"").toLowerCase().replace(/["'׳״`\-_.·,]/g,"").replace(/\s+/g," ").trim();
export function freeActivity(text){
  const n=normName(text); const ex=(shared.STATUS||[]).find(a=>normName(a.name)===n); if(ex) return ex;
  const order=Math.max(0,...(shared.STATUS||[]).map(a=>Number(a.order)||0))+1;
  return {id:"st"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,5),order,name:text,unit:"",total:0,workDays:0,start:"",group:"דיווח חופשי",source:"דיווח",daily:[]};
}
// סעיפי הסקופ (תבנית הפעילויות של המופע) שעוד לא נטענו: נבחרים ישירות בדיווח ונוצרים בשמירה
export function scopeOptions(A){
  if(A.some(a=>a.source==="תבנית"||a.source==="קובץ סטטוס")) return "";   // התבנית כבר נטענה (או יובא סטטוס): מה שנמחק משם נמחק בכוונה
  const have=new Set(A.map(a=>normName(a.code?a.code+" "+a.name:a.name))), byCode=new Set(A.map(a=>a.code).filter(Boolean));
  const rows=ACTIVITY_TEMPLATE.map((r,i)=>[r,i]).filter(([r])=>!(r.code&&byCode.has(r.code))&&!have.has(normName(r.code?r.code+" "+r.name:r.name)));
  if(!rows.length) return "";
  const groups=new Map(); rows.forEach(([r,i])=>{ const g=r.group||""; if(!groups.has(g)) groups.set(g,[]); groups.get(g).push([r,i]); });
  return [...groups.entries()].map(([g,L])=>'<optgroup label="'+esc((g?g+" · ":"")+"מהסקופ")+'">'+L.map(([r,i])=>'<option value="tpl:'+i+'">'+esc((r.code?r.code+' · ':'')+r.name)+(r.unit?' · '+esc(r.unit):'')+'</option>').join("")+'</optgroup>').join("");
}
export function scopeActivity(i){
  const r=ACTIVITY_TEMPLATE[i]; if(!r) return null;
  const ex=(shared.STATUS||[]).find(a=>(r.code&&a.code===r.code)||normName(a.name)===normName(r.name)); if(ex) return ex;
  const order=Math.max(0,...(shared.STATUS||[]).map(a=>Number(a.order)||0))+1;
  return {id:"st"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,5),order,...r,source:"סקופ",daily:[]};
}
export function openWorkReport(preset){
  preset=preset||{}; const entry=preset.entry||null, edit=!!entry;
  const A=shared.STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0)), hol=statusHolidays();
  const actId=preset.activityId||(A.length===1&&A[0].source!=="דיווח"?A[0].id:"");   // סעיף יחיד נבחר מראש, אלא אם הוא עצמו מכתיבה חופשית
  // בלי סעיפים, או סעיף שנוצר מכתיבה חופשית: שורת «מה בוצע» כמו ב«דוח עבודה יומי» בדף; הסעיף נוצר מהטקסט והמפה נצבעת ממנו
  const freeAct=entry&&A.find(x=>x.id===preset.activityId&&x.source==="דיווח"); const freeDefault=!actId&&(A.every(a=>a.source==="דיווח")||!!freeAct);   // כל עוד אין סעיפי הסכם, כתיבה חופשית היא ברירת המחדל
  const date=entry?entry.date:(preset.date||shared.dayISO||isoOf(Date.now()));
  const dl=(id,a)=>'<datalist id="'+id+'">'+a.map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist>';
  const pk=photoPicker("prPhoto",entry);   // תמונה של מה שבוצע: הגיבוי לחשבון החלקי
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="דיווח ביצוע"><div class="grab"></div><h2>'+(edit?"עדכון דיווח ביצוע":"דיווח ביצוע")+'</h2>'
    +(A.length?'':'<div class="note-card">אין עדיין סעיפים: כותבים למטה מה בוצע, במילים. ואפשר גם אחרת: טוענים את תבנית סעיפי ההסכם (89 סעיפים לפי פרקים) ומתקנים כמויות ותאריכים לפרויקט.'+(ROLE==="owner"?' <button class="linkbtn" type="button" id="prTpl" style="min-height:0;padding:0 4px">טען תבנית ›</button>':'')+'</div>')
    +'<div class="f"><label for="prAct">סעיף / פעילות</label><select id="prAct"'+(edit?' disabled':'')+'><option value="">בחר סעיף</option><option value="__free"'+(freeDefault?' selected':'')+'>כתיבה חופשית: מה בוצע (בלי סעיף)</option>'+actOptions(A,actId)+(edit?'':scopeOptions(A))+'</select><div class="hint" id="prHint"></div><button class="linkbtn" type="button" id="prDescBtn" hidden style="min-height:0;padding:0 2px;margin-top:4px">מה כולל הסעיף ›</button><div class="hint" id="prDesc" hidden style="white-space:pre-line"></div></div>'
    +'<div class="f" id="prFreeF"'+(freeDefault?'':' hidden')+'><label for="prFree">מה בוצע</label><input type="text" id="prFree" autocomplete="off" placeholder="למשל: חפירת תעלה B1, הנחת כבל AL, הצבת מכולות אגירה" value="'+esc(freeAct?freeAct.name:"")+'"'+(edit?' disabled':'')+'><div class="hint">שורה אחת לכל עבודה. אותה עבודה בימים אחרים: אותו ניסוח, והיא מצטברת.</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="prQty">כמות שבוצעה</label><input type="text" id="prQty" inputmode="decimal" placeholder="כמות" value="'+(entry&&Number(entry.actual)?esc(entry.actual):"")+'"></div><div class="f"><label for="prDate">תאריך</label><input type="date" id="prDate" value="'+esc(date)+'"></div></div>'
    +'<div class="f"><label for="prArea">אזור / שדה / סטרינג</label><input type="text" id="prArea" list="prAreas" autocomplete="off" placeholder="למשל: תעלה B1 · צפון מזרח, או ממיר 3.07" value="'+esc(entry?entry.area||"":preset.area||"")+'">'+dl("prAreas",workAreas())+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="prCrew">צוות / קבלן משנה</label><input type="text" id="prCrew" list="prCrews" autocomplete="off" placeholder="צוות 1, קבלן משנה א" value="'+esc(entry?entry.crew||"":preset.crew||"")+'">'+dl("prCrews",workCrews())+'</div><div class="f"><label for="prWorkers">עובדים בסעיף</label><input type="text" id="prWorkers" inputmode="numeric" placeholder="כמה עבדו" value="'+(entry&&Number(entry.workers)?esc(entry.workers):"")+'"></div></div>'
    +pk.html
    +'<div class="f"><label for="prNote">הערה (לא חובה)</label><input type="text" id="prNote" placeholder="למשל: נעצר, אין שאיבה" value="'+esc(entry?entry.note||"":"")+'"></div>'
    +'<div class="acts"><button class="save" id="prSave" type="button">'+(edit?"שמור עדכון":"שמור דיווח")+'</button>'+(edit&&ROLE==="owner"?'<button class="cancel danger" id="prDel" type="button">מחק</button>':'')+'<button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel:not(.danger)").onclick=close; const pkb=pk.bind(scrim);
  const tpl=q("#prTpl"); if(tpl) tpl.onclick=()=>{ close(); openActivityTemplate(); };
  const hint=()=>{ const a=A.find(x=>x.id===q("#prAct").value), dsc=q("#prDesc"), db=q("#prDescBtn"); q("#prFreeF").hidden=q("#prAct").value!=="__free"; if(!a){ q("#prHint").textContent=""; dsc.hidden=true; db.hidden=true; return; } const c=statusCalc(a,hol);
    q("#prHint").innerHTML='בוצע <b>'+fmtN(c.done)+'</b> מתוך '+fmtN(a.total)+(a.unit?' '+esc(a.unit):'')+' · '+Math.round(c.pct*100)+'%'+(c.remaining?(!c.planned?'':c.reqNow===null?' · <b style="color:var(--clay)">נגמרו ימי העבודה</b>':' · נדרש <b>'+fmtN(c.reqNow)+'</b> ליום'):' · הושלם')+(c.manPlan||c.manDone?' · ימי עובד <b>'+fmtN(c.manDone)+'</b> / '+(c.manPlan?fmtN(c.manPlan):'—'):'');
    dsc.textContent=a.desc||""; dsc.hidden=true; db.hidden=!a.desc; db.textContent="מה כולל הסעיף ›"; };   // התיאור המלא מההסכם, בלחיצה
  q("#prDescBtn").onclick=()=>{ const d=q("#prDesc"); d.hidden=!d.hidden; q("#prDescBtn").textContent=d.hidden?"מה כולל הסעיף ›":"סגור ‹"; };
  q("#prAct").onchange=hint; hint();
  q("#prSave").onclick=async()=>{
    const free=q("#prAct").value==="__free", text=free?q("#prFree").value.trim().replace(/\s+/g," ").slice(0,80):"";
    const sel=q("#prAct").value, tpl=sel.startsWith("tpl:")?scopeActivity(Number(sel.slice(4))):null;
    const a=free?(freeAct||freeActivity(text)):tpl||A.find(x=>x.id===sel); if(free&&!text){ toast("מה בוצע?"); return; } if(!a){ toast("איזו פעילות?"); return; }
    const d=q("#prDate").value, qtyIn=Number(String(q("#prQty").value).replace(",","."))||0, note=q("#prNote").value.trim();
    const qty=qtyIn||(free||(tpl&&!tpl.total)?1:0);   // כתיבה חופשית, או סעיף סקופ בלי כמות בהסכם, בלי כמות = «בוצע» פעם אחת (סימון על המפה)
    if(!d){ toast("תאריך?"); return; } if(!qty&&!note){ toast("כמה בוצע?"); return; }
    const cur=shared.STATUS.find(x=>x.id===a.id)||a;
    const rec={id:entry?entry.id:"wr"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date:d,actual:qty,area:q("#prArea").value.trim(),crew:q("#prCrew").value.trim(),note,by:actorName(),ts:Date.now()};
    const workers=Math.round(Number(String(q("#prWorkers").value).replace(",","."))||0); if(workers>0) rec.workers=workers;   // ימי עובד בפועל לסעיף
    if(entry) ["photo","photoUrl","photoData"].forEach(k=>{ if(entry[k]) rec[k]=entry[k]; });
    const b=q("#prSave"); b.disabled=true; b.textContent="שומר…";
    await pkb.apply(rec);   // תמונה: מועלית למאגר הקבצים, או נשמרת מוקטנת כשאין מאגר
    const daily=(cur.daily||[]).filter(x=>x.id!==rec.id).concat(rec).sort((x,y)=>x.date<y.date?-1:1);
    if(!(await saveStatus({...cur,daily,updated:Date.now()}))){ b.disabled=false; b.textContent=edit?"שמור עדכון":"שמור דיווח"; return; }
    logAct("progress",edit?"edit":"add","דיווח ביצוע: "+(cur.code?cur.code+" ":"")+cur.name+" "+fmtN(qty)+(cur.unit?" "+cur.unit:"")+" ב-"+isoText(d)+(rec.area?" · "+rec.area:"")+(rec.crew?" · "+rec.crew:"")+(rec.workers?" · "+rec.workers+" עובדים":""),cur.id);
    close(); renderWorkDay(); const c=statusCalc({...cur,daily},hol);
    toast(cur.name+(cur.total?": "+fmtN(c.done)+" מתוך "+fmtN(cur.total)+(c.remaining&&c.reqNow!==null?" · נדרש "+fmtN(c.reqNow)+" ליום":""):": נרשם"+(rec.area?" · "+rec.area:"")));
  };
  const del=q("#prDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את הדיווח הזה?","מחק","var(--clay)"))) return;
    const cur=shared.STATUS.find(x=>x.id===q("#prAct").value); if(!cur) return;
    if(await saveStatus({...cur,daily:(cur.daily||[]).filter(x=>x.id!==entry.id),updated:Date.now()})){ logAct("progress","delete","נמחק דיווח ביצוע: "+cur.name+" "+fmtN(entry.actual)+" ב-"+isoText(entry.date),cur.id,null,entry); close(); renderWorkDay(); } };
  if(!edit) setTimeout(()=>{ if(!scrim.contains(document.activeElement)) q(actId?"#prQty":"#prAct").focus(); },60);   // לא גונבים מיקוד אם כבר התחילו להקליד
}
/* הכרטיס «בוצע ביום הזה» בלשונית עובדים: דיווחי הביצוע של היום שנבחר */
export function renderWorkDay(){
  const el=$("#dyWork"); if(!el) return; const iso=shared.dayISO||isoOf(Date.now()); const rows=workRows(iso);
  foldSum("work",rows.length?rows.length+" דיווחים":"");
  el.innerHTML=rows.length?"":'<div class="empty" style="padding:14px">אין עדיין דיווח ביצוע ליום '+esc(isoText(iso))+'. «דיווח ביצוע»: פעילות, כמות, אזור, צוות.</div>';
  rows.forEach(r=>{ const b=document.createElement("button"); b.type="button"; b.className="slip";
    b.innerHTML='<b>'+(r.activity.code?'<span class="code">'+esc(r.activity.code)+'</span>':'')+esc(r.activity.name)+'</b><span class="qn">'+(Number(r.actual)?fmtN(r.actual)+(r.activity.unit?' <small>'+esc(r.activity.unit)+'</small>':''):'—')+'</span><span>'+esc([r.area,r.crew,r.workers?r.workers+" עובדים":"",r.note,photoSrc(r)?"📷":""].filter(Boolean).join(" · ")||(r.by?"רשם "+r.by:"רישום מהיר"))+'</span>';
    b.onclick=()=>{ if(ROLE==="viewer") return; if(r.id) openWorkReport({activityId:r.activity.id,entry:r}); else openStatusEntry(r.activity); }; el.appendChild(b); });
}
/* תפוקה שדווחה לצוות / קבלן בתקופה: לפי פעילות. «ללא קבלן» = דיווחים בלי צוות או עם צוות שאינו קבלן ברשימה */
export function workOutput(crew,from,to,cons){
  const own=crew==="ללא קבלן", set=new Set(cons||[]), m=new Map();
  shared.STATUS.forEach(a=>(a.daily||[]).forEach(d=>{ if(d.date<from||d.date>to||!Number(d.actual)) return; const c=(d.crew||"").trim(); if(!(own?!set.has(c):c===crew)) return;
    const e=m.get(a.id)||{name:a.name,unit:a.unit||"",qty:0,days:new Set()}; e.qty+=Number(d.actual); e.days.add(d.date); m.set(a.id,e); }));
  return [...m.values()].sort((x,y)=>y.qty-x.qty);
}
/* ---- חריגים ---- */
export async function saveBlocker(doc){
  try{ if(shared.DB) await shared.DB.doc("blockers/"+doc.id).set(doc); else { shared.blockers=(shared.blockers||[]).filter(x=>x.id!==doc.id).concat(doc); ls.set("blockers",JSON.stringify(shared.blockers)); } }
  catch(e){ toast("השמירה נכשלה."); return false; }
  renderBlockers(); return true;
}
export function openBlocker(existing){
  const b=existing?{...existing}:{id:"bk"+Date.now().toString(36)+Math.random().toString(36).slice(2,4),ts:Date.now(),date:shared.dayISO||isoOf(Date.now()),text:"",kind:"material",area:"",status:"open",by:actorName()};
  let kind=b.kind||"other", status=b.status||"open", who=b.instructedBy||"", written=b.written===true?"1":b.written===false?"0":"", cause=b.cause||"";
  const chips=(id,obj,sel)=>'<div class="opts" id="'+id+'">'+Object.entries(obj).map(([k,v])=>'<button class="opt" type="button" data-k="'+k+'" aria-pressed="'+(k===sel)+'">'+v+'</button>').join("")+'</div>';
  const pk=photoPicker("bkPhoto",existing);
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="חריג"><div class="grab"></div><h2>'+(existing?"חריג":"חריג חדש")+'</h2>'
    +'<div class="f"><label>סוג</label>'+chips("bkKind",BLK_KINDS,kind)+'<div class="hint" id="bkKindHint"></div></div>'
    +'<div class="f"><label for="bkText" id="bkTextLab">מה תוקע</label><textarea id="bkText" placeholder="למשל: מים בתעלה B2 דרום מערב, צוות של 4 עומד מ-7, ביקשנו שאיבה">'+esc(b.text)+'</textarea></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="bkArea">אזור</label><input type="text" id="bkArea" list="bkAreas" autocomplete="off" value="'+esc(b.area||"")+'"><datalist id="bkAreas">'+workAreas().map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist></div><div class="f"><label for="bkDate">מתאריך</label><input type="date" id="bkDate" value="'+esc(b.date||"")+'"></div></div>'
    +'<div id="bkClaim" hidden>'
      +'<div class="f" id="bkWhoF"><label>מי הורה</label>'+chips("bkWho",INSTRUCTORS,who)+'<div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:6px"><input type="text" id="bkWhoName" placeholder="שם (לא חובה)" autocomplete="off" value="'+esc(b.instructedName||"")+'"><div class="opts" id="bkWritten"><button class="opt" type="button" data-k="1" aria-pressed="'+(written==="1")+'">בכתב</button><button class="opt" type="button" data-k="0" aria-pressed="'+(written==="0")+'">בעל פה</button></div></div></div>'
      +'<div class="f" id="bkCauseF"><label>סיבה</label>'+chips("bkCause",DELAY_CAUSES,cause)+'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div class="f"><label for="bkWorkers">עובדים</label><input type="text" id="bkWorkers" inputmode="numeric" placeholder="כמה" value="'+(Number(b.workers)?esc(b.workers):"")+'"></div><div class="f"><label for="bkHours">שעות</label><input type="text" id="bkHours" inputmode="decimal" placeholder="לכל אחד" value="'+(Number(b.hours)?esc(b.hours):"")+'"></div><div class="f" id="bkQtyF"><label for="bkQty">כמות</label><input type="text" id="bkQty" placeholder="למשל 120 מ׳" value="'+esc(b.qty||"")+'"></div></div>'
      +'<div class="hint" id="bkMan"></div></div>'
    +pk.html
    +(existing?'<div class="f"><label>מצב</label><div class="opts" id="bkSt"><button class="opt" type="button" data-v="open" aria-pressed="'+(status!=="closed")+'">פתוח</button><button class="opt" type="button" data-v="closed" aria-pressed="'+(status==="closed")+'">נסגר</button></div><input type="text" id="bkClose" placeholder="איך נסגר (למשל: ביובית שאבה ב-6:00)" style="margin-top:8px" value="'+esc(b.closeNote||"")+'"'+(status==="closed"?'':' hidden')+'></div>':'')
    +'<div class="acts"><button class="save" id="bkSave" type="button">שמור</button>'+(existing&&ROLE==="owner"?'<button class="cancel danger" id="bkDel" type="button">מחק</button>':'')+'<button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel:not(.danger)").onclick=close; const pkb=pk.bind(scrim);
  const press=(id,k)=>scrim.querySelectorAll("#"+id+" .opt").forEach(o=>o.setAttribute("aria-pressed",String(o.dataset.k===k)));
  const man=()=>{ const w=Number(q("#bkWorkers").value)||0, h=Number(String(q("#bkHours").value).replace(",","."))||0, md=claimManDays({workers:w,hours:h});
    q("#bkMan").textContent=w?(kind==="delay"?"ימי עובד שאבדו: ":"ימי עובד שהושקעו: ")+fmtN(md)+(h?" ("+w+" × "+fmtN(h)+" שעות / 8)":" (יום שלם לכל עובד)"):""; };
  const mode=()=>{ const claim=kind==="extra"||kind==="delay"; q("#bkClaim").hidden=!claim; q("#bkWhoF").hidden=kind!=="extra"; q("#bkQtyF").hidden=kind!=="extra"; q("#bkCauseF").hidden=kind!=="delay";
    q("#bkTextLab").textContent=kind==="extra"?"מה נעשה / מה השתנה":kind==="delay"?"מה עצר / למה חיכינו":"מה תוקע";
    q("#bkText").placeholder=kind==="extra"?"למשל: הזזת נקודות ממירים כולל סימונים, לפי הוראת המפקח":kind==="delay"?"למשל: חיכינו למודד בחלקה 3, הצוות עמד מ-7 עד 10":kind==="material"?"למשל: חסר כבל 6 שחור לשדה 2, נגמר אתמול. הוזמן? מתי מגיע?":"למשל: מים בתעלה B2 דרום מערב, צוות של 4 עומד מ-7, ביקשנו שאיבה";
    q("#bkKindHint").textContent=kind==="extra"?"נכנס לחשבון החלקי של התקופה כעבודה נוספת: מי הורה, בכתב או בעל פה, וכמה עבדנו.":kind==="delay"?"עיכוב שאינו באחריותנו: מגן מקנסות ונותן בסיס לדרישה. כמה עובדים עמדו וכמה שעות.":"";
    const st=q("#bkSt"); if(st){ st.querySelector('[data-v="open"]').textContent=claim?"טרם הוגש":"פתוח"; st.querySelector('[data-v="closed"]').textContent=claim?"הוגש / סוכם":"נסגר"; q("#bkClose").placeholder=claim?"למשל: הוגש בחשבון 3":"איך נסגר (למשל: ביובית שאבה ב-6:00)"; }
    man(); };
  q("#bkKind").onclick=e=>{ const x=e.target.closest("[data-k]"); if(!x) return; kind=x.dataset.k; press("bkKind",kind); mode(); };
  q("#bkWho").onclick=e=>{ const x=e.target.closest("[data-k]"); if(!x) return; who=who===x.dataset.k?"":x.dataset.k; press("bkWho",who); };
  q("#bkWritten").onclick=e=>{ const x=e.target.closest("[data-k]"); if(!x) return; written=written===x.dataset.k?"":x.dataset.k; press("bkWritten",written); };
  q("#bkCause").onclick=e=>{ const x=e.target.closest("[data-k]"); if(!x) return; cause=cause===x.dataset.k?"":x.dataset.k; press("bkCause",cause); };
  q("#bkWorkers").oninput=man; q("#bkHours").oninput=man;
  const st=q("#bkSt"); if(st) st.onclick=e=>{ const x=e.target.closest("[data-v]"); if(!x) return; status=x.dataset.v; st.querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===x))); q("#bkClose").hidden=status!=="closed"; };
  q("#bkSave").onclick=async()=>{
    const text=q("#bkText").value.trim(); if(!text){ toast(kind==="extra"?"מה נעשה? כמה מילים.":kind==="delay"?"מה עצר? כמה מילים.":"מה תוקע? כמה מילים."); return; }
    const doc={...b,text,kind,area:q("#bkArea").value.trim(),date:q("#bkDate").value||b.date,status,updated:Date.now()};
    ["instructedBy","instructedName","written","cause","workers","hours","qty"].forEach(k=>delete doc[k]);
    if(kind==="extra"||kind==="delay"){ const w=Math.round(Number(q("#bkWorkers").value)||0), h=Number(String(q("#bkHours").value).replace(",","."))||0;
      if(w) doc.workers=w; if(h) doc.hours=h;
      if(kind==="extra"){ if(who) doc.instructedBy=who; const nm=q("#bkWhoName").value.trim(); if(nm) doc.instructedName=nm; if(written) doc.written=written==="1"; const qty=q("#bkQty").value.trim(); if(qty) doc.qty=qty; }
      else if(cause) doc.cause=cause; }
    if(status==="closed"){ doc.closedAt=b.closedAt||Date.now(); doc.closeNote=(q("#bkClose")||{}).value||""; doc.closedBy=b.closedBy||actorName(); } else { delete doc.closedAt; delete doc.closeNote; delete doc.closedBy; }
    const sb=q("#bkSave"); sb.disabled=true; sb.textContent="שומר…";
    await pkb.apply(doc);
    if(!(await saveBlocker(doc))){ sb.disabled=false; sb.textContent="שמור"; return; }
    const what=kind==="extra"?"עבודה נוספת":kind==="delay"?"עיכוב":"חריג";
    logAct("blocker",existing?"edit":"add",(status==="closed"?(isClaim(doc)?"הוגש · ":"נסגר ")+what+": ":existing?"עודכן "+what+": ":what+" חדש: ")+text.slice(0,80)+(doc.area?" · "+doc.area:"")+(doc.workers?" · "+fmtN(claimManDays(doc))+" ימי עובד":""),doc.id);
    close(); toast(status==="closed"?(isClaim(doc)?"סומן כהוגש.":"החריג נסגר."):kind==="extra"?"העבודה הנוספת נרשמה. נכנסת לחשבון החלקי של התקופה.":kind==="delay"?"העיכוב נרשם. נכנס לחשבון החלקי של התקופה.":"החריג נרשם. יופיע בסיכום היומי עד שייסגר.");
  };
  const del=q("#bkDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את החריג?","מחק","var(--clay)"))) return;
    try{ if(shared.DB) await shared.DB.doc("blockers/"+b.id).delete(); else { shared.blockers=(shared.blockers||[]).filter(x=>x.id!==b.id); ls.set("blockers",JSON.stringify(shared.blockers)); } }catch(e){ toast("המחיקה נכשלה."); return; }
    logAct("blocker","delete","נמחק חריג: "+b.text.slice(0,80),b.id,null,b); close(); renderBlockers(); };
  if(!existing) setTimeout(()=>{ if(!scrim.contains(document.activeElement)) q("#bkText").focus(); },60);
  mode();
}export function blockerAge(b,iso){ return Math.max(0,Math.round((new Date((iso||isoOf(Date.now()))+"T12:00:00").getTime()-new Date((b.date||isoOf(b.ts))+"T12:00:00").getTime())/864e5)); }
export function renderBlockers(){
  const el=$("#blkList"); if(!el) return; const B=shared.blockers||[];
  const open=B.filter(b=>b.status!=="closed"&&!isClaim(b)).sort((a,b)=>(a.date||"")<(b.date||"")?-1:1), closed=B.filter(b=>b.status==="closed").sort((a,b)=>(b.closedAt||0)-(a.closedAt||0)).slice(0,5);
  const claims=B.filter(b=>isClaim(b)&&b.status!=="closed").sort((a,b)=>(a.date||"")<(b.date||"")?1:-1), late=open.filter(b=>blockerAge(b)>3).length;
  foldSum("blk",[open.length?open.length+" פתוחים"+(late?" · "+late+" מעל 3 ימים":""):"",claims.length?claims.length+" לחשבון":""].filter(Boolean).join(" · "));
  el.innerHTML="";
  if(!open.length) el.innerHTML='<div class="empty" style="padding:14px">'+(B.length?'אין חריגים פתוחים.':'אין חריגים פתוחים. כשמשהו תוקע את העבודה (חסר חומר, תקלה, החלטה שמחכה) רושמים אותו כאן, והוא נכנס לסיכום היומי ולדוח השבועי עד שנסגר. עבודה נוספת או המתנה שלא באשמתנו רושמים גם כאן, והן נכנסות לחשבון החלקי.')+'</div>';
  open.forEach(b=>{ const d=blockerAge(b); const x=document.createElement("button"); x.type="button"; x.className="slip blk"+(d>3?" late":"");
    x.innerHTML='<b>'+esc(b.text)+'</b><span class="qn" style="color:'+(d>3?'var(--clay)':'var(--ink2)')+'">'+(d?d+' <small>ימים</small>':'היום')+'</span><span>'+esc([BLK_KINDS[b.kind]||"",b.area,b.by?"רשם "+b.by:"",photoSrc(b)?"📷":""].filter(Boolean).join(" · "))+'</span>';
    x.onclick=()=>{ if(ROLE!=="viewer") openBlocker(b); }; el.appendChild(x); });
  // לחשבון: עבודות נוספות ועיכובים שטרם הוגשו. נשארים כאן עד שמסמנים «הוגש», ונכנסים לחשבון החלקי של התקופה שלהם
  if(claims.length){ const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--pv)"></i>לחשבון: עבודות נוספות ועיכובים<span>'+claims.length+'</span>'; el.appendChild(h);
    claims.slice(0,8).forEach(b=>{ const x=document.createElement("button"); x.type="button"; x.className="slip blk claim"; const md=claimManDays(b);
      x.innerHTML='<b><span class="kind">'+(b.kind==="extra"?"נוספת":"עיכוב")+'</span>'+esc(b.text)+'</b><span class="qn">'+(md?fmtN(md)+' <small>ימי עובד</small>':b.qty?esc(b.qty):'')+'</span><span>'+esc([isoText(b.date||isoOf(b.ts)),b.area,b.kind==="extra"?(INSTRUCTORS[b.instructedBy]||""):(DELAY_CAUSES[b.cause]||""),photoSrc(b)?"📷":""].filter(Boolean).join(" · "))+'</span>';
      x.onclick=()=>{ if(ROLE!=="viewer") openBlocker(b); }; el.appendChild(x); });
    if(claims.length>8){ const m=document.createElement("div"); m.className="hint"; m.style.padding="4px 2px"; m.textContent="ועוד "+(claims.length-8)+". כולם בחשבון החלקי."; el.appendChild(m); } }
  if(closed.length){ const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--sage-fill)"></i>נסגרו לאחרונה<span>'+closed.length+'</span>'; el.appendChild(h);
    closed.forEach(b=>{ const x=document.createElement("button"); x.type="button"; x.className="slip blk done";
      x.innerHTML='<b>'+(isClaim(b)?'<span class="kind">'+(b.kind==="extra"?"נוספת":"עיכוב")+'</span>':'')+esc(b.text)+'</b><span class="qn" style="color:var(--sage)">'+(isClaim(b)?'הוגש':'נסגר')+'</span><span>'+esc([b.closedAt?isoText(isoOf(b.closedAt)):"",b.closeNote].filter(Boolean).join(" · "))+'</span>';
      x.onclick=()=>{ if(ROLE!=="viewer") openBlocker(b); }; el.appendChild(x); }); }
  renderAlerts();
}
/* ---- סיכום יומי (docs/templates/daily-summary.md): מספרים מהאפליקציה בלבד, בלי שמות עובדים, בלי מחירים ---- */
export function dailySummaryText(iso){
  iso=iso||shared.dayISO||isoOf(Date.now()); const t0=new Date(iso+"T00:00:00").getTime(), t1=t0+864e5; const inD=t=>t>=t0&&t<t1;
  const dayName=new Date(iso+"T12:00:00").toLocaleDateString("he-IL",{weekday:"long"});
  const L=["יומן חשמל · "+siteLabel()+" · "+dayName+" "+isoText(iso),""];
  // 1. בוצע (עם קוד הסעיף), ומול ההסכם
  const work=workRows(iso).filter(r=>Number(r.actual)); const byA=new Map(); work.forEach(r=>{ const e=byA.get(r.activity.id)||{a:r.activity,q:0}; e.q+=Number(r.actual); byA.set(r.activity.id,e); });
  const aLab=a=>(a.code?a.code+" ":"")+a.name, men=work.reduce((s,r)=>s+(Number(r.workers)||0),0);
  L.push("בוצע: "+(byA.size?[...byA.values()].map(e=>aLab(e.a)+": "+fmtN(e.q)+(e.a.unit?" "+e.a.unit:"")).join(" · ")+(men?" · עובדים בסעיפים: "+men:""):"לא דווח"));
  const hol=statusHolidays(); const plan=[...byA.values()].map(e=>{ const c=statusCalc(e.a,hol);
    return aLab(e.a)+" "+Math.round(c.pct*100)+"%"+(c.remaining?(c.planned?" (קצב נדרש "+(c.reqNow===null?"—":fmtN(c.reqNow))+" ליום, בפועל "+fmtN(e.q)+")":"")+(c.manPlan?" · ימי עובד "+fmtN(c.manDone)+"/"+fmtN(c.manPlan):""):" (הושלם)"); });
  if(plan.length) L.push("מול ההסכם: "+plan.join(" · "));
  // 2. ממתין לאישור, 3. תקוע (עם הסיבה), 4. צוות עמד, 5. עבודות נוספות
  const B=(shared.blockers||[]), open=B.filter(b=>b.status!=="closed"&&!isClaim(b)&&(b.date||isoOf(b.ts))<=iso);
  const wait=open.filter(b=>b.kind==="decision"), stuck=open.filter(b=>b.kind!=="decision");
  const bl=b=>b.text+((b.area||(b.kind!=="other"&&b.kind!=="decision"))?" ("+[b.area,b.kind!=="other"&&b.kind!=="decision"?BLK_KINDS[b.kind]:""].filter(Boolean).join(", ")+")":"");
  L.push("ממתין לאישור: "+(wait.length?wait.slice(0,6).map(bl).join(" · "):"אין"));
  L.push("תקוע: "+(stuck.length?stuck.slice(0,6).map(bl).join(" · "):"אין"));
  const cl=B.filter(b=>isClaim(b)&&(b.date||isoOf(b.ts))===iso), ex=cl.filter(b=>b.kind==="extra"), dly=cl.filter(b=>b.kind==="delay");
  if(dly.length) L.push("צוות עמד: "+dly.map(b=>(Number(b.workers)?b.workers+" עובדים"+(Number(b.hours)?" × "+fmtN(b.hours)+" שעות":"")+", ":"")+b.text+(DELAY_CAUSES[b.cause]?" ("+DELAY_CAUSES[b.cause]+")":"")).join(" · ")+" · ימי עובד שאבדו: "+fmtN(dly.reduce((s,b)=>s+claimManDays(b),0)));
  if(ex.length) L.push("עבודות נוספות: "+ex.map(b=>b.text+(b.qty?" ("+b.qty+")":"")+(INSTRUCTORS[b.instructedBy]?" · הורה: "+INSTRUCTORS[b.instructedBy]:"")).join(" · "));
  // 6. הגיע לאתר, כבלים, ניפוקים, עובדים
  const notes=realNotes().filter(n=>inD(n.ts)); const top=notes.flatMap(n=>n.lines||[]).filter(l=>Number(l.qty)>0).sort((a,b)=>b.qty-a.qty).slice(0,3);
  const drumsIn=(shared.drums||[]).filter(d=>inD(d.ts));
  L.push("הגיע לאתר: "+(notes.length?notes.length+" תעודות"+(top.length?" · "+top.map(l=>l.name+" "+fmtN(l.qty)+(l.unit?" "+l.unit:"")).join(", "):""):"אין תעודות")+(drumsIn.length?" · "+drumsIn.length+" תופים":""));
  const pulls=(shared.pulls||[]).filter(p=>p.date===iso); const byT=new Map(); pulls.forEach(p=>byT.set(p.cableType,(byT.get(p.cableType)||0)+(Number(p.meters)||0)));
  const closed=(shared.drums||[]).filter(d=>d.closedAt&&inD(d.closedAt)), rem=closed.reduce((s,d)=>s+(Number(d.remainderAtClose)||0),0), spare=pulls.reduce((s,p)=>s+(Number(p.spare)||0)+(Number(p.waste)||0),0);
  L.push("כבלים: "+(pulls.length?"נמשכו "+fmtN([...byT.values()].reduce((a,b)=>a+b,0))+" מ׳ ("+[...byT.entries()].map(([k,v])=>cableTypeLabel(k)+": "+fmtN(v)).join(", ")+")"+(spare?" · ספייר ופסולת "+fmtN(spare)+" מ׳":""):"לא נרשמו משיכות")+(closed.length?" · תופים שנסגרו: "+closed.length+" (שארית "+fmtN(rem)+" מ׳)":""));
  const iss=shared.issues.filter(s=>inD(s.ts)), tools=holders().filter(h=>h.cat==="tools");
  L.push("ניפוקים: "+iss.length+(iss.length?" ("+iss.filter(s=>s.sigAsset||s.sigUrl||s.sigData).length+" חתומים)":"")+" · כלים אצל אנשים: "+tools.length);
  const W=dayRows(iso), sub=W.filter(w=>w.contractor), hrs=W.reduce((s,w)=>s+(Number(w.hours)||0),0);
  L.push("עובדים: "+W.length+(W.length?" ("+(W.length-sub.length)+" שלנו, "+sub.length+" קבלן משנה)":"")+(hrs?" · שעות: "+fmtN(hrs):""));
  L.push("משימות למחר: ");
  return L.join("\n");
}
export function __init(){
// סוגים וסיבות בשפת השטח (docs: field-language-guide), מהנפוץ לנדיר
BLK_KINDS = {extra:"עבודה נוספת / שינוי",delay:"המתנה / עיכוב",material:"חוסר חומר / חומר לא נכון",plan:"תוכנית חסרה / סותרת",equip:"אין כלי / מפעיל",fault:"תקלה / ציוד",decision:"ממתין לאישור / החלטה",safety:"בטיחות",other:"אחר"};
INSTRUCTORS = {client:"היזם",pm:"החברה המנהלת / המפקח",main:"הקבלן הראשי",other:"אחר"};
DELAY_CAUSES = {water:"מים בתעלה / ממתין לשאיבה",survey:"ממתין לסימון מודד",inspector:"ממתין לאישור מפקח",site:"שטח לא מוכן",constr:"קונסטרוקציה",plan:"תוכנית חסרה / סותרת",mat:"חומר של היזם / הראשי",damage:"פגיעה ע״י קבלן אחר",equip:"אין כלי / מפעיל",access:"גישה לאתר",decision:"החלטה / אישור",weather:"מזג אוויר",other:"אחר"};
try{ shared.blockers=JSON.parse(ls.get("blockers")||"[]"); if(!Array.isArray(shared.blockers)) shared.blockers=[]; }catch(e){ shared.blockers=[]; }
const w=$("#btnWork"); if(w) w.onclick=()=>openWorkReport();
const dw=$("#btnDayWork"); if(dw) dw.onclick=()=>openWorkReport({date:shared.dayISO});
const bb=$("#btnBlocker"); if(bb) bb.onclick=()=>openBlocker();
renderBlockers(); renderWorkDay();
}
