/* ================= קיט שלטר: ברגים לשולחן ================= */
const KIT_TYPES=[
  {id:"in27",label:"שולחן 27 פנימי (IN)",count:145},
  {id:"ex27",label:"שולחן 27 חיצוני (EX)",count:74},
  {id:"ex9", label:"שולחן 9 חיצוני (EX)", count:42},
];
const KIT_DEFAULT=[
  {code:"289",no:"943001-289",name:"בורג M12x30 (שלטר מק״ט 289)",per:{in27:60,ex27:66,ex9:24},def:true},
  {code:"013",no:"943000-013",name:"אום M12 (שלטר מק״ט 013)",per:{in27:60,ex27:66,ex9:24},def:true},
  {code:"308",no:"943001-308",name:"שייבה M12 (שלטר מק״ט 308)",per:{in27:60,ex27:66,ex9:24},def:true},
  {code:"337",no:"144999-337",name:"שייבה מרובעת (שלטר מק״ט 337)",per:{in27:40,ex27:44,ex9:16},def:true},
  {code:"087",no:"144999-087",name:"מחבר פרלין-קורה A4 (שלטר מק״ט 087)",per:{in27:60,ex27:66,ex9:24},def:true},
  {code:"188",no:"800000-188",name:"מחבר פרלין-קורה מגולוון (שלטר מק״ט 188)",per:{in27:60,ex27:66,ex9:24},def:true},
  {code:"288",no:"943001-288",name:"בורג M10x50 (שלטר מק״ט 288)",per:{in27:60,ex27:66,ex9:24},def:true},
  {code:"341",no:"144999-341-865552",name:"מחבר פרלין Vario (שלטר מק״ט 341)",per:{in27:36,ex27:30,ex9:6},def:true},
  {code:"287",no:"943001-287",name:"בורג M10x25 (שלטר מק״ט 287)",per:{in27:144,ex27:120,ex9:24},def:true},
  {code:"307",no:"943001-307",name:"שייבה M10 (שלטר מק״ט 307)",per:{in27:144,ex27:120,ex9:24},def:true},
  {code:"022",no:"943000-022",name:"אום M10 (שלטר מק״ט 022)",per:{in27:204,ex27:186,ex9:48},def:true},
  {code:"186",no:"800000-186",name:"קלאמפ אמצעי (שלטר מק״ט 186)",per:{in27:156,ex27:156,ex9:48},def:false},
  {code:"187",no:"800000-187",name:"קלאמפ קצה (שלטר מק״ט 187)",per:{in27:12,ex27:12,ex9:12},def:false},
  {code:"189",no:"800000-189",name:"אדפטר קלאמפ 60/65 (שלטר מק״ט 189)",per:{in27:168,ex27:168,ex9:60},def:false},
  {code:"926",no:"943755-926",name:"בורג קודח 5.5x25 (שלטר מק״ט 926)",per:{in27:168,ex27:168,ex9:60},def:false},
];
let kit=KIT_DEFAULT.map(k=>({...k,per:{...k.per}})), kitTypes=KIT_TYPES.map(t=>({...t})),
    kitSource="BOM שלטר 21.4.2026 ומדריך התקנה FS Duo", issues=[];
const TABLE_STEP=5;
const perOf=(l,t)=> (typeof l.per==="number") ? l.per : (Number((l.per||{})[t])||0);
const typeLabel=t=>{ const x=kitTypes.find(k=>k.id===t); return x?x.label:t; };
const nowText=()=>fmtD()+" "+new Date().toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});
const newId=p=>p+Date.now()+Math.random().toString(36).slice(2,6);

async function saveKit(lines,source,why){
  const doc={types:kitTypes,lines:lines.map(l=>({code:l.code,name:l.name,per:l.per,def:l.def!==false,carton:Number(l.carton)||0,no:l.no||(KIT_DEFAULT.find(k=>k.code===l.code)||{}).no||""})),source:source||kitSource,ts:Date.now()};
  if(DB){ await DB.doc("settings/bom").set(doc); }
  else { kit=doc.lines; kitSource=doc.source; ls.set("bom",JSON.stringify(doc)); }
  logAct("kit","edit",why||("כמויות לשולחן עודכנו · "+doc.lines.length+" פריטים · "+doc.source),"settings/bom");
}
function openKitEditor(preset){
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="ברגים לשולחן">'
    +'<div class="grab"></div><h2>כמויות לשולחן אחד</h2>'
    +'<div class="note-card">לכל סוג שולחן כמות משלו. ניפוק = שולחנות × הכמות של הסוג שנבחר. <b>מקור: '+esc(kitSource)+'</b></div>'
    +'<div class="kitrow ed hd"><div></div>'+kitTypes.map(t=>'<div class="th">'+esc(t.label.replace("שולחן ","").replace(" (IN)","").replace(" (EX)","")+(t.label.includes("(IN)")?" IN":" EX"))+'</div>').join("")+'<div></div></div>'
    +'<div class="kitrows" id="kitEd"></div>'
    +'<button class="addline" id="kitAdd" type="button" style="margin-top:8px">+ הוסף פריט</button>'
    +'<div class="f" style="margin-top:14px"><label for="kitSrc">מקור הכמויות</label><input type="text" id="kitSrc" placeholder="למשל: BOM שלטר" value="'+esc(kitSource)+'"></div>'
    +'<div class="acts"><button class="save" id="kitSave" type="button">שמור</button><button class="cancel" id="kitCancel" type="button">ביטול</button></div></div>';
  document.body.appendChild(scrim);
  const q=s=>scrim.querySelector(s);
  let lines=(preset&&preset.lines?preset.lines:kit).map(k=>({...k,per:(typeof k.per==="number")?Object.fromEntries(kitTypes.map(t=>[t.id,k.per])):{...(k.per||{})}}));
  if(preset&&preset.source) q("#kitSrc").value=preset.source;
  function draw(){
    const box=q("#kitEd"); box.innerHTML="";
    lines.forEach((l,i)=>{
      const r=document.createElement("div"); r.className="kitrow ed";
      r.innerHTML='<div><input type="text" value="'+esc(l.name)+'" placeholder="שם הפריט" aria-label="שם" style="padding:8px;font-weight:700;font-size:.84rem"></div>'
        +kitTypes.map(t=>'<input type="text" inputmode="numeric" data-t="'+t.id+'" value="'+esc(l.per[t.id]??"")+'" aria-label="'+esc(t.label)+'">').join("")
        +'<button class="x" type="button" aria-label="הסר">×</button>';
      r.children[0].firstChild.oninput=e=>{ lines[i].name=e.target.value; };
      r.querySelectorAll("input[data-t]").forEach(inp=>{ inp.oninput=e=>{ lines[i].per[e.target.dataset.t]=e.target.value; }; });
      r.lastChild.onclick=()=>{ lines.splice(i,1); draw(); };
      box.appendChild(r);
    });
  }
  q("#kitAdd").onclick=()=>{ lines.push({code:"x"+Date.now().toString(36),name:"",per:{},def:true}); draw(); };
  q("#kitCancel").onclick=()=>scrim.remove();
  scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#kitSave").onclick=async()=>{
    const ok=lines.filter(l=>String(l.name).trim()).map(l=>({code:l.code,name:String(l.name).trim(),def:l.def!==false,
      per:Object.fromEntries(kitTypes.map(t=>[t.id,Math.max(0,Number(l.per[t.id])||0)]))}))
      .filter(l=>Object.values(l.per).some(v=>v>0));
    if(!ok.length){ toast("צריך לפחות פריט אחד עם כמות."); return; }
    // שומרים כמות בקרטון שכבר נלמדה
    ok.forEach(l=>{ const old=kit.find(k=>k.code===l.code); if(old&&Number(old.carton)>0) l.carton=Number(old.carton); const src=(preset&&preset.lines||[]).find(x=>x.code===l.code); if(src&&src.no) l.no=src.no; else if(old&&old.no) l.no=old.no; });
    const changed=ok.filter(l=>{ const old=kit.find(k=>k.code===l.code); return !old||kitTypes.some(t=>perOf(old,t.id)!==l.per[t.id]); }).map(l=>shortName(l.name));
    try{ await saveKit(ok,q("#kitSrc").value.trim()||kitSource,"כמויות לשולחן"+(preset?" יובאו מ-BOM":" עודכנו")+(changed.length?": "+changed.slice(0,5).join(", ")+(changed.length>5?" ועוד "+(changed.length-5):""):"")); }catch(e){ toast("השמירה נכשלה."); return; }
    scrim.remove(); toast("הכמויות לשולחן נשמרו."); renderStock();
  };
  draw();
}

/* ---- חתימה ---- */
function sigPad(box){
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

/* ---- ניפוק לפי שולחנות ---- */
function openIssue(){
  const whos=[...new Set((demoStock?DEMO_MOVES:moves).map(m=>m.who).filter(Boolean))];
  let tables=TABLE_STEP, ttype=(ls.get("ttype")&&kitTypes.some(t=>t.id===ls.get("ttype")))?ls.get("ttype"):kitTypes[0].id;
  let lines=kit.map(k=>({...k,qty:perOf(k,ttype)*tables,on:k.def!==false}));
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="ניפוק ברגים לקבלן">'
    +'<div class="grab"></div><h2>ניפוק ברגים לקבלן</h2>'
    +'<div class="f"><label>סוג שולחן</label><div class="chips" id="isTypes" style="margin-bottom:0">'+kitTypes.map(t=>'<button type="button" class="chip2" data-t="'+t.id+'" aria-pressed="'+(t.id===ttype)+'">'+esc(t.label)+'</button>').join("")+'</div></div>'
    +'<div class="f"><label>כמה שולחנות</label><div class="stepper">'
      +'<button type="button" id="isMinus" aria-label="פחות">−</button>'
      +'<div class="val"><input type="text" inputmode="numeric" id="isTables" value="'+tables+'" aria-label="מספר שולחנות"><small>שולחנות · קפיצות של '+TABLE_STEP+'</small></div>'
      +'<button type="button" id="isPlus" aria-label="יותר">+</button></div></div>'
    +'<div class="f"><label>פריטים <button class="linkbtn" type="button" id="isKit" style="padding:0 8px;min-height:0;font-size:.8rem">ערוך כמויות לשולחן</button></label>'
      +'<button type="button" class="slip" id="isToggle"><b id="isSum"></b><span>לפי הכמויות לשולחן · לחץ כדי לראות ולתקן</span></button>'
      +'<div class="kitrows" id="isRows" hidden style="margin-top:8px"></div><div class="hint" id="isHint" hidden></div></div>'
    +'<div class="f"><label for="isWho">למי</label><input type="text" id="isWho" list="isWhoList" placeholder="הקבלן (עאטף)" autocomplete="off">'
      +'<datalist id="isWhoList">'+whos.map(w=>'<option value="'+esc(w)+'"></option>').join("")+'</datalist></div>'
    +'<div class="f"><label for="isBy">מנפיק</label><input type="text" id="isBy" placeholder="השם שלך" autocomplete="off" value="'+esc(ls.get("issuer")||"")+'"></div>'
    +'<div class="f"><label>חתימת המקבל</label><div class="sig" id="isSig"><canvas></canvas><div class="hint2">חותמים כאן באצבע</div><button class="clr2" type="button">נקה</button></div></div>'
    +'<div class="f"><label for="isNote">הערה</label><input type="text" id="isNote" placeholder="למשל: שדה 2 שורות 15–16"></div>'
    +'<div class="acts"><button class="save" id="isSave" type="button" disabled>שמור ניפוק</button><button class="cancel" id="isCancel" type="button">ביטול</button></div></div>';
  document.body.appendChild(scrim);
  const q=s=>scrim.querySelector(s);
  const pad=sigPad(q("#isSig"));
  if(ROLE!=="owner"){ const k=q("#isKit"); if(k) k.hidden=true; }
  function drawRows(){
    const box=q("#isRows"); box.innerHTML="";
    lines.forEach((l,i)=>{
      const r=document.createElement("div"); r.className="kitrow"+(l.on?"":" off");
      r.innerHTML='<div><div class="nm">'+esc(l.name)+'</div><div class="per">'+fmtN(perOf(l,ttype))+' לשולחן × '+fmtN(tables)+'</div></div>'
        +'<input type="text" inputmode="numeric" value="'+(l.on?l.qty:"")+'" aria-label="כמות" '+(l.on?"":"disabled")+'>'
        +'<button class="x" type="button" aria-label="'+(l.on?"הסר":"החזר")+'">'+(l.on?"×":"+")+'</button>';
      r.children[1].oninput=e=>{ lines[i].qty=Number(e.target.value)||0; check(); };
      r.children[2].onclick=()=>{ lines[i].on=!lines[i].on; if(lines[i].on) lines[i].qty=perOf(lines[i],ttype)*tables; drawRows(); check(); };
      box.appendChild(r);
    });
    const tot=lines.filter(l=>l.on).reduce((s,l)=>s+(Number(l.qty)||0),0);
    q("#isHint").textContent="סה״כ "+fmtN(tot)+" יחידות. אפשר לתקן כל כמות ביד.";
    q("#isSum").textContent=lines.filter(l=>l.on).length+" פריטים · "+fmtN(tot)+" יח׳ ✎";
  }
  function setTables(n){
    n=Math.max(1,Math.round(Number(n)||0)); tables=n; q("#isTables").value=n;
    lines.forEach(l=>{ l.qty=perOf(l,ttype)*tables; }); drawRows(); check();
  }
  q("#isTypes").onclick=e=>{ const b=e.target.closest("[data-t]"); if(!b) return; ttype=b.dataset.t; ls.set("ttype",ttype);
    scrim.querySelectorAll("#isTypes .chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); setTables(tables); };
  function check(){
    const any=lines.some(l=>l.on&&Number(l.qty)>0);
    const okBy=!!q("#isBy").value.trim();
    q("#isSave").disabled=!(any && q("#isWho").value.trim() && okBy);
    q("#isBy").style.borderColor=okBy?"":"var(--clay)";
  }
  q("#isMinus").onclick=()=>setTables(Math.max(TABLE_STEP, tables-TABLE_STEP));
  q("#isPlus").onclick=()=>setTables(tables+TABLE_STEP);
  q("#isTables").onchange=e=>setTables(e.target.value);
  q("#isWho").oninput=check; q("#isBy").oninput=check;
  q("#isKit").onclick=()=>{ openKitEditor(); };
  q("#isToggle").onclick=()=>{ const r=q("#isRows"); r.hidden=!r.hidden; q("#isHint").hidden=r.hidden; };
  q("#isCancel").onclick=close;
  scrim.onclick=e=>{ if(e.target===scrim) close(); };
  document.addEventListener("keydown",esck);
  q("#isSave").onclick=async()=>{
    const b=q("#isSave");
    if(!pad.has()){
      const go=await ask("לשמור ניפוק בלי חתימת המקבל?","שמור בלי חתימה","var(--amber)","בלי חתימה אין הוכחה שהקבלן קיבל את הכמות. הניפוק יסומן «ללא חתימה» בכל הדוחות.");
      if(!go) return;
    }
    b.disabled=true; b.textContent="שומר…";
    const who=q("#isWho").value.trim(), by=q("#isBy").value.trim(), note=q("#isNote").value.trim();
    if(by) ls.set("issuer",by);
    const ts=Date.now(), id="is"+ts;
    const chosen=lines.filter(l=>l.on&&Number(l.qty)>0).map(l=>({code:l.code,name:l.name,qty:Number(l.qty),per:perOf(l,ttype),unit:"יח'"}));
    const slip={id,ts,tables,ttype,typeLabel:typeLabel(ttype),who,by,note,lines:chosen,sigAsset:"",sigUrl:"",source:"app"};
    if(pad.has()){
      let up=false;
      try{ if(ASSETS){ const bl=await pad.blob(); const a=await ASSETS.upload(bl); slip.sigAsset=a.id; slip.sigUrl=a.url; up=true; } }catch(e){}
      if(!up){ try{ slip.sigData=pad.dataUrl(); }catch(e){} }
    }
    const mv=chosen.map(l=>({id:id+"_"+l.code,item:l.name,qty:l.qty,dir:"out",who,by,ts,unit:"יח'",cat:"construction",source:"issue",issueId:id,tables,ttype,note}));
    try{
      if(DB){ await DB.doc("issues/"+id).set(slip); for(const m of mv) await DB.doc("moves/"+m.id).set(m); }
      else { issues.push(slip); ls.set("issues",JSON.stringify(issues)); moves.push(...mv); ls.set("moves",JSON.stringify(moves)); }
    }catch(e){ b.disabled=false; b.textContent="שמור ניפוק"; toast("השמירה נכשלה. נסה שוב."); return; }
    logAct("issue","add","ניפוק ל"+who+" · "+fmtN(tables)+" שולחנות ("+typeLabel(ttype)+") · "+chosen.length+" פריטים · "+(pad.has()?"חתום":"ללא חתימה"),id,by);
    if(demoStock){ demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderStock(); toast("הניפוק נשמר.");
    openSlip(slip);
  };
  function esck(ev){ if(ev.key==="Escape") close(); }
  function close(){ document.removeEventListener("keydown",esck); scrim.remove(); }
  drawRows(); check();
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
function slipText(s){
  const d=new Date(s.ts);
  return "ניפוק ברגים · "+fmtD(d)+" "+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})
    +"\nל: "+(s.who||"")+(s.tables?" · "+s.tables+" שולחנות"+(s.typeLabel?" ("+s.typeLabel+")":""):"")+(s.by?" · מנפיק: "+s.by:"")
    +"\n"+(s.lines||[]).map(l=>l.name+": "+fmtN(l.qty)).join("\n")
    +(s.note?"\nהערה: "+s.note:"")
    +"\nחתימת המקבל: "+((s.sigAsset||s.sigUrl||s.sigData)?"יש":"אין");
}
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); toast("הועתק. אפשר להדביק בוואטסאפ."); return true; }
  catch(e){
    const ta=document.createElement("textarea"); ta.value=t; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta);
    ta.select(); let ok=false; try{ ok=document.execCommand("copy"); }catch(e2){}
    ta.remove(); toast(ok?"הועתק. אפשר להדביק בוואטסאפ.":"לא הצלחתי להעתיק. סמן את הטקסט והעתק ידנית."); return ok;
  }
}
function openSlip(s){
  const scrim=document.createElement("div"); scrim.className="scrim";
  const sig=s.sigAsset?"/_blob/"+s.sigAsset:(s.sigUrl||s.sigData||"");
  const d=new Date(s.ts);
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="תעודת ניפוק">'
    +'<div class="grab"></div><h2>ניפוק · '+esc(s.who||"")+'</h2>'
    +'<div class="kv"><span>'+fmtD(d)+' '+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})+'</span>'
      +(s.tables?'<span><b>'+fmtN(s.tables)+'</b> שולחנות'+(s.typeLabel?' · '+esc(s.typeLabel):'')+'</span>':'')+(s.by?'<span>מנפיק <b>'+esc(s.by)+'</b></span>':'')
      +'<span>'+(s.sigAsset||s.sigUrl?'<b style="color:var(--sage)">חתום</b>':'<b style="color:var(--clay)">ללא חתימה</b>')+'</span></div>'
    +(s.note?'<div class="note-card">'+esc(s.note)+'</div>':'')
    +'<div class="dlines">'+(s.lines||[]).map(l=>'<div><span>'+esc(l.name)+'</span><b>'+fmtN(l.qty)+'</b></div>').join("")+'</div>'
    +(sig?'<img class="sigimg" src="'+sig+'" alt="חתימת המקבל" style="margin-top:14px">':'')
    +'<div class="acts"><button class="save" type="button" id="slCopy">העתק לוואטסאפ</button><button class="ghost" type="button" id="slPdf">PDF</button><button class="cancel" type="button">סגור</button></div></div>';
  document.body.appendChild(scrim);
  const close=()=>{ document.removeEventListener("keydown",esck); scrim.remove(); };
  const esck=ev=>{ if(ev.key==="Escape") close(); };
  document.addEventListener("keydown",esck);
  scrim.querySelector(".cancel").onclick=close;
  scrim.querySelector("#slCopy").onclick=()=>copyText(slipText(s));
  scrim.querySelector("#slPdf").onclick=e=>issuePdfById(s.id,e.currentTarget);
  scrim.onclick=e=>{ if(e.target===scrim) close(); };
}
function renderSlips(){
  const list=(demoStock?[]:issues).slice().sort((a,b)=>b.ts-a.ts);
  $("#slipWrap").hidden=!list.length;
  $("#slipCount").textContent=list.length?list.length+" ניפוקים":"";
  foldSum("slips",list.length?list.length+" ניפוקים · "+list.filter(x=>!(x.sigAsset||x.sigUrl||x.sigData)).length+" ללא חתימה":"");
  const box=$("#slipList"); box.innerHTML="";
  list.slice(0,5).forEach(s=>{
    const b=document.createElement("button"); b.type="button"; b.className="slip";
    const d=new Date(s.ts);
    b.innerHTML='<b>'+esc(s.who||"")+(s.tables?' · '+fmtN(s.tables)+' שולחנות':'')+'</b>'
      +'<span class="sigok" style="'+((s.sigAsset||s.sigUrl||s.sigData)?'background:var(--sage-soft);color:var(--sage)':'background:var(--clay-soft);color:var(--clay)')+'">'+((s.sigAsset||s.sigUrl||s.sigData)?'חתום':'ללא חתימה')+'</span>'
      +'<span>'+fmtD(d)+' · '+(s.lines||[]).length+' פריטים · '+fmtN((s.lines||[]).reduce((t,l)=>t+(Number(l.qty)||0),0))+' יח׳'+(s.by?' · '+esc(s.by):'')+'</span>';
    b.onclick=()=>openSlip(s);
    box.appendChild(b);
  });
  if(list.length){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent=(list.length>5?"כל הניפוקים ("+list.length+")":"כל הניפוקים")+" · PDF לתקופה"; m.onclick=()=>openAllSlips(list); box.appendChild(m); }
}
function openAllSlips(list){
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="כל הניפוקים"><div class="grab"></div><h2>כל הניפוקים</h2><div id="asRange"></div><div class="stock" id="asList"></div>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>';
  document.body.appendChild(scrim);
  issueRangeBox(scrim.querySelector("#asRange"));
  const box=scrim.querySelector("#asList");
  list.forEach(s=>{ const b=document.createElement("button"); b.type="button"; b.className="slip"; const d=new Date(s.ts);
    b.innerHTML='<b>'+esc(s.who||"")+(s.tables?' · '+fmtN(s.tables)+' שולחנות':'')+'</b><span class="sigok" style="'+((s.sigAsset||s.sigUrl||s.sigData)?'background:var(--sage-soft);color:var(--sage)':'background:var(--clay-soft);color:var(--clay)')+'">'+((s.sigAsset||s.sigUrl||s.sigData)?'חתום':'ללא חתימה')+'</span><span>'+fmtD(d)+' · '+(s.lines||[]).length+' פריטים'+(s.by?' · '+esc(s.by):'')+'</span>';
    b.onclick=()=>openSlip(s); box.appendChild(b); });
  scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
}
/* ---- PDF לניפוק: עמוד לכל ניפוק (ברגים או ציוד) עם החתימה. בלי ת.ז. ובלי מחירים ---- */
const recSig=r=>r.sigAsset?"/_blob/"+r.sigAsset:(r.sigUrl||r.sigData||"");
const recSigned=r=>!!(r.sigAsset||r.sigUrl||r.sigData);
function issueRecs(){
  const a=(demoStock?[]:issues).map(s=>({kind:"bolts",id:s.id,ts:s.ts,who:s.who||"",by:s.by||"",tables:s.tables,typeLabel:s.typeLabel||"",lines:(s.lines||[]).map(l=>({name:l.name,qty:l.qty})),note:s.note||"",sig:recSig(s),signed:recSigned(s)}));
  const b=(demoStock?[]:moves).filter(m=>m.dir==="out"&&m.source!=="issue").map(m=>({kind:"tool",id:m.id,ts:m.ts,who:m.who||"",by:m.by||"",lines:[{name:m.item,qty:m.qty}],note:m.note||"",sig:recSig(m),signed:recSigned(m)}));
  const all=a.concat(b).sort((x,y)=>x.ts-y.ts||String(x.id).localeCompare(String(y.id))); all.forEach((r,i)=>r.no=i+1); return all;
}
const isoDay=t=>{ const d=new Date(t); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const fileSafe=t=>String(t||"").replace(/[\\/:*?"<>|]/g,"").trim().replace(/\s+/g,"-");
const siteShort=()=>fileSafe(String(SITE.name||"").replace(/^אתר הקמה\s*/,""))||"אתר";
const issueFileName=r=>[siteShort(),isoDay(r.ts),fileSafe(r.who)||"ללא-שם",r.no].join("_")+".pdf";
async function sigImg(src){ if(!src) return null; try{ const res=await fetch(src); if(!res.ok) return null; return await loadImg(await res.blob()); }catch(e){ return null; } }
async function issuePage(r){
  const W=1240,H=1754; const c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  x.fillStyle="#fff"; x.fillRect(0,0,W,H); x.direction="rtl"; x.textAlign="right"; const R=W-80, Lx=80;
  const d=new Date(r.ts); const dt=d.getDate()+"."+(d.getMonth()+1)+"."+d.getFullYear()+" "+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});
  x.fillStyle="#E40033"; x.fillRect(0,0,W,14); x.font="700 30px Alef, Arial"; x.fillText(SITE.company||"BELECTRIC",R,80);
  x.fillStyle="#121212"; x.font="700 44px Alef, Arial"; x.fillText((r.kind==="tool"?"ניפוק ציוד":"ניפוק ברגים")+" · מס׳ "+r.no,R,140);
  x.fillStyle="#666B6E"; x.font="400 26px Alef, Arial"; x.fillText(SITE.name+" · "+dt,R,185);
  x.fillStyle="#121212"; x.font="700 34px Alef, Arial"; x.fillText("מקבל: "+(r.who||"—"),R,250);
  let y=292; x.font="400 26px Alef, Arial"; x.fillStyle="#3F4447";
  if(r.tables){ x.fillText(fmtN(r.tables)+" שולחנות"+(r.typeLabel?" ("+r.typeLabel+")":""),R,y); y+=38; }
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
  x.fillStyle="#666B6E"; x.font="400 20px Alef, Arial"; x.fillText("הופק מיומן אתר · "+fmtD(Date.now()),R,H-70);
  const jb=await canvasBlob(c,0.85); return {bytes:new Uint8Array(await jb.arrayBuffer()),w:W,h:H};
}
async function issuesPdf(list,name,title){
  try{ await document.fonts.load("700 28px Alef"); await document.fonts.load("400 24px Alef"); }catch(e){}
  try{ const pages=[]; for(const r of list) pages.push(await issuePage(r)); return await saveFile(name,await buildPdf(pages,title)); }
  catch(e){ toast("יצירת ה-PDF נכשלה."); return false; }
}
async function issuePdfById(id,btn){
  const r=issueRecs().find(x=>x.id===id); if(!r){ toast("הניפוק לא נמצא."); return; }
  const t=btn&&btn.textContent; if(btn){ btn.disabled=true; btn.textContent="מכין…"; }
  await issuesPdf([r],issueFileName(r),"ניפוק "+r.no);
  if(btn){ btn.disabled=false; btn.textContent=t; }
}
function issueRangeBox(host){
  const now=new Date(), wk=new Date(now); wk.setDate(now.getDate()-6);
  host.innerHTML='<div class="card" style="padding:12px;margin-bottom:12px"><h3 style="font-size:.95rem">PDF של הניפוקים החתומים לתקופה</h3>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><input type="date" id="irFrom" aria-label="מתאריך" value="'+isoDay(wk)+'"><input type="date" id="irTo" aria-label="עד תאריך" value="'+isoDay(now)+'"></div>'
    +'<div class="hint" id="irHint" style="margin-top:6px"></div><button class="ghost" type="button" id="irGo" style="width:100%;margin-top:8px">הורד PDF לתקופה</button></div>';
  const q=s=>host.querySelector(s);
  const pick=()=>{ const f=q("#irFrom").value, t=q("#irTo").value; const all=issueRecs().filter(r=>{ const k=isoDay(r.ts); return (!f||k>=f)&&(!t||k<=t); }); return {f,t,all,sig:all.filter(r=>r.signed)}; };
  const hint=()=>{ const p=pick(); q("#irHint").textContent=p.sig.length+" ניפוקים חתומים (ברגים וציוד), עמוד לכל ניפוק"+(p.all.length>p.sig.length?" · "+(p.all.length-p.sig.length)+" ללא חתימה לא נכללים":""); q("#irGo").disabled=!p.sig.length; };
  q("#irFrom").onchange=hint; q("#irTo").onchange=hint; hint();
  q("#irGo").onclick=async()=>{ const p=pick(); if(!p.sig.length) return; const b=q("#irGo"); b.disabled=true; b.textContent="מכין "+p.sig.length+" עמודים…";
    const ok=await issuesPdf(p.sig,[siteShort(),"ניפוקים-חתומים",p.f||"התחלה","עד",p.t||isoDay(Date.now())].join("_")+".pdf","ניפוקים חתומים");
    b.textContent="הורד PDF לתקופה"; hint(); if(ok) logAct("issue","add","PDF ניפוקים חתומים · "+p.sig.length+" עמודים",""); };
}
$("#btnIssue").onclick=openIssue;
if($("#ovNewIssue")) $("#ovNewIssue").onclick=openIssue;

/* ---- ספירה מהירה ---- */
function openQuickCount(){
  const rows=stockRows(); const byName=new Map(rows.map(r=>[r.name,r]));
  let items=kit.map(k=>k.name);
  const vals={};      // יחידות בודדות
  const boxes={};     // קרטונים
  const perBox={};    // יחידות בקרטון (נזכר בקיט)
  kit.forEach(k=>{ if(Number(k.carton)>0) perBox[k.name]=Number(k.carton); });
  const total=n=>{ const loose=Number(vals[n]); const bx=Number(boxes[n]); const pb=Number(perBox[n]);
    const hasLoose=String(vals[n]??"").trim()!==""&&isFinite(loose); const hasBox=String(boxes[n]??"").trim()!==""&&isFinite(bx)&&bx>0&&pb>0;
    if(!hasLoose&&!hasBox) return null; return (hasLoose?loose:0)+(hasBox?bx*pb:0); };
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="ספירה מהירה">'
    +'<div class="grab"></div><h2>ספירה מהירה</h2>'
    +'<div class="note-card">סופרים קרטונים סגורים, לא ברגים: <b>קרטונים × כמות בקרטון + יחידות בודדות</b>. הפער מול התיאורטי מחושב תוך כדי. שורה ריקה לא נשמרת.</div>'
    +'<button class="scanbtn" type="button" id="qcScan" style="margin-bottom:10px"><i class="ic ic-scan"></i>ספירה בסריקת ברקודים</button>'
    +'<div class="search" style="margin-bottom:10px"><input type="text" id="qcSearch" placeholder="הוסף פריט אחר לספירה" autocomplete="off" aria-label="חיפוש פריט"><span class="ico">⌕</span></div>'
    +'<div class="stock" id="qcSug" style="margin-bottom:10px"></div>'
    +'<div class="kitrows" id="qcRows"></div>'
    +'<div class="f" style="margin-top:14px"><label for="qcWho">מי ספר</label><input type="text" id="qcWho" placeholder="השם שלך" value="'+esc(ls.get("issuer")||"")+'"></div>'
    +'<div class="acts"><button class="save" id="qcSave" type="button" disabled>שמור ספירה</button><button class="cancel" id="qcCancel" type="button">ביטול</button></div></div>';
  document.body.appendChild(scrim);
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
          +'<input type="text" inputmode="numeric" placeholder="קרטונים" aria-label="קרטונים" value="'+esc(boxes[n]??"")+'" data-k="box">'
          +'<input type="text" inputmode="numeric" placeholder="בקרטון" aria-label="כמות בקרטון" value="'+esc(perBox[n]??"")+'" data-k="per">'
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
  q("#qcCancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  document.addEventListener("keydown",esck);
  q("#qcSave").onclick=async()=>{
    const b=q("#qcSave"); b.disabled=true; b.textContent="שומר…";
    const who=q("#qcWho").value.trim(); if(!who){ b.disabled=false; b.textContent="שמור ספירה"; toast("מי ספר? צריך שם."); return; } ls.set("issuer",who);
    const ts=Date.now(); const recs=[];
    items.forEach((n,i)=>{ const t=total(n); if(t==null) return;
      const r=byName.get(n); const bx=Number(boxes[n])||0, pb=Number(perBox[n])||0;
      recs.push({id:"c"+ts+"_"+i,item:n,qty:t,who,ts,cat:r?r.cat:"construction",unit:r?r.unit:"יח'",source:"app",
        note:(bx&&pb?bx+" קרטונים × "+pb+(Number(vals[n])?" + "+Number(vals[n])+" בודדים":""):"")}); });
    // זכירת כמות בקרטון בקיט
    let kitChanged=false; const lines=kit.map(k=>{ const pb=Number(perBox[k.name]); if(pb>0&&Number(k.carton)!==pb){ kitChanged=true; return {...k,carton:pb}; } return k; });
    try{
      if(DB){ for(const c of recs) await DB.doc("counts/"+c.id).set(c); }
      else { counts.push(...recs); ls.set("counts",JSON.stringify(counts)); }
      if(kitChanged){ try{ await saveKit(lines,kitSource,"נלמדה כמות בקרטון מספירה"); }catch(e){} }
    }catch(e){ b.disabled=false; b.textContent="שמור ספירה"; toast("השמירה נכשלה."); return; }
    const gaps=recs.map(r=>{ const row=byName.get(r.item); return row&&!row.noIn?{n:shortName(r.item),g:r.qty-row.derived}:null; }).filter(x=>x&&x.g!==0);
    logAct("count","add","ספירה: "+recs.length+" פריטים"+(gaps.length?" · פערים: "+gaps.slice(0,4).map(x=>x.n+" "+(x.g>0?"+":"−")+fmtN(Math.abs(x.g))).join(", "):" · הכל תואם"),"c"+ts,who);
    if(demoStock){ demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderStock(); toast("נשמרו "+recs.length+" ספירות.");
  };
  function esck(ev){ if(ev.key==="Escape") close(); }
  function close(){ document.removeEventListener("keydown",esck); scrim.remove(); }
  draw();
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
$("#btnCount").onclick=openQuickCount;

/* ---- סיכום לוואטסאפ ---- */
function periodSummary(days){
  const to=Date.now(), from=to-days*86400000;
  const inP=x=>x.ts>=from&&x.ts<=to;
  const notes=(demoStock?DEMO_NOTES:deliveries).filter(n=>n.source!=="bom").filter(inP);
  const cons=curConcrete(); const consP=cons.filter(inP);
  const mv=(demoStock?DEMO_MOVES:moves).filter(inP);
  const iss=(demoStock?[]:issues).filter(inP);
  
  const L=[];
  L.push("*יומן אתר · "+SITE.name.replace(/^אתר הקמה\s*/,"")+"* · סיכום "+days+" ימים ("+fmtD(from)+" – "+fmtD(to)+")");
  // deliveries
  const sups=new Map(); notes.forEach(n=>{ const k=(n.supplier||"ספק לא ידוע").trim(); sups.set(k,(sups.get(k)||0)+1); });
  const topS=[...sups.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k.replace(/ בע"מ.*$/,"").replace(/\s*\(.*?\)/g,"")+" ("+v+")");
  L.push(""); L.push("*משלוחים:* "+notes.length+" תעודות מ-"+sups.size+" ספקים"+(topS.length?" · "+topS.join(", "):""));
  const big=notes.flatMap(n=>(n.lines||[]).map(l=>({...l,sup:n.supplier}))).filter(l=>/שנאי|ממיר|MVS|גנרטור|מכולה|פאנל/i.test(l.name)).slice(0,4);
  big.forEach(l=>L.push("  - "+l.name+" × "+fmtN(l.qty)));
  // concrete
  const m3=consP.reduce((s,c)=>s+(Number(c.m3)||0),0);
  const days2=new Set(consP.map(c=>c.dateText)).size;
  const miss=missingConcrete(consP);
  L.push(""); L.push("*בטון:* "+fmtM3(m3)+" מ״ק ב-"+consP.length+" משאיות, "+days2+" ימי יציקה · מתחילת העבודות "+fmtM3(cons.reduce((s,c)=>s+(Number(c.m3)||0),0))+" מ״ק");
  if(miss.trucks) L.push("  - "+trucksText(miss.trucks)+" (~"+fmtM3(miss.m3)+" מ״ק) ללא תעודה מצולמת: "+miss.days.join(", "));
  // issues
  const outQ=mv.filter(m=>m.dir==="out").reduce((s,m)=>s+(Number(m.qty)||0),0);
  const tbl=iss.reduce((s,i)=>s+(Number(i.tables)||0),0);
  L.push(""); L.push("*ניפוקים לקבלן:* "+mv.filter(m=>m.dir==="out").length+" שורות, "+fmtN(outQ)+" יחידות"+(tbl?" · "+tbl+" שולחנות":"")+(iss.length?" · "+iss.filter(i=>i.sigAsset||i.sigUrl).length+" מתוך "+iss.length+" ניפוקים חתומים":""));
  // flags
  const fl=notes.filter(n=>{const f=noteFlags(n); return f.issue||f.ret;});
  L.push(""); L.push("*דורש בדיקה:* "+(fl.length?fl.length+" תעודות":"אין"));
  fl.slice(0,6).forEach(n=>{ const f=noteFlags(n); L.push("  - "+(n.supplier||"")+" · "+(n.noteNo||"")+" · "+(f.issue?"חוסר/פגום":"החזרה לספק")+(n.note?" · "+n.note.slice(0,60):"")); });
  // counts
  const cnt=(demoStock?DEMO_COUNTS:counts).filter(inP);
  if(cnt.length) L.push("", "*ספירות:* "+cnt.length+" פריטים נספרו");
  // contractors + money
  if(!demoStock){
    const K=kitStats();
    const prog=progress.filter(inP).filter(p=>stageOf(p)==="con").reduce((s,p)=>s+(Number(p.tables)||0),0);
    if(K.declTables||!K.doneProxy){
      L.push("", "*שולחנות:* "+(K.doneProxy?"אף שולחן גמור לא דווח":"קונסטרוקציה "+fmtN(K.done)+(prog?" (+"+fmtN(prog)+" בתקופה)":"")+" · פאנלים "+fmtN(K.donePan)+" · אושרו "+fmtN(K.doneOk))+" מתוך "+fmtN(K.total)
        +" · נופקו ברגים ל-"+fmtN(K.declTables)+" ברישום"+(K.pace?" · קצב ניפוק "+fmtN(Math.round(K.pace))+" לשבוע":""));
      if(!K.doneProxy&&K.donePan>K.doneOk) L.push("  - ממתינים לאישור מפקח: "+fmtN(K.donePan-K.doneOk)+" שולחנות");
      const over=K.parts.filter(p=>p.dev!=null&&p.dev>0.05).slice(0,3);
      if(over.length) L.push("  - מעל הנורמה: "+over.map(p=>shortName(p.name)+" "+fmtN(Math.round(p.act))+" לשולחן (BOM "+fmtN(Math.round(p.normRef))+")").join(", "));
      const short=K.parts.filter(p=>p.inBom&&p.def&&p.issued>0&&p.shortAct>0).slice(0,3);
      if(short.length) L.push("  - ייגמר לפני הסוף בקצב הנוכחי: "+short.map(p=>shortName(p.name)+" (מספיק ל-"+fmtN(Math.floor(p.worthAct))+" מתוך "+fmtN(Math.round(p.remaining))+")").join(", "));
    }
    const pb=curPb();
    const pmP=panelMoves.filter(inP); if(pmP.length) L.push("", "*פאנלים בין אתרים:* "+pmP.map(m=>(m.dir==="in"?"הגיעו ":"יצאו ")+fmtN(m.qty)+(m.dir==="in"?" מ":" ל")+m.site+(m.broken?" ("+m.broken+" שבור בהגעה)":"")).join(" · "));
    if(pb){ const c=pbCalc(pb,prevPb()); L.push("", "*פאנלים* (נכון ל-"+fmtDT(pb.dateText||"")+"): באתר "+fmtN(c.onSite)+" מול "+fmtN(N(pb.required))+" נדרש · מותקנים "+fmtN(N(pb.installed))+(c.perDay?" ("+fmtN(Math.round(c.perDay))+" ליום)":"")+" · שבורים "+fmtN(N(pb.broken))+" · ספייר "+(c.spare<0?"חסרים "+fmtN(-c.spare):fmtN(c.spare))+(N(pb.broken)?" (בלי השבורים: "+(c.usable<0?"חסרים "+fmtN(-c.usable):fmtN(c.usable))+")":"")+(c.projected!=null&&c.projected<0?" · צפי בסוף: חסרים "+fmtN(Math.round(-c.projected)):"")); }
    const P=moneyPoints().slice(0,4);
    if(P.length){ L.push("", "*איפה הכסף:*"); P.forEach(p=>L.push("  - "+p.b+": "+p.n+" "+p.u+(p.ils?" ("+p.ils+")":""))); }
  }
  return L.join("\n");
}
function openWa(){
  let days=7;
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="סיכום לוואטסאפ"><div class="grab"></div><h2>סיכום לוואטסאפ</h2>'
    +'<div class="chips" id="waChips">'+[7,14,30].map(d=>'<button type="button" class="chip2" data-d="'+d+'" aria-pressed="'+(d===days)+'">'+d+' ימים</button>').join("")+'</div>'
    +'<textarea class="watext" id="waText" readonly></textarea>'
    +'<div class="hint" style="margin-top:6px">אפשר לערוך את הטקסט לפני ההעתקה.</div>'
    +'<div class="acts"><button class="save" type="button" id="waCopy">העתק</button><button class="cancel" type="button">סגור</button></div></div>';
  document.body.appendChild(scrim);
  const ta=scrim.querySelector("#waText"); ta.readOnly=false;
  const gen=()=>{ ta.value=periodSummary(days); };
  scrim.querySelector("#waChips").onclick=e=>{ const b=e.target.closest("[data-d]"); if(!b) return; days=Number(b.dataset.d);
    scrim.querySelectorAll(".chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); gen(); };
  scrim.querySelector("#waCopy").onclick=()=>copyText(ta.value);
  scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  gen();
}
$("#btnWa").onclick=openWa;

/* ---- בטון: משאיות ללא תעודה (לפי המונה המצטבר) ---- */
const trucksText=n=>n===1?"משאית אחת":n+" משאיות";
function missingConcrete(list){
  const byDay=new Map();
  list.forEach(c=>{ const k=c.dateText; (byDay.get(k)||byDay.set(k,[]).get(k)).push(c); });
  let trucks=0, m3=0; const days=[]; const perDay=new Map();
  byDay.forEach((arr,day)=>{
    const L=arr.filter(c=>c.cum!=null).slice().sort((a,b)=>a.cum-b.cum);
    let prev=0, t=0, q=0;
    L.forEach(c=>{ const gap=c.cum-prev-(Number(c.m3)||0); if(gap>0.01){ q+=gap; t+=Math.max(1,Math.round(gap/8)); } prev=Math.max(prev,c.cum); });
    if(t){ trucks+=t; m3+=q; days.push(fmtDT(day)+" ("+t+")"); perDay.set(day,{trucks:t,m3:q}); }
  });
  return {trucks,m3,days,perDay};
}

