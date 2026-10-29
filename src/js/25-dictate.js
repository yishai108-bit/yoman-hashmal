// דיווח בדיבור / צילום (גרסה 9): כפתור מיקרופון צף. מספרים מה היה היום (מקלדת, המיקרופון של המקלדת, או הקלטה בדף),
// מצלמים אם צריך, ו-Claude מפרק את זה לעובדים ושעות, דיווחי ביצוע לפי סעיף, חריגים, ציוד וטקסט לדוח היומי. כל פריט מאושר לפני השמירה.
// בלי AI (תצוגה מקומית, או כשהפענוח נכשל) הטקסט נשמר כ«דוח עבודה יומי» של היום, והתמונות מצורפות לדוח.
import { actorName, closer, esc, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { isoOf, isoText, renderDay, timeDiff } from "./11-daylog.js";
import { saveStatus } from "./16-status.js";
import { BLK_KINDS, photoBlob, renderWorkDay, saveBlocker } from "./21-work.js";
import { WEATHER, dayInfo, saveDayInfo } from "./23-daily-report.js";

export function dictDate(){ return shared.dayISO||isoOf(Date.now()); }

/* ההנחיה ל-Claude: מבנה ה-JSON, כללי «לא להמציא», וסעיפי הפרויקט כדי שהוא יבחר קוד סעיף ולא שם חופשי */
export function dictPrompt(){
  const A=(shared.STATUS||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const secs=A.map(a=>(a.code?a.code+" ":"")+a.name+(a.unit?" ["+a.unit+"]":"")).join("\n");
  const names=[...new Set([...(shared.CREW||[]).filter(c=>c.active!==false).map(c=>c.name),...(shared.daylog||[]).map(w=>w.name)].filter(Boolean))].slice(0,60);
  const cons=[...new Set([...(shared.CREW||[]).map(c=>c.contractor),...(shared.daylog||[]).map(w=>w.contractor)].filter(Boolean))].slice(0,20);
  return "אתה עוזר של מנהל עבודה באתר חשמל סולארי בישראל. הוא הכתיב (או צילם) דיווח יומי חופשי בעברית מדוברת, ואתה מפרק אותו לרשומות של היומן. "
    +"החזר רק JSON לפי המבנה הזה בדיוק (שדה שלא נאמר = null, רשימה ריקה אם אין): "
    +'{"workers":[{"name":"<שם העובד>","contractor":"<קבלן משנה / חברה או null>","job":"<תפקיד או null>","tin":"<שעת כניסה HH:MM או null>","tout":"<שעת יציאה HH:MM או null>","hours":<שעות בפועל, מספר, או null>,"tasks":"<מה עשה או null>"}],'
    +'"work":[{"code":"<קוד הסעיף מהרשימה למטה שמתאים הכי טוב, או null אם אין כזה>","name":"<מה בוצע, במילים>","qty":<כמות שבוצעה, מספר, או null>,"unit":"<יחידה או null>","area":"<אזור / שדה / סטרינג או null>","crew":"<צוות / קבלן משנה או null>","workers":<כמה עובדים עבדו על זה, מספר, או null>,"note":"<הערה או null>"}],'
    +'"blockers":[{"kind":"<אחד מ: extra, delay, material, plan, equip, fault, decision, safety, other>","text":"<מה קרה, במילים של הדובר>","area":"<אזור או null>","workers":<כמה עובדים עמדו או עבדו על זה, או null>,"hours":<כמה שעות, או null>}],'
    +'"equipment":[{"type":"<סוג הכלי או הציוד>","model":"<דגם / מספר או null>","hours":<שעות עבודה, או null>}],'
    +'"workText":"<סיכום העבודה שבוצעה היום, משפט עד ארבעה, בלשון דוח, או null>","issuesText":"<ליקויים / בעיות / בטיחות שנאמרו, או null>","weather":"<sun | partly | cloudy | rain | null>"}. '
    +"כללים: אל תמציא ואל תשלים מספרים שלא נאמרו. «משבע עד ארבע וחצי» = tin 07:00, tout 16:30. עובד נכנס ל-workers רק אם נאמר שמו; «היו 6 עובדים על ההארקה» הולך לשדה workers של פריט ה-work, לא לרשימת העובדים. "
    +"kind: extra = עבודה נוספת או שינוי לפי הוראה; delay = המתנה או עיכוב שלא באחריותנו; material = חוסר חומר; plan = תוכנית חסרה או סותרת; equip = אין כלי או מפעיל; fault = תקלה; decision = ממתין לאישור; safety = בטיחות; other = אחר. "
    +"אם יש תמונה של טופס דוח יומי ממולא בכתב יד, קרא ממנה את העובדים, השעות, הציוד והטקסטים כאילו הוכתבו. תמונה של העבודה עצמה: תאר בקצרה ב-workText רק מה שרואים בבירור.\n"
    +"סעיפי העבודה של הפרויקט (קוד שם [יחידה]):\n"+(secs||"(אין סעיפים עדיין, לכן code תמיד null)")
    +(names.length?"\nשמות עובדים מוכרים: "+names.join(", "):"")+(cons.length?"\nקבלני משנה מוכרים: "+cons.join(", "):"");
}

/* איזה סעיף התכוונו: קוד מדויק, שם זהה, שם מוכל, ואז חפיפת מילים (לפחות חצי מהמילים) */
export function matchActivity(ref){
  const A=shared.STATUS||[]; if(!ref) return null;
  const norm=s=>String(s||"").replace(/\s+/g,"").toLowerCase();
  const code=norm(ref.code); if(code){ const a=A.find(x=>x.code&&norm(x.code)===code); if(a) return a; }
  const nm=String(ref.name||"").trim().toLowerCase(); if(!nm) return null;
  let a=A.find(x=>x.name&&x.name.trim().toLowerCase()===nm); if(a) return a;
  a=A.find(x=>x.name&&x.name.length>3&&(nm.includes(x.name.trim().toLowerCase())||x.name.trim().toLowerCase().includes(nm))); if(a) return a;
  const split=s=>s.split(/[^\p{L}\p{N}]+/u).filter(t=>t.length>1);
  const toks=split(nm); if(!toks.length) return null;
  let best=null, bs=0; A.forEach(x=>{ const xt=new Set(split(String(x.name||"").toLowerCase())); const s=toks.filter(t=>xt.has(t)).length/toks.length; if(s>bs){ bs=s; best=x; } });
  return bs>=0.5?best:null;
}

/* תשובת ה-AI → רשימת פריטים לאישור. כל פריט: kind, on (מסומן), label, detail, והשדות לשמירה */
export function dictItems(out){
  out=out&&typeof out==="object"?out:{}; const items=[];
  const s=v=>v==null?"":String(v).trim();
  const n=v=>{ const x=Number(String(v==null?"":v).replace(",",".")); return isFinite(x)&&x>0?x:0; };
  const tm=v=>{ const m=s(v).match(/^(\d{1,2})[:.](\d{2})/); return m?String(m[1]).padStart(2,"0")+":"+m[2]:""; };
  const arr=v=>Array.isArray(v)?v.filter(x=>x&&typeof x==="object"):[];
  arr(out.workers).forEach(w=>{ const name=s(w.name); if(!name) return; const tin=tm(w.tin), tout=tm(w.tout), hours=n(w.hours)||timeDiff(tin,tout)||0;
    items.push({kind:"worker",on:true,name,contractor:s(w.contractor),job:s(w.job),tin,tout,hours,tasks:s(w.tasks),
      label:"עובד: "+name+(s(w.contractor)?" · "+s(w.contractor):""),
      detail:[(tin||tout)?(tin||"—")+"–"+(tout||"—"):"",hours?fmtN(hours)+" שעות":"יום מלא",s(w.job),s(w.tasks)].filter(Boolean).join(" · ")}); });
  arr(out.work).forEach(r=>{ const name=s(r.name), a=matchActivity({code:r.code,name}); if(!name&&!a) return; const qty=n(r.qty), wk=Math.round(n(r.workers));
    items.push({kind:"work",on:true,activity:a,name,qty,unit:s(r.unit),area:s(r.area),crew:s(r.crew),workers:wk,note:s(r.note),
      label:a?"דיווח ביצוע: "+(a.code?a.code+" ":"")+a.name:"לא זוהה סעיף: "+name,
      detail:[qty?fmtN(qty)+" "+((a&&a.unit)||s(r.unit)):"",s(r.area),s(r.crew),wk?wk+" עובדים":"",a&&name&&name!==a.name?name:"",s(r.note),a?"":"יישמר בטקסט של היום"].filter(Boolean).join(" · ")}); });
  arr(out.blockers).forEach(b=>{ const text=s(b.text); if(!text) return; const kind=BLK_KINDS[s(b.kind)]?s(b.kind):"other", wk=Math.round(n(b.workers)), h=n(b.hours);
    items.push({kind:"blocker",on:true,bkind:kind,text,area:s(b.area),workers:wk,hours:h,
      label:BLK_KINDS[kind]+": "+text.slice(0,60)+(text.length>60?"…":""),detail:[s(b.area),wk?wk+" עובדים":"",h?fmtN(h)+" שעות":""].filter(Boolean).join(" · ")}); });
  arr(out.equipment).forEach(e=>{ const type=s(e.type); if(!type) return; const h=n(e.hours);
    items.push({kind:"equip",on:true,type,model:s(e.model),hours:h,label:"ציוד: "+type,detail:[h?fmtN(h)+" שעות":"",s(e.model)].filter(Boolean).join(" · ")}); });
  if(s(out.workText)) items.push({kind:"text",on:true,field:"work",text:s(out.workText),label:"דוח עבודה יומי",detail:s(out.workText)});
  if(s(out.issuesText)) items.push({kind:"text",on:true,field:"issues",text:s(out.issuesText),label:"ליקויים / בעיות / בטיחות",detail:s(out.issuesText)});
  if(WEATHER[s(out.weather)]) items.push({kind:"weather",on:true,weather:s(out.weather),label:"מזג אוויר: "+WEATHER[s(out.weather)],detail:""});
  return items;
}

/* תמונה מהשטח לדוח היומי: למאגר הקבצים, או מוקטנת כ-data URL כשאין מאגר */
export async function photoRecord(file){
  const bl=await photoBlob(file,1600,0.8);
  if(shared.ASSETS&&shared.DB){ const a=await shared.ASSETS.upload(bl); return {asset:a.id,url:a.url,ts:Date.now()}; }
  const th=await photoBlob(bl,640,0.6);
  return {data:await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(th); }),ts:Date.now()};
}

/* שמירת הפריטים המסומנים ברשומות הרגילות של היומן. ctx = {iso, photos:[File]} */
export async function applyDictation(items,ctx){
  const iso=ctx.iso||dictDate(), by=actorName(), R={workers:0,work:0,blockers:0,text:0,photos:0}, fail=[];
  const info={...dayInfo(iso)}; let infoDirty=false; const lines=[];
  for(const it of items.filter(x=>x.on)){
    if(it.kind==="worker"){
      const old=(shared.daylog||[]).find(w=>w.date===iso&&(w.name||"").trim()===it.name);   // אותו עובד כבר נרשם היום: מעדכנים במקום לשכפל
      const doc={...(old||{id:"dy"+Date.now()+Math.random().toString(36).slice(2,5),date:iso,ts:new Date(iso+"T12:00:00").getTime(),machine:"",area:"",note:"",arrive:"ontime",leave:"ontime",lateMin:0,earlyMin:0,contractor:"",job:"",hours:0,tasks:"",tin:"",tout:""}),name:it.name,by};
      if(it.contractor) doc.contractor=it.contractor; if(it.job) doc.job=it.job; if(it.tin) doc.tin=it.tin; if(it.tout) doc.tout=it.tout; if(it.hours) doc.hours=it.hours;
      if(it.tasks) doc.tasks=old&&old.tasks&&!old.tasks.includes(it.tasks)?old.tasks+"\n"+it.tasks:it.tasks;
      try{ if(shared.DB) await shared.DB.doc("daylog/"+doc.id).set(doc); else { shared.daylog=(shared.daylog||[]).filter(x=>x.id!==doc.id).concat(doc); ls.set("daylog",JSON.stringify(shared.daylog)); }
        R.workers++; logAct("daylog",old?"edit":"add",(old?"עודכן":"נרשם")+" ליום "+isoText(iso)+" (בדיבור): "+doc.name+(doc.tin||doc.tout?" · "+(doc.tin||"—")+"–"+(doc.tout||"—"):""),doc.id); }
      catch(e){ fail.push(it.label); }
    } else if(it.kind==="work"){
      if(!it.activity){ lines.push(it.name+(it.qty?": "+fmtN(it.qty)+(it.unit?" "+it.unit:""):"")+(it.area?" · "+it.area:"")); continue; }
      const cur=(shared.STATUS||[]).find(x=>x.id===it.activity.id)||it.activity;
      const rec={id:"wr"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),date:iso,actual:it.qty,area:it.area,crew:it.crew,note:[it.name&&it.name!==cur.name?it.name:"",it.note].filter(Boolean).join(" · "),by,ts:Date.now()};
      if(it.workers>0) rec.workers=it.workers;
      if(!rec.actual&&!rec.note) rec.note="דווח בדיבור";
      const next={...cur,daily:(cur.daily||[]).concat(rec).sort((x,y)=>x.date<y.date?-1:1),updated:Date.now()};
      if(await saveStatus(next)){ R.work++; if(shared.DB) shared.STATUS=(shared.STATUS||[]).map(x=>x.id===next.id?next:x);   // כדי שפריט שני לאותו סעיף יתווסף ולא ידרוס
        logAct("progress","add","דיווח ביצוע (בדיבור): "+(cur.code?cur.code+" ":"")+cur.name+(it.qty?" "+fmtN(it.qty)+(cur.unit?" "+cur.unit:""):"")+" ב-"+isoText(iso)+(rec.area?" · "+rec.area:""),cur.id); }
      else fail.push(it.label);
    } else if(it.kind==="blocker"){
      const doc={id:"bk"+Date.now().toString(36)+Math.random().toString(36).slice(2,4),ts:Date.now(),date:iso,text:it.text,kind:it.bkind,area:it.area,status:"open",by,updated:Date.now()};
      if(it.bkind==="extra"||it.bkind==="delay"){ if(it.workers) doc.workers=it.workers; if(it.hours) doc.hours=it.hours; }
      if(await saveBlocker(doc)){ R.blockers++; logAct("blocker","add",(it.bkind==="extra"?"עבודה נוספת":it.bkind==="delay"?"עיכוב":"חריג")+" חדש (בדיבור): "+it.text.slice(0,80)+(doc.area?" · "+doc.area:""),doc.id); }
      else fail.push(it.label);
    } else if(it.kind==="equip"){ info.equipment=(info.equipment||[]).concat({type:it.type,model:it.model,hours:it.hours||"",note:""}); infoDirty=true; }
    else if(it.kind==="text"){ const f=it.field; if(!(info[f]||"").includes(it.text)){ info[f]=[info[f],it.text].filter(Boolean).join("\n"); infoDirty=true; R.text++; } }
    else if(it.kind==="weather"){ if(!info.weather){ info.weather=it.weather; infoDirty=true; } }
  }
  if(lines.length){ info.work=[info.work,...lines].filter(Boolean).join("\n"); infoDirty=true; R.text++; }
  for(const f of ctx.photos||[]){ try{ info.photos=(info.photos||[]).concat(await photoRecord(f)); infoDirty=true; R.photos++; }catch(e){ fail.push("תמונה"); } }
  if(infoDirty&&!(await saveDayInfo(info))) fail.push("פרטי היום");
  renderDay(); renderWorkDay();
  return {R,fail};
}
export function dictSummary(R,fail){
  const p=[R.workers?R.workers+" עובדים":"",R.work?R.work+" דיווחי ביצוע":"",R.blockers?R.blockers+" חריגים":"",R.text?"טקסט לדוח היומי":"",R.photos?R.photos+" תמונות":""].filter(Boolean);
  return (p.length?"נשמר: "+p.join(" · "):"לא נשמר כלום")+(fail.length?" · לא נשמר: "+fail.join(", "):"");
}

/* החלון: טקסט (מקלדת / מיקרופון של המקלדת / הקלטה בדף), תמונות, פענוח, אישור ושמירה */
export function openDictation(){
  const iso=dictDate(), SR=window.SpeechRecognition||window.webkitSpeechRecognition, ai=!!shared.SAMPLE, files=[];
  const scrim=popup('<div class="sheet dict" role="dialog" aria-modal="true" aria-label="דיווח בדיבור"><div class="grab"></div><h2>דיווח בדיבור · '+esc(isoText(iso))+'</h2>'
    +'<div id="dcIn"><div class="hint">ספר מה היה היום: מי עבד ומאיזו שעה, מה בוצע וכמה, מה תקע. '+(SR?'לחץ «הקלטה» ודבר, או ':'')+'לחץ על המיקרופון במקלדת ודבר, או הקלד.'
      +(ai?' היומן יפרק את זה לעובדים, דיווחי ביצוע וחריגים, ותאשר לפני השמירה.':' בתצוגה הזאת אין פענוח אוטומטי: הטקסט נשמר כדוח העבודה של היום.')+'</div>'
    +'<textarea id="dcText" placeholder="למשל: היום עבדו יוסי ומוחמד משבע עד ארבע וחצי. סיימנו הארקה בשדה 2, 300 מטר. חיכינו למודד שעתיים בחלקה 3."></textarea>'
    +'<div class="row2" style="margin-bottom:8px">'+(SR?'<button class="ghost rec" id="dcRec" type="button" aria-pressed="false"><i class="ic ic-mic"></i>הקלטה</button>':'')
      +'<label class="ghost pbtn" style="flex:1;justify-content:center"><input type="file" id="dcCam" accept="image/*" multiple hidden><i class="ic ic-cam"></i>צלם / תמונה</label></div>'
    +'<div class="thumbs" id="dcThumbs"></div><div class="hint" id="dcSt" aria-live="polite"></div>'
    +'<div class="acts"><button class="save" id="dcGo" type="button">'+(ai?"פענח ›":"שמור ליום")+'</button><button class="cancel" type="button">ביטול</button></div></div>'
    +'<div id="dcOut" hidden></div></div>');
  const q=s=>scrim.querySelector(s), ta=q("#dcText"), st=q("#dcSt");
  let rec=null, recOn=false, base="";
  const press=on=>{ const b=q("#dcRec"); if(b){ b.setAttribute("aria-pressed",String(on)); b.innerHTML='<i class="ic ic-mic"></i>'+(on?"עצור":"הקלטה"); } };
  const stopRec=()=>{ recOn=false; press(false); try{ if(rec) rec.stop(); }catch(e){} };
  const close=closer(scrim,stopRec); q("#dcIn .cancel").onclick=close;
  if(SR) q("#dcRec").onclick=()=>{
    if(recOn){ stopRec(); st.textContent=""; return; }
    try{ rec=new SR(); }catch(e){ st.textContent="ההקלטה לא נתמכת כאן. לחץ על המיקרופון במקלדת ודבר."; return; }
    rec.lang="he-IL"; rec.continuous=true; rec.interimResults=true; base=ta.value.trim();
    rec.onresult=e=>{ let fin="", inter=""; for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal) fin+=r[0].transcript+" "; else inter+=r[0].transcript+" "; }
      if(fin) base=(base+" "+fin).trim(); ta.value=(base+(inter?" "+inter:"")).trim(); ta.scrollTop=ta.scrollHeight; };
    rec.onerror=e=>{ const code=e.error||""; if(code==="no-speech") return;   // שקט: onend יפעיל מחדש
      recOn=false; press(false);
      st.textContent=code==="not-allowed"||code==="service-not-allowed"?"הדפדפן לא נתן גישה למיקרופון כאן. לחץ על המיקרופון במקלדת ודבר, זה עובד תמיד.":"ההקלטה נעצרה ("+code+"). אפשר להמשיך במיקרופון של המקלדת."; };
    rec.onend=()=>{ if(recOn){ try{ rec.start(); return; }catch(e){} } recOn=false; press(false); };
    try{ rec.start(); recOn=true; press(true); st.textContent="מקליט… דבר חופשי, ולחץ «עצור» כשסיימת."; }catch(e){ st.textContent="ההקלטה לא נפתחה. לחץ על המיקרופון במקלדת ודבר."; }
  };
  const drawThumbs=()=>{ q("#dcThumbs").innerHTML=files.map((f,i)=>'<div><img src="'+URL.createObjectURL(f)+'" alt=""><button type="button" data-i="'+i+'" aria-label="הסר תמונה">×</button></div>').join("");
    q("#dcThumbs").querySelectorAll("button").forEach(b=>b.onclick=()=>{ files.splice(+b.dataset.i,1); drawThumbs(); }); };
  q("#dcCam").onchange=()=>{ [...(q("#dcCam").files||[])].forEach(f=>files.push(f)); q("#dcCam").value=""; drawThumbs(); };
  const finish=async(items)=>{ const {R,fail}=await applyDictation(items,{iso,photos:files}); close(); toast(dictSummary(R,fail)); };
  const review=items=>{ q("#dcIn").hidden=true; const out=q("#dcOut"); out.hidden=false;
    out.innerHTML='<div class="hint">סמן מה להכניס ליומן. אפשר לתקן אחר כך בכל מקום כרגיל.</div>'
      +items.map((it,i)=>'<label class="dchk"><input type="checkbox" data-i="'+i+'"'+(it.on?' checked':'')+'><div><b>'+esc(it.label)+'</b>'+(it.detail?'<span>'+esc(it.detail)+'</span>':'')+'</div></label>').join("")
      +(files.length?'<label class="dchk"><input type="checkbox" id="dcPh" checked><div><b>'+files.length+' תמונות</b><span>יצורפו לדוח היומי של '+esc(isoText(iso))+'</span></div></label>':'')
      +'<div class="acts"><button class="save" id="dcSave" type="button">שמור ביומן</button><button class="ghost" id="dcBack" type="button">חזרה לעריכה</button></div>';
    out.querySelectorAll("input[data-i]").forEach(c=>c.onchange=()=>{ items[+c.dataset.i].on=c.checked; });
    q("#dcBack").onclick=()=>{ out.hidden=true; q("#dcIn").hidden=false; };
    q("#dcSave").onclick=async()=>{ const b=q("#dcSave"); b.disabled=true; b.textContent="שומר…"; const ph=q("#dcPh"); if(ph&&!ph.checked) files.length=0; await finish(items); };
  };
  q("#dcGo").onclick=async()=>{
    const text=ta.value.trim(); if(!text&&!files.length){ toast("ספר משהו, או צלם."); ta.focus(); return; }
    stopRec();
    const asText=()=>text?[{kind:"text",on:true,field:"work",text,label:"דוח עבודה יומי",detail:text}]:[];
    const b=q("#dcGo");
    if(!shared.SAMPLE||b.dataset.plain){ b.disabled=true; b.textContent="שומר…"; await finish(asText()); return; }
    b.disabled=true; b.textContent="מפענח…"; st.textContent=files.length?"קורא את הטקסט ואת "+files.length+" התמונות…":"מפרק את הדיווח לרשומות…";
    try{
      const images=[]; for(const f of files) images.push(await photoBlob(f,1600,0.8));
      const out=await shared.SAMPLE.json(dictPrompt()+"\n\nהדיווח:\n"+(text||"(אין טקסט, רק תמונות)"),images.length?{images}:{});
      const items=dictItems(out);
      if(!items.length){ st.textContent="לא זיהיתי רשומות בדיווח. אפשר לשמור אותו כטקסט של היום."; b.dataset.plain="1"; b.disabled=false; b.textContent="שמור כטקסט"; return; }
      st.textContent=""; b.disabled=false; b.textContent="פענח ›"; review(items);
    }catch(e){ st.textContent="הפענוח לא הצליח"+(e&&e.code==="rate_limited"?" (עומס רגעי)":"")+". אפשר לנסות שוב, או לשמור כטקסט של היום."; b.dataset.plain="1"; b.disabled=false; b.textContent="שמור כטקסט"; }
  };
  ta.oninput=()=>{ const b=q("#dcGo"); if(b.dataset.plain&&shared.SAMPLE){ delete b.dataset.plain; b.textContent="פענח ›"; } };
  setTimeout(()=>{ if(!scrim.contains(document.activeElement)) ta.focus(); },60);   // המקלדת נפתחת, ואיתה המיקרופון שלה
}

export function __init(){
  const b=document.getElementById("fabMic"); if(b) b.onclick=()=>openDictation();
}
