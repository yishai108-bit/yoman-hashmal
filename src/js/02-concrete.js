import { $, ask, closer, esc, fmtD, fmtDT, logAct, ls, popup, shared, toast } from "./core.js";
import { curConcrete, fmtM3, fmtN, hit, renderOverview, weekStart } from "./01-stock.js";
import { missingConcrete, trucksText } from "./03-kit.js";
import { showTab } from "./08-settings.js";
import { exportNotePdf } from "./09-doc-scanner.js";
export let DEMO_CONCRETE, concreteQ, cDayMax, openDays;
export function renderConcrete(){
  const all=curConcrete();
  $("#demoBarC").hidden=!shared.demoStock;
  const q=concreteQ;
  const rows=all.filter(c=>!q||hit(c.noteNo,q)||hit(c.element,q)||hit(c.truck,q)||hit(c.note,q)||hit(c.dateText,q));
  const m3=all.reduce((s,c)=>s+(Number(c.m3)||0),0);
  $("#cM3").textContent=fmtM3(m3);
  $("#cTrucks").textContent=fmtN(all.length);
  $("#cDays").textContent=fmtN(new Set(all.map(c=>c.dateText)).size);
  const wk=Date.now()-7*86400000;
  $("#cWeek").textContent=fmtM3(all.filter(c=>c.ts>=wk).reduce((s,c)=>s+(Number(c.m3)||0),0));
  // weekly chart of m3
  const ch=$("#cChart"), cx=$("#cChartX"); ch.innerHTML=""; cx.innerHTML="";
  const tss=all.map(c=>c.ts).filter(Boolean).sort((a,b)=>a-b);
  if(tss.length){
    const W=7*86400000, first=weekStart(tss[0]), last=weekStart(tss[tss.length-1]);
    const sum=new Map(); all.forEach(c=>{ const k=weekStart(c.ts); sum.set(k,(sum.get(k)||0)+(Number(c.m3)||0)); });
    const weeks=[]; for(let t=first;t<=last+3600000*2;t=weekStart(t+W+3600000*12)) weeks.push(t);
    const max=Math.max(1,...weeks.map(w=>sum.get(w)||0));
    const every=weeks.length>10?2:1;
    weeks.forEach((w,i)=>{
      const v=sum.get(w)||0;
      const col=document.createElement("div"); col.className="col"+(v?"":" zero");
      col.title=fmtD(w)+" · "+fmtM3(v)+" מ״ק";
      col.innerHTML=(v?'<b style="bottom:'+(v/max*100)+'%">'+fmtM3(v)+'</b>':'')+'<i style="height:'+(v/max*100)+'%"></i>';
      ch.appendChild(col);
      const lb=document.createElement("span"); const d=new Date(w);
      lb.textContent=(i%every===0)?d.getDate()+"/"+(d.getMonth()+1):""; cx.appendChild(lb);
    });
  } else ch.innerHTML='<div class="empty" style="width:100%">אין עדיין יציקות.</div>';
  // days
  const byDay=new Map();
  rows.forEach(c=>{ const k=c.dateText||fmtD(c.ts); const e=byDay.get(k)||{day:k,ts:c.ts,list:[]}; e.list.push(c); e.ts=Math.max(e.ts,c.ts); byDay.set(k,e); });
  const days=[...byDay.values()].sort((a,b)=>b.ts-a.ts);
  $("#cCount").textContent=days.length?(days.length+" ימים · "+rows.length+" משאיות"):"";
  const list=$("#cList"); list.innerHTML="";
  if(!days.length){ list.innerHTML='<div class="empty">'+(q?'אין יציקה שמתאימה לחיפוש.':'אין עדיין תעודות בטון.')+'</div>'; return; }
  const missAll=missingConcrete(all);
  const mf=$("#cMissing"); mf.innerHTML="";
  if(missAll.trucks){
    const b=document.createElement("div"); b.className="flag";
    b.innerHTML='<div class="t"><b>'+trucksText(missAll.trucks)+' (~'+fmtM3(missAll.m3)+' מ״ק) '+(missAll.trucks===1?'הגיעה':'הגיעו')+' בלי תעודה מצולמת</b><span>לפי המונה המצטבר שמודפס על התעודות של אותו יום: '+esc(missAll.days.join(", "))+'. הספק יחייב גם עליהן.</span></div>';
    mf.appendChild(b);
  }
  days.slice(0,cDayMax).forEach(d=>{
    const el=document.createElement("div"); el.className="day"+(openDays.has(d.day)||q?" open":"");
    const dm3=d.list.reduce((s,c)=>s+(Number(c.m3)||0),0);
    const ordered=Math.max(0,...d.list.map(c=>Number(c.ordered)||0));
    const dmiss=missAll.perDay.get(d.day);
    const els=[...new Set(d.list.map(c=>(c.element||"").replace(/\s*\(\?\)/g,"").trim()).filter(Boolean))];
    const extra=(dmiss?'<span class="gap">'+trucksText(dmiss.trucks)+' ללא תעודה</span> · ':'')
      +(ordered&&dm3<ordered?'<span class="gap">סופק '+fmtM3(dm3)+' מתוך '+fmtM3(ordered)+' שהוזמנו</span> · ':'');
    el.innerHTML='<button class="hd" type="button" aria-expanded="'+el.classList.contains("open")+'">'
      +'<div class="d">'+esc(fmtDT(d.day))+'</div><div class="m num">'+fmtM3(dm3)+'<small>'+d.list.length+' משאיות</small></div>'
      +'<div class="el">'+extra+(els.length?esc(els.slice(0,4).join(" · "))+(els.length>4?' · ועוד '+(els.length-4):''):'מיקום היציקה לא נרשם')+'</div></button>'
      +'<div class="trucks">'+d.list.slice().sort((a,b)=>String(a.noteNo).localeCompare(String(b.noteNo))).map(c=>
        '<button class="truck" type="button" data-cid="'+esc(c.id)+'"><span class="no">'+esc(c.noteNo||"—")+'</span>'
        +'<span class="where">'+esc(c.element||"")+(c.truck?' <span style="color:var(--ink3)">· '+esc(c.truck)+'</span>':'')+'</span>'
        +'<span class="q">'+fmtM3(Number(c.m3)||0)+' מ״ק</span></button>').join("")+'</div>';
    el.querySelector(".hd").onclick=()=>{ if(openDays.has(d.day)) openDays.delete(d.day); else openDays.add(d.day); renderConcrete(); };
    list.appendChild(el);
  });
  if(days.length>cDayMax){
    const b=document.createElement("button"); b.className="more"; b.type="button";
    const left=days.length-cDayMax;
    b.textContent=left===1?"הצג עוד יום אחד":"הצג עוד "+left+" ימים"; b.onclick=()=>{cDayMax+=20; renderConcrete();}; list.appendChild(b);
  }
}
export function openConcreteDetail(id){
  const c=curConcrete().find(x=>x.id===id); if(!c) return;
  const psrc=c.photoAsset?"/_blob/"+c.photoAsset:c.photoUrl;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="תעודת בטון">'
    +'<div class="grab"></div><h2>'+esc(c.supplier||"בטון")+' · '+esc(c.noteNo||"—")+'</h2>'
    +'<div class="kv"><span>תאריך <b>'+esc(fmtDT(c.dateText)||"")+'</b></span><span>כמות <b>'+fmtM3(Number(c.m3)||0)+' מ״ק</b></span>'
    +(c.mix?'<span>סוג <b>'+esc(c.mix)+'</b></span>':'')+(c.truck?'<span>משאית <b>'+esc(c.truck)+'</b></span>':'')+'</div>'
    +(c.element?'<div class="note-card">נוצק ב: <b>'+esc(c.element)+'</b></div>':'')
    +(c.note?'<div class="legend">'+esc(c.note)+'</div>':'')
    +(psrc?'<img class="dphoto" src="'+psrc+'" alt="צילום התעודה">':'')
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button>'+(psrc?'<button class="ghost" type="button" id="cnPdf" style="flex:1">PDF</button>':'')+(c.demo?'':'<button class="del" type="button" id="cnDel" style="flex:0 0 auto">מחק</button>')+'</div></div>');
  const close=closer(scrim);
  scrim.querySelector(".cancel").onclick=close;
  const cpdf=scrim.querySelector("#cnPdf");
  if(cpdf) cpdf.onclick=async()=>{ cpdf.disabled=true; cpdf.textContent="מכין…"; await exportNotePdf([psrc],"בטון-"+(c.noteNo||c.id)+".pdf","בטון "+(c.noteNo||"")); cpdf.disabled=false; cpdf.textContent="PDF"; };
  const del=scrim.querySelector("#cnDel");
  if(del) del.onclick=async()=>{
    if(!(await ask("למחוק את תעודת הבטון "+(c.noteNo||"")+"?"))) return;
    try{ if(shared.DB) await shared.DB.collection("concrete").doc(c.id).delete(); else { shared.concrete=shared.concrete.filter(x=>x.id!==c.id); ls.set("concrete",JSON.stringify(shared.concrete)); renderConcrete(); renderOverview(); } }
    catch(e){ toast("המחיקה נכשלה."); return; }
    logAct("concrete","delete","נמחקה תעודת בטון "+(c.noteNo||"")+" · "+fmtM3(Number(c.m3)||0)+" מ״ק",c.id,null,{...c,photoUrl:""});
    close();
  };
}
export function __init(){
/* ================= בטון ================= */
DEMO_CONCRETE = [
  {id:"dc1",supplier:"עמי-רן בטון בע\"מ",noteNo:"227254",dateText:"08/10/2026",ts:Date.now()-86400000*4,m3:8,mix:"ב-30",element:"שדה 2 שורה 15",truck:"ערבל 80",note:"",demo:true},
  {id:"dc2",supplier:"עמי-רן בטון בע\"מ",noteNo:"227253",dateText:"08/10/2026",ts:Date.now()-86400000*4,m3:8,mix:"ב-30",element:"שדה 2 שורה 15",truck:"ערבל 78",note:"",demo:true},
  {id:"dc3",supplier:"עמי-רן בטון בע\"מ",noteNo:"227120",dateText:"30/09/2026",ts:Date.now()-86400000*12,m3:8,mix:"ב-30",element:"שדה 3 שורה 19",truck:"ערבל 60",note:"",demo:true},
];
shared.concrete=[];
concreteQ = "";
cDayMax = 20;
openDays = new Set();
$("#cList").onclick=e=>{ const b=e.target.closest(".truck[data-cid]"); if(b) openConcreteDetail(b.dataset.cid); };
$("#cSearch").oninput=e=>{ concreteQ=e.target.value.trim().toLowerCase(); cDayMax=20; $("#cClr").hidden=!concreteQ; renderConcrete(); };
$("#cClr").onclick=()=>{ $("#cSearch").value=""; concreteQ=""; $("#cClr").hidden=true; renderConcrete(); };
if($("#ovGoConcrete")) $("#ovGoConcrete").onclick=()=>showTab("concrete");
$("#btnConcreteCsv").onclick=async()=>{
  const rows=curConcrete().slice().sort((a,b)=>a.ts-b.ts);
  if(!rows.length){ toast("אין תעודות בטון לייצוא."); return; }
  const head=["תאריך","מספר תעודה","ספק","מ\"ק","סוג","נוצק ב","משאית","הערות"];
  const lines=[head.join(",")].concat(rows.map(c=>[c.dateText,c.noteNo,c.supplier,c.m3,c.mix,c.element,c.truck,c.note]
    .map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")));
  const csv="﻿"+lines.join("\r\n");
  const name="בטון-"+new Date().toISOString().slice(0,10)+".csv";
  if(shared.DOWNLOADS){
    try{ await shared.DOWNLOADS.save({filename:name,data:new Blob([csv],{type:"text/csv"})}); return; }
    catch(e){ if(!(e && e.code==="declined")) toast("הייצוא לא זמין כאן כרגע."); return; }
  }
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=name; a.click();
};
}
