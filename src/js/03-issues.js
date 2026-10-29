import { $, ask, closer, esc, fmtD, logAct, ls, popup, shared, toast } from "./core.js";
import { DEMO_COUNTS, DEMO_MOVES, DEMO_NOTES, catGuess, fmtN, loadImg, noteFlags, renderStock, shortName, stockRows } from "./01-stock.js";
import { SITE, saveFile } from "./08-settings.js";
import { buildPdf, canvasBlob } from "./09-doc-scanner.js";
import { openBarcodeScanner } from "./10-barcode.js";
import { isoOf } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { dailySummaryText } from "./21-work.js";
export let nowText, newId, recSig, recSigned, isoDay, fileSafe, siteShort, issueFileName, siteLabel, BRAND;
/* ---- חתימה ---- */
export function sigPad(box){
  const c=box.querySelector("canvas"); const g=c.getContext("2d");
  let drawing=false, has=false, last=null;
  function fit(){ const r=box.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
    c.width=Math.round(r.width*dpr); c.height=Math.round(r.height*dpr); g.setTransform(dpr,0,0,dpr,0,0);
    g.lineWidth=2.4; g.lineCap="round"; g.lineJoin="round"; g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#111"; }
  fit();
  const pos=e=>{ const r=c.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; };
  c.onpointerdown=e=>{ drawing=true; last=pos(e); c.setPointerCapture(e.pointerId); e.preventDefault(); };
  c.onpointermove=e=>{ if(!drawing) return; const p=pos(e); g.beginPath(); g.moveTo(last.x,last.y); g.lineTo(p.x,p.y); g.stroke(); last=p; has=true; box.classList.add("has"); e.preventDefault(); };
  c.onpointerup=c.onpointercancel=()=>{ drawing=false; };
  box.querySelector(".clr2").onclick=()=>{ g.clearRect(0,0,c.width,c.height); has=false; box.classList.remove("has"); };
  return { has:()=>has, blob:()=>new Promise(r=>c.toBlob(r,"image/png")), dataUrl:()=>c.toDataURL("image/png") };
}
/* ---- ניפוק חומרים: פריטים מהמלאי, כמות לכל אחד, למי, וחתימת המקבל ---- */
export function openIssue(preset){
  const whos=[...new Set((shared.demoStock?DEMO_MOVES:shared.moves).map(m=>m.who).filter(Boolean))];
  const rows=stockRows().filter(r=>r.name&&r.cat!=="tools");
  const byName=new Map(rows.map(r=>[r.name,r]));
  let lines=preset?[{name:preset,qty:""}]:[];
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ניפוק חומרים">'
    +'<div class="grab"></div><h2>ניפוק חומרים</h2>'
    +'<div class="f"><label for="isQ">פריטים</label><div class="search" style="margin-bottom:8px"><input type="text" id="isQ" placeholder="חפש פריט במלאי והוסף" autocomplete="off"><span class="ico">⌕</span></div>'
      +'<div class="stock" id="isSug"></div><div class="kitrows" id="isRows" style="margin-top:8px"></div><div class="hint" id="isHint"></div></div>'
    +'<div class="f"><label for="isWho">למי</label><input type="text" id="isWho" list="isWhoList" placeholder="צוות, עובד או קבלן משנה" autocomplete="off">'
      +'<datalist id="isWhoList">'+whos.map(w=>'<option value="'+esc(w)+'"></option>').join("")+'</datalist></div>'
    +'<div class="f"><label for="isBy">מנפיק</label><input type="text" id="isBy" placeholder="השם שלך" autocomplete="off" value="'+esc(ls.get("issuer")||"")+'"></div>'
    +'<div class="f"><label>חתימת המקבל</label><div class="sig" id="isSig"><canvas></canvas><div class="hint2">חותמים כאן באצבע</div><button class="clr2" type="button">נקה</button></div></div>'
    +'<div class="f"><label for="isNote">הערה</label><input type="text" id="isNote" placeholder="למשל: אזור ממירים, שורות 15–16"></div>'
    +'<div class="acts"><button class="save" id="isSave" type="button" disabled>שמור ניפוק</button><button class="cancel" id="isCancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim);
  const q=s=>scrim.querySelector(s);
  const pad=sigPad(q("#isSig"));
  function drawRows(){
    const box=q("#isRows"); box.innerHTML="";
    lines.forEach((l,i)=>{
      const r=byName.get(l.name); const bal=r?(r.counted!==null?r.counted:r.derived):null;
      const el=document.createElement("div"); el.className="kitrow";
      el.innerHTML='<div><div class="nm">'+esc(l.name)+'</div><div class="per">'+(bal!=null?'במלאי '+fmtN(bal)+' '+esc(r.unit||""):'לא במלאי')+'</div></div>'
        +'<input type="text" inputmode="decimal" value="'+esc(l.qty)+'" aria-label="כמות" placeholder="כמות">'
        +'<button class="x" type="button" aria-label="הסר">×</button>';
      el.children[1].oninput=e=>{ lines[i].qty=e.target.value; check(); };
      el.children[2].onclick=()=>{ lines.splice(i,1); drawRows(); check(); };
      box.appendChild(el);
    });
    q("#isHint").textContent=lines.length?"":"מחפשים פריט ומוסיפים. אפשר כמה פריטים בניפוק אחד.";
  }
  function check(){
    const any=lines.some(l=>Number(l.qty)>0);
    const okBy=!!q("#isBy").value.trim();
    q("#isSave").disabled=!(any && q("#isWho").value.trim() && okBy);
    q("#isBy").style.borderColor=okBy?"":"var(--clay)";
  }
  q("#isQ").oninput=e=>{
    const t=e.target.value.trim().toLowerCase(); const sug=q("#isSug"); sug.innerHTML="";
    if(!t) return;
    const hits=rows.filter(r=>!lines.some(l=>l.name===r.name)&&r.name.toLowerCase().includes(t)).slice(0,6);
    hits.forEach(r=>{ const b=document.createElement("button"); b.type="button"; b.className="slip";
      b.innerHTML='<b>'+esc(r.name)+'</b><span>הוסף לניפוק</span>';
      b.onclick=()=>{ lines.push({name:r.name,qty:""}); q("#isQ").value=""; sug.innerHTML=""; drawRows(); check(); const ins=q("#isRows").lastElementChild; if(ins) ins.querySelector("input").focus(); };
      sug.appendChild(b); });
    if(!hits.length){ const b=document.createElement("button"); b.type="button"; b.className="slip"; b.innerHTML='<b>'+esc(e.target.value.trim())+'</b><span>פריט שלא רשום במלאי · הוסף בכל זאת</span>';
      b.onclick=()=>{ lines.push({name:q("#isQ").value.trim(),qty:""}); q("#isQ").value=""; sug.innerHTML=""; drawRows(); check(); }; sug.appendChild(b); }
  };
  q("#isWho").oninput=check; q("#isBy").oninput=check;
  q("#isCancel").onclick=close;
  q("#isSave").onclick=async()=>{
    const b=q("#isSave");
    if(!pad.has()){
      const go=await ask("לשמור ניפוק בלי חתימת המקבל?","שמור בלי חתימה","var(--amber)","בלי חתימה אין הוכחה שהמקבל קיבל את הכמות. הניפוק יסומן «ללא חתימה» בכל הדוחות.");
      if(!go) return;
    }
    b.disabled=true; b.textContent="שומר…";
    const who=q("#isWho").value.trim(), by=q("#isBy").value.trim(), note=q("#isNote").value.trim();
    if(by) ls.set("issuer",by);
    const ts=Date.now(), id="is"+ts;
    const chosen=lines.filter(l=>Number(l.qty)>0).map((l,i)=>{ const r=byName.get(l.name); return {code:"l"+i,name:l.name,qty:Number(l.qty),unit:r&&r.unit||"יח'",cat:r&&r.cat||catGuess(l.name)}; });
    const slip={id,ts,who,by,note,lines:chosen,sigAsset:"",sigUrl:"",source:"app"};
    if(pad.has()){
      let up=false;
      try{ if(shared.ASSETS){ const bl=await pad.blob(); const a=await shared.ASSETS.upload(bl); slip.sigAsset=a.id; slip.sigUrl=a.url; up=true; } }catch(e){}
      if(!up){ try{ slip.sigData=pad.dataUrl(); }catch(e){} }
    }
    const mv=chosen.map(l=>({id:id+"_"+l.code,item:l.name,qty:l.qty,dir:"out",who,by,ts,unit:l.unit,cat:l.cat,source:"issue",issueId:id,note}));
    try{
      if(shared.DB){ await shared.DB.doc("issues/"+id).set(slip); for(const m of mv) await shared.DB.doc("moves/"+m.id).set(m); }
      else { shared.issues.push(slip); ls.set("issues",JSON.stringify(shared.issues)); shared.moves.push(...mv); ls.set("moves",JSON.stringify(shared.moves)); }
    }catch(e){ b.disabled=false; b.textContent="שמור ניפוק"; toast("השמירה נכשלה. נסה שוב."); return; }
    logAct("issue","add","ניפוק ל"+who+" · "+chosen.length+" פריטים · "+(pad.has()?"חתום":"ללא חתימה"),id,by);
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderStock(); toast("הניפוק נשמר.");
    openSlip(slip);
  };
  drawRows(); check();
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
export function slipText(s){
  const d=new Date(s.ts);
  return "ניפוק חומרים · "+fmtD(d)+" "+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})
    +"\nל: "+(s.who||"")+(s.by?" · מנפיק: "+s.by:"")
    +"\n"+(s.lines||[]).map(l=>l.name+": "+fmtN(l.qty)).join("\n")
    +(s.note?"\nהערה: "+s.note:"")
    +"\nחתימת המקבל: "+((s.sigAsset||s.sigUrl||s.sigData)?"יש":"אין");
}
export async function copyText(t){
  try{ await navigator.clipboard.writeText(t); toast("הועתק. אפשר להדביק בוואטסאפ."); return true; }
  catch(e){
    const ta=document.createElement("textarea"); ta.value=t; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta);
    ta.select(); let ok=false; try{ ok=document.execCommand("copy"); }catch(e2){}
    ta.remove(); toast(ok?"הועתק. אפשר להדביק בוואטסאפ.":"לא הצלחתי להעתיק. סמן את הטקסט והעתק ידנית."); return ok;
  }
}
export function openSlip(s){
  const sig=s.sigAsset?"/_blob/"+s.sigAsset:(s.sigUrl||s.sigData||"");
  const d=new Date(s.ts);
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="תעודת ניפוק">'
    +'<div class="grab"></div><h2>ניפוק · '+esc(s.who||"")+'</h2>'
    +'<div class="kv"><span>'+fmtD(d)+' '+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})+'</span>'
      +(s.by?'<span>מנפיק <b>'+esc(s.by)+'</b></span>':'')
      +'<span>'+(s.sigAsset||s.sigUrl?'<b style="color:var(--sage)">חתום</b>':'<b style="color:var(--clay)">ללא חתימה</b>')+'</span></div>'
    +(s.note?'<div class="note-card">'+esc(s.note)+'</div>':'')
    +'<div class="dlines">'+(s.lines||[]).map(l=>'<div><span>'+esc(l.name)+'</span><b>'+fmtN(l.qty)+'</b></div>').join("")+'</div>'
    +(sig?'<img class="sigimg" src="'+sig+'" alt="חתימת המקבל" style="margin-top:14px">':'')
    +'<div class="acts"><button class="save" type="button" id="slCopy">העתק לוואטסאפ</button><button class="ghost" type="button" id="slPdf">PDF</button><button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim);
  scrim.querySelector(".cancel").onclick=close;
  scrim.querySelector("#slCopy").onclick=()=>copyText(slipText(s));
  scrim.querySelector("#slPdf").onclick=e=>issuePdfById(s.id,e.currentTarget);
}
export function renderSlips(){
  const list=(shared.demoStock?[]:shared.issues).slice().sort((a,b)=>b.ts-a.ts);
  $("#slipWrap").hidden=!list.length;
  const ie=$("#isEmpty"); if(ie) ie.hidden=!!list.length;
  const ib=$("#isBig"); if(ib) ib.textContent=fmtN(list.filter(s=>s.ts>=Date.now()-7*864e5).length);
  $("#slipCount").textContent=list.length?list.length+" ניפוקים":"";
  foldSum("slips",list.length?list.length+" ניפוקים · "+list.filter(x=>!(x.sigAsset||x.sigUrl||x.sigData)).length+" ללא חתימה":"");
  const box=$("#slipList"); box.innerHTML="";
  list.slice(0,5).forEach(s=>{
    const b=document.createElement("button"); b.type="button"; b.className="slip";
    const d=new Date(s.ts);
    b.innerHTML='<b>'+esc(s.who||"")+'</b>'
      +'<span class="sigok" style="'+((s.sigAsset||s.sigUrl||s.sigData)?'background:var(--sage-soft);color:var(--sage)':'background:var(--clay-soft);color:var(--clay)')+'">'+((s.sigAsset||s.sigUrl||s.sigData)?'חתום':'ללא חתימה')+'</span>'
      +'<span>'+fmtD(d)+' · '+(s.lines||[]).length+' פריטים · '+fmtN((s.lines||[]).reduce((t,l)=>t+(Number(l.qty)||0),0))+' יח׳'+(s.by?' · '+esc(s.by):'')+'</span>';
    b.onclick=()=>openSlip(s);
    box.appendChild(b);
  });
  if(list.length){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent=(list.length>5?"כל הניפוקים ("+list.length+")":"כל הניפוקים")+" · PDF לתקופה"; m.onclick=()=>openAllSlips(list); box.appendChild(m); }
}
export function openAllSlips(list){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="כל הניפוקים"><div class="grab"></div><h2>כל הניפוקים</h2><div id="asRange"></div><div class="stock" id="asList"></div>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  issueRangeBox(scrim.querySelector("#asRange"));
  const box=scrim.querySelector("#asList");
  list.forEach(s=>{ const b=document.createElement("button"); b.type="button"; b.className="slip"; const d=new Date(s.ts);
    b.innerHTML='<b>'+esc(s.who||"")+'</b><span class="sigok" style="'+((s.sigAsset||s.sigUrl||s.sigData)?'background:var(--sage-soft);color:var(--sage)':'background:var(--clay-soft);color:var(--clay)')+'">'+((s.sigAsset||s.sigUrl||s.sigData)?'חתום':'ללא חתימה')+'</span><span>'+fmtD(d)+' · '+(s.lines||[]).length+' פריטים'+(s.by?' · '+esc(s.by):'')+'</span>';
    b.onclick=()=>openSlip(s); box.appendChild(b); });
  scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
}
export function issueRecs(){
  const a=(shared.demoStock?[]:shared.issues).map(s=>({kind:"mat",id:s.id,ts:s.ts,who:s.who||"",by:s.by||"",lines:(s.lines||[]).map(l=>({name:l.name,qty:l.qty})),note:s.note||"",sig:recSig(s),signed:recSigned(s)}));
  const b=(shared.demoStock?[]:shared.moves).filter(m=>m.dir==="out"&&m.source!=="issue").map(m=>({kind:"tool",id:m.id,ts:m.ts,who:m.who||"",by:m.by||"",lines:[{name:m.item,qty:m.qty}],note:m.note||"",sig:recSig(m),signed:recSigned(m)}));
  const all=a.concat(b).sort((x,y)=>x.ts-y.ts||String(x.id).localeCompare(String(y.id))); all.forEach((r,i)=>r.no=i+1); return all;
}
export async function sigImg(src){ if(!src) return null; try{ const res=await fetch(src); if(!res.ok) return null; return await loadImg(await res.blob()); }catch(e){ return null; } }
export async function issuePage(r){
  const W=1240,H=1754; const c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  x.fillStyle="#fff"; x.fillRect(0,0,W,H); x.direction="rtl"; x.textAlign="right"; const R=W-80, Lx=80;
  const d=new Date(r.ts); const dt=d.getDate()+"."+(d.getMonth()+1)+"."+d.getFullYear()+" "+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});
  x.fillStyle=BRAND; x.fillRect(0,0,W,14); x.font="700 30px Alef, Arial"; x.fillText(SITE.company||"S.E.E",R,80);
  x.fillStyle="#121212"; x.font="700 44px Alef, Arial"; x.fillText((r.kind==="tool"?"ניפוק כלי עבודה":"ניפוק חומרים")+" · מס׳ "+r.no,R,140);
  x.fillStyle="#666B6E"; x.font="400 26px Alef, Arial"; x.fillText(SITE.name+" · "+dt,R,185);
  x.fillStyle="#121212"; x.font="700 34px Alef, Arial"; x.fillText("מקבל: "+(r.who||"—"),R,250);
  let y=292; x.font="400 26px Alef, Arial"; x.fillStyle="#3F4447";
  if(r.by){ x.fillText("מנפיק: "+r.by,R,y); y+=38; }
  y+=40; const SIG=H-520;
  x.fillStyle="#F2F2F2"; x.fillRect(Lx,y-36,W-160,50); x.fillStyle="#121212"; x.font="700 24px Alef, Arial";
  x.fillText("#",R-10,y); x.fillText("פריט",R-80,y); x.textAlign="left"; x.fillText("כמות",Lx+20,y); x.textAlign="right";
  y+=44; const L=r.lines||[];
  for(let i=0;i<L.length;i++){
    if(y>SIG-40){ x.fillStyle="#666B6E"; x.font="400 22px Alef, Arial"; x.fillText("ועוד "+(L.length-i)+" פריטים (ברשימה ביומן)",R,y); y+=36; break; }
    if(i%2){ x.fillStyle="#FAFAFA"; x.fillRect(Lx,y-30,W-160,42); }
    x.fillStyle="#121212"; x.font="400 24px Alef, Arial"; x.fillText(String(i+1),R-10,y);
    let nm=String(L[i].name||""); while(nm.length>4&&x.measureText(nm).width>820) nm=nm.slice(0,-2); if(nm!==String(L[i].name||"")) nm+="…";
    x.fillText(nm,R-80,y); x.textAlign="left"; x.font="700 24px Alef, Arial"; x.fillText(fmtN(L[i].qty),Lx+20,y); x.textAlign="right";
    y+=42;
  }
  x.fillStyle="#121212"; x.font="700 26px Alef, Arial"; x.fillText("סה״כ "+L.length+" פריטים · "+fmtN(L.reduce((t,l)=>t+(Number(l.qty)||0),0))+" יחידות",R,y+10);
  if(r.note){ x.font="400 24px Alef, Arial"; x.fillStyle="#3F4447"; let n="הערה: "+r.note; while(n.length>8&&x.measureText(n).width>W-160) n=n.slice(0,-2); x.fillText(n,R,y+54); }
  x.fillStyle="#121212"; x.font="700 28px Alef, Arial"; x.fillText("חתימת המקבל",R,SIG);
  x.strokeStyle="#B5B8BA"; x.lineWidth=2; x.strokeRect(Lx,SIG+20,W-160,280);
  const im=r.signed?await sigImg(r.sig):null;
  if(im){ const bw=W-200, bh=250; const k=Math.min(bw/im.naturalWidth,bh/im.naturalHeight); const w=im.naturalWidth*k, h=im.naturalHeight*k; x.drawImage(im,Lx+20+(bw-w)/2,SIG+35+(bh-h)/2,w,h); }
  else { x.fillStyle="#C8442C"; x.font="700 30px Alef, Arial"; x.textAlign="center"; x.fillText(r.signed?"החתימה לא נטענה":"ללא חתימה",W/2,SIG+170); x.textAlign="right"; }
  x.fillStyle="#666B6E"; x.font="400 20px Alef, Arial"; x.fillText("הופק מיומן חשמל · "+fmtD(Date.now()),R,H-70);
  const jb=await canvasBlob(c,0.85); return {bytes:new Uint8Array(await jb.arrayBuffer()),w:W,h:H};
}
export async function issuesPdf(list,name,title){
  try{ await document.fonts.load("700 28px Alef"); await document.fonts.load("400 24px Alef"); }catch(e){}
  try{ const pages=[]; for(const r of list) pages.push(await issuePage(r)); return await saveFile(name,await buildPdf(pages,title)); }
  catch(e){ toast("יצירת ה-PDF נכשלה."); return false; }
}
export async function issuePdfById(id,btn){
  const r=issueRecs().find(x=>x.id===id); if(!r){ toast("הניפוק לא נמצא."); return; }
  const t=btn&&btn.textContent; if(btn){ btn.disabled=true; btn.textContent="מכין…"; }
  await issuesPdf([r],issueFileName(r),"ניפוק "+r.no);
  if(btn){ btn.disabled=false; btn.textContent=t; }
}
export function issueRangeBox(host){
  const now=new Date(), wk=new Date(now); wk.setDate(now.getDate()-6);
  host.innerHTML='<div class="card" style="padding:12px;margin-bottom:12px"><h3 style="font-size:.95rem">PDF של הניפוקים החתומים לתקופה</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><input type="date" id="irFrom" aria-label="מתאריך" value="'+isoDay(wk)+'"><input type="date" id="irTo" aria-label="עד תאריך" value="'+isoDay(now)+'"></div>'
    +'<div class="hint" id="irHint" style="margin-top:6px"></div><button class="ghost" type="button" id="irGo" style="width:100%;margin-top:8px">הורד PDF לתקופה</button></div>';
  const q=s=>host.querySelector(s);
  const pick=()=>{ const f=q("#irFrom").value, t=q("#irTo").value; const all=issueRecs().filter(r=>{ const k=isoDay(r.ts); return (!f||k>=f)&&(!t||k<=t); }); return {f,t,all,sig:all.filter(r=>r.signed)}; };
  const hint=()=>{ const p=pick(); q("#irHint").textContent=p.sig.length+" ניפוקים חתומים (חומרים וכלים), עמוד לכל ניפוק"+(p.all.length>p.sig.length?" · "+(p.all.length-p.sig.length)+" ללא חתימה לא נכללים":""); q("#irGo").disabled=!p.sig.length; };
  q("#irFrom").onchange=hint; q("#irTo").onchange=hint; hint();
  q("#irGo").onclick=async()=>{ const p=pick(); if(!p.sig.length) return; const b=q("#irGo"); b.disabled=true; b.textContent="מכין "+p.sig.length+" עמודים…";
    const ok=await issuesPdf(p.sig,[siteShort(),"ניפוקים-חתומים",p.f||"התחלה","עד",p.t||isoDay(Date.now())].join("_")+".pdf","ניפוקים חתומים");
    b.textContent="הורד PDF לתקופה"; hint(); if(ok) logAct("issue","add","PDF ניפוקים חתומים · "+p.sig.length+" עמודים",""); };
}
/* ---- ספירה מהירה ---- */
export function openQuickCount(){
  const rows=stockRows(); const byName=new Map(rows.map(r=>[r.name,r]));
  let items=[];
  const vals={};      // יחידות בודדות
  const boxes={};     // קרטונים
  const perBox={};    // יחידות באריזה
  const total=n=>{ const loose=Number(vals[n]); const bx=Number(boxes[n]); const pb=Number(perBox[n]);
    const hasLoose=String(vals[n]??"").trim()!==""&&isFinite(loose); const hasBox=String(boxes[n]??"").trim()!==""&&isFinite(bx)&&bx>0&&pb>0;
    if(!hasLoose&&!hasBox) return null; return (hasLoose?loose:0)+(hasBox?bx*pb:0); };
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ספירה מהירה">'
    +'<div class="grab"></div><h2>ספירה מהירה</h2>'
    +'<div class="note-card">מחפשים פריט ומוסיפים לספירה. סופרים אריזות סגורות, לא יחידות: <b>אריזות × כמות באריזה + יחידות בודדות</b>. הפער מול התיאורטי מחושב תוך כדי. שורה ריקה לא נשמרת.</div>'
    +'<button class="scanbtn" type="button" id="qcScan" style="margin-bottom:10px"><i class="ic ic-scan"></i>ספירה בסריקת ברקודים</button>'
    +'<div class="search" style="margin-bottom:10px"><input type="text" id="qcSearch" placeholder="חפש פריט לספירה" autocomplete="off" aria-label="חיפוש פריט"><span class="ico">⌕</span></div>'
    +'<div class="stock" id="qcSug" style="margin-bottom:10px"></div>'
    +'<div class="kitrows" id="qcRows"></div>'
    +'<div class="f" style="margin-top:14px"><label for="qcWho">מי ספר</label><input type="text" id="qcWho" placeholder="השם שלך" value="'+esc(ls.get("issuer")||"")+'"></div>'
    +'<div class="acts"><button class="save" id="qcSave" type="button" disabled>שמור ספירה</button><button class="cancel" id="qcCancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim);
  const q=s=>scrim.querySelector(s);
  function gapText(n){
    const r=byName.get(n); const t=total(n); if(t==null||!r||r.noIn) return "";
    const g=t-r.derived; return g===0?'<span style="color:var(--sage);font-weight:800">תואם לתיאורטי</span>':'<span class="gap">פער '+(g>0?"+":"−")+fmtN(Math.abs(g))+' מול תיאורטי '+fmtN(r.derived)+'</span>';
  }
  function draw(){
    const box=q("#qcRows"); box.innerHTML="";
    items.forEach((n,i)=>{
      const r=byName.get(n); const r0=document.createElement("div"); r0.className="kitrow"; r0.style.gridTemplateColumns="minmax(0,1fr) 44px";
      const cur = !r ? "לא במלאי" : r.counted!==null ? "נספר "+fmtN(r.counted)+" ב-"+fmtD(r.countedTs)+(r.noIn?"":" · תיאורטי "+fmtN(r.derived))
        : r.noIn ? "יצא "+fmtN(r.out)+" · ללא קליטה" : "תיאורטי "+fmtN(r.derived);
      r0.innerHTML='<div><div class="nm">'+esc(n)+'</div><div class="per">'+cur+'</div>'
        +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px">'
          +'<input type="text" inputmode="numeric" placeholder="אריזות" aria-label="אריזות" value="'+esc(boxes[n]??"")+'" data-k="box">'
          +'<input type="text" inputmode="numeric" placeholder="באריזה" aria-label="כמות באריזה" value="'+esc(perBox[n]??"")+'" data-k="per">'
          +'<input type="text" inputmode="numeric" placeholder="בודדים" aria-label="יחידות בודדות" value="'+esc(vals[n]??"")+'" data-k="loose">'
        +'</div><div class="per" style="margin-top:6px" data-k="sum"></div></div>'
        +'<button class="x" type="button" aria-label="הסר">×</button>';
      const upd=()=>{ const t=total(n); r0.querySelector('[data-k="sum"]').innerHTML=(t==null?"":'<b>סה״כ '+fmtN(t)+'</b> · ')+gapText(n); check(); };
      r0.querySelector('[data-k="box"]').oninput=e=>{ boxes[n]=e.target.value; upd(); };
      r0.querySelector('[data-k="per"]').oninput=e=>{ perBox[n]=e.target.value; upd(); };
      r0.querySelector('[data-k="loose"]').oninput=e=>{ vals[n]=e.target.value; upd(); };
      r0.lastElementChild.onclick=()=>{ items.splice(i,1); delete vals[n]; delete boxes[n]; draw(); check(); };
      box.appendChild(r0); upd();
    });
  }
  function check(){ const okWho=!!q("#qcWho").value.trim(); q("#qcSave").disabled=!(items.some(n=>total(n)!=null)&&okWho); q("#qcWho").style.borderColor=okWho?"":"var(--clay)"; }
  q("#qcWho").oninput=check;
  q("#qcSearch").oninput=e=>{
    const t=e.target.value.trim().toLowerCase(); const sug=q("#qcSug"); sug.innerHTML="";
    if(!t) return;
    rows.filter(r=>!items.includes(r.name)&&r.name.toLowerCase().includes(t)).slice(0,6).forEach(r=>{
      const b=document.createElement("button"); b.type="button"; b.className="slip"; b.innerHTML='<b>'+esc(r.name)+'</b><span>הוסף לספירה</span>';
      b.onclick=()=>{ items.unshift(r.name); q("#qcSearch").value=""; sug.innerHTML=""; draw(); };
      sug.appendChild(b);
    });
  };
  q("#qcScan").onclick=()=>openBarcodeScanner({mode:"count",onDone:res=>{
    res.forEach(h=>{ if(!h.item) return; const n=h.item.name; if(!items.includes(n)) items.unshift(n); boxes[n]=(Number(boxes[n])||0)+h.n; if(!perBox[n]&&Number(h.per)>0) perBox[n]=Number(h.per); });
    draw(); check(); if(res.some(h=>!h.item)) toast("ברקודים לא מזוהים לא נספרו. הצמד אותם לפריט בסריקה הבאה.");
  }});
  q("#qcCancel").onclick=close;
  q("#qcSave").onclick=async()=>{
    const b=q("#qcSave"); b.disabled=true; b.textContent="שומר…";
    const who=q("#qcWho").value.trim(); if(!who){ b.disabled=false; b.textContent="שמור ספירה"; toast("מי ספר? צריך שם."); return; } ls.set("issuer",who);
    const ts=Date.now(); const recs=[];
    items.forEach((n,i)=>{ const t=total(n); if(t==null) return;
      const r=byName.get(n); const bx=Number(boxes[n])||0, pb=Number(perBox[n])||0;
      recs.push({id:"c"+ts+"_"+i,item:n,qty:t,who,ts,cat:r?r.cat:catGuess(n),unit:r?r.unit:"יח'",source:"app",
        note:(bx&&pb?bx+" אריזות × "+pb+(Number(vals[n])?" + "+Number(vals[n])+" בודדים":""):"")}); });
    try{
      if(shared.DB){ for(const c of recs) await shared.DB.doc("counts/"+c.id).set(c); }
      else { shared.counts.push(...recs); ls.set("counts",JSON.stringify(shared.counts)); }
    }catch(e){ b.disabled=false; b.textContent="שמור ספירה"; toast("השמירה נכשלה."); return; }
    const gaps=recs.map(r=>{ const row=byName.get(r.item); return row&&!row.noIn?{n:shortName(r.item),g:r.qty-row.derived}:null; }).filter(x=>x&&x.g!==0);
    logAct("count","add","ספירה: "+recs.length+" פריטים"+(gaps.length?" · פערים: "+gaps.slice(0,4).map(x=>x.n+" "+(x.g>0?"+":"−")+fmtN(Math.abs(x.g))).join(", "):" · הכל תואם"),"c"+ts,who);
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderStock(); toast("נשמרו "+recs.length+" ספירות.");
  };
  draw();
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
/* ---- סיכום לוואטסאפ ---- */
export function periodSummary(days){
  const to=Date.now(), from=to-days*86400000;
  const inP=x=>x.ts>=from&&x.ts<=to;
  const notes=(shared.demoStock?DEMO_NOTES:shared.deliveries).filter(n=>n.source!=="bom").filter(inP);
  const mv=(shared.demoStock?DEMO_MOVES:shared.moves).filter(inP);
  const iss=(shared.demoStock?[]:shared.issues).filter(inP);
  
  const L=[];
  L.push("*יומן חשמל · "+siteLabel()+"* · סיכום "+days+" ימים ("+fmtD(from)+" – "+fmtD(to)+")");
  // deliveries
  const sups=new Map(); notes.forEach(n=>{ const k=(n.supplier||"ספק לא ידוע").trim(); sups.set(k,(sups.get(k)||0)+1); });
  const topS=[...sups.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k.replace(/ בע"מ.*$/,"").replace(/\s*\(.*?\)/g,"")+" ("+v+")");
  L.push(""); L.push("*משלוחים:* "+notes.length+" תעודות מ-"+sups.size+" ספקים"+(topS.length?" · "+topS.join(", "):""));
  const big=notes.flatMap(n=>(n.lines||[]).map(l=>({...l,sup:n.supplier}))).filter(l=>/שנאי|ממיר|MVS|RMU|גנרטור|מכולה|לוח|תוף/i.test(l.name)).slice(0,4);
  big.forEach(l=>L.push("  - "+l.name+" × "+fmtN(l.qty)));
  // issues
  const outQ=mv.filter(m=>m.dir==="out").reduce((s,m)=>s+(Number(m.qty)||0),0);
  L.push(""); L.push("*ניפוקים:* "+mv.filter(m=>m.dir==="out").length+" שורות, "+fmtN(outQ)+" יחידות"+(iss.length?" · "+iss.filter(i=>i.sigAsset||i.sigUrl).length+" מתוך "+iss.length+" ניפוקים חתומים":""));
  // flags
  const fl=notes.filter(n=>{const f=noteFlags(n); return f.issue||f.ret;});
  L.push(""); L.push("*דורש בדיקה:* "+(fl.length?fl.length+" תעודות":"אין"));
  fl.slice(0,6).forEach(n=>{ const f=noteFlags(n); L.push("  - "+(n.supplier||"")+" · "+(n.noteNo||"")+" · "+(f.issue?"חוסר/פגום":"החזרה לספק")+(n.note?" · "+n.note.slice(0,60):"")); });
  // counts
  const cnt=(shared.demoStock?DEMO_COUNTS:shared.counts).filter(inP);
  if(cnt.length) L.push("", "*ספירות:* "+cnt.length+" פריטים נספרו");
  return L.join("\n");
}
/* סיכום לוואטסאפ: «יום» = הסיכום היומי לפי התבנית (עובדים, הגיע, כבלים, ניפוקים, בוצע, מול תכנון, חריגים); 7/14/30 = סיכום תקופה של המלאי */
export function openWa(){
  let days=0; const dayIso=shared.dayISO||isoOf(Date.now());
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="סיכום לוואטסאפ"><div class="grab"></div><h2>סיכום לוואטסאפ</h2>'
    +'<div class="chips" id="waChips"><button type="button" class="chip2" data-d="0" aria-pressed="true">סיכום יומי</button>'+[7,14,30].map(d=>'<button type="button" class="chip2" data-d="'+d+'" aria-pressed="false">'+d+' ימים</button>').join("")+'</div>'
    +'<div class="f" id="waDayF"><label for="waDate">ליום</label><input type="date" id="waDate" value="'+esc(dayIso)+'"></div>'
    +'<textarea class="watext" id="waText" readonly></textarea>'
    +'<div class="hint" style="margin-top:6px">אפשר לערוך את הטקסט לפני ההעתקה. בלי שמות עובדים ובלי מחירים.</div>'
    +'<div class="acts"><button class="save" type="button" id="waCopy">העתק</button><button class="cancel" type="button">סגור</button></div></div>');
  const ta=scrim.querySelector("#waText"); ta.readOnly=false;
  const gen=()=>{ scrim.querySelector("#waDayF").hidden=days>0; ta.value=days?periodSummary(days):dailySummaryText(scrim.querySelector("#waDate").value||dayIso); };
  scrim.querySelector("#waDate").onchange=gen;
  scrim.querySelector("#waChips").onclick=e=>{ const b=e.target.closest("[data-d]"); if(!b) return; days=Number(b.dataset.d);
    scrim.querySelectorAll(".chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); gen(); };
  scrim.querySelector("#waCopy").onclick=()=>copyText(ta.value);
  scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  gen();
}
export function __init(){
/* ================= ניפוקים, ספירה וסיכום לוואטסאפ ================= */
shared.issues=[];
nowText = ()=>fmtD()+" "+new Date().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});
newId = p=>p+Date.now()+Math.random().toString(36).slice(2,6);
/* ---- PDF לניפוק: עמוד לכל ניפוק (חומרים או כלי עבודה) עם החתימה. בלי ת.ז. ובלי מחירים ---- */
recSig = r=>r.sigAsset?"/_blob/"+r.sigAsset:(r.sigUrl||r.sigData||"");
recSigned = r=>!!(r.sigAsset||r.sigUrl||r.sigData);
isoDay = t=>{ const d=new Date(t); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
fileSafe = t=>String(t||"").replace(/[\\/:*?"<>|]/g,"").trim().replace(/\s+/g,"-");
siteShort = ()=>fileSafe(siteLabel())||"אתר";
siteLabel = ()=>String(SITE.name||"").replace(/^(אתר הקמה|S\.E\.E\s*·)\s*/,"").trim();
BRAND = "#F2B03D";
issueFileName = r=>[siteShort(),isoDay(r.ts),fileSafe(r.who)||"ללא-שם",r.no].join("_")+".pdf";
$("#btnIssue").onclick=openIssue;
if($("#ovNewIssue")) $("#ovNewIssue").onclick=openIssue;
$("#btnCount").onclick=openQuickCount;
$("#btnWa").onclick=openWa;
}
