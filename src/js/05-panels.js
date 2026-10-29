import { $, closer, esc, fmtD, fmtDT, logAct, ls, popup, shared, toast } from "./core.js";
import { CATS, fmtN, openMove, openNote, renderOverview, renderStock, stockRows } from "./01-stock.js";
import { openIssue, openQuickCount } from "./03-kit.js";
import { kitStats } from "./04-contractors.js";
import { openOrder } from "./14-cba.js";
export let curPb, prevPb, N, FAB_LABEL;
   // panelMoves: קבלות/העברות פאנלים בין אתרים אחרי המאזן האחרון
export function pbEffective(b){
  if(!b) return null; const e={...b,brokenReasons:(b.brokenReasons||[]).map(r=>({...r})),takenOut:(b.takenOut||[]).map(t=>({...t})),arrBroken:0,liveNotes:[]};
  (shared.demoStock?[]:shared.panelMoves).filter(m=>m.ts>b.ts).sort((x,y)=>x.ts-y.ts).forEach(m=>{
    const q=N(m.qty), br=Math.min(q,N(m.broken)), pl=N(m.pallets);
    if(m.dir==="out"){ e.takenOut.push({site:m.site||"אתר אחר",pallets:pl,qty:q}); e.closed=N(e.closed)-q; e.liveNotes.push("−"+fmtN(q)+" ל"+(m.site||"אתר אחר")+" ("+(fmtDT(m.dateText)||fmtD(m.ts))+")"); }
    else { e.received=N(e.received)+q; e.receivedPallets=N(e.receivedPallets)+pl; e.closed=N(e.closed)+q-br; e.broken=N(e.broken)+br; e.arrBroken+=br;
      if(br) e.brokenReasons.push({reason:"הגיעו שבורים מ"+(m.site||"אתר אחר")+" ("+(fmtDT(m.dateText)||fmtD(m.ts))+")",qty:br});
      e.liveNotes.push("+"+fmtN(q)+" מ"+(m.site||"אתר אחר")+(pl?" · "+fmtN(pl)+" משטחים":"")+(br?" · "+fmtN(br)+" שבור"+(br>1?"ים":"")+" בהגעה":"")+" ("+(fmtDT(m.dateText)||fmtD(m.ts))+")"); }
  });
  e.closed=Math.max(0,N(e.closed)); return e;
}
export function pbCalc(b,prev){
  const onSite=N(b.closed)+N(b.singles)+N(b.installed)+N(b.scattered)+N(b.broken);
  const taken=(b.takenOut||[]).reduce((s,t)=>s+N(t.qty),0);
  const takenPallets=(b.takenOut||[]).reduce((s,t)=>s+N(t.pallets),0);
  const spare=onSite-N(b.required);
  const usable=onSite-N(b.broken)-N(b.required);
  const gap=onSite-(N(b.received)-taken);          // ספירה מול קבלה פחות מה שיצא
  const brokenSum=(b.brokenReasons||[]).reduce((s,r)=>s+N(r.qty),0);
  const toInstall=Math.max(0,N(b.required)-N(b.installed));
  const r={onSite,taken,takenPallets,spare,usable,gap,brokenSum,toInstall,pct:N(b.required)?N(b.installed)/N(b.required):0,
    tablesImplied:N(b.installed)/shared.PANELS_PER_TABLE};
  if(prev){
    const days=Math.max(1,(b.ts-prev.ts)/86400000);
    r.days=days; r.dInst=N(b.installed)-N(prev.installed); r.dBroken=N(b.broken)-N(b.arrBroken)-N(prev.broken);
    r.perDay=r.dInst/days;
    r.breakRate=r.dInst>0?Math.max(0,r.dBroken)/r.dInst:null;         // שבורים לכל פאנל שהותקן
    r.expBroken=r.breakRate!=null?r.breakRate*toInstall:null;
    r.projected=r.expBroken!=null?usable-r.expBroken:null;            // ספייר צפוי בסוף
    r.daysLeft=r.perDay>0?toInstall/r.perDay:null;
  }
  return r;
}
export function renderPanelBal(){
  const card=$("#pbCard"); if(!card) return;
  const b=curPb(), pv=prevPb();
  const stats=$("#pbStats"), mc=$("#pbMoneyCard"), bb=$("#pbBroken");
  if(!b){ $("#pbBig").textContent="—"; $("#pbBigCap").textContent="אין עדיין מאזן פאנלים"; $("#pbSub").innerHTML='הזן פעם אחת: הוזמנו, התקבלו, מותקנים, שבורים, יצאו לאתרים אחרים. מכאן והלאה האפליקציה מחשבת ספייר, קצב וצפי.';
    stats.innerHTML=""; mc.hidden=true; $("#pbDate").textContent=""; $("#pbBar").innerHTML=""; $("#pbKeys").innerHTML=""; $("#pbLines").innerHTML=""; return; }
  const c=pbCalc(b,pv);
  // כותרת: המספר שחשוב באמת
  const today=c.usable;   // המספר הראשי: כמה חסרים היום (באתר פחות שבורים פחות נדרש)
  $("#pbBig").textContent=(today<0?"−":"+")+fmtN(Math.abs(Math.round(today)));
  $("#pbBig").style.color=today<0?"var(--pv)":"var(--sage)";
  $("#pbBigCap").textContent=today<0?"פאנלים חסרים היום":"פאנלים ספייר היום";
  $("#pbSub").innerHTML='באתר <b>'+fmtN(c.onSite)+'</b> מול <b>'+fmtN(N(b.required))+'</b> בתכנון, <b>'+fmtN(N(b.broken))+'</b> שבורים. נכון ל-'+esc(fmtDT(b.dateText)||fmtD(b.ts))+'.'
    +(c.projected!=null&&c.projected<0?' <span style="color:var(--ink3)">בקצב השבירה הנוכחי ('+(c.breakRate*100).toFixed(1)+'% מהמותקנים) יחסרו כ-<b>'+fmtN(Math.round(-c.projected))+'</b> בסוף.</span>':'');
  stats.innerHTML=
     '<div class="stat"><div class="v num" style="display:flex;align-items:center;gap:8px">'+ringHtml(c.pct,"info")+fmtN(N(b.installed))+'</div><div class="k">מותקנים · '+Math.round(c.pct*100)+'% מהתכנון</div></div>'
    +'<div class="stat"><div class="v num">'+(c.perDay?fmtN(Math.round(c.perDay)):"—")+'</div><div class="k">'+(c.perDay?'ליום · סיום '+fmtD(b.ts+c.daysLeft*86400000):'קצב ליום (צריך שני מאזנים)')+'</div></div>'
    +'<div class="stat"><div class="v num" style="color:var(--pv)">'+fmtN(N(b.broken))+'</div><div class="k">שבורים'+(c.dBroken>0?' · +'+fmtN(c.dBroken)+' ב-'+Math.round(c.days)+' ימים':'')+'</div></div>';
  // מה חשוב: רק שורות עם כסף או החלטה
  bb.innerHTML=""; const items=[];
  if(c.usable<0) items.push(["pv","חסרים היום "+fmtN(-c.usable)+" פאנלים לסיום האתר","באתר פחות שבורים פחות נדרש. להזמין ספייר"+(c.projected!=null&&c.projected<0?"; בקצב השבירה הנוכחי עוד ~"+fmtN(Math.round(c.expBroken))+" יישברו עד הסוף, סה״כ כ-"+fmtN(Math.round(-c.projected))+"":"")+". פאנלים מהיצרן זה שבועות."]);
  else if(c.projected!=null&&c.projected<0) items.push(["amber","היום יש ספייר, אבל בקצב השבירה הנוכחי יחסרו ~"+fmtN(Math.round(-c.projected))+" בסוף","עוד ~"+fmtN(Math.round(c.expBroken))+" צפויים להישבר עד סוף ההתקנה ("+fmtN(c.toInstall)+" נותרו)."]);
  (b.brokenReasons||[]).slice().sort((x,y)=>N(y.qty)-N(x.qty)).forEach(r=>{
    const q=N(r.qty); if(!q) return; const t=String(r.reason||"");
    if(/נפל|משטח על הצד/.test(t)) items.push(["amber",q+" פאנלים ממשטח שנפל: מי הפיל?","אם זה מלגזן של הקבלן או המוביל, זאת תביעה אחת של "+q+" פאנלים. בלי שם, זה עלינו."]);
    else if(/עאטף|קבלן/.test(t)) items.push(["amber",q+" נשברו אצל הקבלן: תביעה","לרשום לקבלן בחשבון החודשי, עם תאריך ומספרים סידוריים."]);
    else if(/התגלו/.test(t)) items.push(["info",q+" התגלו שבורים בפתיחת משטחים","תביעה מול הספק או המוביל רק עם צילום בפתיחה. בלי צילום, זה עלינו."]);
  });
  if(c.gap) items.push(["info","פער "+(c.gap>0?"+":"−")+fmtN(Math.abs(c.gap))+" בין קבלה לספירה","התקבלו "+fmtN(N(b.received))+", יצאו "+fmtN(c.taken)+", נספרו "+fmtN(c.onSite)+". בדיקה אחת סוגרת את זה."]);
  mc.hidden=!items.length;
  items.forEach(([cls,t,sub])=>{ const d=document.createElement("div"); d.className="flag"+(cls==="amber"?" ret":""); if(cls==="info") d.style.borderInlineStartColor="var(--info-fill)";
    d.innerHTML='<div class="t"><b>'+esc(t)+'</b><span>'+esc(sub)+'</span></div>'; bb.appendChild(d); });
  // המאזן המלא
  $("#pbDate").textContent="נכון ל-"+(fmtDT(b.dateText)||fmtD(b.ts))+((b.liveNotes||[]).length?" + "+b.liveNotes.length+" תנועות אחריו":"");
  const sp=c.spare;
  const segs=[["בריכוז, משטחים סגורים",N(b.closed),"var(--sage-fill)"],["בודדים בריכוז",N(b.singles),"var(--ink3)"],["מותקנים",N(b.installed),"var(--info-fill)"],["מפוזרים בשטח",N(b.scattered),"var(--amber-fill)"],["שבורים",N(b.broken),"var(--pv)"]].filter(x=>x[1]>0);
  const bar=$("#pbBar"), keys=$("#pbKeys"); bar.innerHTML=""; keys.innerHTML="";
  segs.forEach(([l,v,col])=>{ const sg=document.createElement("span"); sg.style.flex=v; sg.style.background=col; sg.title=l+" · "+fmtN(v); bar.appendChild(sg);
    const k=document.createElement("span"); k.innerHTML='<i style="background:'+col+'"></i>'+l+'<b class="num">'+fmtN(v)+'</b>'; keys.appendChild(k); });
  const L=[];
  const row=(l,v,cls)=>'<div class="'+(cls||"")+'"><span>'+l+'</span><b>'+v+'</b></div>';
  if(N(b.ordered)) L.push(row("הוזמנו לאתר",fmtN(N(b.ordered))));
  L.push(row("התקבלו באתר"+(N(b.receivedPallets)?" · "+fmtN(N(b.receivedPallets))+" משטחים":""),fmtN(N(b.received))));
  (b.takenOut||[]).forEach(t=>L.push(row("יצאו ל"+esc(t.site||"אתר אחר")+(N(t.pallets)?" · "+fmtN(N(t.pallets))+" משטחים":""),"−"+fmtN(N(t.qty)),"neg")));
  L.push(row("<b>באתר לפי ספירה</b>",fmtN(c.onSite)));
  if(c.gap) L.push(row("פער בין קבלה פחות יציאות לבין הספירה",(c.gap>0?"+":"−")+fmtN(Math.abs(c.gap)),"neg"));
  L.push(row("נדרש לפי התכנון"+(N(b.requiredPallets)?" · "+fmtN(N(b.requiredPallets))+" משטחים":""),fmtN(N(b.required))));
  L.push(row("<b>ספייר</b> (באתר פחות נדרש)",(sp<0?"−":"+")+fmtN(Math.abs(sp)),sp<0?"neg":""));
  L.push(row("ספייר בלי השבורים",(c.usable<0?"−":"+")+fmtN(Math.abs(c.usable)),c.usable<0?"neg":""));
  if(pv&&c.dInst>0){
    L.push(row("<b>מאז "+esc(fmtDT(pv.dateText)||fmtD(pv.ts))+"</b>: הותקנו · "+fmtN(Math.round(c.perDay))+" ליום","+"+fmtN(c.dInst)));
    L.push(row("נשברו באותה תקופה · "+(c.breakRate*100).toFixed(1)+"% מהמותקנים","+"+fmtN(c.dBroken),c.dBroken>0?"neg":""));
    if(c.expBroken!=null) L.push(row("צפי שבורים עד סוף ההתקנה ("+fmtN(c.toInstall)+" נותרו להתקין)","−"+fmtN(Math.round(c.expBroken)),"neg"));
    if(c.projected!=null) L.push(row("<b>ספייר צפוי בסוף</b>",(c.projected<0?"−":"+")+fmtN(Math.abs(Math.round(c.projected))),c.projected<0?"neg":""));
  }
  L.push(row("שולחנות עם פאנלים (לפי "+shared.PANELS_PER_TABLE+" לשולחן)","~"+fmtN(Math.floor(c.tablesImplied))));
  if(!shared.demoStock){ const KK=kitStats(); if(!KK.doneProxy&&KK.donePan) L.push(row("שולחנות עם פאנלים לפי דיווחי ביצוע"+(KK.donePan>Math.floor(c.tablesImplied)+2?" · יותר מהמאזן: לעדכן מאזן":""),fmtN(KK.donePan))); }
  (b.brokenReasons||[]).forEach(r=>{ if(N(r.qty)) L.push(row("שבורים: "+esc(r.reason),fmtN(N(r.qty)),"neg")); });
  if(b.note) L.push(row(esc(b.note),""));
  (b.liveNotes||[]).forEach(t=>L.push(row("<b>מאז המאזן:</b> "+esc(t),"")));
  $("#pbLines").innerHTML=L.join("");
}
export function openPanelBal(){
  const cur=curPb()||{};   // כולל תנועות אחרי המאזן: המספרים המוצעים הם המצב העדכני
  let reasons=(cur.brokenReasons||[]).map(r=>({...r})); if(!reasons.length) reasons=[{reason:"",qty:""}];
  let taken=(cur.takenOut||[]).map(t=>({...t})); if(!taken.length) taken=[{site:"",pallets:"",qty:""}];
  const today=new Date(); const iso=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const F=(id,l,v,hint)=>'<div class="pricerow"><div class="nm">'+l+(hint?'<small>'+hint+'</small>':'')+'</div><input type="text" inputmode="numeric" id="'+id+'" value="'+esc(v??"")+'"></div>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="עדכון מאזן פאנלים">'
    +'<div class="grab"></div><h2>מאזן פאנלים</h2>'
    +'<div class="note-card">מספרים מהספירה בשטח. באתר = ריכוז + בודדים + מותקנים + מפוזרים + שבורים. הספייר מחושב לבד.</div>'
    +'<div class="f"><label for="pbD">נכון לתאריך</label><input type="date" id="pbD" value="'+iso+'"></div>'
    +'<div class="kitrows">'
    +F("pbInst","מותקנים",cur.installed)+F("pbClosed","בריכוז, משטחים סגורים",cur.closed,"פאנלים")+F("pbSingles","בודדים בריכוז",cur.singles)
    +F("pbScat","מפוזרים בשטח",cur.scattered)+F("pbBroken","שבורים",cur.broken)
    +'</div>'
    +'<details style="margin-top:12px"><summary class="linkbtn" style="display:inline-block">נתוני הזמנה וקבלה (משתנים רק כשמגיע משלוח)</summary><div class="kitrows" style="margin-top:8px">'
    +F("pbOrd","הוזמנו לאתר",cur.ordered)
    +F("pbReq","נדרש לפי התכנון",cur.required,"פאנלים")+F("pbReqP","נדרש · משטחים",cur.requiredPallets)
    +F("pbRec","התקבלו באתר",cur.received,"פאנלים")+F("pbRecP","התקבלו · משטחים",cur.receivedPallets)
    +F("pbPer","פאנלים במשטח",cur.perPallet||33)
    +'</div></details>'
    +'<div class="f" style="margin-top:14px"><label>שבורים לפי סיבה</label><div class="dl" id="pbReasons"></div><button class="addline" type="button" id="pbAddR" style="margin-top:8px">+ סיבה</button></div>'
    +'<div class="f"><label>יצאו לאתרים אחרים</label><div class="dl" id="pbTaken"></div><button class="addline" type="button" id="pbAddT" style="margin-top:8px">+ אתר</button></div>'
    +'<div class="f"><label for="pbNote">הערה</label><input type="text" id="pbNote" value="'+esc(cur.note||"")+'" placeholder="למשל: ספירה של ישי ויותם"></div>'
    +'<div class="f"><label for="pbBy">מי ספר</label><input type="text" id="pbBy" value="'+esc(ls.get("issuer")||"")+'" placeholder="השם שלך"></div>'
    +'<div class="acts"><button class="save" id="pbSave" type="button">שמור מאזן</button><button class="cancel" id="pbCancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim);
  const q=s=>scrim.querySelector(s);
  function drawR(){ const box=q("#pbReasons"); box.innerHTML=""; reasons.forEach((r,i)=>{ const d=document.createElement("div"); d.className="dline";
      d.innerHTML='<input type="text" placeholder="סיבה (למשל: נפל משטח על הצד)" value="'+esc(r.reason||"")+'"><button class="x" type="button" aria-label="הסר">×</button><div class="r2"><input type="text" inputmode="numeric" placeholder="כמות" value="'+esc(r.qty??"")+'"></div>';
      d.children[0].oninput=e=>{reasons[i].reason=e.target.value;}; d.children[1].onclick=()=>{reasons.splice(i,1); drawR();}; d.querySelector(".r2 input").oninput=e=>{reasons[i].qty=e.target.value;}; box.appendChild(d); }); }
  function drawT(){ const box=q("#pbTaken"); box.innerHTML=""; taken.forEach((t,i)=>{ const d=document.createElement("div"); d.className="dline";
      d.innerHTML='<input type="text" placeholder="לאן (אתר / מחסן)" value="'+esc(t.site||"")+'"><button class="x" type="button" aria-label="הסר">×</button><div class="r2"><input type="text" inputmode="numeric" placeholder="משטחים" value="'+esc(t.pallets??"")+'"><input type="text" inputmode="numeric" placeholder="פאנלים" value="'+esc(t.qty??"")+'"></div>';
      d.children[0].oninput=e=>{taken[i].site=e.target.value;}; d.children[1].onclick=()=>{taken.splice(i,1); drawT();};
      const ins=d.querySelectorAll(".r2 input"); ins[0].oninput=e=>{taken[i].pallets=e.target.value;}; ins[1].oninput=e=>{taken[i].qty=e.target.value;}; box.appendChild(d); }); }
  q("#pbAddR").onclick=()=>{ reasons.push({reason:"",qty:""}); drawR(); };
  q("#pbAddT").onclick=()=>{ taken.push({site:"",pallets:"",qty:""}); drawT(); };
  q("#pbCancel").onclick=close;
  q("#pbSave").onclick=async()=>{
    const num=id=>{ const v=Number(String(q("#"+id).value).replace(/[^\d.\-]/g,"")); return isFinite(v)?v:0; };
    const by=q("#pbBy").value.trim(); if(!by){ toast("מי ספר? צריך שם."); q("#pbBy").focus(); return; } ls.set("issuer",by);
    const dv=q("#pbD").value; let ts=Date.now(), dateText=fmtD(ts);
    if(dv){ const d=new Date(dv+"T12:00:00"); if(!isNaN(d)){ ts=d.getTime(); dateText=fmtD(ts); } }
    const id="pb"+Date.now();
    const doc={id,ts,dateText,ordered:num("pbOrd"),required:num("pbReq"),requiredPallets:num("pbReqP"),received:num("pbRec"),receivedPallets:num("pbRecP"),perPallet:num("pbPer")||33,
      closed:num("pbClosed"),singles:num("pbSingles"),installed:num("pbInst"),scattered:num("pbScat"),broken:num("pbBroken"),
      brokenReasons:reasons.filter(r=>String(r.reason).trim()&&Number(r.qty)>0).map(r=>({reason:String(r.reason).trim(),qty:Number(r.qty)})),
      takenOut:taken.filter(t=>String(t.site).trim()&&Number(t.qty)>0).map(t=>({site:String(t.site).trim(),pallets:Number(t.pallets)||0,qty:Number(t.qty)})),
      note:q("#pbNote").value.trim(),by,source:"app"};
    if(!doc.required&&!doc.received){ toast("צריך לפחות נדרש והתקבלו."); return; }
    const b=q("#pbSave"); b.disabled=true; b.textContent="שומר…";
    const c=pbCalc(doc);
    const cnt={id:"c"+ts+"_pb",item:"פאנלים סולאריים",qty:c.onSite,who:by||"—",ts,cat:"panels",unit:"יח'",source:"panelbal"};
    try{ if(shared.DB){ await shared.DB.doc("panelbal/"+id).set(doc); await shared.DB.doc("counts/"+cnt.id).set(cnt); }
         else { shared.panelBal.push(doc); ls.set("panelbal",JSON.stringify(shared.panelBal)); shared.counts.push(cnt); ls.set("counts",JSON.stringify(shared.counts)); } }
    catch(e){ b.disabled=false; b.textContent="שמור מאזן"; toast("השמירה נכשלה."); return; }
    logAct("panelbal","add","מאזן פאנלים "+dateText+": באתר "+fmtN(c.onSite)+" · מותקנים "+fmtN(doc.installed)+" · שבורים "+fmtN(doc.broken)+" · ספייר "+(c.usable<0?"−":"+")+fmtN(Math.abs(c.usable)),id,by);
    close(); renderPanelBal(); renderStock(); toast("המאזן נשמר.");
  };
  drawR(); drawT();
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
export function openPanelMove(){
  let dir="in";
  const today=new Date(); const iso=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const sites=[...new Set([...shared.panelMoves.map(m=>m.site),...shared.panelBal.flatMap(b=>(b.takenOut||[]).map(t=>t.site))].filter(Boolean))];
  const F=(id,l,v,ph,mode)=>'<div class="f"><label for="'+id+'">'+l+'</label><input type="text" id="'+id+'" value="'+esc(v??"")+'" placeholder="'+esc(ph||"")+'"'+(mode?' inputmode="'+mode+'"':'')+' autocomplete="off"></div>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="פאנלים בין אתרים"><div class="grab"></div><h2>פאנלים: הגיעו / יצאו</h2>'
    +'<div class="note-card">תנועת פאנלים בין אתרים, בלי לספור מחדש: המאזן מתעדכן לבד. ספירה מלאה עושים ב«עדכון מאזן».</div>'
    +'<div class="f"><label>כיוון</label><div class="opts" id="pmDir"><button class="opt" type="button" data-d="in" aria-pressed="true">הגיעו לאתר<small>מאתר אחר</small></button><button class="opt" type="button" data-d="out" aria-pressed="false">יצאו מהאתר<small>לאתר אחר</small></button></div></div>'
    +'<div class="f"><label for="pmSite">איזה אתר</label><input type="text" id="pmSite" list="pmSites" placeholder="למשל: אשלים" autocomplete="off"><datalist id="pmSites">'+sites.map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+F("pmPal","משטחים","","3","numeric")+F("pmQty","פאנלים","","99","numeric")+'</div>'
    +F("pmBroken","שבורים בהגעה","","0","numeric")
    +'<div class="f"><label for="pmDate">תאריך</label><input type="date" id="pmDate" value="'+iso+'"></div>'
    +F("pmBy","מי קלט",ls.get("issuer")||"","השם שלך")+F("pmNote","הערה","","מספר תעודה, נהג, מי פרק")
    +'<div class="acts"><button class="save" id="pmSave" type="button" disabled>שמור</button><button class="cancel" id="pmCancel" type="button">ביטול</button></div></div>');
  const close=closer(scrim);
  const q=x=>scrim.querySelector(x);
  q("#pmDir").onclick=e=>{ const b=e.target.closest("[data-d]"); if(!b) return; dir=b.dataset.d; q("#pmDir").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===b))); q("#pmBroken").parentElement.hidden=dir==="out"; };
  const check=()=>{ const qn=Number(q("#pmQty").value); q("#pmSave").disabled=!(isFinite(qn)&&qn>0&&q("#pmSite").value.trim()&&q("#pmBy").value.trim()); };
  q("#pmQty").oninput=check; q("#pmSite").oninput=check; q("#pmBy").oninput=check;
  q("#pmPal").oninput=e=>{ const pl=Number(e.target.value); const per=N((curPb()||{}).perPallet)||33; if(pl>0&&!q("#pmQty").value){ q("#pmQty").value=pl*per; check(); } };
  q("#pmCancel").onclick=close;
  q("#pmSave").onclick=async()=>{
    const b=q("#pmSave"); b.disabled=true; b.textContent="שומר…";
    const by=q("#pmBy").value.trim(); ls.set("issuer",by);
    const dv=q("#pmDate").value; let ts=Date.now(); if(dv){ const d=new Date(dv+"T12:00:00"); if(!isNaN(d)) ts=d.getTime(); }
    const dateText=fmtD(ts);
    const bal=shared.panelBal.slice().sort((x,y)=>y.ts-x.ts)[0]; if(bal&&ts<=bal.ts) ts=bal.ts+1;   // תנועה תמיד אחרי המאזן האחרון
    const id="pm"+Date.now();
    const doc={id,ts,dateText,dir,site:q("#pmSite").value.trim(),pallets:Number(q("#pmPal").value)||0,qty:Number(q("#pmQty").value)||0,broken:dir==="in"?Number(q("#pmBroken").value)||0:0,by,note:q("#pmNote").value.trim(),source:"app"};
    try{ if(shared.DB) await shared.DB.doc("panelmoves/"+id).set(doc); else { shared.panelMoves.push(doc); ls.set("panelmoves",JSON.stringify(shared.panelMoves)); } }
    catch(e){ b.disabled=false; b.textContent="שמור"; toast("השמירה נכשלה."); return; }
    logAct("panelbal","add",(dir==="in"?"הגיעו ":"יצאו ")+fmtN(doc.qty)+" פאנלים "+(dir==="in"?"מ":"ל")+doc.site+(doc.pallets?" · "+fmtN(doc.pallets)+" משטחים":"")+(doc.broken?" · "+fmtN(doc.broken)+" שבורים בהגעה":""),id,by);
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderPanelBal(); renderOverview(); toast("נשמר. המאזן עודכן.");
  };
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
/* ---- טבעת אחוז (בילטון) ---- */
export function ringHtml(pct,cls,label,lg){
  const p=Math.max(0,Math.min(1,Number(pct)||0)); const r=20, c=2*Math.PI*r;
  return '<span class="ring'+(cls?" "+cls:"")+(lg?" lg":"")+'" aria-hidden="true"><svg viewBox="0 0 48 48"><circle class="bg" cx="24" cy="24" r="'+r+'"></circle>'
    +'<circle class="fg" cx="24" cy="24" r="'+r+'" stroke-dasharray="'+(c*p).toFixed(1)+' '+c.toFixed(1)+'"></circle></svg><b>'+(label!=null?label:Math.round(p*100)+"%")+'</b></span>';
}
export function openFabMenu(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="פעולה"><div class="grab"></div><h2>מה עושים?</h2><div class="stock">'
    +'<button type="button" class="slip" data-k="order"><b>בקשת רכש</b><span>מה ביקשתי מהרכש, מה-BOM / EBOQ או פריט חופשי, ונסגר מול ה-PO</span></button>'
    +'<button type="button" class="slip" data-k="equip"><b>ניפוק ציוד</b><span>כלי עבודה או חומר שיוצא מהמלאי — מי לקח וכמה</span></button>'
    +'<button type="button" class="slip" data-k="bolts"><b>ניפוק ברגים</b><span>ברגים לקבלן לפי שולחנות, עם חתימת המקבל</span></button>'
    +'</div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const close=()=>scrim.remove(); scrim.querySelector(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  scrim.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{ close(); const k=b.dataset.k; if(k==="order") openOrder(); else if(k==="equip") openEquipIssue(); else openIssue(); });
}
/* ניפוק ציוד: בוחרים פריט מהמלאי (כלי עבודה וחומרים קודם) ואז הוצאה עם «מי לקח» */
export function openEquipIssue(){
  const rows=(shared.demoStock?[]:stockRows()).filter(r=>r.name); const pri={tools:0,staging:1,safety:2,electrical:3,construction:4,civil:5,containers:6,panels:7};
  rows.sort((a,b)=>(pri[a.cat]??9)-(pri[b.cat]??9)||String(a.name).localeCompare(String(b.name),"he"));
  let qtxt="";
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ניפוק ציוד"><div class="grab"></div><h2>ניפוק ציוד</h2>'
    +'<div class="search" style="margin-bottom:8px"><input type="text" id="eqQ" placeholder="חפש כלי או חומר במלאי" autocomplete="off"><span class="ico">⌕</span></div>'
    +'<div class="stock" id="eqList"></div><button class="addline" type="button" id="eqNew" style="margin-top:8px">+ פריט שלא רשום במלאי</button>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const q=x=>scrim.querySelector(x); const close=()=>scrim.remove();
  q(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  const draw=()=>{ const box=q("#eqList"); box.innerHTML=""; const t=qtxt.toLowerCase();
    const list=(t?rows.filter(r=>String(r.name).toLowerCase().includes(t)):rows).slice(0,20);
    if(!list.length){ box.innerHTML='<div class="hint">'+(rows.length?'אין פריט כזה במלאי.':'אין עדיין פריטים במלאי. קלוט תעודת משלוח או הוסף פריט חדש.')+'</div>'; return; }
    list.forEach(r=>{ const b=document.createElement("button"); b.type="button"; b.className="slip"; const bal=(Number(r.in)||0)-(Number(r.out)||0);
      b.innerHTML='<b>'+esc(r.name)+'</b><span>'+esc((CATS.find(c=>c.id===r.cat)||{}).label||"")+' · במלאי <b>'+fmtN(bal)+'</b> '+esc(r.unit||"")+'</span>'; b.onclick=()=>{ close(); openMove(r.name); }; box.appendChild(b); });
    if(!t&&rows.length>20){ const h=document.createElement("div"); h.className="hint"; h.textContent="ועוד "+(rows.length-20)+" · חפש"; box.appendChild(h); } };
  q("#eqQ").oninput=e=>{ qtxt=e.target.value.trim(); draw(); };
  q("#eqNew").onclick=()=>{ const nm=qtxt.trim(); if(!nm){ toast("כתוב את שם הפריט בחיפוש."); q("#eqQ").focus(); return; } close(); openMove(nm); };
  draw(); setTimeout(()=>q("#eqQ").focus(),60);
}
export function openStockActions(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="מלאי"><div class="grab"></div><h2>מה עושים?</h2><div class="stock">'
    +'<button type="button" class="slip" data-k="note"><b><i class="ic ic-cam"></i> קליטת תעודת משלוח</b><span>סריקה או צילום של התעודה, השורות נקראות לבד</span></button>'
    +'<button type="button" class="slip" data-k="issue"><b>ניפוק לקבלן</b><span>ברגים וחומרים שיוצאים מהמלאי לקבלן, עם חתימה</span></button>'
    +'<button type="button" class="slip" data-k="count"><b>ספירה מהירה</b><span>מה יש בפועל במלאי, פריט אחרי פריט</span></button>'
    +'</div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const close=()=>scrim.remove(); scrim.querySelector(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  scrim.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{ close(); const k=b.dataset.k; if(k==="note") openNote(); else if(k==="issue") openIssue(); else openQuickCount(); });
}
export function __init(){
/* ================= מאזן פאנלים ================= */
shared.panelBal=[];
shared.panelMoves=[];
curPb = ()=>pbEffective(shared.panelBal.slice().sort((a,b)=>b.ts-a.ts)[0]||null);
prevPb = ()=>shared.panelBal.slice().sort((a,b)=>b.ts-a.ts)[1]||null;
shared.PANELS_PER_TABLE=81;
   // שולחן 27 × 3 שורות (ניתן לשינוי בהגדרות האתר)
N = v=>Number(v)||0;
$("#pbToggle").onclick=()=>{ const f=$("#pbFull"); f.hidden=!f.hidden; $("#pbToggle").textContent=f.hidden?"הצג את כל השורות ›":"הסתר"; };
$("#btnPb").onclick=openPanelBal;
$("#btnPbMove").onclick=openPanelMove;
/* ---- כפתור פעולה ראשי (בילטון) ---- */
FAB_LABEL = "פעולה";
shared.fabTab="over";
$("#fab").onclick=()=>openFabMenu();
}
