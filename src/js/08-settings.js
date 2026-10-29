import { $, BLAME, LOG_KINDS, ask, byId, esc, fmtD, logAct, ls, openLog, popup, render, shared, toast } from "./core.js";
import { CATS, fmtN, renderOverview, renderStock } from "./01-stock.js";
import { renderConcrete } from "./02-concrete.js";
import { openKitEditor, perOf, saveKit, typeLabel } from "./03-kit.js";
import { shortName } from "./04-contractors.js";
import { FAB_LABEL } from "./05-panels.js";
import { saveBoq } from "./13-purchasing.js";
import { openImportChooser, saveCba } from "./14-cba.js";
import { ROLE } from "./18-identity.js";
export let KIT_SOURCE_DEFAULT, APP_VERSION, SHOW_PRICES, SITE, csvOf;
export function applySite(d){
  if(!d) return;
  SITE={name:String(d.name||SITE.name),company:String(d.company||SITE.company),panelsPerTable:Number(d.panelsPerTable)||81,custom:true,bomImported:!!d.bomImported};
  shared.PANELS_PER_TABLE=SITE.panelsPerTable;
  const el=$("#siteName"); if(el) el.innerHTML='<b>'+esc(SITE.company)+'</b>'+esc(SITE.name);
  document.title="יומן אתר · "+SITE.name;
}
export async function saveSite(doc){
  doc.ts=Date.now();
  if(shared.DB) await shared.DB.doc("settings/site").set(doc); else { ls.set("site",JSON.stringify(doc)); applySite(doc); }
}
export function openSettings(){
  let types=shared.kitTypes.map(t=>({...t}));
  const F=(id,l,v,hint,ph)=>'<div class="f"><label for="'+id+'">'+l+'</label><input type="text" id="'+id+'" value="'+esc(v??"")+'" placeholder="'+esc(ph||"")+'" autocomplete="off">'+(hint?'<div class="hint">'+hint+'</div>':'')+'</div>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="הגדרות"><div class="grab"></div><h2>הגדרות</h2>'
    +'<div class="setgrid">'
      +'<button class="ghost" type="button" id="stLog">יומן פעולות<small>מי שמר, מתי ומה</small></button>'
      +'<button class="ghost" type="button" id="stBackup">גיבוי מלא<small>קובץ JSON של כל הנתונים</small></button>'
      +'<button class="ghost" type="button" id="stZip">ייצוא לאקסל<small>כל הטבלאות ב-ZIP</small></button>'
      +'<button class="ghost" type="button" id="stBom">ייבוא BOM / EBOQ / CBA<small>קונסטרוקציה · חשמל · מסחרי</small></button>'
    +'</div>'
    +F("stName","שם האתר",SITE.name,"","למשל: אתר הקמה עין תמר")
    +F("stCo","חברה",SITE.company,"","BELECTRIC")
    +F("stMe","השם שלך",ls.get("issuer")||"","נשמר במכשיר הזה וממולא אוטומטית כמנפיק / סופר / מדווח.","השם שלך")
    +'<div class="f"><label>סוגי שולחנות וכמות באתר</label><div class="kitrows" id="stTypes"></div>'
      +'<button class="addline" type="button" id="stAddType" style="margin-top:8px">+ סוג שולחן</button>'
      +'<div class="hint">סה״כ שולחנות באתר הוא הסכום. ממנו מחושבים «נותרו» ו«לכמה שולחנות המלאי מספיק».</div></div>'
    +F("stPpt","פאנלים לשולחן",SITE.panelsPerTable,"משמש להערכת כמה שולחנות עומדים לפי הפאנלים המותקנים.","81")
    +'<div class="f" id="stDanger" hidden><label>ניהול</label><div class="setgrid">'
      +'<button class="ghost danger" type="button" id="stRestore">שחזור מגיבוי<small>כותב את כל הנתונים מקובץ JSON</small></button>'
      +'<button class="ghost" type="button" id="stDemo">איפוס תצוגת דוגמה<small>מציג שוב נתוני דוגמה במכשיר הזה</small></button>'
    +'</div></div>'
    +'<div class="acts"><button class="save" id="stSave" type="button">שמור הגדרות</button><button class="cancel" id="stCancel" type="button">סגור</button></div>'
    +'<div class="hint" style="text-align:center;margin-top:14px">יומן אתר · גרסה '+APP_VERSION+' · הנתונים נשמרים במרחב של האפליקציה ונגישים לכל מי שקיבל קישור'+(shared.DB?'':' · <b>כרגע במכשיר הזה בלבד</b>')+'</div></div>');
  const q=s=>scrim.querySelector(s);
  function drawTypes(){
    const box=q("#stTypes"); box.innerHTML="";
    types.forEach((t,i)=>{ const r=document.createElement("div"); r.className="typerow";
      r.innerHTML='<input type="text" value="'+esc(t.label)+'" placeholder="שם הסוג" aria-label="שם סוג שולחן"><input type="text" inputmode="numeric" data-c value="'+esc(t.count??"")+'" placeholder="כמה" aria-label="כמות"><button class="x" type="button" aria-label="הסר">×</button>';
      r.children[0].oninput=e=>{ types[i].label=e.target.value; }; r.children[1].oninput=e=>{ types[i].count=e.target.value; };
      r.children[2].onclick=()=>{ if(types.length<=1){ toast("צריך לפחות סוג אחד."); return; } types.splice(i,1); drawTypes(); };
      box.appendChild(r); });
    const tot=types.reduce((s,t)=>s+(Number(t.count)||0),0);
    const h=document.createElement("div"); h.className="hint"; h.textContent="סה״כ "+fmtN(tot)+" שולחנות"; box.appendChild(h);
  }
  q("#stAddType").onclick=()=>{ types.push({id:"t"+Date.now().toString(36),label:"",count:""}); drawTypes(); };
  q("#stLog").onclick=()=>{ scrim.remove(); openLog(); };
  q("#stBackup").onclick=()=>exportBackup();
  q("#stZip").onclick=()=>exportAllCsv();
  q("#stBom").onclick=()=>{ scrim.remove(); openImportChooser(); };
  q("#stRestore").onclick=()=>{ scrim.remove(); openRestore(); };
  q("#stDemo").onclick=()=>{ ["demoDone","demoDoneS"].forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); location.reload(); };
  const showAdmin=ROLE==="owner"; q("#stDanger").hidden=!showAdmin;
  if(ROLE!=="owner"){ ["#stSave","#stAddType","#stBom"].forEach(x=>{ const e=q(x); if(e) e.hidden=true; }); scrim.querySelectorAll("#stTypes input,#stName,#stCo,#stPpt").forEach(i=>i.disabled=true); }
  q("#stCancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#stSave").onclick=async()=>{
    const me=q("#stMe").value.trim(); if(me) ls.set("issuer",me);
    const okTypes=types.filter(t=>String(t.label).trim()).map(t=>({id:t.id,label:String(t.label).trim(),count:Math.max(0,Math.round(Number(t.count)||0)),customized:true}));
    if(!okTypes.length){ toast("צריך לפחות סוג שולחן אחד."); return; }
    const site={name:q("#stName").value.trim()||SITE.name,company:q("#stCo").value.trim()||SITE.company,panelsPerTable:Math.max(1,Math.round(Number(q("#stPpt").value)||81)),bomImported:!!SITE.bomImported};
    const b=q("#stSave"); b.disabled=true; b.textContent="שומר…";
    try{
      await saveSite(site);
      const typesChanged=JSON.stringify(okTypes.map(t=>[t.id,t.label,t.count]))!==JSON.stringify(shared.kitTypes.map(t=>[t.id,t.label,Number(t.count)||0]));
      if(typesChanged){
        // כל פריט בקיט צריך כמות לכל סוג: סוג חדש מקבל את הכמות של הסוג הראשון
        const lines=shared.kit.map(k=>{ const per={}; okTypes.forEach(t=>{ per[t.id]=perOf(k,t.id)||perOf(k,shared.kitTypes[0]?shared.kitTypes[0].id:""); }); return {...k,per}; });
        shared.kitTypes=okTypes; await saveKit(lines,shared.kitSource,"סוגי שולחנות עודכנו: "+okTypes.map(t=>t.label+" × "+t.count).join(", "));
      }
    }catch(e){ b.disabled=false; b.textContent="שמור הגדרות"; toast("השמירה נכשלה."); return; }
    logAct("settings","edit","הגדרות אתר: "+site.name+" · "+site.company+" · "+site.panelsPerTable+" פאנלים לשולחן","settings/site",me||null);
    scrim.remove(); toast("ההגדרות נשמרו."); renderOverview();
  };
  drawTypes();
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
/* ---- גיבוי ושחזור ---- */
export async function saveFile(name,blob){
  if(shared.DOWNLOADS){ try{ await shared.DOWNLOADS.save({filename:name,data:blob}); return true; }catch(e){ if(!(e&&e.code==="declined")) toast("הייצוא לא זמין כאן כרגע."); return false; } }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); return true;
}
export function backupObject(){
  return {app:"yoman-atar",version:2,exportedAt:new Date().toISOString(),site:SITE,
    bom:{types:shared.kitTypes,lines:shared.kit,source:shared.kitSource},prices:shared.prices,
    deliveries:shared.deliveries,moves:shared.moves,counts:shared.counts,concrete:shared.concrete,issues:shared.issues,progress:shared.progress,panelbal:shared.panelBal,panelmoves:shared.panelMoves,daylog:shared.daylog,crew:shared.CREW,status:shared.STATUS,orders:shared.orders,pos:shared.POS,eta:shared.ETA,boq:{lines:shared.boq,source:shared.boqSource},cba:ROLE==="owner"?shared.cba:undefined,suppliers:shared.SUPPLIERS,panels:shared.records,log:shared.logs};
}
export async function exportBackup(){
  if(shared.demoStock&&!shared.deliveries.length){ toast("אין עדיין נתונים אמיתיים לגיבוי."); return; }
  const o=backupObject();
  const n=["deliveries","moves","counts","concrete","issues","progress","panelbal","panels"].reduce((s,k)=>s+(o[k]||[]).length,0);
  const name="יומן-אתר-גיבוי-"+new Date().toISOString().slice(0,10)+".json";
  if(await saveFile(name,new Blob([JSON.stringify(o)],{type:"application/json"}))){ toast("גיבוי: "+fmtN(n)+" רשומות."); logAct("backup","add","גיבוי מלא יוצא · "+fmtN(n)+" רשומות",""); }
}
export async function exportAllCsv(){
  if(!window.JSZip){ toast("ספריית ה-ZIP לא נטענה."); return; }
  const z=new JSZip(); const d=t=>t?fmtD(t):"";
  z.file("תעודות-משלוח.csv",csvOf(["תאריך","ספק","מספר תעודה","פריט","כמות","יחידה","קטגוריה","הערה"],shared.deliveries.filter(n=>n.source!=="bom").flatMap(n=>(n.lines||[]).map(l=>[n.dateText||d(n.ts),n.supplier,n.noteNo,l.name,l.qty,l.unit,(CATS.find(c=>c.id===l.cat)||{}).label||"",n.note||""]))));
  z.file("ניפוקים.csv",csvOf(["תאריך","למי","שולחנות","סוג","מנפיק","פריט","כמות","חתימה","הערה"],shared.issues.flatMap(s=>(s.lines||[]).map(l=>[d(s.ts),s.who,s.tables,s.typeLabel||"",s.by||"",l.name,l.qty,(s.sigAsset||s.sigUrl||s.sigData)?"כן":"לא",s.note||""]))));
  z.file("תנועות.csv",csvOf(["תאריך","פריט","כמות","כיוון","מי","חתימה","הערה"],shared.moves.map(m=>[d(m.ts),m.item,m.qty,m.dir==="in"?"החזרה":"הוצאה",m.who||"",m.dir==="in"?"":(m.sigAsset||m.sigUrl||m.sigData)?"כן":"לא",m.note||""])));
  z.file("ספירות.csv",csvOf(["תאריך","פריט","נספר","מי ספר","הערה"],shared.counts.map(c=>[d(c.ts),c.item,c.qty,c.who||"",c.note||""])));
  z.file("בטון.csv",csvOf(["תאריך","מספר תעודה","ספק","מ\"ק","מצטבר","סוג","נוצק ב","משאית","הערות"],shared.concrete.map(c=>[c.dateText,c.noteNo,c.supplier,c.m3,c.cum??"",c.mix,c.element,c.truck,c.note])));
  z.file("דיווחי-ביצוע.csv",csvOf(["תאריך","קבלן","שולחנות","סוג","מדווח","הערה"],shared.progress.map(p=>[p.dateText||d(p.ts),p.who,p.tables,p.ttype?typeLabel(p.ttype):"",p.by||"",p.note||""])));
  z.file("מאזן-פאנלים.csv",csvOf(["תאריך","הוזמנו","נדרש","התקבלו","משטחים סגורים","בודדים","מותקנים","מפוזרים","שבורים","יצאו לאתרים אחרים","מי ספר"],shared.panelBal.slice().sort((a,b)=>a.ts-b.ts).map(b=>[b.dateText,b.ordered,b.required,b.received,b.closed,b.singles,b.installed,b.scattered,b.broken,(b.takenOut||[]).map(t=>t.site+" "+t.qty).join(" · "),b.by||""])));
  z.file("פאנלים-שבורים.csv",csvOf(["תאריך","מספר סידורי","מי שבר","הערה"],shared.records.map(r=>[d(r.ts),r.serial,(byId(BLAME,r.blame)||{}).label||r.blame,r.note||""])));
  z.file("יומן-פעולות.csv",csvOf(["תאריך","שעה","מי","סוג","פעולה","תיאור"],shared.logs.slice().sort((a,b)=>a.ts-b.ts).map(l=>[d(l.ts),new Date(l.ts).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"}),l.who||"",LOG_KINDS[l.kind]||l.kind,l.action,l.summary])));
  const blob=await z.generateAsync({type:"blob"});
  if(await saveFile("יומן-אתר-"+new Date().toISOString().slice(0,10)+".zip",blob)) toast("9 טבלאות ב-ZIP.");
}
export function openRestore(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="שחזור מגיבוי"><div class="grab"></div><h2>שחזור מגיבוי</h2>'
    +'<div class="note-card">בוחרים קובץ גיבוי (JSON) שיוצא מהאפליקציה. הרשומות שבקובץ ייכתבו <b>בנוסף</b> לקיימות: רשומה עם אותו מזהה תוחלף, אחרות לא יימחקו. כך מעבירים אתר למרחב חדש.</div>'
    +'<div id="rsBody"><div class="pick">בחר קובץ גיבוי<small>yoman-atar · JSON</small><input type="file" id="rsFile" accept=".json,application/json"></div></div>'
    +'<div class="acts"><button class="save" id="rsGo" hidden type="button">שחזר</button><button class="cancel" type="button">סגור</button></div></div>');
  const q=s=>scrim.querySelector(s); let obj=null;
  q(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#rsFile").onchange=async e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    try{ obj=JSON.parse(await f.text()); }catch(err){ q("#rsBody").innerHTML='<div class="empty">הקובץ לא נקרא.</div>'; return; }
    if(!obj||obj.app!=="yoman-atar"){ q("#rsBody").innerHTML='<div class="empty">זה לא קובץ גיבוי של יומן אתר.</div>'; obj=null; return; }
    const colls=["deliveries","moves","counts","concrete","issues","progress","panelbal","panels","log"];
    q("#rsBody").innerHTML='<div class="imp-sum">'+colls.map(k=>'<span>'+esc(LOG_KINDS[k==="panels"?"panel":k==="log"?"backup":k==="deliveries"?"delivery":k==="moves"?"move":k==="counts"?"count":k]||k)+' <b>'+((obj[k]||[]).length)+'</b></span>').join("")+'</div>'
      +'<div class="legend">מתאריך '+esc(String(obj.exportedAt||"").slice(0,10))+' · אתר: '+esc((obj.site||{}).name||"")+'</div>';
    q("#rsGo").hidden=false;
  };
  q("#rsGo").onclick=async()=>{
    if(!obj) return;
    if(!(await ask("לכתוב את כל הרשומות מהגיבוי?","שחזר","var(--amber)"))) return;
    const b=q("#rsGo"); b.disabled=true;
    const colls={deliveries:"deliveries",moves:"moves",counts:"counts",concrete:"concrete",issues:"issues",progress:"progress",panelbal:"panelbal",panelmoves:"panelmoves",daylog:"daylog",orders:"orders",pos:"pos",eta:"eta",crew:"crew",status:"status",panels:"panels",log:"log"};
    let n=0, fail=0;
    for(const [k,coll] of Object.entries(colls)){
      for(const doc of (obj[k]||[])){ if(!doc||!doc.id) continue; b.textContent="כותב… "+(++n);
        try{ if(shared.DB) await shared.DB.collection(coll).doc(String(doc.id)).set(doc); else { const arr={deliveries:shared.deliveries,moves:shared.moves,counts:shared.counts,concrete:shared.concrete,issues:shared.issues,progress:shared.progress,panelbal:shared.panelBal,panelmoves:shared.panelMoves,daylog:shared.daylog,orders:shared.orders,panels:shared.records,log:shared.logs}[k]; const i=arr.findIndex(x=>x.id===doc.id); if(i>=0) arr[i]=doc; else arr.push(doc); } }catch(e){ fail++; } }
    }
    try{ if(obj.bom&&Array.isArray(obj.bom.lines)&&obj.bom.lines.length){ if(Array.isArray(obj.bom.types)&&obj.bom.types.length) shared.kitTypes=obj.bom.types; await saveKit(obj.bom.lines,obj.bom.source,"שוחזר BOM מגיבוי"); } }catch(e){ fail++; }
    try{ if(obj.cba&&Array.isArray(obj.cba.packages)&&obj.cba.packages.length&&ROLE==="owner") await saveCba({...obj.cba,source:obj.cba.source||"מגיבוי"}); }catch(e){ fail++; }
    try{ if(obj.boq&&Array.isArray(obj.boq.lines)&&obj.boq.lines.length) await saveBoq(obj.boq.lines,obj.boq.source||"מגיבוי"); if(obj.suppliers&&typeof obj.suppliers==="object"){ shared.SUPPLIERS=obj.suppliers; if(shared.DB) await shared.DB.doc("settings/suppliers").set({map:shared.SUPPLIERS,ts:Date.now()}); else ls.set("suppliers",JSON.stringify(shared.SUPPLIERS)); } }catch(e){ fail++; }
    try{ if(obj.prices){ if(shared.DB) await shared.DB.doc("settings/prices").set({...obj.prices,ts:Date.now()}); else { shared.prices=obj.prices; ls.set("prices",JSON.stringify(shared.prices)); } } }catch(e){ fail++; }
    try{ if(obj.site){ await saveSite({name:obj.site.name,company:obj.site.company,panelsPerTable:obj.site.panelsPerTable,bomImported:!!obj.site.bomImported}); } }catch(e){ fail++; }
    if(!shared.DB){ ["deliveries","moves","counts","concrete","issues","progress"].forEach(k=>ls.set(k,JSON.stringify({deliveries:shared.deliveries,moves:shared.moves,counts:shared.counts,concrete:shared.concrete,issues:shared.issues,progress:shared.progress}[k]))); ls.set("panelbal",JSON.stringify(shared.panelBal)); ls.set("panels",JSON.stringify(shared.records)); ls.set("log",JSON.stringify(shared.logs)); }
    shared.demoStock=false; shared.demoMode=false; ls.set("demoDoneS","1"); ls.set("demoDone","1");
    logAct("backup","add","שחזור מגיבוי "+String(obj.exportedAt||"").slice(0,10)+" · "+fmtN(n)+" רשומות"+(fail?" · "+fail+" נכשלו":""),"");
    scrim.remove(); render(); renderStock(); renderConcrete(); toast("שוחזרו "+fmtN(n)+" רשומות"+(fail?", "+fail+" נכשלו":"")+".");
  };
}
/* ---- ייבוא BOM מאקסל ---- */
export function loadScript(src){ return new Promise((res,rej)=>{ if(document.querySelector('script[src="'+src+'"]')) return res(); const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("load")); document.head.appendChild(s); }); }
export function parseSchletterBom(rows){
  const hi=rows.findIndex(r=>Array.isArray(r)&&r.some(c=>/item number/i.test(String(c)))&&r.some(c=>/total amount|calculated amount/i.test(String(c))));
  if(hi<0) return null;
  const H=rows[hi].map(c=>String(c||"").trim().toLowerCase());
  const col=re=>H.findIndex(h=>re.test(h));
  const cItem=col(/^item$/), cNo=col(/item number/), cLen=col(/length/), cCalc=col(/calculated/), cSpare=col(/spare/), cTot=col(/total/), cArr=col(/הגיע|arrived|received|delivered/);
  const lines=[]; let racksAt=-1;
  for(let i=hi+1;i<rows.length;i++){ const r=rows[i]; if(!r||!r.length) continue;
    if(r.some(c=>/number of racks|racks/i.test(String(c))&&/project|name/i.test(r.join(" ")))){ racksAt=i; break; }
    const name=String(r[cItem]||"").trim(); const no=String(r[cNo]||"").trim(); if(!name||!no) continue;
    const tot=Number(r[cTot]), calc=Number(r[cCalc]), spare=Number(r[cSpare]), len=Number(r[cLen]), arrived=cArr>=0?Number(r[cArr]):NaN;
    lines.push({name,no,len:isFinite(len)?len:0,calc:isFinite(calc)?calc:0,spare:isFinite(spare)?spare:0,total:isFinite(tot)?tot:(isFinite(calc)?calc:0),arrived:isFinite(arrived)?arrived:null});
  }
  const types=[];
  if(racksAt>=0) for(let i=racksAt+1;i<rows.length;i++){ const r=rows[i]; if(!r) continue; const cells=r.map(c=>String(c??"").trim()).filter(Boolean); if(cells.length<2) continue;
    const nm=cells[0], cntRaw=cells[1]; const nums=(cntRaw.match(/\d+/g)||[]).map(Number); if(!nums.length) continue; const cnt=nums.reduce((a,b)=>a+b,0);
    const m=nm.match(/-(\d+)_(?:DUO|UNO|TRIO)_(EX|IN)\b/i)||nm.match(/(\d+)\D{0,6}(EX|IN)\s*$/i);
    const n=m?m[1]:String(types.length+1), side=m?m[2].toUpperCase():"";
    types.push({id:(side==="IN"?"in":side==="EX"?"ex":"t")+n,label:"שולחן "+n+(side==="IN"?" פנימי (IN)":side==="EX"?" חיצוני (EX)":""),count:cnt,src:nm}); }
  // קוד קצר: הקטע האמצעי של מספר הפריט (943001-289 → 289); כפילויות מקבלות אורך
  const seen=new Map();
  lines.forEach(l=>{ const parts=l.no.split("-"); let code=(parts[1]||parts[0]||"").replace(/\D/g,"")||l.no; if(seen.has(code)) code=code+"-"+(l.len||seen.get(code)+1); seen.set(code,(seen.get(code)||0)+1); l.code=code; });
  return {lines,types};
}
export async function hebrewNames(lines){ // תרגום קצר של שמות הפריטים, ודגל "קיט לקבלן"
  const fallback=()=>lines.map(l=>({no:l.no,heb:l.name+(l.len?" "+l.len+"mm":""),kit:/bolt|nut|washer|clamp|connector|screw|plate|adapter/i.test(l.name)}));
  if(!shared.SAMPLE) return fallback();
  try{
    const out=await shared.SAMPLE.json("רשימת פריטים מ-BOM של קונסטרוקציה סולארית (Schletter). לכל פריט החזר שם עברי קצר ומובן למחסנאי, כמו: 'בורג M12x30', 'אום M12', 'שייבה M12', 'שייבה מרובעת', 'מחבר פרלין-קורה A4', 'קלאמפ אמצעי', 'בורג קודח 5.5x25', 'עמוד יסוד SRF6 אורך 2300', 'קורה FS Girder אורך 6322', 'פרלין LC90 אורך 5120'. "
      +'החזר רק JSON: {"items":[{"no":"<item number בדיוק כפי שניתן>","heb":"<שם עברי קצר>","kit":<true אם זה חומר קטן שמנפיקים לקבלן לפי שולחן (ברגים, אומים, שייבות, מחברים, קלאמפים, אדפטרים, ברגים קודחים), false לאלמנטים גדולים (עמודים, קורות, פרלינים, הארכות)>}]}. '
      +"אל תשמיט פריטים ואל תשנה את no.\n"+JSON.stringify(lines.map(l=>({no:l.no,name:l.name,len:l.len||undefined}))),{modelTier:"quick"});
    const items=out&&Array.isArray(out.items)?out.items:[]; const byNo=new Map(items.map(x=>[String(x.no),x]));
    return lines.map(l=>{ const x=byNo.get(l.no); return x&&x.heb?{no:l.no,heb:String(x.heb).trim(),kit:x.kit!==false}:fallback().find(f=>f.no===l.no); });
  }catch(e){ return fallback(); }
}
export function openBomImport(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ייבוא BOM"><div class="grab"></div><h2>ייבוא BOM מאקסל</h2>'
    +'<div class="note-card">בוחרים את קובץ ה-BOM של היצרן (xlsx או csv). קובץ של שלטר (Customs bill of material) נקרא ישירות: פריטים, כמויות כוללות, ספייר וסוגי השולחנות. פורמט אחר נקרא בעזרת AI. בסוף <b>אתה מאשר או מתקן</b> בעורך הכמויות.</div>'
    +'<div class="legend">סוגי השולחנות היום: '+shared.kitTypes.map(t=>esc(t.label)+" × "+fmtN(Number(t.count)||0)).join(" · ")+'.</div>'
    +'<div id="bomBody"><div class="pick">בחר קובץ BOM<small>xlsx / xls / csv</small><input type="file" id="bomFile" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></div></div>'
    +'<div class="acts"><button class="save" id="bomGo" hidden type="button">המשך לעורך</button><button class="cancel" type="button">סגור</button></div></div>');
  const q=s=>scrim.querySelector(s); let out=null, stockOn=true, typesOn=false;
  q(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  const prog=(pct,t)=>{ q("#bomBody").innerHTML='<div class="prog"><i style="width:'+pct+'%"></i></div><div class="prog-t"><span>'+esc(t)+'</span></div>'; };
  q("#bomFile").onchange=async e=>{
    const f=e.target.files&&e.target.files[0]; if(!f) return;
    prog(15,"קורא את הקובץ…");
    let rows=[], text="";
    try{
      if(/\.csv$/i.test(f.name)){ text=await f.text(); rows=text.split(/\r?\n/).map(l=>l.split(",").map(c=>c.replace(/^"|"$/g,""))); }
      else { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
        const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});
        for(const n of wb.SheetNames.slice(0,4)){ const rr=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,blankrows:false}); rows=rows.concat(rr); }
        text=wb.SheetNames.slice(0,3).map(n=>"### "+n+"\n"+XLSX.utils.sheet_to_csv(wb.Sheets[n],{blankrows:false})).join("\n\n"); }
    }catch(err){ q("#bomBody").innerHTML='<div class="empty">לא הצלחתי לקרוא את הקובץ.</div>'; return; }
    const sch=parseSchletterBom(rows);
    let lines=[], source="", types=[];
    if(sch&&sch.lines.length){
      prog(50,"מזהה "+sch.lines.length+" פריטים… מתרגם שמות");
      const nm=await hebrewNames(sch.lines);
      source="BOM שלטר "+(f.name.match(/(\d{4})(\d{2})(\d{2})/)?f.name.match(/(\d{4})(\d{2})(\d{2})/).slice(1).reverse().join("."):"")+" ("+f.name.replace(/\.xlsx?$/i,"")+")";
      types=sch.types;
      const totalTables=(types.length?types:shared.kitTypes).reduce((s,t)=>s+(Number(t.count)||0),0)||1;
      lines=sch.lines.map((l,i)=>{ const h=nm[i]||{heb:l.name,kit:false}; const existing=shared.kit.find(k=>k.code===l.code);
        const useTypes=(typesOn||!shared.kitTypes.length)&&types.length?types:shared.kitTypes;
        const per=existing?Object.fromEntries(useTypes.map(t=>[t.id,perOf(existing,t.id)])):Object.fromEntries(useTypes.map(t=>[t.id,Math.round(l.calc/totalTables*10)/10]));
        return {code:l.code,no:l.no,name:existing?existing.name:(h.heb+" (שלטר מק״ט "+l.code+")"),def:existing?existing.def!==false:!!h.kit,per,total:l.total,calc:l.calc,spare:l.spare,arrived:l.arrived,approx:!existing,carton:existing?existing.carton:0}; });
    } else {
      if(!shared.SAMPLE){ q("#bomBody").innerHTML='<div class="empty">הפורמט לא זוהה, וקריאה אוטומטית לא זמינה בתצוגה הזאת.</div>'; return; }
      text=text.split("\n").filter(l=>l.replace(/[,\s]/g,"").length).slice(0,220).map(l=>l.slice(0,400)).join("\n");
      prog(55,"מזהה פריטים וכמויות לשולחן…");
      try{
        const ai=await shared.SAMPLE.json("להלן BOM (רשימת חומרים) של מערכת קונסטרוקציה סולארית, כ-CSV. באתר יש סוגי שולחנות: "
          +JSON.stringify(shared.kitTypes.map(t=>({id:t.id,label:t.label,count:Number(t.count)||0})))+". "
          +'החזר רק JSON: {"source":"<שם היצרן/המסמך והתאריך אם מופיעים>","lines":[{"code":"<מק״ט קצר, 3–6 תווים אם יש>","name":"<שם פריט קצר בעברית + המק״ט בסוגריים>",'
          +'"per":{"<typeId>":<כמות לשולחן אחד מהסוג הזה, מספר>},"total":<כמות כוללת לאתר אם מופיעה, מספר, אחרת null>,"kit":<true לחומר קטן שמנפיקים לקבלן לכל שולחן, false לאלמנטים גדולים>}]}. '
          +"אם יש רק כמות כוללת, חלק אותה למספר השולחנות הכולל וכתוב אותו ערך לכל סוג. אל תמציא פריטים. עד 40 שורות.\n\n"+text,{modelTier:"complex"});
        source=ai&&ai.source||"BOM מיובא";
        lines=(ai&&Array.isArray(ai.lines)?ai.lines:[]).filter(l=>l&&l.name).map((l,i)=>({code:String(l.code||("b"+i)).trim(),name:String(l.name).trim(),def:l.kit!==false,
          per:Object.fromEntries(shared.kitTypes.map(t=>[t.id,Math.max(0,Number((l.per||{})[t.id])||0)])),total:Number(l.total)||0,approx:true}));
      }catch(err){ q("#bomBody").innerHTML='<div class="empty">'+(err&&err.code==="not_granted"?"קריאה אוטומטית לא זמינה.":"הקריאה נכשלה. נסה שוב.")+'</div>'; return; }
    }
    if(!lines.length){ q("#bomBody").innerHTML='<div class="empty">לא נמצאו פריטים עם כמויות.</div>'; return; }
    out={lines,source,types};
    const sameTypes=types.length&&JSON.stringify(types.map(t=>[t.id,t.count]))===JSON.stringify(shared.kitTypes.map(t=>[t.id,Number(t.count)||0]));
    typesOn=types.length>0&&!sameTypes;
    const hasBomNote=shared.deliveries.some(n=>n.source==="bom");
    const newKit=lines.filter(l=>l.def&&l.approx).length;
    q("#bomBody").innerHTML='<div class="imp-sum"><span>פריטים <b>'+lines.length+'</b></span><span>לקיט הניפוק <b>'+lines.filter(l=>l.def).length+'</b></span>'+(newKit?'<span>חדשים בקיט <b>'+newKit+'</b></span>':'')+'<span>עם כמות כוללת <b>'+lines.filter(l=>l.total>0).length+'</b></span></div>'
      +(types.length?'<div class="legend">סוגי שולחנות בקובץ: '+types.map(t=>esc(t.label)+" × "+fmtN(t.count)).join(" · ")+(sameTypes?' · <b>תואם להגדרות</b>':'')+'</div>':'')
      +'<div class="dlines">'+lines.slice(0,45).map(l=>'<div><span>'+esc(shortName(l.name))+(l.def?'':' <small style="color:var(--ink3)">(לא בקיט)</small>')+(l.def&&l.approx?' <small style="color:var(--amber)">(כמות לשולחן משוערת)</small>':'')+'</span><b>'+(l.total?fmtN(l.total):"—")+'</b></div>').join("")+'</div>'
      +'<div class="hint" style="margin:6px 0 12px">המספר = כמות כוללת לאתר (כולל ספייר). כמות לשולחן לפריט חדש = סה״כ חלקי מספר השולחנות; לפריטים שכבר בקיט נשמרות הכמויות הקיימות.</div>'
      +(types.length&&!sameTypes?'<button type="button" class="chip2" id="bomTypes" aria-pressed="'+typesOn+'" style="width:100%;margin-bottom:8px">לעדכן את סוגי השולחנות והכמויות מהקובץ</button>':'')
      +(lines.some(l=>l.total>0)?'<button type="button" class="chip2" id="bomStock" aria-pressed="true" style="width:100%">'+(hasBomNote?'להחליף את תעודת «מלאי פתיחה» הקיימת בכמויות מהקובץ':'ליצור תעודת «מלאי פתיחה» מהכמויות הכוללות')+'</button>':'');
    const bs=q("#bomStock"); if(bs) bs.onclick=()=>{ stockOn=!stockOn; bs.setAttribute("aria-pressed",String(stockOn)); };
    const bt=q("#bomTypes"); if(bt) bt.onclick=()=>{ typesOn=!typesOn; bt.setAttribute("aria-pressed",String(typesOn)); };
    q("#bomGo").hidden=false;
  };
  q("#bomGo").onclick=async()=>{
    if(!out) return;
    let lines=out.lines;
    try{
      if(typesOn&&out.types.length){ const newTypes=out.types.map(t=>({id:t.id,label:t.label,count:t.count,customized:true}));
        lines=lines.map(l=>{ const per={}; newTypes.forEach(t=>{ per[t.id]=l.per[t.id]??(Object.values(l.per)[0]||0); }); return {...l,per}; });
        shared.kitTypes=newTypes; }
      if(stockOn&&lines.some(l=>l.total>0)){
        const ts=Date.now(); const old=shared.deliveries.find(n=>n.source==="bom");
        const rec={id:old?old.id:"bom_"+ts,supplier:(out.source||"BOM").slice(0,60),noteNo:"BOM",dateText:old?old.dateText:fmtD(ts),ts:old?old.ts:ts,source:"bom",note:"מלאי פתיחה מה-BOM: "+(out.source||""),photoAsset:"",photoUrl:"",
          lines:lines.filter(l=>l.total>0).map(l=>({name:l.name,qty:l.total,unit:"יח'",cat:"construction"}))};
        if(shared.DB) await shared.DB.collection("deliveries").doc(rec.id).set(rec); else { shared.deliveries=shared.deliveries.filter(n=>n.id!==rec.id); shared.deliveries.push(rec); ls.set("deliveries",JSON.stringify(shared.deliveries)); }
        logAct("delivery",old?"edit":"add","מלאי פתיחה מ-BOM · "+rec.lines.length+" פריטים · "+(out.source||""),rec.id);
      }
      await saveSite({...SITE,bomImported:true});
    }catch(e){ toast("חלק מהשמירה נכשל."); }
    // הקיט: פריטי קיט מהקובץ + פריטים קיימים שלא בקובץ
    const kitLines=lines.filter(l=>l.def).map(l=>({code:l.code,no:l.no||"",name:l.name,per:l.per,def:true,carton:l.carton||0}));
    shared.kit.filter(k=>!kitLines.some(l=>l.code===k.code)).forEach(k=>kitLines.push({...k}));
    scrim.remove(); openKitEditor({lines:kitLines,source:out.source||"BOM מיובא"}); toast("בדוק את הכמויות לשולחן ושמור.");
  };
}
/* ---- לשוניות ---- */
export function showTab(which){
  const tabs={over:["#tabOver","#viewOver"],stock:["#tabStock","#viewStock"],concrete:["#tabConcrete","#viewConcrete"],panels:["#tabPanels","#viewPanels"],day:["#tabDay","#viewDay"],orders:["#tabOrders","#viewOrders"]};
  if(which==="con") which="over";
  if(!tabs[which]) which="over";
  Object.entries(tabs).forEach(([k,[t,v]])=>{ $(t).setAttribute("aria-selected",String(k===which)); $(v).hidden=k!==which; });
  shared.fabTab=which; const fl=$("#fabLabel"); if(fl) fl.textContent=FAB_LABEL;
  ls.set("tab",which);
  window.scrollTo(0,0);
}
export function __init(){
/* ================= הגדרות אתר, גיבוי, ייבוא BOM ================= */
KIT_SOURCE_DEFAULT = "BOM שלטר 21.4.2026 ומדריך התקנה FS Duo";
APP_VERSION = "55";
SHOW_PRICES = false;
   // בלי מחירים באפליקציה: שום ₪ לא מוצג (מחירים שנשמרו נשארים מוסתרים)
SITE = {name:"אתר הקמה עין תמר",company:"BELECTRIC",panelsPerTable:81,custom:false};
$("#btnSettings").onclick=openSettings;
csvOf = (head,rows)=>"﻿"+[head.join(",")].concat(rows.map(r=>r.map(c=>'"'+String(c??"").replace(/"/g,'""')+'"').join(","))).join("\r\n");
$("#tabOver").onclick=()=>showTab("over");
$("#tabStock").onclick=()=>showTab("stock");
$("#tabConcrete").onclick=()=>showTab("concrete");
$("#tabPanels").onclick=()=>showTab("panels");
$("#tabDay").onclick=()=>showTab("day");
$("#tabOrders").onclick=()=>showTab("orders");
}
