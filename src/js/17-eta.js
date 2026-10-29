/* ================= תאריכי אספקה לאתר ================= */
const dueIso=d=>{ const m=String(d||"").match(/^(\d\d)\/(\d\d)\/(\d\d)$/); return m?("20"+m[3]+"-"+m[2]+"-"+m[1]):""; };
const fmtIso=iso=>{ const m=String(iso||"").match(/^(\d{4})-(\d\d)-(\d\d)$/); return m?fmtD(new Date(+m[1],+m[2]-1,+m[3],12)):""; };
function etaRows(){
  const today=isoOf(Date.now()); const rows=[];
  (demoStock?[]:ETA).forEach(e=>{ rows.push({kind:"eta",id:e.id,date:e.date||"",title:e.title||"",supplier:e.supplier||"",note:e.note||"",ref:e.ref||"",source:e.source||"",arrived:e.status==="arrived",arrivedTs:e.arrivedTs||0,doc:e}); });
  (demoStock?[]:POS).forEach(p=>{ const st=poStatus(p); if(st.k==="ok"||st.k==="cancelled"||st.k==="none") return;
    const dues=(p.lines||[]).filter(l=>!l.skip).map(l=>dueIso(l.due)).filter(Boolean).sort(); const date=dues.length?dues[dues.length-1]:isoOf(p.ts+7*864e5);
    rows.push({kind:"po",id:p.id,date,title:(p.details||"הזמנת רכש")+" · "+st.n+" שורות"+(st.got?" · הגיעו "+st.got:""),supplier:shortSup(p.supplier||""),ref:p.no,source:"PO",hold:st.k==="hold",arrived:false,doc:p}); });
  (demoStock?[]:orders).filter(o=>(o.status==="sent"||o.status==="partial")&&o.need).forEach(o=>{ rows.push({kind:"order",id:o.id,date:o.need,title:(o.task||"הזמנה מהאפליקציה")+" · "+(o.lines||[]).length+" פריטים",supplier:[...orderGroups(o).keys()].join(", "),ref:o.no,source:"אפליקציה",arrived:false,doc:o}); });
  rows.forEach(r=>{ r.late=!r.arrived&&!r.hold&&!!r.date&&r.date<today; r.soon=!r.arrived&&!!r.date&&r.date>=today&&r.date<=isoOf(Date.now()+7*864e5); });
  return rows.sort((a,b)=>(a.date||"9999")<(b.date||"9999")?-1:(a.date||"9999")>(b.date||"9999")?1:0);
}
function renderEta(){
  const el=$("#orEta"); if(!el) return; el.innerHTML="";
  const rows=etaRows(); const open=rows.filter(r=>!r.arrived), late=open.filter(r=>r.late), soon=open.filter(r=>r.soon), later=open.filter(r=>!r.late&&!r.soon), done=rows.filter(r=>r.arrived).sort((a,b)=>(b.arrivedTs||0)-(a.arrivedTs||0));
  foldSum("eta",(late.length?late.length+" באיחור":"")+(soon.length?(late.length?" · ":"")+soon.length+" השבוע":"")||(open.length?open.length+" צפויים":"אין"));
  if(!rows.length){ el.innerHTML='<div class="empty" style="padding:16px">אין עדיין תאריכי אספקה. הוסף ידנית, או שהם נכנסים מהזמנות הרכש ומהודעות המכס.</div>'; return; }
  const group=(label,color,list,max)=>{ if(!list.length) return; const h=document.createElement("div"); h.className="grouphead"; h.innerHTML='<i style="background:'+color+'"></i>'+esc(label)+'<span>'+list.length+'</span>'; el.appendChild(h);
    list.slice(0,max||50).forEach(r=>{ const b=document.createElement("button"); b.type="button"; b.className="slip";
      b.innerHTML='<b>'+(r.date?'<span class="num" style="color:'+(r.arrived?"var(--sage)":r.late?"var(--clay)":"var(--ink)")+'">'+esc(fmtIso(r.date))+'</span> · ':'')+esc(r.title)+'</b>'
        +(r.hold?'<span class="sigok" style="background:var(--line2);color:var(--clay)">מוקפא</span>':r.arrived?'<span class="sigok" style="background:var(--sage-fill,var(--line2));color:var(--sage)">הגיע'+(r.arrivedTs?' '+fmtD(r.arrivedTs):'')+'</span>':'')
        +'<span>'+esc([r.supplier,r.ref,r.source].filter(Boolean).join(" · "))+(r.note?' · '+esc(r.note.slice(0,80))+(r.note.length>80?"…":""):'')+'</span>';
      b.onclick=()=>{ if(r.kind==="po") openPoDetail(r.doc); else if(r.kind==="order") openOrderDetail(r.doc); else openEtaItem(r.doc); };
      el.appendChild(b); });
    if(list.length>(max||50)){ const d=document.createElement("div"); d.className="hint"; d.textContent="ועוד "+(list.length-(max||50)); el.appendChild(d); } };
  group("באיחור — עבר התאריך ולא נקלט","var(--clay)",late);
  group("השבוע","var(--amber)",soon);
  group("בהמשך / בלי תאריך","var(--info)",later);
  group("הגיע","var(--sage)",done,5);
}
async function saveEta(doc){
  try{ if(DB) await DB.doc("eta/"+doc.id).set(doc); else { ETA=ETA.filter(x=>x.id!==doc.id).concat(doc); ls.set("eta",JSON.stringify(ETA)); } }catch(e){ toast("השמירה נכשלה."); return false; }
  renderOrders(); return true;
}
function openEtaForm(existing){
  const e=existing?{...existing}:{id:"eta"+Date.now().toString(36),date:"",title:"",supplier:"",ref:"",source:"ידני",note:"",status:"expected",by:actorName(),ts:Date.now()};
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="תאריך אספקה"><div class="grab"></div><h2>'+(existing?"עריכת ":"")+'תאריך אספקה לאתר</h2>'
    +'<div class="f"><label for="etTitle">מה מגיע</label><input type="text" id="etTitle" placeholder="למשל: שנאי · 2 מכולות MVS · כבל סטרינג" value="'+esc(e.title)+'"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="etDate">תאריך צפוי</label><input type="date" id="etDate" value="'+esc(e.date||"")+'"></div><div class="f"><label for="etSup">ספק / מוביל</label><input type="text" id="etSup" list="orSups2" value="'+esc(e.supplier||"")+'"><datalist id="orSups2">'+[...new Set([...POS.map(p=>shortSup(p.supplier||"")),...ETA.map(x=>x.supplier||"")].filter(Boolean))].map(x=>'<option value="'+esc(x)+'"></option>').join("")+'</datalist></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="etRef">אסמכתא (PO / תיק מכס)</label><input type="text" id="etRef" value="'+esc(e.ref||"")+'"></div><div class="f"><label for="etSrc">מקור</label><input type="text" id="etSrc" placeholder="מייל רכש · מכס · טלפון" value="'+esc(e.source||"")+'"></div></div>'
    +'<div class="f"><label for="etNote">הערה</label><input type="text" id="etNote" placeholder="תיאום, איש קשר, מכולות" value="'+esc(e.note||"")+'"></div>'
    +'<div class="acts"><button class="save" id="etSave" type="button">שמור</button><button class="cancel" type="button">ביטול</button></div></div>';
  document.body.appendChild(scrim); const q=x=>scrim.querySelector(x); const close=()=>scrim.remove();
  q(".cancel").onclick=close; scrim.onclick=ev=>{ if(ev.target===scrim) close(); };
  q("#etSave").onclick=async()=>{ const title=q("#etTitle").value.trim(); if(!title){ toast("מה מגיע?"); return; }
    const doc={...e,title,date:q("#etDate").value||"",supplier:q("#etSup").value.trim(),ref:q("#etRef").value.trim(),source:q("#etSrc").value.trim()||"ידני",note:q("#etNote").value.trim(),updated:Date.now()};
    q("#etSave").disabled=true; if(await saveEta(doc)){ logAct("order",existing?"edit":"add",(existing?"עודכן":"נוסף")+" תאריך אספקה: "+doc.title+(doc.date?" · "+fmtIso(doc.date):""),doc.id); close(); } else q("#etSave").disabled=false; };
}
function openEtaItem(e){
  e=ETA.find(x=>x.id===e.id)||e; const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="אספקה"><div class="grab"></div><h2>'+esc(e.title)+'</h2>'
    +'<div class="kv">'+(e.date?'<span>צפוי <b>'+esc(fmtIso(e.date))+'</b></span>':'<span>בלי תאריך</span>')+(e.supplier?'<span>'+esc(e.supplier)+'</span>':'')+(e.ref?'<span>'+esc(e.ref)+'</span>':'')+(e.source?'<span>מקור: '+esc(e.source)+'</span>':'')+(e.status==="arrived"?'<span style="color:var(--sage)">הגיע '+esc(fmtD(e.arrivedTs||0))+'</span>':'')+'</div>'
    +(e.note?'<div class="note-card">'+esc(e.note)+'</div>':'')
    +(ROLE!=="viewer"?'<div class="chips">'+(e.status!=="arrived"?'<button type="button" class="chip2" id="etArr" style="border-color:var(--sage)">הגיע לאתר</button>':'<button type="button" class="chip2" id="etUnarr">עדיין לא הגיע</button>')+'<button type="button" class="chip2" id="etEdit">ערוך</button>'+(ROLE==="owner"?'<button type="button" class="chip2" id="etDel" style="border-color:var(--clay)">מחק</button>':'')+'</div>':'')
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>';
  document.body.appendChild(scrim); const q=x=>scrim.querySelector(x); const close=()=>scrim.remove();
  q(".cancel").onclick=close; scrim.onclick=ev=>{ if(ev.target===scrim) close(); };
  const arr=q("#etArr"); if(arr) arr.onclick=async()=>{ if(await saveEta({...e,status:"arrived",arrivedTs:Date.now(),arrivedBy:actorName()})){ logAct("order","edit","הגיע לאתר: "+e.title,e.id); close(); } };
  const un=q("#etUnarr"); if(un) un.onclick=async()=>{ const d={...e,status:"expected"}; delete d.arrivedTs; if(await saveEta(d)) close(); };
  const ed=q("#etEdit"); if(ed) ed.onclick=()=>{ close(); openEtaForm(e); };
  const del=q("#etDel"); if(del) del.onclick=async()=>{ if(!(await ask("למחוק את "+e.title+"?","מחק","var(--clay)"))) return; try{ if(DB) await DB.doc("eta/"+e.id).delete(); else { ETA=ETA.filter(x=>x.id!==e.id); ls.set("eta",JSON.stringify(ETA)); } }catch(err){ toast("המחיקה נכשלה."); return; } logAct("order","edit","נמחק תאריך אספקה: "+e.title,e.id); close(); renderOrders(); };
}
function renderPos(){
  const el=$("#orPos"); if(!el) return; el.innerHTML="";
  const P=(demoStock?[]:POS).slice().sort((a,b)=>b.ts-a.ts);
  if(!P.length){ foldSum("pos",""); el.innerHTML='<div class="empty" style="padding:16px">אין עדיין הזמנות רכש מהרכש. הן נכנסות מהמיילים של מחלקת הרכש.</div>'; return; }
  const sts=P.map(poStatus); const open=sts.filter(s=>s.k!=="ok"&&s.k!=="cancelled").length;
  foldSum("pos",P.length+" הזמנות · "+open+" פתוחות");
  P.slice(0,posMax).forEach((p,i)=>{ const st=sts[i]; const b=document.createElement("button"); b.type="button"; b.className="slip";
    b.innerHTML='<b>'+esc(p.no)+' · '+esc(shortSup(p.supplier||""))+'</b><span class="sigok" style="background:var(--line2);color:'+st.color+'">'+esc(st.label)+'</span><span>'+esc(fmtDT(p.dateText)||"")+(p.details?' · '+esc(p.details):'')+' · '+(p.lines||[]).filter(l=>!l.skip).length+' שורות</span>';
    b.onclick=()=>openPoDetail(p); el.appendChild(b); });
  if(P.length>posMax){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent="עוד "+(P.length-posMax); m.onclick=()=>{ posMax+=12; renderPos(); }; el.appendChild(m); }
}
function openPoDetail(p){
  p=POS.find(x=>x.id===p.id)||p; const st=poStatus(p); const cat=catalog();
  const scrim=document.createElement("div"); scrim.className="scrim";
  let html='<div class="sheet" role="dialog" aria-modal="true" aria-label="הזמנת רכש"><div class="grab"></div><h2>'+esc(p.no)+' <span class="role-badge" style="background:var(--line2);color:'+st.color+'">'+esc(st.label)+'</span></h2>'
    +'<div class="kv"><span>'+esc(fmtDT(p.dateText)||"")+'</span><span>'+esc(p.supplier||"")+'</span>'+(p.details?'<span>'+esc(p.details)+'</span>':'')+'</div>'
    +(p.note?'<div class="note-card">'+esc(p.note)+'</div>':'')
    +'<div class="dlines">'+(p.lines||[]).map(l=>{ if(l.skip) return '<div><span style="color:var(--ink3)">'+esc(l.name)+'</span><b style="color:var(--ink3)">'+fmtN(l.qty)+' '+esc(l.unit||"")+'</b></div>';
      const rec=receivedSince(p,l); const need=(Number(l.qty)||0)*unitMult(l.unit); const item=l.boq&&l.boq!=="-"?cat.find(c=>c.codes.includes(String(l.boq))):null;
      return '<div><span>'+esc(l.name)+(l.sku?' <small style="color:var(--ink3)">מק״ט '+esc(l.sku)+'</small>':'')+(item?'<br><small style="color:var(--ink3)">→ '+esc(item.name)+' · סעיף '+esc(l.boq)+(l.boqConf==="likely"?' ?':'')+'</small>':l.boq==="-"?'<br><small style="color:var(--ink3)">לא ב-EBOQ</small>':'<br><small style="color:var(--amber)">לא מקושר ל-EBOQ</small>')+(l.due?'<br><small style="color:var(--ink3)">אספקה '+esc(fmtDT(l.due.replace(/(\d\d)\/(\d\d)\/(\d\d)$/,"$1/$2/20$3")))+'</small>':'')+'</span><b>'+fmtN(l.qty)+' '+esc(l.unit||"")+'<br><small style="color:'+(rec>=need&&need?"var(--sage)":rec?"var(--amber)":"var(--clay)")+'">הגיעו '+fmtN(rec)+'</small></b></div>'; }).join("")+'</div>'
    +'<div class="row2" style="margin-top:8px">'+(ROLE!=="viewer"?'<button class="ghost" type="button" id="pdLink">קישור שורות ל-EBOQ</button>':'')+'<button class="ghost" type="button" id="pdCopy">העתק טקסט</button></div>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>';
  scrim.innerHTML=html; document.body.appendChild(scrim);
  const close=()=>scrim.remove(); scrim.querySelector(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  const lk=scrim.querySelector("#pdLink"); if(lk) lk.onclick=()=>{ close(); openBoqLinker(p.no); };
  scrim.querySelector("#pdCopy").onclick=()=>copyText("*"+p.no+" · "+(p.supplier||"")+"*\n"+(fmtDT(p.dateText)||"")+(p.details?" · "+p.details:"")+"\n"+(p.lines||[]).filter(l=>!l.skip).map((l,i)=>(i+1)+". "+l.name+" — "+fmtN(l.qty)+" "+(l.unit||"")+" · הגיעו "+fmtN(receivedSince(p,l))).join("\n"));
}

$("#btnOrder").onclick=()=>openOrder();
$("#btnBoq").onclick=openImportChooser;
$("#btnBoqLink").onclick=openBoqLinker;
$("#btnEta").onclick=()=>openEtaForm();
$("#btnReqCopy").onclick=()=>{ const t=reqMissingText(); if(t.split("\n\n").length<2){ toast("אין בקשות פתוחות שדורשות טיפול."); return; } copyText(t); };
$("#btnReqCsv").onclick=()=>{ const M=REQM||requestMatch(); if(!M.rows.length){ toast("אין בקשות."); return; }
  saveFile("בקשות-מול-הזמנות-"+isoOf(Date.now())+".csv",new Blob([csvOf(["בקשה","תאריך בקשה","פריט","סעיף EBOQ","יחידה","ביקשתי","הוזמן","מוקפא","PO","תאריך אספקה","הגיע","מצב","לטובת","נדרש עד"],M.rows.map(r=>[r.o.no,fmtD(r.o.ts),r.l.name,r.l.boq||"",r.l.unit||"",r.qty,r.ordered,r.hold||"",r.pos.map(m=>m.p.no).join(" "),r.due?fmtD(r.due):"",r.arrived,REQ_ST[r.k][0],r.o.task||"",r.o.need?r.o.need.split("-").reverse().join("/"):""]))],{type:"text/csv"})); };
$("#btnOrdersCsv").onclick=()=>{ const rows=orders.slice().sort((a,b)=>a.ts-b.ts).flatMap(o=>[...orderGroups(o).entries()].flatMap(([sp,L])=>L.map(l=>[o.no,fmtD(o.ts),(ORDER_ST[o.status]||ORDER_ST.draft)[0],sp,l.boq||l.code||"",l.sku||"",l.name,l.qty,l.unit,(CATS.find(c=>c.id===l.cat)||{}).label||l.cat,o.task,o.need?o.need.split("-").reverse().join("/"):"",l.note])));
  if(!rows.length){ toast("אין הזמנות."); return; } saveFile("הזמנות-רכש-"+isoOf(Date.now())+".csv",new Blob([csvOf(["הזמנה","תאריך","סטטוס","ספק","סעיף EBOQ","מק״ט ספק","פריט","כמות","יחידה","קטגוריה","לטובת","נדרש עד","הערה"],rows)],{type:"text/csv"})); };

