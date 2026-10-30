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
import { ISO_KINDS, isoScene } from "./26-iso.js";

const DAY=864e5;
// k, שם, על מה (trench / pad / bess / mvs / wire / pv), זיהוי לפי שם הסעיף, החרגה, צבע, קבוצה
export const PHASES=[
  {k:"dig",l:"חפירת תעלות",on:"trench",re:/חפיר|חפר|פתיחת תעל/,c:"#A0703C",g:"t"},
  {k:"cable",l:"כבלים ושרוולים בתעלות",on:"trench",re:/כבל|קוברה|שרוול/,ex:/מכול|ראשי כבל|לוח/,meters:true,c:"#3F4447",g:"t"},
  {k:"cover",l:"כיסוי תעלות",on:"trench",re:/כיסוי|כיסינו|סגירת תעל|מילוי תעל/,c:"#CDBB97",g:"t"},
  {k:"base",l:"מצעים",on:"pad",re:/מצע/,c:"#A9ACAE",g:"p"},
  {k:"conc",l:"בטונים",on:"pad",re:/בטון|יציק|יצק/,ex:/שוח/,c:"#7E8386",g:"p"},
  {k:"bess",l:"מכולות וסוללות",on:"bess",re:/מכולות|סוללות|מצבר/,ex:/שרשור|קירור|תאורה|איטום|צנרת|גילוי|כבל|CAT|פתחי|חיווט|MVS/,c:"#3F4447",g:"p"},
  {k:"skid",l:"הצבת MVS וסקידים",on:"mvs",re:/הצבת|סקיד|MVS/,ex:/סיב|כבל|הארק|ראשי|מגיני|בדיק|שילוט|טבעת|סדר|חיווט|AUX|אגירה|סוללות/,c:"#5B6266",g:"p"},
  {k:"wire",l:"חיווט ושרשור במשטחים",on:"wire",re:/שרשור סוללות|וחיווט|חיווט מ/,c:"#1E7FB0",g:"p"},
  {k:"piles",l:"עמודים",on:"pv",re:/עמוד|קידוח|רמינג|כלונס/,ex:/תאורה|מצלמ|אבטח/,c:"#666B6E",g:"f"},
  {k:"panels",l:"פאנלים",on:"pv",re:/פאנל/,ex:/שרשור|הארק|שולחנות/,c:"#3199CC",g:"f"},
  {k:"strings",l:"שרשורים",on:"pv",re:/שרשור פאנל|שרשור סטרינג|שרשרנו|שרשור שורות|שרשור שדה/,c:"brand",g:"f"},
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
// מזהה אזור: נשמר במבנה (settings/layout) ולא משתנה עם שם, סדר או מיקום; בלי מזהה שמור, מזהה לפי הסדר (כמו עד גרסה 12)
const validId=v=>{ v=v==null?"":String(v).trim(); return /^[A-Za-z0-9_\-.:~]{1,40}$/.test(v)?v:""; };
function dedupeIds(list){ const used=new Set(); list.forEach(e=>{ let id=e.id, n=1; while(used.has(id)) id=e.id+"~"+(++n); e.id=id; used.add(id); }); }
export function normLayout(raw){
  if(!raw||typeof raw!=="object") return null;
  const box=o=>{ const x=num(o.x),y=num(o.y),w=num(o.w),h=num(o.h); return [x,y,w,h].every(Number.isFinite)&&w>0&&h>0?{x,y,w,h}:null; };
  const fields=(Array.isArray(raw.fields)?raw.fields:[]).map((f,i)=>{ const b=box(f||{}); return b&&{...b,id:validId(f.id)||"f"+(i+1),kind:"pv",name:String(f.name||("שדה "+String.fromCharCode(65+i))).slice(0,30),rows:Math.max(1,Math.min(60,Math.round(num(f.rows)||Math.max(2,b.h/20))))}; }).filter(Boolean).slice(0,40);
  const pc={}; const pads=(Array.isArray(raw.pads)?raw.pads:[]).map(p=>{ const b=box(p||{}); const kind=["bess","mvs","skid","room"].includes(p&&p.kind)?p.kind:null; if(!b||!kind) return null; pc[kind]=(pc[kind]||0)+1;
    return {...b,kind,id:validId(p.id)||kind+pc[kind],name:String(p.name||({bess:"אגירה",mvs:"MVS",skid:"סקיד",room:"חדר חשמל"}[kind]+(kind==="room"?"":" "+pc[kind]))).slice(0,30),units:Math.max(1,Math.min(60,Math.round(num(p.units)||1)))}; }).filter(Boolean).slice(0,40);
  const trenches=(Array.isArray(raw.trenches)?raw.trenches:[]).map((t,i)=>{ const pts=(Array.isArray(t&&t.pts)?t.pts:[]).map(q=>[num(q&&q[0]),num(q&&q[1])]).filter(q=>q.every(Number.isFinite)); return pts.length>=2&&{id:validId(t.id)||"t"+i,name:String(t.name||("תעלה "+(i+1))).slice(0,40),pts}; }).filter(Boolean).slice(0,60);
  if(!fields.length&&!pads.length&&!trenches.length) return null;
  dedupeIds([...trenches,...pads,...fields]);
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
  return acts.filter(a=>{ const n=a.name||""; if(!ph.re.test(n)||(ph.ex&&ph.ex.test(n))) return false; if(ph.meters&&a.unit&&!/מ׳|מ'|^מ$|מטר/.test(a.unit)) return false; return true; });
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
// שורות בשדה מתוך הדיווח: rows:[a,b] שנבחרו על המפה, או «שורות 14–15» / «שורה 10» בטקסט האזור
const ROWS_RE=/שור(?:ה|ות)\s*(\d{1,3})(?:\s*(?:[-–]|עד)\s*(\d{1,3}))?/;
export function rowsOf(d){ let a=0,b=0;
  if(Array.isArray(d.rows)&&d.rows.length){ a=Number(d.rows[0])||0; b=Number(d.rows[1]==null?d.rows[0]:d.rows[1])||a; }
  else { const m=ROWS_RE.exec(String(d.area||"")); if(!m) return null; a=Number(m[1]); b=m[2]?Number(m[2]):a; }
  return a>0?[Math.min(a,b),Math.max(a,b)]:null; }
// אזור הדיווח → יעד באיור: השם המנורמל של היעד מופיע באזור (הארוך ביותר מנצח: «תעלה שדה A» לפני «שדה A»)
export function matchArea(area,T){ const a=norm(area); if(!a) return -1; let best=-1,bl=0; T.forEach((t,i)=>{ const n=norm(t.name); if(n&&a.includes(n)&&n.length>bl){ best=i; bl=n.length; } });
  if(best<0){ let sl=Infinity; T.forEach((t,i)=>{ const n=norm(t.name); if(n&&n.includes(a)&&n.length<sl){ best=i; sl=n.length; } }); }   // «שדה B» → «תעלה שדה B»
  return best; }
// יעד של דיווח: קודם המזהה הקבוע (areaId), ואם אין או שהוא לא במבנה, לפי שם האזור (דיווחים ישנים נשארים מחוברים כך עד שעורכים אותם)
export function targetIndex(d,T){ if(d&&d.areaId!=null&&d.areaId!==""){ const j=T.findIndex(t=>t.id===d.areaId); if(j>=0) return j; } return matchArea(d&&d.area,T); }
/* מזהים קבועים לפני שמירת מבנה: מזהה תקין נשמר; אלמנט בלי מזהה מקבל את המזהה של האלמנט בעל אותו שם במבנה הקודם (כך דיווחים
   עם areaId נשארים מחוברים), אחרת את מזהה ברירת המחדל לפי הסדר אם הוא פנוי, אחרת מזהה חדש. שינוי שם, סדר או מיקום אחר כך לא משנה אותו. */
export function ensureIds(raw,prev){
  if(!raw||typeof raw!=="object") return raw;
  const used=new Set(), out={...raw};
  const prevOf=(kind,name)=>{ if(!prev) return ""; const list=kind==="pv"?prev.fields:kind==="trench"?prev.trenches:(prev.pads||[]).filter(p=>p.kind===kind); const n=norm(name); const m=n&&(list||[]).find(e=>norm(e.name)===n); return m?m.id:""; };
  const fresh=pre=>{ let id; do{ id=pre+Math.random().toString(36).slice(2,6); }while(used.has(id)); return id; };
  const take=(e,kind,name,fallback,pre)=>{ let id=validId(e.id); if(!id||used.has(id)) id=prevOf(kind,name); if(!id||used.has(id)) id=fallback; if(!id||used.has(id)) id=fresh(pre); used.add(id); return {...e,id}; };
  out.fields=(Array.isArray(raw.fields)?raw.fields:[]).map((f,i)=>take(f||{},"pv",(f&&f.name)||("שדה "+String.fromCharCode(65+i)),"f"+(i+1),"f_"));
  const pc={}; out.pads=(Array.isArray(raw.pads)?raw.pads:[]).map(p=>{ const kind=(p&&p.kind)||"pad"; pc[kind]=(pc[kind]||0)+1; return take(p||{},kind,(p&&p.name)||"",kind+pc[kind],kind+"_"); });
  out.trenches=(Array.isArray(raw.trenches)?raw.trenches:[]).map((t,i)=>take(t||{},"trench",(t&&t.name)||("תעלה "+(i+1)),"t"+i,"t_"));
  return out;
}

export function stagesModel(L,acts,map,todayIso){
  const P=PHASES.map(ph=>{
    const A=phaseActs(ph,acts,map); const T=targetsOf(L,ph.on); const sw=T.reduce((s,t)=>s+t.w,0);
    // מיקום: areaId של הדיווח, אחרת שם האזור, ואם אין, שם הסעיף («חפירת תעלה ראשית») כשהוא עצמו שם של יעד. אחרת הדיווח בלי מיקום: נספר, לא נצבע (מפה אמיתית, בלי ניחוש)
    const E=A.flatMap(a=>{ const byName=matchArea(a.name,T); return (a.daily||[]).filter(d=>Number(d.actual)&&d.date).map(d=>{ const i=targetIndex(d,T); return {t:dt(d.date),q:Number(d.actual),i:i>=0?i:byName,rows:ph.on==="pv"?rowsOf(d):null,a:a.id,d:d.id,date:d.date,area:d.area||""}; }); }).sort((x,y)=>x.t-y.t);
    const rep=E.reduce((s,e)=>s+e.q,0), total=A.reduce((s,a)=>s+(Number(a.total)||0),0)||rep;
    const open=A.length>0&&!A.some(a=>Number(a.total)>0);   // בלי כמות בהסכם (כתיבה חופשית): כל דיווח מסמן את היעד שלו כ«בוצע», כמו סימון ביד על המפה
    return {...ph,A,T,sw,E,rep,total,open,unit:(A[0]&&A[0].unit)||"",linked:A.length>0,applies:T.length>0,last:E.length?E[E.length-1].t:0};
  });
  const firsts=P.filter(p=>p.E.length).map(p=>p.E[0].t);
  const dEnd=dt(todayIso)+DAY; let d0=firsts.length?Math.min(...firsts)-5*DAY:dEnd-30*DAY;
  if(L.gen&&L.gen.start&&dt(L.gen.start)<d0) d0=dt(L.gen.start);
  const u2t=u=>d0+u*(dEnd-d0), t2u=t=>clamp((t-d0)/(dEnd-d0));
  const ids=[...L.trenches.map(t=>[t.id,"trench"]),...L.pads.filter(p=>p.kind!=="room").map(p=>[p.id,p.kind]),...L.fields.map(f=>[f.id,"pv"])];
  // מצב בזמן t: לכל יעד שבר לכל שלב (מיושר לסדר), ולכל שלב הכמות שדווחה עד t (אמיתית)
  // R[שדה][שלב] = שבר לכל שורה (שורה 1 = העליונה). דיווח עם שורות צובע בדיוק אותן; בלי שורות ממלא את שאר השורות לפי הסדר
  const rowsIdx=(e,n)=>{ if(!e.rows) return null; const a=Math.max(1,Math.min(n,e.rows[0]))-1, b=Math.max(1,Math.min(n,e.rows[1]))-1; const out=[]; for(let r=a;r<=b;r++) out.push(r); return out; };
  const state=u=>{
    const t=u2t(u), F={}, V={}, U={}, R={}; ids.forEach(([id])=>F[id]={});
    for(const p of P){ if(!p.applies) continue;
      const pv=p.on==="pv", RW=pv?p.T.map(x=>new Array(Math.max(1,Math.round(x.w)||1)).fill(0)):null; let sum=0, un=0, uq=0;
      if(p.open){ const fill=p.T.map(()=>0);
        for(const e of p.E){ if(e.t>=t) break; const f=clamp((t-e.t)/DAY); sum+=e.q*f; if(e.i<0){ un++; uq+=e.q; continue; }
          const rr=pv?rowsIdx(e,RW[e.i].length):null; if(rr){ rr.forEach(r=>{ RW[e.i][r]=Math.max(RW[e.i][r],f); }); fill[e.i]=RW[e.i].reduce((a,b)=>a+b,0)/RW[e.i].length; }
          else { fill[e.i]=Math.max(fill[e.i],f); if(pv) RW[e.i]=RW[e.i].map(v=>Math.max(v,f)); } }
        p.T.forEach((x,i)=>{ F[x.id][p.k]=fill[i]; if(pv){ R[x.id]=R[x.id]||{}; R[x.id][p.k]=RW[i]; } }); V[p.k]=sum; if(un) U[p.k]={n:un,q:uq}; continue; }
      const cap=p.T.map(x=>p.sw?p.total*x.w/p.sw:0), fill=p.T.map(()=>0), pool=p.T.map(()=>0);
      for(const e of p.E){ if(e.t>=t) break; const q=e.q*clamp((t-e.t)/DAY); sum+=q; if(e.i<0){ un++; uq+=q; continue; }
        const rr=pv?rowsIdx(e,RW[e.i].length):null;
        if(rr){ const rc=cap[e.i]/RW[e.i].length; let left=q; const share=q/rr.length;   // שווה בין השורות שדווחו, והעודף לשורות האלה לפי הסדר
          rr.forEach(r=>{ const g=Math.min(share,Math.max(0,rc-RW[e.i][r])); RW[e.i][r]+=g; left-=g; }); rr.forEach(r=>{ const g=Math.min(left,Math.max(0,rc-RW[e.i][r])); RW[e.i][r]+=g; left-=g; });
          fill[e.i]+=q-left; pool[e.i]+=left; }
        else { pool[e.i]+=q; } }
      p.T.forEach((x,i)=>{ if(pv){ const rc=cap[i]/RW[i].length; for(let r=0;r<RW[i].length&&pool[i]>0;r++){ const g=Math.min(pool[i],Math.max(0,rc-RW[i][r])); RW[i][r]+=g; pool[i]-=g; fill[i]+=g; }
          R[x.id]=R[x.id]||{}; R[x.id][p.k]=rc?RW[i].map(v=>clamp(v/rc)):RW[i].map(()=>0); }
        else { const g=Math.min(pool[i],Math.max(0,cap[i]-fill[i])); fill[i]+=g; }
        F[x.id][p.k]=cap[i]?clamp(fill[i]/cap[i]):0; });
      V[p.k]=sum; if(un) U[p.k]={n:un,q:uq}; }
    ids.forEach(([id,kind])=>{ const ch=CHAIN[kind]||[]; const f=F[id], rw=R[id];
      for(let j=ch.length-1;j>0;j--){ f[ch[j-1]]=Math.max(f[ch[j-1]]||0,f[ch[j]]||0);
        if(rw&&rw[ch[j]]){ const a=rw[ch[j-1]]||rw[ch[j]].map(()=>0); rw[ch[j-1]]=a.map((v,r)=>Math.max(v,rw[ch[j]][r]||0)); } } });
    return {t,F,V,U,R,today:u>0.999};
  };
  // דיווחים בלי מיקום באיור (פעם אחת לכל רישום): לרשימת «מקם»
  const unplaced=()=>{ const seen=new Set(), out=[]; P.filter(p=>p.applies&&p.linked).forEach(p=>p.E.forEach(e=>{ if(e.i>=0||seen.has(e.d)) return; seen.add(e.d); const a=p.A.find(x=>x.id===e.a)||{}; out.push({...e,act:a,phase:p.l,unit:p.unit}); })); return out.sort((x,y)=>y.t-x.t); };
  // הדיווחים שמוקמו על אלמנט אחד (לתצוגה המקורבת): שלב, תאריך, כמות, סעיף, שורות, צוות, הערה; החדש ראשון
  const reportsFor=id=>{ const out=[]; P.forEach(p=>{ if(!p.applies) return; p.E.forEach(e=>{ if(e.i<0||p.T[e.i].id!==id) return; const a=p.A.find(x=>x.id===e.a)||{}, d=(a.daily||[]).find(x=>x.id===e.d)||{};
    out.push({k:p.k,phase:p.l,unit:p.unit,t:e.t,date:e.date,q:e.q,act:(a.code?a.code+" ":"")+(a.name||""),rows:e.rows,crew:d.crew||"",note:d.note||"",by:d.by||""}); }); }); return out.sort((x,y)=>y.t-x.t); };
  return {L,P,d0,dEnd,u2t,t2u,state,unplaced,reportsFor};
}

/* ---- ציור ---- */
let M=null, cv, ctx, u=1, playing=0, built=false, BRAND="#3F4447", SC=1;
export function siteStagesState(uu){ return M?M.state(uu==null?u:uu):null; }
export function siteStagesModel(){ return M; }
function partial(pts,f){ // הקטע הראשון באורך f מהקו
  let tot=0; const seg=[]; for(let i=1;i<pts.length;i++){ const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(l); tot+=l; }
  let left=f*tot; const out=[pts[0]]; for(let i=1;i<pts.length&&left>0;i++){ const l=seg[i-1]; if(left>=l){ out.push(pts[i]); left-=l; } else { const r=left/l; out.push([pts[i-1][0]+(pts[i][0]-pts[i-1][0])*r,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*r]); left=0; } }
  return out;
}
function line(pts,w,c,dash){ if(pts.length<2) return; ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.lineWidth=w; ctx.strokeStyle=c; ctx.setLineDash(dash||[]); ctx.lineCap=dash?"butt":"round"; ctx.lineJoin="round"; ctx.stroke(); ctx.setLineDash([]); }
function label(txt,x,y,al,maxW){ if(focus&&nearK>.3) return; /* בזום התוויות «מרחוק» נעלמות; הציור המקורב כותב את שלו */ let fs=11/SC; ctx.font="600 "+fs+"px Alef, Heebo, Arial, sans-serif"; if(maxW){ const w=ctx.measureText(txt).width; if(w>maxW){ fs*=maxW/w; ctx.font="600 "+fs+"px Alef, Heebo, Arial, sans-serif"; } } ctx.fillStyle="#3F4447"; ctx.textAlign=al||"center"; ctx.textBaseline="bottom"; ctx.direction="rtl"; ctx.fillText(txt,x,y); }
function draw(){
  if(!M||!cv||!cv.width) return; const s=M.state(u); ui(s); const L=M.L, F=s.F;
  // מצלמה: המפה המלאה (s=1) או התקרבות לאלמנט שנלחץ; הציור «מרחוק» תמיד, ומעליו הציור «מקרוב» של האלמנט כשמתקרבים
  ctx.save(); ctx.translate(L.w/2,L.h/2); ctx.scale(cam.s,cam.s); ctx.translate(-cam.x,-cam.y);
  ctx.fillStyle="#FFFFFF"; ctx.fillRect(-L.w*4,-L.h*4,L.w*9,L.h*9);
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
  for(const fl of L.fields){ const f=F[fl.id]||{}, RR=(s.R||{})[fl.id]||{}, n=fl.rows, x0=fl.x+10, x1=fl.x+fl.w-10, rw=x1-x0;
    const rowV=(k,r)=>RR[k]&&RR[k].length===n?clamp(RR[k][r]):clamp((f[k]||0)*n-r);
    ctx.strokeStyle="#C9CBCC"; ctx.lineWidth=1; ctx.setLineDash([4,4]); ctx.strokeRect(fl.x,fl.y,fl.w,fl.h); ctx.setLineDash([]);
    const top=Math.min(22,fl.h*.18); label(fl.name,fl.x+fl.w-6,fl.y+top-3,"right",fl.w-12); const sp=(fl.h-top-4)/n, rh=Math.max(2,sp*.58);
    for(let r=0;r<n;r++){ const y=fl.y+top+r*sp, pp=rowV("piles",r), pn=rowV("panels",r), ps=rowV("strings",r);
      ctx.strokeStyle="#D3D5D6"; ctx.lineWidth=.8; ctx.setLineDash([3,3]); ctx.strokeRect(x0,y,rw,rh); ctx.setLineDash([]);
      if(pp>0){ ctx.fillStyle="#666B6E"; const k=Math.max(2,Math.round(rw/16)); for(let j=0;j<k;j++){ const px=x1-(j+.5)*rw/k; if(px<x1-rw*pp) break; ctx.fillRect(px-1.4,y+rh/2-1.4,2.8,2.8); } }
      // פאנלים ושרשורים מתמלאים מימין לשמאל, כמו הקריאה
      if(pn>0){ ctx.fillStyle="#D3E9F5"; ctx.fillRect(x1-rw*pn,y,rw*pn,rh); ctx.strokeStyle="#1E7FB0"; ctx.lineWidth=1; ctx.strokeRect(x1-rw*pn,y,rw*pn,rh); }
      if(ps>0){ ctx.fillStyle=BRAND; ctx.fillRect(x1-rw*ps,y+rh*.38,rw*ps,Math.max(1.5,rh*.26)); } } }
  if(focus&&nearK>0&&!ISO_KINDS.includes(focus.kind)) drawNear(s);
  ctx.restore();
  if(focus&&nearK>0&&ISO_KINDS.includes(focus.kind)) drawIso(s);   // גרסה 15–16: איור איזומטרי במרחב המסך, מעל המפה המעומעמת
}
// הציור האיזומטרי (גרסה 15): המפה מתעמעמת, והאיור «קופץ» פנימה יחד עם אנימציית הזום (nearK)
function drawIso(s){ const L=M.L, el=L.pads.find(p=>p.id===focus.id)||L.fields.find(f=>f.id===focus.id)||L.trenches.find(t=>t.id===focus.id); if(!el) return;
  ctx.save(); ctx.globalAlpha=.9*nearK; ctx.fillStyle="#FFFFFF"; ctx.fillRect(0,0,L.w,L.h); ctx.restore();
  const k=.86+.14*nearK, cx=L.w/2, cy=L.h/2; ctx.save(); ctx.translate(cx,cy); ctx.scale(k,k); ctx.translate(-cx,-cy);
  const F=s.F[el.id]||{}, RR=(s.R||{})[el.id]||{}, n=el.rows||1, rv=k=>RR[k]&&RR[k].length===n?clamp(RR[k][focus.row-1]):clamp((F[k]||0)*n-(focus.row-1));   // שורה: לפי הדיווחים שלה, או מילוי לפי סדר
  const rowF=el.kind==="pv"&&focus.row?{piles:rv("piles"),panels:rv("panels"),strings:rv("strings")}:null;
  isoScene(ctx,{x:0,y:0,w:L.w,h:L.h},{...el,kind:el.kind||focus.kind},F,nearK,1/SC,{rowF}); ctx.restore(); }   // לתעלות אין kind במבנה

/* ---- זום (גרסה 14): לחיצה על שדה / משטח / תעלה מתקרבת אליו באנימציה ומציירת אותו «מקרוב»; לחיצה נוספת חוזרת למפה המלאה.
   לכל סוג אלמנט שני ציורים נפרדים: «מרחוק» (ב-draw, הבלוק מלמעלה) ו«מקרוב» (NEAR, האלמנט עצמו). הציור המקורב סכמטי,
   ומתעשר בהמשך מתוכניות החשמל של האתרים בלי לשנות את מודל הנתונים (מבנה + דיווחים). ---- */
let cam={x:0,y:0,s:1}, focus=null, zoomAnim=0, nearK=0;   // nearK: 0 רחוק … 1 קרוב (שקיפות הציור המקורב בזמן האנימציה)
const homeCam=()=>({x:M.L.w/2,y:M.L.h/2,s:1});
function boxOf(t){ if(t.kind==="trench"){ const xs=t.pts.map(p=>p[0]), ys=t.pts.map(p=>p[1]), x=Math.min(...xs), y=Math.min(...ys); return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y}; } return {x:t.x,y:t.y,w:t.w,h:t.h}; }
function camFor(t){ const b=boxOf(t), L=M.L, pad=t.kind==="trench"?36:16; return {x:b.x+b.w/2,y:b.y+b.h/2,s:Math.max(1.2,Math.min(L.w/(b.w+2*pad),L.h/(b.h+2*pad),9))}; }
const reducedMotion=()=>typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function animateCam(to,onDone){
  if(zoomAnim) cancelAnimationFrame(zoomAnim); const from={...cam}, t0=performance.now(), dur=reducedMotion()?0:340;
  const step=now=>{ const k=dur?Math.min(1,(now-t0)/dur):1, e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;   // ease in-out
    cam={x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e,s:from.s*Math.pow(to.s/from.s,e)}; nearK=focus?e:1-e; draw();
    if(k<1) zoomAnim=requestAnimationFrame(step); else { zoomAnim=0; if(onDone) onDone(); } };
  zoomAnim=requestAnimationFrame(step);
}
export function zoomTo(id,row){
  if(!M) return; const t=id?zoomTargets(M.L).find(x=>x.id===id):null;
  if(!t){ const had=focus; focus=null; renderZoomInfo(); if(had) animateCam(homeCam()); else { cam=homeCam(); nearK=0; draw(); } return; }
  focus={id:t.id,kind:t.kind,row:row||0,t}; renderZoomInfo(); animateCam(camFor(t));
}
export function siteStagesZoom(){ return focus?{id:focus.id,kind:focus.kind,row:focus.row,s:cam.s,near:nearK}:null; }
function onCanvasTap(e){
  const r=cv.getBoundingClientRect(); if(!r.width||!M) return; const L=M.L;
  const bx=(e.clientX-r.left)/r.width*L.w, by=(e.clientY-r.top)/r.height*L.h, x=(bx-L.w/2)/cam.s+cam.x, y=(by-L.h/2)/cam.s+cam.y;   // דרך המצלמה
  if(focus){ zoomTo(null); return; }   // מקרוב: כל לחיצה מחזירה למפה, ומשם לוחצים על משהו אחר
  let t=pickAt(L,x,y,14); if(!t) t=zoomTargets(L).find(z=>z.kind==="room"&&x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h); if(!t) return; zoomTo(t.id,t.kind==="pv"?rowAt(L,t,y):0);
}
// טקסט בגודל קבוע על המסך גם כשמתקרבים
function ntext(t,x,y,al,px,color){ ctx.font="600 "+(px/(SC*cam.s))+"px Alef, Heebo, Arial, sans-serif"; ctx.fillStyle=color||"#3F4447"; ctx.textAlign=al||"center"; ctx.textBaseline="bottom"; ctx.direction="rtl"; ctx.fillText(t,x,y); }
const NEAR={
  // שדה: כל שורה כשולחן, עמודים כנקודות, פאנלים כמודולים, שרשור כקו; מספר לכל שורה; השורה שנלחצה מסומנת
  pv(f,s){ const F=s.F[f.id]||{}, RR=(s.R||{})[f.id]||{}, n=f.rows, k=1/cam.s;
    const rowV=(ph,r)=>RR[ph]&&RR[ph].length===n?clamp(RR[ph][r]):clamp((F[ph]||0)*n-r);
    ctx.fillStyle="#FBF8F1"; ctx.fillRect(f.x,f.y,f.w,f.h); ctx.strokeStyle="#9A9EA1"; ctx.lineWidth=1.5*k; ctx.strokeRect(f.x,f.y,f.w,f.h);
    const top=Math.min(22,f.h*.18); ntext(f.name,f.x+f.w-6,f.y+top-3,"right",14);
    const x0=f.x+10+16*k, x1=f.x+f.w-10, rw=x1-x0, sp=(f.h-top-4)/n, rh=Math.max(2,sp*.68), mods=Math.max(6,Math.min(48,Math.round(rw/(7*k))));
    for(let r=0;r<n;r++){ const y=f.y+top+r*sp+(sp-rh)/2, pp=rowV("piles",r), pn=rowV("panels",r), ps=rowV("strings",r), hi=focus.row===r+1;
      ntext(String(r+1),f.x+10+14*k,y+rh,"right",9,"#8E9193");
      ctx.strokeStyle="#D3D5D6"; ctx.lineWidth=.8*k; ctx.setLineDash([3*k,3*k]); ctx.strokeRect(x0,y,rw,rh); ctx.setLineDash([]);
      if(pp>0){ ctx.fillStyle="#666B6E"; for(let j=0;j<=mods;j++){ const px=x1-j*rw/mods; if(px<x1-rw*pp-.01) break; ctx.fillRect(px-1.2*k,y-1.5*k,2.4*k,rh+3*k); } }
      if(pn>0){ const mw=rw/mods; for(let j=0;j<mods;j++){ const have=clamp(pn*mods-j); if(have<=0) break; const px=x1-(j+1)*mw; ctx.globalAlpha=nearK*Math.max(.25,have); ctx.fillStyle="#9CCBE6"; ctx.fillRect(px+.6*k,y+.6*k,mw-1.2*k,rh-1.2*k); ctx.strokeStyle="#1E7FB0"; ctx.lineWidth=.6*k; ctx.strokeRect(px+.6*k,y+.6*k,mw-1.2*k,rh-1.2*k); } ctx.globalAlpha=nearK; }
      if(ps>0){ ctx.strokeStyle=BRAND; ctx.lineWidth=2*k; ctx.beginPath(); ctx.moveTo(x1,y+rh/2); ctx.lineTo(x1-rw*ps,y+rh/2); ctx.stroke(); }
      if(hi){ ctx.strokeStyle=BRAND; ctx.lineWidth=2*k; ctx.strokeRect(x0-2*k,y-2*k,rw+4*k,rh+4*k); } } },
  // משטח: מצעים, בטון, ואז היחידות: מכולת אגירה (דלת), שנאי MVS (שלושה מבודדים), סקיד (מסגרת עם יחידות); חיווט כמסגרת
  pad(p,s){ const F=s.F[p.id]||{}, k=1/cam.s, n=p.units||1;
    ctx.fillStyle="#FBF8F1"; ctx.fillRect(p.x,p.y,p.w,p.h);
    if(F.base>0){ ctx.save(); ctx.beginPath(); ctx.rect(p.x,p.y,p.w*F.base,p.h); ctx.clip(); ctx.fillStyle="#DCDDDD"; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.strokeStyle="#A9ACAE"; ctx.lineWidth=k; ctx.beginPath(); for(let z=-p.h;z<p.w;z+=5*k){ ctx.moveTo(p.x+z,p.y+p.h); ctx.lineTo(p.x+z+p.h,p.y); } ctx.stroke(); ctx.restore(); }
    if(F.conc>0){ ctx.fillStyle="#C4C6C7"; ctx.fillRect(p.x,p.y,p.w*F.conc,p.h); ctx.fillStyle="#AEB0B1"; for(let i=0;i<60;i++){ ctx.fillRect(p.x+((i*37)%100)/100*p.w*F.conc,p.y+((i*53)%100)/100*p.h,1.4*k,1.4*k); } }
    ctx.strokeStyle="#7E8386"; ctx.lineWidth=1.5*k; ctx.setLineDash(F.conc>0?[]:[5*k,4*k]); ctx.strokeRect(p.x,p.y,p.w,p.h); ctx.setLineDash([]);
    ntext(p.name,p.x+p.w/2,p.y-4*k,"center",13);
    const set=p.kind==="bess"?F.bess:F.skid, cols=p.kind==="bess"?Math.ceil(n/2):1, rows=p.kind==="bess"?Math.min(2,n):1, cw=(p.w-12-(cols-1)*6)/cols, ch=(p.h-12-(rows-1)*6)/rows;
    for(let i=0;i<n;i++){ const c=Math.floor(i/rows), r=i%rows, x=p.x+6+c*(cw+6), y=p.y+6+r*(ch+6), have=clamp((set||0)*n-i), wv=clamp((F.wire||0)*n-i);
      ctx.strokeStyle="#A9ACAE"; ctx.lineWidth=k; ctx.setLineDash([3*k,3*k]); ctx.strokeRect(x,y,cw,ch); ctx.setLineDash([]);
      if(have>0){ ctx.globalAlpha=nearK*Math.max(.3,have);
        if(p.kind==="bess"){ ctx.fillStyle="#3F4447"; ctx.fillRect(x,y,cw,ch); ctx.strokeStyle="#FFFFFF"; ctx.lineWidth=k; ctx.globalAlpha*=.45; ctx.beginPath(); for(let z=x+4*k;z<x+cw-2*k;z+=5*k){ ctx.moveTo(z,y+2*k); ctx.lineTo(z,y+ch-2*k); } ctx.stroke(); ctx.globalAlpha=nearK*Math.max(.3,have); ctx.fillStyle="#D9B13B"; ctx.fillRect(x+cw*.42,y+ch*.3,cw*.16,ch*.4); }
        else if(p.kind==="mvs"){ ctx.fillStyle="#5B6266"; ctx.fillRect(x,y+ch*.28,cw,ch*.72); ctx.fillStyle="#8E9193"; for(let j=0;j<3;j++){ const bx=x+cw*(.25+.25*j); ctx.fillRect(bx-k,y+ch*.1,2*k,ch*.2); ctx.beginPath(); ctx.arc(bx,y+ch*.1,Math.min(cw,ch)*.07,0,Math.PI*2); ctx.fill(); } }
        else { ctx.strokeStyle="#5B6266"; ctx.lineWidth=2*k; ctx.strokeRect(x,y,cw,ch); ctx.fillStyle="#5B6266"; const m=3, mw=(cw-8*k)/m; for(let j=0;j<m;j++) ctx.fillRect(x+4*k+j*mw+k,y+ch*.2,mw-2*k,ch*.6); }
        ctx.globalAlpha=nearK; }
      if(wv>0){ ctx.strokeStyle=BRAND; ctx.lineWidth=2.5*k; ctx.strokeRect(x-2*k,y-2*k,(cw+4*k)*wv,ch+4*k); }
      if(n>1) ntext(String(i+1),x+cw/2,y+ch-2*k,"center",9,have>0?"#FFFFFF":"#8E9193"); } },
  // תעלה: פס רחב לאורך הקו; נחפר (חום), כבל (קו כהה באמצע), כוסה (חול עם כבל קבור); שם בתחילת הקו
  trench(t,s){ const F=s.F[t.id]||{}, k=1/cam.s, W=16*k;
    ctx.save(); line(t.pts,W+4*k,"#FBF8F1"); ctx.restore(); line(t.pts,W,"#EADFC8"); line(t.pts,1.2*k,"#A0703C",[6*k,5*k]);
    if(F.dig>0){ const p=partial(t.pts,F.dig); line(p,W,"#A0703C"); line(p,W*.55,"#B98A5A"); }
    if(F.cable>0) line(partial(t.pts,F.cable),4*k,"#2A2E30");
    if(F.cover>0){ const p=partial(t.pts,F.cover); line(p,W,"#CDBB97"); line(p,1.5*k,"#7A6A4E",[4*k,4*k]); }
    ntext(t.name,t.pts[0][0],t.pts[0][1]-W/2-4*k,"left",12); }
};
function drawNear(s){ const L=M.L, t=focus.t; const kind=t.kind==="pv"?"pv":t.kind==="trench"?"trench":"pad";
  ctx.globalAlpha=.62*nearK; ctx.fillStyle="#FFFFFF"; ctx.fillRect(-L.w*4,-L.h*4,L.w*9,L.h*9);   // השאר מתעמעם
  ctx.globalAlpha=nearK; const el=kind==="pv"?L.fields.find(f=>f.id===t.id):kind==="trench"?L.trenches.find(x=>x.id===t.id):L.pads.find(p=>p.id===t.id);
  if(el) NEAR[kind](el,s); ctx.globalAlpha=1; }
// הכרטיס המקורב: מה קרה באלמנט הזה (לפי מצב ציר הזמן): שלבים עם אחוז ותאריכים, והדיווחים שמוקמו כאן
function renderZoomInfo(){
  const box=$("#ssZoom"), sel=$("#ssZoomSel"); if(!box||!M) return; if(sel) sel.value=focus?focus.id:""; if(!focus){ box.hidden=true; return; } box.hidden=false;
  const s=M.state(u), id=focus.id, F=s.F[id]||{}, RR=(s.R||{})[id]||{}, chain=CHAIN[focus.kind]||[], all=chain.map(k=>M.P.find(p=>p.k===k)).filter(p=>p&&p.applies), phases=all.some(p=>p.linked)?all.filter(p=>p.linked):all;   // רק שלבים שמקושרים לסעיף; בלי אף אחד, כולם
  const reps=M.reportsFor(id).filter(e=>e.t<s.t).filter(e=>!(focus.row&&e.rows&&(focus.row<e.rows[0]||focus.row>e.rows[1])));
  const frac=k=>focus.row&&RR[k]&&RR[k].length>=focus.row?clamp(RR[k][focus.row-1]):clamp(F[k]||0);
  const span=k=>{ const r=reps.filter(e=>e.k===k); return r.length?(r[r.length-1].date===r[0].date?isoText(r[0].date):isoText(r[r.length-1].date)+" – "+isoText(r[0].date)):""; };
  box.innerHTML='<div class="zm-head"><b>'+esc(focus.t.name)+(focus.row?' · שורה '+focus.row:'')+'</b><button class="linkbtn" type="button" id="ssZoomBack" style="min-height:0;padding:0 4px">חזרה למפה ‹</button></div>'
    +'<div class="zm-ph">'+(phases.length?"":'<div class="hint">אין שלבי דיווח לאלמנט הזה; האיור כמתוכנן.</div>')+phases.map(p=>{ const f=frac(p.k); return '<div class="zm-row'+(f>=.999?' done':f>0?' on':'')+'"><i style="background:'+(p.c==="brand"?"var(--brand)":p.c)+'"></i><span class="k">'+esc(p.l)+'</span><span class="n num">'+(p.linked?Math.round(f*100)+'%':'לא מקושר')+'</span><span class="d">'+esc(span(p.k)||(p.linked&&f<=0?"עוד לא":""))+'</span></div>'; }).join("")+'</div>'
    +(reps.length?'<div class="zm-reps">'+reps.slice(0,20).map(e=>'<div class="zm-rep"><span class="num">'+esc(isoText(e.date))+'</span><span>'+fmtN(e.q)+(e.unit?' '+esc(e.unit):'')+' · '+esc(e.act)+(e.rows?' · שורות '+e.rows[0]+(e.rows[1]!==e.rows[0]?'–'+e.rows[1]:''):'')+(e.crew?' · '+esc(e.crew):'')+(e.note?' · '+esc(e.note):'')+'</span></div>').join("")+(reps.length>20?'<div class="hint">מוצגים 20 האחרונים מתוך '+reps.length+'.</div>':'')+'</div>'
      :'<div class="hint" style="margin-top:6px">אין עדיין דיווחים שמוקמו כאן'+(u<.999?' עד התאריך הזה':'')+'.</div>')
    +'<div class="hint" style="margin-top:6px">לחיצה על האיור מחזירה למפה המלאה.</div>';
  $("#ssZoomBack").onclick=()=>zoomTo(null);
}

function ui(s){
  $("#ssRange").value=Math.round(u*1000); if(focus&&!zoomAnim) renderZoomInfo();
  const isToday=u>0.999; $("#ssDate").textContent=isToday?isoText(isoOf(Date.now())):ddmm(s.t); $("#ssToday").style.opacity=isToday?1:0;
  let num=0, den=0;
  M.P.forEach(p=>{ const el=document.getElementById("ss_"+p.k); if(!el) return; const v=s.V[p.k]||0;
    el.querySelector(".v").textContent=p.linked?fmtN(Math.round(v)):"—";
    el.querySelector(".bar span").style.width=(p.linked&&p.total?clamp(v/p.total)*100:0)+"%";
    if(p.linked&&p.applies&&p.total&&!p.open){ num+=clamp(v/p.total); den++; } });
  // בלי כמויות בהסכם (כתיבה חופשית) אין אחוז: סופרים אזורים שסומנו באיור
  if(den){ $("#ssBig").textContent=Math.round(num/den*100)+"%"; $("#ssCap").textContent="ממוצע פשוט של השלבים שבאיור"; }
  else { let marked=0; for(const id in s.F) for(const k in s.F[id]) if(s.F[id][k]>0){ marked++; break; } $("#ssBig").textContent=fmtN(marked); $("#ssCap").textContent="אזורים סומנו באיור"; }
  const done=M.P.filter(p=>p.linked&&p.applies&&p.total&&(s.V[p.k]||0)>=p.total-1e-6).map(p=>p.l), on=M.P.filter(p=>p.linked&&p.applies&&(s.V[p.k]||0)>0&&(s.V[p.k]||0)<p.total-1e-6).map(p=>p.l);
  $("#ssSub").innerHTML=!on.length&&!done.length?"<b>אדמה ריקה וגדר.</b> מכאן זה מתחיל.":(on.length?"<b>בעבודה:</b> "+esc(on.join(", ")):"")+(done.length?(on.length?" · ":"")+"<b>הושלם:</b> "+esc(done.join(", ")):"");
}

function buildDom(){
  const box=$("#ssBody"); if(!box||built) return; built=true;
  box.innerHTML='<div class="mt-title">התקדמות במפה <button class="linkbtn mt-why" type="button" id="ssWhy">הסבר</button></div><div class="sb-lead"><span class="sb-big num" id="ssBig">0%</span><span class="sb-cap" id="ssCap">ממוצע פשוט של השלבים שבאיור</span></div><div class="sb-sub" id="ssSub"></div>'
    +'<div class="sb-ph"><span class="sb-date num" id="ssDate"></span><span class="sb-today" id="ssToday">היום</span></div>'
    +'<div class="ss-cvw"><canvas id="ssCv" aria-label="איור האתר מלמעלה לפי שלבי הביצוע. לחיצה על שדה, משטח או תעלה מתקרבת אליו; לחיצה נוספת מחזירה למפה"></canvas></div>'
    +'<div class="ss-zoom" id="ssZoom" hidden></div>'
    +'<div class="sb-keys"><span><i style="border-top:2px dashed #A0703C;height:0;border-radius:0"></i>תעלה מתוכננת</span><span><i style="background:#A0703C"></i>נחפרה</span><span><i style="background:#2A2E30;height:4px"></i>כבל / שרוול</span><span><i style="background:#CDBB97"></i>כוסתה</span><span><i style="background:#DCDDDD;border:1px solid #A9ACAE"></i>מצעים</span><span><i style="background:#C4C6C7;border:1px solid #7E8386"></i>בטון</span><span><i style="background:#3F4447"></i>מכולה / סקיד</span><span><i style="background:#D3E9F5;border:1px solid #1E7FB0"></i>פאנלים</span><span><i style="background:var(--brand)"></i>שרשור / חיווט</span></div>'
    +'<input type="range" class="ss-range" id="ssRange" min="0" max="1000" value="1000" aria-label="ציר זמן: היום משמאל">'
    +'<div class="sb-ctrl"><span class="hint">היום משמאל. גררו ימינה כדי לחזור לאדמה הריקה.</span><div class="sb-btns"><select id="ssZoomSel" aria-label="התקרבות לאלמנט"><option value="">התקרבות ל…</option></select><button class="sb-go" id="ssPlay" type="button">הפעלה מההתחלה</button></div></div>'
    +'<div class="ss-unp" id="ssUnp" hidden><span id="ssUnpTxt"></span><button class="linkbtn" type="button" id="ssUnpBtn" data-w="edit" style="min-height:0;padding:0 4px">מקם ›</button></div>'
    +'<div id="ssStats"></div><div class="note" id="ssNote" style="margin:8px 0 0"></div>'
    +'<button class="ghost strong" id="ssEdit" type="button" data-w="owner" style="width:100%;margin:10px 0 0">מבנה האתר וקישור לסעיפים</button>';
  cv=$("#ssCv"); ctx=cv.getContext("2d"); cv.onclick=onCanvasTap; $("#ssZoomSel").onchange=e=>zoomTo(e.target.value||null);
  $("#ssUnpBtn").onclick=openUnplaced; $("#ssWhy").onclick=()=>explainProgress("map"); const ow=$("#ovWhy"); if(ow) ow.onclick=()=>explainProgress("contract");
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
  // זום: רשימת האלמנטים לבחירה מהמקלדת; מוקד שכבר לא במבנה נסגר
  const T=zoomTargets(L), zs=$("#ssZoomSel"); if(zs) zs.innerHTML='<option value="">התקרבות ל…</option>'+[["trench","תעלות"],["pad","משטחים"],["room","מבנים"],["pv","שדות"]].map(([k,l])=>{ const o=T.filter(t=>k==="pad"?(t.kind!=="trench"&&t.kind!=="pv"&&t.kind!=="room"):t.kind===k); return o.length?'<optgroup label="'+l+'">'+o.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.name)+'</option>').join("")+'</optgroup>':""; }).join("");
  if(focus){ const t=T.find(x=>x.id===focus.id); if(t) focus.t=t; else { focus=null; nearK=0; cam=homeCam(); } } else cam=homeCam();
  renderZoomInfo();
  // אתר בלי מפת שולחנות: הכרטיס הזה הוא «האתר נבנה» (כרטיס מפת השולחנות שייך לאתרים שיש להם מפה כזו)
  const bc=$("#buildCard"); if(bc&&!siteMap()){ bc.hidden=true; const h=card.querySelector("h3"), tn=h&&[...h.childNodes].find(n=>n.nodeType===3); if(tn&&tn.nodeValue!=="האתר נבנה") tn.nodeValue="האתר נבנה"; }   // רק הטקסט: הסיכום והקיפול שבכותרת נשארים
  // בלי דיווחים עדיין מציירים: האתר לפני העבודה (אדמה, גדר, מה שמתוכנן), בלי המספרים והציר
  $("#ssEmpty").hidden=has; $("#ssBody").hidden=false; card.classList.toggle("ss-bare",!has);
  if(!has){ foldSum("stages",""); u=1; size(); return; }
  try{ const b=getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(); if(b) BRAND=b; }catch(e){}
  // כרטיסי שלב לפי קבוצה: כמה דווח מתוך הכמות בסעיפים, או «לא מקושר»
  $("#ssStats").innerHTML=Object.keys(GROUPS).map(g=>{ const ps=M.P.filter(p=>p.g===g&&p.applies); if(!ps.length) return "";
    return '<div class="ss-grp"><div class="ss-gh">'+GROUPS[g]+'</div>'+ps.map(p=>'<div class="ss-ph'+(p.linked?'':' off')+'" id="ss_'+p.k+'"><span class="k"><i style="background:'+(p.c==="brand"?"var(--brand)":p.c)+'"></i>'+esc(p.l)+'</span><span class="n"><b class="v num">0</b>'+(p.linked?' <small>מתוך '+fmtN(p.total)+(p.unit?' '+esc(p.unit):'')+'</small>':' <small>לא מקושר לסעיף</small>')+'</span><div class="bar"><span style="background:'+(p.c==="brand"?"var(--brand)":p.c)+'"></span></div>'
      +(p.linked?'<span class="src">'+esc(p.A.map(a=>(a.code?a.code+" ":"")+a.name).join(" · "))+(p.last?' · עדכון אחרון '+isoText(isoOf(p.last)):'')+'</span>':'')+'</div>').join("")+'</div>'; }).join("");
  $("#ssNote").textContent=(L.fromTables?"ציור לפי מפת השולחנות של האתר (רבעים), לא הנדסה: ":L.fromPlan?"ציור לפי תוכנית האתר, לא הנדסה: ":"סכמה, לא בקנה מידה: ")+layoutSummary(L)+(d?"":L.fromTables?" (משטחים ותעלות יתווספו מהתוכנית ב«מבנה האתר»)":" (ברירת מחדל, «מבנה האתר» מתאים לאתר או קורא את התוכנית)")+". כלי תפעולי, לא תוכנית הנדסית. הכמויות מדיווחי הביצוע: דיווח עם מיקום נצבע באזור שלו; בלי מיקום הוא נספר בכמויות ומופיע ב«דיווחים בלי מיקום»; דיווח בשדה בלי שורות ממלא את השורות לפי הסדר בתוך אותו שדה בלבד. שלב מאוחר מושך בציור את הקודמים.";
  const s=M.state(1); const tot=M.P.filter(p=>p.linked&&p.applies&&p.total&&!p.open), nOpen=M.P.filter(p=>p.linked&&p.applies&&p.open).length;
  const un=M.unplaced(); $("#ssUnp").hidden=!un.length; $("#ssUnpTxt").innerHTML=un.length?'<b>'+un.length+'</b> דיווחים בלי מיקום באיור: נספרים בכמויות, לא נצבעים.':'';
  foldSum("stages",tot.length?Math.round(tot.reduce((a,p)=>a+clamp((s.V[p.k]||0)/p.total),0)/tot.length*100)+"% · "+tot.length+" שלבים":nOpen?nOpen+" עבודות באיור":"");
  if(!playing) u=clamp(u); size(); if(!cv.width) draw();
}

/* ---- שני מדדי התקדמות, בכוונה שונים: חוזי (ימי עובד בהסכם) ובמפה (ממוצע השלבים שבאיור) ---- */
export function explainProgress(which){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="שני מדדי התקדמות"><div class="grab"></div><h2>שני מדדי התקדמות, בכוונה שונים</h2>'
    +'<div class="note'+(which==="contract"?' strong':'')+'"><b>התקדמות חוזית</b> (למעלה במסך ביצוע): אחוז הביצוע בסעיפי ההסכם, כשכל סעיף שוקל לפי ימי העובד שלו בהסכם. סעיף של 48 ימי עובד מזיז את המספר יותר מסעיף של יום אחד. זה המספר שמדברים עליו מול החשבון.</div>'
    +'<div class="note'+(which==="map"?' strong':'')+'" style="margin-top:8px"><b>התקדמות במפה</b> (בכרטיס האיור): ממוצע פשוט של השלבים שמצוירים (תעלות, משטחים, שדות), כל שלב שוקל אותו דבר, ורק שלבים שמקושרים לסעיף עם כמות בהסכם. זה מצב הקרקע, לא החשבון.</div>'
    +'<div class="hint" style="margin-top:10px">שני המספרים לא אמורים להיות שווים: סעיף כבד בימי עובד (למשל חיווט) יכול להיות מאחור כשרוב המפה כבר צבועה, ולהפך.</div>'
    +'<div class="acts"><button class="cancel" type="button">סגור</button></div></div>');
  scrim.querySelector(".cancel").onclick=()=>scrim.remove(); scrim.onclick=e=>{ if(e.target===scrim) scrim.remove(); };
}

/* ---- דיווחים בלי מיקום: רשימה, וכל אחד נפתח לעריכה כדי למקם אותו על המפה ---- */
function openUnplaced(){
  const un=M?M.unplaced():[]; if(!un.length){ toast("כל הדיווחים ממוקמים."); return; }
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="דיווחים בלי מיקום"><div class="grab"></div><h2>דיווחים בלי מיקום באיור</h2>'
    +'<div class="note">כל דיווח כאן נספר בכמויות ובחשבון, אבל האיור לא יודע איפה הוא בוצע. לוחצים, בוחרים מיקום על המפה, ושומרים.</div>'
    +'<div class="stock">'+un.slice(0,60).map(e=>'<button class="slip" type="button" data-a="'+esc(e.a)+'" data-d="'+esc(e.d)+'"><b>'+esc((e.act.code?e.act.code+" ":"")+(e.act.name||""))+'</b><span class="hint">'+esc(isoText(e.date))+' · '+fmtN(e.q)+(e.unit?' '+esc(e.unit):'')+(e.area?' · «'+esc(e.area)+'»':' · בלי אזור')+' · '+esc(e.phase)+'</span></button>').join("")+'</div>'
    +(un.length>60?'<div class="hint">מוצגים 60 האחרונים מתוך '+un.length+'.</div>':'')
    +'<div class="acts"><button class="cancel" type="button">סגור</button></div></div>');
  const close=()=>scrim.remove(); scrim.querySelector(".cancel").onclick=close;
  scrim.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{ close(); if(typeof shared.placeReport==="function") shared.placeReport(b.dataset.a,b.dataset.d); });
}

/* ---- מפה קטנה לבחירת מיקום בדיווח (21-work): ציור, לחיצה → יעד, לחיצה בשדה → שורה ---- */
export function layoutTargets(L){ return [...L.trenches.map(t=>({id:t.id,name:t.name,kind:"trench",pts:t.pts})),...L.pads.filter(p=>p.kind!=="room").map(p=>({id:p.id,name:p.name,kind:p.kind,x:p.x,y:p.y,w:p.w,h:p.h})),...L.fields.map(f=>({id:f.id,name:f.name,kind:"pv",x:f.x,y:f.y,w:f.w,h:f.h,rows:f.rows}))]; }
function segDist(px,py,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy; const t=l2?Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/l2)):0; return Math.hypot(px-(a[0]+t*dx),py-(a[1]+t*dy)); }
// יעדי הזום: כל יעדי הפריסה, ועוד חדר החשמל (אין לו שלבי דיווח, אבל יש לו איור «מקרוב»)
export const zoomTargets=L=>[...layoutTargets(L),...L.pads.filter(p=>p.kind==="room").map(p=>({id:p.id,name:p.name,kind:"room",x:p.x,y:p.y,w:p.w,h:p.h}))];
export function pickAt(L,x,y,tol){ tol=tol==null?16:tol; const T=layoutTargets(L); let best=null,bd=tol;
  T.filter(t=>t.kind==="trench").forEach(t=>{ for(let i=1;i<t.pts.length;i++){ const d=segDist(x,y,t.pts[i-1],t.pts[i]); if(d<bd){ bd=d; best=t; } } });
  if(best) return best;
  const inRect=t=>x>=t.x&&x<=t.x+t.w&&y>=t.y&&y<=t.y+t.h;
  return T.find(t=>t.kind!=="trench"&&t.kind!=="pv"&&inRect(t))||T.find(t=>t.kind==="pv"&&inRect(t))||null; }
export function rowAt(L,f,y){ const n=f.rows||1, top=Math.min(22,f.h*.18), sp=(f.h-top-4)/n; return Math.max(1,Math.min(n,Math.floor((y-f.y-top)/sp)+1)); }
export function drawMini(canvas,L,selId,rows){
  if(!canvas) return; const W=canvas.parentElement?canvas.parentElement.clientWidth:0; if(!W) return;
  const dpr=Math.min(2.5,window.devicePixelRatio||1), sc=W/L.w, c=canvas.getContext("2d");
  canvas.width=Math.round(W*dpr); canvas.height=Math.round(L.h*sc*dpr); canvas.style.height=(L.h*sc)+"px"; c.setTransform(dpr*sc,0,0,dpr*sc,0,0);
  let brand="#3F4447"; try{ const b=getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(); if(b) brand=b; }catch(e){}
  c.fillStyle="#FFFFFF"; c.fillRect(0,0,L.w,L.h); const [fx,fy,fw,fh]=L.fence; c.fillStyle="#F4EFE6"; c.fillRect(fx,fy,fw,fh); c.strokeStyle="#8E9193"; c.lineWidth=2; c.setLineDash([10,6]); c.strokeRect(fx,fy,fw,fh); c.setLineDash([]);
  const fs=Math.max(11,12/sc), font=f=>"600 "+f+"px Alef, Heebo, Arial, sans-serif"; c.textAlign="center"; c.textBaseline="bottom"; c.direction="rtl";
  const txt=(t,x,y,maxW)=>{ let f=fs; c.font=font(f); const w=c.measureText(t).width; if(maxW&&w>maxW){ f=Math.max(6,f*maxW/w); c.font=font(f); } c.fillStyle="#3F4447"; c.fillText(t,x,y); };   // תווית לא רחבה מהאלמנט שלה
  const hi=t=>t.id===selId;
  for(const t of L.trenches){ c.beginPath(); c.moveTo(t.pts[0][0],t.pts[0][1]); t.pts.slice(1).forEach(p=>c.lineTo(p[0],p[1])); c.lineWidth=hi(t)?10:5; c.strokeStyle=hi(t)?brand:"#C9A98A"; c.lineCap="round"; c.lineJoin="round"; c.stroke(); }
  for(const p of L.pads){ c.fillStyle=p.kind==="room"?"#E4E1DA":hi(p)?brand:"#D5D7D8"; c.globalAlpha=hi(p)?.35:1; c.fillRect(p.x,p.y,p.w,p.h); c.globalAlpha=1; c.strokeStyle=hi(p)?brand:"#8E9193"; c.lineWidth=hi(p)?3:1.2; c.strokeRect(p.x,p.y,p.w,p.h); txt(p.name,p.x+p.w/2,p.y-3,p.w+10); }
  for(const f of L.fields){ const n=f.rows||1, top=Math.min(22,f.h*.18), sp=(f.h-top-4)/n;
    c.fillStyle=hi(f)?brand:"#FFFFFF"; c.globalAlpha=hi(f)?.18:.6; c.fillRect(f.x,f.y,f.w,f.h); c.globalAlpha=1;
    c.strokeStyle="#D3D5D6"; c.lineWidth=.8; for(let r=0;r<n;r++){ const y=f.y+top+r*sp+sp*.3; c.beginPath(); c.moveTo(f.x+10,y); c.lineTo(f.x+f.w-10,y); c.stroke(); }
    if(hi(f)&&rows){ const a=Math.max(1,Math.min(n,rows[0]))-1, b=Math.max(1,Math.min(n,rows[1]))-1; c.fillStyle=brand; c.globalAlpha=.55; c.fillRect(f.x+6,f.y+top+a*sp,f.w-12,(b-a+1)*sp); c.globalAlpha=1; }
    c.strokeStyle=hi(f)?brand:"#9A9EA1"; c.lineWidth=hi(f)?3:1.2; c.setLineDash(hi(f)?[]:[5,4]); c.strokeRect(f.x,f.y,f.w,f.h); c.setLineDash([]);
    c.textAlign="right"; txt(f.name,f.x+f.w-6,f.y+top-2,f.w-12); c.textAlign="center"; }
}
export function targetByArea(L,area){ const T=layoutTargets(L); const i=matchArea(area,T); return i>=0?T[i]:null; }
export function targetById(L,id){ if(id==null||id==="") return null; return layoutTargets(L).find(t=>t.id===id)||null; }

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
    +'<div class="hint" style="margin:0 0 10px">האיור הוא סכמה מהמספרים, לא בקנה מידה. לכל אזור מזהה קבוע שנשמר עם המבנה: שינוי שם לא מנתק דיווחים. בדיווח הביצוע בוחרים את האזור על המפה או מהרשימה; דיווח בלי מיקום נספר בכמויות ולא נצבע.</div>'
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
    if(plan) plan=ensureIds(plan,layoutOf(d));   // מזהים קבועים: נשמרים עם המבנה, דיווחים נשארים מחוברים גם אחרי שינוי שם
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
