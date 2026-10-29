import { $, actorName, ask, esc, fmtD, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { csvOf, saveFile } from "./08-settings.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";
import { renderWorkDay, workOutput } from "./21-work.js";
import { renderDayReport } from "./23-daily-report.js";
export let dayCon, csCon, csPeriod, isoOf, isoText, dayRows, LATE, EARLY, ROLES;
export function renderDay(){
  if(!$("#viewDay")) return;
  if(!shared.dayISO) shared.dayISO=isoOf(Date.now());
  $("#dyDate").value=shared.dayISO;
  const allRows=dayRows(shared.dayISO); const consToday=[...new Set(allRows.map(w=>w.contractor||"ללא קבלן"))];
  const cc=$("#dyCons"); cc.hidden=consToday.length<2; if(!consToday.includes(dayCon)) dayCon="";
  cc.innerHTML=consToday.length<2?"":'<button type="button" class="chip2" data-c="" aria-pressed="'+(dayCon==="")+'">הכל</button>'+consToday.map(c=>'<button type="button" class="chip2" data-c="'+esc(c)+'" aria-pressed="'+(dayCon===c)+'">'+esc(c)+' <small>'+allRows.filter(w=>(w.contractor||"ללא קבלן")===c).length+'</small></button>').join("");
  cc.onclick=e=>{ const b=e.target.closest("[data-c]"); if(!b) return; dayCon=b.dataset.c; renderDay(); };
  const rows=dayCon?allRows.filter(w=>(w.contractor||"ללא קבלן")===dayCon):allRows;
  const ops=rows.filter(w=>w.machine);
  $("#dyBig").textContent=fmtN(rows.length);
  $("#dyCap").textContent=rows.length===1?"עובד באתר":"עובדים באתר";
  const late=rows.filter(LATE), early=rows.filter(EARLY);
  $("#dySub").innerHTML=rows.length?('ב-'+isoText(shared.dayISO)+': <b>'+fmtN(rows.length-ops.length)+'</b> עובדים, <b>'+fmtN(ops.length)+'</b> מפעילי צמ״ה'+(late.length?' · <b style="color:var(--clay)">'+late.length+' איחרו</b>':'')+(early.length?' · <b style="color:var(--clay)">'+early.length+' יצאו מוקדם</b>':'')):'אין עדיין רישום ליום '+isoText(shared.dayISO)+'. «העתק צוות מיום קודם» חוסך את רוב ההקלדה.';
  $("#dyStats").innerHTML='<div class="stat"><div class="v num">'+fmtN(ops.length)+'</div><div class="k">כלי צמ״ה עבדו</div></div>'
    +'<div class="stat"><div class="v num" style="color:'+(late.length?"var(--clay)":"var(--ink)")+'">'+fmtN(late.length)+'</div><div class="k">איחרו</div></div>'
    +'<div class="stat"><div class="v num" style="color:'+(early.length?"var(--clay)":"var(--ink)")+'">'+fmtN(early.length)+'</div><div class="k">יצאו מוקדם</div></div>';
  const mc=$("#dyMach"); mc.innerHTML=""; $("#dyMachCard").hidden=!ops.length;
  ops.forEach(w=>{ const d=document.createElement("div"); d.className="holder"; d.innerHTML='<div class="who"></div><div class="q"></div>'; d.querySelector(".who").textContent=w.machine; d.querySelector(".q").textContent=w.name; d.querySelector(".q").style.fontSize=".9rem"; mc.appendChild(d); });
  $("#dyCount").textContent=rows.length?rows.length+" רשומות":"";
  const L=$("#dyList"); L.innerHTML="";
  if(!rows.length) L.innerHTML='<div class="empty">אין רשומות ליום הזה.</div>';
  rows.forEach(w=>{ const b=document.createElement("button"); b.type="button"; b.className="wk";
    const tags=(w.machine?'<span class="tg mach"></span>':'')+(w.hours?'<span class="tg ok">'+fmtN(w.hours)+' ש׳</span>':'')+(w.tin||w.tout?'<span class="tg ok num">'+esc((w.tin||"—")+"–"+(w.tout||"—"))+'</span>':'')
      +'<span class="tg '+(LATE(w)?'bad':'ok')+'">'+(LATE(w)?'איחר'+(w.lateMin?' '+w.lateMin+' דק׳':''):'הגיע בזמן')+'</span>'
      +'<span class="tg '+(EARLY(w)?'bad':'ok')+'">'+(EARLY(w)?'יצא מוקדם'+(w.earlyMin?' '+w.earlyMin+' דק׳':''):'יצא בזמן')+'</span>';
    b.innerHTML='<div class="n"></div><div class="tags">'+tags+'</div><div class="m"></div>'+(w.tasks?'<div class="t tk"></div>':'')+(w.note?'<div class="t"><span class="nt-tg" role="button" tabindex="0" aria-expanded="false">הערות ›</span><span class="nt" hidden></span></div>':'');
    b.querySelector(".n").textContent=w.name; b.querySelector(".m").textContent=[w.machine?"מפעיל צמ״ה":"עובד",w.job,w.contractor,w.area].filter(Boolean).join(" · ");
    const tm=b.querySelector(".tg.mach"); if(tm) tm.textContent=w.machine;
    const tk=b.querySelector(".tk"); if(tk) tk.textContent="משימות: "+w.tasks;
    const nt=b.querySelector(".nt"); if(nt){ nt.textContent=w.note; const tg=b.querySelector(".nt-tg");
      const flip=e=>{ e.stopPropagation(); e.preventDefault(); nt.hidden=!nt.hidden; tg.textContent=nt.hidden?"הערות ›":"הסתר הערות"; tg.setAttribute("aria-expanded",String(!nt.hidden)); };
      tg.onclick=flip; tg.onkeydown=e=>{ if(e.key==="Enter"||e.key===" ") flip(e); }; }
    b.onclick=()=>{ if(ROLE!=="viewer") openWorker(w); }; L.appendChild(b); });
  renderCrew(); renderConSummary(); renderWorkDay(); renderDayReport();
  // אנשים: 30 יום
  const from=isoOf(Date.now()-30*86400000); const per=new Map();
  shared.daylog.filter(w=>w.date>=from).forEach(w=>{ const e=per.get(w.name)||{name:w.name,days:0,late:0,early:0}; e.days++; if(LATE(w)) e.late++; if(EARLY(w)) e.early++; per.set(w.name,e); });
  const P=[...per.values()].filter(e=>e.late||e.early).sort((a,b)=>(b.late+b.early)-(a.late+a.early));
  const pp=$("#dyPeople"); pp.innerHTML=P.length?"":'<div class="empty" style="padding:16px">אין איחורים או יציאות מוקדמות ב-30 הימים האחרונים.</div>';
  P.forEach(e=>{ const d=document.createElement("div"); d.className="holder"; d.innerHTML='<div class="who"><span></span><div class="what"></div></div><div class="q num"></div>';
    d.querySelector(".who span").textContent=e.name; d.querySelector(".what").textContent=e.days+" ימי עבודה"; d.querySelector(".q").textContent=(e.late?e.late+" איחורים":"")+(e.late&&e.early?" · ":"")+(e.early?e.early+" מוקדם":""); d.querySelector(".q").style.fontSize=".85rem"; pp.appendChild(d); });
}
export function openWorker(w){
  const edit=!!w; w=w||{date:shared.dayISO,name:"",machine:"",tasks:"",note:"",arrive:"ontime",leave:"ontime",lateMin:"",earlyMin:"",contractor:"",job:"",tin:"",tout:""};
  const names=[...new Set([...shared.CREW.filter(c=>c.active!==false).map(c=>c.name),...shared.daylog.map(x=>x.name)].filter(Boolean))], machs=[...new Set([...shared.CREW.map(c=>c.machine),...shared.daylog.map(x=>x.machine)].filter(Boolean))], cons=[...new Set([...shared.CREW.map(c=>c.contractor),...shared.daylog.map(x=>x.contractor)].filter(Boolean))], jobs=[...new Set([...shared.CREW.map(c=>c.job),...shared.daylog.map(x=>x.job)].filter(Boolean))];
  const dl=(id,a)=>'<datalist id="'+id+'">'+a.map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist>';
  let arrive=w.arrive||"ontime", leave=w.leave||"ontime", isOp=!!w.machine;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="עובד יומי"><div class="grab"></div><h2>'+(edit?"עדכון":"עובד / מפעיל")+' · '+isoText(w.date)+'</h2>'
    +'<div class="f"><label>סוג</label><div class="opts" id="wkKind"><button class="opt" type="button" data-k="w" aria-pressed="'+!isOp+'">עובד</button><button class="opt" type="button" data-k="o" aria-pressed="'+isOp+'">מפעיל צמ״ה</button></div></div>'
    +'<div class="f"><label for="wkName">שם</label><input type="text" id="wkName" list="wkNames" autocomplete="off" placeholder="שם מלא">'+dl("wkNames",names)+'</div>'
    +'<div class="f" id="wkMachF"'+(isOp?'':' hidden')+'><label for="wkMach">כלי צמ״ה</label><input type="text" id="wkMach" list="wkMachs" autocomplete="off" placeholder="למשל: בובקט, מלגזה טלסקופית, מחפרון">'+dl("wkMachs",machs)+'</div>'
    +'<div class="f"><label for="wkJob">תפקיד</label><input type="text" id="wkJob" list="wkJobs" autocomplete="off" placeholder="חשמלאי מוסמך · עוזר חשמלאי · מנהל צוות · מפעיל">'+dl("wkJobs",[...new Set([...jobs,...ROLES])])+'</div>'
    +'<div class="f"><label for="wkCon">קבלן / חברה</label><input type="text" id="wkCon" list="wkCons" autocomplete="off" placeholder="למשל: עאטף">'+dl("wkCons",cons)+'</div>'
    +'<div class="f"><label>הגעה</label><div class="opts" id="wkArr"><button class="opt" type="button" data-v="ontime">הגיע בזמן</button><button class="opt" type="button" data-v="late">איחר</button></div><input type="text" id="wkLate" inputmode="numeric" placeholder="כמה דקות" style="margin-top:8px"></div>'
    +'<div class="f"><label>יציאה</label><div class="opts" id="wkLv"><button class="opt" type="button" data-v="ontime">יצא בזמן</button><button class="opt" type="button" data-v="early">יצא מוקדם</button></div><input type="text" id="wkEarly" inputmode="numeric" placeholder="כמה דקות" style="margin-top:8px"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="wkIn">שעת כניסה</label><input type="time" id="wkIn"></div><div class="f"><label for="wkOut">שעת יציאה</label><input type="time" id="wkOut"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1.4fr;gap:8px"><div class="f"><label for="wkHours">שעות בפועל</label><input type="text" id="wkHours" inputmode="decimal" placeholder="ריק = יום מלא"></div><div class="f"><label for="wkArea">עבודה / אזור</label><input type="text" id="wkArea" list="wkAreas" autocomplete="off" placeholder="משיכת כבלים · הארקה · שדה 3">'+dl("wkAreas",[...new Set([...shared.daylog.map(x=>x.area),...shared.STATUS.map(a=>a.name),"שדה 1","שדה 2","חדר חשמל"].filter(Boolean))])+'</div></div>'
    +'<div class="f"><label for="wkTasks">משימות שבוצעו</label><textarea id="wkTasks" placeholder="למשל: הרכבת פאנלים שדה 2 שורות 15–16"></textarea></div>'
    +'<div class="f"><label for="wkNote">הערות על העובד</label><textarea id="wkNote" placeholder="תפקוד, בטיחות, ציוד"></textarea></div>'
    +'<div class="acts"><button class="save" id="wkSave" type="button">שמור</button>'+(edit&&ROLE==="owner"?'<button class="cancel danger" id="wkDel" type="button">מחק</button>':'')+'<button class="cancel" id="wkCancel" type="button">ביטול</button></div></div>');
  const q=x=>scrim.querySelector(x);
  q("#wkName").value=w.name||""; q("#wkMach").value=w.machine||""; q("#wkCon").value=w.contractor||""; q("#wkJob").value=w.job||""; q("#wkHours").value=w.hours||""; q("#wkArea").value=w.area||""; q("#wkTasks").value=w.tasks||""; q("#wkNote").value=w.note||""; q("#wkLate").value=w.lateMin||""; q("#wkEarly").value=w.earlyMin||""; q("#wkIn").value=w.tin||""; q("#wkOut").value=w.tout||"";
  q("#wkIn").onchange=q("#wkOut").onchange=()=>{ const h=timeDiff(q("#wkIn").value,q("#wkOut").value); if(h) q("#wkHours").value=h; };   // סה״כ מהשעות; אפשר לתקן ידנית
  q("#wkName").onchange=()=>{ const c=shared.CREW.find(x=>x.name===q("#wkName").value.trim()); if(!c) return;   // מילוי אוטומטי מהצוות
    if(c.job&&!q("#wkJob").value) q("#wkJob").value=c.job; if(c.contractor&&!q("#wkCon").value) q("#wkCon").value=c.contractor;
    if(c.machine){ isOp=true; q("#wkKind").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o.dataset.k==="o"))); q("#wkMachF").hidden=false; if(!q("#wkMach").value) q("#wkMach").value=c.machine; } };
  const seg=(sel,val,inp,bad)=>{ q(sel).querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o.dataset.v===val))); q(inp).hidden=val!==bad; };
  seg("#wkArr",arrive,"#wkLate","late"); seg("#wkLv",leave,"#wkEarly","early");
  q("#wkArr").onclick=e=>{ const b=e.target.closest("[data-v]"); if(!b) return; arrive=b.dataset.v; seg("#wkArr",arrive,"#wkLate","late"); };
  q("#wkLv").onclick=e=>{ const b=e.target.closest("[data-v]"); if(!b) return; leave=b.dataset.v; seg("#wkLv",leave,"#wkEarly","early"); };
  q("#wkKind").onclick=e=>{ const b=e.target.closest("[data-k]"); if(!b) return; isOp=b.dataset.k==="o"; q("#wkKind").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===b))); q("#wkMachF").hidden=!isOp; };
  const close=()=>scrim.remove(); q("#wkCancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  q("#wkSave").onclick=async()=>{
    const name=q("#wkName").value.trim(); if(!name){ toast("צריך שם."); return; }
    const machine=isOp?q("#wkMach").value.trim():""; if(isOp&&!machine){ toast("איזה כלי צמ״ה?"); return; }
    const doc={id:w.id||("dy"+Date.now()+Math.random().toString(36).slice(2,5)),date:w.date,ts:new Date(w.date+"T12:00:00").getTime(),name,machine,contractor:q("#wkCon").value.trim(),job:q("#wkJob").value.trim(),hours:Number(String(q("#wkHours").value).replace(",","."))||0,area:q("#wkArea").value.trim(),
      tasks:q("#wkTasks").value.trim(),note:q("#wkNote").value.trim(),arrive,leave,lateMin:arrive==="late"?Number(q("#wkLate").value)||0:0,earlyMin:leave==="early"?Number(q("#wkEarly").value)||0:0,tin:q("#wkIn").value||"",tout:q("#wkOut").value||"",by:actorName()};
    try{ if(shared.DB) await shared.DB.doc("daylog/"+doc.id).set(doc); else { shared.daylog=shared.daylog.filter(x=>x.id!==doc.id); shared.daylog.push(doc); ls.set("daylog",JSON.stringify(shared.daylog)); } }
    catch(e){ toast("השמירה נכשלה."); return; }
    logAct("daylog",edit?"edit":"add",(edit?"עודכן":"נרשם")+" ליום "+isoText(doc.date)+": "+name+(machine?" · "+machine:"")+(arrive==="late"?" · איחר":"")+(leave==="early"?" · יצא מוקדם":""),doc.id);
    close(); renderDay();
  };
  const del=q("#wkDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את "+w.name+" מיום "+isoText(w.date)+"?"))) return;
    try{ if(shared.DB) await shared.DB.doc("daylog/"+w.id).delete(); else { shared.daylog=shared.daylog.filter(x=>x.id!==w.id); ls.set("daylog",JSON.stringify(shared.daylog)); } }catch(e){ toast("המחיקה נכשלה."); return; }
    logAct("daylog","delete","נמחק מיום "+isoText(w.date)+": "+w.name,w.id,null,w); close(); renderDay(); };
  if(!edit) setTimeout(()=>{ if(!scrim.contains(document.activeElement)) q("#wkName").focus(); },60);
}
/* שעות בין כניסה ליציאה ("07:00"→"16:30" = 9.5), ברבעי שעה; אחרי חצות מוסיפים יממה */
export function timeDiff(a,b){ const m=t=>{ const x=String(t||"").match(/^(\d{1,2}):(\d{2})$/); return x?(+x[1])*60+(+x[2]):null; }; const s=m(a), e=m(b); if(s===null||e===null) return 0; let d=e-s; if(d<0) d+=1440; return Math.round(d/15)/4; }
export async function copyCrew(){
  const prev=[...new Set(shared.daylog.filter(w=>w.date<shared.dayISO).map(w=>w.date))].sort().pop();
  if(!prev){ toast("אין יום קודם להעתיק ממנו."); return; }
  const have=new Set(dayRows(shared.dayISO).map(w=>w.name));
  const src=dayRows(prev).filter(w=>!have.has(w.name));
  if(!src.length){ toast("כל הצוות של "+isoText(prev)+" כבר רשום."); return; }
  if(!(await ask("להעתיק "+src.length+" עובדים ומפעילים מ-"+isoText(prev)+"?","העתק","var(--pv)","נכנסים עם «הגיע בזמן / יצא בזמן» ובלי משימות והערות. מתקנים בלחיצה על השם."))) return;
  for(const w of src){ const doc={id:"dy"+Date.now()+Math.random().toString(36).slice(2,5),date:shared.dayISO,ts:new Date(shared.dayISO+"T12:00:00").getTime(),name:w.name,machine:w.machine||"",contractor:w.contractor||"",job:w.job||"",tasks:"",note:"",arrive:"ontime",leave:"ontime",lateMin:0,earlyMin:0,by:actorName()};
    try{ if(shared.DB) await shared.DB.doc("daylog/"+doc.id).set(doc); else shared.daylog.push(doc); }catch(e){} }
  if(!shared.DB) ls.set("daylog",JSON.stringify(shared.daylog));
  logAct("daylog","add","הועתק צוות מ-"+isoText(prev)+" ל-"+isoText(shared.dayISO)+": "+src.length+" אנשים","");
  renderDay();
}
/* ---- הצוות היומי: רשימת כל העובדים והמפעילים (שם, תפקיד, קבלן, כלי) ---- */
export function renderCrew(){
  const el=$("#dyCrew"); if(!el) return; el.innerHTML="";
  const act=shared.CREW.filter(c=>c.active!==false).sort((a,b)=>String(a.contractor||"").localeCompare(String(b.contractor||""),"he")||String(a.name).localeCompare(String(b.name),"he")), off=shared.CREW.filter(c=>c.active===false);
  foldSum("crew",act.length?act.length+" פעילים"+(off.length?" · "+off.length+" לא":""):"ריק");
  if(!shared.CREW.length){ el.innerHTML='<div class="empty" style="padding:16px">עוד אין צוות. הוסף את העובדים היומיים פעם אחת — שם, תפקיד, קבלן — ומאז כל יום נרשם בלחיצה.</div>'; return; }
  const today=dayRows(shared.dayISO).map(w=>w.name);
  const groups=new Map(); act.forEach(c=>{ const k=c.contractor||"ללא קבלן"; (groups.get(k)||groups.set(k,[]).get(k)).push(c); });
  groups.forEach((list,k)=>{ const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--pv)"></i>'+esc(k)+'<span>'+list.length+'</span>'; el.appendChild(h);
    list.forEach(c=>{ const b=document.createElement("button"); b.type="button"; b.className="slip";
      b.innerHTML='<b>'+esc(c.name)+(today.includes(c.name)?' <small style="color:var(--sage);font-weight:500">· רשום היום</small>':'')+'</b><span>'+esc([c.machine?"מפעיל "+c.machine:"עובד",c.job,c.phone].filter(Boolean).join(" · "))+(c.note?' · '+esc(c.note):'')+'</span>';
      b.onclick=()=>{ if(ROLE!=="viewer") openCrewForm(c); }; el.appendChild(b); }); });
  if(off.length){ const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--ink3)"></i>לא פעילים<span>'+off.length+'</span>'; el.appendChild(h);
    off.forEach(c=>{ const b=document.createElement("button"); b.type="button"; b.className="slip"; b.style.opacity=".6"; b.innerHTML='<b>'+esc(c.name)+'</b><span>'+esc([c.job,c.contractor].filter(Boolean).join(" · "))+'</span>'; b.onclick=()=>{ if(ROLE!=="viewer") openCrewForm(c); }; el.appendChild(b); }); }
}
export function openCrewForm(existing){
  const c=existing?{...existing}:{id:"cw"+Date.now().toString(36),name:"",kind:"w",job:"",machine:"",contractor:"",phone:"",note:"",active:true,since:isoOf(Date.now()),ts:Date.now()};
  let isOp=!!c.machine||c.kind==="o";
  const dl=(id,a)=>'<datalist id="'+id+'">'+[...new Set(a.filter(Boolean))].map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="עובד בצוות"><div class="grab"></div><h2>'+(existing?"עדכון עובד":"עובד חדש לצוות")+'</h2>'
    +'<div class="f"><label>סוג</label><div class="opts" id="cwKind"><button class="opt" type="button" data-k="w" aria-pressed="'+!isOp+'">עובד</button><button class="opt" type="button" data-k="o" aria-pressed="'+isOp+'">מפעיל צמ״ה</button></div></div>'
    +'<div class="f"><label for="cwName">שם מלא</label><input type="text" id="cwName" autocomplete="off" value="'+esc(c.name)+'"></div>'
    +'<div class="f"><label for="cwJob">תפקיד</label><input type="text" id="cwJob" list="cwJobs" autocomplete="off" placeholder="חשמלאי מוסמך · עוזר חשמלאי · מנהל צוות · מפעיל" value="'+esc(c.job||"")+'">'+dl("cwJobs",[...ROLES,...shared.CREW.map(x=>x.job),...shared.daylog.map(x=>x.job)])+'</div>'
    +'<div class="f" id="cwMachF"'+(isOp?'':' hidden')+'><label for="cwMach">כלי צמ״ה</label><input type="text" id="cwMach" list="cwMachs" autocomplete="off" placeholder="בובקט, מלגזה טלסקופית, מחפרון" value="'+esc(c.machine||"")+'">'+dl("cwMachs",[...shared.CREW.map(x=>x.machine),...shared.daylog.map(x=>x.machine)])+'</div>'
    +'<div class="f"><label for="cwCon">קבלן / חברה</label><input type="text" id="cwCon" list="cwCons" autocomplete="off" value="'+esc(c.contractor||"")+'">'+dl("cwCons",[...shared.CREW.map(x=>x.contractor),...shared.daylog.map(x=>x.contractor)])+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="cwPhone">טלפון (לא חובה)</label><input type="tel" id="cwPhone" value="'+esc(c.phone||"")+'"></div><div class="f"><label for="cwSince">באתר מאז</label><input type="date" id="cwSince" value="'+esc(c.since||"")+'"></div></div>'
    +'<div class="f"><label for="cwNote">הערה (עובדות בלבד: הסמכות, ציוד, שפה)</label><input type="text" id="cwNote" value="'+esc(c.note||"")+'"></div>'
    +(existing?'<div class="f"><label>סטטוס</label><div class="opts" id="cwAct"><button class="opt" type="button" data-v="1" aria-pressed="'+(c.active!==false)+'">פעיל</button><button class="opt" type="button" data-v="0" aria-pressed="'+(c.active===false)+'">לא פעיל (עזב)</button></div></div>':'')
    +'<div class="acts"><button class="save" id="cwSave" type="button">שמור</button>'+(existing&&ROLE==="owner"?'<button class="cancel danger" id="cwDel" type="button">מחק</button>':'')+'<button class="cancel" id="cwCancel" type="button">ביטול</button></div></div>'); const q=x=>scrim.querySelector(x); const close=()=>scrim.remove();
  q("#cwCancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  q("#cwKind").onclick=e=>{ const b=e.target.closest("[data-k]"); if(!b) return; isOp=b.dataset.k==="o"; q("#cwKind").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===b))); q("#cwMachF").hidden=!isOp; };
  let active=c.active!==false; const ac=q("#cwAct"); if(ac) ac.onclick=e=>{ const b=e.target.closest("[data-v]"); if(!b) return; active=b.dataset.v==="1"; ac.querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===b))); };
  q("#cwSave").onclick=async()=>{ const name=q("#cwName").value.trim(); if(!name){ toast("צריך שם."); return; }
    if(!existing&&shared.CREW.some(x=>x.name===name)){ toast(name+" כבר בצוות."); return; }
    const doc={...c,name,kind:isOp?"o":"w",job:q("#cwJob").value.trim(),machine:isOp?q("#cwMach").value.trim():"",contractor:q("#cwCon").value.trim(),phone:q("#cwPhone").value.trim(),since:q("#cwSince").value||"",note:q("#cwNote").value.trim(),active,updated:Date.now(),by:c.by||actorName()};
    try{ if(shared.DB) await shared.DB.doc("crew/"+doc.id).set(doc); else { shared.CREW=shared.CREW.filter(x=>x.id!==doc.id).concat(doc); ls.set("crew",JSON.stringify(shared.CREW)); } }catch(e){ toast("השמירה נכשלה."); return; }
    logAct("daylog",existing?"edit":"add",(existing?"עודכן בצוות: ":"נוסף לצוות: ")+name+(doc.job?" · "+doc.job:"")+(doc.contractor?" · "+doc.contractor:"")+(active?"":" · לא פעיל"),doc.id);
    close(); renderDay(); };
  const del=q("#cwDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את "+c.name+" מהצוות? (הרישומים היומיים נשארים)","מחק","var(--clay)"))) return;
    try{ if(shared.DB) await shared.DB.doc("crew/"+c.id).delete(); else { shared.CREW=shared.CREW.filter(x=>x.id!==c.id); ls.set("crew",JSON.stringify(shared.CREW)); } }catch(e){ toast("המחיקה נכשלה."); return; }
    logAct("daylog","delete","נמחק מהצוות: "+c.name,c.id); close(); renderDay(); };
  if(!existing) setTimeout(()=>{ if(!scrim.contains(document.activeElement)) q("#cwName").focus(); },60);
}
/* ---- סיכום לקבלן: ימים לעובד, ימי עבודה ושעות לכלי, לפי קבלן ותקופה ---- */
export function csRangeIso(){
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
  if(csPeriod==="month") return [isoOf(new Date(y,m,1).getTime()),isoOf(now.getTime())];
  if(csPeriod==="prev") return [isoOf(new Date(y,m-1,1).getTime()),isoOf(new Date(y,m,0).getTime())];
  if(csPeriod==="30") return [isoOf(now.getTime()-30*86400000),isoOf(now.getTime())];
  const f=$("#csFrom").value||isoOf(new Date(y,m,1).getTime()), t=$("#csTo").value||isoOf(now.getTime()); return [f,t];
}
export function conRows(con,from,to){ return shared.daylog.filter(w=>w.date>=from&&w.date<=to&&(w.contractor||"ללא קבלן")===con); }
export function renderConSummary(){
  const box=$("#csBody"); if(!box) return;
  const cons=[...new Set(shared.daylog.map(w=>w.contractor||"ללא קבלן"))].sort((a,b)=>a.localeCompare(b,"he"));
  const cc=$("#csCon"); if(!cons.length){ cc.innerHTML=""; $("#csStats").innerHTML=""; box.innerHTML='<div class="empty" style="padding:16px">אין עדיין רישום עובדים. אחרי כמה ימים של רישום הסיכום לקבלן נבנה לבד.</div>'; foldSum("consum",""); return; }
  if(!cons.includes(csCon)) csCon=cons[0];
  cc.innerHTML=cons.map(c=>'<button type="button" class="chip2" data-c="'+esc(c)+'" aria-pressed="'+(csCon===c)+'">'+esc(c)+'</button>').join("");
  cc.onclick=e=>{ const b=e.target.closest("[data-c]"); if(!b) return; csCon=b.dataset.c; renderConSummary(); };
  $("#csPeriod").onclick=e=>{ const b=e.target.closest("[data-p]"); if(!b) return; csPeriod=b.dataset.p; $("#csPeriod").querySelectorAll(".chip2").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); $("#csRange").hidden=csPeriod!=="custom"; renderConSummary(); };
  $("#csFrom").onchange=$("#csTo").onchange=()=>renderConSummary();
  const [from,to]=csRangeIso(); const rows=conRows(csCon,from,to);
  const days=new Set(rows.map(w=>w.date)); const people=new Map(), machines=new Map();
  rows.forEach(w=>{ const p=people.get(w.name)||{name:w.name,job:w.job||"",days:new Set(),hours:0,late:0,early:0,machine:w.machine||""}; p.days.add(w.date); p.hours+=Number(w.hours)||0; if(LATE(w)) p.late++; if(EARLY(w)) p.early++; if(w.machine) p.machine=w.machine; if(w.job) p.job=w.job; people.set(w.name,p);
    if(w.machine){ const m=machines.get(w.machine)||{machine:w.machine,days:new Set(),hours:0,ops:new Set()}; m.days.add(w.date); m.hours+=Number(w.hours)||0; m.ops.add(w.name); machines.set(w.machine,m); } });
  const P=[...people.values()].sort((a,b)=>b.days.size-a.days.size||a.name.localeCompare(b.name,"he")), M=[...machines.values()].sort((a,b)=>b.days.size-a.days.size);
  const manDays=P.reduce((s,p)=>s+p.days.size,0), machDays=M.reduce((s,m)=>s+m.days.size,0), hrs=rows.reduce((s,w)=>s+(Number(w.hours)||0),0);
  foldSum("consum",rows.length?csCon+" · "+manDays+" ימי עבודה":"");
  $("#csStats").innerHTML='<div class="stat"><div class="v num">'+fmtN(days.size)+'</div><div class="k">ימים באתר</div></div><div class="stat"><div class="v num">'+fmtN(manDays)+'</div><div class="k">ימי עובד</div></div><div class="stat"><div class="v num">'+fmtN(machDays)+'</div><div class="k">ימי כלי צמ״ה</div></div>';
  box.innerHTML="";
  if(!rows.length){ box.innerHTML='<div class="empty" style="padding:16px">אין רישומים ל-'+esc(csCon)+' בין '+esc(isoText(from))+' ל-'+esc(isoText(to))+'.</div>'; return; }
  const head=(t,n)=>{ const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--pv)"></i>'+esc(t)+'<span>'+n+'</span>'; box.appendChild(h); };
  if(M.length){ head("כלי צמ״ה",M.length); M.forEach(m=>{ const d=document.createElement("div"); d.className="holder"; d.innerHTML='<div class="who">'+esc(m.machine)+'<div class="what">'+esc([...m.ops].join(", "))+(m.hours?' · '+fmtN(m.hours)+' שעות':'')+'</div></div><div class="q num">'+fmtN(m.days.size)+' <small>ימים</small></div>'; box.appendChild(d); }); }
  head("עובדים",P.length);
  P.forEach(p=>{ const d=document.createElement("div"); d.className="holder"; d.innerHTML='<div class="who">'+esc(p.name)+'<div class="what">'+esc([p.machine?"מפעיל "+p.machine:p.job||"עובד"].join(""))+(p.hours?' · '+fmtN(p.hours)+' שעות':'')+(p.late?' · <span style="color:var(--clay)">'+p.late+' איחורים</span>':'')+(p.early?' · <span style="color:var(--clay)">'+p.early+' יציאות מוקדמות</span>':'')+'</div></div><div class="q num">'+fmtN(p.days.size)+' <small>ימים</small></div>'; box.appendChild(d); });
  // תפוקה שדווחה לצוות הזה בדיווחי הביצוע (מטרים, חיבורים), לפי פעילות
  const out=workOutput(csCon,from,to,cons);
  if(out.length){ head("תפוקה שדווחה",out.length); out.forEach(o=>{ const d=document.createElement("div"); d.className="holder"; d.innerHTML='<div class="who">'+esc(o.name)+'<div class="what">'+o.days.size+' ימי דיווח</div></div><div class="q num">'+fmtN(o.qty)+' <small>'+esc(o.unit)+'</small></div>'; box.appendChild(d); }); }
  const tot=document.createElement("div"); tot.className="hint"; tot.textContent="סה״כ "+manDays+" ימי עובד"+(hrs?" · "+fmtN(hrs)+" שעות שנרשמו":"")+" · "+isoText(from)+" – "+isoText(to); box.appendChild(tot);
}
export async function registerCrewToday(){
  const act=shared.CREW.filter(c=>c.active!==false); if(!act.length){ toast("אין צוות עדיין. הוסף עובדים לצוות קודם."); openCrewForm(); return; }
  const have=new Set(dayRows(shared.dayISO).map(w=>w.name)); const src=act.filter(c=>!have.has(c.name));
  if(!src.length){ toast("כל הצוות כבר רשום ל-"+isoText(shared.dayISO)+"."); return; }
  if(!(await ask("לרשום "+src.length+" מהצוות ליום "+isoText(shared.dayISO)+"?","רשום","var(--pv)","נכנסים עם «הגיע בזמן / יצא בזמן». מי שלא הגיע — מוחקים בלחיצה על השם; איחורים ומשימות מעדכנים אחר כך."))) return;
  for(const c of src){ const doc={id:"dy"+Date.now()+Math.random().toString(36).slice(2,5),date:shared.dayISO,ts:new Date(shared.dayISO+"T12:00:00").getTime(),name:c.name,machine:c.machine||"",contractor:c.contractor||"",job:c.job||"",tasks:"",note:"",arrive:"ontime",leave:"ontime",lateMin:0,earlyMin:0,by:actorName()};
    try{ if(shared.DB) await shared.DB.doc("daylog/"+doc.id).set(doc); else shared.daylog.push(doc); }catch(e){} }
  if(!shared.DB) ls.set("daylog",JSON.stringify(shared.daylog));
  logAct("daylog","add","נרשם הצוות ליום "+isoText(shared.dayISO)+": "+src.length+" אנשים","");
  renderDay();
}
export function __init(){
/* ================= עובדים: מי עבד היום, תפקיד, קבלן משנה, מפעילי צמ״ה ================= */
ROLES = ["חשמלאי מוסמך","עוזר חשמלאי","מנהל צוות","מפעיל","עובד כללי","נהג"];   // docs/templates/crew.csv
shared.daylog=[];
shared.dayISO="";
shared.CREW=[];
dayCon = "";
csCon = "";
csPeriod = "month";
isoOf = t=>{ const d=new Date(t); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
isoText = iso=>{ const [y,m,d]=iso.split("-"); return fmtD(new Date(+y,+m-1,+d,12)); };
dayRows = iso=>shared.daylog.filter(w=>w.date===iso).sort((a,b)=>(a.machine?0:1)-(b.machine?0:1)||String(a.name).localeCompare(String(b.name),"he"));
LATE = w=>w.arrive==="late";
EARLY = w=>w.leave==="early";
$("#btnCsCsv").onclick=async()=>{
  const [from,to]=csRangeIso(); const rows=conRows(csCon,from,to).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.name.localeCompare(b.name,"he"));
  if(!rows.length){ toast("אין רישומים לקבלן בתקופה."); return; }
  const daysOf=new Map(); rows.forEach(w=>{ const k=w.name; const e=daysOf.get(k)||{name:w.name,job:w.job||"",machine:w.machine||"",days:new Set(),hours:0,late:0,early:0}; e.days.add(w.date); e.hours+=Number(w.hours)||0; if(LATE(w)) e.late++; if(EARLY(w)) e.early++; if(w.machine) e.machine=w.machine; daysOf.set(k,e); });
  const sum=csvOf(["קבלן","עובד / מפעיל","תפקיד","כלי צמ\"ה","ימי עבודה","שעות שנרשמו","איחורים","יציאות מוקדמות"],[...daysOf.values()].map(e=>[csCon,e.name,e.job,e.machine,e.days.size,e.hours||"",e.late,e.early]));
  const det=csvOf(["תאריך","עובד / מפעיל","כלי צמ\"ה","שעות","עבודה/אזור","הגעה","איחור (דק׳)","יציאה","יציאה מוקדמת (דק׳)","משימות"],rows.map(w=>[isoText(w.date),w.name,w.machine,w.hours||"",w.area||"",w.arrive==="late"?"איחר":"בזמן",w.lateMin||"",w.leave==="early"?"מוקדם":"בזמן",w.earlyMin||"",w.tasks]));
  await saveFile("דוח-קבלן-"+csCon.replace(/[\\/:*?"<>|]/g,"")+"-"+from+"-"+to+".csv",new Blob(["﻿סיכום לחשבון קבלן: "+csCon+" · "+isoText(from)+" – "+isoText(to)+"\r\n"+sum.replace(/^\ufeff/,"")+"\r\n\r\nפירוט יומי\r\n"+det.replace(/^\ufeff/,"")],{type:"text/csv"}));
  logAct("daylog","export","יוצא דוח לחשבון קבלן: "+csCon+" · "+isoText(from)+" – "+isoText(to)+" · "+rows.length+" רשומות","");
};
$("#btnDayCrew").onclick=registerCrewToday;
$("#btnCrewAdd").onclick=()=>openCrewForm();
$("#dyDate").onchange=e=>{ if(e.target.value){ shared.dayISO=e.target.value; renderDay(); } };
$("#dyPrev").onclick=()=>{ shared.dayISO=isoOf(new Date(shared.dayISO+"T12:00:00").getTime()-86400000); renderDay(); };
$("#dyNext").onclick=()=>{ shared.dayISO=isoOf(new Date(shared.dayISO+"T12:00:00").getTime()+86400000); renderDay(); };
$("#btnDayAdd").onclick=()=>openWorker();
$("#btnDayCopy").onclick=copyCrew;
$("#btnDayCsv").onclick=async()=>{
  const rows=shared.daylog.slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  if(!rows.length){ toast("אין רשומות."); return; }
  await saveFile("יומיות-"+isoOf(Date.now())+".csv",new Blob([csvOf(["תאריך","שם","סוג","תפקיד","כלי צמ\"ה","קבלן","שעות","עבודה/אזור","הגעה","איחור (דק׳)","יציאה","יציאה מוקדמת (דק׳)","משימות","הערות"],rows.map(w=>[isoText(w.date),w.name,w.machine?"מפעיל":"עובד",w.job||"",w.machine,w.contractor,w.hours||"",w.area||"",w.arrive==="late"?"איחר":"בזמן",w.lateMin||"",w.leave==="early"?"מוקדם":"בזמן",w.earlyMin||"",w.tasks,w.note]))],{type:"text/csv"}));
};
}
