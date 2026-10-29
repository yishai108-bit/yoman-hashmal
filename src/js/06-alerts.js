/* ================= התרעות בראש הדף ================= */
function renderAlerts(){
  const box=$("#ovAlerts"); if(!box) return;
  box.innerHTML="";
  if(demoStock){ box.hidden=true; return; }
  const P=moneyPoints().filter(p=>p.sev===3).slice(0,3);
  if(!P.length){ box.hidden=true; return; }
  P.forEach(p=>{
    const b=document.createElement("div"); b.className="alert"; b.setAttribute("role","button"); b.tabIndex=0;
    b.innerHTML='<div class="n">'+p.n+'<small>'+esc(p.u)+'</small></div><div><b>'+esc(p.b)+'</b><span class="dt">'+esc(p.s)+'</span></div><button type="button" class="go" aria-label="פתח">‹</button>';
    const go=()=>{ showTab(p.tab); if(ROLE!=="viewer"&&p.act==="progress") openProgress(); if(p.tab==="over"){ const m=$("#moneyCard"); if(m){ m.classList.remove("folded"); m.scrollIntoView({behavior:"smooth",block:"start"}); } } };
    b.onclick=e=>{ if(e.target.closest(".go")) go(); else b.classList.toggle("open"); };
    b.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); b.classList.toggle("open"); } };
    box.appendChild(b);
  });
  box.hidden=false;
}

