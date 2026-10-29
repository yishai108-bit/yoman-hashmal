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
import { siteMap } from "./19-site-build.js";

const DAY=864e5;
// k, שם, על מה (trench / pad / bess / mvs / wire / pv), זיהוי לפי שם הסעיף, החרגה, צבע, קבוצה
export const PHASES=[
  {k:"dig",l:"חפירת תעלות",on:"trench",re:/חפיר|פתיחת תעל/,c:"#A0703C",g:"t"},
  {k:"cable",l:"כבלים בתעלה",on:"trench",re:/כבל|קוברה/,ex:/מכול|ראשי כבל|לוח/,meters:true,c:"#3F4447",g:"t"},
  {k:"cover",l:"כיסוי תעלות",on:"trench",re:/כיסוי|סגירת תעל|מילוי תעל/,c:"#CDBB97",g:"t"},
  {k:"base",l:"מצעים",on:"pad",re:/מצע/,c:"#A9ACAE",g:"p"},
  {k:"conc",l:"בטונים",on:"pad",re:/בטון|יציקת/,ex:/שוח/,c:"#7E8386",g:"p"},
  {k:"bess",l:"מכולות וסוללות",on:"bess",re:/מכולות|סוללות|מצבר/,ex:/שרשור|קירור|תאורה|איטום|צנרת|גילוי|כבל|CAT|פתחי|חיווט|MVS/,c:"#3F4447",g:"p"},
  {k:"skid",l:"הצבת MVS וסקידים",on:"mvs",re:/הצבת|סקיד|MVS/,ex:/סיב|כבל|הארק|ראשי|מגיני|בדיק|שילוט|טבעת|סדר|חיווט|AUX|אגירה|סוללות/,c:"#5B6266",g:"p"},
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

/* ---- מבנה מתוכנית האתר: Claude קורא את התוכנית ומחזיר שדות, משטחים ותעלות בקואורדינטות 0–1000 של התמונה ----
   אותו פורמט אפשר להדביק ידנית (JSON). כל אתר והמפה שלו; הציור עדיין סכמתי, רק המיקומים והפרופורציות מהתוכנית. */
export const PLAN_PROMPT="בתמונה תוכנית של אתר סולארי (מבט מלמעלה). בנה ממנה מבנה סכמתי לאיור התקדמות של קבלן החשמל. "
  +"קואורדינטות: x ו-y מ-0 עד 1000 על פני התמונה (0,0 בפינה השמאלית העליונה). החזר רק JSON: "
  +'{"fence":[x,y,w,h] או null,'
  +'"fields":[{"name":"<שם השדה / הבלוק כפי שמופיע בתוכנית, אחרת A, B, C…>","x":0,"y":0,"w":0,"h":0,"rows":<מספר שורות השולחנות המשוער בשדה>}],'
  +'"pads":[{"kind":"bess|mvs|skid|room","name":"<כפי שמופיע: MVS 1, סקיד 2, אגירה, חדר חשמל>","x":0,"y":0,"w":0,"h":0,"units":<מכולות / יחידות במשטח>}],'
  +'"trenches":[{"name":"<שם או תיאור קצר: תעלה ראשית, תעלה שדה A…>","pts":[[x,y],[x,y]]}]}. '
  +"fields = אזורי הפאנלים (מלבן חוסם לכל בלוק). pads = מתחם אגירה (bess), תחנות MVS / שנאים (mvs), סקידים (skid), חדר חשמל (room). "
  +"trenches = תוואי התעלות / הכבילה הראשיים (קווים שבורים, עד 6 נקודות לכל אחד, עד 30 תעלות). אם אין תעלות מסומנות, החזר trenches ריק. "
  +"אל תמציא אזורים שלא בתוכנית. בלי מידות ובלי טקסט נוסף.";
const num=v=>Number.isFinite(Number(v))?Number(v):NaN;
// מבנה מפורש (מהתוכנית או מודבק) → המבנה הפנימי של הציור. null אם אין בו כלום שאפשר לצייר.
export function normLayout(raw){
  if(!raw||typeof raw!=="object") return null;
  const box=o=>{ const x=num(o.x),y=num(o.y),w=num(o.w),h=num(o.h); return [x,y,w,h].every(Number.isFinite)&&w>0&&h>0?{x,y,w,h}:null; };
  const fields=(Array.isArray(raw.fields)?raw.fields:[]).map((f,i)=>{ const b=box(f||{}); return b&&{...b,id:"f"+(i+1),kind:"pv",name:String(f.name||("שדה "+String.fromCharCode(65+i))).slice(0,30),rows:Math.max(1,Math.min(60,Math.round(num(f.rows)||Math.max(2,b.h/20))))}; }).filter(Boolean).slice(0,40);
  const pc={}; const pads=(Array.isArray(raw.pads)?raw.pads:[]).map(p=>{ const b=box(p||{}); const kind=["bess","mvs","skid","room"].includes(p&&p.kind)?p.kind:null; if(!b||!kind) return null; pc[kind]=(pc[kind]||0)+1;
    return {...b,kind,id:kind+pc[kind],name:String(p.name||({bess:"אגירה",mvs:"MVS",skid:"סקיד",room:"חדר חשמל"}[kind]+(kind==="room"?"":" "+pc[kind]))).slice(0,30),units:Math.max(1,Math.min(60,Math.round(num(p.units)||1)))}; }).filter(Boolean).slice(0,40);
  const trenches=(Array.isArray(raw.trenches)?raw.trenches:[]).map((t,i)=>{ const pts=(Array.isArray(t&&t.pts)?t.pts:[]).map(q=>[num(q&&q[0]),num(q&&q[1])]).filter(q=>q.every(Number.isFinite)); return pts.length>=2&&{id:"t"+i,name:String(t.name||("תעלה "+(i+1))).slice(0,40),pts}; }).filter(Boolean).slice(0,60);
  if(!fields.length&&!pads.length&&!trenches.length) return null;
  // גבולות: הגדר אם יש, אחרת המלבן החוסם; מתיחה לרוחב 620 עם שוליים
  const all=[...fields,...pads].flatMap(b=>[[b.x,b.y],[b.x+b.w,b.y+b.h]]).concat(trenches.flatMap(t=>t.pts));
  let fx,fy,fw,fh; const fb=Array.isArray(raw.fence)&&raw.fence.length===4&&raw.fence.map(num);
  if(fb&&fb.every(Number.isFinite)&&fb[2]>0&&fb[3]>0) [fx,fy,fw,fh]=fb; else { const xs=all.map(q=>q[0]),ys=all.map(q=>q[1]); fx=Math.min(...xs); fy=Math.min(...ys); fw=Math.max(...xs)-fx||1; fh=Math.max(...ys)-fy||1; }
  const M=30, PAD=24, W=620, k=(W-2*M-2*PAD)/fw, X=x=>M+PAD+(x-fx)*k, Y=y=>M+PAD+16+(y-fy)*k;
  const tb=b=>({...b,x:X(b.x),y:Y(b.y),w:b.w*k,h:b.h*k});
  const L={w:W,h:Math.round(fh*k+2*M+2*PAD+16),fence:[M,M,W-2*M,Math.round(fh*k+2*PAD+16)],fields:fields.map(tb),pads:pads.map(tb),
    trenches:trenches.map(t=>({...t,pts:t.pts.map(([x,y])=>[X(x),Y(y)])})),fromPlan:true};
  L.trenches.forEach(t=>{ let s=0; for(let i=1;i<t.pts.length;i++) s+=Math.hypot(t.pts[i][0]-t.pts[i-1][0],t.pts[i][1]-t.pts[i-1][1]); t.len=s||1; });
  return L;
}
/* ---- מבנה ממפת השולחנות (site-maps.js, כשיש לאתר): לומדים את המפה. השולחנות מתקבצים לרבעים לפי הפער הגדול
   בין העמודות (דרך) ולפי אמצע השורות: צפון מערב / צפון מזרח / דרום מערב / דרום מזרח, כמו שהצוות מדווח. בלי משטחים ותעלות
   (לא במפת השולחנות); אלה מגיעים מהתוכנית או מהמספרים. */
export function layoutFromTables(map){
  const T=map&&Array.isArray(map.tables)?map.tables.filter(t=>Array.isArray(t)&&t.length>=4):[]; if(T.length<4) return null;
  const rowsY=[...new Set(T.map(t=>t[1]))].sort((a,b)=>a-b);
  // פער עמודות (דרך): בכל שורה הפער הפנימי הגדול ביותר; הדרך יכולה להיות אלכסונית, ולכן ההחלטה לשולחן לפי השורה שלו
  const gapAt={}; let withGap=0; rowsY.forEach(y=>{ const r=T.filter(t=>t[1]===y).sort((a,b)=>a[0]-b[0]); let g=0,c=null; for(let i=1;i<r.length;i++){ const d=r[i][0]-(r[i-1][0]+r[i-1][2]); if(d>g){ g=d; c=r[i-1][0]+r[i-1][2]+d/2; } } if(g>6){ gapAt[y]=c; withGap++; } });
  const split=withGap>=rowsY.length*.6; const gapOf=y=>{ if(gapAt[y]!=null) return gapAt[y]; let best=null,bd=Infinity; for(const k in gapAt){ const d=Math.abs(k-y); if(d<bd){ bd=d; best=gapAt[k]; } } return best; };
  const midY=rowsY.length>=6?(rowsY[Math.floor(rowsY.length/2)-1]+rowsY[Math.floor(rowsY.length/2)])/2:null;
  const q=[]; const push=(name,sel)=>{ const S=T.filter(sel); if(!S.length) return; const x0=Math.min(...S.map(t=>t[0])),x1=Math.max(...S.map(t=>t[0]+t[2])),y0=Math.min(...S.map(t=>t[1])),y1=Math.max(...S.map(t=>t[1]+t[3]));
    q.push({name,x:x0,y:y0,w:x1-x0,h:y1-y0,rows:new Set(S.map(t=>t[1])).size}); };
  const W=t=>!split||t[0]+t[2]/2<gapOf(t[1]), N=t=>midY==null||t[1]<midY;
  if(split&&midY!=null){ push("צפון מערב",t=>W(t)&&N(t)); push("צפון מזרח",t=>!W(t)&&N(t)); push("דרום מערב",t=>W(t)&&!N(t)); push("דרום מזרח",t=>!W(t)&&!N(t)); }
  else if(split){ push("מערב",W); push("מזרח",t=>!W(t)); } else if(midY!=null){ push("צפון",N); push("דרום",t=>!N(t)); } else push("השדה",()=>true);
  const x0=Math.min(...T.map(t=>t[0])),x1=Math.max(...T.map(t=>t[0]+t[2])),y0=Math.min(...T.map(t=>t[1])),y1=Math.max(...T.map(t=>t[1]+t[3])), m=Math.max(8,(x1-x0)*.03);
  return {fence:[x0-m,y0-m,x1-x0+2*m,y1-y0+2*m],fields:q,pads:[],trenches:[],fromTables:true};
}
export function layoutOf(d){ const raw=d&&d.layout?d.layout:(!d&&layoutFromTables(siteMap())); const L=raw?normLayout(raw):null; if(L&&raw.fromTables) L.fromTables=true; const out=L||genLayout(d&&d.gen); if(L) L.gen={...LAYOUT_DEFAULT,...((d&&d.gen)||{})}; return out; }
const layoutSummary=L=>L.fields.length+" שדות, "+L.pads.filter(p=>p.kind==="mvs").length+" MVS, "+L.pads.filter(p=>p.kind==="skid").length+" סקידים, "+L.pads.filter(p=>p.kind==="bess").reduce((a,p)=>a+p.units,0)+" מכולות אגירה, "+L.trenches.length+" תעלות";

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
function label(txt,x,y,al,maxW){ let fs=11/SC; ctx.font="600 "+fs+"px Alef, Heebo, Arial, sans-serif"; if(maxW){ const w=ctx.measureText(txt).width; if(w>maxW){ fs*=maxW/w; ctx.font="600 "+fs+"px Alef, Heebo, Arial, sans-serif"; } } ctx.fillStyle="#3F4447"; ctx.textAlign=al||"center"; ctx.textBaseline="bottom"; ctx.direction="rtl"; ctx.fillText(txt,x,y); }
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
    if(p.kind==="room"){ ctx.fillStyle="#E4E1DA"; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.strokeStyle="#666B6E"; ctx.lineWidth=1.5; ctx.strokeRect(p.x,p.y,p.w,p.h); label(p.name,p.x+p.w/2,p.y-4,null,p.w+8); continue; }
    ctx.strokeStyle="#9A9EA1"; ctx.lineWidth=1.2; ctx.setLineDash([5,4]); ctx.strokeRect(p.x,p.y,p.w,p.h); ctx.setLineDash([]);
    if(f.base>0){ ctx.save(); ctx.beginPath(); ctx.rect(p.x,p.y,p.w*f.base,p.h); ctx.clip(); ctx.fillStyle="#DCDDDD"; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.strokeStyle="#A9ACAE"; ctx.lineWidth=1; ctx.beginPath(); for(let k=-p.h;k<p.w;k+=7){ ctx.moveTo(p.x+k,p.y+p.h); ctx.lineTo(p.x+k+p.h,p.y); } ctx.stroke(); ctx.restore(); }
    if(f.conc>0){ ctx.fillStyle="#C4C6C7"; ctx.fillRect(p.x,p.y,p.w*f.conc,p.h); ctx.strokeStyle="#7E8386"; ctx.lineWidth=1.5; ctx.strokeRect(p.x,p.y,p.w*f.conc,p.h); }
    const set=p.kind==="bess"?f.bess:f.skid, n=p.units||1, cols=p.kind==="bess"?Math.ceil(n/2):1, rows=p.kind==="bess"?Math.min(2,n):1;
    const cw=(p.w-12-(cols-1)*6)/cols, chh=(p.h-12-(rows-1)*6)/rows;
    for(let k=0;k<n;k++){ const have=clamp((set||0)*n-k); if(have<=0) break; const c=Math.floor(k/rows), r=k%rows, x=p.x+6+c*(cw+6), y=p.y+6+r*(chh+6);
      ctx.globalAlpha=Math.max(.15,have); ctx.fillStyle=p.kind==="bess"?"#3F4447":"#5B6266"; ctx.fillRect(x,y,cw,chh); ctx.fillStyle="#FFFFFF"; ctx.globalAlpha*=.35; for(let z=x+6;z<x+cw-3;z+=6) ctx.fillRect(z,y+3,1.5,chh-6); ctx.globalAlpha=1;
      const wv=clamp((f.wire||0)*n-k); if(wv>0){ ctx.strokeStyle=BRAND; ctx.lineWidth=2.5; ctx.strokeRect(x-1.5,y-1.5,(cw+3)*wv,chh+3); } }
    label(p.name,p.x+p.w/2,p.y-4,null,p.w+8); }
  // שדות: שורות מתוכננות → עמודים → פאנלים → שרשורים
  for(const fl of L.fields){ const f=F[fl.id]||{}, n=fl.rows, x0=fl.x+10, x1=fl.x+fl.w-10, rw=x1-x0;
    ctx.strokeStyle="#C9CBCC"; ctx.lineWidth=1; ctx.setLineDash([4,4]); ctx.strokeRect(fl.x,fl.y,fl.w,fl.h); ctx.setLineDash([]);
    const top=Math.min(22,fl.h*.18); label(fl.name,fl.x+fl.w-6,fl.y+top-3,"right",fl.w-12); const sp=(fl.h-top-4)/n, rh=Math.max(2,sp*.58);
    for(let r=0;r<n;r++){ const y=fl.y+top+r*sp, pp=clamp((f.piles||0)*n-r), pn=clamp((f.panels||0)*n-r), ps=clamp((f.strings||0)*n-r);
      ctx.strokeStyle="#D3D5D6"; ctx.lineWidth=.8; ctx.setLineDash([3,3]); ctx.strokeRect(x0,y,rw,rh); ctx.setLineDash([]);
      if(pp>0){ ctx.fillStyle="#666B6E"; const k=Math.max(2,Math.round(rw/16)); for(let j=0;j<k;j++){ const px=x1-(j+.5)*rw/k; if(px<x1-rw*pp) break; ctx.fillRect(px-1.4,y+rh/2-1.4,2.8,2.8); } }
      // פאנלים ושרשורים מתמלאים מימין לשמאל, כמו הקריאה
      if(pn>0){ ctx.fillStyle="#D3E9F5"; ctx.fillRect(x1-rw*pn,y,rw*pn,rh); ctx.strokeStyle="#1E7FB0"; ctx.lineWidth=1; ctx.strokeRect(x1-rw*pn,y,rw*pn,rh); }
      if(ps>0){ ctx.fillStyle=BRAND; ctx.fillRect(x1-rw*ps,y+rh*.38,rw*ps,Math.max(1.5,rh*.26)); } } }
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
export function currentLayout(){ return layoutOf(layoutDoc()); }

// נקרא מ-renderStatus בכל שינוי בסטטוס
export function renderSiteStages(){
  const card=$("#stagesCard"); if(!card) return; buildDom();
  const acts=shared.demoStock?[]:(shared.STATUS||[]); const d=layoutDoc();
  const L=layoutOf(d); M=stagesModel(L,acts,d&&d.map,isoOf(Date.now()));
  const has=M.P.some(p=>p.linked&&p.applies);
  $("#ssEmpty").hidden=has; $("#ssBody").hidden=!has;
  if(!has){ foldSum("stages",""); return; }
  try{ const b=getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(); if(b) BRAND=b; }catch(e){}
  // כרטיסי שלב לפי קבוצה: כמה דווח מתוך הכמות בסעיפים, או «לא מקושר»
  $("#ssStats").innerHTML=Object.keys(GROUPS).map(g=>{ const ps=M.P.filter(p=>p.g===g&&p.applies); if(!ps.length) return "";
    return '<div class="ss-grp"><div class="ss-gh">'+GROUPS[g]+'</div>'+ps.map(p=>'<div class="ss-ph'+(p.linked?'':' off')+'" id="ss_'+p.k+'"><span class="k"><i style="background:'+(p.c==="brand"?"var(--brand)":p.c)+'"></i>'+esc(p.l)+'</span><span class="n"><b class="v num">0</b>'+(p.linked?' <small>מתוך '+fmtN(p.total)+(p.unit?' '+esc(p.unit):'')+'</small>':' <small>לא מקושר לסעיף</small>')+'</span><div class="bar"><span style="background:'+(p.c==="brand"?"var(--brand)":p.c)+'"></span></div>'
      +(p.linked?'<span class="src">'+esc(p.A.map(a=>(a.code?a.code+" ":"")+a.name).join(" · "))+(p.last?' · עדכון אחרון '+isoText(isoOf(p.last)):'')+'</span>':'')+'</div>').join("")+'</div>'; }).join("");
  $("#ssNote").textContent=(L.fromTables?"ציור לפי מפת השולחנות של האתר (רבעים), לא הנדסה: ":L.fromPlan?"ציור לפי תוכנית האתר, לא הנדסה: ":"סכמה, לא בקנה מידה: ")+layoutSummary(L)+(d?"":L.fromTables?" (משטחים ותעלות יתווספו מהתוכנית ב«מבנה האתר»)":" (ברירת מחדל, «מבנה האתר» מתאים לאתר או קורא את התוכנית)")+". הכמויות מדיווחי הביצוע; דיווח עם אזור בשם שמופיע באיור נצבע שם, השאר לפי הסדר. שלב מאוחר מושך בציור את הקודמים.";
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
    +'<div class="ly-plan"><b>מתוכנית האתר</b><div class="hint" id="lyPlanSt">'+(d.layout?'עכשיו: לפי התוכנית · '+esc(layoutSummary(layoutOf(d))):'עכשיו: סכמה מהמספרים למטה')+'</div>'
      +'<div class="row2"><button class="ghost" type="button" id="lyPlanBtn"'+(shared.SAMPLE?'':' disabled')+'>קריאת תוכנית מתמונה</button><button class="ghost" type="button" id="lyPlanClr"'+(d.layout?'':' hidden')+'>חזרה לסכמה</button></div><input type="file" id="lyPlanFile" accept="image/*" hidden>'
      +'<details><summary>הדבקת מבנה (JSON)</summary><textarea id="lyJson" dir="ltr" rows="5" placeholder=\'{"fields":[{"name":"A","x":100,"y":200,"w":300,"h":200,"rows":12}],"pads":[],"trenches":[]}\'>'+esc(d.layout?JSON.stringify(d.layout):"")+'</textarea></details></div>'
    +'<div class="hint" style="margin:10px 0 4px">או סכמה מהמספרים (כשאין תוכנית):</div>'
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
  let plan=d.layout||null;
  const setPlan=(raw,src)=>{ const L=normLayout(raw); if(!L){ q("#lyPlanSt").textContent="לא נמצאו שדות, משטחים או תעלות. נסו תמונה ברורה יותר, או את המספרים."; return false; }
    plan=raw; q("#lyJson").value=JSON.stringify(raw); q("#lyPlanSt").textContent=src+": "+layoutSummary(L)+". בודקים את השמות ושומרים."; q("#lyPlanClr").hidden=false; return true; };
  q("#lyPlanClr").onclick=()=>{ plan=null; q("#lyJson").value=""; q("#lyPlanClr").hidden=true; q("#lyPlanSt").textContent="סכמה מהמספרים למטה (נשמר בלחיצה על «שמור»)."; };
  q("#lyJson").onchange=()=>{ const v=q("#lyJson").value.trim(); if(!v){ plan=null; return; } try{ setPlan(JSON.parse(v),"מהטקסט"); }catch(e){ q("#lyPlanSt").textContent="ה-JSON לא תקין."; } };
  q("#lyPlanBtn").onclick=()=>q("#lyPlanFile").click();
  q("#lyPlanFile").onchange=async()=>{ const f=q("#lyPlanFile").files[0]; if(!f||!shared.SAMPLE) return; const st=q("#lyPlanSt"), b=q("#lyPlanBtn"); b.disabled=true; st.textContent="קורא את התוכנית…";
    try{ const blob=await planBlob(f); const out=await shared.SAMPLE.json(PLAN_PROMPT,{images:blob}); if(!setPlan(out,"מהתוכנית")) {} }
    catch(e){ st.textContent="הקריאה נכשלה. אפשר לנסות שוב, או להשתמש במספרים."; } finally{ b.disabled=false; q("#lyPlanFile").value=""; } };
  if(ROLE!=="owner"){ q("#lySave").hidden=true; scrim.querySelectorAll("input,select").forEach(i=>i.disabled=true); }
  q("#lySave").onclick=async()=>{
    const gen={fields:+q("#lyFields").value,rows:+q("#lyRows").value,mvs:+q("#lyMvs").value,skids:+q("#lySkids").value,bess:+q("#lyBess").value,room:+q("#lyRoom").value,names:q("#lyNames").value.trim(),start:q("#lyStart").value||""};
    const m={}; PHASES.forEach(p=>{ const v=q("#lm_"+p.k).value; if(v) m[p.k]=v; });
    const b=q("#lySave"); b.disabled=true; b.textContent="שומר…";
    try{ await saveLayout({gen:genLayout(gen).gen,map:m,...(plan?{layout:plan}:{})}); }catch(e){ b.disabled=false; b.textContent="שמור"; toast("השמירה נכשלה."); return; }
    logAct("settings","edit",plan?"מבנה האתר מהתוכנית: "+layoutSummary(normLayout(plan)):"מבנה האתר: "+gen.fields+" שדות, "+gen.mvs+" MVS, "+gen.skids+" סקידים, "+gen.bess+" מכולות","settings/layout");
    scrim.remove(); toast("מבנה האתר נשמר.");
  };
}
// תמונת התוכנית מוקטנת ל-1600 פיקסלים בצד הארוך, JPEG
async function planBlob(file){
  const img=await createImageBitmap(file); const k=Math.min(1,1600/Math.max(img.width,img.height)); const c=document.createElement("canvas");
  c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); const x=c.getContext("2d"); x.fillStyle="#FFFFFF"; x.fillRect(0,0,c.width,c.height); x.drawImage(img,0,0,c.width,c.height);
  return await new Promise(r=>c.toBlob(r,"image/jpeg",.85));
}
export function __init(){ try{ const v=ls.get("layout"); if(v&&!shared.LAYOUT) shared.LAYOUT=JSON.parse(v); }catch(e){} }
