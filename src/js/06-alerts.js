import { $, esc, shared } from "./core.js";
import { noteFlags, realNotes } from "./01-stock.js";
import { showTab } from "./08-settings.js";
import { REMAIN_WARN, drumOpen, drumRemain } from "./20-cables.js";
import { blockerAge, isClaim } from "./21-work.js";
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
  // תופים שנסגרו עם שארית חריגה ב-14 הימים האחרונים: משיכות שלא נרשמו
  const dr=(shared.drums||[]).filter(d=>d.status==="empty"&&(d.closedAt||0)>=Date.now()-14*864e5&&d.lengthIn&&(Number(d.remainderAtClose)||0)/d.lengthIn>REMAIN_WARN);
  if(dr.length) P.push({n:dr.length,u:"תופים",b:"תופים שנגמרו עם שארית לא מוסברת",s:dr.slice(0,3).map(d=>"תוף "+d.drumNo+": "+Math.round(d.remainderAtClose)+" מ׳").join(" · ")+". כנראה משיכות שלא נרשמו; לבדוק עם הצוות.",tab:"cables",card:"cdrums"});
  // תופים פתוחים שנשאר בהם מעט
  const low=(shared.drums||[]).filter(d=>drumOpen(d)&&d.status==="inUse"&&d.lengthIn&&drumRemain(d)<Math.max(50,d.lengthIn*0.1));
  if(low.length) P.push({n:low.length,u:"תופים",b:"תופים שעומדים להיגמר",s:low.slice(0,3).map(d=>"תוף "+d.drumNo+": נשארו "+Math.round(drumRemain(d))+" מ׳").join(" · ")+". לסגור כשנגמרים, כדי שהשארית תיבדק.",tab:"cables",card:"cdrums"});
  // חריגים שפתוחים יותר משלושה ימים: מה שתוקע את העבודה ולא נסגר
  const old=(shared.blockers||[]).filter(b=>b.status!=="closed"&&!isClaim(b)&&blockerAge(b)>3);
  if(old.length) P.unshift({n:old.length,u:"חריגים",b:"חריגים פתוחים יותר משלושה ימים",s:old.slice(0,3).map(b=>b.text.slice(0,50)+" ("+blockerAge(b)+" ימים)").join(" · ")+". לסגור, או להחליט מי מטפל.",tab:"over",card:"blk"});
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
