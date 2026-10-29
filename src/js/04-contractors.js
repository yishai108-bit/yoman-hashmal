/* ================= קבלנים: מגמות, נורמה, לכמה שולחנות מספיק ================= */
let progress=[], prices={concreteM3:0,dieselL:0,panel:0,parts:{}};
const shortName=n=>String(n||"").replace(/\s*\((?:שלטר\s*)?מק״ט[^)]*\)/,"").replace(/\s*—\s*קרטון/,"").trim();
const shortSup=s=>String(s||"").replace(/\s*בע"מ.*$/,"").replace(/\s*\(.*?\)/g,"").trim();

const emptyWho=w=>({who:w,n:0,tables:0,units:0,signed:0,undecl:0,last:0,first:Infinity,done:0,donePan:0,doneOk:0,lastDone:0});
const STAGES=[["con","קונסטרוקציה הושלמה","שולחנות שהקונסטרוקציה שלהם הורכבה ונגמרה (ברגים בפנים)"],["pan","פאנלים הורכבו","שולחנות שהפאנלים כבר עליהם"],["ok","אושר ע״י מפקח","שולחנות שהמפקח בדק ואישר"]];
const stageOf=p=>STAGES.some(x=>x[0]===p.stage)?p.stage:"con";
const stageLabel=st=>(STAGES.find(x=>x[0]===st)||STAGES[0])[1];

function kitStats(){
  const mvs=demoStock?[]:moves, iss=demoStock?[]:issues, prog=demoStock?[]:progress;
  const byName=new Map(kit.map(k=>[k.name,k]));
  const types=kitTypes.map(t=>({...t,count:Number(t.count)||0}));
  const total=types.reduce((s,t)=>s+t.count,0);
  const refType=types[0]?types[0].id:"in27";
  const rows=new Map(stockRows().map(r=>[r.name,r]));
  // כמה יצא מכל מק״ט (יחידות). קרטונים בלי כמות נשמרים בצד.
  const out=new Map(); const cartons=[];
  mvs.forEach(m=>{
    const k=byName.get((m.item||"").trim()); const q=(Number(m.qty)||0)*(m.dir==="in"?-1:1);
    if(k) out.set(k.code,(out.get(k.code)||0)+q);
    else if(/קרטון/.test(m.item||"")) cartons.push(m);
  });
  // כמות לשולחן בפועל, מניפוקים שהצהירו על מספר שולחנות
  const rate=new Map(); let declTables=0, declN=0, undeclN=0;
  iss.slice().sort((a,b)=>a.ts-b.ts).forEach(i=>{
    const t=Number(i.tables)||0; if(!t){ undeclN++; return; }
    declN++; declTables+=t;
    const tt=(i.ttype && types.some(x=>x.id===i.ttype)) ? i.ttype : refType;
    (i.lines||[]).forEach(l=>{
      const k=kit.find(x=>x.code===l.code)||byName.get((l.name||"").trim()); if(!k) return;
      const r=rate.get(k.code)||{q:0,t:0,normQ:0,pts:[]}; const q=Number(l.qty)||0; const n=perOf(k,tt);
      r.q+=q; r.t+=t; r.normQ+=n*t; r.pts.push({ts:i.ts,rate:q/t,norm:n,who:i.who}); rate.set(k.code,r);
    });
  });
  const sumSt=st=>prog.filter(p=>stageOf(p)===st).reduce((s,p)=>s+(Number(p.tables)||0),0);
  const doneOk=sumSt("ok"), donePan=Math.max(sumSt("pan"),doneOk), done=Math.max(sumSt("con"),donePan);   // שלבים מצטברים: קונסטרוקציה ⊇ פאנלים ⊇ אושרו
  const doneProxy=!prog.length;                 // אין דיווחי ביצוע → קירוב: הגבוה מבין שולחנות שנופקו ושולחנות עם פאנלים
  const pbNow=demoStock?null:curPb(); const panelTables=pbNow?Math.floor(N(pbNow.installed)/PANELS_PER_TABLE):0;
  const proxySrc=doneProxy?(panelTables>declTables?"panels":"issues"):"reports";
  const doneEff=doneProxy?Math.max(declTables,panelTables):done;
  const remaining=Math.max(0,total-doneEff);
  // שולחנות שנותרו לפי סוג
  const remBy=new Map(); types.forEach(t=>remBy.set(t.id,t.count));
  if(!doneProxy){
    prog.filter(p=>stageOf(p)==="con").forEach(p=>{ const n=Number(p.tables)||0; if(!n) return;
      if(p.ttype && remBy.has(p.ttype)) remBy.set(p.ttype,remBy.get(p.ttype)-n);
      else if(total) types.forEach(x=>remBy.set(x.id,remBy.get(x.id)-x.count*n/total)); });
    if(done>sumSt("con") && total) types.forEach(x=>remBy.set(x.id,remBy.get(x.id)-x.count*(done-sumSt("con"))/total));
  } else if(total) types.forEach(t=>remBy.set(t.id,t.count*remaining/total));
  types.forEach(t=>remBy.set(t.id,Math.max(0,remBy.get(t.id))));
  const hidden=(!doneProxy&&declTables<done)?done-declTables:0;   // שולחנות שנבנו בלי ניפוק רשום: הברגים שלהם יצאו מהמחסן בלי רישום
  const parts=kit.map(k=>{
    const r=rate.get(k.code); const issued=out.get(k.code)||0;
    const act=(r&&r.t)?r.q/r.t:null;
    const normRef=(r&&r.t)?r.normQ/r.t:perOf(k,refType);
    const ratio=(act!=null&&normRef)?act/normRef:1;
    const dev=(act!=null&&normRef)?act/normRef-1:null;
    const row=rows.get(k.name);
    const haveRaw=row?(row.counted!==null?row.counted:row.derived):0;
    const hiddenUse=(row&&row.counted===null&&hidden&&k.def!==false)?hidden*normRef*(ratio||1):0;
    const have=Math.max(0,haveRaw-hiddenUse);
    const needNorm=types.reduce((s,t)=>s+perOf(k,t.id)*(remBy.get(t.id)||0),0);
    const needAct=needNorm*ratio;
    const perMix=remaining?needNorm/remaining:0;
    const worthNorm=perMix?have/perMix:Infinity, worthAct=perMix?have/(perMix*ratio):Infinity;
    const pts=r?r.pts:[];
    return {code:k.code,name:k.name,def:k.def!==false,issued,act,normRef,dev,ratio,have,haveRaw,hiddenUse,counted:!!row&&row.counted!==null,
      inBom:!!row&&!row.noIn,needNorm,needAct,worthNorm,worthAct,remaining,
      shortNorm:Math.max(0,needNorm-have),shortAct:Math.max(0,needAct-have),
      overSoFar:(r&&r.t)?Math.max(0,r.q-r.normQ):0,first:pts.length?pts[0].rate:null,last:pts.length?pts[pts.length-1].rate:null,pts};
  });
  // קבלנים
  const who=new Map();
  iss.forEach(i=>{ const w=(i.who||"—").trim(); const e=who.get(w)||emptyWho(w);
    e.n++; const t=Number(i.tables)||0; e.tables+=t; if(!t) e.undecl++;
    e.units+=(i.lines||[]).reduce((s,l)=>s+(Number(l.qty)||0),0);
    if(i.sigAsset||i.sigUrl||i.sigData) e.signed++; e.last=Math.max(e.last,i.ts); e.first=Math.min(e.first,i.ts); who.set(w,e); });
  prog.forEach(p=>{ const w=(p.who||"").trim(); if(!w) return; const e=who.get(w)||emptyWho(w); const st=stageOf(p); const n=Number(p.tables)||0;
    if(st==="con") e.done+=n; else if(st==="pan") e.donePan=(e.donePan||0)+n; else e.doneOk=(e.doneOk||0)+n; e.lastDone=Math.max(e.lastDone,p.ts); who.set(w,e); });
  who.forEach(e=>{ e.doneOk=e.doneOk||0; e.donePan=Math.max(e.donePan||0,e.doneOk); e.done=Math.max(e.done,e.donePan); });
  // שווה ערך בשולחנות לפי הפריט הראשון בקיט (בורג M12): כולל ניפוקים בלי מספר שולחנות
  const refPart=kit.find(k=>k.def!==false)||kit[0]; const refPer=refPart?perOf(refPart,refType):0;
  if(refPart&&refPer){ mvs.forEach(m=>{ if((m.item||"").trim()!==refPart.name) return; const w=(m.who||"—").trim(); const e=who.get(w); if(!e) return; e.refQty=(e.refQty||0)+(Number(m.qty)||0)*(m.dir==="in"?-1:1); });
    who.forEach(e=>{ e.eqTables=e.refQty?e.refQty/refPer:0; e.refName=shortName(refPart.name); }); }
  const cons=[...who.values()].sort((a,b)=>b.tables-a.tables||b.units-a.units);
  // קצב: שולחנות שנופקו לשבוע, מהניפוק המוצהר הראשון
  const decl=iss.filter(i=>Number(i.tables)>0); let pace=0;
  if(decl.length){ const t0=Math.min(...decl.map(i=>i.ts)); pace=declTables/Math.max(7,(Date.now()-t0)/86400000)*7; }
  let paceDone=0;
  const conRep=prog.filter(p=>stageOf(p)==="con");
  if(conRep.length>1&&done){ const t0=Math.min(...conRep.map(p=>p.ts)); paceDone=done/Math.max(7,(Date.now()-t0)/86400000)*7; }
  return {total,done,donePan,doneOk,doneEff,doneProxy,proxySrc,panelTables,remaining,declTables,declN,undeclN,hidden,cartons,parts,cons,pace,paceDone,issuesN:iss.length};
}

function moneyPoints(){
  const P=[]; const cons=curConcrete(); const notes=curNotes(); const K=kitStats(); const pr=prices||{}; const pp=pr.parts||{};
  const ils=v=>SHOW_PRICES&&v>0?"₪"+fmtN(Math.round(v)):"";
  // בטון בלי תעודה
  const m=missingConcrete(cons);
  if(m.trucks) P.push({sev:3,n:fmtM3(m.m3),u:"מ״ק בטון",ils:pr.concreteM3?ils(m.m3*pr.concreteM3):"",
    b:trucksText(m.trucks)+" בטון הגיעו בלי תעודה מצולמת",
    s:"המונה המצטבר של הספק קפץ ("+m.days.join(", ")+"). לדרוש את התעודות לפני שהחשבונית מגיעה."+(pr.concreteM3||!SHOW_PRICES?"":" הזן מחיר למ״ק כדי לראות ₪."),tab:"concrete"});
  // מעל הנורמה
  const over=K.parts.filter(p=>p.dev!=null&&p.dev>0.05);
  if(over.length){
    const soFar=over.reduce((s,p)=>s+p.overSoFar,0), proj=over.reduce((s,p)=>s+Math.max(0,p.needAct-p.needNorm),0);
    const money=over.reduce((s,p)=>s+(pp[p.code]?(p.overSoFar+Math.max(0,p.needAct-p.needNorm))*pp[p.code]:0),0);
    P.push({sev:2,n:fmtN(Math.round(soFar)),u:"יח' מעל הנורמה",ils:ils(money),
      b:over.length+" פריטי שלטר יוצאים לקבלן מעל ה-BOM",
      s:over.slice(0,3).map(p=>shortName(p.name)+" "+fmtN(Math.round(p.act))+" במקום "+fmtN(Math.round(p.normRef))+" לשולחן").join(" · ")
        +". עד השולחן האחרון זה עוד "+fmtN(Math.round(proj))+" יח' שאין ב-BOM.",tab:"over"});
  }
  // ייגמר לפני הסוף
  const short=K.parts.filter(p=>p.inBom&&p.def&&p.issued>0&&p.shortAct>0).sort((a,b)=>a.worthAct-b.worthAct);
  if(short.length) P.push({sev:3,n:fmtN(short.length),u:"פריטי שלטר",
    b:"ייגמרו לפני השולחן האחרון בקצב הניפוק הנוכחי",
    s:short.slice(0,3).map(p=>shortName(p.name)+": מספיק ל-"+fmtN(Math.floor(p.worthAct))+" מתוך "+fmtN(Math.round(p.remaining))).join(" · ")
      +(short.length>3?" ועוד "+(short.length-3):"")+". הזמנה משלטר היא שבועות של הובלה. עצירת אתר עולה יותר מהברגים.",tab:"over"});
  // ברגים בשטח
  if(!K.doneProxy){
    const atSite=K.cons.reduce((s,c)=>s+Math.max(0,c.tables-c.done),0);
    if(atSite>0) P.push({sev:2,n:fmtN(atSite),u:"שולחנות",b:"ברגים שנופקו ועוד לא הורכבו",
      s:"נופק ל-"+fmtN(K.declTables)+" שולחנות, דווחו גמורים "+fmtN(K.done)+". ברגים ששוכבים בשטח נעלמים, נרטבים, או נספרים פעמיים.",tab:"over"});
  } else if(K.declTables&&K.proxySrc==="panels") P.push({sev:1,n:"~"+fmtN(K.panelTables),u:"שולחנות עומדים",b:"יותר שולחנות עומדים ממה שנופקו להם ברגים ברישום",
    s:"לפי הפאנלים המותקנים ~"+fmtN(K.panelTables)+" שולחנות, ברישום נופקו ברגים ל-"+fmtN(K.declTables)+". ההפרש יצא בקרטונים בלי כמות ובניפוקים בלי מספר שולחנות. דיווח ביצוע שבועי סוגר את זה.",tab:"over",act:"progress"});
  else if(K.declTables) P.push({sev:1,n:fmtN(K.declTables),u:"שולחנות",b:"נופקו ברגים, ואף שולחן גמור לא דווח",
    s:"בלי דיווח ביצוע אי אפשר לדעת כמה ברגים שוכבים בשטח. דיווח לוקח עשר שניות, בכפתור בלשונית קבלנים.",tab:"over",act:"progress"});
  // ממתינים לאישור מפקח
  if(!K.doneProxy&&K.donePan>K.doneOk) P.push({sev:1,n:fmtN(K.donePan-K.doneOk),u:"שולחנות",b:"שולחנות עם פאנלים שעוד לא אושרו ע״י מפקח",
    s:"הקבלן יחייב עליהם. חשבון קבלן נבדק מול שולחנות מאושרים, לא מול שולחנות שהורכבו. אישור = דיווח ביצוע בשלב «אושר ע״י מפקח».",tab:"over",act:"progress-ok"});
  // יוצא בלי רישום
  const zero=K.parts.filter(p=>p.inBom&&p.def&&!p.issued&&K.declTables>0);
  if(zero.length) P.push({sev:2,n:fmtN(zero.reduce((s,p)=>s+p.have,0)),u:"יח' בלי מעקב",
    b:zero.length+" פריטי קיט יוצאים לשטח בלי רישום",
    s:zero.map(p=>shortName(p.name)).join(", ")+". נופקו ברגים ל-"+fmtN(K.declTables)+" שולחנות, ולמחברים אפס רישום. מה שלא נרשם לא נספר.",tab:"over"});
  // ניפוקים שאי אפשר לבדוק
  if(K.undeclN||K.cartons.length) P.push({sev:1,n:fmtN(K.undeclN+K.cartons.length),u:"רשומות",
    b:"ניפוקים שאי אפשר לבדוק מול הנורמה",
    s:[K.undeclN?K.undeclN+" ניפוקים בלי מספר שולחנות":"",K.cartons.length?K.cartons.length+" שורות קרטון בלי כמות ליחידות":""].filter(Boolean).join(" · ")
      +". מהיום כל ניפוק יוצא דרך «ניפוק לפי שולחן», וזה נעלם.",tab:"stock"});
  // החזרות בלי זיכוי
  const isDep=l=>/פקדון|פיקדון|כד ריק|^כד מים|^תכולת כד/.test(l.name||"");
  const rets=notes.filter(n=>{ const f=noteFlags(n); return f.ret && !(n.lines||[]).some(isDep); });
  if(rets.length) P.push({sev:2,n:fmtN(rets.length),u:"החזרות",b:"החזרות לספק שצריכות תעודת זיכוי",
    s:rets.slice(0,4).map(n=>shortSup(n.supplier)+": "+(n.lines||[]).filter(l=>Number(l.qty)<0).map(l=>fmtN(-l.qty)+" "+shortName(l.name).split(" ").slice(0,3).join(" ")).join(", ")).join(" · ")
      +". בלי זיכוי בחשבונית, שילמנו על מה שהחזרנו.",tab:"over",act:"flags"});
  // פיקדונות
  const dep=new Map();
  notes.forEach(n=>(n.lines||[]).forEach(l=>{ const nm=l.name||"";
    if(/פקדון|פיקדון/.test(nm)) dep.set("תופי פיקדון · "+shortSup(n.supplier),(dep.get("תופי פיקדון · "+shortSup(n.supplier))||0)+(Number(l.qty)||0));
    else if(/^כד מים|^תכולת כד|^כד ריק/.test(nm)) dep.set("כדי מים · "+shortSup(n.supplier),(dep.get("כדי מים · "+shortSup(n.supplier))||0)+(Number(l.qty)||0)); }));
  const depOpen=[...dep.entries()].filter(([,v])=>v>0);
  if(depOpen.length) P.push({sev:1,n:fmtN(depOpen.reduce((s,[,v])=>s+v,0)),u:"יח' בפיקדון",b:"פיקדונות שלא הוחזרו",
    s:depOpen.map(([k,v])=>fmtN(v)+" "+k).join(" · ")+". הכסף חוזר רק כשהתוף או הכד חוזרים לספק.",tab:"stock"});
  // הזמנות חלקיות
  const partial=new Map();
  notes.forEach(n=>{ if(/אספקה חלקית|ק\.ספר\/חלקית|סופקה? חלקית/.test(n.note||"")){ const o=((n.note||"").match(/הזמנה\s+([A-Za-z0-9]+)/)||[])[1]||n.noteNo; const e=partial.get(o)||{sup:n.supplier,n:0}; e.n++; partial.set(o,e); } });
  if(partial.size) P.push({sev:1,n:fmtN(partial.size),u:"הזמנות",b:"הזמנות שסופקו חלקית ועדיין פתוחות",
    s:[...partial.entries()].map(([o,e])=>shortSup(e.sup)+" "+o+" ("+e.n+" משלוחים)").join(" · ")+". לוודא שהיתרה סופקה, או שלא חויבה.",tab:"over"});
  // דלק
  const fuel=[]; notes.forEach(n=>(n.lines||[]).forEach(l=>{ if(/סולר|דלק/.test(l.name||"")) fuel.push({ts:n.ts,q:Number(l.qty)||0,note:n.note||""}); }));
  if(fuel.length){
    const L=fuel.reduce((s,f)=>s+f.q,0); const mach=new Map();
    fuel.forEach(f=>{ const mm=f.note.match(/תדלוק\s+([^·]+?)\s*·.*?שעות\s+([\d.]+)/); if(mm){ const k=mm[1].trim(); (mach.get(k)||mach.set(k,[]).get(k)).push({ts:f.ts,h:Number(mm[2]),q:f.q}); } });
    const lph=[]; mach.forEach((arr,k)=>{ arr.sort((a,b)=>a.ts-b.ts); if(arr.length>1){ const a=arr[arr.length-2], b=arr[arr.length-1]; if(b.h>a.h) lph.push(k+": "+(b.q/(b.h-a.h)).toFixed(1)+" ליטר לשעה"); } });
    P.push({sev:1,n:fmtN(L),u:"ליטר סולר",ils:pr.dieselL?ils(L*pr.dieselL):"",b:fuel.length+" תדלוקים"+(lph.length?" · "+lph.join(" · "):""),
      s:lph.length?"צריכה לשעת מנוע לפי מוני השעות שבתעודות. קפיצה פתאומית היא דלק שלא הגיע למכונה."
        :"מונה שעות נרשם פעם אחת לכל מכונה ("+[...mach.keys()].join(", ")+"). מהתדלוק הבא האפליקציה תחשב ליטר לשעה, וקפיצה פתאומית היא דלק שלא הגיע למכונה.",tab:"stock"});
  }
  // פאנלים: שבורים וספייר
  const pb=curPb();
  if(pb){
    const c=pbCalc(pb,prevPb());
    const shortNow=-c.usable, shortProj=c.projected!=null?-c.projected:null;
    if(shortNow>0||(shortProj&&shortProj>0)){ const lead=shortNow>0?shortNow:shortProj;
      P.push({sev:shortNow>0?3:2,n:fmtN(Math.round(lead)),u:shortNow>0?"פאנלים חסרים היום":"פאנלים יחסרו (צפי)",ils:pr.panel?ils(lead*pr.panel):"",
      b:shortNow>0?"אין מספיק פאנלים לסיים את האתר":"היום מספיק, בקצב השבירה הנוכחי לא",
      s:"באתר "+fmtN(c.onSite)+" מול "+fmtN(N(pb.required))+" לפי התכנון, "+fmtN(N(pb.broken))+" שבורים"+(shortNow>0?": חסרים "+fmtN(shortNow)+" היום":"")
        +(shortProj!=null&&c.breakRate!=null&&shortProj>shortNow?". בקצב השבירה הנוכחי ("+(c.breakRate*100).toFixed(1)+"% מהמותקנים) כ-"+fmtN(Math.round(shortProj))+" בסוף":"")
        +". פאנלים מגיעים מהיצרן בשבועות; להזמין ספייר עכשיו.",tab:"panels"}); }
    if(N(pb.broken)){ const rs=(pb.brokenReasons||[]).slice().sort((x,y)=>N(y.qty)-N(x.qty));
      P.push({sev:2,n:fmtN(N(pb.broken)),u:"פאנלים שבורים",ils:pr.panel?ils(N(pb.broken)*pr.panel):"",
        b:"פאנלים שבורים"+(c.dBroken>0?", "+fmtN(c.dBroken)+" מהם ב-"+Math.round(c.days)+" הימים האחרונים":""),
        s:(rs.length?rs.map(r=>fmtN(N(r.qty))+" "+r.reason).join(" · ")+". ":"")+"כל שבור עם אחראי מזוהה (מוביל, ספק, קבלן) הוא תביעה. בלי אחראי, הוא על בלקטריק.",tab:"panels"}); }
    if(c.gap) P.push({sev:1,n:fmtN(Math.abs(c.gap)),u:"פאנלים",b:"פער בין קבלה לספירה",
      s:"התקבלו "+fmtN(N(pb.received))+", יצאו "+fmtN(c.taken)+", נספרו "+fmtN(c.onSite)+". "+(c.gap>0?"נספרו יותר ממה שהתקבל: כנראה משטח עם יותר מ-"+fmtN(N(pb.perPallet)||33)+".":"חסרים מול הקבלה.")+" לבדוק פעם אחת, לפני שמישהו שואל.",tab:"panels"});
  }
  // כלים אצל אנשים
  const tools=holders().filter(h=>h.cat==="tools");
  if(tools.length) P.push({sev:1,n:fmtN(tools.reduce((s,h)=>s+h.qty,0)),u:"כלים",b:"כלי עבודה אצל אנשים",
    s:tools.slice(0,3).map(h=>shortName(h.item)+" אצל "+h.who).join(" · ")+". כלי שלא חוזר נקנה פעמיים.",tab:"stock"});
  // תעודות עם חוסר/פגום
  const fl=notes.filter(n=>noteFlags(n).issue);
  if(fl.length) P.push({sev:1,n:fmtN(fl.length),u:"תעודות",b:"תעודות עם חוסר או פריט פגום",
    s:"כל אחת היא חשבונית שצריך לבדוק לפני שמשלמים. הרשימה המלאה בכרטיס «דורש בדיקה».",tab:"over",act:"flags"});
  return P.sort((a,b)=>b.sev-a.sev);
}

function renderMoney(){
  const box=$("#ovMoney"), head=$("#ovMoneyHead"); if(!box) return;
  box.innerHTML=""; head.innerHTML="";
  if(demoStock){ box.innerHTML='<div class="empty" style="padding:18px">כשייקלטו תעודות וניפוקים אמיתיים, הנקודות יופיעו כאן לבד.</div>'; return; }
  let P=moneyPoints();
  const hasPrices=(prices.concreteM3||prices.dieselL||prices.panel||Object.values(prices.parts||{}).some(v=>v>0));
  const sum=P.reduce((s,p)=>s+(p.ils?Number(p.ils.replace(/[^\d]/g,"")):0),0);
  head.innerHTML='<span><b>'+P.length+'</b> נקודות פתוחות</span>'
    +(!SHOW_PRICES?'':hasPrices?(sum?'<span>מחושב לפי המחירים שהוזנו: <b style="font-size:1.1rem">₪'+fmtN(sum)+'</b> בנקודות שיש להן מחיר</span>':'<span>הזן מחירים לפריטים כדי לראות ₪ ליד כל נקודה.</span>')
      :'<span>הכמויות אמיתיות. כדי לראות ₪, הזן מחירים (בטון למ״ק, ברגים ליחידה).</span>');
  if(!P.length){ box.innerHTML='<div class="empty" style="padding:18px">אין נקודות פתוחות. זה המצב שרוצים.</div>'; return; }
  const top=P.filter(p=>p.sev===3).length; const LP=P.filter(p=>p.sev<3);   // הדחופות כבר בהתרעות למעלה
  if(top){ const n=document.createElement("div"); n.className="note"; n.style.margin="0 0 8px"; n.textContent=top+" הדחופות מופיעות בהתרעות בראש הדף. כאן השאר:"; box.appendChild(n); }
  const P0=P; P=LP;
  P.slice(0,moneyMax).forEach(p=>{
    const b=document.createElement("button"); b.type="button";
    b.className="money"+(p.sev===3?"":p.sev===2?" warn":" info");
    b.innerHTML='<div class="n">'+p.n+'<small>'+esc(p.u)+'</small>'+(p.ils?'<em>'+p.ils+'</em>':'')+'</div>'
      +'<div class="t"><b>'+esc(p.b)+'</b><span>'+esc(p.s)+'</span></div><span class="go">‹</span>';
    b.onclick=()=>{ showTab(p.tab); if(ROLE!=="viewer"&&p.act==="progress") openProgress(); if(ROLE!=="viewer"&&p.act==="progress-ok") openProgress({stage:"ok"}); if(p.act==="flags"){ const f=$("#ovFlags"); if(f){ const cd=f.closest(".card"); if(cd) cd.classList.remove("folded"); } if(f) f.scrollIntoView({behavior:"smooth",block:"start"}); } };
    box.appendChild(b);
  });
  if(P.length>moneyMax){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent="עוד "+(P.length-moneyMax)+" נקודות"; m.onclick=()=>{moneyMax=99; renderMoney();}; box.appendChild(m); }
  else if(moneyMax>3&&P.length>3){ const m=document.createElement("button"); m.className="linkbtn"; m.type="button"; m.textContent="הצג פחות"; m.onclick=()=>{moneyMax=3; renderMoney();}; box.appendChild(m); }
}
let moneyMax=3, rateMax=4, runMax=4;

function sparkHtml(pts,norm){
  if(!pts.length) return "";
  const max=Math.max(norm*1.15,...pts.map(p=>p.rate))||1;
  return '<div class="spark" title="כמות לשולחן בכל ניפוק">'
    +'<div class="norm" style="bottom:'+(norm/max*100)+'%"><span class="nl">'+fmtN(Math.round(norm))+'</span></div>'
    +pts.map(p=>'<i class="'+(p.rate>p.norm*1.05?"hi":p.rate<p.norm*0.9?"lo":"")+'" style="height:'+(p.rate/max*100)+'%" title="'+fmtD(p.ts)+' · '+fmtN(Math.round(p.rate))+' לשולחן"></i>').join("")+'</div>';
}

function renderContractors(){
  if(!$("#conWho")) return;
  const K=kitStats();
  $("#demoBarK").hidden=!(demoStock||!K.issuesN);
  $("#conBig").textContent=fmtN(K.declTables);
  $("#conIss").textContent=fmtN(K.issuesN);
  $("#conDone").textContent=K.doneProxy?(K.proxySrc==="panels"?"~"+fmtN(K.panelTables):"—"):fmtN(K.done);
  const cdk=$("#conDone").nextElementSibling; if(cdk) cdk.textContent=K.doneProxy&&K.proxySrc==="panels"?"שולחנות עם פאנלים (אומדן)":"קונסטרוקציה הושלמה";
  // מסלול השולחן
  const pipe=$("#conPipe"); if(pipe){ pipe.innerHTML="";
    const rows=[["נופקו ברגים (ברישום)",K.declTables,"var(--amber-fill)"],["קונסטרוקציה הושלמה",K.doneProxy?null:K.done,"var(--info-fill)"],["פאנלים הורכבו",K.doneProxy?(K.proxySrc==="panels"?K.panelTables:null):K.donePan,"var(--sage-fill)"],["אושרו ע״י מפקח",K.doneProxy?null:K.doneOk,"var(--ink2)"]];
    rows.forEach(([l,v,col],i)=>{ const d=document.createElement("div"); d.className="hb"; const pct=K.total&&v!=null?Math.min(100,v/K.total*100):0;
      d.innerHTML='<div class="l">'+l+(i===2&&K.doneProxy&&v!=null?' <small style="color:var(--ink3)">(אומדן לפי מאזן פאנלים)</small>':'')+'</div><div class="v">'+(v==null?'לא דווח':fmtN(Math.round(v))+' / '+fmtN(K.total))+'</div><div class="t"><i style="width:'+pct+'%;background:'+col+'"></i></div>';
      pipe.appendChild(d); });
    if(!K.doneProxy&&K.donePan>K.doneOk){ const d=document.createElement("div"); d.className="note"; d.style.margin="4px 0 0"; d.textContent="ממתינים לאישור מפקח: "+fmtN(K.donePan-K.doneOk)+" שולחנות עם פאנלים."+(K.done>K.donePan?" קונסטרוקציה בלי פאנלים: "+fmtN(K.done-K.donePan)+".":""); pipe.appendChild(d); }
    if(!K.doneProxy&&K.done>K.declTables){ const d=document.createElement("div"); d.className="note"; d.style.cssText="color:var(--clay);margin:4px 0 0"; d.textContent="נבנו "+fmtN(K.done-K.declTables)+" שולחנות יותר ממה שנופקו להם ברגים ברישום: ההפרש יצא בניפוקים בלי מספר שולחנות ובקרטונים. מהיום כל ניפוק נרשם לפי שולחן."; pipe.appendChild(d); }
  }
  $("#conPace").textContent=K.pace?fmtN(Math.round(K.pace)):"—";
  const weeksLeft=K.pace?K.remaining/K.pace:0;
  const endTxt=weeksLeft?fmtD(Date.now()+weeksLeft*7*86400000):"";
  $("#conSub").innerHTML=(K.doneProxy
      ? (K.proxySrc==="panels" ? '~<b>'+fmtN(K.panelTables)+'</b> שולחנות עומדים לפי הפאנלים · נותרו <b>'+fmtN(K.remaining)+'</b> מתוך '+fmtN(K.total)
                                : 'נותרו <b>'+fmtN(K.remaining)+'</b> מתוך '+fmtN(K.total)+' · עוד לא דווח ביצוע')
      : '<b>'+fmtN(K.done)+'</b> מתוך '+fmtN(K.total)+' שולחנות · נותרו <b>'+fmtN(K.remaining)+'</b>')
    +(K.pace&&endTxt?' · סיום משוער <b>'+endTxt+'</b>':'');
  // ניפוק מול ביצוע
  const cw=$("#conWho"); cw.innerHTML="";
  if(!K.cons.length) cw.innerHTML='<div class="empty">אין עדיין ניפוקים לקבלן.</div>';
  K.cons.forEach(c=>{
    const el=document.createElement("div"); el.className="con";
    const at=c.tables-c.done;
    const single=K.cons.length===1;
    const doneShown=c.done||(single&&K.doneProxy&&K.proxySrc==="panels"?K.panelTables:0);
    const rp=K.total?Math.min(1,doneShown/K.total):0;
    el.innerHTML=ringHtml(rp,"info",doneShown?Math.round(rp*100)+"%":"—",true)+'<div class="who">'+esc(c.who)+'</div>'
      +'<div class="m num">'+fmtN(c.tables)+'<small>שולחנות נופקו</small></div>'
      +'<div class="kv">'+(c.n?'<span><b>'+c.n+'</b> ניפוקים</span>':'')
        +(c.undecl?'<span class="gap">'+c.undecl+' בלי מספר שולחנות</span>':'')
        +(c.n?'<span><b>'+c.signed+'</b> מתוך '+c.n+' חתומים</span>':'')
        +'<span><b>'+fmtN(c.units)+'</b> יח\'</span>'
        +(c.eqTables?'<span>לפי '+esc(c.refName)+' שיצאו: שווה ערך ל-<b>'+fmtN(Math.round(c.eqTables))+'</b> שולחנות</span>':'')
        +(c.done?'<span>קונסטרוקציה <b>'+fmtN(c.done)+'</b>'+(c.donePan?' · פאנלים <b>'+fmtN(c.donePan)+'</b>':'')+' · אושרו <b>'+fmtN(c.doneOk)+'</b></span>':(doneShown?'<span>עומדים לפי פאנלים <b>~'+fmtN(doneShown)+'</b> מתוך '+fmtN(K.total)+'</span>':'<span>לא דווחו שולחנות גמורים</span>'))
        +(c.done&&at>0?'<span class="gap">ברגים ל-'+fmtN(at)+' שולחנות בשטח</span>':'')
        +(c.done&&at<0?'<span class="gap">דווחו '+fmtN(-at)+' שולחנות יותר ממה שנופק</span>':'')
        +(c.last?'<span>ניפוק אחרון '+fmtD(c.last)+'</span>':'')+'</div>';
    cw.appendChild(el);
  });
  // כמה לשולחן באמת
  const cr=$("#conRate"); cr.innerHTML="";
  const rated=K.parts.filter(p=>p.act!=null).sort((a,b)=>Math.abs(b.dev)-Math.abs(a.dev));
  if(!rated.length) cr.innerHTML='<div class="empty">צריך ניפוק אחד לפחות עם מספר שולחנות.</div>';
  { const ov=rated.filter(p=>p.dev>0.05).length; foldSum("rate",rated.length?(ov?ov+" מעל הנורמה":"לפי הנורמה"):""); }
  rated.slice(0,rateMax).forEach(p=>{
    const el=document.createElement("div"); el.className="rate";
    const cls=p.dev>0.05?"d-over":p.dev<-0.05?"d-under":"d-ok";
    const devTxt=Math.abs(p.dev)<=0.02?"לפי הנורמה":(p.dev>0?"+":"−")+Math.abs(Math.round(p.dev*100))+"%";
    const trend=(p.first!=null&&p.last!=null&&Math.abs(p.last-p.first)>=Math.max(2,p.normRef*0.08))
      ?' · <b>'+fmtN(Math.round(p.first))+' ← '+fmtN(Math.round(p.last))+'</b> מהניפוק הראשון לאחרון':'';
    const over=p.overSoFar>0?' · עד היום <b>+'+fmtN(Math.round(p.overSoFar))+'</b> מעל ה-BOM':'';
    el.innerHTML='<div class="nm">'+esc(shortName(p.name))+'</div><span class="dev '+cls+'">'+devTxt+'</span>'
      +'<div class="cmp">בפועל <b>'+fmtN(Math.round(p.act*10)/10)+'</b> לשולחן · נורמה <b>'+fmtN(Math.round(p.normRef))+'</b>'+trend+over+'</div>'
      +sparkHtml(p.pts,p.normRef);
    cr.appendChild(el);
  });
  if(rated.length>rateMax){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent="עוד "+(rated.length-rateMax)+" פריטים"; m.onclick=()=>{rateMax=99; renderContractors();}; cr.appendChild(m); }
  // לכמה שולחנות המלאי מספיק
  const rn=$("#conRun"); rn.innerHTML="";
  const run=K.parts.filter(p=>p.inBom&&p.def).sort((a,b)=>(a.worthAct-a.remaining)-(b.worthAct-b.remaining));
  if(!run.length) rn.innerHTML='<div class="empty">אין מלאי פתיחה לקיט. קלוט את ה-BOM כתעודת משלוח.</div>';
  { const bad=run.filter(p=>p.shortAct>0).length; foldSum("run",run.length?(bad?bad+" ייגמרו לפני הסוף":"מספיק עד הסוף"):""); }
  run.slice(0,runMax).forEach(p=>{
    const el=document.createElement("div"); el.className="run"+(!p.issued&&K.declTables?" zero":"");
    const w=Math.min(p.worthAct,9999), rem=Math.max(1,p.remaining);
    const bad=p.shortAct>0, warn=!bad&&p.worthAct<rem*1.08;
    const pct=Math.min(100,w/rem*100);
    const v=isFinite(p.worthAct)?'מספיק ל-'+fmtN(Math.floor(w))+' מתוך '+fmtN(Math.round(p.remaining)):'—';
    const s=(!p.issued&&K.declTables)?'אפס ניפוקים רשומים. או שיוצא בלי רישום, או שעוד לא בשימוש.'
      :bad?'חסרים <b>'+fmtN(Math.ceil(p.shortAct))+'</b> יח\' בקצב הנוכחי'+(p.shortNorm>0?' (גם בנורמה: '+fmtN(Math.ceil(p.shortNorm))+')':' (בנורמה: מספיק)')+(p.hiddenUse&&!p.counted?' · כולל אומדן ל-'+fmtN(K.hidden)+' שולחנות שנבנו בלי ניפוק רשום. ספירה אחת של הקרטונים סוגרת את זה.':'')
      :'במחסן '+(p.counted?'(נספר) ':p.hiddenUse?'(BOM פחות ניפוקים, פחות אומדן ל-'+fmtN(K.hidden)+' שולחנות שנבנו בלי רישום) ':'(לפי BOM פחות ניפוקים) ')+'<b>'+fmtN(Math.round(p.have))+'</b> · צריך <b>'+fmtN(Math.round(p.needAct))+'</b>';
    el.innerHTML=ringHtml(isFinite(p.worthAct)?pct/100:1,bad?"bad":warn?"warn":"",(!p.issued&&K.declTables)?"0":null)
      +'<div class="nm">'+esc(shortName(p.name))+'</div><div class="v'+(bad?" bad":"")+'">'+v+'</div>'
      +'<div class="t"><i class="'+(bad?"bad":warn?"warn":"")+'" style="width:'+pct+'%"></i></div><div class="s">'+s+'</div>';
    rn.appendChild(el);
  });
  if(run.length>runMax){ const m=document.createElement("button"); m.className="more"; m.type="button"; m.textContent="עוד "+(run.length-runMax)+" פריטים"; m.onclick=()=>{runMax=99; renderContractors();}; rn.appendChild(m); }
  // דגלים
  const fc=$("#conFlagCard"), ff=$("#conFlags"); ff.innerHTML="";
  const flags=[];
  if(K.undeclN) flags.push({b:K.undeclN+" ניפוקים נרשמו בלי מספר שולחנות",s:"הכמויות נכללות במלאי, אבל אי אפשר להשוות אותן לנורמה."});
  if(K.cartons.length) flags.push({b:K.cartons.length+" שורות קרטון בלי כמות ליחידות",s:K.cartons.map(c=>fmtN(c.qty)+" × "+shortName(c.item)+" ("+fmtD(c.ts)+")").join(" · ")+". כשתדע כמה בקרטון, עדכן את הניפוק."});
  const under=K.parts.filter(p=>p.dev!=null&&p.dev<-0.05);
  if(under.length) flags.push({b:under.map(p=>shortName(p.name)).join(", ")+": יוצא פחות מהנורמה",s:"או שחסר על השולחנות, או שה-BOM מנופח. בדיקה של שולחן גמור אחד עונה על זה."});
  fc.hidden=!flags.length; foldSum("flags",flags.length?flags.length+" נקודות":"");
  flags.forEach(f=>{ const d=document.createElement("div"); d.className="flag ret"; d.innerHTML='<div class="t"><b>'+esc(f.b)+'</b><span>'+esc(f.s)+'</span></div>'; ff.appendChild(d); });
  // דיווחי ביצוע
  const pg=$("#conProg"); pg.innerHTML="";
  const prog=(demoStock?[]:progress).slice().sort((a,b)=>b.ts-a.ts);
  if(!prog.length) pg.innerHTML='<div class="empty">עוד לא דווח ביצוע. הדיווח הראשון (קונסטרוקציה / פאנלים / אישור) הופך את «ניפוק מול ביצוע» למספר אמיתי.</div>';
  foldSum("prog",prog.length?prog.length+" דיווחים · אחרון "+(fmtDT(prog[0].dateText)||fmtD(prog[0].ts)):"אין עדיין");
  prog.slice(0,12).forEach(p=>{
    const el=document.createElement("div"); el.className="slip"; el.style.cursor="default";
    const st=stageOf(p);
    el.innerHTML='<b>'+fmtN(p.tables)+' שולחנות · <span style="color:'+(st==="ok"?"var(--sage)":st==="pan"?"var(--info)":"var(--amber)")+'">'+esc(stageLabel(st))+'</span>'+(p.who?' · '+esc(p.who):'')+(p.ttype?' · '+esc(typeLabel(p.ttype)):'')+'</b>'
      +'<button class="del" type="button" data-delprog="'+esc(p.id)+'">מחק</button>'
      +'<span>'+esc(fmtDT(p.dateText)||fmtD(p.ts))+(p.by?' · דיווח: '+esc(p.by):'')+(p.note?' · '+esc(p.note):'')+'</span>';
    pg.appendChild(el);
  });
}
$("#conProg").onclick=async e=>{
  const b=e.target.closest("[data-delprog]"); if(!b) return;
  if(!(await ask("למחוק את הדיווח הזה?"))) return;
  const id=b.dataset.delprog; const old=byId(progress,id);
  try{ if(DB) await DB.doc("progress/"+id).delete(); else { progress=progress.filter(p=>p.id!==id); ls.set("progress",JSON.stringify(progress)); renderOverview(); } }
  catch(err){ toast("המחיקה נכשלה."); return; }
  logAct("progress","delete","נמחק דיווח ביצוע"+(old?": "+fmtN(old.tables)+" שולחנות · "+(old.who||"")+" · "+(old.dateText||""):""),id,null,old);
};

/* ---- דיווח שולחנות שהושלמו ---- */
function openProgress(opt){
  const whos=[...new Set([...(demoStock?[]:issues).map(i=>i.who),...(demoStock?[]:progress).map(p=>p.who)].filter(Boolean))];
  let tables=5, ttype="", stage=opt&&opt.stage||"con";
  const today=new Date(); const iso=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="דיווח ביצוע">'
    +'<div class="grab"></div><h2>דיווח ביצוע</h2>'
    +'<div class="note-card">שלושה שלבים לכל שולחן: <b>קונסטרוקציה → פאנלים → אישור מפקח</b>. מדווחים כל שלב בנפרד, רק מה שנוסף מאז הדיווח הקודם.'+((demoStock?[]:progress).length?'':' <b>דיווח ראשון: המצב המצטבר עד היום.</b>')+'</div>'
    +'<div class="f"><label>שלב</label><div class="chips" id="pgStage" style="margin-bottom:0">'+STAGES.map(x=>'<button type="button" class="chip2" data-s="'+x[0]+'" aria-pressed="'+(x[0]===stage)+'">'+x[1]+'</button>').join("")+'</div><div class="hint" id="pgStageHint"></div></div>'
    +'<div class="f"><label>כמה שולחנות</label><div class="stepper">'
      +'<button type="button" id="pgMinus" aria-label="פחות">−</button>'
      +'<div class="val"><input type="text" inputmode="numeric" id="pgTables" value="'+tables+'" aria-label="מספר שולחנות"><small id="pgUnit">שולחנות</small></div>'
      +'<button type="button" id="pgPlus" aria-label="יותר">+</button></div></div>'
    +'<div class="f"><label>סוג שולחן (אם ידוע)</label><div class="chips" id="pgTypes" style="margin-bottom:0"><button type="button" class="chip2" data-t="" aria-pressed="true">מעורב / לא ידוע</button>'
      +kitTypes.map(t=>'<button type="button" class="chip2" data-t="'+t.id+'" aria-pressed="false">'+esc(t.label)+'</button>').join("")+'</div></div>'
    +'<div class="f"><label for="pgWho">קבלן</label><input type="text" id="pgWho" list="pgWhoList" placeholder="הקבלן (עאטף)" autocomplete="off" value="'+esc(whos[0]||"")+'">'
      +'<datalist id="pgWhoList">'+whos.map(w=>'<option value="'+esc(w)+'"></option>').join("")+'</datalist></div>'
    +'<div class="f"><label for="pgDate">תאריך</label><input type="date" id="pgDate" value="'+iso+'"></div>'
    +'<div class="f"><label for="pgBy">מי דיווח</label><input type="text" id="pgBy" placeholder="השם שלך" autocomplete="off" value="'+esc(ls.get("issuer")||"")+'"></div>'
    +'<div class="f"><label for="pgNote">הערה</label><input type="text" id="pgNote" placeholder="למשל: שדה 2 שורות 15–16"></div>'
    +'<div class="acts"><button class="save" id="pgSave" type="button">שמור דיווח</button><button class="cancel" id="pgCancel" type="button">ביטול</button></div></div>';
  document.body.appendChild(scrim);
  const q=s=>scrim.querySelector(s);
  const setT=n=>{ n=Math.max(1,Math.round(Number(n)||0)); tables=n; q("#pgTables").value=n; };
  q("#pgMinus").onclick=()=>setT(tables-1); q("#pgPlus").onclick=()=>setT(tables+1); q("#pgTables").onchange=e=>setT(e.target.value);
  q("#pgTypes").onclick=e=>{ const b=e.target.closest("[data-t]"); if(!b) return; ttype=b.dataset.t; scrim.querySelectorAll("#pgTypes .chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); };
  const stageHint=()=>{ const x=STAGES.find(y=>y[0]===stage); q("#pgStageHint").textContent=x[2]; q("#pgUnit").textContent=x[1]; };
  q("#pgStage").onclick=e=>{ const b=e.target.closest("[data-s]"); if(!b) return; stage=b.dataset.s; scrim.querySelectorAll("#pgStage .chip2").forEach(c=>c.setAttribute("aria-pressed",String(c===b))); stageHint(); };
  stageHint();
  q("#pgCancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  document.addEventListener("keydown",esck);
  q("#pgSave").onclick=async()=>{
    const who=q("#pgWho").value.trim();
    const by=q("#pgBy").value.trim(); if(!by){ toast("מי דיווח? צריך שם."); q("#pgBy").focus(); return; } ls.set("issuer",by);
    const dv=q("#pgDate").value; let ts=Date.now(), dateText=fmtD(ts);
    if(dv){ const d=new Date(dv+"T12:00:00"); if(!isNaN(d)){ ts=d.getTime(); dateText=fmtD(ts); } }
    const b=q("#pgSave"); b.disabled=true; b.textContent="שומר…";
    const id="pg"+Date.now();
    const doc={id,ts,dateText,who,tables,ttype,by,stage,note:q("#pgNote").value.trim(),source:"app"};
    try{ if(DB) await DB.doc("progress/"+id).set(doc); else { progress.push(doc); ls.set("progress",JSON.stringify(progress)); } }
    catch(e){ b.disabled=false; b.textContent="שמור דיווח"; toast("השמירה נכשלה."); return; }
    logAct("progress","add","דיווח ביצוע: "+fmtN(tables)+" שולחנות · "+stageLabel(stage)+(who?" · "+who:"")+(ttype?" · "+typeLabel(ttype):"")+" · "+dateText,id,by);
    if(demoStock){ demoStock=false; ls.set("demoDoneS","1"); }
    close(); renderOverview(); toast("הדיווח נשמר.");
  };
  function esck(ev){ if(ev.key==="Escape") close(); }
  function close(){ document.removeEventListener("keydown",esck); scrim.remove(); }
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}

/* ---- מחירים ל-₪ ---- */
function openPrices(){
  const scrim=document.createElement("div"); scrim.className="scrim";
  const pp=prices.parts||{};
  scrim.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-label="מחירים">'
    +'<div class="grab"></div><h2>מחירים לחישוב ₪</h2>'
    +'<div class="note-card">המחירים נשמרים באפליקציה בלבד ומשמשים רק להמרת הכמויות לשקלים בכרטיס «איפה הכסף». אפשר להשאיר ריק.</div>'
    +'<div class="kitrows">'
    +'<div class="pricerow"><div class="nm">בטון<small>₪ למ״ק, כולל הובלה</small></div><input type="text" inputmode="decimal" id="prC" value="'+(prices.concreteM3||"")+'" placeholder="₪"></div>'
    +'<div class="pricerow"><div class="nm">סולר<small>₪ לליטר</small></div><input type="text" inputmode="decimal" id="prD" value="'+(prices.dieselL||"")+'" placeholder="₪"></div>'
    +'<div class="pricerow"><div class="nm">פאנל<small>₪ ליחידה</small></div><input type="text" inputmode="decimal" id="prP" value="'+(prices.panel||"")+'" placeholder="₪"></div>'
    +kit.filter(k=>k.def!==false).map(k=>'<div class="pricerow"><div class="nm">'+esc(shortName(k.name))+'<small>₪ ליחידה · מק״ט '+esc(k.code)+'</small></div><input type="text" inputmode="decimal" data-code="'+esc(k.code)+'" value="'+(pp[k.code]||"")+'" placeholder="₪"></div>').join("")
    +'</div>'
    +'<div class="acts"><button class="save" id="prSave" type="button">שמור</button><button class="cancel" id="prCancel" type="button">ביטול</button></div></div>';
  document.body.appendChild(scrim);
  const q=s=>scrim.querySelector(s);
  q("#prCancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  q("#prSave").onclick=async()=>{
    const num=v=>{ const n=Number(String(v).replace(/[^\d.]/g,"")); return isFinite(n)&&n>0?n:0; };
    const parts={}; scrim.querySelectorAll("input[data-code]").forEach(i=>{ const v=num(i.value); if(v) parts[i.dataset.code]=v; });
    const doc={concreteM3:num(q("#prC").value),dieselL:num(q("#prD").value),panel:num(q("#prP").value),parts,ts:Date.now()};
    try{ if(DB) await DB.doc("settings/prices").set(doc); else { prices=doc; ls.set("prices",JSON.stringify(doc)); renderOverview(); } }
    catch(e){ toast("השמירה נכשלה."); return; }
    logAct("prices","edit","מחירים עודכנו · בטון "+(doc.concreteM3||"—")+" · סולר "+(doc.dieselL||"—")+" · פאנל "+(doc.panel||"—")+" · "+Object.keys(parts).length+" פריטי שלטר","settings/prices");
    scrim.remove(); toast("המחירים נשמרו.");
  };
  requestAnimationFrame(()=>{ const sh=q(".sheet"); if(sh) sh.scrollTop=0; const a=document.activeElement; if(a && scrim.contains(a)) a.blur(); });
}
$("#btnProgress").onclick=openProgress;
$("#btnIssue2").onclick=openIssue;
$("#btnKitEd").onclick=openKitEditor;
$("#btnPrices").onclick=openPrices;
if($("#ovGoCon")) $("#ovGoCon").onclick=()=>showTab("over");
if($("#ovGoCon2")) $("#ovGoCon2").onclick=()=>showTab("over");

