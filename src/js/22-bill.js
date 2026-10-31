import { $, closer, esc, fmtD, logAct, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { SITE, csvOf, saveFile } from "./08-settings.js";
import { isoOf, isoText } from "./11-daylog.js";
import { WR_CSS, wrDataUrl, wrRange } from "./15-weekly-report.js";
import { contractActs } from "./16-status.js";
import { ROLE } from "./18-identity.js";
import { SUPPLIED_BY, cableBalance } from "./20-cables.js";
import { DELAY_CAUSES, INSTRUCTORS, claimManDays, photoBlob, photoSrc } from "./21-work.js";
import { LAYERS, layersDone, trenchInPeriod, trenchLabel, trenchStatusText } from "./27-trench.js";
/* ================= חשבון חלקי: הכמויות שבוצעו בתקופה לפי סעיפי ההסכם, עם הגיבוי שמאחוריהן =================
   זה המסמך שהולך לחברה המנהלת פעם בחודש. כמויות בלבד, בלי מחירים (המשרד מכפיל במחירי היחידה של ההסכם).
   לכל סעיף: בהסכם · מצטבר עד תחילת התקופה · בתקופה · מצטבר · אחוז. נספח גיבוי: כל דיווח ביצוע בתקופה עם תאריך, אזור, צוות,
   עובדים ותמונה. ועוד: עבודות נוספות ושינויים, עיכובים שאינם באחריות הקבלן (ימי עובד שאבדו), ימי עובד מול ההסכם לכל סעיף, חומר שסופק. */
export let BILL_CSS;
export function billPeriodDefault(){ const t=isoOf(Date.now()); return {start:t.slice(0,8)+"01",end:t}; }
export function billData(start,end,opts){
  opts=opts||{}; const inP=d=>d>=start&&d<=end, byDate=(a,b)=>(a.date||"")<(b.date||"")?-1:1;
  const q=L=>L.reduce((s,d)=>s+(Number(d.actual)||0),0), m=L=>L.reduce((s,d)=>s+(Number(d.workers)||0),0);
  const acts=contractActs().map(a=>{   // בלי סעיפי «מצב השטח» (ctx): לא בהסכם, לא בחשבון
    const D=(a.daily||[]).filter(d=>Number(d.actual)||d.note).slice().sort(byDate);
    const bef=D.filter(d=>d.date<start), per=D.filter(d=>inP(d.date));
    const total=Number(a.total)||0, before=q(bef), period=q(per), cum=before+period;
    const r={id:a.id,code:a.code||"",name:a.name,unit:a.unit||"",group:a.group||"",total,before,period,cum,pct:total?cum/total:0,over:!!total&&cum>total,
      manPlan:Number(a.manDays)||0,manBefore:m(bef),manPeriod:m(per),manCum:m(bef)+m(per),entries:per,photos:per.filter(d=>photoSrc(d)).length};
    r.manPct=r.manPlan?r.manCum/r.manPlan:null;
    r.burn=r.manPlan>0&&r.manCum>=2&&r.manPct-r.pct>0.15;   // שורף ימי עובד מהר מהביצוע
    return r; });
  const shown=opts.all?acts:acts.filter(a=>a.cum>0||a.entries.length);
  const groups=[]; shown.forEach(a=>{ let g=groups.find(x=>x.name===a.group); if(!g){ g={name:a.group,acts:[]}; groups.push(g); } g.acts.push(a); });
  const B=(shared.blockers||[]).slice().sort(byDate), bd=b=>b.date||isoOf(b.ts);
  const extras=B.filter(b=>b.kind==="extra"&&inP(bd(b))), delays=B.filter(b=>b.kind==="delay"&&inP(bd(b)));
  const trench=trenchInPeriod(start,end);   // סגירות תעלה בתקופה (27-trench): גיבוי לכיסוי, עם השכבות שצולמו ומי אישר
  const lost=Math.round(delays.reduce((s,b)=>s+claimManDays(b),0)*10)/10, extraMan=Math.round(extras.reduce((s,b)=>s+claimManDays(b),0)*10)/10;
  const dl=shared.daylog.filter(w=>inP(w.date)), days=new Set(dl.map(w=>w.date)).size;
  const man={days,manDays:dl.length,sub:dl.filter(w=>w.contractor).length,manWork:acts.reduce((s,a)=>s+a.manPeriod,0),workN:acts.reduce((s,a)=>s+a.entries.length,0)};
  const cables=cableBalance(), drums=shared.drums||[], inT=t=>!!t&&inP(isoOf(t));
  const drumsIn=drums.filter(d=>inT(d.ts)), drumsClosed=drums.filter(d=>d.closedAt&&inT(d.closedAt));
  const supplied={}; drums.forEach(d=>{ const k=d.suppliedBy||"unknown"; supplied[k]=(supplied[k]||0)+(Number(d.lengthIn)||0); });
  const flags=[];
  const noArea=acts.reduce((s,a)=>s+a.entries.filter(d=>Number(d.actual)&&!d.area).length,0); if(noArea) flags.push(noArea+" דיווחי ביצוע בתקופה בלי אזור. בלי אזור קשה למפקח לאמת.");
  const noPhoto=acts.filter(a=>a.entries.some(d=>Number(d.actual))&&!a.photos).length; if(noPhoto) flags.push(noPhoto+" סעיפים עם ביצוע בתקופה ובלי אף תמונה.");
  acts.filter(a=>a.over).forEach(a=>flags.push((a.code?a.code+" ":"")+a.name+": המצטבר ("+fmtN(a.cum)+") עבר את הכמות בהסכם ("+fmtN(a.total)+"). חריגת כמות: להגיש כעבודה נוספת או לתקן את הדיווח."));
  const unw=extras.filter(b=>b.written===false).length; if(unw) flags.push(unw+" עבודות נוספות בלי הוראה בכתב. כדאי לבקש אישור במייל לפני ההגשה.");
  const tw=trench.filter(t=>!t.approved).length; if(tw) flags.push(tw+" סגירות תעלה בתקופה עדיין ממתינות לאישור מפקח.");
  return {start,end,acts,shown,groups,extras,delays,trench,lost,extraMan,man,cables,drumsIn,drumsClosed,supplied,flags,all:!!opts.all,no:String(opts.no||"").trim()};
}
export function billHtml(D,o){
  o=o||{}; const e=esc, N=v=>'<span class="n">'+fmtN(v)+'</span>', P=x=>'<span class="n">'+Math.round(Math.max(0,x)*100)+'%</span>';
  const src=s=>(o.photos&&o.photos.get(s))||s, site=SITE.name||"האתר", co=SITE.company||"S.E.E";
  const lab=a=>(a.code?'<span class="code">'+e(a.code)+'</span>':'')+e(a.name), plain=a=>(a.code?a.code+" ":"")+a.name;
  const mh=b=>{ const w=Number(b.workers)||0, h=Number(b.hours)||0; return w?'<span class="n">'+w+(h?'×'+fmtN(h)+'ש׳':'')+'</span>':'—'; };
  const ph=(L,cap)=>{ const P=L.filter(x=>photoSrc(x)); return P.length?'<div class="phs">'+P.slice(0,12).map(x=>'<figure><img src="'+e(src(photoSrc(x)))+'" alt="" loading="lazy"><figcaption>'+e(cap(x))+'</figcaption></figure>').join("")+(P.length>12?'<p class="sm">ועוד '+(P.length-12)+' תמונות באפליקציה.</p>':'')+'</div>':''; };
  let h='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>'+e("חשבון חלקי"+(D.no?" "+D.no:"")+" · "+site+" · "+wrRange(D.start,D.end))+'</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&family=Heebo:wght@400;700&display=swap"><style>'+WR_CSS+BILL_CSS+'</style></head><body><div class="pg">';
  h+='<div class="hd"><div><div class="brand">'+e(co)+'</div><h1>'+e(site)+' · חשבון חלקי'+(D.no?' מס׳ <span class="n">'+e(D.no)+'</span>':'')+'</h1><div class="sub">כמויות מבוצעות לתקופה <span class="n">'+e(wrRange(D.start,D.end))+'</span> · הופק <span class="n">'+e(fmtD(Date.now())+"."+new Date().getFullYear())+'</span></div></div>'
    +'<div class="tag">כמויות בלבד · ללא מחירים</div></div>';
  const tile=(v,k)=>'<div class="tile"><b>'+v+'</b><span>'+e(k)+'</span></div>';
  h+='<div class="tiles">'+tile(N(D.acts.filter(a=>a.period>0).length),'סעיפים עם ביצוע בתקופה')+tile(N(D.man.workN),'דיווחי ביצוע')+tile(N(D.man.manDays||D.man.manWork),'ימי עובד בתקופה')+tile(N(D.extras.length),'עבודות נוספות')
    +tile('<span class="n"'+(D.lost?' style="color:#B30027"':'')+'>'+fmtN(D.lost)+'</span>','ימי עובד שאבדו בעיכובים')+'</div>';
  // א. כמויות
  h+='<h3>א. כמויות מבוצעות לפי סעיפי ההסכם</h3>';
  if(!D.shown.length) h+='<div class="empty">אין דיווחי ביצוע בתקופה. הכמויות נכנסות מ«דיווח ביצוע» באפליקציה.</div>';
  else { h+='<table class="qt"><tr><th>סעיף</th><th>תיאור</th><th>יח׳</th><th>בהסכם</th><th>מצטבר קודם</th><th>בתקופה</th><th>מצטבר</th><th>%</th></tr>';
    D.groups.forEach(g=>{ if(g.name) h+='<tr class="grp"><td colspan="8">'+e(g.name)+'</td></tr>';
      g.acts.forEach(a=>{ h+='<tr'+(a.over?' class="over"':'')+'><td class="n">'+e(a.code)+'</td><td>'+e(a.name)+(a.over?'<br><small>מעל הכמות בהסכם</small>':'')+'</td><td>'+e(a.unit)+'</td><td class="n">'+fmtN(a.total)+'</td><td class="n">'+fmtN(a.before)+'</td><td class="n"><b>'+(a.period?fmtN(a.period):'—')+'</b></td><td class="n">'+fmtN(a.cum)+'</td><td class="n">'+Math.round(a.pct*100)+'%</td></tr>'; }); });
    h+='</table>';
    const hid=D.acts.length-D.shown.length; h+='<p class="sm">'+(D.all?'כל '+D.acts.length+' סעיפי ההסכם.':hid?'מוצגים סעיפים עם ביצוע; '+hid+' סעיפים ללא ביצוע אינם מוצגים (בקובץ ה-CSV כולם).':'')+' הכמויות מגיעות מדיווחי הביצוע היומיים; הגיבוי לכל שורה בנספח.</p>'; }
  // ב. ימי עובד
  const manA=D.acts.filter(a=>a.manPlan||a.manCum);
  if(manA.length){ h+='<h3>ב. ימי עובד לפי סעיף: ההסכם מול בפועל</h3><table><tr><th>סעיף</th><th>בהסכם</th><th>בתקופה</th><th>מצטבר</th><th>% מהתקציב</th><th>% ביצוע</th></tr>'
    +manA.map(a=>'<tr'+(a.burn?' class="burn"':'')+'><td>'+lab(a)+'</td><td class="n">'+(a.manPlan?fmtN(a.manPlan):'—')+'</td><td class="n">'+fmtN(a.manPeriod)+'</td><td class="n">'+fmtN(a.manCum)+'</td><td class="n">'+(a.manPct===null?'—':Math.round(a.manPct*100)+'%')+'</td><td class="n">'+Math.round(a.pct*100)+'%'+(a.burn?' <b>⚠</b>':'')+'</td></tr>').join("")+'</table>'
    +'<p class="sm">ימי עובד = מה שנרשם ב«עובדים בסעיף» בדיווחי הביצוע. ⚠ = הסעיף צרך חלק גדול יותר מימי העובד מאשר מהכמות; שם הכסף הולך לאיבוד. סה״כ בתקופה: '+N(D.man.manWork)+' ימי עובד על סעיפים'+(D.man.manDays?' מתוך '+N(D.man.manDays)+' ימי עובד שנרשמו בנוכחות':'')+'.</p>'; }
  // ג. עבודות נוספות
  h+='<h3>ג. עבודות נוספות ושינויים</h3>';
  if(!D.extras.length) h+='<div class="empty">לא נרשמו עבודות נוספות בתקופה.</div>';
  else h+='<table><tr><th>תאריך</th><th>מה נעשה</th><th>אזור</th><th>מי הורה</th><th>כמות</th><th>עובדים</th><th>תמונה</th><th>מצב</th></tr>'
    +D.extras.map(b=>'<tr><td class="n">'+e(isoText(b.date||isoOf(b.ts)))+'</td><td>'+e(b.text)+'</td><td>'+e(b.area||"")+'</td><td>'+e([INSTRUCTORS[b.instructedBy]||"",b.instructedName,b.written===true?"בכתב":b.written===false?"בעל פה":""].filter(Boolean).join(" · "))+'</td><td class="n">'+e(b.qty||"")+'</td><td>'+mh(b)+'</td><td>'+(photoSrc(b)?'כן':'—')+'</td><td>'+(b.status==="closed"?'הוגש'+(b.closeNote?' · '+e(b.closeNote):''):'טרם הוגש')+'</td></tr>').join("")+'</table>'
    +(D.extraMan?'<p class="sm">סה״כ '+N(D.extraMan)+' ימי עובד על עבודות נוספות בתקופה.</p>':'')+ph(D.extras,b=>isoText(b.date||isoOf(b.ts))+" · "+b.text.slice(0,40));
  // ד. עיכובים
  h+='<h3>ד. עיכובים והמתנות שאינם באחריות הקבלן</h3>';
  if(!D.delays.length) h+='<div class="empty">לא נרשמו עיכובים בתקופה.</div>';
  else h+='<table><tr><th>תאריך</th><th>מה עצר</th><th>סיבה</th><th>אזור</th><th>עובדים</th><th>ימי עובד</th><th>תמונה</th></tr>'
    +D.delays.map(b=>'<tr><td class="n">'+e(isoText(b.date||isoOf(b.ts)))+'</td><td>'+e(b.text)+'</td><td>'+e(DELAY_CAUSES[b.cause]||"")+'</td><td>'+e(b.area||"")+'</td><td>'+mh(b)+'</td><td class="n">'+fmtN(claimManDays(b))+'</td><td>'+(photoSrc(b)?'כן':'—')+'</td></tr>').join("")
    +'<tr class="tot"><td colspan="5">סה״כ ימי עובד שאבדו</td><td class="n">'+fmtN(D.lost)+'</td><td></td></tr></table>'+ph(D.delays,b=>isoText(b.date||isoOf(b.ts))+" · "+b.text.slice(0,40));
  // ה. חומר
  h+='<h3>ה. חומר שסופק ומאזן כבלים</h3>';
  if(!D.cables.length) h+='<div class="empty">אין עדיין תופים או סוגי כבלים באפליקציה.</div>';
  else { h+='<table><tr><th>סוג כבל</th><th>מתוכנן</th><th>הגיע</th><th>נמשך</th><th>במלאי</th><th>לא מוסבר</th></tr>'+D.cables.map(c=>'<tr><td>'+e(c.desc)+'</td><td class="n">'+(c.planned?fmtN(c.planned):"—")+'</td><td class="n">'+fmtN(c.arrived)+'</td><td class="n">'+fmtN(c.pulled)+'</td><td class="n">'+fmtN(c.stock)+'</td><td class="n"'+(c.unexplained?' style="color:#B30027;font-weight:700"':'')+'>'+(c.unexplained?fmtN(c.unexplained):"—")+'</td></tr>').join("")+'</table>';
    const sup=Object.entries(D.supplied).filter(([k,v])=>v>0).map(([k,v])=>(SUPPLIED_BY[k]||"לא צוין")+": "+fmtN(v)+" מ׳").join(" · ");
    const spw=D.cables.reduce((s,c)=>s+(c.spare||0),0), wst=D.cables.reduce((s,c)=>s+(c.waste||0),0);
    h+='<p class="sm">מטרים, מצטבר מתחילת הפרויקט. '+(sup?'סופק ע״י: '+e(sup)+'. ':'')+(spw||wst?'מתוך מה שנמשך: ספייר / שארית '+N(spw)+' מ׳ · פסולת '+N(wst)+' מ׳. ':'')+'בתקופה: נקלטו '+N(D.drumsIn.length)+' תופים, נסגרו '+N(D.drumsClosed.length)+(D.drumsClosed.length?' (שארית '+N(D.drumsClosed.reduce((s,d)=>s+(Number(d.remainderAtClose)||0),0))+' מ׳)':'')+'. «לא מוסבר» = שארית בתופים שנסגרו ריקים.</p>'; }
  // סגירות תעלה בתקופה: אילו שכבות צולמו ומי אישר. התמונות עצמן אחרי הטבלה
  if(D.trench&&D.trench.length){
    h+='<h3>סגירות תעלה בתקופה</h3><table><tr><th>תאריך</th><th>תעלה · מקטע</th><th>מטרים</th><th>שכבות מצולמות</th><th>אישור</th><th>הערה</th></tr>'
      +D.trench.map(t=>'<tr><td class="n">'+e(isoText(t.date))+'</td><td>'+e(trenchLabel(t))+'</td><td class="n">'+(Number(t.meters)?fmtN(t.meters):'—')+'</td><td>'+LAYERS.map(([k,lab])=>(t.layers&&photoSrc(t.layers[k])?'✓ ':'· ')+e(lab)).join("<br>")+'</td><td>'+e(trenchStatusText(t))+'</td><td>'+e(t.note||"")+'</td></tr>').join("")+'</table>';
    D.trench.forEach(t=>{ h+=ph(LAYERS.map(([k,lab])=>Object.assign({lab},t.layers&&t.layers[k])),x=>trenchLabel(t)+" · "+x.lab); });
  }
  // נספח: גיבוי
  const bk=D.shown.filter(a=>a.entries.length);
  h+='<h3>נספח. גיבוי לדיווחי הביצוע בתקופה</h3>';
  if(!bk.length) h+='<div class="empty">אין דיווחים בתקופה.</div>';
  bk.forEach(a=>{ h+='<div class="bk"><div class="bkh"><span>'+lab(a)+'</span><span>'+N(a.period)+' '+e(a.unit)+' בתקופה · מצטבר '+N(a.cum)+' / '+N(a.total)+'</span></div>'
    +'<table><tr><th>תאריך</th><th>כמות</th><th>אזור</th><th>צוות</th><th>עובדים</th><th>הערה</th><th>רשם</th></tr>'
    +a.entries.map(d=>'<tr><td class="n">'+e(isoText(d.date))+'</td><td class="n">'+(Number(d.actual)?fmtN(d.actual):'—')+'</td><td>'+e(d.area||"")+'</td><td>'+e(d.crew||"")+'</td><td class="n">'+(d.workers||"")+'</td><td>'+e(d.note||"")+(photoSrc(d)?' <small>📷</small>':'')+'</td><td>'+e(d.by||"")+'</td></tr>').join("")+'</table>'
    +ph(a.entries,d=>isoText(d.date)+(d.area?" · "+d.area:""))+'</div>'; });
  if(D.flags.length) h+='<h3>לבדוק לפני ההגשה</h3><ul class="flags">'+D.flags.map(f=>'<li>'+e(f)+'</li>').join("")+'</ul>';
  h+='<div class="sig"><div>מנהל העבודה<br><span></span></div><div>מנהל הפרויקט<br><span></span></div><div>המפקח / החברה המנהלת<br><span></span></div></div>';
  h+='<div class="ft"><span>נוצר אוטומטית מיומן חשמל · '+e(co)+' · כמויות בלבד, המחירים לפי ההסכם</span><span>נתונים נכון ל-<span class="n">'+e(isoText(D.end))+'</span></span></div></div></body></html>';
  return h;
}
const fullDate=iso=>String(iso||"").split("-").reverse().join(".");   // ב-CSV תמיד עם שנה: 05.10.2026
export function billCsv(D){
  return csvOf(["פרק","סעיף","תיאור","יחידה","כמות בהסכם","מצטבר קודם","בתקופה","מצטבר","אחוז","ימי עובד בהסכם","ימי עובד בתקופה","ימי עובד מצטבר"],
    D.acts.map(a=>[a.group,a.code,a.name,a.unit,a.total,a.before,a.period,a.cum,Math.round(a.pct*1000)/10,a.manPlan||"",a.manPeriod,a.manCum]));
}
export function billBackupCsv(D){
  const rows=[];
  D.acts.forEach(a=>a.entries.forEach(d=>rows.push(["דיווח ביצוע",a.code,a.name,fullDate(d.date),d.actual||"",a.unit,d.area||"",d.crew||"",d.workers||"",d.note||"",d.by||"",photoSrc(d)?"כן":""])));
  D.extras.forEach(b=>rows.push(["עבודה נוספת","","",fullDate(b.date||isoOf(b.ts)),b.qty||"","",b.area||"",[INSTRUCTORS[b.instructedBy]||"",b.instructedName,b.written===true?"בכתב":b.written===false?"בעל פה":""].filter(Boolean).join(" · "),b.workers||"",b.text+(b.hours?" · "+b.hours+" שעות":""),b.by||"",photoSrc(b)?"כן":""]));
  D.delays.forEach(b=>rows.push(["עיכוב","","",fullDate(b.date||isoOf(b.ts)),claimManDays(b),"ימי עובד",b.area||"",DELAY_CAUSES[b.cause]||"",b.workers||"",b.text+(b.hours?" · "+b.hours+" שעות":""),b.by||"",photoSrc(b)?"כן":""]));
  (D.trench||[]).forEach(t=>rows.push(["סגירת תעלה","",trenchLabel(t),fullDate(t.date),t.meters||"","מ׳",t.trench||"",t.approved?"אושר · "+(t.inspector||"")+" · "+fullDate(t.approvedAt):"ממתין לאישור מפקח","",layersDone(t)+"/"+LAYERS.length+" שכבות מצולמות"+(t.note?" · "+t.note:""),t.by||"",layersDone(t)?"כן":""]));
  return csvOf(["סוג","סעיף","תיאור","תאריך","כמות","יחידה","אזור","צוות / מי הורה / סיבה","עובדים","הערה","רשם","תמונה"],rows);
}
/* תמונות לקובץ המורד: /_blob/ עובד רק בתוך האפליקציה, אז מקטינים ומטמיעים כ-data URL (עד 150 תמונות) */
export async function billPhotos(D){
  const srcs=new Set(); D.shown.forEach(a=>a.entries.forEach(d=>{ const s=photoSrc(d); if(s) srcs.add(s); })); D.extras.concat(D.delays).forEach(b=>{ const s=photoSrc(b); if(s) srcs.add(s); });
  (D.trench||[]).forEach(t=>LAYERS.forEach(([k])=>{ const s=t.layers&&photoSrc(t.layers[k]); if(s) srcs.add(s); }));
  const map=new Map(); let n=0;
  for(const s of srcs){ if(n++>=150) break; if(s.startsWith("data:")){ map.set(s,s); continue; }
    try{ const bl=await (await fetch(s)).blob(); map.set(s,await wrDataUrl(await photoBlob(bl,560,0.7))); }catch(e){} }
  return map;
}
export function openBill(){
  if(ROLE==="viewer"){ toast("חשבון חלקי — למנהלים."); return; }
  let {start,end}=billPeriodDefault(); let all=false, no="";
  const scrim=popup('<div class="sheet wr-sheet" role="dialog" aria-modal="true" aria-label="חשבון חלקי"><div class="grab"></div><h2>חשבון חלקי</h2>'
    +'<div class="note-card">הכמויות שבוצעו בתקופה לפי סעיפי ההסכם, עם הגיבוי שמאחוריהן: כל דיווח ביצוע עם תאריך, אזור, צוות ותמונה; עבודות נוספות; עיכובים שאינם באחריותנו; ימי עובד מול ההסכם; חומר שסופק. בלי מחירים: המשרד מכפיל במחירי היחידה.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="f"><label for="blStart">מתאריך</label><input type="date" id="blStart" value="'+start+'"></div><div class="f"><label for="blEnd">עד תאריך</label><input type="date" id="blEnd" value="'+end+'"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end"><div class="f"><label for="blNo">מס׳ חשבון (לא חובה)</label><input type="text" id="blNo" inputmode="numeric" placeholder="למשל 3"></div><label class="chk" style="min-height:44px;display:flex;align-items:center;gap:8px"><input type="checkbox" id="blAll"> גם סעיפים בלי ביצוע</label></div>'
    +'<iframe class="wr-frame" id="blFrame" title="תצוגת החשבון"></iframe>'
    +'<div class="acts"><button class="save" id="blDl" type="button">הורדת הקובץ (עם תמונות)</button><button class="ghost" id="blPrint" type="button">הדפסה / PDF</button></div>'
    +'<div class="acts" style="margin-top:8px"><button class="ghost" id="blCsv" type="button">CSV כמויות</button><button class="ghost" id="blCsv2" type="button">CSV גיבוי</button><button class="cancel" type="button">סגור</button></div></div>');
  const close=closer(scrim); const q=s=>scrim.querySelector(s); q(".cancel").onclick=close;
  const data=()=>billData(start,end,{all,no});
  const draw=()=>{ q("#blFrame").srcdoc=billHtml(data()); };
  q("#blStart").onchange=ev=>{ if(ev.target.value){ start=ev.target.value; draw(); } };
  q("#blEnd").onchange=ev=>{ if(ev.target.value){ end=ev.target.value; draw(); } };
  q("#blAll").onchange=ev=>{ all=ev.target.checked; draw(); };
  let nt=null; q("#blNo").oninput=ev=>{ no=ev.target.value.trim(); clearTimeout(nt); nt=setTimeout(draw,300); };
  const fname=ext=>"חשבון-חלקי"+(no?"-"+no:"")+"-"+(SITE.name||"אתר").replace(/\s+/g,"-")+"-"+start+"-"+end+ext;
  q("#blDl").onclick=async()=>{ const b=q("#blDl"); b.disabled=true; b.textContent="מכין קובץ…"; const D=data(); let photos=null;
    try{ photos=await billPhotos(D); }catch(e){ toast("חלק מהתמונות לא נכנסו לקובץ."); }
    if(await saveFile(fname(".html"),new Blob([billHtml(D,{photos})],{type:"text/html"}))) logAct("progress","add","חשבון חלקי"+(no?" "+no:"")+" · "+wrRange(start,end)+" · "+D.man.workN+" דיווחים","bill");
    b.disabled=false; b.textContent="הורדת הקובץ (עם תמונות)"; };
  q("#blPrint").onclick=()=>{ try{ q("#blFrame").contentWindow.print(); }catch(e){ toast("ההדפסה לא זמינה כאן. הורד את הקובץ והדפס ממנו."); } };
  q("#blCsv").onclick=async()=>{ if(await saveFile(fname("-כמויות.csv"),new Blob([billCsv(data())],{type:"text/csv"}))) toast("CSV הכמויות ירד."); };
  q("#blCsv2").onclick=async()=>{ if(await saveFile(fname("-גיבוי.csv"),new Blob([billBackupCsv(data())],{type:"text/csv"}))) toast("CSV הגיבוי ירד."); };
  draw();
}
export function __init(){
BILL_CSS = '.tiles{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}.qt td,.qt th{font-size:.84rem}.qt td:nth-child(2){min-width:160px}tr.grp td{background:#E6EEF5;color:#1F5E8C;font-weight:700;padding:6px 8px}'
 +'tr.over td{color:#B30027}tr.over small{color:#B30027;font-weight:700}tr.burn td{background:#FFF4E5}tr.tot td{font-weight:700;border-top:2px solid #121212}'
 +'.phs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 4px}.phs figure{margin:0;width:150px}.phs img{width:150px;height:110px;object-fit:cover;border-radius:5px;border:1px solid #D9DADA}.phs figcaption{font-size:.72rem;color:#666B6E;line-height:1.3;margin-top:2px}'
 +'.bk{margin:12px 0 0;break-inside:avoid}.bkh{display:flex;justify-content:space-between;gap:10px;font-weight:700;padding:6px 0 2px;border-bottom:2px solid #1F5E8C;color:#1F5E8C}.bkh span:last-child{color:#121212;font-weight:400;font-size:.86rem}'
 +'.sig{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin:34px 0 10px;font-size:.84rem;color:#666B6E}.sig span{display:block;height:34px;border-bottom:1px solid #121212;margin-top:4px}'
 +'@media print{.phs img{width:120px;height:88px}}';
const b=$("#btnBill"); if(b) b.onclick=()=>openBill();
}
