import { $, actorName, ask, blobUrl, closer, esc, fmtD, fmtDT, logAct, popup, shared, toast } from "./core.js";
import { fmtN, loadImg, shortSup } from "./01-stock.js";
import { SITE, saveFile } from "./08-settings.js";
import { canvasBlob } from "./09-doc-scanner.js";
import { isoOf, isoText } from "./11-daylog.js";
import { catalog } from "./13-purchasing.js";
import { contractActs, saveStatus, statusHolidays, workdaysBetween } from "./16-status.js";
import { ROLE, watch } from "./18-identity.js";
import { cableBalance, cableTypeLabel, drumOpen, drumRemain } from "./20-cables.js";
import { BLK_KINDS, DELAY_CAUSES, INSTRUCTORS, blockerAge, claimManDays, isClaim } from "./21-work.js";
export let DRONE, droneSub, wrRedraw, wrPct, wrRange, wrMonth, WR_CSS, wrDataUrl;
export function droneWatch(){ if(droneSub||!shared.DB) return; droneSub=true;
  try{ watch(shared.DB.collection("drone"),snap=>{ DRONE=snap.docs.map(d=>Object.assign({id:d.id},d.data())); if(wrRedraw) wrRedraw(); }); }catch(e){} }
export function wrData(endIso){
  const endT=new Date(endIso+"T23:59:59").getTime(), startT=endT-7*864e5+1000, startIso=isoOf(startT);
  const inW=t=>t>=startT&&t<=endT, hol=statusHolidays();
  const acts=contractActs().map(a=>{   // בלי סעיפי «מצב השטח» (ctx)
    const total=Number(a.total)||0; const daily=(a.daily||[]).filter(d=>d.date<=endIso&&Number(d.actual)).sort((x,y)=>x.date<y.date?-1:1);
    let cum=0, doneDate=""; daily.forEach(d=>{ cum+=Number(d.actual); if(!doneDate&&total&&cum>=total) doneDate=d.date; });
    const done=Math.min(total||cum,cum), week=daily.filter(d=>d.date>=startIso).reduce((s,d)=>s+Number(d.actual),0);
    const first=a.start||(daily[0]||{}).date||"", last=(daily[daily.length-1]||{}).date||"";
    // רישום שמשלים תקופה ארוכה משבוע (אין רישום בשבוע שלפניו): מציגים «מאז» הרישום הקודם ולא «השבוע»
    const wk=daily.filter(d=>d.date>=startIso), prev=(daily.filter(d=>d.date<startIso).pop()||{}).date||"";
    const weekLabel=wk.length&&prev&&prev<isoOf(new Date(wk[0].date+"T12:00:00").getTime()-7*864e5)?"מאז "+isoText(prev):"השבוע";
    const men=L=>L.reduce((s,d)=>s+(Number(d.workers)||0),0), all=(a.daily||[]).filter(d=>d.date<=endIso);
    const r={id:a.id,code:a.code||"",group:a.group||"",name:a.name,unit:a.unit||"",total,done,week,weekLabel,pct:total?done/total:0,first,last,doneDate,complete:!!total&&done>=total,started:done>0,planEnd:a.planEnd||"",
      manPlan:Number(a.manDays)||0,manDone:men(all),manWeek:men(all.filter(d=>d.date>=startIso))};
    r.manPct=r.manPlan?r.manDone/r.manPlan:null; r.burn=r.manPlan>0&&r.manDone>=2&&r.manPct-r.pct>0.15;   // שורף ימי עובד מהר מהביצוע
    if(r.planEnd&&first&&!r.complete){ const all=workdaysBetween(first,r.planEnd,hol), gone=workdaysBetween(first,endIso,hol);
      r.planPct=all?Math.min(1,gone/all):1; r.planLeft=Math.max(0,workdaysBetween(isoOf(endT+864e5),r.planEnd,hol)); r.planNeed=r.planLeft?Math.ceil((total-done)/r.planLeft):null;
      r.planGap=r.pct-r.planPct; }
    r.stale=r.started&&!r.complete&&(!last||last<isoOf(endT-7*864e5));
    return r; });
  const iss=shared.issues.filter(s=>s.ts<=endT), issW=iss.filter(s=>inW(s.ts));
  const notes=shared.deliveries.filter(n=>inW(n.ts)).slice().sort((a,b)=>a.ts-b.ts);
  const sup=new Map(); notes.forEach(n=>{ const k=shortSup(n.supplier)||"ספק לא ידוע"; sup.set(k,(sup.get(k)||0)+1); });
  const flags=[];
  // פרקים: אחוז הפרק משוקלל לפי ימי העובד שבהסכם (סעיף בלי ימי עובד נספר כ-1)
  const groups=[]; acts.forEach(a=>{ let g=groups.find(x=>x.name===a.group); if(!g){ g={name:a.group,acts:[],manPlan:0,manDone:0,manWeek:0}; groups.push(g); } g.acts.push(a); g.manPlan+=a.manPlan; g.manDone+=a.manDone; g.manWeek+=a.manWeek; });
  groups.forEach(g=>{ const w=g.acts.reduce((s,a)=>s+(a.manPlan||1),0); g.pct=w?g.acts.reduce((s,a)=>s+a.pct*(a.manPlan||1),0)/w:0; });
  acts.filter(a=>a.stale).forEach(a=>flags.push((a.code?a.code+" ":"")+a.name+": הסטטוס לא עודכן מאז "+(a.last?isoText(a.last):"—")+". המספרים בדוח נכונים לתאריך הזה."));
  const unsigned=issW.filter(s=>!(s.sigAsset||s.sigUrl||s.sigData)); if(unsigned.length) flags.push(unsigned.length+" ניפוקים השבוע בלי חתימה.");
  if(!acts.some(a=>a.planEnd)) flags.push("אין עדיין תאריכי יעד (גאנט), ולכן אין השוואה לתוכנית.");
  // לפי docs/templates/weekly-report.md: מאזן כבלים, מלאי קריטי, כוח אדם, חריגים
  const inD=iso=>iso>=startIso&&iso<=endIso;
  const dl=shared.daylog.filter(w=>inD(w.date)), dset=new Set(dl.map(w=>w.date)), sub=dl.filter(w=>w.contractor);
  const man={days:dset.size,manDays:dl.length,avg:dset.size?Math.round(dl.length/dset.size*10)/10:0,hours:dl.reduce((s,w)=>s+(Number(w.hours)||0),0),subDays:sub.length,subHours:sub.reduce((s,w)=>s+(Number(w.hours)||0),0)};
  const cables=cableBalance(), pulledW=(shared.pulls||[]).filter(p=>inD(p.date)).reduce((s,p)=>s+(Number(p.meters)||0),0), closedW=(shared.drums||[]).filter(d=>d.closedAt&&inW(d.closedAt));
  const crit=catalog().filter(e=>e.planned>0&&e.arrived<e.planned).map(e=>({name:e.name,unit:e.unit,planned:e.planned,arrived:e.arrived,pct:e.arrived/e.planned})).sort((a,b)=>a.pct-b.pct).slice(0,8);
  const lowDrums=(shared.drums||[]).filter(d=>drumOpen(d)&&d.lengthIn&&drumRemain(d)<Math.max(50,d.lengthIn*0.1));
  const B=shared.blockers||[], claimsW=B.filter(b=>isClaim(b)&&inD(b.date||isoOf(b.ts))).sort((a,b)=>(a.date||"")<(b.date||"")?-1:1), lostW=Math.round(claimsW.filter(b=>b.kind==="delay").reduce((s,b)=>s+claimManDays(b),0)*10)/10;
  const burnList=acts.filter(a=>a.burn).sort((a,b)=>(b.manPct-b.pct)-(a.manPct-a.pct));
  if(lostW) flags.push(fmtN(lostW)+" ימי עובד אבדו השבוע בעיכובים שאינם באחריותנו. לוודא שהם בחשבון החלקי.");
  const blkOpen=B.filter(b=>b.status!=="closed"&&!isClaim(b)&&(b.date||isoOf(b.ts))<=endIso).sort((a,b)=>(a.date||"")<(b.date||"")?-1:1), blkClosed=B.filter(b=>b.status==="closed"&&b.closedAt&&inW(b.closedAt));
  const workN=contractActs().reduce((s,a)=>s+(a.daily||[]).filter(d=>inD(d.date)&&Number(d.actual)).length,0);
  const manAct={plan:acts.reduce((s,a)=>s+a.manPlan,0),done:acts.reduce((s,a)=>s+a.manDone,0),week:acts.reduce((s,a)=>s+a.manWeek,0)};
  return {endIso,startIso,acts,groups,manAct,claimsW,lostW,burnList,iss:{n:iss.length,wn:issW.length,list:issW},notes,sup,flags,hasPlan:acts.some(a=>a.planEnd),man,cables,pulledW,closedW,crit,lowDrums,blkOpen,blkClosed,workN};
}
export function wrHtml(mode,D,o){
  o=o||{}; const C=mode==="client", e=esc, N=v=>'<span class="n">'+fmtN(v)+'</span>', NP=v=>'<span class="n">+'+fmtN(v)+'</span>', P=x=>'<span class="n">'+wrPct(x)+'%</span>';
  const P1=(x,plus)=>{ const v=Math.round(x*1000)/10; return '<span class="n">'+(plus?'+':'')+(v>0&&v<1?"<1":Math.round(v))+'%</span>'; };
  const col=a=>a.complete?"#9AC339":a.planGap!=null?(a.planGap<-0.05?"#E40033":a.planGap<0?"#FFAA00":"#9AC339"):a.started?"#3199CC":"#D9DADA";
  const site=SITE.name||"האתר", gen=fmtD(Date.now())+"."+new Date().getFullYear();
  let h='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>'+e("דוח שבועי · "+site+" · "+wrRange(D.startIso,D.endIso))+'</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&family=Heebo:wght@400;700&display=swap"><style>'+WR_CSS+'</style></head><body><div class="pg">';
  h+='<div class="hd"><div><div class="brand">'+e(SITE.company||"S.E.E")+'</div><h1>'+e(site)+' · דוח סטטוס שבועי</h1><div class="sub">שבוע <span class="n">'+e(wrRange(D.startIso,D.endIso))+'</span> · הופק <span class="n">'+e(gen)+'</span></div></div>'
    +'<div class="tag'+(C?' c':'')+'">'+(C?'עדכון ליזם':'למנהלים · פנימי')+'</div></div>';
  if(o.lead) h+='<div class="lead">'+e(o.lead)+'</div>';
  const tile=(v,k)=>'<div class="tile"><b>'+v+'</b><span>'+e(k)+'</span></div>';
  const act3=D.acts.filter(a=>!a.complete&&a.started).slice(0,4);
  if(C){ if(act3.length) h+='<div class="tiles">'+act3.map(a=>tile(P(a.pct),a.name)).join("")+'</div>'; }
  else h+='<div class="tiles">'+tile(N(D.acts.filter(a=>a.started&&!a.complete).length),'פעילויות בביצוע')+tile(N(D.acts.filter(a=>a.complete).length),'פעילויות שהושלמו')
    +tile(N(D.man.manDays),'ימי עובד השבוע')+tile('<span class="n"'+(D.blkOpen.length?' style="color:#B30027"':'')+'>'+fmtN(D.blkOpen.length)+'</span>','חריגים פתוחים')+'</div>';
  const fig=(src,cap)=>'<figure class="ph"><img src="'+e(src)+'" alt="תמונת רחפן של האתר"><figcaption>'+cap+'</figcaption></figure>', dt=x=>'<span class="n">'+e(isoText(x))+'</span>';
  if(o.img||!C) h+='<h3>האתר מהאוויר</h3>'+(!o.img?'<div class="empty">כאן תופיע תמונת הרחפן השבועית. מעלים אותה בחלון «דוח שבועי» באפליקציה.</div>'
    :o.prev?'<div class="cmp">'+fig(o.prev,'אז · '+dt(o.prevDate))+fig(o.img,'עכשיו · '+dt(o.imgDate))+'</div>'
    :fig(o.img,'תמונת רחפן · '+dt(o.imgDate)+(o.imgDate<D.startIso?' · הצילום האחרון':'')));
  h+='<h3>התקדמות לפי סעיף</h3>';
  if(!D.acts.length) h+='<div class="empty">אין עדיין סטטוס התקדמות באפליקציה.</div>';
  const lab=a=>(a.code?'<span class="code">'+e(a.code)+'</span>':'')+e(a.name), plain=a=>(a.code?a.code+' ':'')+a.name;
  const actRow=a=>'<div class="act"><div class="t"><span>'+lab(a)+'</span><span>'+P(a.pct)+'</span></div>'
    +'<div class="bar"><i style="width:'+wrPct(a.pct)+'%;background:'+col(a)+'"></i>'+(a.planPct!=null?'<u style="right:'+wrPct(a.planPct)+'%" title="לפי התוכנית"></u>':'')+'</div><small>'
    +(C?(a.complete?'הושלם'+(a.doneDate?' · '+e(wrMonth(a.doneDate)):''):a.started?(a.week&&a.total?P1(a.week/a.total,1)+' '+e(a.weekLabel):'בביצוע'):'טרם החל')
      :(a.complete?'הושלם'+(a.doneDate?' ב-'+e(isoText(a.doneDate)):'')+' · '+N(a.total)+' '+e(a.unit):N(a.done)+' / '+N(a.total)+' '+e(a.unit)+(a.week?' · <b>'+NP(a.week)+'</b> '+e(a.weekLabel):' · אין התקדמות השבוע')+(a.last?' · עדכון אחרון '+e(isoText(a.last)):''))
        +(a.manPlan?' · ימי עובד '+N(a.manDone)+' / '+N(a.manPlan)+(a.manWeek?' (<b>'+NP(a.manWeek)+'</b> השבוע)':''):''))
    +'</small></div>';
  // סעיפי ההסכם מקובצים לפי פרק; סעיפים שטרם החלו נספרים בשורה אחת כדי שהדוח יישאר דף אחד
  D.groups.forEach(g=>{ const open=g.acts.filter(a=>a.started||a.complete), idle=g.acts.filter(a=>!a.started&&!a.complete);
    if(g.name) h+='<div class="grp"><span>'+e(g.name)+'</span><span>'+P(g.pct)+(g.manPlan&&!C?' · ימי עובד '+N(g.manDone)+' / '+N(g.manPlan):'')+'</span></div>';
    open.forEach(a=>h+=actRow(a));
    if(idle.length) h+='<p class="idle">'+(open.length?'ועוד ':'')+N(idle.length)+' סעיפים טרם החלו'+(C||idle.length>4?'':': '+idle.map(a=>e(plain(a))).join(', '))+'</p>'; });
  if(!C||D.hasPlan) h+='<h3>מול התוכנית</h3>';
  if(!D.hasPlan){ if(!C) h+='<div class="empty">יתמלא כשיוזן לוח הזמנים (גאנט) של הפרויקט. כרגע לא הוזנו תאריכי יעד, ולכן אין כאן השוואה לתוכנית.</div>'; }
  else h+='<table><tr><th>פעילות</th><th>תאריך יעד</th><th>בפועל מול התוכנית</th>'+(C?'':'<th>נדרש ליום</th>')+'</tr>'+D.acts.filter(a=>a.planEnd).map(a=>'<tr><td>'+lab(a)+'</td><td class="n">'+e(isoText(a.planEnd))+'</td><td>'
    +(a.complete?'הושלם':a.planGap==null?'טרם החל':(a.planGap>=0?'<b style="color:#4F7F0B">לפני התוכנית</b> · ':'<b style="color:'+(a.planGap<-0.05?'#B30027':'#B87400')+'">מאחר</b> · ')+P(a.pct)+' בפועל, '+P(a.planPct)+' מתוכנן')+'</td>'
    +(C?'':'<td>'+(a.complete||a.planGap==null?'—':a.planNeed==null?'<b style="color:#B30027">עבר היעד</b>':N(a.planNeed))+'</td>')+'</tr>').join("")+'</table>';
  const ms=D.acts, idle=ms.filter(a=>!a.started&&!a.complete), idleShow=idle.filter(a=>a.planEnd).concat(idle.filter(a=>!a.planEnd).slice(0,5));
  if(!C||D.hasPlan) h+='<h3>אבני דרך</h3><ul class="ms">'
    +ms.filter(a=>a.complete).map(a=>'<li><i style="background:#9AC339"></i><span><b>'+lab(a)+'</b> · הושלם'+(a.doneDate?' '+e(C?wrMonth(a.doneDate):isoText(a.doneDate)):'')+'</span></li>').join("")
    +ms.filter(a=>!a.complete&&a.started).map(a=>'<li><i style="background:#3199CC"></i><span><b>'+lab(a)+'</b> · בביצוע, '+P(a.pct)+(a.planEnd?' · יעד '+e(isoText(a.planEnd)):'')+'</span></li>').join("")
    +idleShow.map(a=>'<li><i style="background:#D9DADA"></i><span><b>'+lab(a)+'</b> · '+(a.planEnd?'יעד '+e(isoText(a.planEnd)):'הבא בתור')+'</span></li>').join("")
    +(idle.length>idleShow.length?'<li><i style="background:#D9DADA"></i><span>ועוד '+N(idle.length-idleShow.length)+' סעיפים טרם החלו</span></li>':'')+'</ul>';
  if(!C){
    h+='<h3>מאזן כבלים</h3>'+(!D.cables.length?'<div class="empty">אין עדיין תופים או סוגי כבלים באפליקציה.</div>'
      :'<table><tr><th>סוג כבל</th><th>מתוכנן</th><th>הגיע</th><th>נמשך</th><th>במלאי</th><th>נותר למשוך</th><th>לא מוסבר</th></tr>'+D.cables.map(c=>'<tr><td>'+e(c.desc)+'</td><td class="n">'+(c.planned?fmtN(c.planned):"—")+'</td><td class="n">'+fmtN(c.arrived)+'</td><td class="n">'+fmtN(c.pulled)+'</td><td class="n">'+fmtN(c.stock)+'</td><td class="n">'+(c.planned?fmtN(c.left):"—")+'</td><td class="n"'+(c.unexplained?' style="color:#B30027;font-weight:700"':'')+'>'+(c.unexplained?fmtN(c.unexplained):"—")+'</td></tr>').join("")+'</table>'
      +'<p class="sm">מטרים. השבוע נמשכו '+N(D.pulledW)+' מ׳'+(D.closedW.length?' · נסגרו '+N(D.closedW.length)+' תופים':'')+'. «לא מוסבר» = שארית בתופים שנסגרו ריקים, כנראה משיכות שלא נרשמו.</p>');
    h+='<h3>מלאי קריטי</h3>'+(!shared.boq.length?'<div class="empty">יתמלא כשייובא כתב הכמויות: סעיפים שעוד לא הגיעו במלואם.</div>':!D.crit.length&&!D.lowDrums.length?'<div class="empty">כל סעיפי כתב הכמויות הגיעו במלואם.</div>'
      :'<table><tr><th>פריט</th><th>הגיע / מתוכנן</th><th></th></tr>'+D.crit.map(c=>'<tr><td>'+e(c.name)+'</td><td class="n">'+fmtN(c.arrived)+' / '+fmtN(c.planned)+' '+e(c.unit||"")+'</td><td class="n"'+(c.pct<0.5?' style="color:#B30027;font-weight:700"':'')+'>'+Math.round(c.pct*100)+'%</td></tr>').join("")
      +D.lowDrums.map(d=>'<tr><td>תוף '+e(d.drumNo)+' · '+e(cableTypeLabel(d.cableType))+'</td><td class="n">נשארו '+fmtN(drumRemain(d))+' מ׳</td><td style="color:#B87400;font-weight:700">עומד להיגמר</td></tr>').join("")+'</table>');
    h+='<h3>כוח אדם</h3>'+(!D.man.manDays?'<div class="empty">לא נרשמו עובדים השבוע בלשונית «עובדים».</div>'
      :'<div class="tiles">'+tile(N(D.man.days),'ימי עבודה')+tile(N(D.man.avg),'ממוצע עובדים ליום')+tile(N(D.man.manDays),'ימי עובד')+tile(N(D.man.subDays),'ימי עובד קבלן משנה')+'</div>'
      +(D.manAct.plan?'<p class="sm">ימי עובד שדווחו על סעיפי ההסכם: '+N(D.manAct.done)+' מתוך '+N(D.manAct.plan)+' בהסכם'+(D.manAct.week?' · השבוע '+NP(D.manAct.week):'')+'.</p>':'')+(D.man.hours?'<p class="sm">שעות שנרשמו: '+N(D.man.hours)+(D.man.subHours?' · מזה קבלן משנה: '+N(D.man.subHours):'')+'. '+N(D.workN)+' דיווחי ביצוע השבוע.</p>':'<p class="sm">'+N(D.workN)+' דיווחי ביצוע השבוע.</p>'));
    // הכסף: סעיפים ששורפים ימי עובד, ועבודות נוספות / עיכובים שנכנסים לחשבון
    if(D.acts.some(a=>a.manPlan)) h+='<h3>איפה הולכים ימי העובד</h3>'+(D.burnList.length?'<table><tr><th>סעיף</th><th>ימי עובד בפועל / בהסכם</th><th>% מהתקציב</th><th>% ביצוע</th></tr>'
      +D.burnList.slice(0,8).map(a=>'<tr><td>'+lab(a)+'</td><td class="n">'+fmtN(a.manDone)+' / '+fmtN(a.manPlan)+'</td><td class="n" style="color:#B30027;font-weight:700">'+Math.round(a.manPct*100)+'%</td><td class="n">'+Math.round(a.pct*100)+'%</td></tr>').join("")+'</table><p class="sm">סעיפים שצרכו חלק גדול יותר מימי העובד שבהסכם מאשר מהכמות. שם הרווח נשחק: לבדוק צוות, שיטה או תמחור.</p>'
      :'<div class="empty">אין סעיף ששורף ימי עובד מעבר לקצב הביצוע.</div>');
    h+='<h3>עבודות נוספות ועיכובים השבוע</h3>'+(!D.claimsW.length?'<div class="empty">לא נרשמו השבוע. עבודה נוספת או המתנה שלא באשמתנו נרשמות ב«+ חריג» ונכנסות לחשבון החלקי.</div>'
      :'<table><tr><th>תאריך</th><th>סוג</th><th>מה</th><th>אזור</th><th>מי / סיבה</th><th>ימי עובד</th></tr>'+D.claimsW.map(b=>'<tr><td class="n">'+e(isoText(b.date||isoOf(b.ts)))+'</td><td>'+(b.kind==="extra"?'נוספת':'עיכוב')+'</td><td>'+e(b.text)+(b.qty?' · '+e(b.qty):'')+'</td><td>'+e(b.area||"")+'</td><td>'+e(b.kind==="extra"?(INSTRUCTORS[b.instructedBy]||""):(DELAY_CAUSES[b.cause]||""))+'</td><td class="n">'+(claimManDays(b)?fmtN(claimManDays(b)):'—')+'</td></tr>').join("")+'</table>'
      +(D.lostW?'<p class="sm">ימי עובד שאבדו בעיכובים: <b>'+fmtN(D.lostW)+'</b>.</p>':''));
    if(D.iss.list.length) h+='<h3>ניפוקים השבוע</h3><table><tr><th>תאריך</th><th>למי</th><th>מה נופק</th><th>חתימה</th></tr>'+D.iss.list.slice().sort((a,b)=>a.ts-b.ts).map(s=>{ const L=s.lines||[]; return '<tr><td class="n">'+e(fmtD(s.ts))+'</td><td>'+e(s.who||"")+'</td><td>'
      +L.slice(0,2).map(l=>e(String(l.name||"").slice(0,40))+' · '+N(Number(l.qty)||0)).join("<br>")+(L.length>2?'<br><small>ועוד '+(L.length-2)+'</small>':'')+'</td><td>'+((s.sigAsset||s.sigUrl||s.sigData)?'כן':'<b style="color:#B30027">חסרה</b>')+'</td></tr>'; }).join("")+'</table>';
    h+='<h3>תעודות משלוח שהתקבלו השבוע</h3>'+(!D.notes.length?'<div class="empty">לא נקלטו תעודות משלוח השבוע.</div>'
      :'<table><tr><th>תאריך</th><th>ספק</th><th>תעודה</th><th>מה הגיע</th></tr>'+D.notes.slice(-14).map(n=>{ const L=n.lines||[]; return '<tr><td class="n">'+e(n.dateText?fmtDT(n.dateText):fmtD(n.ts))+'</td><td>'+e(shortSup(n.supplier))+'</td><td class="n">'+e(n.noteNo||"")+'</td><td>'
        +L.slice(0,2).map(l=>e(String(l.name||"").slice(0,48))+' · '+N(Number(l.qty)||0)+' '+e(l.unit||"")).join("<br>")+(L.length>2?'<br><small>ועוד '+(L.length-2)+' שורות</small>':'')+'</td></tr>'; }).join("")+'</table>'
        +(D.notes.length>14?'<p style="font-size:.8rem;color:#666B6E">מוצגות 14 האחרונות מתוך '+D.notes.length+'.</p>':''));
    h+='<h3>בעיות והחלטות נדרשות</h3>'+(D.blkOpen.length?'<table><tr><th>חריג</th><th>סוג</th><th>אזור</th><th>פתוח</th></tr>'+D.blkOpen.map(b=>'<tr><td>'+e(b.text)+'</td><td>'+e(BLK_KINDS[b.kind]||"")+'</td><td>'+e(b.area||"")+'</td><td class="n"'+(blockerAge(b,D.endIso)>3?' style="color:#B30027;font-weight:700"':'')+'>'+blockerAge(b,D.endIso)+' ימים</td></tr>').join("")+'</table>':'<div class="empty">אין חריגים פתוחים.</div>')
      +(D.blkClosed.length?'<p class="sm">נסגרו השבוע: '+D.blkClosed.map(b=>e(b.text)).join(" · ")+'</p>':'')
      +(D.flags.length?'<ul class="flags">'+D.flags.map(f=>'<li>'+e(f)+'</li>').join("")+'</ul>':'');
  }
  h+='<div class="ft"><span>'+(C?e(SITE.company||"S.E.E")+' · '+e(site):'נוצר אוטומטית מיומן חשמל · מסמך פנימי, לא להעביר')+'</span><span>נתונים נכון ל-<span class="n">'+e(isoText(D.endIso))+'</span></span></div></div></body></html>';
  return h;
}
export function wrText(mode,D,o){
  const C=mode==="client", site=SITE.name||"האתר"; const L=[];
  L.push((C?"עדכון שבועי · ":"דוח סטטוס שבועי · ")+site+" · "+wrRange(D.startIso,D.endIso)); L.push("");
  if(o&&o.lead) { L.push(o.lead); L.push(""); }
  const nm=a=>(a.code?a.code+" ":"")+a.name;
  D.acts.filter(a=>!a.complete&&a.started).forEach(a=>L.push(nm(a)+": "+wrPct(a.pct)+"%"+(!C&&a.week?" · +"+fmtN(a.week)+" "+a.weekLabel:"")+(!C&&a.manPlan?" · ימי עובד "+fmtN(a.manDone)+"/"+fmtN(a.manPlan):"")));
  const dn=D.acts.filter(a=>a.complete).map(nm); if(dn.length) L.push("הושלמו: "+dn.join(", "));
  if(!C){ L.push(""); L.push("השבוע: "+D.workN+" דיווחי ביצוע · "+D.iss.wn+" ניפוקים · "+D.notes.length+" תעודות משלוח");
    if(D.man.manDays) L.push("כוח אדם: "+D.man.days+" ימי עבודה · ממוצע "+D.man.avg+" עובדים ליום"+(D.man.subDays?" · "+D.man.subDays+" ימי עובד קבלן משנה":""));
    if(D.pulledW) L.push("כבלים: נמשכו "+fmtN(D.pulledW)+" מ׳ השבוע");
    if(D.burnList.length) L.push("שורפים ימי עובד: "+D.burnList.slice(0,4).map(a=>nm(a)+" "+Math.round(a.manPct*100)+"% מימי העובד מול "+Math.round(a.pct*100)+"% ביצוע").join(" · "));
    if(D.claimsW.length) L.push("עבודות נוספות / עיכובים השבוע: "+D.claimsW.length+(D.lostW?" · "+fmtN(D.lostW)+" ימי עובד אבדו":""));
    if(D.blkOpen.length){ L.push(""); L.push("חריגים פתוחים:"); D.blkOpen.slice(0,8).forEach(b=>L.push("• "+b.text+(b.area?" ("+b.area+")":""))); }
    if(D.flags.length){ L.push(""); L.push("פתוח לטיפול:"); D.flags.forEach(f=>L.push("• "+f)); } }
  L.push(""); L.push("הדוח המלא מצורף."); return L.join("\n");
}
export async function wrShrink(file){ const im=await loadImg(file); const k=Math.min(1,2000/Math.max(im.naturalWidth,im.naturalHeight));
  const c=document.createElement("canvas"); c.width=Math.round(im.naturalWidth*k); c.height=Math.round(im.naturalHeight*k); c.getContext("2d").drawImage(im,0,0,c.width,c.height); return canvasBlob(c,0.82); }
export function openWeekly(){
  droneWatch(); let mode="mgr", endIso=isoOf(Date.now()), lead="", localImg=null;
  const scrim=popup('<div class="sheet wr-sheet" role="dialog" aria-modal="true" aria-label="דוח שבועי"><div class="grab"></div><h2>דוח שבועי</h2>'
    +'<div class="note-card">דף אחד שנבנה לבד מהנתונים באפליקציה: התקדמות מול תכנון, מאזן כבלים, מלאי קריטי, כוח אדם, תעודות וחריגים. «ליזם» רק אחוזים ואבני דרך, בלי ספקים וכמויות.</div>'
    +'<div class="chips" id="wrMode"><button type="button" class="chip2" data-m="mgr" aria-pressed="true">למנהלים</button><button type="button" class="chip2" data-m="client" aria-pressed="false">ליזם</button></div>'
    +'<div class="f"><label for="wrEnd">השבוע שמסתיים ב-</label><input type="date" id="wrEnd" value="'+endIso+'"></div>'
    +'<div class="f" id="wrDrone"></div>'
    +'<div class="f"><label for="wrLead">משפט פתיחה (לא חובה)</label><input type="text" id="wrLead" maxlength="200" placeholder="למשל: השבוע הושלמה משיכת הכבלים בשדה 2"></div>'
    +(ROLE==="owner"?'<details class="wr-plan"><summary>תאריכי יעד מול הגאנט</summary><div class="note">כשיש לוח זמנים מהפרויקט: תאריך סיום מתוכנן לכל פעילות. בלי תאריך, השורה «מול התוכנית» נשארת ריקה.</div><div id="wrPlan"></div><button class="ghost" id="wrPlanSave" type="button" style="width:100%;margin-top:8px">שמור תאריכי יעד</button></details>':'')
    +'<iframe class="wr-frame" id="wrFrame" title="תצוגת הדוח"></iframe>'
    +'<div class="acts"><button class="save" id="wrDl" type="button">הורדת הדוח</button><button class="ghost" id="wrPrint" type="button">הדפסה</button></div>'
    +'<div class="acts" style="margin-top:8px"><button class="ghost" id="wrMail" type="button">העתק טקסט למייל</button><button class="cancel" type="button">סגור</button></div></div>'); const q=s=>scrim.querySelector(s);
  const close=closer(scrim,()=>{ wrRedraw=null; }); q(".cancel").onclick=close;
  // התמונה האחרונה עד סוף השבוע, ולהשוואה הצילום הראשון שקדם לה בחודש לפחות
  const shots=()=>DRONE.map(d=>({src:d.asset?blobUrl(d.asset):d.url,date:d.date})).concat(localImg?[localImg]:[]).filter(x=>x.date&&x.date<=endIso).sort((a,b)=>a.date<b.date?-1:1);
  const photo=()=>{ const L=shots(); return L[L.length-1]||null; };
  const prevShot=p=>p?shots().find(x=>x.date<=isoOf(new Date(p.date+"T12:00:00").getTime()-28*864e5))||null:null;
  const imgOpts=(p,pv)=>({img:p&&p.src,imgDate:p&&p.date,prev:pv&&pv.src,prevDate:pv&&pv.date,lead});
  const drawDrone=()=>{ const p=photo(), can=ROLE!=="viewer";
    q("#wrDrone").innerHTML='<label>תמונת רחפן</label>'+(p?'<div class="wr-thumb"><img src="'+esc(p.src)+'" alt=""><span>בדוח: צילום מ-'+esc(isoText(p.date))+(prevShot(p)?' · להשוואה: '+esc(isoText(prevShot(p).date)):'')+'</span></div>':'<div class="note">אין עדיין תמונה עד התאריך הזה.</div>')
      +(can?'<div class="wr-prow"><span>תאריך הצילום</span><input type="date" id="wrImgDate" value="'+endIso+'"></div><div class="pick">העלאת תמונת רחפן<small>תמונה אחת לכל תאריך צילום · הדוח מציג את האחרונה ומשווה לצילום מלפני חודש ומעלה</small><input type="file" id="wrImg" accept="image/*"></div>':'');
    const f=q("#wrImg"); if(f) f.onchange=async ev=>{ const file=ev.target.files&&ev.target.files[0]; if(!file) return; toast("מעלה תמונה…");
      try{ const bl=await wrShrink(file); if(shared.ASSETS&&shared.DB){ const a=await shared.ASSETS.upload(bl); const date=q("#wrImgDate").value||endIso; const doc={id:"dr_"+date,date,asset:a.id,url:a.url,ts:Date.now(),by:actorName()};
          await shared.DB.doc("drone/"+doc.id).set(doc); DRONE=DRONE.filter(x=>x.id!==doc.id).concat(doc); logAct("progress","add","תמונת רחפן מ-"+isoText(date),doc.id); toast("התמונה נשמרה."); }
        else { localImg={src:URL.createObjectURL(bl),date:q("#wrImgDate").value||endIso,blob:bl}; toast("התמונה נכנסה לדוח (לא נשמרה, אין חיבור למאגר)."); } }catch(e){ toast("ההעלאה נכשלה."); }
      draw(); }; };
  const drawPlan=()=>{ const el=q("#wrPlan"); if(!el) return; const A=contractActs();
    el.innerHTML=A.length?A.map(a=>'<div class="wr-prow"><span>'+esc(a.name)+'</span><input type="date" data-id="'+esc(a.id)+'" value="'+esc(a.planEnd||"")+'"></div>').join(""):'<div class="note">אין פעילויות בסטטוס.</div>'; };
  const draw=()=>{ const D=wrData(endIso), p=photo(); q("#wrFrame").srcdoc=wrHtml(mode,D,imgOpts(p,prevShot(p))); drawDrone(); };
  wrRedraw=draw;
  scrim.querySelectorAll("#wrMode [data-m]").forEach(b=>b.onclick=()=>{ mode=b.dataset.m; scrim.querySelectorAll("#wrMode [data-m]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); draw(); });
  q("#wrEnd").onchange=ev=>{ if(ev.target.value){ endIso=ev.target.value; draw(); } };
  let lt=null; q("#wrLead").oninput=ev=>{ lead=ev.target.value.trim(); clearTimeout(lt); lt=setTimeout(draw,400); };
  const ps=q("#wrPlanSave"); if(ps) ps.onclick=async()=>{ ps.disabled=true; let n=0;
    for(const inp of scrim.querySelectorAll("#wrPlan input[data-id]")){ const a=shared.STATUS.find(x=>x.id===inp.dataset.id); if(!a||(a.planEnd||"")===inp.value) continue;
      if(await saveStatus({...a,planEnd:inp.value,updated:Date.now()})){ n++; logAct("progress","edit","תאריך יעד "+a.name+": "+(inp.value?isoText(inp.value):"נמחק"),a.id); } }
    ps.disabled=false; toast(n?"נשמרו "+n+" תאריכי יעד.":"לא היה שינוי."); draw(); };
  q("#wrDl").onclick=async()=>{ const b=q("#wrDl"); b.disabled=true; const D=wrData(endIso), p=photo(), pv=prevShot(p); const emb=async x=>x?{...x,src:await wrDataUrl(x.blob||await (await fetch(x.src)).blob())}:null; let ep=null, epv=null;
    try{ ep=await emb(p); epv=await emb(pv); }catch(e){ toast("התמונה לא נכנסה לקובץ."); }
    const name="דוח-שבועי-"+(mode==="client"?"יזם":"מנהלים")+"-"+(SITE.name||"אתר").replace(/\s+/g,"-")+"-"+endIso+".html";
    if(await saveFile(name,new Blob([wrHtml(mode,D,imgOpts(ep,ep&&epv))],{type:"text/html"}))) logAct("progress","add","דוח שבועי "+(mode==="client"?"ליזם":"למנהלים")+" · "+wrRange(D.startIso,D.endIso),"weekly");
    b.disabled=false; };
  q("#wrPrint").onclick=()=>{ try{ q("#wrFrame").contentWindow.print(); }catch(e){ toast("ההדפסה לא זמינה כאן. הורד את הקובץ והדפס ממנו."); } };
  q("#wrMail").onclick=async()=>{ const t=wrText(mode,wrData(endIso),{lead}); try{ await navigator.clipboard.writeText(t); toast("הטקסט הועתק. להדביק במייל ולצרף את הקובץ."); }catch(e){ await ask("העתק את הטקסט למייל","סגור","var(--ink)",t); } };
  drawPlan(); draw();
}
export function __init(){
/* ================= דוח שבועי: דף אחד למנהלים / ליזם, נבנה מהנתונים שכבר באפליקציה =================
   מקורות (docs/templates/weekly-report.md): סטטוס התקדמות ודיווחי ביצוע, מאזן כבלים (תופים ומשיכות), מלאי קריטי (כתב כמויות מול תעודות),
   כוח אדם (רישום העובדים), ניפוקים, תעודות משלוח, חריגים.
   ליזם: אחוזים, אבני דרך ותמונה בלבד. בלי ספקים, נהגים, קבלנים, מחירים וכמויות קטנות. הערות מתעודות לא נכנסות לאף גרסה. */
DRONE = [];
droneSub = false;
wrRedraw = null;
wrPct = x=>Math.round(Math.max(0,Math.min(1,x))*100);
wrRange = (a,b)=>{ const [ya,ma,da]=a.split("-"), [yb,mb,db]=b.split("-"); return (+da)+"."+(+ma)+(ya!==yb?"."+ya:"")+"–"+(+db)+"."+(+mb)+"."+yb; };
wrMonth = iso=>{ const m=String(iso||"").match(/^(\d{4})-(\d\d)/); return m?["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"][+m[2]-1]+" "+m[1]:""; };
WR_CSS = '*{box-sizing:border-box}body{margin:0;background:#F2F2F2;color:#121212;font-family:"Alef","Heebo",Arial,sans-serif;font-size:15px;line-height:1.5;direction:rtl}'
 +'.pg{max-width:780px;margin:0 auto;background:#fff;padding:28px 24px 22px;border-top:6px solid #F2B03D}'
 +'.n{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}'
 +'.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #D9DADA;padding-bottom:14px}'
 +'.brand{color:#1F5E8C;font-weight:700;letter-spacing:.16em;font-size:.8rem}.hd h1{margin:4px 0 2px;font-size:1.55rem;line-height:1.2}.hd .sub{color:#666B6E;font-size:.9rem}'
 +'.tag{flex:none;border:1px solid #121212;border-radius:99px;padding:3px 12px;font-size:.78rem;font-weight:700;white-space:nowrap}.tag.c{border-color:#4F7F0B;color:#4F7F0B}'
 +'.hero{display:flex;gap:20px;align-items:center;margin:20px 0 6px}.ring{flex:none;width:132px;height:132px;border-radius:50%;display:grid;place-items:center}'
 +'.ring i{width:104px;height:104px;border-radius:50%;background:#fff;display:grid;place-items:center;font-style:normal;font-size:1.9rem;font-weight:700}'
 +'.hero h2{margin:0;font-size:1.25rem}.hero p{margin:4px 0 0;color:#3F4447}.lead{margin:12px 0 0;padding:10px 14px;background:#EEF5DE;border-radius:6px;font-weight:700}'
 +'.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.tile{border:1px solid #D9DADA;border-radius:6px;padding:10px}'
 +'.tile b{display:block;font-size:1.6rem;line-height:1.2}.tile>span{font-size:.8rem;color:#666B6E}'
 +'h3{margin:22px 0 8px;font-size:1.05rem;border-right:4px solid #F2B03D;padding-right:8px}'
 +'.cmp{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ph{margin:0;border-radius:6px;overflow:hidden;background:#ECEDED}.ph img{display:block;width:100%;height:auto}.ph figcaption{padding:6px 10px;font-size:.82rem;color:#3F4447;background:#ECEDED}'
 +'.empty{border:2px dashed #D9DADA;border-radius:6px;padding:16px;text-align:center;color:#666B6E;font-size:.9rem}'
 +'.act{padding:8px 0;border-bottom:1px solid #ECEDED;break-inside:avoid}.act .t{display:flex;justify-content:space-between;gap:10px;font-weight:700}'
 +'.code{display:inline-block;font-size:.78rem;font-weight:700;color:#1F5E8C;background:#E6EEF5;border-radius:5px;padding:0 6px;margin-inline-end:6px;vertical-align:1px}'
 +'.grp{display:flex;justify-content:space-between;gap:10px;margin:14px 0 2px;padding:4px 0;border-bottom:2px solid #1F5E8C;font-weight:700;color:#1F5E8C;break-after:avoid}.idle{font-size:.82rem;color:#666B6E;margin:4px 0 0}'
 +'.bar{height:9px;border-radius:5px;background:#ECEDED;margin:6px 0 3px;overflow:hidden;position:relative}.bar i{display:block;height:100%;border-radius:5px}'
 +'.bar u{position:absolute;top:-2px;bottom:-2px;width:2px;background:#121212}.act small{color:#666B6E;font-size:.8rem}'
 +'.ms{list-style:none;margin:0;padding:0}.ms li{display:flex;gap:10px;align-items:baseline;padding:5px 0}.ms li i{flex:none;width:11px;height:11px;border-radius:50%;display:inline-block;transform:translateY(1px)}'
 +'table{width:100%;border-collapse:collapse;font-size:.86rem}th,td{text-align:right;padding:6px 6px;border-bottom:1px solid #ECEDED;vertical-align:top}th{color:#666B6E;font-weight:700;font-size:.78rem}'
 +'.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.flags{margin:8px 0 0;padding:0 18px 0 0}.flags li{margin:4px 0}.sm{font-size:.82rem;color:#666B6E;margin:6px 0 0}'
 +'.ft{margin-top:24px;padding-top:10px;border-top:1px solid #D9DADA;color:#666B6E;font-size:.76rem;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}'
 +'@media (max-width:560px){.pg{padding:20px 16px}.cmp{grid-template-columns:1fr}.tiles{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}.hero{gap:14px}.ring{width:104px;height:104px}.ring i{width:82px;height:82px;font-size:1.5rem}.hd{flex-direction:column}}'
 +'@media print{body{background:#fff}.pg{max-width:none;padding:0;border-top:0}@page{size:A4;margin:14mm}h3{break-after:avoid}}';
wrDataUrl = blob=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(blob); });
$("#btnWeekly").onclick=openWeekly;
}
