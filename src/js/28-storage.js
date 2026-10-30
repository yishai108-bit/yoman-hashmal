import { $, esc, shared } from "./core.js";
import { fmtN } from "./01-stock.js";
import { isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { openStatusEntry, statusCalc, statusHolidays } from "./16-status.js";
import { ROLE } from "./18-identity.js";
import { openWorkReport } from "./21-work.js";
import { currentLayout, zoomTo } from "./24-site-stages.js";
/* ================= אגירה: כרטיס פרק ח ומטריצת המכולות =================
   הקבלן ביקש «חלק של אגירה». הסעיפים כבר בפרק האגירה של ההסכם (תשתית, כבלי מ״ג, מ״נ ותקשורת, צריכה ובקרה, בדיקות);
   הכרטיס מסכם אותם, והמטריצה מראה מכולה-מכולה מה נעשה בסעיפים שנספרים לפי מכולה (חיווט, שרשור סוללות, איטום פתחים…).
   התא נצבע מדיווח ביצוע שהאזור שלו מזכיר את מספר המכולה («מכולה 3», «מכולות 1–4»); לחיצה על תא ריק פותחת דיווח
   על אותו סעיף ואותה מכולה, ועל תא מסומן את הדיווח עצמו. אין כאן נתון נפרד: הכול מהדיווחים, כמו בשאר האפליקציה.
   16-status קורא renderStorage דרך shared אחרי כל ציור של רשימת הסטטוס. */
export const STORAGE_RX=/אגירה|מכול|bess|סוללות|מצבר/i;
const SHORT={"8.1.2":"חיווט","8.5.5":"שרשור סוללות","8.5.7":"איטום פתחים","8.4.4":"תאורה"};
export function storageActs(){ return (shared.demoStock?[]:(shared.STATUS||[])).filter(a=>STORAGE_RX.test(a.group||"")||(!a.group&&STORAGE_RX.test(a.name||""))).sort((a,b)=>(a.order||0)-(b.order||0)); }
/* סעיפים שנספרים לפי מכולה: יחידות / קומפ׳ (לא מטרים) עם כמות 2–60 ושם שמזכיר מכולה או סוללות */
export function containerActs(acts){ return acts.filter(a=>/מכול|סוללות|מצבר|container|bess/i.test(a.name||"")&&Number(a.total)>=2&&Number(a.total)<=60&&!/מ׳|מ'|מטר/.test(a.unit||"")); }
export function containerCount(acts){ const C=containerActs(acts); if(C.length) return Math.max(...C.map(a=>Number(a.total))); const L=currentLayout(); return L?L.pads.filter(p=>p.kind==="bess").reduce((s,p)=>s+(p.units||0),0):0; }
export function colLabel(a){ return SHORT[a.code]||String(a.name||"").replace(/במכולות|מכולות|מכולת|מכולה/g,"").replace(/\s+/g," ").trim().slice(0,16)||a.code||"סעיף"; }
/* מספרי מכולות מטקסט: «מכולה 3», «מכולות 1–4», «מכולות 2, 5 ו-7», «BESS 12». בלי מילת מפתח אין ניחוש */
export function containerNums(text){
  const s=String(text||""), out=new Set(); const num="\\d{1,2}(?:\\s*(?:[-–]|עד)\\s*\\d{1,2})?";
  const rx=new RegExp("(?:מכולות|מכולת|מכולה|bess|container)\\s*(?:מס(?:פר|׳|')?\\s*)?#?\\s*("+num+"(?:\\s*(?:,|ו-)\\s*"+num+")*)","gi");
  let m; while((m=rx.exec(s))){ for(const part of m[1].split(/\s*(?:,|ו-)\s*/)){ const r=/(\d{1,2})(?:\s*(?:[-–]|עד)\s*(\d{1,2}))?/.exec(part); if(!r) continue; const a=+r[1], b=r[2]?+r[2]:a; for(let i=Math.min(a,b);i<=Math.max(a,b);i++) if(i>0&&i<=60) out.add(i); } }
  return [...out].sort((a,b)=>a-b);
}
/* המטריצה: שורה לכל מכולה, עמודה לכל סעיף שנספר לפי מכולה; תא = הדיווח האחרון שמזכיר את המכולה */
export function storageMatrix(){
  const acts=storageActs(), cols=containerActs(acts), N=containerCount(acts); const unplaced=[];
  if(!N||!cols.length) return {acts,cols,N,rows:[],unplaced};
  const cells={};
  cols.forEach(a=>{ let u=0; (a.daily||[]).filter(d=>Number(d.actual)>0).forEach(d=>{ const nums=containerNums(d.area); if(!nums.length){ u++; return; }
    nums.forEach(n=>{ if(n>N) return; const k=n+"|"+a.id, c=cells[k]; if(!c||c.date<d.date) cells[k]={date:d.date,entry:d}; }); }); if(u) unplaced.push({a,n:u}); });
  const rows=[]; for(let n=1;n<=N;n++) rows.push({n,name:"מכולה "+n,cells:cols.map(a=>cells[n+"|"+a.id]||null)});
  return {acts,cols,N,rows,unplaced};
}
export function renderStorage(){
  const card=$("#bessCard"), el=$("#bessBody"); if(!card||!el) return;
  const M=storageMatrix(); if(!M.acts.length){ card.hidden=true; foldSum("bess",""); el.innerHTML=""; return; } card.hidden=false;
  // סיכום הפרק: משוקלל לפי ימי עובד בהסכם, כמו האחוז הראשי; בלי ימי עובד ממוצע פשוט
  const hol=statusHolidays(), C=M.acts.map(a=>({a,c:statusCalc(a,hol)})), W=C.reduce((s,x)=>s+(Number(x.a.manDays)||0),0);
  const pct=W?C.reduce((s,x)=>s+x.c.pct*(Number(x.a.manDays)||0),0)/W:C.reduce((s,x)=>s+x.c.pct,0)/C.length;
  const done=C.filter(x=>x.c.complete).length, manPlan=C.reduce((s,x)=>s+x.c.manPlan,0), manDone=C.reduce((s,x)=>s+x.c.manDone,0);
  const full=M.rows.filter(r=>r.cells.every(Boolean)).length;
  foldSum("bess",Math.round(pct*100)+"%"+(M.N?" · "+full+"/"+M.N+" מכולות":""));
  let h='<div class="kv" style="margin-bottom:8px"><span>ביצוע <b>'+Math.round(pct*100)+'%</b>'+(W?' <small>משוקלל לפי ימי עובד</small>':'')+'</span><span>סעיפים הושלמו <b>'+done+'</b> / '+C.length+'</span>'+(manPlan||manDone?'<span>ימי עובד <b>'+fmtN(manDone)+'</b> / '+(manPlan?fmtN(manPlan):"—")+'</span>':'')+'</div>';
  // תתי-הפרק (תשתית, כבלי מ״ג, בדיקות…) לפי החלק שאחרי הנקודתיים בשם הפרק
  const subs=new Map(); C.forEach(x=>{ const g=(x.a.group||"").split(":").slice(1).join(":").trim()||x.a.group||"אגירה"; const e=subs.get(g)||{n:0,d:0,w:0,p:0}; e.n++; if(x.c.complete) e.d++; const w=Number(x.a.manDays)||1; e.w+=w; e.p+=x.c.pct*w; subs.set(g,e); });
  if(subs.size>1) h+='<div class="bess-subs">'+[...subs.entries()].map(([g,e])=>'<div><span>'+esc(g)+'</span><b>'+Math.round(e.p/e.w*100)+'%</b><small>'+e.d+' / '+e.n+' סעיפים</small></div>').join("")+'</div>';
  if(M.N&&M.cols.length){
    h+='<div class="sechead" style="margin-top:10px"><span>מכולה-מכולה</span><span>'+full+' / '+M.N+' הושלמו</span></div>'
      +'<div class="bess-wrap"><table class="bess"><thead><tr><th>מכולה</th>'+M.cols.map(a=>'<th title="'+esc((a.code?a.code+" · ":"")+a.name)+'"><span class="code">'+esc(a.code||"")+'</span>'+esc(colLabel(a))+'</th>').join("")+'</tr></thead><tbody>'
      +M.rows.map(r=>'<tr><th>'+r.n+'</th>'+r.cells.map((c,i)=>'<td><button type="button" class="cell'+(c?' on':'')+'" data-n="'+r.n+'" data-a="'+esc(M.cols[i].id)+'" aria-label="'+esc(r.name+" · "+colLabel(M.cols[i])+(c?" · בוצע "+isoText(c.date):" · טרם"))+'">'+(c?'✓':'')+'</button></td>').join("")+'</tr>').join("")
      +'</tbody></table></div>'
      +'<div class="hint">תא מסומן = דיווח ביצוע שהאזור שלו מזכיר את המכולה («מכולה 3», «מכולות 1–4»). לחיצה על תא ריק פותחת דיווח על הסעיף והמכולה; על תא מסומן, את הדיווח.</div>';
    if(M.unplaced.length) h+='<div class="bess-unp">'+M.unplaced.map(u=>'<button type="button" class="linkbtn" data-unp="'+esc(u.a.id)+'">'+u.n+' דיווחים ב-'+esc(u.a.code||u.a.name)+' בלי מספר מכולה · לרשימה ›</button>').join("")+'</div>';
  } else if(!M.cols.length) h+='<div class="hint">אין בפרק סעיפים שנספרים לפי מכולה (יחידות עם «מכולה» או «סוללות» בשם), לכן אין מטריצה.</div>';
  h+='<button class="ghost" type="button" id="bessZoom" style="width:100%;margin-top:10px">האגירה באיור: זום למכולות</button>';
  el.innerHTML=h;
  el.querySelectorAll(".cell").forEach(b=>b.onclick=()=>{ if(ROLE==="viewer") return; const a=(shared.STATUS||[]).find(x=>x.id===b.dataset.a); if(!a) return; const n=+b.dataset.n;
    const row=M.rows[n-1], cell=row&&row.cells[M.cols.findIndex(x=>x.id===a.id)];
    if(cell) openWorkReport({activityId:a.id,entry:cell.entry}); else openWorkReport({activityId:a.id,area:"מכולה "+n,qty:1,date:shared.dayISO}); });
  el.querySelectorAll("[data-unp]").forEach(b=>b.onclick=()=>{ const a=(shared.STATUS||[]).find(x=>x.id===b.dataset.unp); if(a) openStatusEntry(a); });
  const z=el.querySelector("#bessZoom"); if(z) z.onclick=()=>{ const L=currentLayout(), p=L&&L.pads.find(x=>x.kind==="bess"), sc=$("#stagesCard"); if(sc) sc.scrollIntoView({behavior:"smooth",block:"start"}); if(p) zoomTo(p.id); };
}
export function __init(){ shared.renderStorage=renderStorage; }
