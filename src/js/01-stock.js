import { $, actorName, ask, byId, closer, esc, fmtD, fmtDT, logAct, ls, popup, shared, toast, unitMult, unitOf } from "./core.js";
import { copyText, issuePdfById, renderSlips, sigPad } from "./03-issues.js";
import { renderAlerts } from "./06-alerts.js";
import { renderOnboarding } from "./07-new-site.js";
import { showTab } from "./08-settings.js";
import { exportNotePdf, openScanner } from "./09-doc-scanner.js";
import { openBarcodeScanner } from "./10-barcode.js";
import { foldSum, renderTodayTip } from "./12-ui-cleanup.js";
import { linkNoteToBoq } from "./13-purchasing.js";
import { renderStatus } from "./16-status.js";
export let DEMO_NOTES, DEMO_COUNTS, DEMO_MOVES, CATS, CATLIST, catFilter, openCats, stockQ, stockMax, holdMax, supFilter, hit, moveSigned, IMPORT_PROMPT, ham, hashId, ISSUE_RE, RET_RE, curNotes, isBomNote, realNotes, fmtN, fmtM3, flagMax, shortName, shortSup;
export function stockRows(){
  const notes = shared.demoStock?DEMO_NOTES:shared.deliveries;
  const mvs   = shared.demoStock?DEMO_MOVES:shared.moves;
  const map = new Map();
  notes.forEach(n=>(n.lines||[]).forEach(l=>{
    const k=(l.name||"").trim(); if(!k) return;
    const e=map.get(k)||{name:k,unit:unitOf(l.unit),cat:l.cat||"staging",catTs:-1,in:0,out:0,sups:new Set()};
    e.in+=(Number(l.qty)||0)*unitMult(l.unit); if(!e.unit&&l.unit) e.unit=unitOf(l.unit);
    if(l.cat && (n.ts||0)>=e.catTs){ e.cat=l.cat; e.catTs=n.ts||0; }
    if(n.supplier) e.sups.add(n.supplier);
    map.set(k,e);
  }));
  mvs.forEach(o=>{
    const k=(o.item||"").trim(); if(!k) return;
    const e=map.get(k)||{name:k,unit:o.unit||"",cat:o.cat||"staging",in:0,out:0,sups:new Set()};
    const q=Number(o.qty)||0;
    if(o.dir==="in") e.out-=q; else e.out+=q;
    map.set(k,e);
  });
  const cnts = shared.demoStock?DEMO_COUNTS:shared.counts;
  const last=new Map();
  cnts.forEach(c=>{
    const k=(c.item||"").trim(); if(!k) return;
    const e=last.get(k); if(!e||c.ts>e.ts) last.set(k,c);
    if(!map.has(k)) map.set(k,{name:k,unit:c.unit||"",cat:c.cat||"staging",in:0,out:0,sups:new Set()});
  });
  const rows=[...map.values()];
  rows.forEach(r=>{
    const c=last.get(r.name);
    r.counted = c ? Number(c.qty) : null;
    r.countedTs = c ? c.ts : null;
    r.derived = r.in - r.out;
    r.noIn = r.in===0;            // never received through a delivery note at item level
    r.mag = r.noIn ? Math.max(r.out, r.counted||0) : r.derived;
  });
  return rows.sort((a,b)=>(a.counted===null?0:1)-(b.counted===null?0:1) || b.mag-a.mag);
}
export function holders(){
  const mvs = shared.demoStock?DEMO_MOVES:shared.moves;
  const catOf = new Map(stockRows().map(r=>[r.name,r.cat]));
  const m=new Map();
  mvs.forEach(o=>{
    const who=(o.who||"").trim(); if(!who) return;
    const k=who+"|"+o.item;
    const e=m.get(k)||{who,item:o.item,cat:catOf.get(o.item)||"staging",qty:0};
    e.qty += (o.dir==="in" ? -1 : 1) * (Number(o.qty)||0);
    m.set(k,e);
  });
  return [...m.values()].filter(e=>e.qty>0).sort((a,b)=>{
    const at=a.cat==="tools"?0:1, bt=b.cat==="tools"?0:1;
    return at-bt || b.qty-a.qty;
  });
}
export function renderStock(){
  const notes = shared.demoStock?DEMO_NOTES:shared.deliveries;
  const rows = stockRows();
  $("#demoBarS").hidden = !shared.demoStock;
  const weekAgo=Date.now()-7*86400000;
  const never = rows.filter(r=>r.counted===null).length;
  const gaps  = rows.filter(r=>r.counted!==null && !r.noIn && r.counted!==r.derived).length;
  $("#kOnSite").textContent = never;
  $("#kNotes").textContent  = notes.filter(n=>n.source!=="bom").length;
  $("#kKinds").textContent  = rows.length;
  $("#kGaps").textContent   = gaps;
  // supplier dropdown
  const allSups=[...new Set(rows.flatMap(r=>[...(r.sups||[])]))].sort((a,b)=>a.localeCompare(b,"he"));
  if(!allSups.includes(supFilter)) { if(supFilter!=="all") supFilter="all"; }
  const sel=$("#supSel");
  const want='<option value="all">כל הספקים</option>'
    + allSups.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  const supKey=allSups.join("\u0001");
  if(sel.dataset.built!==supKey){ sel.innerHTML=want; sel.dataset.built=supKey; }
  sel.value=supFilter;
  $("#supClr").hidden = supFilter==="all";

  // category chips
  const cb=$("#catBar"); cb.innerHTML="";
  const mk=(id,label,n)=>{
    const b=document.createElement("button");
    b.className="cat"; b.type="button";
    b.setAttribute("aria-pressed", String(catFilter===id));
    b.innerHTML=label+(n?'<span class="n">'+n+'</span>':'');
    b.onclick=()=>{catFilter=id; renderStock();};
    cb.appendChild(b);
  };
  const cntBase = supFilter==="all" ? rows : rows.filter(r=>r.sups&&r.sups.has(supFilter));
  mk("all","הכל",cntBase.length);
  CATS.forEach(c=>mk(c.id,c.label,cntBase.filter(r=>r.cat===c.id).length));

  const bySup = supFilter==="all" ? rows : rows.filter(r=>r.sups&&r.sups.has(supFilter));
  const shown = (catFilter==="all" ? bySup : bySup.filter(r=>r.cat===catFilter))
                  .filter(r=>hit(r.name,stockQ));
  $("#stockCount").textContent = shown.length? shown.length+" סוגים" : "";

  const list=$("#stockList"); list.innerHTML="";
  if(!shown.length){
    list.innerHTML='<div class="empty">'+(stockQ ? 'אין פריט שמתאים לחיפוש.'
      : supFilter!=="all" ? 'אין פריטים מהספק הזה בקטגוריה הזאת.'
      : rows.length ? 'אין פריטים בקטגוריה הזאת.'
      : 'אין עדיין מלאי.<br>קלוט תעודת משלוח ראשונה.')+'</div>';
  } else {
    const groups = catFilter==="all"
      ? CATS.map(c=>[c, shown.filter(r=>r.cat===c.id)]).filter(g=>g[1].length)
      : [[CATS.find(c=>c.id===catFilter), shown]];
    let moreNeeded=false;
    groups.forEach(([c,itemsAll])=>{
      const items=itemsAll.slice(0,stockMax); if(itemsAll.length>stockMax) moreNeeded=true;
      const shut=catFilter==="all"&&!stockQ&&!openCats.has(c.id);
      if(catFilter==="all"){
        const h=document.createElement("button"); h.type="button"; h.className="grouphead"; h.style.cssText="background:none;border:0;width:100%;cursor:pointer;font-family:inherit;padding:4px 2px";
        const allC=itemsAll; const gaps=allC.filter(r=>r.counted!==null&&!r.noIn&&r.counted!==r.derived).length;
        h.innerHTML='<i style="background:'+c.color+'"></i>'+c.label
          +'<span>'+allC.length+(gaps?' · <b style="color:var(--clay)">'+gaps+' פערים</b>':'')+'</span><span style="margin-inline-start:auto;display:inline-block;transform:rotate('+(shut?90:-90)+'deg)">‹</span>';
        h.onclick=()=>{ if(openCats.has(c.id)) openCats.delete(c.id); else openCats.add(c.id); ls.set("openCats",JSON.stringify([...openCats])); renderStock(); };
        list.appendChild(h);
      }
      if(shut) return;
      items.forEach(r=>{
        const el=document.createElement("div");
        const counted = r.counted!==null;
        const gap = counted ? r.counted - r.derived : 0;
        el.className="item"+(counted?"":" never")+(counted&&!r.noIn&&r.counted<=0?" low":"");
        let fig, flow;
        if(r.noIn){
          fig = counted
            ? '<div class="fig num">'+r.counted.toLocaleString("he-IL")
              +'<small>נספר '+fmtD(r.countedTs)+'</small></div>'
            : '<div class="fig uncounted">יצא '+r.out.toLocaleString("he-IL")+'<small>ללא קליטה</small></div>';
          flow='<div class="flow"><span class="gap">לא נקלט בתעודה ברמת פריט</span>'
            +(r.out?'<span>יצא <b>'+r.out.toLocaleString("he-IL")+'</b></span>':'')+'</div>';
        } else {
          fig = counted
            ? '<div class="fig num">'+r.counted.toLocaleString("he-IL")
              +'<small>נספר '+fmtD(r.countedTs)+'</small></div>'
            : '<div class="fig uncounted">לא נספר<small>תיאורטי '+r.derived.toLocaleString("he-IL")+'</small></div>';
          flow='<div class="flow"><span>הגיע <b>'+r.in.toLocaleString("he-IL")+'</b></span>'
            +'<span>יצא <b>'+r.out.toLocaleString("he-IL")+'</b></span>'
            +(counted?'<span>תיאורטי <b>'+r.derived.toLocaleString("he-IL")+'</b></span>':'')
            +(counted&&gap!==0?'<span class="gap">פער '+(gap>0?'+':'')+gap.toLocaleString("he-IL")+'</span>':'')
            +'</div>';
        }
        const supLine = (supFilter==="all" && r.sups && r.sups.size)
          ? '<div class="sup">'+esc([...r.sups].join(" · "))+'</div>' : '';
        el.innerHTML='<div class="nm">'+esc(r.name)+'</div>'+fig
          +'<button class="out" data-out="'+esc(r.name)+'">ניפוק</button>'+supLine+flow;
        list.appendChild(el);
      });
    });
    if(moreNeeded){
      const b=document.createElement("button");
      b.className="more"; b.type="button";
      b.textContent="הצג עוד";
      b.onclick=()=>{stockMax+=40; renderStock();};
      list.appendChild(b);
    }
  }

  const hs=holders();
  const hsT=hs.filter(h=>h.cat==="tools"), hsM=hs.filter(h=>h.cat!=="tools");
  const drawHold=(box,list,max,more)=>{ box.innerHTML="";
    list.slice(0,max).forEach(h=>{ const c=CATS.find(x=>x.id===h.cat); const el=document.createElement("div"); el.className="holder";
      const outs=moveOuts(h.who,h.item), sg=outs.length&&outs.every(moveSigned);
      el.innerHTML='<div class="who">'+esc(h.item)+'<div class="what">אצל '+esc(h.who)+'</div></div>'
        +(outs.length?'<span class="sigok" style="'+(sg?'background:var(--sage-soft);color:var(--sage)':'background:var(--clay-soft);color:var(--clay)')+';font-size:.72rem;font-weight:800;border-radius:99px;padding:3px 9px;white-space:nowrap">'+(sg?'חתום':'ללא חתימה')+'</span>':'')
        +'<div class="q num">'+h.qty.toLocaleString("he-IL")+'</div>';
      if(outs.length){ el.style.cursor="pointer"; el.tabIndex=0; el.setAttribute("role","button"); el.onclick=()=>openMoveSlip(h.who,h.item);
        el.onkeydown=e=>{ if(e.key==="Enter") openMoveSlip(h.who,h.item); }; }
      box.appendChild(el); });
    if(list.length>max){ const b=document.createElement("button"); b.className="more"; b.type="button"; b.textContent="הצג עוד "+(list.length-max); b.onclick=more; box.appendChild(b); } };
  $("#holdToolsCard").hidden=!hsT.length; $("#holdMatCard").hidden=!hsM.length;
  drawHold($("#holdTools"),hsT,99,()=>{});
  drawHold($("#holdList"),hsM,holdMax,()=>{holdMax+=20; renderStock();});
  foldSum("tools",hsT.length?hsT.length+" כלים":""); foldSum("held",hsM.length?hsM.length+" פריטים":"");
  renderSlips();
  const nl=$("#noteList"); nl.innerHTML="";
  notes.filter(n=>n.source!=="bom").slice().sort((a,b)=>b.ts-a.ts).slice(0,6).forEach(n=>{
    const el=document.createElement("div");
    el.className="dnote"; el.dataset.id=n.id; el.tabIndex=0; el.setAttribute("role","button");
    const items=(n.lines||[]).length;
    const psrc = n.photoAsset ? "/_blob/"+n.photoAsset : n.photoUrl;
    el.innerHTML=(psrc?'<img src="'+psrc+'" alt="">':'<div class="thumb" style="width:46px;height:46px"></div>')
      +'<div class="t"><b>'+esc(n.supplier||"ספק לא ידוע")+'</b>'
      +'<span>תעודה '+esc(n.noteNo||"—")+' · '+items+' פריטים · '
      +esc(fmtDT(n.dateText)||fmtD(n.ts))+'</span></div>'
      +(n.demo?'':'<button class="del" data-delnote="'+n.id+'">מחק</button>');
    nl.appendChild(el);
  });
  renderOverview();
}
/* ---- קליטת תעודה ---- */
export function openNote(){
  let pages=[], lines=[], reading=0;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="קליטת תעודת משלוח">'
  +'<div class="grab"></div><h2>קליטת תעודת משלוח</h2>'
  +'<div class="note-card">סורקים את התעודה כמו ב-CamScanner: הקצוות מזוהים לבד, התמונה מיושרת ומנוקה, ואפשר כמה עמודים. הספק, המספר והשורות ייקראו לבד. <b>אתה מאשר או מתקן לפני שמירה.</b></div>'
  +'<div class="f"><div class="pages" id="nPages"></div><button class="scanbtn" type="button" id="bScan"><i class="ic ic-cam"></i>סרוק את התעודה</button>'
  +'<div class="ai" id="aiNoteLine"></div></div>'
  +'<div class="f"><label for="iSup">ספק</label><input type="text" id="iSup" placeholder="שם הספק"></div>'
  +'<div class="f"><label for="iNo">מספר תעודה</label><input type="text" id="iNo" placeholder="מספר"></div>'
  +'<div class="f"><label for="iDate">תאריך התעודה</label><input type="text" id="iDate" placeholder="00/00/0000"></div>'
  +'<div class="f"><label>פריטים</label><div class="dl" id="dl"></div>'
  +'<div class="row2" style="margin:8px 0 0"><button class="addline" id="bAddLine" type="button" style="flex:1">+ הוסף שורה</button><button class="addline" id="bLinesScan" type="button" style="flex:1"><i class="ic ic-scan"></i>סרוק ברקודים</button></div>'
  +'<div class="hint">כמות שלילית = הוחזר לספק. סריקת ברקודים: כל ברקוד = אריזה, הכמות = אריזות × יחידות באריזה.</div></div>'
  +'<div class="acts"><button class="save" id="bSaveNote" disabled>שמור תעודה</button>'
  +'<button class="cancel" id="bCancelNote">ביטול</button></div></div>');
  const close=closer(scrim);
  const q=s=>scrim.querySelector(s);
  { const dl=document.createElement("datalist"); dl.id="boqNames"; const names=[...new Set([...shared.boq.map(l=>(l.name||"").trim()),...stockRows().map(r=>r.name)].filter(Boolean))]; dl.innerHTML=names.slice(0,400).map(n=>'<option value="'+esc(n)+'"></option>').join(""); scrim.appendChild(dl); }

  function drawLines(){
    const box=q("#dl"); box.innerHTML="";
    lines.forEach((l,i)=>{
      const row=document.createElement("div"); row.className="dline";
      row.innerHTML='<input type="text" value="'+esc(l.name)+'" placeholder="שם הפריט" aria-label="שם פריט" list="boqNames" autocomplete="off">'
        +'<button class="x" type="button" aria-label="מחק שורה">×</button>'
        +'<div class="r2"><input type="text" inputmode="text" value="'+esc(l.qty)+'" placeholder="כמות" aria-label="כמות">'
        +'<select aria-label="קטגוריה">'+CATS.map(c=>'<option value="'+c.id+'"'
        +(l.cat===c.id?' selected':'')+'>'+c.label+'</option>').join("")+'</select></div>';
      const n=row.children[0], x=row.children[1];
      const qn=row.children[2].children[0], sel=row.children[2].children[1];
      if(!l.cat){ l.cat="electrical"; sel.value="electrical"; }
      n.oninput=e=>{lines[i].name=e.target.value; check();};
      qn.oninput=e=>{lines[i].qty=e.target.value; check();};
      sel.onchange=e=>{lines[i].cat=e.target.value;};
      x.onclick=()=>{lines.splice(i,1); drawLines(); check();};
      box.appendChild(row);
    });
    if(!lines.length) box.innerHTML='<div class="hint">אין עדיין שורות — צלם תעודה או הוסף ידנית.</div>';
  }
  function check(){
    const ok = lines.some(l=>String(l.name||"").trim() && isFinite(Number(l.qty)) && Number(l.qty)!==0);
    q("#bSaveNote").disabled = !ok;
  }
  q("#bAddLine").onclick=()=>{lines.push({name:"",qty:"",unit:"",cat:"electrical"}); drawLines(); check();};
  q("#bLinesScan").onclick=()=>openBarcodeScanner({mode:"lines",onDone:async res=>{
    res.forEach(h=>{ if(!h.item) return; const per=Number(h.per)||0; const qty=per>0?h.n*per:h.n;
      const ex=lines.find(l=>l.name===h.item.name); if(ex){ ex.qty=(Number(ex.qty)||0)+qty; } else lines.push({name:h.item.name,qty,unit:per>0?"יח'":"אריזה",cat:"electrical"}); });
    lines=lines.filter(l=>String(l.name||"").trim()||lines.length===1); drawLines(); check();
    if(res.some(h=>h.item&&!(Number(h.per)>0))) toast("לאריזה בלי «יחידות באריזה» נרשמה כמות באריזות. עדיף למלא יחידות.");
  }});
  function drawPages(){
    const box=q("#nPages"); box.innerHTML="";
    pages.forEach((p,i)=>{ const d=document.createElement("div"); d.className="pg"; d.innerHTML='<img src="'+p.thumb+'" alt=""><b>'+(i+1)+'</b><button type="button" aria-label="הסר עמוד">×</button>';
      d.querySelector("button").onclick=()=>{ pages.splice(i,1); drawPages(); }; box.appendChild(d); });
    q("#bScan").innerHTML='<i class="ic ic-cam"></i>'+(pages.length?"+ עמוד נוסף":"סרוק את התעודה");
  }
  async function readPage(pg,first){
    const line=q("#aiNoteLine");
    if(!shared.SAMPLE){ line.textContent="מלא את הפרטים ידנית."; return; }
    reading++; line.textContent="קורא את התעודה…"+(pages.length>1?" (עמוד "+(pages.indexOf(pg)+1)+")":"");
    try{
      const out=await shared.SAMPLE.json(
        "בתמונה תעודת משלוח (ישראלית, בעברית), סרוקה"+(first?"":", עמוד המשך של אותה תעודה")+". החזר רק JSON: "
        +'{"supplier":"<שם הספק או null>","noteNo":"<מספר התעודה או null>",'
        +'"date":"<תאריך כפי שמופיע או null>",'
        +'"lines":[{"name":"<תיאור הפריט>","qty":<מספר>,"unit":"<יחידה או null>","cat":"<קטגוריה>"}]}. '
        +"קח רק שורות פריטים אמיתיות עם כמות. אל תמציא ואל תשלים מספרים שלא ברורים — "
        +"אם ערך לא קריא החזר null עבורו. "
        +"cat חייב להיות אחד מאלה בדיוק (הערך האנגלי): "+CATLIST+". "
        +"סווג לפי מה שהפריט באמת — פאנלים סולאריים=panels, מסילות/מבנה/ברגים/קלאמפים=construction, "
        +"כבלים/ממירים/חיבורים=electrical, קסדות/רתמות/גידור=safety, "
        +"משטחים/ציוד אתר=staging, מקדחות/מפתחות/ציוד עבודה=tools, מסירת מטען ממכולה/משטחים במכולה=containers, חצץ/חול/בטון/עבודות עפר/ניקוז=civil.",
        {images:pg.blob}
      );
      if(out){
        if(out.supplier&&!q("#iSup").value) q("#iSup").value=out.supplier;
        if(out.noteNo&&!q("#iNo").value)  q("#iNo").value=out.noteNo;
        if(out.date&&!q("#iDate").value)    q("#iDate").value=out.date;
        if(Array.isArray(out.lines) && out.lines.length){
          const add=out.lines.filter(l=>l&&l.name).map(l=>({
            name:String(l.name).trim(), qty:(l.qty??""), unit:l.unit?String(l.unit):"",
            cat: CATS.some(c=>c.id===l.cat) ? l.cat : "electrical"}));
          lines=lines.filter(l=>String(l.name||"").trim()).concat(add); drawLines();
        }
        line.textContent="נקרא מהתעודה — עבור ותקן מה שצריך";
      } else line.textContent="לא הצלחתי לקרוא — מלא ידנית";
      check();
    }catch(err){
      line.textContent = err&&err.code==="not_granted"
        ? "קריאה אוטומטית לא זמינה — מלא ידנית" : "לא הצלחתי לקרוא — מלא ידנית";
    } finally { reading--; }
  }
  q("#bScan").onclick=()=>{
    openScanner({onDone:async newPages=>{
      const first=!pages.length; pages.push(...newPages); drawPages();
      for(let i=0;i<newPages.length;i++) await readPage(newPages[i],first&&i===0);
    }});
  };
  q("#bCancelNote").onclick=close;
  q("#bSaveNote").onclick=async()=>{
    const b=q("#bSaveNote"); b.disabled=true; b.textContent="שומר…";
    const dt=parseDate(q("#iDate").value.trim());
    const rec={id:"n"+Date.now()+Math.random().toString(36).slice(2,6),
      supplier:q("#iSup").value.trim(), noteNo:q("#iNo").value.trim(),
      dateText:dt?dt.text:q("#iDate").value.trim(), ts:dt?dt.ts:Date.now(), photoAsset:"", photoUrl:"", pages:[], source:"app", by:actorName(),
      lines:lines.filter(l=>String(l.name).trim()&&isFinite(Number(l.qty))&&Number(l.qty)!==0)
                 .map(l=>({name:String(l.name).trim(),qty:Number(l.qty),unit:l.unit||"",cat:l.cat||"construction"}))};
    try{ if(shared.ASSETS){ for(const pg of pages){ const a=await shared.ASSETS.upload(pg.blob); rec.pages.push(a.id); if(!rec.photoAsset){ rec.photoAsset=a.id; rec.photoUrl=a.url; } } } }catch(e){}
    try{
      if(shared.DB) await shared.DB.collection("deliveries").doc(rec.id).set(rec);
      else { shared.deliveries.push(rec); ls.set("deliveries",JSON.stringify(shared.deliveries)); }
    }catch(e){ b.disabled=false; b.textContent="שמור תעודה"; toast("השמירה נכשלה."); return; }
    logAct("delivery","add","תעודה "+(rec.noteNo||"—")+" · "+(rec.supplier||"ספק לא ידוע")+" · "+rec.lines.length+" פריטים",rec.id);
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderStock();
    linkNoteToBoq(rec).catch(()=>{});   // ברקע: קישור השורות לפריטי ה-EBOQ — כך "הגיע" נקבע לפי התעודה
  };
  drawLines(); drawPages();
}
export function moveOuts(who,item){ return (shared.demoStock?DEMO_MOVES:shared.moves).filter(m=>m.dir!=="in"&&m.source!=="issue"&&(m.who||"").trim()===who&&m.item===item).sort((a,b)=>b.ts-a.ts); }
export function moveSlipText(who,item,outs){
  return "ניפוק ציוד · "+item+"\nל: "+who
    +"\n"+outs.map(m=>{ const d=new Date(m.ts); return fmtD(d)+" "+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})+": "+fmtN(m.qty)+" · חתימה: "+(moveSigned(m)?"יש":"אין"); }).join("\n");
}
export function openMoveSlip(who,item){
  const outs=moveOuts(who,item);
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ניפוק ציוד"><div class="grab"></div><h2>'+esc(item)+' · '+esc(who)+'</h2>'
    +outs.map(m=>{ const d=new Date(m.ts); const sig=m.sigAsset?"/_blob/"+m.sigAsset:(m.sigUrl||m.sigData||"");
      return '<div class="kv"><span>'+fmtD(d)+' '+d.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})+'</span><span>כמות <b>'+fmtN(m.qty)+'</b></span>'
        +'<span>'+(moveSigned(m)?'<b style="color:var(--sage)">חתום</b>':'<b style="color:var(--clay)">ללא חתימה</b>')+'</span></div>'
        +(sig?'<img class="sigimg" src="'+sig+'" alt="חתימת המקבל">':'')
        +'<button class="ghost" type="button" data-mpdf="'+esc(m.id)+'" style="margin:8px 0 4px">PDF של הניפוק הזה</button>'; }).join("")
    +'<div class="acts"><button class="save" type="button" id="msCopy">העתק לוואטסאפ</button><button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim);
  scrim.querySelector(".cancel").onclick=close;
  scrim.querySelector("#msCopy").onclick=()=>copyText(moveSlipText(who,item,outs));
  scrim.querySelectorAll("[data-mpdf]").forEach(b=>b.onclick=()=>issuePdfById(b.dataset.mpdf,b));
}
/* ---- ניפוק: הוצאה / החזרה / ספירה ---- */
export function openMove(item){
  let dir="out";
  const names=[...new Set((shared.demoStock?DEMO_MOVES:shared.moves).map(m=>m.who).filter(Boolean))];
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ניפוק">'
  +'<div class="grab"></div><h2>'+esc(item)+'</h2>'
  +'<div class="f"><label>סוג הפעולה</label><div class="opts" id="oDir">'
  +'<button class="opt" type="button" data-d="out" aria-pressed="true">הוצאה<small>יוצא מהמלאי</small></button>'
  +'<button class="opt" type="button" data-d="in" aria-pressed="false">החזרה<small>חוזר למלאי</small></button>'
  +'<button class="opt" type="button" data-d="count" aria-pressed="false">ספירה<small>מה יש בפועל</small></button>'
  +'</div></div>'
  +'<div class="f"><label for="mQty" id="mQtyLbl">כמות</label>'
  +'<input type="text" id="mQty" inputmode="numeric" placeholder="כמה">'
  +'<div class="hint" id="mQtyHint"></div></div>'
  +'<div class="f"><label for="mWho" id="mWhoLbl">מי לקח</label>'
  +'<input type="text" id="mWho" list="whoList" placeholder="שם או צוות" autocomplete="off">'
  +'<datalist id="whoList">'+names.map(n=>'<option value="'+esc(n)+'"></option>').join("")+'</datalist>'
  +'<div class="hint">השם נשמר, ואפשר לראות מי מחזיק מה.</div></div>'
  +'<div class="f" id="mSigF"><label>חתימת המקבל</label><div class="sig" id="mSig"><canvas></canvas><div class="hint2">חותמים כאן באצבע</div><button class="clr2" type="button">נקה</button></div></div>'
  +'<div class="acts"><button class="save" id="mSave" disabled>שמור</button>'
  +'<button class="cancel" id="mCancel">ביטול</button></div></div>');
  const close=closer(scrim);
  const q=x=>scrim.querySelector(x);
  const pad=sigPad(q("#mSig"));
  q("#oDir").onclick=e=>{
    const b=e.target.closest("[data-d]"); if(!b) return;
    dir=b.dataset.d;
    q("#oDir").querySelectorAll(".opt").forEach(o=>o.setAttribute("aria-pressed",String(o===b)));
    const isC = dir==="count";
    q("#mQtyLbl").textContent = isC ? "כמה יש בפועל" : "כמות";
    q("#mQtyHint").textContent = isC ? "המספר שספרת באתר — הוא מחליף את החישוב." : "";
    q("#mWhoLbl").textContent = isC ? "מי ספר" : "מי לקח";
    q("#mSigF").hidden = dir!=="out";
    check();
  };
  const check=()=>{ const v=q("#mQty").value.trim(); const n=Number(v);
    const okQty = dir==="count" ? (v!=="" && isFinite(n) && n>=0) : (isFinite(n) && n>0);
    q("#mSave").disabled = !(okQty && q("#mWho").value.trim()); };
  q("#mQty").oninput=check; q("#mWho").oninput=check;
  q("#mCancel").onclick=close;
  q("#mSave").onclick=async()=>{
    const b=q("#mSave");
    if(dir==="out" && !pad.has()){
      const go=await ask("לשמור ניפוק בלי חתימת המקבל?","שמור בלי חתימה","var(--amber)","בלי חתימה אין הוכחה שהמקבל קיבל את הפריט. הניפוק יסומן «ללא חתימה».");
      if(!go) return;
    }
    b.disabled=true; b.textContent="שומר…";
    const isC = dir==="count";
    const coll = isC ? "counts" : "moves";
    const rec={id:(isC?"c":"m")+Date.now()+Math.random().toString(36).slice(2,6),
      item:item, qty:Number(q("#mQty").value), who:q("#mWho").value.trim(), ts:Date.now()};
    if(!isC) rec.dir=dir;
    if(dir==="out"&&actorName()) rec.by=actorName();
    if(dir==="out" && pad.has()){
      let up=false;
      try{ if(shared.ASSETS){ const bl=await pad.blob(); const a=await shared.ASSETS.upload(bl); rec.sigAsset=a.id; rec.sigUrl=a.url; up=true; } }catch(e){}
      if(!up){ try{ rec.sigData=pad.dataUrl(); }catch(e){} }
    }
    try{
      if(shared.DB) await shared.DB.collection(coll).doc(rec.id).set(rec);
      else { (isC?shared.counts:shared.moves).push(rec);
             ls.set(coll,JSON.stringify(isC?shared.counts:shared.moves)); }
    }catch(e){ b.disabled=false; b.textContent="שמור"; toast("השמירה נכשלה."); return; }
    logAct(isC?"count":"move","add",(isC?"ספירה: ":dir==="in"?"החזרה: ":"הוצאה: ")+item+" · "+fmtN(rec.qty)+(isC?"":" · "+rec.who)+(dir==="out"?" · "+(pad.has()?"חתום":"ללא חתימה"):""),rec.id,isC?rec.who:null);
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderStock();
  };
  setTimeout(()=>q("#mQty").focus(),50);
}
export function parseChat(txt){
  const m=new Map();
  const re=/\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*[\d:]+\]\s*([^:]+?):\s*‎?<attached:\s*([^>]+)>/g;
  let x; while((x=re.exec(txt))){ m.set(x[5].trim().split("/").pop(), {date:`${x[1].padStart(2,"0")}/${x[2].padStart(2,"0")}/${x[3]}`, sender:x[4].trim()}); }
  return m;
}
export function loadImg(blob){ return new Promise((res,rej)=>{ const u=URL.createObjectURL(blob); const im=new Image();
  im.onload=()=>{URL.revokeObjectURL(u); res(im);}; im.onerror=()=>{URL.revokeObjectURL(u); rej(new Error("decode"));}; im.src=u; }); }
export async function prepImage(blob){
  const im=await loadImg(blob);
  const k=Math.min(1, 1500/Math.max(im.naturalWidth,im.naturalHeight));
  const w=Math.round(im.naturalWidth*k), h=Math.round(im.naturalHeight*k);
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  const g=c.getContext("2d"); g.drawImage(im,0,0,w,h);
  const small=document.createElement("canvas"); small.width=12; small.height=12;
  small.getContext("2d").drawImage(c,0,0,12,12);
  const d=small.getContext("2d").getImageData(0,0,12,12).data; const px=[]; let sum=0;
  for(let i=0;i<d.length;i+=4){ const v=(d[i]*299+d[i+1]*587+d[i+2]*114)/1000; px.push(v); sum+=v; }
  const avg=sum/px.length; const bits=px.map(v=>v>avg?"1":"0").join("");
  const out=await new Promise(r=>c.toBlob(r,"image/jpeg",0.85));
  return {blob:out, bits, url:URL.createObjectURL(out)};
}
export function parseDate(t){
  if(!t) return null; const m=String(t).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if(!m) return null;
  let y=Number(m[3]); if(y<100) y+=2000; const d=new Date(y,Number(m[2])-1,Number(m[1]),12,0,0);
  return isNaN(d)?null:{ts:d.getTime(), text:`${m[1].padStart(2,"0")}/${m[2].padStart(2,"0")}/${y}`};
}
export async function collectFiles(files){
  const out=[];
  for(const f of files){
    if(/\.zip$/i.test(f.name)){
      if(!window.JSZip) throw new Error("nozip");
      const z=await JSZip.loadAsync(f);
      let chat=new Map();
      const txt=Object.keys(z.files).find(n=>/\.txt$/i.test(n));
      if(txt) chat=parseChat(await z.file(txt).async("string"));
      const names=Object.keys(z.files).filter(n=>!z.files[n].dir && /\.(jpe?g|png|webp)$/i.test(n)).sort();
      for(const n of names){ const b=await z.file(n).async("blob"); const base=n.split("/").pop();
        out.push({name:base, blob:b, meta:chat.get(base)||null}); }
    } else if(/^image\//.test(f.type)){ out.push({name:f.name, blob:f, meta:null}); }
  }
  return out;
}
export function openImport(){
  let ctl=null, items=[], results=[], stage="pick";
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ייבוא מוואטסאפ">'
  +'<div class="grab"></div><h2>ייבוא מוואטסאפ</h2>'
  +'<div class="note-card">בקבוצה: <b>⋮ → עוד → ייצוא צ׳אט → כולל מדיה</b>. תבחר כאן את קובץ ה-ZIP שנוצר, או תמונות מהגלריה. '
  +'צילומים כפולים ותעודות שכבר נקלטו ידולגו; חול, מנופים ויומני עבודה מסוננים לפי הכללים שלך.</div>'
  +'<div id="impBody"><div class="pick">בחר ZIP של הייצוא או תמונות<small>משתמש בשימוש ה-Claude שלך — כשנייה עד דקה לכל תעודה</small>'
  +'<input type="file" id="impFile" accept=".zip,application/zip,image/*" multiple></div></div>'
  +'<div class="acts"><button class="save" id="impMain" hidden>שמור</button><button class="cancel" id="impCancel">סגור</button></div></div>');
  const q=s=>scrim.querySelector(s), body=()=>q("#impBody");
  const setMain=(t,fn,show=true)=>{ const b=q("#impMain"); b.hidden=!show; b.disabled=false; b.textContent=t; b.onclick=fn; };
  const close=closer(scrim,()=>{ if(ctl) ctl.abort(); });
  q("#impCancel").onclick=close;
  q("#impFile").onchange=e=>{ const fs=[...e.target.files]; if(fs.length) run(fs); };

  async function run(files){
    if(!shared.SAMPLE){ body().innerHTML='<div class="empty">קריאה אוטומטית לא זמינה בתצוגה הזאת.</div>'; return; }
    stage="scan"; body().innerHTML='<div class="prog"><i id="pb"></i></div><div class="prog-t"><span id="pt">פותח את הקובץ…</span><span id="pn"></span></div>';
    let raw;
    try{ raw=await collectFiles(files); }catch(err){ body().innerHTML='<div class="empty">'+(err.message==="nozip"?"ספריית ה-ZIP לא נטענה — נסה שוב עם חיבור.":"לא הצלחתי לפתוח את הקובץ.")+'</div>'; return; }
    if(!raw.length){ body().innerHTML='<div class="empty">לא נמצאו תמונות בקובץ.</div>'; return; }
    // dedup: near-duplicate shots + already imported
    items=[]; const keptBits=[]; const nearIds=[]; let dupNear=0, dupOld=0, failed=0;
    for(let i=0;i<raw.length;i++){
      q("#pt").textContent="מסנן כפילויות…"; q("#pn").textContent=(i+1)+"/"+raw.length; q("#pb").style.width=Math.round((i+1)/raw.length*40)+"%";
      let prep; try{ prep=await prepImage(raw[i].blob); }catch(e){ failed++; continue; }
      if(shared.imported.has(hashId(prep.bits))){ dupOld++; keptBits.push(prep.bits); URL.revokeObjectURL(prep.url); continue; }
      if(keptBits.slice(-6).some(b=>ham(b,prep.bits)<=8)){ dupNear++; keptBits.push(prep.bits); nearIds.push(hashId(prep.bits)); URL.revokeObjectURL(prep.url); continue; }
      keptBits.push(prep.bits); items.push({...raw[i], prep, id:hashId(prep.bits)});
    }
    if(!items.length){ body().innerHTML='<div class="empty">אין תמונות חדשות לקלוט.<br>כפולים: '+dupNear+' · כבר נקלטו: '+dupOld+'</div>'; return; }
    // extract with 2 workers
    stage="extract"; ctl=new AbortController(); results=new Array(items.length).fill(null); let done=0, stopped=false;
    q("#pt").textContent="קורא תעודות…"; setMain("עצור",()=>{ stopped=true; ctl.abort(); },true);
    const work=async()=>{ while(true){ const i=items.findIndex((it,ix)=>results[ix]===null && !it._taken); if(i<0||stopped) return; items[i]._taken=true;
      results[i]=await extractOne(items[i]);
      done++; q("#pn").textContent=done+"/"+items.length; q("#pb").style.width=(40+Math.round(done/items.length*60))+"%"; } };
    await Promise.all([work(),work()]);
    review({dupNear,dupOld,failed,stopped,nearIds});
  }
  async function extractOne(it){
    const call=()=>shared.SAMPLE.json(IMPORT_PROMPT,{images:it.prep.blob, signal:ctl.signal});
    try{ return {ok:true, data:await call()}; }
    catch(e){
      if(e&&e.code==="cancelled") return {ok:false, err:"cancelled"};
      if(e&&e.code==="rate_limited"){ await new Promise(r=>setTimeout(r,6000)); try{ return {ok:true, data:await call()}; }catch(e2){ return {ok:false, err:e2&&e2.code||"error"}; } }
      return {ok:false, err:e&&e.code||"error"};
    }
  }
  function review(stats){
    stage="review";
    // merge pages by supplier+noteNo
    const notes=[]; const byKey=new Map();
    items.forEach((it,i)=>{
      const r=results[i]; if(!r) return;
      if(!r.ok){ notes.push({id:it.id,it,bad:true,reason:r.err==="cancelled"?"נעצר":"לא נקרא",on:false}); return; }
      const d=r.data||{};
      if(d.kind!=="delivery"){ notes.push({id:it.id,it,skip:true,reason:d.skipReason||"לא תעודת משלוח",on:false}); return; }
      const lines=(Array.isArray(d.lines)?d.lines:[]).filter(l=>l&&l.name&&isFinite(Number(l.qty))&&Number(l.qty)!==0)
        .map(l=>({name:String(l.name).trim(),qty:Number(l.qty),unit:l.unit?String(l.unit):"",cat:CATS.some(c=>c.id===l.cat)?l.cat:"electrical"}));
      const key=(d.noteNo?String(d.noteNo).trim():"")? (String(d.supplier||"").slice(0,6)+"|"+String(d.noteNo).trim()) : it.id;
      if(byKey.has(key)){ const n=byKey.get(key); n.lines.push(...lines); n.pages++; n.pageIds.push(it.id); return; }
      const dt=parseDate(d.date)||(it.meta&&parseDate(it.meta.date))||null;
      const exists=shared.deliveries.some(x=>d.noteNo && x.noteNo && String(x.noteNo).trim()===String(d.noteNo).trim() && String(x.supplier||"").slice(0,6)===String(d.supplier||"").slice(0,6));
      const n={id:it.id,it,supplier:String(d.supplier||"").trim(),noteNo:String(d.noteNo||"").trim(),dateText:dt?dt.text:(it.meta?it.meta.date:""),ts:dt?dt.ts:Date.now(),
               lines,pages:1,pageIds:[],sender:it.meta?it.meta.sender:"",exists,on:!exists && lines.length>0};
      byKey.set(key,n); notes.push(n);
    });
    const good=notes.filter(n=>!n.bad&&!n.skip);
    let html='<div class="imp-sum"><span>נמצאו <b>'+good.length+'</b> תעודות משלוח</span><span>דולגו לפי כללים <b>'+notes.filter(n=>n.skip).length+'</b></span>'
      +'<span>כפולים <b>'+stats.dupNear+'</b></span><span>כבר במלאי <b>'+(stats.dupOld+good.filter(n=>n.exists).length)+'</b></span>'
      +(notes.filter(n=>n.bad).length?'<span>לא נקראו <b>'+notes.filter(n=>n.bad).length+'</b></span>':'')+'</div>';
    html+='<div id="impList"></div>';
    body().innerHTML=html;
    const list=q("#impList");
    notes.forEach(n=>{
      const el=document.createElement("div"); el.className="imp-row"+(n.on?"":" off")+(n.bad?" bad":""); el.dataset.id=n.id;
      const title=n.bad?"לא נקרא":n.skip?"דולג":(n.supplier||"ספק לא ידוע");
      const meta=n.bad||n.skip?esc(n.reason||"")
        :('תעודה '+esc(n.noteNo||"—")+' · '+n.lines.length+' פריטים · '+esc(fmtDT(n.dateText)||"")+(n.pages>1?' · '+n.pages+' עמודים':'')+(n.exists?' · <b>כבר במלאי</b>':''));
      el.innerHTML='<img src="'+n.it.prep.url+'" alt=""><div class="t">'+esc(title)+'</div>'
        +'<div class="k">'+((n.bad||n.skip)?'':'<button class="tgl" type="button" aria-pressed="'+n.on+'">'+(n.on?"ייקלט":"לא")+'</button>')+'</div>'
        +'<div class="m">'+meta+'</div>'
        +(n.lines&&n.lines.length?'<div class="lines">'+n.lines.map(l=>esc(l.name)+' — <b>'+l.qty+'</b> '+esc(l.unit||"")+' · '+esc((CATS.find(c=>c.id===l.cat)||{}).label||"")).join("<br>")+'</div>':'');
      el.onclick=e=>{ if(e.target.classList.contains("tgl")){ n.on=!n.on; e.target.setAttribute("aria-pressed",String(n.on)); e.target.textContent=n.on?"ייקלט":"לא"; el.classList.toggle("off",!n.on); }
                       else el.classList.toggle("open"); };
      list.appendChild(el);
    });
    const count=()=>notes.filter(n=>n.on).length;
    setMain("שמור "+count()+" תעודות", ()=>save(notes,stats.nearIds), good.length>0);
    list.addEventListener("click",()=>{ const b=q("#impMain"); if(!b.hidden) b.textContent="שמור "+count()+" תעודות"; });
  }
  async function save(notes,nearIds){
    const chosen=notes.filter(n=>n.on); if(!chosen.length) return;
    const b=q("#impMain"); b.disabled=true; let i=0; const savedRecs=[];
    for(const n of chosen){
      b.textContent="שומר… "+(++i)+"/"+chosen.length;
      const rec={id:"im_"+n.id, supplier:n.supplier, noteNo:n.noteNo, dateText:n.dateText, ts:n.ts, photoAsset:"", photoUrl:"",
                 source:"whatsapp-import", note:n.sender?("צולם ע״י "+n.sender):"", lines:n.lines};
      try{ if(shared.ASSETS){ const a=await shared.ASSETS.upload(n.it.prep.blob); rec.photoAsset=a.id; rec.photoUrl=a.url; } }catch(e){}
      try{
        if(shared.DB){ await shared.DB.collection("deliveries").doc(rec.id).set(rec); await shared.DB.collection("imports").doc(n.id).set({ts:Date.now()}); }
        else { shared.deliveries.push(rec); ls.set("deliveries",JSON.stringify(shared.deliveries)); shared.imported.add(n.id); ls.set("imports",JSON.stringify([...shared.imported])); }
      }catch(e){ b.disabled=false; b.textContent="השמירה נכשלה — נסה שוב"; return; }
      shared.imported.add(n.id); savedRecs.push(rec);
      for(const pid of (n.pageIds||[])){ try{ if(shared.DB) await shared.DB.collection("imports").doc(pid).set({ts:Date.now(),page:true}); shared.imported.add(pid); }catch(e){} }
    }
    if(shared.boq.length&&savedRecs.length) (async()=>{ let k=0; for(const r of savedRecs.slice(0,25)){ try{ k+=await linkNoteToBoq(r,true); }catch(e){} } if(k) toast(k+" שורות מהתעודות קושרו לפריטי EBOQ"); })();
    // remember skipped notes and near-duplicate shots too, so a re-export doesn't re-read them
    for(const id of (nearIds||[])){ try{ if(shared.DB) await shared.DB.collection("imports").doc(id).set({ts:Date.now(),dup:true}); shared.imported.add(id); }catch(e){} }
    if(!shared.DB) ls.set("imports",JSON.stringify([...shared.imported]));
    for(const n of notes.filter(n=>!n.on && !n.bad)){ try{ if(shared.DB) await shared.DB.collection("imports").doc(n.id).set({ts:Date.now(),skipped:true}); else { shared.imported.add(n.id); ls.set("imports",JSON.stringify([...shared.imported])); } }catch(e){} }
    if(shared.demoStock){ shared.demoStock=false; ls.set("demoDoneS","1"); }
    logAct("import","add","ייבוא מוואטסאפ: "+chosen.length+" תעודות משלוח","");
    body().innerHTML='<div class="empty">נקלטו '+chosen.length+' תעודות למלאי.</div>'; setMain("סגור",close,true); renderStock();
  }
}
export function noteFlags(n){
  const issue = Array.isArray(n.flags)
    ? n.flags.some(f=>f==="shortage"||f==="damaged"||f==="unreadable qty")
    : ISSUE_RE.test(n.note||"");
  const ls=n.lines||[];
  const ret = (ls.length>0 && ls.every(l=>Number(l.qty)<0)) || /תעודת החזרה|החזרה לספק/.test(n.note||"");
  return {issue, ret};
}
export function weekStart(ts){ const d=new Date(ts); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d.getTime(); }
export function renderOverview(){
  renderStatus();
  const acts=(shared.STATUS||[]).filter(a=>Number(a.total)>0);
  const pctOf=a=>Math.min(1,(a.daily||[]).reduce((t,d)=>t+(Number(d.actual)||0),0)/Number(a.total));
  if($("#ovBig")) $("#ovBig").textContent=acts.length?Math.round(acts.reduce((t,a)=>t+pctOf(a),0)/acts.length*100)+"%":"—";
  if($("#ovCap")) $("#ovCap").textContent=acts.length?"התקדמות ממוצעת ב-"+acts.length+" פעילויות":"אין עדיין פעילויות בסטטוס";
  const notes=realNotes();
  if($("#demoBarO")) $("#demoBarO").hidden=!shared.demoStock;
  if($("#ovNotes")) $("#ovNotes").textContent=fmtN(notes.length);
  const rows=stockRows();
  const sups=new Map();
  let lineN=0;
  notes.forEach(n=>{ const k=(n.supplier||"ספק לא ידוע").trim(); sups.set(k,(sups.get(k)||0)+1); lineN+=(n.lines||[]).length; });
  const wa=notes.filter(n=>/^whatsapp/.test(n.source||"")).length;
  const tss=notes.map(n=>n.ts).filter(Boolean).sort((a,b)=>a-b);
  if(tss.length){
    const m=t=>new Date(t).toLocaleDateString("he-IL",{month:"long"});
    const y=new Date(tss[tss.length-1]).getFullYear();
    const a=m(tss[0]), b=m(tss[tss.length-1]);
    if($("#ovRange")) $("#ovRange").textContent=(a===b?a:a+" – "+b)+" "+y;
  } else if($("#ovRange")) $("#ovRange").textContent="אין עדיין תעודות";
  if($("#ovSub")) $("#ovSub").innerHTML='<b>'+fmtN(sups.size)+'</b> ספקים · <b>'+fmtN(lineN)+'</b> שורות פריטים · <b>'+fmtN(rows.length)+'</b> סוגי פריטים.'
    +(wa?' <b>'+fmtN(wa)+'</b> מהתעודות נקלטו מצילומים שכבר היו בקבוצת הוואטסאפ, בלי הקלדה.':'');

  // weekly chart
  const ch=$("#ovChart"), cx=$("#ovChartX"); if(ch&&cx){ ch.innerHTML=""; cx.innerHTML="";
  if(tss.length){
    const W=7*86400000, first=weekStart(tss[0]), last=weekStart(tss[tss.length-1]);
    const counts=new Map(); notes.forEach(n=>{ if(n.ts){ const k=weekStart(n.ts); counts.set(k,(counts.get(k)||0)+1); } });
    const weeks=[]; for(let t=first;t<=last+3600000*2;t=weekStart(t+W+3600000*12)) weeks.push(t);
    const max=Math.max(1,...weeks.map(w=>counts.get(w)||0));
    const every=weeks.length>10?2:1;
    weeks.forEach((w,i)=>{
      const v=counts.get(w)||0;
      const col=document.createElement("div"); col.className="col"+(v?"":" zero");
      col.title=fmtD(w)+" · "+v+" תעודות";
      col.innerHTML=(v?'<b style="bottom:'+(v/max*100)+'%">'+v+'</b>':'')+'<i style="height:'+(v/max*100)+'%"></i>';
      ch.appendChild(col);
      const lb=document.createElement("span");
      const d=new Date(w); lb.textContent=(i%every===0)?d.getDate()+"/"+(d.getMonth()+1):"";
      cx.appendChild(lb);
    });
  } else ch.innerHTML='<div class="empty" style="width:100%">אין עדיין משלוחים.</div>'; }

  // flags
  const fl=$("#ovFlags"); if(fl){ fl.innerHTML="";
  const flagged=notes.map(n=>({n,f:noteFlags(n)})).filter(x=>x.f.issue||x.f.ret)
    .sort((a,b)=>(b.f.issue-a.f.issue)||(b.n.ts-a.n.ts));
  foldSum("check",flagged.length?flagged.length+" תעודות":"אין");
  if(!flagged.length) fl.innerHTML='<div class="empty" style="padding:18px">אין תעודות שסומנו.</div>';
  flagged.slice(0,flagMax).forEach(({n,f})=>{
    const b=document.createElement("button"); b.type="button";
    b.className="flag"+(f.issue?"":" ret"); b.dataset.id=n.id;
    const what=f.issue?"לבדוק":"החזרה לספק";
    b.innerHTML='<div class="t"><b>'+esc(n.supplier||"ספק לא ידוע")+' · '+what+'</b><span>'
      +esc(n.note||((n.lines||[]).filter(l=>Number(l.qty)<0).map(l=>l.name+" "+fmtN(l.qty)).join(" · ")))
      +' · '+esc(fmtDT(n.dateText)||"")+'</span></div><span class="go">‹</span>';
    fl.appendChild(b);
  });
  if(flagged.length>flagMax){
    const m=document.createElement("button"); m.className="linkbtn"; m.type="button";
    m.textContent="הצג את כל "+flagged.length; m.onclick=()=>{flagMax=999; renderOverview();};
    fl.appendChild(m);
  } }

  // suppliers
  const sl=$("#ovSups"); if(sl){ sl.innerHTML="";
  const top=[...sups.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  const smax=top.length?top[0][1]:1;
  top.forEach(([k,v])=>{
    const el=document.createElement("div"); el.className="hb";
    el.innerHTML='<div class="l" title="'+esc(k)+'">'+esc(k)+'</div><div class="v">'+v+'</div><div class="t"><i style="width:'+(v/smax*100)+'%"></i></div>';
    sl.appendChild(el);
  }); }

  // categories
  const cc={}; notes.forEach(n=>(n.lines||[]).forEach(l=>{ cc[l.cat]=(cc[l.cat]||0)+1; }));
  const cb=$("#ovCatBar"), ck=$("#ovCatKeys"); if(cb&&ck){ cb.innerHTML=""; ck.innerHTML="";
  CATS.filter(c=>cc[c.id]).sort((a,b)=>cc[b.id]-cc[a.id]).forEach(c=>{
    const s=document.createElement("span"); s.style.flex=cc[c.id]; s.style.background=c.color; s.title=c.label+" · "+cc[c.id]; cb.appendChild(s);
    const k=document.createElement("span"); k.innerHTML='<i style="background:'+c.color+'"></i>'+c.label+'<b class="num">'+cc[c.id]+'</b>'; ck.appendChild(k);
  }); }

  // out to contractor / holders
  const hs=holders().slice().sort((a,b)=>b.qty-a.qty);
  const ol=$("#ovOut"); if(ol){ ol.innerHTML="";
  if(!hs.length) ol.innerHTML='<div class="empty" style="padding:16px">לא נרשמו ניפוקים.</div>';
  else {
    const omax=Math.max(...hs.map(h=>h.qty));
    hs.slice(0,8).forEach(h=>{
      const el=document.createElement("div"); el.className="hb";
      el.innerHTML='<div class="l" title="'+esc(h.item)+'">'+esc(h.item)+' <span style="color:var(--ink3);font-weight:500">· '+esc(h.who)+'</span></div>'
        +'<div class="v">'+fmtN(h.qty)+'</div><div class="t"><i style="width:'+(h.qty/omax*100)+'%;background:var(--amber-fill)"></i></div>';
      ol.appendChild(el);
    });
    if(hs.length>8){ const m=document.createElement("button"); m.className="linkbtn"; m.type="button"; m.textContent="כל "+hs.length+" הפריטים, בלשונית מלאי"; m.onclick=()=>showTab("stock"); ol.appendChild(m); }
  } }

  // steps
  const counted=rows.filter(r=>r.counted!==null).length;
  const mvN=(shared.demoStock?DEMO_MOVES:shared.moves).length;
  const steps=[
    {l:"קליטת תעודות משלוח", s:fmtN(notes.length)+" תעודות מ-"+fmtN(sups.size)+" ספקים", done:notes.length>0},
    {l:"רישום מה יוצא לשטח", s:mvN?(fmtN(mvN)+" שורות ניפוק נרשמו"):"כפתור «ניפוק» ליד כל פריט. רושמים מי לקח וכמה.", done:mvN>0},
    {l:"ספירה פיזית באתר", s:counted?("נספרו "+fmtN(counted)+" מתוך "+fmtN(rows.length)+" סוגי פריטים. הבא בתור: 20 הפריטים היקרים."):"עוד לא נספר אף פריט. מתחילים מ-20 הפריטים היקרים.", done:counted>0},
  ];
  if($("#ovSteps")) $("#ovSteps").innerHTML=steps.map(x=>'<div class="step"><div class="l">'+x.l+'</div><span class="p '+(x.done?"p-done":"p-todo")+'">'+(x.done?"פעיל":"הצעד הבא")+'</span><div class="s">'+esc(x.s)+'</div></div>').join("");

  // עדכון אחרון: הרשומה החדשה ביותר מכל המקורות
  const latest=[
    ...notes.map(n=>({ts:n.ts,w:"תעודת משלוח · "+shortSup(n.supplier)})),
    ...(shared.demoStock?[]:shared.issues).map(i=>({ts:i.ts,w:"ניפוק ל-"+(i.who||"")})),
    ...(shared.demoStock?[]:shared.counts).map(c=>({ts:c.ts,w:"ספירה · "+c.item})),
  ].filter(x=>x.ts).sort((a,b)=>b.ts-a.ts)[0];
  const lv=$("#ovLive");
  if(lv) lv.innerHTML=latest?'עודכן: '+esc(latest.w)+' · '+fmtD(latest.ts)+' '+new Date(latest.ts).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}):'';

  renderAlerts();
  renderOnboarding();
  renderTodayTip();
}
/* ---- פרטי תעודה ---- */
export function openNoteDetail(id){
  const n=curNotes().find(x=>x.id===id); if(!n) return;
  const srcs=noteImages(n);
  const lines=(n.lines||[]).map(l=>{
    const c=CATS.find(x=>x.id===l.cat);
    return '<div class="'+(Number(l.qty)<0?"neg":"")+'"><span>'+esc(l.name)+(c?' <small style="color:var(--ink3)">· '+c.label+'</small>':'')+'</span><b>'+fmtN(l.qty)+' '+esc(l.unit||"")+'</b></div>';
  }).join("");
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="תעודת משלוח">'
    +'<div class="grab"></div><h2>'+esc(n.supplier||"ספק לא ידוע")+'</h2>'
    +'<div class="kv"><span>תעודה <b>'+esc(n.noteNo||"—")+'</b></span><span>תאריך <b>'+esc(fmtDT(n.dateText)||fmtD(n.ts))+'</b></span><span><b>'+(n.lines||[]).length+'</b> שורות</span>'+(srcs.length>1?'<span><b>'+srcs.length+'</b> עמודים</span>':'')+(n.by?'<span>קלט <b>'+esc(n.by)+'</b></span>':'')+'</div>'
    +(n.note?'<div class="note-card">'+esc(n.note)+'</div>':'')
    +srcs.map((u,i)=>'<img class="dphoto" src="'+u+'" alt="צילום התעודה'+(srcs.length>1?' עמוד '+(i+1):'')+'">').join("")
    +'<div class="dlines">'+(lines||'<div><span>אין שורות</span><b></b></div>')+'</div>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button>'+(srcs.length?'<button class="ghost" type="button" id="ndPdf" style="flex:1">PDF</button>':'')+'</div></div>');
  const close=closer(scrim);
  scrim.querySelector(".cancel").onclick=close;
  const pdf=scrim.querySelector("#ndPdf");
  if(pdf) pdf.onclick=async()=>{ pdf.disabled=true; pdf.textContent="מכין…"; await exportNotePdf(srcs,"תעודה-"+(n.noteNo||n.id)+".pdf",(n.supplier||"")+" "+(n.noteNo||"")); pdf.disabled=false; pdf.textContent="PDF"; };
}
export function noteImages(n){
  const ids=Array.isArray(n.pages)&&n.pages.length?n.pages:(n.photoAsset?[n.photoAsset]:[]);
  const out=ids.map(id=>"/_blob/"+id); if(!out.length&&n.photoUrl) out.push(n.photoUrl); return out;
}
/* ---- כל התעודות ---- */
export function openAllNotes(){
  let q="", max=30;
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="כל התעודות">'
    +'<div class="grab"></div><h2>כל התעודות</h2>'
    +'<div class="search"><input type="text" id="anQ" placeholder="ספק, מספר תעודה או פריט" autocomplete="off" aria-label="חיפוש תעודה"><span class="ico">⌕</span></div>'
    +'<div class="sechead"><span id="anCount"></span></div>'
    +'<div class="stock" id="anList"></div>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>');
  const close=closer(scrim);
  const list=scrim.querySelector("#anList");
  function draw(){
    const all=curNotes().slice().sort((a,b)=>b.ts-a.ts).filter(n=>!q||hit(n.supplier,q)||hit(n.noteNo,q)||hit(n.note,q)||(n.lines||[]).some(l=>hit(l.name,q)));
    scrim.querySelector("#anCount").textContent=all.length+" תעודות";
    list.innerHTML="";
    if(!all.length){ list.innerHTML='<div class="empty">אין תעודה שמתאימה לחיפוש.</div>'; return; }
    all.slice(0,max).forEach(n=>{
      const f=noteFlags(n);
      const el=document.createElement("button"); el.type="button"; el.className="dnote"; el.dataset.id=n.id;
      if(f.issue) el.style.borderInlineStart="4px solid var(--clay)"; else if(f.ret) el.style.borderInlineStart="4px solid var(--amber-fill)";
      el.innerHTML='<div class="t"><b>'+esc(n.supplier||"ספק לא ידוע")+'</b><span>תעודה '+esc(n.noteNo||"—")+' · '+(n.lines||[]).length+' פריטים · '+esc(fmtDT(n.dateText)||fmtD(n.ts))+'</span></div><span class="go" style="color:var(--ink3)">‹</span>';
      list.appendChild(el);
    });
    if(all.length>max){ const m=document.createElement("button"); m.type="button"; m.className="more"; m.textContent="הצג עוד "+Math.min(30,all.length-max); m.onclick=()=>{max+=30; draw();}; list.appendChild(m); }
  }
  scrim.querySelector("#anQ").oninput=e=>{ q=e.target.value.trim().toLowerCase(); max=30; draw(); };
  list.onclick=e=>{ const c=e.target.closest(".dnote[data-id]"); if(c) openNoteDetail(c.dataset.id); };
  scrim.querySelector(".acts .cancel").onclick=close;
  draw();
}
export function __init(){
/* ================= מלאי ================= */
DEMO_NOTES = [
  {id:"n1",supplier:"ספק א",noteNo:"1001",dateText:"12/09/2026",demo:true,
   ts:Date.now()-86400000*2,lines:[
     {name:"כבל סולארי 6",qty:3000,unit:"מ'",cat:"electrical"},
     {name:"מחבר MC4 זוג",qty:400,unit:"יח'",cat:"electrical"}]},
  {id:"n2",supplier:"ספק ב",noteNo:"1002",dateText:"08/09/2026",demo:true,
   ts:Date.now()-86400000*6,lines:[
     {name:"צינור קוברה 50",qty:1200,unit:"מ'",cat:"electrical"},
     {name:"שלט סימון כבל",qty:500,unit:"יח'",cat:"electrical"},
     {name:"מהדק כבלים",qty:2000,unit:"יח'",cat:"electrical"}]},
];
DEMO_COUNTS = [
  {id:"c1",item:"צינור קוברה 50",qty:900,who:"מנהל עבודה",ts:Date.now()-86400000*2,demo:true},
];
DEMO_MOVES = [
  {id:"m1",item:"כבל סולארי 6",qty:1200,dir:"out",who:"צוות 1",ts:Date.now()-86400000*1,demo:true},
  {id:"m2",item:"צינור קוברה 50",qty:300,dir:"out",who:"צוות 1",ts:Date.now()-86400000*3,demo:true},
];
CATS = [
  {id:"construction",label:"קונסטרוקציה",color:"var(--amber-fill)"},
  {id:"electrical",  label:"חשמל",        color:"var(--info-fill)"},
  {id:"panels",      label:"פאנלים",      color:"var(--sage-fill)"},
  {id:"safety",      label:"בטיחות",      color:"var(--pv)"},
  {id:"staging",     label:"שטח התארגנות",color:"var(--ink2)"},
  {id:"tools",       label:"כלי עבודה",   color:"var(--ink3)"},
  {id:"containers",  label:"מכולות",      color:"var(--ink)"},
  {id:"civil",       label:"סיביל",       color:"var(--clay)"},
];
CATLIST = CATS.map(c=>c.id+' = '+c.label).join(', ');
shared.deliveries=[];
shared.moves=[];
shared.counts=[];
shared.demoStock=true;
catFilter = "all";
openCats = new Set((()=>{ try{ return JSON.parse(localStorage.getItem("openCats")||"[]"); }catch(e){ return []; } })());
stockQ = "";
stockMax = 40;
holdMax = 6;
supFilter = "all";
hit = (t,q)=>!q||String(t||"").toLowerCase().includes(q);
/* ---- חתימה בניפוק כלי עבודה (כמו בניפוק חומרים) ---- */
moveSigned = m=>!!(m.sigAsset||m.sigUrl||m.sigData);
/* ---- אירועים ---- */
$("#btnNote").onclick=openNote;
$("#btnClearDemoS").onclick=()=>{shared.demoStock=false;ls.set("demoDoneS","1");renderStock();};
$("#stockList").onclick=e=>{
  const n=e.target.dataset&&e.target.dataset.out; if(n) openMove(n);
};
$("#noteList").onkeydown=e=>{ if(e.key==="Enter"){ const c=e.target.closest(".dnote[data-id]"); if(c) openNoteDetail(c.dataset.id); } };
$("#noteList").onclick=async e=>{
  const id=e.target.dataset&&e.target.dataset.delnote;
  if(!id){ const c=e.target.closest(".dnote[data-id]"); if(c) openNoteDetail(c.dataset.id); return; }
  if(!(await ask("למחוק את התעודה? הפריטים שלה ירדו מהמלאי."))) return;
  const old=byId(shared.deliveries,id);
  try{
    if(shared.DB) await shared.DB.collection("deliveries").doc(id).delete();
    else { shared.deliveries=shared.deliveries.filter(d=>d.id!==id);
      ls.set("deliveries",JSON.stringify(shared.deliveries)); renderStock(); }
  }catch(err){ toast("המחיקה נכשלה."); return; }
  logAct("delivery","delete","נמחקה תעודה "+(old?(old.noteNo||"—")+" · "+(old.supplier||""):id),id,null,old?{...old,photoUrl:""}:null);
};
$("#btnStockCsv").onclick=async()=>{
  const rows=stockRows();
  if(!rows.length){ toast("אין מלאי לייצוא."); return; }
  const head=["קטגוריה","ספק","פריט","יחידה","הגיע","יצא לשטח","תיאורטי","נספר","תאריך ספירה","פער"];
  const lines=[head.join(",")].concat(rows.map(r=>
    [(CATS.find(c=>c.id===r.cat)||{}).label||"",[...(r.sups||[])].join(" · "),r.name,r.unit,r.in,r.out,r.derived,
      r.counted===null?"לא נספר":r.counted,
      r.countedTs?fmtD(r.countedTs):"",
      r.counted===null?"":(r.counted-r.derived)]
      .map(c=>'"'+String(c??"").replace(/"/g,'""')+'"').join(",")));
  const csv="﻿"+lines.join("\r\n");
  const name="מלאי-אתר-"+new Date().toISOString().slice(0,10)+".csv";
  if(shared.DOWNLOADS){
    try{ await shared.DOWNLOADS.save({filename:name,data:new Blob([csv],{type:"text/csv"})}); return; }
    catch(e){ if(!(e && e.code==="declined")) toast("הייצוא לא זמין כאן כרגע."); return; }
  }
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download=name; a.click();
};
/* ---- ספק ---- */
$("#supSel").onchange=e=>{ supFilter=e.target.value; stockMax=40; renderStock(); };
$("#supClr").onclick=()=>{ supFilter="all"; stockMax=40; renderStock(); };
/* ---- חיפוש ---- */
$("#stockSearch").oninput=e=>{
  stockQ=e.target.value.trim().toLowerCase(); stockMax=40;
  $("#stockClr").hidden=!stockQ; renderStock();
};
$("#stockClr").onclick=()=>{
  $("#stockSearch").value=""; stockQ=""; stockMax=40;
  $("#stockClr").hidden=true; renderStock();
};
/* ---- ייבוא מוואטסאפ ---- */
shared.imported=new Set();
   // hashes already ingested (db "imports" or local)
IMPORT_PROMPT = "בתמונה מסמך שצולם בקבוצת וואטסאפ של אתר עבודות חשמל (שדה סולארי, תחנות ממירים, חדר חשמל). החזר רק JSON: "
+ '{"kind":"delivery"|"skip","skipReason":"<אם skip: למה, בקצרה>",'
+ '"supplier":"<שם הספק או null>","noteNo":"<מספר התעודה או null>","date":"<תאריך כפי שמופיע או null>",'
+ '"page":"<למשל 1/4 אם כתוב, אחרת null>",'
+ '"lines":[{"name":"<תיאור הפריט>","qty":<מספר>,"unit":"<יחידה או null>","cat":"<קטגוריה>"}],'
+ '}. '
+ "delivery = תעודת משלוח/קבלה של ציוד שנספר במלאי. "
+ "skip = כל אחד מאלה: תעודת שקילה של חול/חצץ/אגרגט; יומן עבודה של קבלן; תעודת ביצוע או שטר מטען של מנופים/הובלות שלא מפרטים סחורה; "
+ "סלעית (מכולות אשפה); קבלה/חשבונית של מינימרקט או מזון; טופס תיקון; חשבונית סיכום חודשית; דף שאינו מסמך. "
+ "מסירת מטען ממכולה (קונטרם/פרידנסון) עם משטחים = delivery עם cat=containers. "
+ "דלק = delivery, שם הפריט בדיוק סולר או בנזין, cat=staging. "
+ "כדי מים: כדים שסופקו כמות חיובית, כדים ריקים שהוחזרו כמות שלילית. "
+ "תעודת החזרה לספק: כל הכמויות שליליות. "
+ "קח רק שורות פריטים אמיתיות עם כמות. אל תמציא ואל תשלים מספרים שלא ברורים — אם לא קריא החזר null. "
+ "cat חייב להיות אחד מאלה בדיוק (הערך האנגלי): "+CATLIST+". "
+ "פאנלים סולאריים=panels, מסילות/מבנה/ברגים/קלאמפים=construction, כבלים/ממירים/חיבורים/צנרת חשמל=electrical, "
+ "קסדות/רתמות/גידור/שילוט=safety, ריהוט/משרד/ניקיון/מים/דלק/ציוד אתר=staging, מקדחות/מפתחות/ציוד עבודה=tools, משטחים במכולה=containers.";
ham = (a,b)=>{ let n=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) n++; return n; };
hashId = bits=>{ let h=0x811c9dc5; for(let i=0;i<bits.length;i++){ h^=bits.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h.toString(16).padStart(8,"0")+bits.length.toString(16); };
$("#btnImport").onclick=openImport;
/* ---- תמונת מצב ---- */
ISSUE_RE = /לא תקינ|פגו[םמ]|חוס[ר]|חיסור|לאמת|חלקית|שבור|נזק/;
RET_RE = /החזרה/;
curNotes = ()=>shared.demoStock?DEMO_NOTES:shared.deliveries;
isBomNote = n=>n.source==="bom";
realNotes = ()=>curNotes().filter(n=>!isBomNote(n));
fmtN = n=>Number(n).toLocaleString("he-IL");
fmtM3 = n=>(Math.round(n*10)/10).toLocaleString("he-IL");
shortName = n=>String(n||"").replace(/\s*\(מק״ט[^)]*\)/,"").trim();
shortSup = s=>String(s||"").replace(/\s*בע"מ.*$/,"").replace(/\s*\(.*?\)/g,"").trim();
flagMax = 6;
if($("#ovFlags")) $("#ovFlags").onclick=e=>{ const b=e.target.closest(".flag[data-id]"); if(b) openNoteDetail(b.dataset.id); };
$("#btnAllNotes").onclick=openAllNotes;
}
