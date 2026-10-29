/* ================= האתר לפי שלבים: איור מלמעלה של כל מה שהחשמל אחראי עליו, נצבע מדיווחי הביצוע =================
   אדמה וגדר → תעלות לפי התוכנית → נחפרו → כבלים בתעלה → כוסו; משטחים (אגירה, MVS, סקידים): מצעים → בטון → הצבה → חיווט;
   שדות פאנלים: עמודים → פאנלים → שרשורים. בלי הזנה נוספת: כל שלב מקושר לסעיפי הסטטוס (לפי השם, או ידנית ב«מבנה האתר»),
   ודיווח עם «אזור» שתואם שם באיור («שדה B», «MVS 2», «תעלה ראשית») נצבע שם; בלי אזור, ממלא לפי הסדר.
   מבנה האתר נתון לכל מופע (settings/layout): סכמה שנבנית ממספרים (שדות, שורות, MVS, סקידים, מכולות), לא בקנה מידה.
   הציור מיושר לסדר הביצוע (שלב מאוחר מושך את הקודמים באותו מקום); המספרים בכרטיסים הם הדיווחים האמיתיים. */
import { $, esc, logAct, ls, popup, shared, toast } from "./core.js";
import { fmtN } from "./01-stock.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { ROLE } from "./18-identity.js";

const DAY=864e5;
// k, שם, על מה (trench / pad / bess / mvs / wire / pv), זיהוי לפי שם הסעיף, החרגה, צבע, קבוצה
export const PHASES=[
  {k:"dig",l:"חפירת תעלות",on:"trench",re:/חפיר|פתיחת תעל/,c:"#A0703C",g:"t"},
  {k:"cable",l:"כבלים בתעלה",on:"trench",re:/כבל|קוברה/,ex:/מכול|ראשי כבל|לוח/,meters:true,c:"#3F4447",g:"t"},
  {k:"cover",l:"כיסוי תעלות",on:"trench",re:/כיסוי|סגירת תעל|מילוי תעל/,c:"#CDBB97",g:"t"},
  {k:"base",l:"מצעים",on:"pad",re:/מצע/,c:"#A9ACAE",g:"p"},
  {k:"conc",l:"בטונים",on:"pad",re:/בטון|יציקת/,ex:/שוח/,c:"#7E8386",g:"p"},
  {k:"bess",l:"מכולות וסוללות",on:"bess",re:/מכולות|סוללות|מצבר/,ex:/שרשור|קירור|תאורה|איטום|צנרת|גילוי|כבל|CAT|פתחי/,c:"#3F4447",g:"p"},
  {k:"skid",l:"הצבת MVS וסקידים",on:"mvs",re:/הצבת|סקיד|MVS/,ex:/סיב|כבל|הארק|ראשי|מגיני|בדיק|שילוט|טבעת|סדר|חיווט|AUX/,c:"#5B6266",g:"p"},
  {k:"wire",l:"חיווט ושרשור במשטחים",on:"wire",re:/שרשור סוללות|וחיווט|חיווט מ/,c:"#1E7FB0",g:"p"},
  {k:"piles",l:"עמודים",on:"pv",re:/עמוד|קידוח|רמינג|כלונס/,ex:/תאורה|מצלמ|אבטח/,c:"#666B6E",g:"f"},
  {k:"panels",l:"פאנלים",on:"pv",re:/פאנל/,ex:/שרשור|הארק|שולחנות/,c:"#3199CC",g:"f"},
  {k:"strings",l:"שרשורים",on:"pv",re:/שרשור פאנל|שרשור סטרינג/,c:"brand",g:"f"},
];
const GROUPS={t:"תשתית: תעלות",p:"משטחים: אגירה, MVS, סקידים",f:"שדות הפאנלים"};
const CHAIN={trench:["dig","cable","cover"],bess:["base","conc","bess","wire"],mvs:["base","conc","skid","wire"],skid:["base","conc","skid","wire"],pv:["piles","panels","strings"]};
const dt=iso=>{ const [y,m,d]=String(iso).split("-").map(Number); return Date.UTC(y,m-1,d); };
const ddmm=t=>{ const d=new Date(t); return d.getUTCDate()+"."+(d.getUTCMonth()+1)+"."+d.getUTCFullYear(); };
const clamp=x=>Math.max(0,Math.min(1,x));
const norm=s=>String(s||"").toLowerCase().replace(/["'׳״`\-_.·]/g,"").replace(/\s+/g,"");

/* ---- מבנה האתר: סכמה ממספרים ---- */
export const LAYOUT_DEFAULT={fields:4,rows:10,mvs:2,skids:0,bess:6,room:1,names:""};
export function genLayout(gIn){
  const g={...LAYOUT_DEFAULT,...(gIn||{})}; ["fields","rows","mvs","skids","bess","room"].forEach(k=>g[k]=Math.max(0,Math.min(k==="rows"?40:24,Math.round(Number(g[k])||0))));
  const names=String(g.names||"").split(/[,،\n]/).map(s=>s.trim()).filter(Boolean);
  const M=30, PY=M+34, PH=80, pads=[]; let x=M+24;
  const put=(p)=>{ pads.push({...p,x,y:PY+(PH-p.h)}); x+=p.w+22; };
  if(g.room) put({id:"room",kind:"room",name:"חדר חשמל",w:92,h:72});
  for(let i=0;i<g.mvs;i++) put({id:"mvs"+(i+1),kind:"mvs",name:"MVS "+(i+1),w:72,h:62,units:1});
  for(let i=0;i<g.skids;i++) put({id:"skid"+(i+1),kind:"skid",name:"סקיד "+(i+1),w:56,h:56,units:1});
  if(g.bess){ const cols=Math.ceil(g.bess/2); put({id:"bess",kind:"bess",name:"אגירה",w:cols*62+18,h:PH,units:g.bess}); }
  const W=Math.max(620,x-22+M+24), cols=g.fields>1?2:1, gut=34;
  const fw=(W-2*M-48-(cols-1)*gut)/cols, fh=g.rows*16+30, SY=PY+PH+36, FY=SY+34;
  const fields=[], trenches=[], L=i=>String.fromCharCode(65+i);
  for(let i=0;i<g.fields;i++){ const c=i%cols, r=Math.floor(i/cols); fields.push({id:"f"+(i+1),kind:"pv",name:names[i]||("שדה "+L(i)),x:M+24+c*(fw+gut),y:FY+r*(fh+gut),w:fw,h:fh,rows:g.rows}); }
  const H=(fields.length?fields[fields.length-1].y+fh:FY)+M+24;
  const right=Math.max(...fields.map(f=>f.x+f.w),...pads.map(p=>p.x+p.w),M+200);
  trenches.push({id:"t0",name:"תעלה ראשית",pts:[[M+24,SY],[right,SY]]});
  fields.forEach((f,i)=>{ const tx=f.x+f.w/2; trenches.push({id:"t"+(i+1),name:"תעלה "+f.name,pts:f.y-SY<60?[[tx,SY],[tx,f.y+4]]:[[f.x-gut/2,SY],[f.x-gut/2,f.y-12],[tx,f.y-12],[tx,f.y+4]]}); });
  pads.forEach(p=>{ trenches.push({id:"t_"+p.id,name:"תעלה "+p.name,pts:[[p.x+p.w/2,p.y+p.h],[p.x+p.w/2,SY]]}); });
  trenches.forEach(t=>{ let s=0; for(let i=1;i<t.pts.length;i++) s+=Math.hypot(t.pts[i][0]-t.pts[i-1][0],t.pts[i][1]-t.pts[i-1][1]); t.len=s; });
  return {w:W,h:H,fence:[M,M,W-2*M,H-2*M],pads,fields,trenches,gen:g};
}

/* ---- קישור שלבים לסעיפים ---- */
export function phaseActs(ph,acts,map){
  const m=map&&map[ph.k];
  if(m==="none") return [];
  if(m) return acts.filter(a=>a.id===m);
  return acts.filter(a=>{ const n=a.name||""; if(!ph.re.test(n)||(ph.ex&&ph.ex.test(n))) return false; if(ph.meters&&!/מ׳|מ'|^מ$|מטר/.test(a.unit||"")) return false; return true; });
}
function targetsOf(L,on){
  if(on==="trench") return L.trenches.map(t=>({id:t.id,name:t.name,w:t.len}));
  if(on==="pv") return L.fields.map(f=>({id:f.id,name:f.name,w:f.rows}));
  const P=L.pads.filter(p=>p.kind!=="room");
  if(on==="pad") return P.map(p=>({id:p.id,name:p.name,w:p.w*p.h}));
  if(on==="bess") return P.filter(p=>p.kind==="bess").map(p=>({id:p.id,name:p.name,w:p.units}));
  if(on==="mvs") return P.filter(p=>p.kind!=="bess").map(p=>({id:p.id,name:p.name,w:p.units}));
  return P.map(p=>({id:p.id,name:p.name,w:p.units}));
}
// אזור הדיווח → יעד באיור: השם המנורמל של היעד מופיע באזור (הארוך ביותר מנצח: «תעלה שדה A» לפני «שדה A»)
function matchArea(area,T){ const a=norm(area); if(!a) return -1; let best=-1,bl=0; T.forEach((t,i)=>{ const n=norm(t.name); if(n&&a.includes(n)&&n.length>bl){ best=i; bl=n.length; } }); return best; }

export function stagesModel(L,acts,map,todayIso){
  const P=PHASES.map(ph=>{
    const A=phaseActs(ph,acts,map); const T=targetsOf(L,ph.on); const sw=T.reduce((s,t)=>s+t.w,0);
    const E=A.flatMap(a=>(a.daily||[]).filter(d=>Number(d.actual)&&d.date).map(d=>({t:dt(d.date),q:Number(d.actual),i:matchArea(d.area,T)}))).sort((x,y)=>x.t-y.t);
    const rep=E.reduce((s,e)=>s+e.q,0), total=A.reduce((s,a)=>s+(Number(a.total)||0),0)||rep;
    return {...ph,A,T,sw,E,rep,total,unit:(A[0]&&A[0].unit)||"",linked:A.length>0,applies:T.length>0,last:E.length?E[E.length-1].t:0};
  });
  const firsts=P.filter(p=>p.E.length).map(p=>p.E[0].t);
  const dEnd=dt(todayIso)+DAY; let d0=firsts.length?Math.min(...firsts)-5*DAY:dEnd-30*DAY;
  if(L.gen&&L.gen.start&&dt(L.gen.start)<d0) d0=dt(L.gen.start);
  const u2t=u=>d0+u*(dEnd-d0), t2u=t=>clamp((t-d0)/(dEnd-d0));
  const ids=[...L.trenches.map(t=>[t.id,"trench"]),...L.pads.filter(p=>p.kind!=="room").map(p=>[p.id,p.kind]),...L.fields.map(f=>[f.id,"pv"])];
  // מצב בזמן t: לכל יעד שבר לכל שלב (מיושר לסדר), ולכל שלב הכמות שדווחה עד t (אמיתית)
  const state=u=>{
    const t=u2t(u), F={}, V={}; ids.forEach(([id])=>F[id]={});
    for(const p of P){ if(!p.applies) continue; const cap=p.T.map(x=>p.sw?p.total*x.w/p.sw:0), fill=p.T.map(()=>0); let pool=0, sum=0;
      for(const e of p.E){ if(e.t>=t) break; const q=e.q*clamp((t-e.t)/DAY); sum+=q;
        if(e.i>=0){ const g=Math.min(q,Math.max(0,cap[e.i]-fill[e.i])); fill[e.i]+=g; pool+=q-g; } else pool+=q; }
      for(let i=0;i<fill.length&&pool>0;i++){ const g=Math.min(pool,Math.max(0,cap[i]-fill[i])); fill[i]+=g; pool-=g; }
      p.T.forEach((x,i)=>{ F[x.id][p.k]=cap[i]?clamp(fill[i]/cap[i]):0; }); V[p.k]=sum; }
    ids.forEach(([id,kind])=>{ const ch=CHAIN[kind]||[]; const f=F[id]; for(let j=ch.length-1;j>0;j--) f[ch[j-1]]=Math.max(f[ch[j-1]]||0,f[ch[j]]||0); });
    return {t,F,V,today:u>0.999};
  };
  return {L,P,d0,dEnd,u2t,t2u,state};
}

/* ---- ציור ---- */
let M=null, cv, ctx, u=1, playing=0, built=false, BRAND="#3F4447", SC=1;
export function siteStagesState(uu){ return M?M.state(uu==null?u:uu):null; }
function partial(pts,f){ // הקטע הראשון באורך f מהקו
  let tot=0; const seg=[]; for(let i=1;i<pts.length;i++){ const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(l); tot+=l; }
  let left=f*tot; const out=[pts[0]]; for(let i=1;i<pts.length&&left>0;i++){ const l=seg[i-1]; if(left>=l){ out.push(pts[i]); left-=l; } else { const r=left/l; out.push([pts[i-1][0]+(pts[i][0]-pts[i-1][0])*r,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*r]); left=0; } }
  return out;
}
function line(pts,w,c,dash){ if(pts.length<2) return; ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.lineWidth=w; ctx.strokeStyle=c; ctx.setLineDash(dash||[]); ctx.lineCap=dash?"butt":"round"; ctx.lineJoin="round"; ctx.stroke(); ctx.setLineDash([]); }
function label(txt,x,y,al){ ctx.font="600 "+Math.round(11/SC)+"px Alef, Heebo, Arial, sans-serif"; ctx.fillStyle="#3F4447"; ctx.textAlign=al||"center"; ctx.textBaseline="bottom"; ctx.direction="rtl"; ctx.fillText(txt,x,y); }
function draw(){
  if(!M||!cv||!cv.width) return; const s=M.state(u); ui(s); const L=M.L, F=s.F;
  ctx.fillStyle="#FFFFFF"; ctx.fillRect(0,0,L.w,L.h);
  const [fx,fy,fw,fh]=L.fence; ctx.fillStyle="#F4EFE6"; ctx.fillRect(fx,fy,fw,fh);
  // גדר: קו מקווקו עם עמודים, שער באמצע הצד העליון
  ctx.strokeStyle="#8E9193"; ctx.lineWidth=2; ctx.setLineDash([10,6]); ctx.strokeRect(fx,fy,fw,fh); ctx.setLineDash([]);
  ctx.fillStyle="#666B6E"; for(let x=fx;x<=fx+fw+.1;x+=40){ ctx.fillRect(x-2,fy-2,4,4); ctx.fillRect(x-2,fy+fh-2,4,4); } for(let y=fy;y<=fy+fh+.1;y+=40){ ctx.fillRect(fx-2,y-2,4,4); ctx.fillRect(fx+fw-2,y-2,4,4); }
  ctx.fillStyle="#F4EFE6"; ctx.fillRect(fx+fw/2-26,fy-4,52,8); label("שער",fx+fw/2,fy-4);
  // תעלות: מתוכנן מקווקו → נחפר (חום) → כבל (כהה) → מכוסה (חול, עם קו כבל קבור)
  for(const t of L.trenches){ const f=F[t.id]||{};
    line(t.pts,1.5,"#A0703C",[6,5]);
    if(f.dig>0) line(partial(t.pts,f.dig),10,"#A0703C");
    if(f.cable>0) line(partial(t.pts,f.cable),3,"#2A2E30");
    if(f.cover>0){ const p=partial(t.pts,f.cover); line(p,11,"#CDBB97"); line(p,1.5,"#7A6A4E",[4,4]); } }
  // משטחים
  for(const p of L.pads){ const f=F[p.id]||{};
    if(p.kind==="room"){ ctx.fillStyle="#E4E1DA"; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.strokeStyle="#666B6E"; ctx.lineWidth=1.5; ctx.strokeRect(p.x,p.y,p.w,p.h); label(p.name,p.x+p.w/2,p.y-4); continue; }
    ctx.strokeStyle="#9A9EA1"; ctx.lineWidth=1.2; ctx.setLineDash([5,4]); ctx.strokeRect(p.x,p.y,p.w,p.h); ctx.setLineDash([]);
    if(f.base>0){ ctx.save(); ctx.beginPath(); ctx.rect(p.x,p.y,p.w*f.base,p.h); ctx.clip(); ctx.fillStyle="#DCDDDD"; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.strokeStyle="#A9ACAE"; ctx.lineWidth=1; ctx.beginPath(); for(let k=-p.h;k<p.w;k+=7){ ctx.moveTo(p.x+k,p.y+p.h); ctx.lineTo(p.x+k+p.h,p.y); } ctx.stroke(); ctx.restore(); }
    if(f.conc>0){ ctx.fillStyle="#C4C6C7"; ctx.fillRect(p.x,p.y,p.w*f.conc,p.h); ctx.strokeStyle="#7E8386"; ctx.lineWidth=1.5; ctx.strokeRect(p.x,p.y,p.w*f.conc,p.h); }
    const set=p.kind==="bess"?f.bess:f.skid, n=p.units||1, cols=p.kind==="bess"?Math.ceil(n/2):1, rows=p.kind==="bess"?Math.min(2,n):1;
    const cw=(p.w-12-(cols-1)*6)/cols, chh=(p.h-12-(rows-1)*6)/rows;
    for(let k=0;k<n;k++){ const have=clamp((set||0)*n-k); if(have<=0) break; const c=Math.floor(k/rows), r=k%rows, x=p.x+6+c*(cw+6), y=p.y+6+r*(chh+6);
      ctx.globalAlpha=Math.max(.15,have); ctx.fillStyle=p.kind==="bess"?"#3F4447":"#5B6266"; ctx.fillRect(x,y,cw,chh); ctx.fillStyle="#FFFFFF"; ctx.globalAlpha*=.35; for(let z=x+6;z<x+cw-3;z+=6) ctx.fillRect(z,y+3,1.5,chh-6); ctx.globalAlpha=1;
      const wv=clamp((f.wire||0)*n-k); if(wv>0){ ctx.strokeStyle=BRAND; ctx.lineWidth=2.5; ctx.strokeRect(x-1.5,y-1.5,(cw+3)*wv,chh+3); } }
    label(p.name,p.x+p.w/2,p.y-4); }
  // שדות: שורות מתוכננות → עמודים → פאנלים → שרשורים
  for(const fl of L.fields){ const f=F[fl.id]||{}, n=fl.rows, x0=fl.x+10, x1=fl.x+fl.w-10, rw=x1-x0;
    ctx.strokeStyle="#C9CBCC"; ctx.lineWidth=1; ctx.setLineDash([4,4]); ctx.strokeRect(fl.x,fl.y,fl.w,fl.h); ctx.setLineDash([]);
    label(fl.name,fl.x+fl.w-6,fl.y+16,"right");
    for(let r=0;r<n;r++){ const y=fl.y+22+r*16, pp=clamp((f.piles||0)*n-r), pn=clamp((f.panels||0)*n-r), ps=clamp((f.strings||0)*n-r);
      ctx.strokeStyle="#D3D5D6"; ctx.lineWidth=.8; ctx.setLineDash([3,3]); ctx.strokeRect(x0,y,rw,9); ctx.setLineDash([]);
      if(pp>0){ ctx.fillStyle="#666B6E"; const k=Math.max(2,Math.round(rw/16)); for(let j=0;j<k;j++){ const px=x1-(j+.5)*rw/k; if(px<x1-rw*pp) break; ctx.fillRect(px-1.4,y+3.1,2.8,2.8); } }
      // פאנלים ושרשורים מתמלאים מימין לשמאל, כמו הקריאה
      if(pn>0){ ctx.fillStyle="#D3E9F5"; ctx.fillRect(x1-rw*pn,y,rw*pn,9); ctx.strokeStyle="#1E7FB0"; ctx.lineWidth=1; ctx.strokeRect(x1-rw*pn,y,rw*pn,9); }
      if(ps>0){ ctx.fillStyle=BRAND; ctx.fillRect(x1-rw*ps,y+3.5,rw*ps,2.5); } } }
}

function ui(s){
  $("#ssRange").value=Math.round(u*1000);
  const isToday=u>0.999; $("#ssDate").textContent=isToday?isoText(isoOf(Date.now())):ddmm(s.t); $("#ssToday").style.opacity=isToday?1:0;
  let num=0, den=0;
  M.P.forEach(p=>{ const el=document.getElementById("ss_"+p.k); if(!el) return; const v=s.V[p.k]||0;
    el.querySelector(".v").textContent=p.linked?fmtN(Math.round(v)):"—";
    el.querySelector(".bar span").style.width=(p.linked&&p.total?clamp(v/p.total)*100:0)+"%";
    if(p.linked&&p.applies&&p.total){ num+=clamp(v/p.total); den++; } });
  const pct=den?Math.round(num/den*100):0; $("#ssBig").textContent=pct+"%";
  const done=M.P.filter(p=>p.linked&&p.applies&&p.total&&(s.V[p.k]||0)>=p.total-1e-6).map(p=>p.l), on=M.P.filter(p=>p.linked&&p.applies&&(s.V[p.k]||0)>0&&(s.V[p.k]||0)<p.total-1e-6).map(p=>p.l);
  $("#ssSub").innerHTML=!on.length&&!done.length?"<b>אדמה ריקה וגדר.</b> מכאן זה מתחיל.":(on.length?"<b>בעבודה:</b> "+esc(on.join(", ")):"")+(done.length?(on.length?" · ":"")+"<b>הושלם:</b> "+esc(done.join(", ")):"");
}

function buildDom(){
  const box=$("#ssBody"); if(!box||built) return; built=true;
  box.innerHTML='<div class="sb-lead"><span class="sb-big num" id="ssBig">0%</span><span class="sb-cap">מהשלבים שבאיור, ממוצע</span></div><div class="sb-sub" id="ssSub"></div>'
    +'<div class="sb-ph"><span class="sb-date num" id="ssDate"></span><span class="sb-today" id="ssToday">היום</span></div>'
    +'<div class="ss-cvw"><canvas id="ssCv" aria-label="איור האתר מלמעלה לפי שלבי הביצוע"></canvas></div>'
    +'<div class="sb-keys"><span><i style="border-top:2px dashed #A0703C;height:0;border-radius:0"></i>תעלה מתוכננת</span><span><i style="background:#A0703C"></i>נחפרה</span><span><i style="background:#2A2E30;height:4px"></i>כבל</span><span><i style="background:#CDBB97"></i>כוסתה</span><span><i style="background:#DCDDDD;border:1px solid #A9ACAE"></i>מצעים</span><span><i style="background:#C4C6C7;border:1px solid #7E8386"></i>בטון</span><span><i style="background:#3F4447"></i>מכולה / סקיד</span><span><i style="background:#D3E9F5;border:1px solid #1E7FB0"></i>פאנלים</span><span><i style="background:var(--brand)"></i>שרשור / חיווט</span></div>'
    +'<input type="range" class="ss-range" id="ssRange" min="0" max="1000" value="1000" aria-label="ציר זמן: היום משמאל">'
    +'<div class="sb-ctrl"><span class="hint">היום משמאל. גררו ימינה כדי לחזור לאדמה הריקה.</span><div class="sb-btns"><button class="sb-go" id="ssPlay" type="button">הפעלה מההתחלה</button></div></div>'
    +'<div id="ssStats"></div><div class="note" id="ssNote" style="margin:8px 0 0"></div>'
    +'<button class="ghost strong" id="ssEdit" type="button" data-w="owner" style="width:100%;margin:10px 0 0">מבנה האתר וקישור לסעיפים</button>';
  cv=$("#ssCv"); ctx=cv.getContext("2d");
  $("#ssRange").addEventListener("input",e=>{ stopPlay(); u=Number(e.target.value)/1000; draw(); });
  $("#ssPlay").onclick=()=>{ if(playing){ stopPlay(); return; } if(typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches){ u=1; draw(); return; }
    $("#ssPlay").textContent="עצירה"; const t0=performance.now(), dur=12000;
    const tick=now=>{ const x=Math.min(1,(now-t0)/dur); u=x; draw(); if(x<1) playing=requestAnimationFrame(tick); else stopPlay(); }; playing=requestAnimationFrame(tick); };
  $("#ssEdit").onclick=openLayout;
  const el=$("#ssEdit"); el.classList.add("w-owner");
  addEventListener("resize",()=>{ clearTimeout(size.t); size.t=setTimeout(size,80); });
}
function stopPlay(){ if(playing) cancelAnimationFrame(playing); playing=0; const b=$("#ssPlay"); if(b) b.textContent="הפעלה מההתחלה"; }
function size(){ if(!M||!cv) return; const W=cv.parentElement.clientWidth; if(!W) return; const dpr=Math.min(2.5,window.devicePixelRatio||1), sc=W/M.L.w; SC=sc;
  cv.width=Math.round(W*dpr); cv.height=Math.round(M.L.h*sc*dpr); cv.style.height=(M.L.h*sc)+"px"; ctx.setTransform(dpr*sc,0,0,dpr*sc,0,0); draw(); }

function layoutDoc(){ return shared.LAYOUT||null; }
export function currentLayout(){ const d=layoutDoc(); return genLayout(d&&d.gen); }

// נקרא מ-renderStatus בכל שינוי בסטטוס
export function renderSiteStages(){
  const card=$("#stagesCard"); if(!card) return; buildDom();
  const acts=shared.demoStock?[]:(shared.STATUS||[]); const d=layoutDoc();
  const L=genLayout(d&&d.gen); M=stagesModel(L,acts,d&&d.map,isoOf(Date.now()));
  const has=M.P.some(p=>p.linked&&p.applies);
  $("#ssEmpty").hidden=has; $("#ssBody").hidden=!has;
  if(!has){ foldSum("stages",""); return; }
  try{ const b=getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(); if(b) BRAND=b; }catch(e){}
  // כרטיסי שלב לפי קבוצה: כמה דווח מתוך הכמות בסעיפים, או «לא מקושר»
  $("#ssStats").innerHTML=Object.keys(GROUPS).map(g=>{ const ps=M.P.filter(p=>p.g===g&&p.applies); if(!ps.length) return "";
    return '<div class="ss-grp"><div class="ss-gh">'+GROUPS[g]+'</div>'+ps.map(p=>'<div class="ss-ph'+(p.linked?'':' off')+'" id="ss_'+p.k+'"><span class="k"><i style="background:'+(p.c==="brand"?"var(--brand)":p.c)+'"></i>'+esc(p.l)+'</span><span class="n"><b class="v num">0</b>'+(p.linked?' <small>מתוך '+fmtN(p.total)+(p.unit?' '+esc(p.unit):'')+'</small>':' <small>לא מקושר לסעיף</small>')+'</span><div class="bar"><span style="background:'+(p.c==="brand"?"var(--brand)":p.c)+'"></span></div>'
      +(p.linked?'<span class="src">'+esc(p.A.map(a=>(a.code?a.code+" ":"")+a.name).join(" · "))+(p.last?' · עדכון אחרון '+isoText(isoOf(p.last)):'')+'</span>':'')+'</div>').join("")+'</div>'; }).join("");
  $("#ssNote").textContent="סכמה, לא בקנה מידה: "+L.fields.length+" שדות, "+L.pads.filter(p=>p.kind==="mvs").length+" MVS, "+L.pads.filter(p=>p.kind==="skid").length+" סקידים, "+((L.pads.find(p=>p.kind==="bess")||{}).units||0)+" מכולות אגירה"+(d?"":" (ברירת מחדל, «מבנה האתר» מתאים לאתר)")+". הכמויות מדיווחי הביצוע; דיווח עם אזור בשם שמופיע באיור נצבע שם, השאר לפי הסדר. שלב מאוחר מושך בציור את הקודמים.";
  const s=M.state(1); const tot=M.P.filter(p=>p.linked&&p.applies&&p.total); foldSum("stages",tot.length?Math.round(tot.reduce((a,p)=>a+clamp((s.V[p.k]||0)/p.total),0)/tot.length*100)+"% · "+tot.length+" שלבים":"");
  if(!playing) u=clamp(u); size(); if(!cv.width) draw();
}

/* ---- מבנה האתר: מספרים + קישור שלב → סעיף ---- */
export async function saveLayout(doc){
  doc.ts=Date.now();
  if(shared.DB) await shared.DB.doc("settings/layout").set(doc); else { ls.set("layout",JSON.stringify(doc)); shared.LAYOUT=doc; renderSiteStages(); }
}
export function openLayout(){
  const d=layoutDoc()||{}, g={...LAYOUT_DEFAULT,...(d.gen||{})}, map=d.map||{}; const acts=(shared.STATUS||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  const N=(id,l,v,max)=>'<div class="f"><label for="'+id+'">'+l+'</label><input type="number" inputmode="numeric" min="0" max="'+max+'" id="'+id+'" value="'+esc(v)+'"></div>';
  const sel=p=>'<div class="f"><label for="lm_'+p.k+'">'+esc(p.l)+'</label><select id="lm_'+p.k+'"><option value="">אוטומטי לפי השם'+(map[p.k]?'':' ('+esc(phaseActs(p,acts,null).map(a=>a.code||a.name).join(", ")||"אין")+')')+'</option><option value="none"'+(map[p.k]==="none"?" selected":"")+'>לא במעקב</option>'+acts.map(a=>'<option value="'+esc(a.id)+'"'+(map[p.k]===a.id?" selected":"")+'>'+esc((a.code?a.code+" · ":"")+a.name)+'</option>').join("")+'</select></div>';
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="מבנה האתר"><div class="grab"></div><h2>מבנה האתר</h2>'
    +'<div class="hint" style="margin:0 0 10px">האיור הוא סכמה מהמספרים, לא בקנה מידה. שמות השדות הם גם מה שכותבים ב«אזור» בדיווח הביצוע כדי שהכמות תיצבע במקום הנכון.</div>'
    +'<div class="row2">'+N("lyFields","שדות פאנלים",g.fields,24)+N("lyRows","שורות בכל שדה",g.rows,40)+'</div>'
    +'<div class="row2">'+N("lyMvs","תחנות MVS",g.mvs,24)+N("lySkids","סקידים",g.skids,24)+'</div>'
    +'<div class="row2">'+N("lyBess","מכולות אגירה",g.bess,24)+'<div class="f"><label for="lyRoom">חדר חשמל</label><select id="lyRoom"><option value="1"'+(g.room?" selected":"")+'>יש</option><option value="0"'+(g.room?"":" selected")+'>אין</option></select></div></div>'
    +'<div class="f"><label for="lyNames">שמות השדות (לא חובה, מופרדים בפסיק)</label><input type="text" id="lyNames" value="'+esc(g.names||"")+'" placeholder="למשל: B1, B2, B3, B4" autocomplete="off"></div>'
    +'<div class="f"><label for="lyStart">מתי השטח היה ריק (לא חובה)</label><input type="date" id="lyStart" value="'+esc(g.start||"")+'"></div>'
    +'<h3 style="margin:14px 0 6px;font-size:.95rem">כל שלב באיור: מאיזה סעיף בסטטוס</h3>'
    +PHASES.map(sel).join("")
    +'<div class="acts"><button class="save" id="lySave" type="button">שמור</button><button class="cancel" id="lyCancel" type="button">סגור</button></div></div>');
  const q=s=>scrim.querySelector(s);
  q("#lyCancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
  if(ROLE!=="owner"){ q("#lySave").hidden=true; scrim.querySelectorAll("input,select").forEach(i=>i.disabled=true); }
  q("#lySave").onclick=async()=>{
    const gen={fields:+q("#lyFields").value,rows:+q("#lyRows").value,mvs:+q("#lyMvs").value,skids:+q("#lySkids").value,bess:+q("#lyBess").value,room:+q("#lyRoom").value,names:q("#lyNames").value.trim(),start:q("#lyStart").value||""};
    const m={}; PHASES.forEach(p=>{ const v=q("#lm_"+p.k).value; if(v) m[p.k]=v; });
    const b=q("#lySave"); b.disabled=true; b.textContent="שומר…";
    try{ await saveLayout({gen:genLayout(gen).gen,map:m}); }catch(e){ b.disabled=false; b.textContent="שמור"; toast("השמירה נכשלה."); return; }
    logAct("settings","edit","מבנה האתר: "+gen.fields+" שדות, "+gen.mvs+" MVS, "+gen.skids+" סקידים, "+gen.bess+" מכולות","settings/layout");
    scrim.remove(); toast("מבנה האתר נשמר.");
  };
}
export function __init(){ try{ const v=ls.get("layout"); if(v&&!shared.LAYOUT) shared.LAYOUT=JSON.parse(v); }catch(e){} }
