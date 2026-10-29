import { $, actorName, ask, closer, esc, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN, holders, realNotes } from "./01-stock.js";
import { siteLabel } from "./03-issues.js";
import { renderAlerts } from "./06-alerts.js";
import { dayRows, isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { openActivityTemplate, openStatusEntry, saveStatus, statusCalc, statusHolidays } from "./16-status.js";
import { ROLE } from "./18-identity.js";
import { cableTypeLabel } from "./20-cables.js";
/* ================= ניהול העבודה: דיווח ביצוע יומי, חריגים, סיכום יומי =================
   דיווח ביצוע = רישום אחד בפעילות: תאריך, כמות, אזור, צוות. נכנס ל-daily של הפעילות (status/<id>) לצד הרישומים
   המהירים, ומשם לסטטוס, ל«האתר נבנה», לסיכום הקבלן, לסיכום היומי ולדוח השבועי. רישום עם id הוא דיווח ביצוע;
   רישום בלי id הוא הרישום המהיר הישן (סך היום), ורק אותו הרישום המהיר מחליף.
   חריג = מה שתוקע: חוסר חומר, תקלה, החלטה שמחכה. אוסף blockers; פתוח עד שסוגרים, ומופיע בסיכום היומי ובדוח השבועי. */
export let BLK_KINDS;
export function workRows(iso){
  return shared.STATUS.flatMap(a=>(a.daily||[]).filter(d=>d.date===iso&&(Number(d.actual)||d.note)).map(d=>({...d,activity:a}))).sort((x,y)=>(x.ts||0)-(y.ts||0));
}
export function workCrews(){ return [...new Set([...shared.STATUS.flatMap(a=>(a.daily||[]).map(d=>d.crew)),...(shared.CREW||[]).map(c=>c.contractor),...shared.daylog.map(w=>w.contractor),...(shared.pulls||[]).map(p=>p.crew)].filter(Boolean))].slice(0,40); }
export function workAreas(){ return [...new Set([...shared.STATUS.flatMap(a=>(a.daily||[]).map(d=>d.area)),...(shared.pulls||[]).map(p=>p.area),...shared.daylog.map(w=>w.area)].filter(Boolean))].slice(0,40); }
/* דיווח ביצוע: preset = {activityId, date, entry (לעריכה), area, crew} */
/* אפשרויות בחירת סעיף: לפי פרק (optgroup) בסדר ההופעה, עם קוד הסעיף לפני השם */
export function actOptions(A,selId){
  const groups=new Map(); A.forEach(a=>{ const g=a.group||""; if(!groups.has(g)) groups.set(g,[]); groups.get(g).push(a); });
  const opt=a=>'<option value="'+esc(a.id)+'"'+(a.id===selId?' selected':'')+'>'+esc((a.code?a.code+' · ':'')+a.name)+(a.unit?' · '+esc(a.unit):'')+'</option>';
  return [...groups.entries()].map(([g,L])=>g?'<optgroup label="'+esc(g)+'">'+L.map(opt).join("")+'</optgroup>':L.map(opt).join("")).join("");
}
export function openWorkReport(preset){
  preset=preset||{}; const entry=preset.entry||null, edit=!!entry;
  const A=shared.STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0)), hol=statusHolidays();
  const actId=preset.activityId||(A.length===1?A[0].id:"");
  const date=entry?entry.date:(preset.date||shared.dayISO||isoOf(Date.now()));
  const dl=(id,a)=>'<datalist id="'+id+'">'+a.map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="דיווח ביצוע"><div class="grab"></div><h2>'+(edit?"עדכון דיווח ביצוע":"דיווח ביצוע")+'</h2>'
    +(A.length?'':'<div class="note-card">אין עדיין סעיפים. טוענים את תבנית סעיפי ההסכם (89 סעיפים לפי פרקים) ומתקנים כמויות ותאריכים לפרויקט.'+(ROLE==="owner"?' <button class="linkbtn" type="button" id="prTpl" style="min-height:0;padding:0 4px">טען תבנית ›</button>':'')+'</div>')
    +'<div class="f"><label for="prAct">סעיף / פעילות</label><select id="prAct"'+(edit?' disabled':'')+'><option value="">בחר סעיף</option>'+actOptions(A,actId)+'</select><div class="hint" id="prHint"></div><button class="linkbtn" type="button" id="prDescBtn" hidden style="min-height:0;padding:0 2px;margin-top:4px">מה כולל הסעיף ›</button><div class="hint" id="prDesc" hidden style="white-space:pre-line"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="prQty">כמות שבוצעה</label><input type="text" id="prQty" inputmode="decimal" placeholder="כמות" value="'+(entry&&Number(entry.actual)?esc(entry.actual):"")+'"></div><div class="f"><label for="prDate">תאריך</label><input type="date" id="prDate" value="'+esc(date)+'"></div></div>'
    +'<div class="f"><label for="prArea">אזור / שדה / סטרינג</label><input type="text" id="prArea" list="prAreas" autocomplete="off" placeholder="למשל: שדה 2 · סטרינגים 14–20" value="'+esc(entry?entry.area||"":preset.area||"")+'">'+dl("prAreas",workAreas())+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="prCrew">צוות / קבלן משנה</label><input type="text" id="prCrew" list="prCrews" autocomplete="off" placeholder="צוות 1, קבלן משנה א" value="'+esc(entry?entry.crew||"":preset.crew||"")+'">'+dl("prCrews",workCrews())+'</div><div class="f"><label for="prWorkers">עובדים בסעיף</label><input type="text" id="prWorkers" inputmode="numeric" placeholder="כמה עבדו" value="'+(entry&&Number(entry.workers)?esc(entry.workers):"")+'"></div></div>'
    +'<div class="f"><label for="prNote">הערה (לא חובה)</label><input type="text" id="prNote" placeholder="למשל: הופסק בצהריים בגלל רוח" value="'+esc(entry?entry.note||"":"")+'"></div>'
    +'<div class="acts"><button class="save" id="prSave" type="button">'+(edit?"שמור עדכון":"שמור דיווח")+'</button>'+(edit&&ROLE==="owner"?'<button class="cancel danger" id="prDel" type="button">מחק</button>':'')+'<button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel:not(.danger)").onclick=close;
  const tpl=q("#prTpl"); if(tpl) tpl.onclick=()=>{ close(); openActivityTemplate(); };
  const hint=()=>{ const a=A.find(x=>x.id===q("#prAct").value), dsc=q("#prDesc"), db=q("#prDescBtn"); if(!a){ q("#prHint").textContent=""; dsc.hidden=true; db.hidden=true; return; } const c=statusCalc(a,hol);
    q("#prHint").innerHTML='בוצע <b>'+fmtN(c.done)+'</b> מתוך '+fmtN(a.total)+(a.unit?' '+esc(a.unit):'')+' · '+Math.round(c.pct*100)+'%'+(c.remaining?(!c.planned?'':c.reqNow===null?' · <b style="color:var(--clay)">נגמרו ימי העבודה</b>':' · נדרש <b>'+fmtN(c.reqNow)+'</b> ליום'):' · הושלם')+(c.manPlan||c.manDone?' · ימי עובד <b>'+fmtN(c.manDone)+'</b> / '+(c.manPlan?fmtN(c.manPlan):'—'):'');
    dsc.textContent=a.desc||""; dsc.hidden=true; db.hidden=!a.desc; db.textContent="מה כולל הסעיף ›"; };   // התיאור המלא מההסכם, בלחיצה
  q("#prDescBtn").onclick=()=>{ const d=q("#prDesc"); d.hidden=!d.hidden; q("#prDescBtn").textContent=d.hidden?"מה כולל הסעיף ›":"סגור ‹"; };
  q("#prAct").onchange=hint; hint();
  q("#prSave").onclick=async()=>{
    const a=A.find(x=>x.id===q("#prAct").value); if(!a){ toast("איזו פעילות?"); return; }
    const d=q("#prDate").value, qty=Number(String(q("#prQty").value).replace(",","."))||0, note=q("#prNote").value.trim();
    if(!d){ toast("תאריך?"); return; } if(!qty&&!note){ toast("כמה בוצע?"); return; }
    const cur=shared.STATUS.find(x=>x.id===a.id)||a;
    const rec={id:entry?entry.id:"wr"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date:d,actual:qty,area:q("#prArea").value.trim(),crew:q("#prCrew").value.trim(),note,by:actorName(),ts:Date.now()};
    const workers=Math.round(Number(String(q("#prWorkers").value).replace(",","."))||0); if(workers>0) rec.workers=workers;   // ימי עובד בפועל לסעיף
    const daily=(cur.daily||[]).filter(x=>x.id!==rec.id).concat(rec).sort((x,y)=>x.date<y.date?-1:1);
    const b=q("#prSave"); b.disabled=true;
    if(!(await saveStatus({...cur,daily,updated:Date.now()}))){ b.disabled=false; return; }
    logAct("progress",edit?"edit":"add","דיווח ביצוע: "+(cur.code?cur.code+" ":"")+cur.name+" "+fmtN(qty)+(cur.unit?" "+cur.unit:"")+" ב-"+isoText(d)+(rec.area?" · "+rec.area:"")+(rec.crew?" · "+rec.crew:"")+(rec.workers?" · "+rec.workers+" עובדים":""),cur.id);
    close(); renderWorkDay(); const c=statusCalc({...cur,daily},hol);
    toast(cur.name+": "+fmtN(c.done)+" מתוך "+fmtN(cur.total)+(c.remaining&&c.reqNow!==null?" · נדרש "+fmtN(c.reqNow)+" ליום":""));
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
    b.innerHTML='<b>'+(r.activity.code?'<span class="code">'+esc(r.activity.code)+'</span>':'')+esc(r.activity.name)+'</b><span class="qn">'+(Number(r.actual)?fmtN(r.actual)+(r.activity.unit?' <small>'+esc(r.activity.unit)+'</small>':''):'—')+'</span><span>'+esc([r.area,r.crew,r.workers?r.workers+" עובדים":"",r.note].filter(Boolean).join(" · ")||(r.by?"רשם "+r.by:"רישום מהיר"))+'</span>';
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
  let kind=b.kind||"other", status=b.status||"open";
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="חריג"><div class="grab"></div><h2>'+(existing?"חריג":"חריג חדש")+'</h2>'
    +'<div class="f"><label>סוג</label><div class="opts" id="bkKind">'+Object.entries(BLK_KINDS).map(([k,v])=>'<button class="opt" type="button" data-k="'+k+'" aria-pressed="'+(k===kind)+'">'+v+'</button>').join("")+'</div></div>'
    +'<div class="f"><label for="bkText">מה תוקע</label><textarea id="bkText" placeholder="למשל: חסר כבל 6 שחור לשדה 2, נגמר אתמול. הוזמן? מתי מגיע?">'+esc(b.text)+'</textarea></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="bkArea">אזור</label><input type="text" id="bkArea" list="bkAreas" autocomplete="off" value="'+esc(b.area||"")+'"><datalist id="bkAreas">'+workAreas().map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist></div><div class="f"><label for="bkDate">מתאריך</label><input type="date" id="bkDate" value="'+esc(b.date||"")+'"></div></div>'
    +(existing?'<div class="f"><label>מצב</label><div class="opts" id="bkSt"><button class="opt" type="button" data-v="open" aria-pressed="'+(status!=="closed")+'">פתוח</button><button class="opt" type="button" data-v="closed" aria-pressed="'+(status==="closed")+'">נסגר</button></div><input type="text" id="bkClose" placeholder="איך נסגר (למשל: הכבל הגיע 3.11)" style="margin-top:8px" value="'+esc(b.closeNote||"")+'"'+(status==="closed"?'':' hidden')+'></div>':'')
    +'<div class="acts"><button class="save" id="bkSave" type="button">שמור</button>'+(existing&&ROLE==="owner"?'<button class="cancel danger" id="bkDel" type="button">מחק</button>':'')+'<button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel:not(.danger)").onclick=close;
  q("#bkKind").onclick=e=>{ const x=e.target.closest("[data-k]"); if(!x) return; kind=x.dataset.k; q("#bkKind").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===x))); };
  const st=q("#bkSt"); if(st) st.onclick=e=>{ const x=e.target.closest("[data-v]"); if(!x) return; status=x.dataset.v; st.querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===x))); q("#bkClose").hidden=status!=="closed"; };
  q("#bkSave").onclick=async()=>{
    const text=q("#bkText").value.trim(); if(!text){ toast("מה תוקע? כמה מילים."); return; }
    const doc={...b,text,kind,area:q("#bkArea").value.trim(),date:q("#bkDate").value||b.date,status,updated:Date.now()};
    if(status==="closed"){ doc.closedAt=b.closedAt||Date.now(); doc.closeNote=(q("#bkClose")||{}).value||""; doc.closedBy=b.closedBy||actorName(); } else { delete doc.closedAt; delete doc.closeNote; delete doc.closedBy; }
    const sb=q("#bkSave"); sb.disabled=true;
    if(!(await saveBlocker(doc))){ sb.disabled=false; return; }
    logAct("blocker",existing?(status==="closed"&&b.status!=="closed"?"edit":"edit"):"add",(status==="closed"?"נסגר חריג: ":existing?"עודכן חריג: ":"חריג חדש: ")+text.slice(0,80)+(doc.area?" · "+doc.area:""),doc.id);
    close(); toast(status==="closed"?"החריג נסגר.":"החריג נרשם. יופיע בסיכום היומי עד שייסגר.");
  };
  const del=q("#bkDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את החריג?","מחק","var(--clay)"))) return;
    try{ if(shared.DB) await shared.DB.doc("blockers/"+b.id).delete(); else { shared.blockers=(shared.blockers||[]).filter(x=>x.id!==b.id); ls.set("blockers",JSON.stringify(shared.blockers)); } }catch(e){ toast("המחיקה נכשלה."); return; }
    logAct("blocker","delete","נמחק חריג: "+b.text.slice(0,80),b.id,null,b); close(); renderBlockers(); };
  if(!existing) setTimeout(()=>{ if(!scrim.contains(document.activeElement)) q("#bkText").focus(); },60);
}
export function blockerAge(b,iso){ return Math.max(0,Math.round((new Date((iso||isoOf(Date.now()))+"T12:00:00").getTime()-new Date((b.date||isoOf(b.ts))+"T12:00:00").getTime())/864e5)); }
export function renderBlockers(){
  const el=$("#blkList"); if(!el) return; const B=shared.blockers||[];
  const open=B.filter(b=>b.status!=="closed").sort((a,b)=>(a.date||"")<(b.date||"")?-1:1), closed=B.filter(b=>b.status==="closed").sort((a,b)=>(b.closedAt||0)-(a.closedAt||0)).slice(0,5);
  foldSum("blk",open.length?open.length+" פתוחים"+(open.some(b=>blockerAge(b)>3)?" · "+open.filter(b=>blockerAge(b)>3).length+" מעל 3 ימים":""):"");
  el.innerHTML="";
  if(!open.length) el.innerHTML='<div class="empty" style="padding:14px">'+(B.length?'אין חריגים פתוחים.':'אין חריגים פתוחים. כשמשהו תוקע את העבודה (חסר חומר, תקלה, החלטה שמחכה) רושמים אותו כאן, והוא נכנס לסיכום היומי ולדוח השבועי עד שנסגר.')+'</div>';
  open.forEach(b=>{ const d=blockerAge(b); const x=document.createElement("button"); x.type="button"; x.className="slip blk"+(d>3?" late":"");
    x.innerHTML='<b>'+esc(b.text)+'</b><span class="qn" style="color:'+(d>3?'var(--clay)':'var(--ink2)')+'">'+(d?d+' <small>ימים</small>':'היום')+'</span><span>'+esc([BLK_KINDS[b.kind]||"",b.area,b.by?"רשם "+b.by:""].filter(Boolean).join(" · "))+'</span>';
    x.onclick=()=>{ if(ROLE!=="viewer") openBlocker(b); }; el.appendChild(x); });
  if(closed.length){ const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--sage-fill)"></i>נסגרו לאחרונה<span>'+closed.length+'</span>'; el.appendChild(h);
    closed.forEach(b=>{ const x=document.createElement("button"); x.type="button"; x.className="slip blk done";
      x.innerHTML='<b>'+esc(b.text)+'</b><span class="qn" style="color:var(--sage)">נסגר</span><span>'+esc([b.closedAt?isoText(isoOf(b.closedAt)):"",b.closeNote].filter(Boolean).join(" · "))+'</span>';
      x.onclick=()=>{ if(ROLE!=="viewer") openBlocker(b); }; el.appendChild(x); }); }
  renderAlerts();
}
/* ---- סיכום יומי (docs/templates/daily-summary.md): מספרים מהאפליקציה בלבד, בלי שמות עובדים, בלי מחירים ---- */
export function dailySummaryText(iso){
  iso=iso||shared.dayISO||isoOf(Date.now()); const t0=new Date(iso+"T00:00:00").getTime(), t1=t0+864e5; const inD=t=>t>=t0&&t<t1;
  const dayName=new Date(iso+"T12:00:00").toLocaleDateString("he-IL",{weekday:"long"});
  const L=["יומן חשמל · "+siteLabel()+" · "+dayName+" "+isoText(iso),""];
  const W=dayRows(iso), sub=W.filter(w=>w.contractor), hrs=W.reduce((s,w)=>s+(Number(w.hours)||0),0);
  L.push("עובדים: "+W.length+(W.length?" ("+(W.length-sub.length)+" שלנו, "+sub.length+" קבלן משנה)":"")+(hrs?" · שעות: "+fmtN(hrs):""));
  const notes=realNotes().filter(n=>inD(n.ts)); const top=notes.flatMap(n=>n.lines||[]).filter(l=>Number(l.qty)>0).sort((a,b)=>b.qty-a.qty).slice(0,3);
  L.push("הגיע: "+(notes.length?notes.length+" תעודות"+(top.length?" · "+top.map(l=>l.name+" "+fmtN(l.qty)+(l.unit?" "+l.unit:"")).join(", "):""):"אין תעודות"));
  const pulls=(shared.pulls||[]).filter(p=>p.date===iso); const byT=new Map(); pulls.forEach(p=>byT.set(p.cableType,(byT.get(p.cableType)||0)+(Number(p.meters)||0)));
  const closed=(shared.drums||[]).filter(d=>d.closedAt&&inD(d.closedAt)), rem=closed.reduce((s,d)=>s+(Number(d.remainderAtClose)||0),0);
  L.push("כבלים: "+(pulls.length?"נמשכו "+fmtN([...byT.values()].reduce((a,b)=>a+b,0))+" מ׳ ("+[...byT.entries()].map(([k,v])=>cableTypeLabel(k)+": "+fmtN(v)).join(", ")+")":"לא נרשמו משיכות")+(closed.length?" · תופים שנסגרו: "+closed.length+" (שארית "+fmtN(rem)+" מ׳)":""));
  const iss=shared.issues.filter(s=>inD(s.ts)), tools=holders().filter(h=>h.cat==="tools");
  L.push("ניפוקים: "+iss.length+(iss.length?" ("+iss.filter(s=>s.sigAsset||s.sigUrl||s.sigData).length+" חתומים)":"")+" · כלים אצל אנשים: "+tools.length);
  const work=workRows(iso).filter(r=>Number(r.actual)); const byA=new Map(); work.forEach(r=>{ const e=byA.get(r.activity.id)||{a:r.activity,q:0}; e.q+=Number(r.actual); byA.set(r.activity.id,e); });
  const aLab=a=>(a.code?a.code+" ":"")+a.name, men=work.reduce((s,r)=>s+(Number(r.workers)||0),0);
  L.push("בוצע היום: "+(byA.size?[...byA.values()].map(e=>aLab(e.a)+": "+fmtN(e.q)+(e.a.unit?" "+e.a.unit:"")).join(" · ")+(men?" · עובדים בסעיפים: "+men:""):"לא דווח"));
  const hol=statusHolidays(); const plan=[...byA.values()].map(e=>{ const c=statusCalc(e.a,hol);
    return aLab(e.a)+" "+Math.round(c.pct*100)+"%"+(c.remaining?(c.planned?" (קצב נדרש "+(c.reqNow===null?"—":fmtN(c.reqNow))+" ליום, בפועל "+fmtN(e.q)+")":"")+(c.manPlan?" · ימי עובד "+fmtN(c.manDone)+"/"+fmtN(c.manPlan):""):" (הושלם)"); });
  if(plan.length) L.push("מול ההסכם: "+plan.join(" · "));
  const open=(shared.blockers||[]).filter(b=>b.status!=="closed"&&(b.date||isoOf(b.ts))<=iso);
  L.push("חריגים: "+(open.length?open.slice(0,6).map(b=>b.text+(b.area?" ("+b.area+")":"")).join(" · "):"אין"));
  return L.join("\n");
}
export function __init(){
BLK_KINDS = {material:"חוסר חומר",fault:"תקלה / ציוד",decision:"החלטה נדרשת",safety:"בטיחות",other:"אחר"};
try{ shared.blockers=JSON.parse(ls.get("blockers")||"[]"); if(!Array.isArray(shared.blockers)) shared.blockers=[]; }catch(e){ shared.blockers=[]; }
const w=$("#btnWork"); if(w) w.onclick=()=>openWorkReport();
const dw=$("#btnDayWork"); if(dw) dw.onclick=()=>openWorkReport({date:shared.dayISO});
const bb=$("#btnBlocker"); if(bb) bb.onclick=()=>openBlocker();
renderBlockers(); renderWorkDay();
}
