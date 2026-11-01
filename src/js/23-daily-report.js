import { $, actorName, blobUrl, closer, esc, fmtD, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN, realNotes } from "./01-stock.js";
import { sigPad } from "./03-issues.js";
import { SITE, saveFile } from "./08-settings.js";
import { dayRows, isoOf, isoText, timeDiff } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { WR_CSS } from "./15-weekly-report.js";
import { ROLE } from "./18-identity.js";
import { BLK_KINDS, isClaim, workRows } from "./21-work.js";
/* ================= דוח יומי: טופס הנייר של הקבלן, כמסמך ליום =================
   מסמך אחד ליום (dayinfo/<iso>): מס׳ דוח, מזג אוויר, מנהל עבודה, מזמין ונציגו, «דוח עבודה יומי» במילים,
   ליקויים / בעיות / בטיחות, הערות, שורות ציוד בלי מפעיל רשום (סוג, דגם/מספר, שעות), חומרים בלי תעודה,
   וחתימות: מזמין, קבלן, מנהל עבודה, וראש צוות של כל קבלן משנה שעבד היום (חתימה אחת לרשימה, לא לכל פועל).
   כל השאר נמשך ממה שכבר נרשם: עובדי היום (11-daylog, עם שעת כניסה/יציאה), תעודות המשלוח של היום,
   דיווחי הביצוע לפי סעיף, חריגים פתוחים, וכלי הצמ״ה של המפעילים. הייצוא (HTML להדפסה / PDF) מסודר כמו
   טופס הנייר: כותרת עם הסמל, שתי רשימות עובדים (שלנו / קבלן משנה), חומרים ואספקות, ציוד וכלים, דוח עבודה,
   ליקויים ובטיחות, הערות, חתימות. הצבעים והסמל של המסמך הם של המופע (tools/build.js מחליף אותם לכל קבלן). */
export const WEATHER = {sun:"שמש",partly:"מעונן חלקית",cloudy:"מעונן",rain:"גשם"};
export const SIG_SLOTS = [["client","מזמין / נציג"],["contractor","קבלן"],["foreman","מנהל עבודה"]];
export let DR_CSS;
export function dayInfo(iso){
  iso=iso||shared.dayISO||isoOf(Date.now());
  return (shared.DAYINFO||[]).find(d=>d.id===iso)||{id:iso,date:iso,no:"",weather:"",foreman:"",client:"",clientRep:"",work:"",issues:"",remarks:"",equipment:[],materials:[],sigs:{}};
}
export function nextReportNo(){ return (shared.DAYINFO||[]).reduce((m,d)=>Math.max(m,Number(d.no)||0),0)+1; }
/* חתימות שהדוח של היום צריך: שלוש קבועות + ראש צוות לכל קבלן משנה שעבד היום */
export function sigSlots(iso){
  const subs=[...new Set(dayRows(iso).map(w=>(w.contractor||"").trim()).filter(Boolean))];
  return SIG_SLOTS.concat(subs.map(c=>["sub:"+c,"ראש צוות · "+c]));
}
export function sigSrc(s){ return s?(s.asset?blobUrl(s.asset):(s.url||s.data||"")):""; }
export async function saveDayInfo(doc){
  doc={...doc,updated:Date.now(),by:actorName()};
  try{ if(shared.DB) await shared.DB.doc("dayinfo/"+doc.id).set(doc); }catch(e){ toast("השמירה נכשלה."); return false; }
  // מעדכנים מיד גם בזיכרון: החלון שפתוח מצייר מחדש לפני שהמאגר מחזיר את העדכון
  shared.DAYINFO=(shared.DAYINFO||[]).filter(x=>x.id!==doc.id).concat(doc); if(!shared.DB) ls.set("dayinfo",JSON.stringify(shared.DAYINFO));
  renderDayReport(); return true;
}
/* שורת הסיכום בכרטיס «דוח יומי» בלשונית עובדים */
export function renderDayReport(){
  const el=$("#dyReport"); if(!el) return;
  const iso=shared.dayISO||isoOf(Date.now()), d=dayInfo(iso), W=dayRows(iso), sub=W.filter(w=>w.contractor), slots=sigSlots(iso), signed=slots.filter(s=>sigSrc((d.sigs||{})[s[0]])).length;
  const eq=W.filter(w=>w.machine).length+(d.equipment||[]).length;
  const head=[d.no?"דוח מס׳ "+d.no:"",WEATHER[d.weather]||"",d.foreman?"מנהל עבודה: "+d.foreman:"",d.client?"מזמין: "+d.client:""].filter(Boolean);
  foldSum("dreport",(d.no?"מס׳ "+d.no+" · ":"")+signed+"/"+slots.length+" חתימות");
  el.innerHTML='<div class="hint" style="margin:0 0 6px">'+(head.length?esc(head.join(" · ")):"עוד לא מולאו פרטי היום: מזג אוויר, מנהל עבודה, מזמין.")+'</div>'
    +'<div class="hint" style="margin:0">'+esc("עובדים: "+W.length+(W.length?" ("+(W.length-sub.length)+" שלנו, "+sub.length+" קבלן משנה)":"")+" · ציוד: "+eq+" · חתימות: "+signed+"/"+slots.length+(d.work?" · דוח עבודה מולא":""))+'</div>';
}
/* ---- פרטי היום ---- */
export function openDayInfo(iso){
  if(ROLE==="viewer"){ toast("פרטי היום — לעורכים."); return; }
  iso=iso||shared.dayISO||isoOf(Date.now()); const d=JSON.parse(JSON.stringify(dayInfo(iso)));
  const prev=(shared.DAYINFO||[]).filter(x=>x.id<iso).sort((a,b)=>a.id<b.id?1:-1)[0]||{};   // ברירות מחדל מהדוח הקודם
  if(!d.no) d.no=nextReportNo(); if(!d.foreman) d.foreman=prev.foreman||""; if(!d.client) d.client=prev.client||""; if(!d.clientRep) d.clientRep=prev.clientRep||"";
  let weather=d.weather||"", equipment=(d.equipment||[]).map(x=>({...x})), materials=(d.materials||[]).map(x=>({...x}));
  const ops=dayRows(iso).filter(w=>w.machine);
  const F=(id,label,val,ph,style)=>'<div class="f"'+(style?' style="'+style+'"':'')+'><label for="'+id+'">'+label+'</label><input type="text" id="'+id+'" value="'+esc(val||"")+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+' autocomplete="off"></div>';
  const T=(id,label,val,ph)=>'<div class="f"><label for="'+id+'">'+label+'</label><textarea id="'+id+'" placeholder="'+esc(ph||"")+'">'+esc(val||"")+'</textarea></div>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="פרטי היום"><div class="grab"></div><h2>פרטי היום · '+esc(isoText(iso))+'</h2>'
    +'<div class="f"><label>תנאי מזג אוויר</label><div class="opts" id="diWeather">'+Object.entries(WEATHER).map(([k,v])=>'<button class="opt" type="button" data-v="'+k+'" aria-pressed="'+(weather===k)+'">'+v+'</button>').join("")+'</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">'+F("diNo","מס׳ דוח",d.no,"")+F("diForeman","מנהל עבודה",d.foreman,"שם")+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+F("diClient","מזמין העבודה",d.client,"החברה המזמינה")+F("diRep","נציג המזמין",d.clientRep,"שם")+'</div>'
    +T("diWork","דוח עבודה יומי",d.work,"מה נעשה היום, במילים. הכמויות לפי סעיף נכנסות לבד מדיווחי הביצוע.")
    +T("diIssues","ליקויים / בעיות / בטיחות",d.issues,"מה שלא היה בסדר היום. חריגים פתוחים נכנסים לבד.")
    +T("diRemarks","הערות",d.remarks,"")
    +'<div class="f"><label>ציוד וכלים</label>'+(ops.length?'<div class="hint" style="margin:0 0 6px">נכנסים לבד מהמפעילים: '+esc(ops.map(w=>w.machine+(w.hours?" · "+fmtN(w.hours)+" ש׳":"")).join(", "))+'</div>':'')+'<div id="diEq"></div><button class="addline" id="diEqAdd" type="button">+ ציוד בלי מפעיל רשום</button></div>'
    +'<div class="f"><label>חומרים / אספקות בלי תעודה</label><div class="hint" style="margin:0 0 6px">תעודות המשלוח של היום נכנסות לבד.</div><div id="diMat"></div><button class="addline" id="diMatAdd" type="button">+ חומר</button></div>'
    +'<div class="acts"><button class="save" id="diSave" type="button">שמור</button><button class="cancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  q("#diWeather").onclick=e=>{ const b=e.target.closest("[data-v]"); if(!b) return; weather=weather===b.dataset.v?"":b.dataset.v; q("#diWeather").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o.dataset.v===weather))); };
  const rows=(box,list,cols)=>{ const el=q(box);
    el.innerHTML=list.map((r,i)=>'<div class="drow" data-i="'+i+'">'+cols.map(c=>'<input type="text" data-k="'+c[0]+'" value="'+esc(r[c[0]]||"")+'" placeholder="'+c[1]+'" aria-label="'+c[1]+'"'+(c[2]?' inputmode="decimal"':'')+'>').join("")+'<button type="button" class="x" aria-label="הסר">×</button></div>').join("");
    el.querySelectorAll("input").forEach(inp=>inp.oninput=()=>{ list[+inp.closest(".drow").dataset.i][inp.dataset.k]=inp.value; });
    el.querySelectorAll(".x").forEach(x=>x.onclick=()=>{ list.splice(+x.closest(".drow").dataset.i,1); rows(box,list,cols); }); };
  const EQ=[["type","סוג הציוד"],["model","מספר / דגם"],["hours","שעות",1],["note","הערות"]], MT=[["name","תיאור"],["qty","כמות",1],["unit","יחידה"],["note","הערות"]];
  rows("#diEq",equipment,EQ); rows("#diMat",materials,MT);
  q("#diEqAdd").onclick=()=>{ equipment.push({type:"",model:"",hours:"",note:""}); rows("#diEq",equipment,EQ); const L=q("#diEq").querySelectorAll('input[data-k="type"]'); L[L.length-1].focus(); };
  q("#diMatAdd").onclick=()=>{ materials.push({name:"",qty:"",unit:"",note:""}); rows("#diMat",materials,MT); const L=q("#diMat").querySelectorAll('input[data-k="name"]'); L[L.length-1].focus(); };
  q("#diSave").onclick=async()=>{
    const num=v=>{ const n=Number(String(v).replace(",",".")); return isFinite(n)&&n>0?n:""; };
    const doc={...d,no:q("#diNo").value.trim(),weather,foreman:q("#diForeman").value.trim(),client:q("#diClient").value.trim(),clientRep:q("#diRep").value.trim(),
      work:q("#diWork").value.trim(),issues:q("#diIssues").value.trim(),remarks:q("#diRemarks").value.trim(),
      equipment:equipment.filter(r=>(r.type||"").trim()).map(r=>({type:r.type.trim(),model:(r.model||"").trim(),hours:num(r.hours),note:(r.note||"").trim()})),
      materials:materials.filter(r=>(r.name||"").trim()).map(r=>({name:r.name.trim(),qty:num(r.qty),unit:(r.unit||"").trim(),note:(r.note||"").trim()})),
      sigs:dayInfo(iso).sigs||{}};   // החתימות נשמרות בנפרד; לא דורסים אותן בעותק ישן
    if(!(await saveDayInfo(doc))) return;
    logAct("daylog","edit","פרטי היום "+isoText(iso)+(doc.no?" · דוח מס׳ "+doc.no:"")+(WEATHER[weather]?" · "+WEATHER[weather]:"")+(doc.equipment.length?" · "+doc.equipment.length+" כלים":""),iso);
    close();
  };
}
/* ---- חתימות ---- */
export function openDaySigs(iso){
  iso=iso||shared.dayISO||isoOf(Date.now());
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="חתימות"><div class="grab"></div><h2>חתימות · '+esc(isoText(iso))+'</h2>'
    +'<div class="note-card">חתימה אחת לכל תפקיד, באצבע על המסך. ראש הצוות של קבלן המשנה חותם פעם אחת על רשימת העובדים שלו.</div><div class="stock" id="sgList"></div>'
    +'<div class="acts"><button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const draw=()=>{ const d=dayInfo(iso), L=q("#sgList"); L.innerHTML="";
    sigSlots(iso).forEach(([key,label])=>{ const s=(d.sigs||{})[key], src=sigSrc(s); const b=document.createElement("button"); b.type="button"; b.className="slip";
      b.innerHTML='<b></b><span></span><span class="sigok" style="'+(src?'background:var(--sage-soft);color:var(--sage)':'background:var(--clay-soft);color:var(--clay)')+'">'+(src?"חתום":"ללא חתימה")+'</span>'+(src?'<img class="sigimg" src="'+esc(src)+'" alt="" style="grid-column:1/3;max-height:60px;width:auto;margin-top:4px">':'');
      b.querySelector("b").textContent=label; b.querySelector("span").textContent=s?(s.name||"")+(s.ts?" · "+fmtD(s.ts):""):"לחץ כדי לחתום";
      b.onclick=()=>{ if(ROLE==="viewer"){ toast("חתימה — לעורכים."); return; } openSignature(iso,key,label,s&&s.name||"",draw); }; L.appendChild(b); }); };
  draw();
}
export function openSignature(iso,key,label,name,after){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="חתימה"><div class="grab"></div><h2>חתימה · '+esc(label)+'</h2>'
    +'<div class="f"><label for="sgName">שם החותם</label><input type="text" id="sgName" value="'+esc(name||"")+'" autocomplete="off"></div>'
    +'<div class="f"><label>חתימה</label><div class="sig" id="sgPad"><canvas></canvas><div class="hint2">חותמים כאן באצבע</div><button class="clr2" type="button">נקה</button></div></div>'
    +'<div class="acts"><button class="save" id="sgSave" type="button">שמור חתימה</button><button class="cancel" type="button">ביטול</button></div></div>',{z:60});
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const pad=sigPad(q("#sgPad"));
  q("#sgSave").onclick=async()=>{ if(!pad.has()){ toast("אין חתימה."); return; } const b=q("#sgSave"); b.disabled=true; b.textContent="שומר…";
    const sig={name:q("#sgName").value.trim(),ts:Date.now(),by:actorName()};
    let up=false; try{ if(shared.ASSETS){ const a=await shared.ASSETS.upload(await pad.blob()); sig.asset=a.id; sig.url=a.url; up=true; } }catch(e){}
    if(!up){ try{ sig.data=pad.dataUrl(); }catch(e){} }
    const d=JSON.parse(JSON.stringify(dayInfo(iso))); d.sigs={...(d.sigs||{}),[key]:sig};
    if(await saveDayInfo(d)){ logAct("daylog","edit","חתימה על דוח יומי "+isoText(iso)+": "+label+(sig.name?" · "+sig.name:""),iso); close(); if(after) after(); }
    else { b.disabled=false; b.textContent="שמור חתימה"; } };
}
/* ---- המסמך ---- */
export function hoursOf(w){ if(Number(w.hours)) return Number(w.hours); const h=timeDiff(w.tin,w.tout); return h||0; }
export function dailyReportData(iso){
  const info=dayInfo(iso), W=dayRows(iso), t0=new Date(iso+"T00:00:00").getTime(), t1=t0+864e5;
  const own=W.filter(w=>!(w.contractor||"").trim()), subs=new Map(); W.filter(w=>(w.contractor||"").trim()).forEach(w=>{ const k=w.contractor.trim(); (subs.get(k)||subs.set(k,[]).get(k)).push(w); });
  const notes=realNotes().filter(n=>n.ts>=t0&&n.ts<t1);
  const materials=notes.flatMap(n=>(n.lines||[]).filter(l=>Number(l.qty)>0).map(l=>({name:l.name,qty:Number(l.qty),unit:l.unit||"",note:[n.supplier,n.no?"תעודה "+n.no:""].filter(Boolean).join(" · ")}))).concat(info.materials||[]);
  const equipment=W.filter(w=>w.machine).map(w=>({type:w.machine,model:"",hours:hoursOf(w),note:"מפעיל: "+w.name})).concat(info.equipment||[]);
  const work=workRows(iso).filter(r=>Number(r.actual)||r.note);
  const open=(shared.blockers||[]).filter(b=>b.status!=="closed"&&!isClaim(b)&&(b.date||isoOf(b.ts))<=iso);
  const sigs=sigSlots(iso).map(([key,label])=>({key,label,sig:(info.sigs||{})[key]||null}));
  return {iso,info,own,subs,materials,equipment,work,open,sigs,hours:W.reduce((s,w)=>s+hoursOf(w),0)};
}
export function dailyReportHtml(D,o){
  o=o||{}; const e=esc, info=D.info, site=SITE.name||"האתר", co=SITE.company||"", src=s=>(o.imgs&&o.imgs.get(s))||s;
  const mark=(document.querySelector("#docMark")||{}).innerHTML||(document.querySelector(".top h1 .mark")||{}).outerHTML||"";
  const dayName=new Date(D.iso+"T12:00:00").toLocaleDateString("he-IL",{weekday:"long"});
  const tm=t=>t?'<span class="n">'+e(t)+'</span>':"";
  const wtable=(title,L)=>'<table class="bx wt"><caption>'+title+' <small>· '+L.length+(L.filter(w=>w.cert).length?' · '+L.filter(w=>w.cert).length+' חשמלאים מוסמכים':'')+'</small></caption><tr><th>#</th><th>שם העובד</th><th>תפקיד</th><th>כניסה</th><th>יציאה</th><th>סה״כ שעות</th></tr>'
    +L.map((w,i)=>'<tr><td class="n">'+(i+1)+'</td><td>'+e(w.name)+(w.machine?' <small>· מפעיל '+e(w.machine)+'</small>':'')+'</td><td>'+e(w.job||"")+(w.cert?' <small>· מוסמך</small>':'')+'</td><td>'+tm(w.tin)+'</td><td>'+tm(w.tout)+'</td><td class="n">'+(hoursOf(w)?fmtN(hoursOf(w)):"")+'</td></tr>').join("")
    +(L.length?'':'<tr><td colspan="6" class="mute">לא נרשמו עובדים</td></tr>')+'</table>';
  const table=(cols,L,empty)=>'<table class="bx"><tr>'+cols.map(c=>'<th>'+c[0]+'</th>').join("")+'</tr>'+(L.length?L.map(r=>'<tr>'+cols.map(c=>'<td'+(c[2]?' class="n"':'')+'>'+(c[2]?(r[c[1]]?fmtN(r[c[1]]):""):e(r[c[1]]||""))+'</td>').join("")+'</tr>').join(""):'<tr><td colspan="'+cols.length+'" class="mute">'+empty+'</td></tr>')+'</table>';
  let h='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e("דוח יומי · "+site+" · "+isoText(D.iso))+'</title>'
    +'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&family=Heebo:wght@400;700;900&display=swap"><style>'+WR_CSS+DR_CSS+'</style></head><body><div class="pg dr">'
    +'<div class="band"></div><div class="hd"><div class="mk">'+mark+'</div><div class="ttl"><h1>דוח יומי</h1><div class="sub">'+e(dayName+" "+isoText(D.iso))+'</div></div>'
    +'<div class="meta"><div>תאריך <b class="n">'+e(isoText(D.iso))+'</b></div><div>מס׳ דוח <b class="n">'+e(info.no||"—")+'</b></div><div>הופק <b class="n">'+e(fmtD(Date.now()))+'</b></div></div></div>'
    +'<div class="info"><div><span>שם הפרויקט / אתר</span><b>'+e(site)+'</b></div><div><span>קבלן</span><b>'+e(co||"—")+'</b></div><div><span>מנהל עבודה</span><b>'+e(info.foreman||"—")+'</b></div>'
    +'<div><span>מזמין העבודה</span><b>'+e(info.client||"—")+(info.clientRep?' <small>· '+e(info.clientRep)+'</small>':'')+'</b></div><div><span>תנאי מזג אוויר</span><b>'+e(WEATHER[info.weather]||"—")+'</b></div><div><span>סה״כ שעות עובדים</span><b class="n">'+(D.hours?fmtN(D.hours):"—")+'</b></div></div>';
  h+='<h3 class="hbar">רשימת העובדים</h3><div class="two">'+wtable((co?'עובדי <span class="n">'+e(co)+'</span>':"עובדים"),D.own)+[...D.subs.entries()].map(([c,L])=>wtable("קבלן משנה · "+e(c),L)).join("")+'</div>';
  h+='<div class="two"><div><h3 class="htab">חומרים / אספקות</h3>'+table([["תיאור החומר / אספקה","name"],["כמות","qty",1],["יחידה","unit"],["הערות","note"]],D.materials,"לא נרשמו תעודות או חומרים היום")+'</div>'
    +'<div><h3 class="htab">ציוד וכלים</h3>'+table([["סוג הציוד","type"],["מספר / דגם","model"],["שעות עבודה","hours",1],["הערות","note"]],D.equipment,"לא נרשם ציוד היום")+'</div></div>';
  h+='<h3 class="hbar">דוח עבודה יומי</h3><div class="txt">'+(info.work?e(info.work):'<span class="mute">לא נכתב</span>')+'</div>'
    +(D.work.length?'<ul class="lines">'+D.work.map(r=>'<li>'+(r.activity.code?'<span class="code">'+e(r.activity.code)+'</span>':'')+e(r.activity.name)+(Number(r.actual)?': <b class="n">'+fmtN(r.actual)+'</b> '+e(r.activity.unit||""):'')+e([r.area,r.crew,r.workers?r.workers+" עובדים":"",r.note].filter(Boolean).map(x=>" · "+x).join(""))+'</li>').join("")+'</ul>':'');
  h+='<div class="two"><div><h3 class="htab">ליקויים / בעיות / בטיחות</h3><div class="txt">'+(info.issues?e(info.issues):'<span class="mute">לא נרשמו</span>')+'</div>'
    +(D.open.length?'<ul class="lines">'+D.open.map(b=>'<li><b>'+e(BLK_KINDS[b.kind]||"חריג")+':</b> '+e(b.text||"")+(b.area?' ('+e(b.area)+')':'')+'</li>').join("")+'</ul>':'')+'</div>'
    +'<div><h3 class="htab">הערות</h3><div class="txt">'+(info.remarks?e(info.remarks):'<span class="mute">—</span>')+'</div></div></div>';
  const photos=(info.photos||[]).map(p=>sigSrc(p)).filter(Boolean);   // תמונות מהשטח (דיווח בדיבור / צילום)
  if(photos.length) h+='<h3 class="hbar">תמונות מהשטח</h3><div class="phs">'+photos.map(u=>'<img src="'+e(src(u))+'" alt="תמונה מהשטח">').join("")+'</div>';
  h+='<div class="sigs">'+D.sigs.map(s=>{ const u=sigSrc(s.sig); return '<div class="sg"><span class="lb">חתימת '+e(s.label)+'</span><div class="bx">'+(u?'<img src="'+e(src(u))+'" alt="חתימה">':'')+'</div><span class="nm">'+e(s.sig&&s.sig.name||"")+'</span><span class="dt">תאריך: '+(s.sig?'<span class="n">'+e(fmtD(s.sig.ts))+'</span>':"________")+'</span></div>'; }).join("")+'</div>';
  h+='<div class="ft"><span class="mk sm">'+mark+'</span><span>'+e([co,site].filter(Boolean).join(" · "))+' · הופק מיומן חשמל</span><span>נכון ל-<span class="n">'+e(fmtD(Date.now()))+'</span></span></div></div></body></html>';
  return h;
}
/* תמונות החתימות כ-data URL, כדי שהקובץ שיורד יעמוד בפני עצמו */
export async function inlineImages(D){
  const m=new Map();
  for(const u of D.sigs.map(s=>sigSrc(s.sig)).concat((D.info.photos||[]).map(p=>sigSrc(p)))){ if(!u||u.startsWith("data:")) continue;
    try{ const bl=await (await fetch(u)).blob(); m.set(u,await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(bl); })); }catch(e){} }
  return m;
}
export function openDailyReport(iso){
  iso=iso||shared.dayISO||isoOf(Date.now());
  const scrim=popup('<div class="sheet wr-sheet" role="dialog" aria-modal="true" aria-label="דוח יומי"><div class="grab"></div><h2>דוח יומי · '+esc(isoText(iso))+'</h2>'
    +'<div class="note-card">הטופס היומי מתוך מה שנרשם היום: עובדים ושעות, תעודות וחומרים, ציוד, דיווחי ביצוע, חריגים וחתימות. מה שחסר ממלאים ב«פרטי היום» ו«חתימות».</div>'
    +'<iframe class="wr-frame" id="drFrame" title="תצוגת הדוח"></iframe>'
    +'<div class="acts"><button class="save" id="drDl" type="button">הורדת הקובץ</button><button class="ghost" id="drPrint" type="button">הדפסה / PDF</button><button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const D=dailyReportData(iso); q("#drFrame").srcdoc=dailyReportHtml(D);
  q("#drDl").onclick=async()=>{ const b=q("#drDl"); b.disabled=true; b.textContent="מכין קובץ…"; let imgs=null; try{ imgs=await inlineImages(D); }catch(e){}
    if(await saveFile("דוח-יומי-"+(SITE.name||"אתר").replace(/\s+/g,"-")+"-"+iso+(D.info.no?"-"+D.info.no:"")+".html",new Blob([dailyReportHtml(D,{imgs})],{type:"text/html"}))) logAct("daylog","export","דוח יומי "+isoText(iso)+(D.info.no?" · מס׳ "+D.info.no:"")+" · "+(D.own.length+[...D.subs.values()].reduce((s,L)=>s+L.length,0))+" עובדים",iso);
    b.disabled=false; b.textContent="הורדת הקובץ"; };
  q("#drPrint").onclick=()=>{ try{ q("#drFrame").contentWindow.print(); }catch(e){ toast("ההדפסה לא זמינה כאן. הורד את הקובץ והדפס ממנו."); } };
}
export function __init(){
// הצבעים כאן הם צבעי הבסיס (S.E.E); tools/build.js מחליף אותם לצבעי המופע, כמו ב-WR_CSS
DR_CSS = '.dr{position:relative;overflow:hidden;border-top:0;padding-top:18px}.band{position:absolute;top:0;right:0;left:0;height:10px;background:linear-gradient(100deg,#1F5E8C 0 62%,#F2B03D 62% 100%)}'
 +'.dr .hd{align-items:center;border-bottom:0;padding:6px 0 10px}.mk{display:flex;align-items:center;gap:10px;min-width:72px}.mk svg,.mk img{width:72px;height:72px;flex:none}.mk.sm svg,.mk.sm img{width:34px;height:34px}'
 +'.ttl{text-align:center;flex:1}.ttl h1{margin:0;font-family:"Heebo","Alef",Arial,sans-serif;font-weight:900;font-size:2.2rem;letter-spacing:-.01em;color:#1F5E8C}.ttl .sub{color:#666B6E}'
 +'.meta{text-align:right;font-size:.86rem;color:#3F4447;min-width:120px}.meta div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #D9DADA;padding:3px 0}'
 +'.info{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 4px}.info div{border:1px solid #D9DADA;border-radius:6px;padding:6px 10px;background:#fff}.info span{display:block;font-size:.72rem;color:#666B6E}.info b{font-size:.95rem}.info small{font-weight:400;color:#3F4447}'
 +'h3.hbar{margin:18px 0 8px;padding:6px 12px;background:#1F5E8C;color:#fff;border-radius:6px;border:0;text-align:center;font-weight:800;break-after:avoid}'
 +'h3.htab{margin:16px 0 6px;padding:4px 14px;background:#F2B03D;color:#fff;border:0;border-radius:0 6px 6px 0;display:inline-block;clip-path:polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%);font-weight:800;break-after:avoid}'
 +'table.bx{border:1px solid #D9DADA;margin:0 0 6px}table.bx th,table.bx td{border:1px solid #ECEDED;padding:5px 6px;font-size:.84rem}table.bx th{background:#F2F2F2;color:#121212;font-size:.76rem}table.bx td.mute,.mute{color:#666B6E}'
 +'.wt caption{text-align:right;font-weight:700;padding:4px 2px;color:#1F5E8C}.wt caption small{color:#666B6E;font-weight:400}'
 +'.dr .two{align-items:start;gap:12px}.txt{white-space:pre-wrap;min-height:64px;border:1px solid #D9DADA;border-radius:6px;padding:8px 10px;background:#fff;line-height:1.6}'
 +'.lines{margin:6px 0 0;padding:0 18px 0 0;font-size:.9rem}.lines li{margin:3px 0}'
 +'.sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:28px 0 8px;break-inside:avoid}.sg .lb{display:block;font-weight:700;font-size:.86rem}.sg .bx{height:74px;border-bottom:1px solid #121212;display:flex;align-items:flex-end;justify-content:center}.sg .bx img{max-height:70px;max-width:100%}.sg .nm,.sg .dt{display:block;font-size:.78rem;color:#666B6E;margin-top:3px}'
 +'.dr .ft{align-items:center}@media print{.dr{padding:0 0 10px}.band{display:none}}@media (max-width:600px){.dr .two,.info,.sigs{grid-template-columns:1fr}.ttl h1{font-size:1.7rem}.mk svg,.mk img{width:54px;height:54px}}.phs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0 12px}.phs img{width:100%;aspect-ratio:4/3;object-fit:cover;border:1px solid #d5d5d5;border-radius:4px;display:block}';
try{ shared.DAYINFO=JSON.parse(ls.get("dayinfo")||"[]"); if(!Array.isArray(shared.DAYINFO)) shared.DAYINFO=[]; }catch(e){ shared.DAYINFO=[]; }
const bi=$("#btnDayInfo"); if(bi) bi.onclick=()=>openDayInfo();
const bs=$("#btnDaySigs"); if(bs) bs.onclick=()=>openDaySigs();
const br=$("#btnDayReport"); if(br) br.onclick=()=>openDailyReport();
const br2=$("#btnDayReport2"); if(br2) br2.onclick=()=>openDailyReport();
renderDayReport();
}
