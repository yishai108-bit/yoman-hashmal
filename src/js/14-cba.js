/* ================= CBA: חבילות רכש והשוואת הצעות (מסחרי · לבעלים בלבד) ================= */
let cba={packages:[],prices:[],source:"",ts:0};
const CBA_ST={po:["הוזמן","var(--sage)"],pending:["ממתין להחלטה","var(--amber)"],quotes:["הצעות מחיר","var(--info)"],open:["פתוח","var(--ink3)"]};
const fmtMoney=(v,cur)=>{ v=Number(v)||0; if(!v) return ""; return (cur==="€"?"€":cur==="$"?"$":"₪")+(v<100?String(Math.round(v*100)/100):fmtN(Math.round(v))); };
async function saveCba(d){
  const doc={packages:(d.packages||[]).map(p=>({name:String(p.name||"").trim(),supplier:p.supplier||"",po:p.po||"",price:Number(p.price)||0,currency:p.currency||"₪",budget:Number(p.budget)||0,lead:p.lead||"",status:CBA_ST[p.status]?p.status:(p.po?"po":"open"),note:p.note||""})).filter(p=>p.name),
    prices:(d.prices||[]).map(x=>({type:String(x.type||"").trim(),supplier:x.supplier||"",price:Number(x.price)||0,currency:x.currency||"₪",unit:x.unit||"מטר",manufacturer:x.manufacturer||"",lead:x.lead||"",note:x.note||""})).filter(x=>x.type&&x.price>0),
    source:d.source||"CBA",ts:Date.now()};
  if(DB) await DB.doc("settings/cba").set(doc); else { cba=doc; ls.set("cba",JSON.stringify(doc)); }
  logAct("settings","edit","CBA עודכן · "+doc.packages.length+" חבילות · "+doc.prices.length+" מחירי יחידה · "+doc.source,"settings/cba");
}
function cbaPrice(en){ if(!en||!cba.prices.length) return null; const k=normName(en); const hits=cba.prices.filter(x=>normName(x.type)===k||k.includes(normName(x.type))||normName(x.type).includes(k)); if(!hits.length) return null; return hits.slice().sort((a,b)=>a.price-b.price)[0]; }
function openImportChooser(){
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="ייבוא"><div class="grab"></div><h2>איזה קובץ?</h2><div class="stock">'
    +'<button type="button" class="slip" data-k="bom"><b>BOM · שלטר</b><span>קיט הקונסטרוקציה של היצרן: כמויות לשולחן ומלאי הפתיחה</span></button>'
    +'<button type="button" class="slip" data-k="eboq"><b>EBOQ · חשמל</b><span>גיליון הרכש של חשמל: פריטים, כמויות, PO, ספק ומק״ט ספק. נקרא ישירות</span></button>'
    +(ROLE==="owner"?'<button type="button" class="slip" data-k="cba"><b>CBA · מסחרי</b><span>השוואת הצעות וחבילות רכש: ספק נבחר, PO, מחיר מול תקציב. נשמר לבעלים בלבד</span></button>':'')
    +'</div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>';
  document.body.appendChild(scrim); scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  scrim.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{ scrim.remove(); ({bom:openBomImport,eboq:openBoqImport,cba:openCbaImport})[b.dataset.k](); });
}
function openCbaImport(){
  if(ROLE!=="owner"){ toast("CBA נשמר רק על ידי הבעלים."); return; }
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="ייבוא CBA"><div class="grab"></div><h2>ייבוא CBA (מסחרי)</h2>'
    +'<div class="note-card">קובץ ה-CBA של הפרויקט: גיליון לכל חבילת רכש עם ההצעות, התקציב ומספר ה-PO של ההצעה שנבחרה. נקרא בעזרת AI, ואתה מאשר. <b>מידע מסחרי: נשמר כך שרק הבעלים רואה אותו.</b></div>'
    +(cba.packages.length?'<div class="legend">כרגע: <b>'+cba.packages.length+'</b> חבילות ('+esc(cba.source||"")+'). קובץ חדש מחליף.</div>':'')
    +'<div id="cbBody"><div class="pick">בחר קובץ CBA<small>xlsx</small><input type="file" id="cbFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></div></div>'
    +'<div class="acts"><button class="save" id="cbGo" hidden type="button">שמור CBA</button><button class="cancel" type="button">סגור</button></div></div>';
  document.body.appendChild(scrim);
  const q=s=>scrim.querySelector(s); let out=null;
  q(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#cbFile").onchange=async e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    if(!SAMPLE){ q("#cbBody").innerHTML='<div class="empty">קריאה אוטומטית לא זמינה בתצוגה הזאת.</div>'; return; }
    q("#cbBody").innerHTML='<div class="prog"><i style="width:25%"></i></div><div class="prog-t"><span>קורא את הקובץ…</span></div>';
    let text="";
    try{ await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"); const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
      text=wb.SheetNames.slice(0,16).map(n=>"### גיליון: "+n+"\n"+XLSX.utils.sheet_to_csv(wb.Sheets[n],{blankrows:false}).split("\n").filter(l=>l.replace(/[,\s]/g,"").length).slice(0,60).map(l=>l.slice(0,400)).join("\n")).join("\n\n");
    }catch(err){ q("#cbBody").innerHTML='<div class="empty">לא הצלחתי לקרוא את הקובץ.</div>'; return; }
    q("#cbBody").innerHTML='<div class="prog"><i style="width:60%"></i></div><div class="prog-t"><span>מזהה חבילות, ספקים, PO ומחירים…</span></div>';
    try{
      out=await SAMPLE.json("להלן קובץ CBA (השוואת הצעות מחיר) של פרויקט סולארי, גיליון לכל חבילת רכש, כ-CSV. החזר רק JSON: "
        +'{"source":"<שם הפרויקט/תאריך>","packages":[{"name":"<שם החבילה בעברית, לפי שם הגיליון>","supplier":"<הספק שנבחר: זה שבעמודה/בלוק של מספר ה-PO, או null>","po":"<מספר PO בפורמט POxxxxxxxx או null>","price":<המחיר של ההצעה שנבחרה, מספר או null>,"currency":"<₪ או € או $>","budget":<תקציב, מספר או null>,"lead":"<זמן אספקה או null>","status":"<po|pending|quotes|open>","note":"<הצעות אחרות בקצרה (ספק ומחיר) והערות>"}],'
        +'"prices":[{"type":"<סוג הכבל/הפריט כפי שכתוב באנגלית>","supplier":"<הספק שנתן את המחיר>","price":<מחיר ליחידה>,"currency":"<₪ או €/$>","unit":"<m / יח>","manufacturer":"<יצרן או null>","lead":"<זמן אספקה או null>"}]}. '
        +"status: po אם יש מספר PO; pending אם כתוב שצריך לאפיין מחדש או להחליט; quotes אם יש רק הצעות; open אם הגיליון ריק. גיליון השוואת כבלים (עמודות Unit price ILS לפי ספק) הולך ל-prices, שורה לכל ספק שיש לו מחיר, וגם כחבילה אחת בשם 'כבילה'. אל תמציא מספרים; מספר שלא ברור = null.\n\n"+text,{modelTier:"complex"});
    }catch(err){ q("#cbBody").innerHTML='<div class="empty">'+(err&&err.code==="not_granted"?"קריאה אוטומטית לא זמינה.":"הקריאה נכשלה. נסה שוב.")+'</div>'; return; }
    const pk=(out&&Array.isArray(out.packages)?out.packages:[]).filter(p=>p&&p.name);
    if(!pk.length){ q("#cbBody").innerHTML='<div class="empty">לא נמצאו חבילות רכש בקובץ.</div>'; return; }
    out.packages=pk; out.prices=(Array.isArray(out.prices)?out.prices:[]).filter(x=>x&&x.type&&Number(x.price)>0);
    q("#cbBody").innerHTML='<div class="imp-sum"><span>חבילות <b>'+pk.length+'</b></span><span>עם PO <b>'+pk.filter(p=>p.po).length+'</b></span><span>מחירי יחידה <b>'+out.prices.length+'</b></span></div>'
      +'<div class="dlines">'+pk.map(p=>'<div><span>'+esc(p.name)+' <small style="color:var(--ink3)">· '+esc(p.supplier||"—")+(p.po?' · '+esc(p.po):'')+'</small></span><b>'+esc((SHOW_PRICES&&fmtMoney(p.price,p.currency))||(CBA_ST[p.status]||CBA_ST.open)[0])+'</b></div>').join("")+'</div>';
    q("#cbGo").hidden=false;
  };
  q("#cbGo").onclick=async()=>{ if(!out) return; const b=q("#cbGo"); b.disabled=true; b.textContent="שומר…";
    try{ await saveCba(out); }catch(e){ toast("השמירה נכשלה."); b.disabled=false; b.textContent="שמור CBA"; return; }
    scrim.remove(); toast("נשמרו "+out.packages.length+" חבילות רכש."); renderOrders(); };
}
function renderCba(){
  const el=$("#orCba"); if(!el) return; el.innerHTML="";
  const P=ROLE==="owner"?cba.packages:[];
  if(!P.length){ foldSum("cba",""); el.innerHTML='<div class="empty" style="padding:16px">'+(ROLE==="owner"?'ייבא את קובץ ה-CBA כדי לראות את חבילות הרכש, הספקים וה-PO.':'')+'</div>'; return; }
  const withPo=P.filter(p=>p.status==="po").length, pend=P.filter(p=>p.status==="pending").length;
  foldSum("cba",withPo+" הוזמנו"+(pend?" · "+pend+" ממתין":""));
  const order={pending:0,quotes:1,open:2,po:3};
  P.slice().sort((a,b)=>(order[a.status]??2)-(order[b.status]??2)).forEach(p=>{ const st=CBA_ST[p.status]||CBA_ST.open;
    const d=document.createElement("div"); d.className="holder";
    const note=SHOW_PRICES?(p.note||""):String(p.note||"").replace(/[₪€$]\s?[\d.,]+|[\d.,]+\s?[₪€$]/g,"").replace(/\s{2,}/g," ").replace(/\(\s*\)/g,"").replace(/\s·\s(?=·|$)/g,"").trim();
    d.innerHTML='<div class="who">'+esc(p.name)+' <span class="sigok" style="background:var(--line2);color:'+st[1]+'">'+st[0]+'</span><div class="what">'+esc([p.supplier,p.po,p.lead?'אספקה '+p.lead:''].filter(Boolean).join(" · "))+(note?'<br>'+esc(note):'')+'</div></div>'
      +(SHOW_PRICES?'<div class="q num" style="color:'+(p.price&&p.budget&&p.price>p.budget?"var(--clay)":"var(--ink)")+'">'+esc(fmtMoney(p.price,p.currency)||"—")+(p.budget?'<small style="display:block;color:var(--ink3);font-weight:500">תקציב '+esc(fmtMoney(p.budget,p.currency))+'</small>':'')+'</div>':'');
    el.appendChild(d); });
}
function orderNo(){ const y=new Date().getFullYear(); const n=orders.filter(o=>String(o.no||"").includes("PO-"+y)||String(o.no||"").includes("בקשה-"+y)).length+1; return "בקשה-"+y+"-"+String(n).padStart(3,"0"); }
function openOrder(existing){
  const edit=!!existing; const o=existing?JSON.parse(JSON.stringify(existing)):{no:orderNo(),task:"",need:"",note:"",lines:[],status:"sent"};
  const cat=catalog(); const byName=new Map(cat.map(c=>[c.name,c]));
  const sups=[...new Set([...cat.map(c=>c.supplier),...Object.values(SUPPLIERS)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,"he"));
  const tasks=[...new Set(orders.map(x=>x.task).filter(Boolean))];
  let filter=cat.some(c=>c.planned>0&&c.toOrder>0)?"toorder":"all", qtxt="";
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="בקשת רכש"><div class="grab"></div><h2>'+(edit?"עריכת ":"")+'בקשת רכש · '+esc(o.no)+'</h2>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="orDate">תאריך הבקשה</label><input type="date" id="orDate" value="'+esc(isoOf(o.ts||Date.now()))+'"></div>'
      +'<div class="f"><label for="orSent">מצב</label><select id="orSent" style="width:100%;font-family:var(--ui);font-size:1rem;padding:12px 13px;border-radius:var(--r);border:1px solid var(--line);background:var(--card,#fff);color:var(--ink)">'+(o.status==="draft"||o.status==="sent"?'<option value="sent"'+(o.status!=="draft"?' selected':'')+'>נשלח לרכש</option><option value="draft"'+(o.status==="draft"?' selected':'')+'>טיוטה, עוד לא נשלח</option>':'<option value="'+esc(o.status)+'" selected>'+esc((ORDER_ST[o.status]||ORDER_ST.draft)[0])+'</option>')+'</select></div></div>'
    +'<div class="f"><label for="orTask">לטובת איזו משימה</label><input type="text" id="orTask" list="orTasks" placeholder="למשל: חיבורי DC שדה 3 · ריכוז כבלים" autocomplete="off" value="'+esc(o.task)+'"><datalist id="orTasks">'+tasks.map(t=>'<option value="'+esc(t)+'"></option>').join("")+'</datalist></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="orNeed">נדרש עד</label><input type="date" id="orNeed" value="'+esc(o.need||"")+'"></div><div class="f"><label for="orNote">הערה לרכש</label><input type="text" id="orNote" placeholder="דחיפות, אספקה לאתר" value="'+esc(o.note||"")+'"></div></div>'
    +'<div class="f"><label>פריטים</label>'
      +'<div class="search" style="margin-bottom:8px"><input type="text" id="orQ" placeholder="חפש לפי שם, סעיף EBOQ, מק״ט ספק או PO" autocomplete="off"><span class="ico">⌕</span></div>'
      +'<div class="chips" id="orFilt" style="margin-bottom:8px">'+[["toorder","לא הוזמן"],["awaiting","בדרך"],["missing","עוד לא הגיעו"],["arrived","כבר הגיעו"],["all","הכל"],["electrical","חשמל"],["civil","סיביל"],["staging","התארגנות"],["safety","בטיחות"]].map(([k,l])=>'<button type="button" class="chip2" data-f="'+k+'" aria-pressed="'+(k===filter)+'">'+l+'</button>').join("")+'</div>'
      +'<div class="stock" id="orSug"></div>'
      +'<button class="addline" type="button" id="orNew" style="margin-top:8px">+ פריט שלא ברשימה</button></div>'
    +'<div class="f"><label>ההזמנה <span id="orCount" style="font-weight:500;color:var(--ink3)"></span></label><div id="orLines"></div></div>'
    +'<div class="acts"><button class="save" id="orSave" type="button" disabled>שמור</button><button class="cancel" id="orCancel" type="button">ביטול</button></div></div>';
  document.body.appendChild(scrim);
  const q=s=>scrim.querySelector(s);
  const catLabel=id=>(CATS.find(c=>c.id===id)||{}).label||id;
  function drawSug(){
    const box=q("#orSug"); box.innerHTML="";
    const t=qtxt.toLowerCase();
    let list=cat.filter(c=>!o.lines.some(l=>l.name===c.name));
    if(t) list=list.filter(c=>c.name.toLowerCase().includes(t)||c.codes.some(x=>x.toLowerCase()===t||x.toLowerCase().startsWith(t))||(c.sku&&c.sku.toLowerCase().includes(t))||(c.no&&c.no.toLowerCase().includes(t))||c.po.some(p=>p.toLowerCase().includes(t))||(c.supplier&&c.supplier.toLowerCase().includes(t)));
    else if(filter==="toorder") list=list.filter(c=>c.planned>0&&c.toOrder>0);
    else if(filter==="awaiting") list=list.filter(c=>c.awaiting>0);
    else if(filter==="missing") list=list.filter(c=>c.planned>0&&c.arrived===0);
    else if(filter==="arrived") list=list.filter(c=>c.arrived>0);
    else if(filter==="all") list=list.filter(c=>c.planned>0||c.arrived>0);
    else list=list.filter(c=>c.cat===filter);
    if(!list.length){ box.innerHTML='<div class="hint">'+(t?'אין פריט כזה ב-BOM / EBOQ. אפשר להוסיף כפריט חדש.':filter==="toorder"?'כל מה שמתוכנן ב-EBOQ כבר הוזמן או הגיע.':'אין פריטים בסינון הזה.')+'</div>'; return; }
    list.slice(0,12).forEach(c=>{ const b=document.createElement("button"); b.type="button"; b.className="slip";
      const badge=c.planned?(c.toOrder?' · <b style="color:var(--clay)">להזמין '+fmtN(c.toOrder)+'</b>':c.awaiting?' · <b style="color:var(--amber)">בדרך '+fmtN(c.awaiting)+'</b>':' · <b style="color:var(--sage)">הכל הגיע</b>'):'';
      const st=c.planned?('תוכנן '+fmtN(c.planned)+' · הוזמן '+fmtN(c.ordered)+' · הגיעו '+fmtN(c.arrived)+badge):c.codes.length?('ב-EBOQ בלי כמות'+(c.ordered?' · הוזמן '+fmtN(c.ordered):'')+(c.arrived?' · הגיעו '+fmtN(c.arrived):'')):'הגיעו '+fmtN(c.arrived)+' · לא ב-EBOQ';
      const codes=c.codes.length?('סעיף '+(c.codes.length<=3?c.codes.join(", "):c.codes[0]+" +"+(c.codes.length-1))):(c.code?'מק״ט '+c.code:'');
      const pr=SHOW_PRICES&&ROLE==="owner"?cbaPrice((boq.find(l=>c.codes.includes(String(l.code))&&l.en)||{}).en):null;
      const ref=[codes,c.sku?'מק״ט ספק '+c.sku:'',c.po.length?c.po.slice(0,2).join(", ")+(c.po.length>2?" +"+(c.po.length-2):""):'',pr?'CBA ≈ '+fmtMoney(pr.price,pr.currency)+'/'+(pr.unit||"יח'")+(pr.supplier?' '+pr.supplier:''):''].filter(Boolean).join(" · ");
      b.innerHTML='<b>'+esc(c.name)+'</b><span>'+st+' · '+esc(catLabel(c.cat))+(c.supplier?' · '+esc(c.supplier):'')+'</span>'+(ref?'<span style="color:var(--ink3)">'+esc(ref)+'</span>':'')
        +(c.recv&&!c.arrived?'<span style="color:var(--amber)">ברכש רשום שהגיעו '+fmtN(c.recv)+' — אין על זה תעודת משלוח באפליקציה</span>':'');
      b.onclick=()=>{ o.lines.push({name:c.name,code:c.code||"",sku:c.sku||"",boq:c.codes[0]||"",qty:c.toOrder||c.awaiting||1,unit:c.unit,cat:c.cat,supplier:c.supplier||"",note:""}); drawLines(); drawSug(); };
      box.appendChild(b); });
    if(list.length>12){ const h=document.createElement("div"); h.className="hint"; h.textContent="ועוד "+(list.length-12)+" · צמצם בחיפוש"; box.appendChild(h); }
  }
  function drawLines(){
    const box=q("#orLines"); box.innerHTML="";
    q("#orCount").textContent=o.lines.length?"· "+o.lines.length+" פריטים · "+new Set(o.lines.map(l=>l.supplier||"ללא ספק")).size+" ספקים":"";
    if(!o.lines.length){ box.innerHTML='<div class="hint">בחר פריטים מהרשימה למעלה. כל פריט מקבל ספק וקטגוריה לבד, ואפשר לשנות.</div>'; q("#orSave").disabled=true; return; }
    const groups=new Map(); o.lines.forEach((l,i)=>{ const k=l.supplier||"ללא ספק"; (groups.get(k)||groups.set(k,[]).get(k)).push(i); });
    groups.forEach((idx,sup)=>{
      const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--pv)"></i>'+esc(sup)+'<span>'+idx.length+'</span>'; box.appendChild(h);
      idx.forEach(i=>{ const l=o.lines[i]; const r=document.createElement("div"); r.className="dline"; r.style.gridTemplateColumns="1fr 44px";
        r.innerHTML='<div><b style="font-size:.9rem">'+esc(l.name)+'</b>'+(l.boq||l.code?' <small style="color:var(--ink3)">'+esc(l.boq?'סעיף '+l.boq:l.code)+'</small>':'')+(l.sku?' <small style="color:var(--ink3)">· מק״ט ספק '+esc(l.sku)+'</small>':'')+'</div><button class="x" type="button" aria-label="הסר">×</button>'
          +'<div class="r2" style="grid-template-columns:80px 70px 1fr"><input type="text" inputmode="decimal" value="'+esc(l.qty)+'" aria-label="כמות" placeholder="כמות"><input type="text" value="'+esc(l.unit)+'" aria-label="יחידה" placeholder="יח׳"><select aria-label="קטגוריה">'+["civil","construction","electrical","staging","safety","panels","tools","containers"].map(c=>'<option value="'+c+'"'+(l.cat===c?' selected':'')+'>'+catLabel(c)+'</option>').join("")+'</select></div>'
          +'<div class="r2" style="grid-template-columns:1fr 1fr"><input type="text" list="orSups" value="'+esc(l.supplier)+'" placeholder="ספק" aria-label="ספק"><input type="text" value="'+esc(l.note||"")+'" placeholder="הערה לשורה" aria-label="הערה"></div>';
        const [qty,unit,sel]=r.querySelectorAll(".r2")[0].children; const [sup,note]=r.querySelectorAll(".r2")[1].children;
        qty.oninput=e=>{ l.qty=Number(String(e.target.value).replace(/[^\d.]/g,""))||0; check(); }; unit.oninput=e=>{ l.unit=e.target.value; }; sel.onchange=e=>{ l.cat=e.target.value; };
        sup.onchange=e=>{ l.supplier=e.target.value.trim(); if(l.supplier) SUPPLIERS[l.name]=l.supplier; drawLines(); }; note.oninput=e=>{ l.note=e.target.value; };
        r.querySelector(".x").onclick=()=>{ o.lines.splice(i,1); drawLines(); drawSug(); };
        box.appendChild(r); });
    });
    if(!q("#orSups")){ const dl=document.createElement("datalist"); dl.id="orSups"; dl.innerHTML=sups.map(x=>'<option value="'+esc(x)+'"></option>').join(""); box.appendChild(dl); }
    check();
  }
  function check(){ q("#orSave").disabled=!(o.lines.length&&o.lines.every(l=>l.qty>0)&&q("#orTask").value.trim()); }
  q("#orQ").oninput=e=>{ qtxt=e.target.value.trim(); drawSug(); };
  q("#orFilt").onclick=e=>{ const b=e.target.closest("[data-f]"); if(!b) return; filter=b.dataset.f; scrim.querySelectorAll("#orFilt .chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); drawSug(); };
  q("#orTask").oninput=check;
  q("#orNew").onclick=()=>{ const nm=qtxt||""; o.lines.push({name:nm||"פריט חדש",code:"",qty:1,unit:"יח'",cat:filter==="all"||filter==="missing"||filter==="partial"?"electrical":filter,supplier:"",note:""}); drawLines();
    const last=q("#orLines").querySelectorAll(".dline"); const el=last[last.length-1]; if(el&&!nm){ const b=el.querySelector("b"); b.contentEditable="true"; b.focus(); b.oninput=()=>{ o.lines[o.lines.length-1].name=b.textContent.trim(); }; } };
  q("#orCancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  document.addEventListener("keydown",esck);
  q("#orSave").onclick=async()=>{
    const b=q("#orSave"); b.disabled=true; b.textContent="שומר…";
    const dv=q("#orDate").value; let ts=o.ts||Date.now(); if(dv&&dv!==isoOf(ts)) ts=dv===isoOf(Date.now())?Date.now():new Date(dv+"T12:00:00").getTime();
    const id=o.id||("or"+Date.now());
    const doc={...o,id,no:o.no,ts,dateText:fmtD(ts),task:q("#orTask").value.trim(),need:q("#orNeed").value||"",note:q("#orNote").value.trim(),status:q("#orSent").value||o.status||"draft",by:o.by||actorName(),
      lines:o.lines.map(l=>{ const x={name:l.name,code:l.code||"",sku:l.sku||"",boq:l.boq||"",qty:Number(l.qty)||0,unit:l.unit||"יח'",cat:l.cat,supplier:l.supplier||"",note:l.note||""}; if(l.po){ x.po=l.po; if(l.poLine!=null) x.poLine=l.poLine; } return x; }),updated:Date.now()};
    try{ if(DB) await DB.doc("orders/"+id).set(doc); else { orders=orders.filter(x=>x.id!==id); orders.push(doc); ls.set("orders",JSON.stringify(orders)); } }
    catch(e){ b.disabled=false; b.textContent="שמור"; toast("השמירה נכשלה."); return; }
    { const sp={}; doc.lines.forEach(l=>{ if(l.name&&l.supplier) sp[l.name]=l.supplier; }); mergeSettingsMap("suppliers",sp).catch(()=>{}); }   // הספק של כל פריט נזכר לבקשה הבאה
    logAct("order",edit?"edit":"add",(edit?"עודכנה":"נוצרה")+" בקשת רכש "+doc.no+" · "+doc.lines.length+" פריטים · "+new Set(doc.lines.map(l=>l.supplier||"ללא ספק")).size+" ספקים · "+doc.task,id);
    close(); renderOrders(); openOrderDetail(doc);
  };
  function esck(ev){ if(ev.key==="Escape") close(); }
  function close(){ document.removeEventListener("keydown",esck); scrim.remove(); }
  drawSug(); drawLines();
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a&&scrim.contains(a)) a.blur(); });
}
function orderGroups(o){ const g=new Map(); (o.lines||[]).forEach(l=>{ const k=l.supplier||"ללא ספק"; (g.get(k)||g.set(k,[]).get(k)).push(l); }); return g; }
function receivedSince(o,l){ return Math.max(0,(demoStock?[]:deliveries).filter(n=>n.source!=="bom"&&n.ts>=o.ts).reduce((s,n)=>s+(n.lines||[]).filter(x=>sameItem(x,l)).reduce((a,x)=>a+(Number(x.qty)||0)*unitMult(x.unit),0),0)); }
/* בקשות מול הזמנות: כל שורת בקשה שנשלחה לרכש נסגרת מול שורות ה-PO של הרכש ומול תעודות המשלוח.
   קישור ידני (l.po + l.poLine) קודם; אחר כך לפי פריט (סעיף EBOQ / שם / מק״ט ספק), הבקשה הוותיקה קודם, PO מיומיים לפני הבקשה והלאה.
   הגיע: תעודות משלוח בלבד (כלל 4), מיום לפני הבקשה והלאה, כל שורת תעודה נספרת פעם אחת. */
const REQ_ST={ok:["הגיע","var(--sage)"],none:["ביקשתי, לא הוזמן","var(--clay)"],fresh:["ממתין לרכש","var(--info)"],hold:["PO מוקפא","var(--clay)"],short:["הוזמן פחות","var(--amber)"],late:["הוזמן, לא הגיע · באיחור","var(--clay)"],wait:["הוזמן, בדרך","var(--info)"]};
const poLineDue=l=>{ const m=String((l&&l.due)||"").match(/^(\d\d)\/(\d\d)\/(\d\d)$/); return m?new Date(2000+ +m[3],+m[2]-1,+m[1],23,59).getTime():0; };
const reqSame=(x,l)=>{ const xb=x.boq&&x.boq!=="-"?String(x.boq):"", lb=l.boq&&l.boq!=="-"?String(l.boq):"";
  if(xb&&lb){ if(xb===lb) return true; const n=boqName(xb); if(n&&n===boqName(lb)) return true; }
  if(x.sku&&l.sku&&String(x.sku)===String(l.sku)) return true; const n=(x.name||"").trim(); return !!n&&n===(l.name||"").trim(); };
let REQM=null;
function requestMatch(){
  const now=Date.now(), D=864e5;
  const R=(demoStock?[]:orders).filter(o=>o.status!=="draft"&&o.status!=="cancelled").slice().sort((a,b)=>a.ts-b.ts);
  const P=(demoStock?[]:POS).filter(p=>p.status!=="cancelled").slice().sort((a,b)=>a.ts-b.ts);
  const cap=new Map(); P.forEach(p=>(p.lines||[]).forEach((l,i)=>{ if(!l.skip) cap.set(p.no+"#"+i,(Number(l.qty)||0)*unitMult(l.unit)); }));
  const rows=[]; R.forEach(o=>(o.lines||[]).forEach((l,li)=>rows.push({o,l,li,qty:(Number(l.qty)||0)*unitMult(l.unit),ordered:0,hold:0,pos:[],arrived:0})));
  const take=(r,p,i)=>{ const pl=(p.lines||[])[i]; if(!pl||pl.skip) return; const k=p.no+"#"+i, c=cap.get(k)||0, need=r.qty-r.ordered-r.hold; if(need<=0||c<=0) return;
    const q=Math.min(need,c); cap.set(k,c-q); if(p.status==="hold") r.hold+=q; else r.ordered+=q; r.pos.push({p,i,pl,q,hold:p.status==="hold",due:poLineDue(pl)}); };
  rows.forEach(r=>{ if(!r.l.po) return; const p=P.find(x=>x.no===r.l.po); if(!p) return;
    if(r.l.poLine!=null&&r.l.poLine!=="") take(r,p,Number(r.l.poLine)); else (p.lines||[]).forEach((pl,i)=>{ if(reqSame(pl,r.l)) take(r,p,i); }); });
  rows.forEach(r=>{ if(r.l.po) return; P.forEach(p=>{ if(p.ts<r.o.ts-2*D) return; (p.lines||[]).forEach((pl,i)=>{ if(reqSame(pl,r.l)) take(r,p,i); }); }); });
  const dcap=new Map(); const N=(demoStock?[]:deliveries).filter(n=>n.source!=="bom").slice().sort((a,b)=>a.ts-b.ts);
  rows.forEach(r=>{ N.forEach(n=>{ if(n.ts<r.o.ts-D) return; (n.lines||[]).forEach((x,j)=>{ if(r.arrived>=r.qty) return; if(!(reqSame(x,r.l)||r.pos.some(m=>reqSame(x,m.pl)))) return;
      const k=(n.id||n.ts)+"#"+j; const c=dcap.has(k)?dcap.get(k):(Number(x.qty)||0)*unitMult(x.unit); const q=Math.min(c,r.qty-r.arrived); if(q<=0) return; dcap.set(k,c-q); r.arrived+=q; r.lastArr=n.ts; }); }); });
  rows.forEach(r=>{ const due=Math.max(0,...r.pos.map(m=>m.due)); const lastPo=Math.max(0,...r.pos.map(m=>m.p.ts)); const need=r.o.need?new Date(r.o.need+"T23:59:00").getTime():0;
    r.due=due||0;
    if(r.qty>0&&r.arrived>=r.qty) r.k="ok";
    else if(!r.ordered&&r.hold) r.k="hold";
    else if(!r.ordered) r.k=now-r.o.ts>3*D?"none":"fresh";
    else if(r.ordered<r.qty) r.k="short";
    else r.k=((due&&due<now)||(!due&&lastPo&&lastPo+14*D<now)||(need&&need<now))?"late":"wait"; });
  // PO שיצאו אחרי הבקשה הראשונה ואין מולן בקשה
  const first=R.length?R[0].ts-2*D:Infinity; const extra=[];
  P.filter(p=>p.ts>=first&&p.status!=="hold").forEach(p=>(p.lines||[]).forEach((pl,i)=>{ if(pl.skip||/הובלה|פיקדון/.test(pl.name||"")) return; const full=(Number(pl.qty)||0)*unitMult(pl.unit), left=cap.get(p.no+"#"+i)||0; if(full&&left>=full) extra.push({p,i,pl,left}); }));
  const by=new Map(); rows.forEach(r=>by.set(r.o.id+"#"+r.li,r));
  REQM={rows,extra,by}; return REQM;
}
const reqOf=(o,li)=>(REQM||requestMatch()).by.get(o.id+"#"+li);
function reqLineHtml(r){ const st=REQ_ST[r.k]||REQ_ST.wait; const u=esc(r.l.unit||"");
  return '<small style="color:var(--ink3)">ביקשתי '+fmtN(r.qty)+' · הוזמן '+fmtN(r.ordered)+(r.hold?' (+'+fmtN(r.hold)+' מוקפא)':'')+' · הגיעו '+fmtN(r.arrived)+' '+u+'</small>'
    +(r.pos.length?'<br><small style="color:var(--ink3)">'+esc(r.pos.map(m=>m.p.no+(m.due?' · אספקה '+fmtD(m.due):'')).join(" · "))+(r.l.po?' · קישור ידני':'')+'</small>':'')
    +'<br><small style="color:'+st[1]+';font-weight:700">'+st[0]+'</small>'; }
function renderRequests(){
  const el=$("#orReq"); if(!el) return; const M=REQM||requestMatch(); el.innerHTML="";
  const open=M.rows.filter(r=>r.k!=="ok");
  if(!M.rows.length){ foldSum("reqs",""); el.innerHTML='<div class="empty" style="padding:16px">עוד אין בקשות שנשלחו לרכש.<br>«בקשת רכש חדשה» למעלה, או להעלות לתיקיית הפרויקט את מה ששלחתי לרכש ואת אישורי ההזמנה, וזה ייקלט כאן.</div>'; return; }
  const cnt=k=>M.rows.filter(r=>r.k===k).length; const bad=cnt("none")+cnt("hold")+cnt("short")+cnt("late");
  foldSum("reqs",bad?bad+" דורשים טיפול":open.length?open.length+" בדרך":"הכל הגיע");
  const groups=[["none","ביקשתי ולא הוזמן","var(--clay)",r=>r.k==="none"||r.k==="hold"],["short","הוזמן פחות ממה שביקשתי","var(--amber)",r=>r.k==="short"],["late","הוזמן ולא הגיע · באיחור","var(--clay)",r=>r.k==="late"],["wait","ממתין לרכש / בדרך בזמן","var(--info)",r=>r.k==="wait"||r.k==="fresh"]];
  groups.forEach(([k,label,color,f])=>{ const its=M.rows.filter(f); if(!its.length) return;
    const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:'+color+'"></i>'+esc(label)+'<span>'+its.length+'</span>'; el.appendChild(h);
    its.slice().sort((a,b)=>a.o.ts-b.o.ts).slice(0,12).forEach(r=>{ const d=document.createElement("button"); d.type="button"; d.className="holder"; d.style.cssText="width:100%;text-align:right;background:none;border:0;border-bottom:1px solid var(--line2);font:inherit;color:inherit;cursor:pointer";
      const gap=k==="short"?r.qty-r.ordered:k==="wait"||k==="late"?r.qty-r.arrived:r.qty;
      const st=REQ_ST[r.k];
      d.innerHTML='<div class="who">'+esc(r.l.name)+'<div class="what">'+esc(r.o.no)+' · '+fmtD(r.o.ts)+' · ביקשתי '+fmtN(r.qty)+(r.ordered?' · הוזמן '+fmtN(r.ordered):'')+(r.arrived?' · הגיעו '+fmtN(r.arrived):'')+(r.pos.length?' · '+esc([...new Set(r.pos.map(m=>m.p.no))].join(", ")):'')+(r.due&&r.k!=="ok"?' · אספקה '+fmtD(r.due):'')+(r.k==="fresh"||r.k==="hold"?' · <b style="color:'+st[1]+'">'+st[0]+'</b>':'')+'</div></div><div class="q num" style="color:'+color+'">'+fmtN(gap)+' <small>'+esc(r.l.unit||"")+'</small></div>';
      d.onclick=()=>openOrderDetail(r.o); el.appendChild(d); });
    if(its.length>12){ const d=document.createElement("div"); d.className="hint"; d.textContent="ועוד "+(its.length-12); el.appendChild(d); } });
  const ok=cnt("ok"); if(ok){ const d=document.createElement("div"); d.className="hint"; d.textContent=ok+" שורות בקשה הגיעו במלואן."; el.appendChild(d); }
  if(M.extra.length){ const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:var(--ink3)"></i>הוזמן בלי בקשה שלי<span>'+M.extra.length+'</span>'; el.appendChild(h);
    M.extra.slice(-6).reverse().forEach(x=>{ const d=document.createElement("button"); d.type="button"; d.className="holder"; d.style.cssText="width:100%;text-align:right;background:none;border:0;border-bottom:1px solid var(--line2);font:inherit;color:inherit;cursor:pointer";
      d.innerHTML='<div class="who">'+esc(x.pl.name)+'<div class="what">'+esc(x.p.no)+' · '+esc(shortSup(x.p.supplier||""))+' · '+esc(fmtDT(x.p.dateText)||"")+'</div></div><div class="q num" style="color:var(--ink3)">'+fmtN(x.left)+' <small>'+esc(x.pl.unit||"")+'</small></div>';
      d.onclick=()=>openPoDetail(x.p); el.appendChild(d); });
    const d=document.createElement("div"); d.className="hint"; d.textContent="שורות PO שיצאו מאז הבקשה הראשונה ולא נמצאה מולן בקשה. אם זו בקשה שלי בשם אחר: לפתוח את הבקשה ולקשר ידנית."; el.appendChild(d); }
}
function reqMissingText(){ const M=REQM||requestMatch(); const pick=k=>M.rows.filter(r=>k.includes(r.k));
  const sec=(title,rs,f)=>rs.length?"*"+title+"*\n"+rs.map((r,i)=>(i+1)+". "+r.l.name+(r.l.boq?" (סעיף "+r.l.boq+")":"")+" — "+f(r)).join("\n"):"";
  return ["*"+SITE.name+" · בקשות רכש פתוחות · "+fmtD(Date.now())+"*",
    sec("ביקשתי ועוד לא הוזמן",pick(["none","hold"]),r=>fmtN(r.qty)+" "+(r.l.unit||"")+" · ביקשתי ב-"+fmtD(r.o.ts)+(r.k==="hold"?" · ה-PO מוקפא":"")),
    sec("הוזמן פחות ממה שביקשתי",pick(["short"]),r=>"ביקשתי "+fmtN(r.qty)+", הוזמן "+fmtN(r.ordered)+" "+(r.l.unit||"")+" · "+[...new Set(r.pos.map(m=>m.p.no))].join(", ")),
    sec("הוזמן ולא הגיע, עבר תאריך",pick(["late"]),r=>"חסר "+fmtN(r.qty-r.arrived)+" "+(r.l.unit||"")+" · "+[...new Set(r.pos.map(m=>m.p.no))].join(", ")+(r.due?" · אספקה הייתה ב-"+fmtD(r.due):""))
  ].filter(Boolean).join("\n\n"); }
function openPoLinkPicker(o,li,done){
  const l=o.lines[li]; const P=(demoStock?[]:POS).filter(p=>p.status!=="cancelled"&&p.ts>=o.ts-45*864e5).slice().sort((a,b)=>b.ts-a.ts);
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="קישור ל-PO"><div class="grab"></div><h2>קישור ל-PO</h2><div class="note-card">'+esc(l.name)+' · ביקשתי '+fmtN(l.qty)+' '+esc(l.unit||"")+'</div>'
    +'<div class="search" style="margin-bottom:8px"><input type="text" id="plQ" placeholder="חפש PO, ספק או פריט" autocomplete="off"><span class="ico">⌕</span></div><div class="stock" id="plList"></div>'
    +'<div class="acts">'+(l.po?'<button class="ghost" type="button" id="plClear">בטל קישור ידני</button>':'')+'<button class="cancel" type="button" style="flex:1">סגור</button></div></div>';
  document.body.appendChild(scrim); const q=s=>scrim.querySelector(s); const close=()=>scrim.remove();
  q(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  const draw=t=>{ const box=q("#plList"); box.innerHTML=""; t=(t||"").toLowerCase(); let n=0;
    P.forEach(p=>(p.lines||[]).forEach((pl,i)=>{ if(pl.skip||n>=40) return; if(t&&!(p.no.toLowerCase().includes(t)||(p.supplier||"").toLowerCase().includes(t)||(pl.name||"").toLowerCase().includes(t)||String(pl.boq||"").startsWith(t))) return; n++;
      const b=document.createElement("button"); b.type="button"; b.className="slip"; const on=l.po===p.no&&Number(l.poLine)===i;
      b.innerHTML='<b>'+esc(pl.name)+'</b><span>'+esc(p.no)+' · '+esc(shortSup(p.supplier||""))+' · '+esc(fmtDT(p.dateText)||"")+' · '+fmtN(pl.qty)+' '+esc(pl.unit||"")+(pl.boq&&pl.boq!=="-"?' · סעיף '+esc(pl.boq):'')+(p.status==="hold"?' · מוקפא':'')+'</span>'+(on?'<span class="sigok">מקושר</span>':'');
      b.onclick=async()=>{ close(); await done(p.no,i); }; box.appendChild(b); }));
    if(!n) box.innerHTML='<div class="hint">אין שורת PO כזו מ-45 יום לפני הבקשה והלאה.</div>'; };
  q("#plQ").oninput=e=>draw(e.target.value.trim()); draw("");
  const cl=q("#plClear"); if(cl) cl.onclick=async()=>{ close(); await done("",null); };
}
async function setReqLink(o,li,po,poLine){
  const doc=JSON.parse(JSON.stringify(o)); const l=doc.lines[li]; if(po){ l.po=po; l.poLine=poLine; } else { delete l.po; delete l.poLine; } doc.updated=Date.now();
  try{ if(DB) await DB.doc("orders/"+o.id).set(doc); else { orders=orders.map(x=>x.id===o.id?doc:x); ls.set("orders",JSON.stringify(orders)); } }catch(e){ toast("השמירה נכשלה."); return null; }
  orders=orders.map(x=>x.id===o.id?doc:x); REQM=null;
  logAct("order","edit",(po?"קושרה":"בוטל קישור")+" שורת בקשה "+doc.no+" · "+l.name+(po?" → "+po:""),o.id); renderOrders(); return doc;
}
const lineRef=l=>[l.sku?"מק״ט ספק "+l.sku:"",l.boq?"סעיף "+l.boq:(l.code&&!l.name.includes(l.code)?"מק״ט "+l.code:"")].filter(Boolean).join(" · ");
function orderText(o,sup){
  const g=orderGroups(o); const sups=sup?[sup]:[...g.keys()];
  return sups.map(sp=>{ const L=g.get(sp)||[]; const cats=[...new Set(L.map(l=>(CATS.find(c=>c.id===l.cat)||{}).label||l.cat))];
    return "*הזמנת רכש "+o.no+" · "+sp+"*\n"+(SITE.company||"BELECTRIC")+" · "+SITE.name+"\nלטובת: "+(o.task||"")+" · "+cats.join(" / ")+(o.need?"\nנדרש עד: "+fmtDT(o.need.split("-").reverse().join("/")):"")+"\n"
      +L.map((l,i)=>(i+1)+". "+l.name+(lineRef(l)?" ("+lineRef(l)+")":"")+" — "+fmtN(l.qty)+" "+(l.unit||"")+(l.note?" · "+l.note:"")).join("\n")
      +(o.note?"\nהערה: "+o.note:"")+"\nמבקש: "+(o.by||actorName())+" · "+fmtD(o.ts); }).join("\n\n");
}
async function orderPdf(o,sup){
  try{ await document.fonts.load("700 28px Alef"); await document.fonts.load("400 24px Alef"); }catch(e){}
  const g=orderGroups(o); const sups=sup?[sup]:[...g.keys()]; const pages=[];
  for(const sp of sups){
    const L=g.get(sp)||[]; const W=1240,H=1754; const c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
    x.fillStyle="#fff"; x.fillRect(0,0,W,H); x.direction="rtl"; x.textAlign="right"; const R=W-80, Lx=80;
    x.fillStyle="#E40033"; x.fillRect(0,0,W,14);
    x.fillStyle="#E40033"; x.font="700 30px Alef, Arial"; x.fillText((SITE.company||"BELECTRIC"),R,80);
    x.fillStyle="#121212"; x.font="700 44px Alef, Arial"; x.fillText("הזמנת רכש "+o.no,R,140);
    x.fillStyle="#666B6E"; x.font="400 26px Alef, Arial"; x.fillText(SITE.name+" · תאריך "+fmtD(o.ts)+(o.need?" · נדרש עד "+fmtDT(o.need.split("-").reverse().join("/")):""),R,185);
    x.fillStyle="#121212"; x.font="700 34px Alef, Arial"; x.fillText("ספק: "+sp,R,250);
    x.font="400 26px Alef, Arial"; x.fillStyle="#3F4447"; x.fillText("לטובת: "+(o.task||"—"),R,292);
    const cats=[...new Set(L.map(l=>(CATS.find(cc=>cc.id===l.cat)||{}).label||l.cat))]; x.fillText("קטגוריה: "+cats.join(" / "),R,330);
    // table
    let y=400; const cols=[["#",50],["מק״ט",130],["פריט",560],["כמות",120],["יחידה",100],["הערה",200]];
    x.fillStyle="#F2F2F2"; x.fillRect(Lx,y-36,W-160,50); x.fillStyle="#121212"; x.font="700 24px Alef, Arial";
    let cx=R; cols.forEach(([n,w])=>{ x.fillText(n,cx-10,y); cx-=w; });
    y+=40; x.font="400 24px Alef, Arial";
    const wrap=(t,maxW)=>{ const words=String(t).split(" "); const lines=[]; let cur=""; words.forEach(w=>{ const tr=cur?cur+" "+w:w; if(x.measureText(tr).width>maxW&&cur){ lines.push(cur); cur=w; } else cur=tr; }); if(cur) lines.push(cur); return lines.slice(0,3); };
    L.forEach((l,i)=>{
      const nameLines=wrap(l.name,540), noteLines=wrap(l.note||"",190); const rows=Math.max(nameLines.length,noteLines.length,1); const rh=34*rows+14;
      if(y+rh>H-220){ x.fillStyle="#666B6E"; x.font="400 22px Alef, Arial"; x.fillText("המשך בעמוד הבא",R,H-180); return; }
      if(i%2) { x.fillStyle="#FAFAFA"; x.fillRect(Lx,y-28,W-160,rh); }
      x.fillStyle="#121212"; x.font="400 24px Alef, Arial"; cx=R;
      const put=(t,w,bold)=>{ x.font=(bold?"700":"400")+" 24px Alef, Arial"; x.fillText(String(t),cx-10,y); cx-=w; };
      put(i+1,50); put(l.sku||l.code||l.boq||"",130); cx-=0; nameLines.forEach((t,k)=>{ x.font="400 24px Alef, Arial"; x.fillText(t,cx-10,y+k*34); }); cx-=560;
      put(fmtN(l.qty),120,true); put(l.unit||"",100); noteLines.forEach((t,k)=>{ x.font="400 22px Alef, Arial"; x.fillStyle="#3F4447"; x.fillText(t,cx-10,y+k*34); }); x.fillStyle="#121212";
      y+=rh; x.strokeStyle="#D9DADA"; x.lineWidth=1; x.beginPath(); x.moveTo(Lx,y-26); x.lineTo(W-80,y-26); x.stroke();
    });
    x.fillStyle="#121212"; x.font="700 26px Alef, Arial"; x.fillText("סה״כ "+L.length+" פריטים",R,y+16);
    if(o.note){ x.font="400 24px Alef, Arial"; x.fillStyle="#3F4447"; x.fillText("הערה: "+o.note,R,y+60); }
    x.fillStyle="#666B6E"; x.font="400 24px Alef, Arial";
    x.fillText("מבקש: "+(o.by||actorName())+"   ________________",R,H-130); x.textAlign="left"; x.fillText("אישור מנהל הקמה: ________________",Lx,H-130); x.textAlign="right";
    x.font="400 20px Alef, Arial"; x.fillText("הופק מיומן אתר · "+fmtD(Date.now()),R,H-70);
    const jb=await canvasBlob(c,0.9); pages.push({bytes:new Uint8Array(await jb.arrayBuffer()),w:W,h:H});
  }
  const blob=await buildPdf(pages,"הזמנת רכש "+o.no); await saveFile("הזמנת-רכש-"+o.no+(sup?"-"+sup.replace(/[\\/:*?"<>|]/g,""):"")+".pdf",blob);
}
async function setOrderStatus(o,st){
  const doc={...o,status:st,updated:Date.now()};
  try{ if(DB) await DB.doc("orders/"+o.id).set(doc); else { orders=orders.map(x=>x.id===o.id?doc:x); ls.set("orders",JSON.stringify(orders)); } }catch(e){ toast("העדכון נכשל."); return; }
  logAct("order","edit","הזמנה "+o.no+" → "+ORDER_ST[st][0],o.id); renderOrders();
}
function openOrderDetail(o){
  o=orders.find(x=>x.id===o.id)||o;
  const g=orderGroups(o); const scrim=document.createElement("div"); scrim.className="scrim";
  const st=ORDER_ST[o.status]||ORDER_ST.draft;
  let html='<div class="sheet" role="dialog" aria-modal="true" aria-label="בקשת רכש"><div class="grab"></div><h2>'+esc(o.no)+' <span class="role-badge" style="background:var(--line2);color:'+st[1]+'">'+st[0]+'</span></h2>'
    +'<div class="kv"><span>'+fmtD(o.ts)+'</span>'+(o.need?'<span>נדרש עד <b>'+esc(fmtDT(o.need.split("-").reverse().join("/")))+'</b></span>':'')+'<span>מבקש <b>'+esc(o.by||"")+'</b></span></div>'
    +'<div class="note-card">לטובת: <b>'+esc(o.task||"—")+'</b>'+(o.note?' · '+esc(o.note):'')+'</div>';
  g.forEach((L,sp)=>{ html+='<div class="card" style="padding:12px"><h3 style="font-size:.95rem">'+esc(sp)+' <small style="color:var(--ink3);font-weight:500">· '+L.length+' פריטים</small></h3><div class="dlines" style="margin-top:8px">'
      +L.map(l=>{ const li=(o.lines||[]).indexOf(l); const r=o.status!=="draft"&&o.status!=="cancelled"?reqOf(o,li):null; return '<div><span>'+esc(l.name)+(lineRef(l)?' <small style="color:var(--ink3)">'+esc(lineRef(l))+'</small>':'')+' <small style="color:var(--ink3)">· '+esc((CATS.find(c=>c.id===l.cat)||{}).label||"")+'</small>'+(l.note?'<br><small style="color:var(--ink3)">'+esc(l.note)+'</small>':'')+(r?'<br>'+reqLineHtml(r):'')+(r&&ROLE!=="viewer"?'<br><button type="button" class="chip2" data-link="'+li+'" style="margin-top:4px">'+(l.po?'קישור ל-PO: '+esc(l.po)+' · שנה':'קשר ידנית ל-PO')+'</button>':'')+'</span><b>'+fmtN(l.qty)+' '+esc(l.unit||"")+'</b></div>'; }).join("")
      +'</div><div class="row2" style="margin:10px 0 0"><button class="ghost" type="button" data-pdf="'+esc(sp)+'">PDF לספק</button><button class="ghost" type="button" data-txt="'+esc(sp)+'">העתק טקסט</button></div></div>'; });
  const acts=[]; if(ROLE!=="viewer"){ if(o.status==="draft") acts.push(["sent","סמן: נשלח לרכש","var(--info-fill)"]); if(o.status==="sent"||o.status==="partial") acts.push(["received","סמן: התקבל","var(--sage-fill)"]); if(o.status==="sent") acts.push(["partial","הגיע חלקית","var(--amber-fill)"]); if(o.status!=="cancelled"&&ROLE==="owner") acts.push(["cancelled","בטל בקשה","var(--clay)"]); }
  html+='<div class="row2" style="margin-top:4px">'+(g.size>1?'<button class="ghost" type="button" id="odPdfAll">PDF לכל הספקים</button>':'')+'<button class="ghost" type="button" id="odCsv">אקסל</button>'+(ROLE!=="viewer"?'<button class="ghost" type="button" id="odEdit">ערוך</button>':'')+'</div>'
    +(acts.length?'<div class="chips">'+acts.map(a=>'<button type="button" class="chip2" data-st="'+a[0]+'" style="border-color:'+a[2]+'">'+a[1]+'</button>').join("")+'</div>':'')
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>';
  scrim.innerHTML=html; document.body.appendChild(scrim);
  const close=()=>scrim.remove(); scrim.querySelector(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  scrim.querySelectorAll("[data-pdf]").forEach(b=>b.onclick=async()=>{ b.disabled=true; b.textContent="מכין…"; await orderPdf(o,b.dataset.pdf); b.disabled=false; b.textContent="PDF לספק"; });
  scrim.querySelectorAll("[data-txt]").forEach(b=>b.onclick=()=>copyText(orderText(o,b.dataset.txt)));
  const pa=scrim.querySelector("#odPdfAll"); if(pa) pa.onclick=async()=>{ pa.disabled=true; pa.textContent="מכין…"; await orderPdf(o); pa.disabled=false; pa.textContent="PDF לכל הספקים"; };
  scrim.querySelector("#odCsv").onclick=()=>saveFile("הזמנת-רכש-"+o.no+".csv",new Blob([csvOf(["הזמנה","ספק","סעיף EBOQ","מק״ט ספק","פריט","כמות","יחידה","קטגוריה","לטובת","נדרש עד","הערה"],[...g.entries()].flatMap(([sp,L])=>L.map(l=>[o.no,sp,l.boq||l.code||"",l.sku||"",l.name,l.qty,l.unit,(CATS.find(c=>c.id===l.cat)||{}).label||l.cat,o.task,o.need?o.need.split("-").reverse().join("/"):"",l.note])))],{type:"text/csv"}));
  const ed=scrim.querySelector("#odEdit"); if(ed) ed.onclick=()=>{ close(); openOrder(o); };
  scrim.querySelectorAll("[data-link]").forEach(b=>b.onclick=()=>{ const li=Number(b.dataset.link); openPoLinkPicker(o,li,async(po,pl)=>{ const d=await setReqLink(o,li,po,pl); if(d){ close(); openOrderDetail(d); } }); });
  scrim.querySelectorAll("[data-st]").forEach(b=>b.onclick=async()=>{ if(b.dataset.st==="cancelled"&&!(await ask("לבטל את הבקשה "+o.no+"?","בטל"))) return; await setOrderStatus(o,b.dataset.st); close(); });
}
function renderOrders(){
  if(!$("#viewOrders")) return;
  const cat=catalog(); const list=(demoStock?[]:orders).slice().sort((a,b)=>b.ts-a.ts); REQM=null; const M=requestMatch();
  const open=list.filter(o=>o.status==="sent"||o.status==="partial"), drafts=list.filter(o=>o.status==="draft");
  const toOrder=cat.filter(c=>c.planned>0&&c.toOrder>0), awaiting=cat.filter(c=>c.awaiting>0), planned=cat.filter(c=>c.planned>0);
  const miss=cid=>toOrder.filter(c=>c.cat===cid).length;
  $("#orBig").textContent=fmtN(toOrder.length); $("#orCap").textContent=toOrder.length===1?"פריט ב-EBOQ שעוד לא הוזמן":"פריטים ב-EBOQ שעוד לא הוזמנו";
  $("#orSub").innerHTML=planned.length
    ? 'ב-BOM / EBOQ <b>'+fmtN(planned.length)+'</b> פריטים · <b style="color:var(--amber)">'+fmtN(awaiting.length)+'</b> הוזמנו ועוד לא נקלטו · <b>'+fmtN(planned.filter(c=>!c.toOrder&&!c.awaiting).length)+'</b> הגיעו במלואם'+(miss("electrical")?' · לא הוזמן: חשמל <b>'+miss("electrical")+'</b>':'')+(miss("civil")?' · סיביל <b>'+miss("civil")+'</b>':'')+(miss("construction")?' · קונסטרוקציה <b>'+miss("construction")+'</b>':'')
    : 'אין עדיין EBOQ. ייבוא כתב הכמויות (חשמל, סיביל, התארגנות) מראה מה עוד לא הוזמן ומה בדרך.';
  const reqBad=M.rows.filter(r=>r.k==="none"||r.k==="hold"||r.k==="short"||r.k==="late").length;
  $("#orStats").innerHTML='<div class="stat"><div class="v num"'+(reqBad?' style="color:var(--clay)"':'')+'>'+fmtN(reqBad)+'</div><div class="k">בקשות שדורשות טיפול</div></div><div class="stat"><div class="v num">'+fmtN((demoStock?[]:POS).filter(p=>poStatus(p).k!=="ok").length)+'</div><div class="k">PO פתוחים ברכש</div></div><div class="stat"><div class="v num" style="color:var(--amber)">'+fmtN(awaiting.length)+'</div><div class="k">פריטים בדרך</div></div>';
  const L=$("#orList"); L.innerHTML="";
  $("#orCount2").textContent=list.length?list.length+"":"";
  if(!list.length) L.innerHTML='<div class="empty">אין עדיין בקשות רכש.<br>«בקשת רכש חדשה»: בוחרים פריטים מה-BOM / EBOQ או כותבים פריט חופשי. בקשה ששלחתי קודם במייל נרשמת עם התאריך שלה.</div>';
  list.slice(0,orderMax).forEach(o=>{ const st=ORDER_ST[o.status]||ORDER_ST.draft; const g=orderGroups(o);
    const b=document.createElement("button"); b.type="button"; b.className="slip";
    const rr=o.status!=="draft"&&o.status!=="cancelled"?(o.lines||[]).map((l,li)=>M.by.get(o.id+"#"+li)).filter(Boolean):[]; const pr=rr.filter(r=>r.k==="ok").length, bad=rr.filter(r=>r.k==="none"||r.k==="hold"||r.k==="short"||r.k==="late").length;
    b.innerHTML='<b>'+esc(o.no)+' · '+esc(o.task||"")+'</b><span class="sigok" style="background:var(--line2);color:'+(rr.length&&pr===rr.length?"var(--sage)":st[1])+'">'+(rr.length&&pr===rr.length?"הגיע במלואו":st[0]+(pr?' · '+pr+'/'+rr.length+' הגיעו':''))+(bad?' · <span style="color:var(--clay)">'+bad+' דורשים טיפול</span>':'')+'</span><span>'+fmtD(o.ts)+' · '+(o.lines||[]).length+' פריטים · '+[...g.keys()].join(", ")+'</span>';
    b.onclick=()=>openOrderDetail(o); L.appendChild(b); });
  if(list.length>orderMax){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent="עוד "+(list.length-orderMax); m.onclick=()=>{ orderMax+=20; renderOrders(); }; L.appendChild(m); }
  // לא הוזמן / בדרך — לפי קטגוריה
  const catOrder=["electrical","civil","staging","safety","construction","panels","tools","containers"];
  const fill=(el,items,key,what,color,emptyTxt)=>{ el.innerHTML=""; if(!items.length){ el.innerHTML='<div class="empty" style="padding:16px">'+emptyTxt+'</div>'; return; }
    catOrder.forEach(cid=>{ const its=items.filter(c=>c.cat===cid); if(!its.length) return;
      const h=document.createElement("div"); h.className="grouphead"; const cc=CATS.find(c=>c.id===cid)||{}; h.innerHTML='<i style="background:'+(cc.color||"var(--ink3)")+'"></i>'+esc(cc.label||cid)+'<span>'+its.length+'</span>'; el.appendChild(h);
      its.sort((a,b)=>b[key]-a[key]).slice(0,10).forEach(c=>{ const d=document.createElement("div"); d.className="holder"; d.innerHTML='<div class="who">'+esc(c.name)+'<div class="what">'+what(c)+'</div></div><div class="q num" style="color:'+color+'">'+fmtN(c[key])+' <small>'+esc(c.unit)+'</small></div>'; el.appendChild(d); });
      if(its.length>10){ const d=document.createElement("div"); d.className="hint"; d.textContent="ועוד "+(its.length-10)+" בקטגוריה"; el.appendChild(d); } }); };
  foldSum("toorder",toOrder.length?toOrder.length+" פריטים":"הכל הוזמן");
  fill($("#orToOrder"),toOrder,"toOrder",c=>'תוכנן '+fmtN(c.planned)+(c.requested?' · ביקשתי '+fmtN(c.requested):'')+(c.ordered?' · הוזמן '+fmtN(c.ordered):'')+(c.arrived?' · הגיעו '+fmtN(c.arrived):'')+(c.supplier?' · '+esc(c.supplier):'')+(c.codes.length?' · סעיף '+esc(c.codes[0]):''),"var(--clay)",planned.length?'כל מה שמתוכנן ב-BOM / EBOQ כבר הוזמן או הגיע.':'ייבא EBOQ כדי לראות מה עוד לא הוזמן.');
  foldSum("awaiting",awaiting.length?awaiting.length+" פריטים":"אין");
  fill($("#orAwaiting"),awaiting,"awaiting",c=>'הוזמן '+fmtN(c.ordered)+' · הגיעו '+fmtN(c.arrived)+(c.po.length?' · '+esc(c.po.slice(0,2).join(", ")):'')+(c.supplier?' · '+esc(c.supplier):''),"var(--amber)",'אין פריטים שהוזמנו ועוד לא נקלטו.');
  renderRequests(); renderEta(); renderPos(); renderCba();
}
/* הזמנות רכש של מחלקת הרכש: סטטוס לפי תעודות משלוח שנקלטו אחרי תאריך ההזמנה */
function poStatus(p){
  const L=(p.lines||[]).filter(l=>!l.skip); if(!L.length) return {k:"none",label:"—",color:"var(--ink3)",got:0,n:0};
  if(p.status==="hold") return {k:"hold",label:"מוקפא",color:"var(--clay)",got:0,n:L.length};
  if(p.status==="cancelled") return {k:"cancelled",label:"בוטל",color:"var(--ink3)",got:0,n:L.length};
  const got=L.filter(l=>receivedSince(p,l)>=(Number(l.qty)||0)*unitMult(l.unit)).length, part=L.filter(l=>receivedSince(p,l)>0).length;
  const due=L.map(l=>l.due).filter(Boolean).map(d=>{ const m=String(d).match(/^(\d\d)\/(\d\d)\/(\d\d)$/); return m?new Date(2000+ +m[3],+m[2]-1,+m[1]).getTime():0; }).filter(Boolean);
  const late=due.length&&Math.max(...due)<Date.now()-7*864e5;
  if(got===L.length) return {k:"ok",label:"התקבל",color:"var(--sage)",got,n:L.length};
  if(part) return {k:"part",label:"חלקי"+(got?" · "+got+"/"+L.length:""),color:"var(--amber)",got,n:L.length};
  if(late) return {k:"late",label:"לא נקלט · באיחור",color:"var(--clay)",got,n:L.length};
  return {k:"wait",label:"בדרך",color:"var(--info)",got,n:L.length};
}
