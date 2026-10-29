import { $, ls, popup, shared } from "./core.js";
import { openProgress } from "./04-contractors.js";
import { showTab } from "./08-settings.js";
import { copyCrew, isoOf, renderDay } from "./11-daylog.js";
import { ROLE } from "./18-identity.js";
/* ================= ניקיון ממשק ================= */
export function tidyUI(){
  // 1. פעולות משניות → «עוד»
  document.querySelectorAll(".view").forEach(v=>{
    const rows=[...v.children].filter(c=>c.classList.contains("row2"));
    if(!rows.length) return;
    const btns=rows.flatMap(r=>[...r.querySelectorAll("button")]).filter(b=>!b.dataset.dup);
    const hold=document.createElement("div"); hold.hidden=true; btns.forEach(b=>hold.appendChild(b));
    const more=document.createElement("button"); more.type="button"; more.className="morebtn"; more.textContent="פעולות נוספות ⋯";
    rows[0].replaceWith(more); rows.slice(1).forEach(r=>r.remove()); v.appendChild(hold);
    more.onclick=()=>{
      const ok=btns.filter(b=>{ const w=b.dataset.w; return !w||(w==="edit"&&ROLE!=="viewer")||(w==="owner"&&ROLE==="owner"); });
      const scrim=popup('<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><h2>פעולות</h2><div class="stock" id="mList"></div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
      const L=scrim.querySelector("#mList");
      ok.forEach(b=>{ const it=document.createElement("button"); it.type="button"; it.className="slip"; it.innerHTML='<b></b>'; it.querySelector("b").textContent=b.textContent.replace(/\s+/g," ").trim(); it.onclick=()=>{ scrim.remove(); b.click(); }; L.appendChild(it); });
      scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
    };
  });
  // 2. הסברים → ⓘ
  document.querySelectorAll(".view .card").forEach(c=>{
    const h=c.querySelector(":scope>h3"), n=c.querySelector(":scope>.note"); if(!h||!n) return;
    n.classList.add("tip"); const i=document.createElement("button"); i.type="button"; i.className="info"; i.setAttribute("aria-label","הסבר"); i.textContent="ⓘ";
    i.onclick=e=>{ e.stopPropagation(); c.classList.toggle("show-tip"); }; h.appendChild(i);
  });
  document.querySelectorAll(".view .foot").forEach(f=>{ f.innerHTML='<details><summary>איך זה עובד</summary><div style="margin-top:6px">'+f.innerHTML+'</div></details>'; });
  // 3. קיפול
  let folds={}; try{ folds=JSON.parse(ls.get("folds")||"{}"); }catch(e){}
  document.querySelectorAll(".card[data-fold]").forEach(c=>{
    const k=c.dataset.fold, h=c.querySelector(":scope>h3"); if(!h) return;
    const sum=document.createElement("span"); sum.className="sum"; sum.id="sum_"+k; const ch=document.createElement("span"); ch.className="chev"; ch.textContent="‹";
    h.appendChild(sum); h.appendChild(ch);
    const def=c.dataset.open?false:true; if(folds[k]===undefined?def:folds[k]) c.classList.add("folded");
    h.onclick=()=>{ c.classList.toggle("folded"); folds[k]=c.classList.contains("folded"); ls.set("folds",JSON.stringify(folds)); };
  });
}
export function foldSum(k,t){ const e=$("#sum_"+k); if(e) e.textContent=t||""; }
/* 6. הצעה לפי השעה */
export function renderTodayTip(){
  const box=$("#todayTip"); if(!box) return;
  box.hidden=true; box.innerHTML="";
  if(ROLE==="viewer"||shared.demoStock) return;
  const now=new Date(), h=now.getHours(), iso=isoOf(now.getTime()), dis=ls.get("tipOff")||"";
  let tip=null;
  if(h>=6&&h<11&&!shared.daylog.some(w=>w.date===iso)&&dis!==iso+"day") tip={k:"day",t:"בוקר טוב. לרשום את הצוות של היום?",go:"העתק מאתמול",fn:()=>{ showTab("day"); shared.dayISO=iso; renderDay(); copyCrew(); }};
  else if(h>=14&&h<21&&!shared.progress.some(p=>isoOf(p.ts)===iso)&&dis!==iso+"prog") tip={k:"prog",t:"סוף יום. כמה שולחנות התקדמו היום?",go:"דיווח ביצוע",fn:()=>openProgress()};
  if(!tip) return;
  box.innerHTML='<div class="tip-today"><span></span><button type="button" class="go"></button><button type="button" class="x" aria-label="לא עכשיו">✕</button></div>';
  box.querySelector("span").textContent=tip.t; box.querySelector(".go").textContent=tip.go;
  box.querySelector(".go").onclick=()=>{ ls.set("tipOff",iso+tip.k); tip.fn(); renderTodayTip(); };
  box.querySelector(".x").onclick=()=>{ ls.set("tipOff",iso+tip.k); renderTodayTip(); };
  box.hidden=false;
}
export function __init(){

}
