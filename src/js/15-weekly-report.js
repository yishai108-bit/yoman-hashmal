/* ================= דוח שבועי: דף אחד למנהלים / ליזם, נבנה מהנתונים שכבר באפליקציה =================
   מקורות: סטטוס התקדמות (כל הפעילויות), מאזן פאנלים, תעודות בטון, ניפוקים, תעודות משלוח, בקשות רכש / PO / תאריכי אספקה.
   ליזם: אחוזים, אבני דרך ותמונה בלבד. בלי ספקים, נהגים, קבלנים, מחירים וכמויות קטנות. הערות מתעודות לא נכנסות לאף גרסה. */
let DRONE=[], droneSub=false;
function droneWatch(){ if(droneSub||!DB) return; droneSub=true;
  try{ watch(DB.collection("drone"),snap=>{ DRONE=snap.docs.map(d=>Object.assign({id:d.id},d.data())); if(wrRedraw) wrRedraw(); }); }catch(e){} }
let wrRedraw=null;
const wrPct=x=>Math.round(Math.max(0,Math.min(1,x))*100);
const wrRange=(a,b)=>{ const [ya,ma,da]=a.split("-"), [yb,mb,db]=b.split("-"); return (+da)+"."+(+ma)+(ya!==yb?"."+ya:"")+"–"+(+db)+"."+(+mb)+"."+yb; };
const wrMonth=iso=>{ const m=String(iso||"").match(/^(\d{4})-(\d\d)/); return m?["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"][+m[2]-1]+" "+m[1]:""; };
function wrData(endIso){
  const endT=new Date(endIso+"T23:59:59").getTime(), startT=endT-7*864e5+1000, startIso=isoOf(startT);
  const inW=t=>t>=startT&&t<=endT, hol=statusHolidays();
  const acts=STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0)).map(a=>{
    const total=Number(a.total)||0; const daily=(a.daily||[]).filter(d=>d.date<=endIso&&Number(d.actual)).sort((x,y)=>x.date<y.date?-1:1);
    let cum=0, doneDate=""; daily.forEach(d=>{ cum+=Number(d.actual); if(!doneDate&&total&&cum>=total) doneDate=d.date; });
    const done=Math.min(total||cum,cum), week=daily.filter(d=>d.date>=startIso).reduce((s,d)=>s+Number(d.actual),0);
    const first=a.start||(daily[0]||{}).date||"", last=(daily[daily.length-1]||{}).date||"";
    // רישום שמשלים תקופה ארוכה משבוע (אין רישום בשבוע שלפניו): מציגים «מאז» הרישום הקודם ולא «השבוע»
    const wk=daily.filter(d=>d.date>=startIso), prev=(daily.filter(d=>d.date<startIso).pop()||{}).date||"";
    const weekLabel=wk.length&&prev&&prev<isoOf(new Date(wk[0].date+"T12:00:00").getTime()-7*864e5)?"מאז "+isoText(prev):"השבוע";
    const r={id:a.id,name:a.name,total,done,week,weekLabel,pct:total?done/total:0,first,last,doneDate,complete:!!total&&done>=total,started:done>0,planEnd:a.planEnd||""};
    if(r.planEnd&&first&&!r.complete){ const all=workdaysBetween(first,r.planEnd,hol), gone=workdaysBetween(first,endIso,hol);
      r.planPct=all?Math.min(1,gone/all):1; r.planLeft=Math.max(0,workdaysBetween(isoOf(endT+864e5),r.planEnd,hol)); r.planNeed=r.planLeft?Math.ceil((total-done)/r.planLeft):null;
      r.planGap=r.pct-r.planPct; }
    r.stale=r.started&&!r.complete&&(!last||last<isoOf(endT-7*864e5));
    return r; });
  const findA=re=>acts.find(a=>re.test(a.name));
  const pb=panelBal.filter(b=>b.ts<=endT).slice().sort((a,b)=>b.ts-a.ts)[0]||null;
  const panA=findA(/פאנל/);
  const panels=pb?{installed:Number(pb.installed)||0,required:Number(pb.required)||0,broken:Number(pb.broken)||0,received:Number(pb.received)||0,date:pb.dateText||fmtD(pb.ts)}
    :panA?{installed:panA.done,required:panA.total,date:panA.last?isoText(panA.last):""}:null;
  const con=concrete.filter(c=>c.ts<=endT), conW=con.filter(c=>inW(c.ts));
  const m3=l=>Math.round(l.reduce((s,c)=>s+(Number(c.m3)||0),0)*10)/10;
  const iss=issues.filter(s=>s.ts<=endT), issW=iss.filter(s=>inW(s.ts));
  const tabs=l=>l.reduce((s,x)=>s+(Number(x.tables)||0),0);
  const conA=findA(/קונסטרוקציה|שולחנות/);
  const pgCon=progress.filter(p=>p.stage==="con"&&p.ts<=endT).reduce((m,p)=>Math.max(m,Number(p.tables)||0),0);
  const notes=deliveries.filter(n=>n.source!=="bom"&&inW(n.ts)).slice().sort((a,b)=>a.ts-b.ts);
  const sup=new Map(); notes.forEach(n=>{ const k=shortSup(n.supplier)||"ספק לא ידוע"; sup.set(k,(sup.get(k)||0)+1); });
  const today=isoOf(Date.now()), M=requestMatch(), reqOpen=M.rows.filter(r=>r.k!=="ok");
  const reqBad=M.rows.filter(r=>["none","hold","short","late"].includes(r.k));
  const poLate=POS.filter(p=>poStatus(p).k==="late");
  const eta=etaRows().filter(r=>!r.arrived), etaLate=eta.filter(r=>r.late), etaSoon=eta.filter(r=>!r.late&&r.date&&r.date>=today&&r.date<=isoOf(Date.now()+14*864e5));
  const flags=[];
  acts.filter(a=>a.stale).forEach(a=>flags.push(a.name+": הסטטוס לא עודכן מאז "+(a.last?isoText(a.last):"—")+". המספרים בדוח נכונים לתאריך הזה."));
  const pourA=findA(/יציק/); if(conW.length&&pourA&&!pourA.complete&&!pourA.week) flags.push("השבוע נקלטו "+conW.length+" תעודות בטון ("+fmtN(m3(conW))+" מ״ק), אבל ב«"+pourA.name+"» לא נרשמה התקדמות.");
  if(issW.length&&conA&&!conA.complete&&!conA.week&&tabs(issW)) flags.push("השבוע נופקו ערכות ל-"+tabs(issW)+" שולחנות, אבל ב«"+conA.name+"» לא נרשמה התקדמות.");
  if(reqBad.length) flags.push(reqBad.length+" שורות בבקשות רכש דורשות טיפול (לא הוזמן, הוזמן פחות או באיחור).");
  if(poLate.length) flags.push(poLate.length+" הזמנות רכש (PO) עם תאריך אספקה שעבר, בלי תעודת משלוח.");
  if(!acts.some(a=>a.planEnd)) flags.push("אין עדיין תאריכי יעד (גאנט), ולכן אין השוואה לתוכנית.");
  return {endIso,startIso,acts,panels,panA,con:{n:con.length,m3:m3(con),wn:conW.length,wm3:m3(conW)},
    iss:{n:iss.length,t:tabs(iss),wn:issW.length,wt:tabs(issW),list:issW},conA,pgCon,notes,sup,reqOpen,reqBad,poLate,etaLate,etaSoon,flags,hasPlan:acts.some(a=>a.planEnd)};
}
const WR_CSS='*{box-sizing:border-box}body{margin:0;background:#F2F2F2;color:#121212;font-family:"Alef","Heebo",Arial,sans-serif;font-size:15px;line-height:1.5;direction:rtl}'
 +'.pg{max-width:780px;margin:0 auto;background:#fff;padding:28px 24px 22px;border-top:6px solid #E40033}'
 +'.n{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums}'
 +'.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid #D9DADA;padding-bottom:14px}'
 +'.brand{color:#E40033;font-weight:700;letter-spacing:.16em;font-size:.8rem}.hd h1{margin:4px 0 2px;font-size:1.55rem;line-height:1.2}.hd .sub{color:#666B6E;font-size:.9rem}'
 +'.tag{flex:none;border:1px solid #121212;border-radius:99px;padding:3px 12px;font-size:.78rem;font-weight:700;white-space:nowrap}.tag.c{border-color:#4F7F0B;color:#4F7F0B}'
 +'.hero{display:flex;gap:20px;align-items:center;margin:20px 0 6px}.ring{flex:none;width:132px;height:132px;border-radius:50%;display:grid;place-items:center}'
 +'.ring i{width:104px;height:104px;border-radius:50%;background:#fff;display:grid;place-items:center;font-style:normal;font-size:1.9rem;font-weight:700}'
 +'.hero h2{margin:0;font-size:1.25rem}.hero p{margin:4px 0 0;color:#3F4447}.lead{margin:12px 0 0;padding:10px 14px;background:#EEF5DE;border-radius:6px;font-weight:700}'
 +'.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.tile{border:1px solid #D9DADA;border-radius:6px;padding:10px}'
 +'.tile b{display:block;font-size:1.6rem;line-height:1.2}.tile>span{font-size:.8rem;color:#666B6E}'
 +'h3{margin:22px 0 8px;font-size:1.05rem;border-right:4px solid #E40033;padding-right:8px}'
 +'.cmp{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ph{margin:0;border-radius:6px;overflow:hidden;background:#ECEDED}.ph img{display:block;width:100%;height:auto}.ph figcaption{padding:6px 10px;font-size:.82rem;color:#3F4447;background:#ECEDED}'
 +'.empty{border:2px dashed #D9DADA;border-radius:6px;padding:16px;text-align:center;color:#666B6E;font-size:.9rem}'
 +'.act{padding:8px 0;border-bottom:1px solid #ECEDED;break-inside:avoid}.act .t{display:flex;justify-content:space-between;gap:10px;font-weight:700}'
 +'.bar{height:9px;border-radius:5px;background:#ECEDED;margin:6px 0 3px;overflow:hidden;position:relative}.bar i{display:block;height:100%;border-radius:5px}'
 +'.bar u{position:absolute;top:-2px;bottom:-2px;width:2px;background:#121212}.act small{color:#666B6E;font-size:.8rem}'
 +'.ms{list-style:none;margin:0;padding:0}.ms li{display:flex;gap:10px;align-items:baseline;padding:5px 0}.ms li i{flex:none;width:11px;height:11px;border-radius:50%;display:inline-block;transform:translateY(1px)}'
 +'table{width:100%;border-collapse:collapse;font-size:.86rem}th,td{text-align:right;padding:6px 6px;border-bottom:1px solid #ECEDED;vertical-align:top}th{color:#666B6E;font-weight:700;font-size:.78rem}'
 +'.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.flags{margin:0;padding:0 18px 0 0}.flags li{margin:4px 0}'
 +'.ft{margin-top:24px;padding-top:10px;border-top:1px solid #D9DADA;color:#666B6E;font-size:.76rem;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}'
 +'@media (max-width:560px){.pg{padding:20px 16px}.cmp{grid-template-columns:1fr}.tiles{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}.hero{gap:14px}.ring{width:104px;height:104px}.ring i{width:82px;height:82px;font-size:1.5rem}.hd{flex-direction:column}}'
 +'@media print{body{background:#fff}.pg{max-width:none;padding:0;border-top:0}@page{size:A4;margin:14mm}h3{break-after:avoid}}';
function wrHtml(mode,D,o){
  o=o||{}; const C=mode==="client", e=esc, N=v=>'<span class="n">'+fmtN(v)+'</span>', NP=v=>'<span class="n">+'+fmtN(v)+'</span>', P=x=>'<span class="n">'+wrPct(x)+'%</span>';
  const P1=(x,plus)=>{ const v=Math.round(x*1000)/10; return '<span class="n">'+(plus?'+':'')+(v>0&&v<1?"<1":Math.round(v))+'%</span>'; };
  const col=a=>a.complete?"#9AC339":a.planGap!=null?(a.planGap<-0.05?"#E40033":a.planGap<0?"#FFAA00":"#9AC339"):a.started?"#3199CC":"#D9DADA";
  const site=SITE.name||"אתר הקמה", gen=fmtD(Date.now())+"."+new Date().getFullYear();
  const pan=D.panels, panPct=pan&&pan.required?pan.installed/pan.required:0;
  let h='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>'+e("דוח שבועי · "+site+" · "+wrRange(D.startIso,D.endIso))+'</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alef:wght@400;700&family=Heebo:wght@400;700&display=swap"><style>'+WR_CSS+'</style></head><body><div class="pg">';
  h+='<div class="hd"><div><div class="brand">'+e(SITE.company||"BELECTRIC")+'</div><h1>'+e(site)+' · דוח סטטוס שבועי</h1><div class="sub">שבוע <span class="n">'+e(wrRange(D.startIso,D.endIso))+'</span> · הופק <span class="n">'+e(gen)+'</span></div></div>'
    +'<div class="tag'+(C?' c':'')+'">'+(C?'עדכון ליזם':'למנהלים · פנימי')+'</div></div>';
  if(pan) h+='<div class="hero"><div class="ring" style="background:conic-gradient(#9AC339 '+wrPct(panPct)*3.6+'deg,#ECEDED 0)"><i class="n">'+wrPct(panPct)+'%</i></div><div><h2>'+(C?'מהפאנלים כבר מותקנים':'פאנלים מותקנים')+'</h2>'
    +'<p>'+(C?'נכון ל-'+e(pan.date):N(pan.installed)+' מתוך '+N(pan.required)+' פאנלים בתכנון · מאזן '+e(pan.date))+'</p>'
    +(!C&&D.panA&&D.panA.week?'<p>'+e(D.panA.weekLabel)+': <b>'+NP(D.panA.week)+'</b> פאנלים בסטטוס</p>':'')+'</div></div>';
  if(o.lead) h+='<div class="lead">'+e(o.lead)+'</div>';
  const tile=(v,k)=>'<div class="tile"><b>'+v+'</b><span>'+e(k)+'</span></div>';
  const act3=D.acts.filter(a=>!a.complete&&a.started).slice(0,4);
  if(C){ if(act3.length) h+='<div class="tiles">'+act3.map(a=>tile(P(a.pct),a.name)).join("")+'</div>'; }
  else h+='<div class="tiles">'+tile(D.panA?NP(D.panA.week):'—','פאנלים '+(D.panA?D.panA.weekLabel:'השבוע'))+tile(N(D.con.wn)+' <small style="font-size:.8rem">תעודות</small>','בטון השבוע · '+fmtN(D.con.wm3)+' מ״ק')
    +tile(N(D.iss.wt),'שולחנות נופקו השבוע')+tile(N(D.notes.length),'תעודות משלוח השבוע')+'</div>';
  const fig=(src,cap)=>'<figure class="ph"><img src="'+e(src)+'" alt="תמונת רחפן של האתר"><figcaption>'+cap+'</figcaption></figure>', dt=x=>'<span class="n">'+e(isoText(x))+'</span>';
  if(o.img||!C) h+='<h3>האתר מהאוויר</h3>'+(!o.img?'<div class="empty">כאן תופיע תמונת הרחפן השבועית. מעלים אותה בחלון «דוח שבועי» באפליקציה.</div>'
    :o.prev?'<div class="cmp">'+fig(o.prev,'אז · '+dt(o.prevDate))+fig(o.img,'עכשיו · '+dt(o.imgDate))+'</div>'
    :fig(o.img,'תמונת רחפן · '+dt(o.imgDate)+(o.imgDate<D.startIso?' · הצילום האחרון':'')));
  h+='<h3>התקדמות לפי פעילות</h3>';
  if(!D.acts.length) h+='<div class="empty">אין עדיין סטטוס התקדמות באפליקציה.</div>';
  D.acts.forEach(a=>{ h+='<div class="act"><div class="t"><span>'+e(a.name)+'</span><span>'+P(a.pct)+'</span></div>'
    +'<div class="bar"><i style="width:'+wrPct(a.pct)+'%;background:'+col(a)+'"></i>'+(a.planPct!=null?'<u style="right:'+wrPct(a.planPct)+'%" title="לפי התוכנית"></u>':'')+'</div><small>'
    +(C?(a.complete?'הושלם'+(a.doneDate?' · '+e(wrMonth(a.doneDate)):''):a.started?(a.week&&a.total?P1(a.week/a.total,1)+' '+e(a.weekLabel):'בביצוע'):'טרם החל')
      :(a.complete?'הושלם'+(a.doneDate?' ב-'+e(isoText(a.doneDate)):'')+' · '+N(a.total):N(a.done)+' / '+N(a.total)+(a.week?' · <b>'+NP(a.week)+'</b> '+e(a.weekLabel):' · אין התקדמות השבוע')+(a.last?' · עדכון אחרון '+e(isoText(a.last)):'')))
    +'</small></div>'; });
  if(!C||D.hasPlan) h+='<h3>מול התוכנית</h3>';
  if(!D.hasPlan){ if(!C) h+='<div class="empty">יתמלא כשיוזן לוח הזמנים (גאנט) של הפרויקט. כרגע לא הוזנו תאריכי יעד, ולכן אין כאן השוואה לתוכנית.</div>'; }
  else h+='<table><tr><th>פעילות</th><th>תאריך יעד</th><th>בפועל מול התוכנית</th>'+(C?'':'<th>נדרש ליום</th>')+'</tr>'+D.acts.filter(a=>a.planEnd).map(a=>'<tr><td>'+e(a.name)+'</td><td class="n">'+e(isoText(a.planEnd))+'</td><td>'
    +(a.complete?'הושלם':a.planGap==null?'טרם החל':(a.planGap>=0?'<b style="color:#4F7F0B">לפני התוכנית</b> · ':'<b style="color:'+(a.planGap<-0.05?'#B30027':'#B87400')+'">מאחר</b> · ')+P(a.pct)+' בפועל, '+P(a.planPct)+' מתוכנן')+'</td>'
    +(C?'':'<td>'+(a.complete||a.planGap==null?'—':a.planNeed==null?'<b style="color:#B30027">עבר היעד</b>':N(a.planNeed))+'</td>')+'</tr>').join("")+'</table>';
  const ms=D.acts; if(!C||D.hasPlan) h+='<h3>אבני דרך</h3><ul class="ms">'
    +ms.filter(a=>a.complete).map(a=>'<li><i style="background:#9AC339"></i><span><b>'+e(a.name)+'</b> · הושלם'+(a.doneDate?' '+e(C?wrMonth(a.doneDate):isoText(a.doneDate)):'')+'</span></li>').join("")
    +ms.filter(a=>!a.complete&&a.started).map(a=>'<li><i style="background:#3199CC"></i><span><b>'+e(a.name)+'</b> · בביצוע, '+P(a.pct)+(a.planEnd?' · יעד '+e(isoText(a.planEnd)):'')+'</span></li>').join("")
    +ms.filter(a=>!a.started).map(a=>'<li><i style="background:#D9DADA"></i><span><b>'+e(a.name)+'</b> · '+(a.planEnd?'יעד '+e(isoText(a.planEnd)):'הבא בתור')+'</span></li>').join("")+'</ul>';
  if(!C){
    h+='<div class="two"><div><h3>בטון ויציקות</h3><table><tr><td>תעודות בטון השבוע</td><td>'+N(D.con.wn)+' · '+N(D.con.wm3)+' מ״ק</td></tr><tr><td>מצטבר</td><td>'+N(D.con.n)+' תעודות · '+N(D.con.m3)+' מ״ק</td></tr></table></div>'
      +'<div><h3>קונסטרוקציה</h3><table><tr><td>נופקו השבוע</td><td>'+N(D.iss.wt)+' שולחנות · '+N(D.iss.wn)+' ניפוקים</td></tr><tr><td>נופקו מצטבר</td><td>'+N(D.iss.t)+(D.conA?' מתוך '+N(D.conA.total):'')+' שולחנות</td></tr>'
      +'<tr><td>דווחו גמורים</td><td>'+N(Math.max(D.pgCon,D.conA?D.conA.done:0))+' שולחנות</td></tr></table></div></div>';
    if(D.iss.list.length) h+='<h3>ניפוקים השבוע</h3><table><tr><th>תאריך</th><th>למי</th><th>שולחנות</th><th>סוג</th></tr>'+D.iss.list.slice().sort((a,b)=>a.ts-b.ts).map(s=>'<tr><td class="n">'+e(fmtD(s.ts))+'</td><td>'+e(s.who||"")+'</td><td>'+(Number(s.tables)?N(s.tables):'—')+'</td><td>'+e(s.typeLabel||"")+'</td></tr>').join("")+'</table>';
    h+='<h3>תעודות משלוח שהתקבלו השבוע</h3>'+(!D.notes.length?'<div class="empty">לא נקלטו תעודות משלוח השבוע.</div>'
      :'<table><tr><th>תאריך</th><th>ספק</th><th>תעודה</th><th>מה הגיע</th></tr>'+D.notes.slice(-14).map(n=>{ const L=n.lines||[]; return '<tr><td class="n">'+e(n.dateText?fmtDT(n.dateText):fmtD(n.ts))+'</td><td>'+e(shortSup(n.supplier))+'</td><td class="n">'+e(n.noteNo||"")+'</td><td>'
        +L.slice(0,2).map(l=>e(String(l.name||"").slice(0,48))+' · '+N(Number(l.qty)||0)+' '+e(l.unit||"")).join("<br>")+(L.length>2?'<br><small>ועוד '+(L.length-2)+' שורות</small>':'')+'</td></tr>'; }).join("")+'</table>'
        +(D.notes.length>14?'<p style="font-size:.8rem;color:#666B6E">מוצגות 14 האחרונות מתוך '+D.notes.length+'.</p>':''));
    h+='<h3>רכש ואספקה</h3><table><tr><td>בקשות רכש פתוחות</td><td>'+N(D.reqOpen.length)+(D.reqBad.length?' · <b style="color:#B30027">'+N(D.reqBad.length)+' דורשות טיפול</b>':'')+'</td></tr>'
      +'<tr><td>הזמנות (PO) באיחור</td><td>'+(D.poLate.length?'<b style="color:#B30027">'+N(D.poLate.length)+'</b> · '+D.poLate.slice(0,6).map(p=>e(p.no)).join(", "):'אין')+'</td></tr></table>';
    const etaT=(l,lab)=>l.length?'<p style="margin:10px 0 4px;font-weight:700">'+lab+'</p><table>'+l.slice(0,8).map(r=>'<tr><td class="n" style="width:68px">'+e(r.date?fmtIso(r.date):"—")+'</td><td>'+e(r.title)+(r.ref?' <small style="color:#666B6E">'+e(r.ref)+'</small>':'')+'</td></tr>').join("")+'</table>':'';
    h+=etaT(D.etaLate,"אספקות שהתאריך שלהן עבר")+etaT(D.etaSoon,"אספקות צפויות בשבועיים הקרובים");
    h+='<h3>פתוח לטיפול</h3>'+(D.flags.length?'<ul class="flags">'+D.flags.map(f=>'<li>'+e(f)+'</li>').join("")+'</ul>':'<div class="empty">אין פריטים פתוחים.</div>');
  }
  h+='<div class="ft"><span>'+(C?e(SITE.company||"BELECTRIC")+' · '+e(site):'נוצר אוטומטית מיומן אתר · מסמך פנימי, לא להעביר')+'</span><span>נתונים נכון ל-<span class="n">'+e(isoText(D.endIso))+'</span></span></div></div></body></html>';
  return h;
}
function wrText(mode,D,o){
  const C=mode==="client", site=SITE.name||"האתר", pan=D.panels; const L=[];
  L.push((C?"עדכון שבועי · ":"דוח סטטוס שבועי · ")+site+" · "+wrRange(D.startIso,D.endIso)); L.push("");
  if(o&&o.lead) { L.push(o.lead); L.push(""); }
  if(pan&&pan.required) L.push("פאנלים מותקנים: "+wrPct(pan.installed/pan.required)+"%"+(C?"":" ("+fmtN(pan.installed)+" מתוך "+fmtN(pan.required)+")"));
  D.acts.filter(a=>!a.complete&&a.started).forEach(a=>L.push(a.name+": "+wrPct(a.pct)+"%"+(!C&&a.week?" · +"+fmtN(a.week)+" "+a.weekLabel:"")));
  const dn=D.acts.filter(a=>a.complete).map(a=>a.name); if(dn.length) L.push("הושלמו: "+dn.join(", "));
  if(!C){ L.push(""); L.push("בטון השבוע: "+D.con.wn+" תעודות, "+fmtN(D.con.wm3)+" מ״ק · נופקו "+D.iss.wt+" שולחנות · "+D.notes.length+" תעודות משלוח"); if(D.flags.length){ L.push(""); L.push("פתוח לטיפול:"); D.flags.forEach(f=>L.push("• "+f)); } }
  L.push(""); L.push("הדוח המלא מצורף."); return L.join("\n");
}
async function wrShrink(file){ const im=await loadImg(file); const k=Math.min(1,2000/Math.max(im.naturalWidth,im.naturalHeight));
  const c=document.createElement("canvas"); c.width=Math.round(im.naturalWidth*k); c.height=Math.round(im.naturalHeight*k); c.getContext("2d").drawImage(im,0,0,c.width,c.height); return canvasBlob(c,0.82); }
const wrDataUrl=blob=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(blob); });
function openWeekly(){
  droneWatch(); let mode="mgr", endIso=isoOf(Date.now()), lead="", localImg=null;
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML='<div class="sheet wr-sheet" role="dialog" aria-modal="true" aria-label="דוח שבועי"><div class="grab"></div><h2>דוח שבועי</h2>'
    +'<div class="note-card">דף אחד שנבנה לבד מהנתונים באפליקציה: סטטוס התקדמות, מאזן פאנלים, בטון, ניפוקים, תעודות ורכש. «ליזם» בלי ספקים, קבלנים, מחירים וכמויות קטנות.</div>'
    +'<div class="chips" id="wrMode"><button type="button" class="chip2" data-m="mgr" aria-pressed="true">למנהלים</button><button type="button" class="chip2" data-m="client" aria-pressed="false">ליזם</button></div>'
    +'<div class="f"><label for="wrEnd">השבוע שמסתיים ב-</label><input type="date" id="wrEnd" value="'+endIso+'"></div>'
    +'<div class="f" id="wrDrone"></div>'
    +'<div class="f"><label for="wrLead">משפט פתיחה (לא חובה)</label><input type="text" id="wrLead" maxlength="200" placeholder="למשל: השבוע הושלמה הרכבת הפאנלים בשדה 2"></div>'
    +(ROLE==="owner"?'<details class="wr-plan"><summary>תאריכי יעד מול הגאנט</summary><div class="note">כשיש לוח זמנים מהפרויקט: תאריך סיום מתוכנן לכל פעילות. בלי תאריך, השורה «מול התוכנית» נשארת ריקה.</div><div id="wrPlan"></div><button class="ghost" id="wrPlanSave" type="button" style="width:100%;margin-top:8px">שמור תאריכי יעד</button></details>':'')
    +'<iframe class="wr-frame" id="wrFrame" title="תצוגת הדוח"></iframe>'
    +'<div class="acts"><button class="save" id="wrDl" type="button">הורדת הדוח</button><button class="ghost" id="wrPrint" type="button">הדפסה</button></div>'
    +'<div class="acts" style="margin-top:8px"><button class="ghost" id="wrMail" type="button">העתק טקסט למייל</button><button class="cancel" type="button">סגור</button></div></div>';
  document.body.appendChild(scrim); const q=s=>scrim.querySelector(s);
  const close=()=>{ wrRedraw=null; document.removeEventListener("keydown",esck); scrim.remove(); }; const esck=ev=>{ if(ev.key==="Escape") close(); };
  document.addEventListener("keydown",esck); q(".cancel").onclick=close; scrim.onclick=ev=>{ if(ev.target===scrim) close(); };
  // התמונה האחרונה עד סוף השבוע, ולהשוואה הצילום הראשון שקדם לה בחודש לפחות
  const shots=()=>DRONE.map(d=>({src:d.asset?"/_blob/"+d.asset:d.url,date:d.date})).concat(localImg?[localImg]:[]).filter(x=>x.date&&x.date<=endIso).sort((a,b)=>a.date<b.date?-1:1);
  const photo=()=>{ const L=shots(); return L[L.length-1]||null; };
  const prevShot=p=>p?shots().find(x=>x.date<=isoOf(new Date(p.date+"T12:00:00").getTime()-28*864e5))||null:null;
  const imgOpts=(p,pv)=>({img:p&&p.src,imgDate:p&&p.date,prev:pv&&pv.src,prevDate:pv&&pv.date,lead});
  const drawDrone=()=>{ const p=photo(), can=ROLE!=="viewer";
    q("#wrDrone").innerHTML='<label>תמונת רחפן</label>'+(p?'<div class="wr-thumb"><img src="'+esc(p.src)+'" alt=""><span>בדוח: צילום מ-'+esc(isoText(p.date))+(prevShot(p)?' · להשוואה: '+esc(isoText(prevShot(p).date)):'')+'</span></div>':'<div class="note">אין עדיין תמונה עד התאריך הזה.</div>')
      +(can?'<div class="wr-prow"><span>תאריך הצילום</span><input type="date" id="wrImgDate" value="'+endIso+'"></div><div class="pick">העלאת תמונת רחפן<small>תמונה אחת לכל תאריך צילום · הדוח מציג את האחרונה ומשווה לצילום מלפני חודש ומעלה</small><input type="file" id="wrImg" accept="image/*"></div>':'');
    const f=q("#wrImg"); if(f) f.onchange=async ev=>{ const file=ev.target.files&&ev.target.files[0]; if(!file) return; toast("מעלה תמונה…");
      try{ const bl=await wrShrink(file); if(ASSETS&&DB){ const a=await ASSETS.upload(bl); const date=q("#wrImgDate").value||endIso; const doc={id:"dr_"+date,date,asset:a.id,url:a.url,ts:Date.now(),by:actorName()};
          await DB.doc("drone/"+doc.id).set(doc); DRONE=DRONE.filter(x=>x.id!==doc.id).concat(doc); logAct("progress","add","תמונת רחפן מ-"+isoText(date),doc.id); toast("התמונה נשמרה."); }
        else { localImg={src:URL.createObjectURL(bl),date:q("#wrImgDate").value||endIso,blob:bl}; toast("התמונה נכנסה לדוח (לא נשמרה, אין חיבור למאגר)."); } }catch(e){ toast("ההעלאה נכשלה."); }
      draw(); }; };
  const drawPlan=()=>{ const el=q("#wrPlan"); if(!el) return; const A=STATUS.slice().sort((a,b)=>(a.order||0)-(b.order||0));
    el.innerHTML=A.length?A.map(a=>'<div class="wr-prow"><span>'+esc(a.name)+'</span><input type="date" data-id="'+esc(a.id)+'" value="'+esc(a.planEnd||"")+'"></div>').join(""):'<div class="note">אין פעילויות בסטטוס.</div>'; };
  const draw=()=>{ const D=wrData(endIso), p=photo(); q("#wrFrame").srcdoc=wrHtml(mode,D,imgOpts(p,prevShot(p))); drawDrone(); };
  wrRedraw=draw;
  scrim.querySelectorAll("#wrMode [data-m]").forEach(b=>b.onclick=()=>{ mode=b.dataset.m; scrim.querySelectorAll("#wrMode [data-m]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); draw(); });
  q("#wrEnd").onchange=ev=>{ if(ev.target.value){ endIso=ev.target.value; draw(); } };
  let lt=null; q("#wrLead").oninput=ev=>{ lead=ev.target.value.trim(); clearTimeout(lt); lt=setTimeout(draw,400); };
  const ps=q("#wrPlanSave"); if(ps) ps.onclick=async()=>{ ps.disabled=true; let n=0;
    for(const inp of scrim.querySelectorAll("#wrPlan input[data-id]")){ const a=STATUS.find(x=>x.id===inp.dataset.id); if(!a||(a.planEnd||"")===inp.value) continue;
      if(await saveStatus({...a,planEnd:inp.value,updated:Date.now()})){ n++; logAct("progress","edit","תאריך יעד "+a.name+": "+(inp.value?isoText(inp.value):"נמחק"),a.id); } }
    ps.disabled=false; toast(n?"נשמרו "+n+" תאריכי יעד.":"לא היה שינוי."); draw(); };
  q("#wrDl").onclick=async()=>{ const b=q("#wrDl"); b.disabled=true; const D=wrData(endIso), p=photo(), pv=prevShot(p); const emb=async x=>x?{...x,src:await wrDataUrl(x.blob||await (await fetch(x.src)).blob())}:null; let ep=null, epv=null;
    try{ ep=await emb(p); epv=await emb(pv); }catch(e){ toast("התמונה לא נכנסה לקובץ."); }
    const name="דוח-שבועי-"+(mode==="client"?"יזם":"מנהלים")+"-"+(SITE.name||"אתר").replace(/^אתר הקמה\s*/,"").replace(/\s+/g,"-")+"-"+endIso+".html";
    if(await saveFile(name,new Blob([wrHtml(mode,D,imgOpts(ep,ep&&epv))],{type:"text/html"}))) logAct("progress","add","דוח שבועי "+(mode==="client"?"ליזם":"למנהלים")+" · "+wrRange(D.startIso,D.endIso),"weekly");
    b.disabled=false; };
  q("#wrPrint").onclick=()=>{ try{ q("#wrFrame").contentWindow.print(); }catch(e){ toast("ההדפסה לא זמינה כאן. הורד את הקובץ והדפס ממנו."); } };
  q("#wrMail").onclick=async()=>{ const t=wrText(mode,wrData(endIso),{lead}); try{ await navigator.clipboard.writeText(t); toast("הטקסט הועתק. להדביק במייל ולצרף את הקובץ."); }catch(e){ await ask("העתק את הטקסט למייל","סגור","var(--ink)",t); } };
  drawPlan(); draw();
}
$("#btnWeekly").onclick=openWeekly;
