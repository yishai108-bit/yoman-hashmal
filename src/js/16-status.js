/* ================= סטטוס התקדמות — כל הפעילויות (מבנה קובץ הסטטוס של החברה) ================= */
const isWorkday=iso=>new Date(iso+"T12:00:00").getDay()<=4;   // א׳–ה׳
function statusHolidays(){ const h=new Set(); STATUS.forEach(a=>(a.daily||[]).forEach(d=>{ if(d.holiday) h.add(d.date); })); return h; }
function workdaysBetween(fromIso,toIso,hol){ let n=0; if(!fromIso||fromIso>toIso) return 0; for(let t=new Date(fromIso+"T12:00:00").getTime(); t<=new Date(toIso+"T12:00:00").getTime(); t+=864e5){ const iso=isoOf(t); if(isWorkday(iso)&&!(hol&&hol.has(iso))) n++; } return n; }
function statusCalc(a,hol){
  const daily=(a.daily||[]).slice().sort((x,y)=>x.date<y.date?-1:1);
  const done=daily.reduce((s,d)=>s+(Number(d.actual)||0),0);
  const first=a.start||(daily.find(d=>Number(d.actual))||{}).date||"";
  const today=isoOf(Date.now()); const total=Number(a.total)||0, wd=Number(a.workDays)||0;
  const passed=first?workdaysBetween(first,today,hol):0, left=Math.max(0,wd-passed);
  const remaining=Math.max(0,total-done);
  const reqOrig=wd?Math.round(total/wd):0, reqNow=remaining?(left?Math.ceil(remaining/left):null):0;
  const last7=daily.filter(d=>d.date>isoOf(Date.now()-7*864e5)&&Number(d.actual)).reduce((s,d)=>s+Number(d.actual),0);
  const lastDate=(daily.filter(d=>Number(d.actual)).pop()||{}).date||"";
  return {done,first,passed,left,pct:total?done/total:0,reqOrig,reqNow,last7,lastDate,remaining,daily};
}
function renderStatus(){
  const el=$("#statusList"); if(!el) return; el.innerHTML="";
  const A=(demoStock?[]:STATUS).slice().sort((a,b)=>(a.order||0)-(b.order||0)); const hol=statusHolidays();
  if(!A.length){ foldSum("status",""); el.innerHTML='<div class="empty" style="padding:16px">אין עדיין סטטוס. ייבא את קובץ הסטטוס של החברה (xlsx) בהגדרות או בכפתור למטה.</div>'; return; }
  let behind=0, doneN=0;
  A.forEach(a=>{ const c=statusCalc(a,hol); if(c.remaining===0) doneN++; else if(c.reqNow===null||(c.reqOrig&&c.reqNow>c.reqOrig*1.25)) behind++;
    const col=c.remaining===0?"var(--sage)":(c.reqNow===null||(c.reqOrig&&c.reqNow>c.reqOrig*1.25))?"var(--clay)":(c.reqOrig&&c.reqNow>c.reqOrig)?"var(--amber)":"var(--ink)";
    const b=document.createElement("button"); b.type="button"; b.className="slip";
    b.innerHTML='<b>'+esc(a.name)+' <span class="num" style="color:'+col+'">'+fmtN(c.done)+'</span><small style="color:var(--ink3)"> / '+fmtN(a.total)+' · '+Math.round(c.pct*100)+'%</small></b>'
      +'<span style="display:block;height:6px;border-radius:3px;background:var(--line2);margin:6px 0 4px;overflow:hidden"><i style="display:block;height:100%;width:'+Math.min(100,Math.round(c.pct*100))+'%;background:'+col+'"></i></span>'
      +'<span>'+(c.remaining===0?'הושלם':(c.left?'נותרו '+c.left+' ימי עבודה · צריך <b style="color:'+col+'">'+fmtN(c.reqNow)+' ליום</b> (תכנון '+fmtN(c.reqOrig)+')':'<b style="color:var(--clay)">נגמרו ימי העבודה</b> · חסרים '+fmtN(c.remaining)))+(c.last7?' · 7 ימים אחרונים: '+fmtN(c.last7):'')+(c.lastDate?' · עדכון אחרון '+esc(isoText(c.lastDate)):'')+'</span>';
    b.onclick=()=>openStatusEntry(a); el.appendChild(b); });
  foldSum("status",(behind?behind+" בפיגור":"")+(doneN?(behind?" · ":"")+doneN+" הושלמו":"")||A.length+" פעילויות");
}
async function saveStatus(a){
  try{ if(DB) await DB.doc("status/"+a.id).set(a); else { STATUS=STATUS.filter(x=>x.id!==a.id).concat(a); ls.set("status",JSON.stringify(STATUS)); } }catch(e){ toast("השמירה נכשלה."); return false; }
  renderStatus(); return true;
}
function openStatusEntry(a){
  a=STATUS.find(x=>x.id===a.id)||a; const hol=statusHolidays(); const c=statusCalc(a,hol);
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="סטטוס פעילות"><div class="grab"></div><h2>'+esc(a.name)+'</h2>'
    +'<div class="kv"><span>בוצע <b>'+fmtN(c.done)+'</b> מתוך '+fmtN(a.total)+'</span><span>'+Math.round(c.pct*100)+'%</span><span>ימי עבודה: עברו <b>'+c.passed+'</b> · נותרו <b>'+c.left+'</b></span>'+(c.remaining?'<span>צריך <b>'+(c.reqNow===null?"—":fmtN(c.reqNow))+'</b> ליום (תכנון '+fmtN(c.reqOrig)+')</span>':'<span style="color:var(--sage)">הושלם</span>')+'</div>'
    +(ROLE!=="viewer"?'<div class="f"><label>כמות שבוצעה ביום</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input type="date" id="seDate" value="'+isoOf(Date.now())+'"><input type="text" id="seQty" inputmode="decimal" placeholder="כמות"></div><input type="text" id="seNote" placeholder="הערה (למשל: שדה 3, חג)" style="margin-top:8px"><button class="save" id="seSave" type="button" style="margin-top:8px;width:100%">שמור</button></div>':'')
    +'<div class="sechead"><span>רישומים אחרונים</span><span>'+c.daily.filter(d=>Number(d.actual)).length+' ימים</span></div><div class="dlines" id="seList">'+c.daily.slice().reverse().filter(d=>Number(d.actual)||d.note).slice(0,30).map(d=>'<div data-d="'+esc(d.date)+'"><span>'+esc(isoText(d.date))+(d.note?' <small style="color:var(--ink3)">'+esc(d.note)+'</small>':'')+'</span><b>'+(Number(d.actual)?fmtN(d.actual):'—')+'</b></div>').join("")+'</div>'
    +'<div class="acts">'+(ROLE==="owner"?'<button class="cancel danger" id="seDel" type="button">מחק פעילות</button>':'')+'<button class="cancel" type="button" style="flex:1">סגור</button></div></div>';
  document.body.appendChild(scrim); const q=x=>scrim.querySelector(x); const close=()=>scrim.remove();
  q(".cancel:not(.danger)").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  scrim.querySelectorAll("#seList [data-d]").forEach(r=>r.onclick=()=>{ if(!q("#seDate")) return; const d=(a.daily||[]).find(x=>x.date===r.dataset.d); q("#seDate").value=r.dataset.d; q("#seQty").value=d&&Number(d.actual)?d.actual:""; q("#seNote").value=d?(d.note||""):""; q("#seQty").focus(); });
  const sv=q("#seSave"); if(sv) sv.onclick=async()=>{ const date=q("#seDate").value, qty=Number(String(q("#seQty").value).replace(",","."))||0, note=q("#seNote").value.trim(); if(!date){ toast("תאריך?"); return; }
    const daily=(a.daily||[]).filter(d=>d.date!==date); if(qty||note) daily.push({date,actual:qty,note,by:actorName(),ts:Date.now()});
    const doc={...a,daily:daily.sort((x,y)=>x.date<y.date?-1:1),updated:Date.now()}; sv.disabled=true;
    if(await saveStatus(doc)){ logAct("progress","add","סטטוס "+a.name+": "+fmtN(qty)+" ב-"+isoText(date)+(note?" · "+note:""),a.id); close(); } else sv.disabled=false; };
  const del=q("#seDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את הפעילות "+a.name+" מהסטטוס?","מחק","var(--clay)"))) return; try{ if(DB) await DB.doc("status/"+a.id).delete(); else { STATUS=STATUS.filter(x=>x.id!==a.id); ls.set("status",JSON.stringify(STATUS)); } }catch(e){ toast("המחיקה נכשלה."); return; } close(); renderStatus(); };
}
/* ייבוא קובץ הסטטוס של החברה: גיליון לכל פעילות; בצד שמאל כמות כללית/ימי עבודה, ובבלוקים שבועיים תאריך · כמות ביצוע · כמות נדרשת · דגל יום עבודה */
function parseStatusWorkbook(wb){
  const out=[]; let order=0;
  wb.SheetNames.forEach(n=>{ if(/מפה/.test(n)) return; const ws=wb.Sheets[n]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
    const left={}; rows.slice(0,16).forEach(r=>{ if(r&&typeof r[0]==="string"&&r[1]!=null) left[r[0].trim()]=r[1]; });
    const total=Number(left["כמות כללית"]); if(!total) return;
    const daily=[]; const toIso=v=>{ if(v instanceof Date) return isoOf(v.getTime()); if(typeof v==="number"&&v>40000&&v<60000){ const d=XLSX.SSF.parse_date_code(v); return d?d.y+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0"):""; } return ""; };
    rows.forEach((r,ri)=>{ if(!r) return; r.forEach((v,ci)=>{ if(ri===0&&ci===0) return; const iso=toIso(v); if(!iso) return; const act=r[ci+1], req=r[ci+2];
      if(typeof act==="number"||typeof act==="string"||(req!=null&&typeof req==="number")) daily.push({date:iso,actual:typeof act==="number"?act:0,note:typeof act==="string"?act.trim():"",holiday:typeof act==="string"&&!!act.trim()}); }); });
    const seen=new Set(); const dd=daily.filter(d=>!seen.has(d.date)&&seen.add(d.date)).filter(d=>d.actual||d.note).sort((a,b)=>a.date<b.date?-1:1);
    out.push({id:"st_"+(++order),order,name:n.trim(),total,workDays:Number(left["ימי עבודה לפעולה"])||0,start:(dd.find(d=>d.actual)||{}).date||"",daily:dd,source:"קובץ סטטוס"}); });
  return out;
}
function openStatusImport(){
  if(ROLE!=="owner"){ toast("ייבוא סטטוס — בעלים בלבד."); return; }
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="ייבוא סטטוס"><div class="grab"></div><h2>ייבוא קובץ סטטוס התקדמות</h2><div class="note-card">קובץ הסטטוס של החברה (xlsx): גיליון לכל פעילות עם "כמות כללית", "ימי עבודה לפעולה" והבלוקים השבועיים. נקרא ישירות. רישומים יומיים שהוזנו באפליקציה בתאריכים שאינם בקובץ נשמרים.</div>'
    +'<div id="siBody"><div class="pick">בחר קובץ סטטוס<small>xlsx</small><input type="file" id="siFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div></div>'
    +'<div class="acts"><button class="save" id="siGo" hidden type="button">שמור סטטוס</button><button class="cancel" type="button">סגור</button></div></div>';
  document.body.appendChild(scrim); const q=x=>scrim.querySelector(x); let out=null;
  q(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#siFile").onchange=async e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; q("#siBody").innerHTML='<div class="prog"><i style="width:40%"></i></div><div class="prog-t"><span>קורא את הקובץ…</span></div>';
    try{ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"); const wb=XLSX.read(await f.arrayBuffer(),{type:"array",cellDates:true}); out=parseStatusWorkbook(wb); }catch(err){ out=null; }
    if(!out||!out.length){ q("#siBody").innerHTML='<div class="empty">זה לא נראה כמו קובץ הסטטוס (לא נמצאו גיליונות עם "כמות כללית").</div>'; return; }
    const hol=new Set(); q("#siBody").innerHTML='<div class="dlines">'+out.map(a=>{ const c=statusCalc(a,hol); return '<div><span>'+esc(a.name)+' <small style="color:var(--ink3)">· '+a.daily.filter(d=>d.actual).length+' ימים · '+a.workDays+' ימי עבודה</small></span><b>'+fmtN(c.done)+' / '+fmtN(a.total)+'</b></div>'; }).join("")+'</div>'; q("#siGo").hidden=false; };
  q("#siGo").onclick=async()=>{ if(!out) return; const b=q("#siGo"); b.disabled=true; b.textContent="שומר…";
    for(const a of out){ const ex=STATUS.find(x=>x.name===a.name); const keep=ex?(ex.daily||[]).filter(d=>!a.daily.some(f=>f.date===d.date)):[]; const doc={...(ex||{}),...a,id:ex?ex.id:a.id,daily:a.daily.concat(keep).sort((x,y)=>x.date<y.date?-1:1),ts:Date.now()};
      try{ if(DB) await DB.doc("status/"+doc.id).set(doc); else { STATUS=STATUS.filter(x=>x.id!==doc.id).concat(doc); } }catch(e){} }
    if(!DB) ls.set("status",JSON.stringify(STATUS));
    logAct("progress","edit","יובא קובץ סטטוס התקדמות: "+out.length+" פעילויות","status"); scrim.remove(); toast("נשמרו "+out.length+" פעילויות."); renderStatus(); };
}
$("#btnStatusImp").onclick=openStatusImport;
$("#btnStatusCsv").onclick=()=>{ const hol=statusHolidays(); const A=STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0)); if(!A.length){ toast("אין סטטוס."); return; }
  const sum=csvOf(["פעילות","כמות כללית","בוצע","יתרה","אחוז","ימי עבודה לפעולה","עברו","נותרו","נדרש ליום מקורי","נדרש ליום עדכני","עדכון אחרון"],A.map(a=>{ const c=statusCalc(a,hol); return [a.name,a.total,c.done,c.remaining,Math.round(c.pct*100)+"%",a.workDays,c.passed,c.left,c.reqOrig,c.reqNow===null?"":c.reqNow,c.lastDate?isoText(c.lastDate):""]; }));
  const det=csvOf(["פעילות","תאריך","כמות ביצוע","הערה"],A.flatMap(a=>(a.daily||[]).filter(d=>Number(d.actual)||d.note).map(d=>[a.name,isoText(d.date),d.actual||"",d.note||""])));
  saveFile("סטטוס-התקדמות-"+isoOf(Date.now())+".csv",new Blob(["﻿סטטוס התקדמות "+SITE.name+" · "+fmtD(Date.now())+"\r\n"+sum.replace(/^﻿/,"")+"\r\n\r\nפירוט יומי\r\n"+det.replace(/^﻿/,"")],{type:"text/csv"})); };
