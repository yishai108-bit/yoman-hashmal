import { $, esc, shared } from "./core.js";
import { noteFlags, realNotes } from "./01-stock.js";
import { showTab } from "./08-settings.js";
/* ================= התרעות בראש הדף ================= */
export function renderAlerts(){
  const box=$("#ovAlerts"); if(!box) return;
  box.innerHTML="";
  if(shared.demoStock){ box.hidden=true; return; }
  const P=[];
  // תעודות עם חוסר, פגם או החזרה: כסף שצריך לוודא שחזר
  const fl=realNotes().filter(n=>{ const f=noteFlags(n); return f.issue||f.ret; });
  if(fl.length) P.push({n:fl.length,u:"תעודות",b:"תעודות משלוח שדורשות בדיקה",s:"חוסר, פריט פגום או החזרה לספק. כל אחת היא כסף שצריך לוודא שחזר.",tab:"stock",card:"check"});
  // ניפוקים בלי חתימה ב-7 הימים האחרונים
  const wk=Date.now()-7*864e5, uns=shared.issues.filter(i=>i.ts>=wk&&!(i.sigAsset||i.sigUrl||i.sigData));
  if(uns.length) P.push({n:uns.length,u:"ניפוקים",b:"ניפוקים בלי חתימת המקבל השבוע",s:"בלי חתימה אין הוכחה שהחומר נמסר. כדאי להחתים בניפוק הבא.",tab:"issues",card:"slips"});
  if(!P.length){ box.hidden=true; return; }
  P.slice(0,3).forEach(p=>{
    const b=document.createElement("div"); b.className="alert"; b.setAttribute("role","button"); b.tabIndex=0;
    b.innerHTML='<div class="n">'+p.n+'<small>'+esc(p.u)+'</small></div><div><b>'+esc(p.b)+'</b><span class="dt">'+esc(p.s)+'</span></div><button type="button" class="go" aria-label="פתח">‹</button>';
    const go=()=>{ showTab(p.tab); const c=document.querySelector('.card[data-fold="'+p.card+'"]'); if(c){ c.classList.remove("folded"); c.scrollIntoView({behavior:"smooth",block:"start"}); } };
    b.onclick=e=>{ if(e.target.closest(".go")) go(); else b.classList.toggle("open"); };
    b.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); b.classList.toggle("open"); } };
    box.appendChild(b);
  });
  box.hidden=false;
}
export function __init(){

}
