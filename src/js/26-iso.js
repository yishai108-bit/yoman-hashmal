// 26-iso.js — איור איזומטרי «מקרוב» (גרסה 15): כשנכנסים לאלמנט באיור האתר רואים אותו כאיור טכני נקי, חתוך (cutaway),
// בזווית של ~45° מלמעלה: מכולת אגירה (ובהמשך: סקיד/MVS, חדר חשמל, שורת פאנלים, תעלה). קו דק, גוונים עדינים, פרופורציות אמיתיות (מטרים).
// מה שבפנים משקף את הדיווחים: הוצב אבל לא חובר → מכולה ריקה; חובר → עם הציוד. הציור פרוצדורלי (Canvas 2D), בלי ספרייה.
// הקנבס של האיור מצויר ביחידות המפה (L), לכן כל עובי קו מקבל כפולה של px = גודל פיקסל אחד ביחידות האלה.
const clamp=x=>Math.max(0,Math.min(1,x||0));

const C30=Math.cos(Math.PI/6), S30=Math.sin(Math.PI/6);
const INK="#3F4447", INK2="rgba(63,68,71,.55)";
let HAIR=1;   // עובי קו-שערה ביחידות הקנבס (נקבע לפי px בכניסה)
// צבעי מתכת: גג בהיר, דופן ארוכה בינוני, דופן קצרה כהה (אור מלמעלה-שמאל)
const METAL={top:"#F7F8F8",side:"#E9EBEC",end:"#D8DBDD",inner:"#F1F2F2",dark:"#C9CDD0"};
const TINT={floor:"#F4EFE4",floorL:"#E6DFCF",conc:"#E2E3E1",concL:"#CFD1CF",gravel:"#EFEAE0",rack:"#D9E4ED",rackS:"#C2D2DF",rackE:"#AEC1D1",cell:"#F3F7FA",brand:"#F2B03D",cab:"#CFD5DA",cabS:"#B9C1C7",cabE:"#A3ACB3",sky:"#DDEAF3",cableO:"#D9782D"};

/* ---- הטלה: x לאורך (ימינה-למטה על המסך), y לרוחב (שמאלה-למטה), z למעלה. מטר → יחידות קנבס לפי ההתאמה למסגרת ---- */
export function isoCamera(box,spanX,spanY,spanZ,pad){
  pad=pad==null?.9:pad; const w=(spanX+spanY)*C30, h=(spanX+spanY)*S30+spanZ, s=Math.min(box.w/w,box.h/h)*pad;
  const cx=box.x+box.w/2, cy=box.y+box.h/2;
  const mx=(spanX-spanY)*C30/2, my=((spanX+spanY)*S30-spanZ)/2;   // מרכז התיבה התלת-ממדית במרכז המסגרת
  return { s, p:(x,y,z)=>[cx+((x-y)*C30-mx)*s, cy+((x+y)*S30-z-my)*s] };
}
let ctx=null, cam=null, alpha=1;
function poly(pts,fill,stroke,lw){ ctx.beginPath(); pts.forEach((q,i)=>{ const [X,Y]=cam.p(q[0],q[1],q[2]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }); ctx.closePath(); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(stroke!==null){ ctx.strokeStyle=stroke||INK; ctx.lineWidth=lw||HAIR; ctx.lineJoin="round"; ctx.stroke(); } }
function seg(a,b,stroke,lw){ ctx.beginPath(); let q=cam.p(...a); ctx.moveTo(q[0],q[1]); q=cam.p(...b); ctx.lineTo(q[0],q[1]); ctx.strokeStyle=stroke||INK; ctx.lineWidth=lw||HAIR; ctx.stroke(); }
function dot(x,y,z,w,h,fill,stroke){ const q=cam.p(x,y,z); ctx.fillStyle=fill; ctx.fillRect(q[0]-w/2,q[1]-h/2,w,h); if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=HAIR*.6; ctx.strokeRect(q[0]-w/2,q[1]-h/2,w,h); } }
// תיבה: שלוש פאות גלויות (למעלה, +y, +x)
function box3(x,y,z,dx,dy,dz,f,stroke){ f=f||METAL; const X=x+dx,Y=y+dy,Z=z+dz;
  poly([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],f.side,stroke);   // פאה +y (ארוכה, פונה לצופה משמאל)
  poly([[X,y,z],[X,Y,z],[X,Y,Z],[X,y,Z]],f.end,stroke);    // פאה +x (קצרה, מימין)
  poly([[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]],f.top,stroke); }  // גג
// צל רך על הקרקע
function shadow(x,y,dx,dy,off){ off=off||.35; ctx.save(); ctx.globalAlpha=alpha*.26; ctx.filter="blur("+Math.max(2*HAIR,cam.s*.14)+"px)"; poly([[x+off,y+off,0],[x+dx+off*2,y+off,0],[x+dx+off*2,y+dy+off*2,0],[x+off,y+dy+off*2,0]],"#2A2E30",null); ctx.restore(); }
// קווי גליות על דופן (מישור y=const או x=const): פסים אנכיים דקים
function ribs(plane,at,from,to,z0,z1,pitch,color){ ctx.strokeStyle=color||INK2; ctx.lineWidth=HAIR*.7; ctx.beginPath();
  for(let t=from+pitch;t<to-pitch/2;t+=pitch){ const a=plane==="y"?[t,at,z0]:[at,t,z0], b=plane==="y"?[t,at,z1]:[at,t,z1]; let q=cam.p(...a); ctx.moveTo(q[0],q[1]); q=cam.p(...b); ctx.lineTo(q[0],q[1]); } ctx.stroke(); }
// משטח: חצץ (נקודות) ואז בטון (לוח) מתחת לאלמנט
function pad(x,y,dx,dy,base,conc){ const m=.5;
  if(base>0){ ctx.globalAlpha=alpha*Math.max(.35,base); poly([[x-m-.4,y-m-.4,0],[x+dx+m+.4,y-m-.4,0],[x+dx+m+.4,y+dy+m+.4,0],[x-m-.4,y+dy+m+.4,0]],TINT.gravel,INK2);
    ctx.fillStyle="#C9C1B2"; for(let i=0;i<90;i++){ const px=x-m-.3+((i*37)%97)/97*(dx+2*m+.6), py=y-m-.3+((i*53)%89)/89*(dy+2*m+.6); const q=cam.p(px,py,0); ctx.fillRect(q[0],q[1],1.3*HAIR,1.3*HAIR); } ctx.globalAlpha=alpha; }
  if(conc>0){ const w=(dx+2*m)*clamp(conc); box3(x-m,y-m,-.15,w,dy+2*m,.15,{top:TINT.conc,side:TINT.concL,end:TINT.concL}); } }

/* ---- מכולה 20 רגל (6.06 × 2.44 × 2.59 מ׳) במיקום x0, חתוכה: הדופן הארוכה הקרובה הוסרה ורואים את הפנים.
   placed/wired ביחידות 0..1. הפנים (מדפי סוללות, ארון ממיר/בקרה, תעלת כבלים, מיזוג) מופיע רק כשחובר. ---- */
const CL=6.06, CW=2.44, CH=2.59;
function container(x0,placed,wired,racks){
  const L=CL,W=CW,H=CH, pz=.15, z0=pz, z1=pz+H, post=.14, a0=alpha*Math.max(.4,placed);
  if(placed<=0){ ctx.setLineDash([6*HAIR,5*HAIR]); poly([[x0,0,0],[x0+L,0,0],[x0+L,W,0],[x0,W,0]],null,INK2); ctx.setLineDash([]); return; }
  ctx.globalAlpha=a0; shadow(x0,0,L,W,.55);
  // רצפה: לוח בהיר עם קווי לוחות, והצללה ליד הדופן האחורית (עומק)
  poly([[x0,0,z0],[x0+L,0,z0],[x0+L,W,z0],[x0,W,z0]],TINT.floor,INK); for(let t=.5;t<L;t+=.5) seg([x0+t,0,z0],[x0+t,W,z0],TINT.floorL,HAIR*.6);
  poly([[x0,0,z0+.001],[x0+L,0,z0+.001],[x0+L,.7,z0+.001],[x0,.7,z0+.001]],"rgba(63,68,71,.06)",null);
  // דופן אחורית (y=0) מבפנים + דופן קצה רחוקה (x=0) מבפנים
  poly([[x0,0,z0],[x0+L,0,z0],[x0+L,0,z1],[x0,0,z1]],METAL.inner,INK); ribs("y",0,x0,x0+L,z0+.12,z1-.12,.28,"rgba(63,68,71,.22)");
  poly([[x0,0,z0],[x0,W,z0],[x0,W,z1],[x0,0,z1]],METAL.side,INK); ribs("x",x0,0,W,z0+.12,z1-.12,.28,"rgba(63,68,71,.3)");
  box3(x0,W-.08,0,L,.08,z0,{top:METAL.end,side:METAL.dark,end:METAL.dark});   // קורת צד תחתונה
  if(wired>0){ ctx.globalAlpha=a0*Math.max(.35,wired);
    const n=racks||8, rw=.56, gap=(L-.9-n*rw)/(n-1), rd=.78, rh=2.2, tiers=7;
    for(let i=0;i<n;i++){ const x=x0+.45+i*(rw+gap); if(i/n>wired+.01) break;
      box3(x,.06,z0,rw,rd,rh,{top:TINT.rack,side:TINT.rackS,end:TINT.rackE});
      for(let t=0;t<tiers;t++){ const z=z0+.18+t*(rh-.3)/tiers, th=(rh-.3)/tiers-.06; poly([[x+.04,.06+rd,z],[x+rw-.04,.06+rd,z],[x+rw-.04,.06+rd,z+th],[x+.04,.06+rd,z+th]],TINT.cell,INK2,HAIR*.6); dot(x+rw-.12,.06+rd,z+th*.5,2.2*HAIR,2.2*HAIR,t%3?"#5BAE6B":TINT.brand); } }
    box3(x0+.3,.08,z1-.42,L-.6,.26,.1,{top:TINT.cab,side:TINT.cabS,end:TINT.cabE});   // תעלת כבלים לאורך הדופן האחורית
    // ארון ממיר/בקרה ליד הדלת, בצד הפתוח, עם מסך; כבלים ממנו אל פתח ברצפה והחוצה (כיוון התעלה)
    const cx=x0+L-1.0, cw=.75, cd=.62, cy=W-.95, ch=2.0; box3(cx,cy,z0,cw,cd,ch,{top:TINT.cab,side:TINT.cabS,end:TINT.cabE});
    poly([[cx+.1,cy+cd,z0+1.35],[cx+cw-.1,cy+cd,z0+1.35],[cx+cw-.1,cy+cd,z0+1.7],[cx+.1,cy+cd,z0+1.7]],TINT.sky,INK2,HAIR*.6); seg([cx+.08,cy+cd,z0+1.05],[cx+cw-.08,cy+cd,z0+1.05],INK2,HAIR*.6);
    ctx.strokeStyle=TINT.cableO; ctx.lineWidth=HAIR*1.6; ctx.beginPath(); for(let j=0;j<3;j++){ const yy=cy+.12+j*.14; let q=cam.p(cx+cw*.5,yy,z0+.3); ctx.moveTo(q[0],q[1]); q=cam.p(cx+cw*.5,yy,z0-.02); ctx.lineTo(q[0],q[1]); q=cam.p(x0+L+.9,yy+.3,-.05); ctx.lineTo(q[0],q[1]); } ctx.stroke(); }
  ctx.globalAlpha=a0;
  // גג עם גליות לרוחב
  poly([[x0,0,z1],[x0+L,0,z1],[x0+L,W,z1],[x0,W,z1]],METAL.top,INK);
  ctx.strokeStyle="rgba(63,68,71,.28)"; ctx.lineWidth=HAIR*.7; ctx.beginPath(); for(let t=.28;t<L;t+=.28){ let q=cam.p(x0+t,0,z1); ctx.moveTo(q[0],q[1]); q=cam.p(x0+t,W,z1); ctx.lineTo(q[0],q[1]); } ctx.stroke();
  // דופן קצה קרובה (x=L): שתי דלתות עם מוטות נעילה, ידיות וצירים
  poly([[x0+L,0,z0],[x0+L,W,z0],[x0+L,W,z1],[x0+L,0,z1]],METAL.end,INK); ribs("x",x0+L,0,W,z0+.1,z1-.1,.3,"rgba(63,68,71,.18)");
  seg([x0+L,W/2,z0+.05],[x0+L,W/2,z1-.05],INK,HAIR*1.1);
  for(const yy of [.42,.82,W-.82,W-.42]){ seg([x0+L,yy,z0+.12],[x0+L,yy,z1-.12],INK,HAIR*1.2); dot(x0+L,yy,z0+1.05,4*HAIR,3*HAIR,INK); dot(x0+L,yy,z0+1.25,4*HAIR,3*HAIR,INK); }
  for(const yy of [.12,W-.12]) for(const zz of [z0+.4,z0+H/2,z1-.4]) dot(x0+L,yy,zz,3*HAIR,6*HAIR,METAL.dark,INK);
  // עמודי פינה בצד הפתוח, אביזרי פינה, קורה עליונה בשפת הגג
  for(const x of [x0,x0+L]) poly([[x-post/2,W-post,z0],[x+post/2,W-post,z0],[x+post/2,W-post,z1],[x-post/2,W-post,z1]],METAL.dark,INK);
  for(const x of [x0,x0+L]) for(const y of [0,W]) for(const z of [0,z1-.18]){ if(x===x0&&y===0) continue; box3(x-(x>x0?post:0),y-(y?post:0),z,post,post,.18,{top:"#B7BCC0",side:"#9EA4A9",end:"#8A9196"}); }
  box3(x0,W-.06,z1-.1,L,.06,.1,{top:METAL.end,side:METAL.dark,end:METAL.dark});
  if(wired>0){ box3(x0+.9,.55,z1,1.1,.95,.42,{top:METAL.side,side:METAL.end,end:METAL.dark}); ctx.strokeStyle=INK2; ctx.lineWidth=HAIR*.6; ctx.beginPath(); for(let t=0;t<.3;t+=.05){ let q=cam.p(x0+2.0,.65,z1+.1+t); ctx.moveTo(q[0],q[1]); q=cam.p(x0+2.0,1.4,z1+.1+t); ctx.lineTo(q[0],q[1]); } ctx.stroke(); }   // יחידת מיזוג על הגג
  ctx.globalAlpha=alpha;
}

/* ---- מתחם אגירה: עד 4 מכולות בשורה (קצה לקצה), על משטח משותף. st={base,conc,units:[{placed,wired},…]} ---- */
export function isoBess(c,boxPx,st,opt){ ctx=c; opt=opt||{}; st=st||{}; HAIR=opt.px||1;
  const units=(st.units&&st.units.length?st.units:[{placed:st.placed==null?1:st.placed,wired:st.wired==null?1:st.wired}]).slice(0,4), n=units.length, gap=1.2, span=n*CL+(n-1)*gap;
  cam=isoCamera(boxPx,span+1.4,CW+1.4,CH+1.2,opt.pad||.86); alpha=opt.alpha==null?1:opt.alpha; ctx.save(); ctx.globalAlpha=alpha;
  pad(0,0,span,CW,st.base==null?1:st.base,st.conc==null?1:st.conc);
  units.forEach((uu,i)=>container(i*(CL+gap),uu.placed,uu.wired,opt.racks));
  ctx.restore(); return cam;
}

// איזה סוגי אלמנט כבר יש להם איור איזומטרי (השאר ממשיכים בציור המקורב מלמעלה עד שיצוירו)
export const ISO_KINDS=["bess"];
/* הדיספאצ'ר: מצייר את האלמנט el (מהפריסה) לפי מצב השלבים F שלו (שברים 0..1) במסגרת box. מחזיר false אם אין איור לסוג הזה. */
export function isoScene(c,box,el,F,alpha,px){
  if(!el||!ISO_KINDS.includes(el.kind)) return false; F=F||{};
  if(el.kind==="bess"){ const n=Math.max(1,el.units||1), m=Math.min(n,4), units=[]; for(let i=0;i<m;i++) units.push({placed:clamp((F.bess||0)*m-i),wired:clamp((F.wire||0)*m-i)});   // עד 4 מכולות מייצגות: כל אחת = רבע מהכמות
    isoBess(c,box,{base:F.base||0,conc:F.conc||0,units},{alpha,px}); return true; }
  return false;
}

// אין מה לאתחל: המודול מצייר רק כשקוראים לו מ-24-site-stages
export function __init(){}
