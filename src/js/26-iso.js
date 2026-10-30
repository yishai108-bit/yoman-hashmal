// 26-iso.js — איור איזומטרי «מקרוב» (גרסה 15–16): כשנכנסים לאלמנט באיור האתר רואים אותו כאיור טכני נקי, חתוך (cutaway),
// בזווית של ~45° מלמעלה: מכולת אגירה, סקיד/MVS, חדר חשמל, שורת פאנלים, תעלה. קו דק, גוונים עדינים, פרופורציות אמיתיות (מטרים),
// לפי מה שנלמד מתוכניות ביצוע של אתר סולארי (ראו מסמך הלמידה בתיקיית הפרויקט). מה שבפנים משקף את הדיווחים:
// הוצב אבל לא חובר → מכולה ריקה; חובר → עם הציוד. הציור פרוצדורלי (Canvas 2D), בלי ספרייה.
// הקנבס של האיור מצויר ביחידות המפה (L), לכן כל עובי קו מקבל כפולה של px = גודל פיקסל אחד ביחידות האלה.
const clamp=x=>Math.max(0,Math.min(1,x||0));

const C30=Math.cos(Math.PI/6), S30=Math.sin(Math.PI/6);
const INK="#3F4447", INK2="rgba(63,68,71,.55)", INK3="rgba(63,68,71,.28)";
let HAIR=1;   // עובי קו-שערה ביחידות הקנבס (נקבע לפי px בכניסה)
// צבעי מתכת: גג בהיר, דופן ארוכה בינוני, דופן קצרה כהה (אור מלמעלה-שמאל)
const METAL={top:"#F7F8F8",side:"#E9EBEC",end:"#D8DBDD",inner:"#F1F2F2",dark:"#C9CDD0"};
const STEEL={top:"#AEB4B9",side:"#969DA3",end:"#7F878E"};
const GREY={top:"#DADEE1",side:"#C4C9CD",end:"#AEB4B9"};
const DARK={top:"#B7BDC2",side:"#9CA3A9",end:"#858D94"};
const CAB={top:"#CFD5DA",side:"#B9C1C7",end:"#A3ACB3"};
const TINT={floor:"#F4EFE4",floorL:"#E6DFCF",conc:"#E2E3E1",concL:"#CFD1CF",gravel:"#EFEAE0",rack:"#D9E4ED",rackS:"#C2D2DF",rackE:"#AEC1D1",cell:"#F3F7FA",brand:"#F2B03D",sky:"#DDEAF3",cableO:"#D9782D",
  wall:"#F3F1EC",wallS:"#E4E1DA",wallE:"#D3CFC6",soilS:"#CDB58E",soilE:"#B89A6C",sand:"#F2E6C8",pv:"#3F6A94",pvGrid:"rgba(255,255,255,.35)",ground:"#F6F2E9"};

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
function path(pts,stroke,lw){ ctx.beginPath(); pts.forEach((q,i)=>{ const [X,Y]=cam.p(q[0],q[1],q[2]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }); ctx.strokeStyle=stroke||INK; ctx.lineWidth=lw||HAIR; ctx.lineJoin="round"; ctx.lineCap="round"; ctx.stroke(); }
function dot(x,y,z,w,h,fill,stroke){ const q=cam.p(x,y,z); ctx.fillStyle=fill; ctx.fillRect(q[0]-w/2,q[1]-h/2,w,h); if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=HAIR*.6; ctx.strokeRect(q[0]-w/2,q[1]-h/2,w,h); } }
// תיבה: שלוש פאות גלויות (למעלה, +y, +x)
function box3(x,y,z,dx,dy,dz,f,stroke){ f=f||METAL; const X=x+dx,Y=y+dy,Z=z+dz;
  poly([[x,Y,z],[X,Y,z],[X,Y,Z],[x,Y,Z]],f.side,stroke);   // פאה +y (ארוכה, פונה לצופה משמאל)
  poly([[X,y,z],[X,Y,z],[X,Y,Z],[X,y,Z]],f.end,stroke);    // פאה +x (קצרה, מימין)
  poly([[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]],f.top,stroke); }  // גג
// גליל אנכי (מבודד, ארובה): גוף + אליפסה למעלה
function cyl(x,y,z,r,h,f){ const steps=16, top=[]; for(let i=0;i<steps;i++){ const a=i/steps*Math.PI*2; top.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z+h]); }
  const q0=cam.p(x,y,z), q1=cam.p(x,y,z+h), rr=r*cam.s*C30*1.15; ctx.fillStyle=f.side; ctx.fillRect(q0[0]-rr,q1[1],2*rr,q0[1]-q1[1]); ctx.strokeStyle=INK; ctx.lineWidth=HAIR*.8; ctx.beginPath(); ctx.moveTo(q0[0]-rr,q1[1]); ctx.lineTo(q0[0]-rr,q0[1]); ctx.moveTo(q0[0]+rr,q1[1]); ctx.lineTo(q0[0]+rr,q0[1]); ctx.stroke();
  poly(top,f.top,INK,HAIR*.8); }
// צל רך על הקרקע
function shadow(x,y,dx,dy,off){ off=off||.35; ctx.save(); ctx.globalAlpha=alpha*.26; ctx.filter="blur("+Math.max(2*HAIR,cam.s*.14)+"px)"; poly([[x+off,y+off,0],[x+dx+off*2,y+off,0],[x+dx+off*2,y+dy+off*2,0],[x+off,y+dy+off*2,0]],"#2A2E30",null); ctx.restore(); }
// קווי גליות על דופן (מישור y=const או x=const): פסים אנכיים דקים
function ribs(plane,at,from,to,z0,z1,pitch,color){ ctx.strokeStyle=color||INK2; ctx.lineWidth=HAIR*.7; ctx.beginPath();
  for(let t=from+pitch;t<to-pitch/2;t+=pitch){ const a=plane==="y"?[t,at,z0]:[at,t,z0], b=plane==="y"?[t,at,z1]:[at,t,z1]; let q=cam.p(...a); ctx.moveTo(q[0],q[1]); q=cam.p(...b); ctx.lineTo(q[0],q[1]); } ctx.stroke(); }
// לוברים: קווים אופקיים על פאה (מישור y=const)
function louvers(x0,x1,y,z0,z1,pitch){ ctx.strokeStyle=INK3; ctx.lineWidth=HAIR*.7; ctx.beginPath(); for(let z=z0+pitch;z<z1;z+=pitch){ let q=cam.p(x0,y,z); ctx.moveTo(q[0],q[1]); q=cam.p(x1,y,z); ctx.lineTo(q[0],q[1]); } ctx.stroke(); }
// קווי גג גליים לרוחב (לאורך y) על משטח z
function roofRibs(x0,x1,y0,y1,z,pitch){ ctx.strokeStyle=INK3; ctx.lineWidth=HAIR*.7; ctx.beginPath(); for(let t=x0+pitch;t<x1;t+=pitch){ let q=cam.p(t,y0,z); ctx.moveTo(q[0],q[1]); q=cam.p(t,y1,z); ctx.lineTo(q[0],q[1]); } ctx.stroke(); }
// משטח: חצץ (נקודות) ואז בטון (לוח) מתחת לאלמנט
function pad(x,y,dx,dy,base,conc){ const m=.5;
  if(base>0){ ctx.globalAlpha=alpha*Math.max(.35,base); poly([[x-m-.4,y-m-.4,0],[x+dx+m+.4,y-m-.4,0],[x+dx+m+.4,y+dy+m+.4,0],[x-m-.4,y+dy+m+.4,0]],TINT.gravel,INK2);
    ctx.fillStyle="#C9C1B2"; for(let i=0;i<90;i++){ const px=x-m-.3+((i*37)%97)/97*(dx+2*m+.6), py=y-m-.3+((i*53)%89)/89*(dy+2*m+.6); const q=cam.p(px,py,0); ctx.fillRect(q[0],q[1],1.3*HAIR,1.3*HAIR); } ctx.globalAlpha=alpha; }
  if(conc>0){ const w=(dx+2*m)*clamp(conc); box3(x-m,y-m,-.15,w,dy+2*m,.15,{top:TINT.conc,side:TINT.concL,end:TINT.concL}); } }
function outline(x,y,dx,dy){ ctx.setLineDash([6*HAIR,5*HAIR]); poly([[x,y,0],[x+dx,y,0],[x+dx,y+dy,0],[x,y+dy,0]],null,INK2); ctx.setLineDash([]); }
// כבלים: n קווים כתומים מקבילים לאורך רשימת נקודות
function cables(pts,n,sp,lw){ for(let j=0;j<(n||1);j++) path(pts.map(p=>[p[0],p[1]+j*(sp||.14),p[2]]),TINT.cableO,(lw||1.6)*HAIR); }
// רמת פירוט גבוהה (opt.detail>=2): תווית טקסט קטנה עם קו מוביל, וקו מידה בין שתי נקודות
function fontPx(){ return Math.max(9*HAIR,.2*cam.s); }
function label(text,at,off){ const q=cam.p(...at), tx=q[0]+off[0]*cam.s, ty=q[1]+off[1]*cam.s; ctx.save(); ctx.strokeStyle=INK2; ctx.lineWidth=HAIR*.7; ctx.beginPath(); ctx.moveTo(q[0],q[1]); ctx.lineTo(tx,ty); ctx.stroke();
  ctx.fillStyle=INK2; ctx.beginPath(); ctx.arc(q[0],q[1],HAIR*1.4,0,Math.PI*2); ctx.fill();
  ctx.font=fontPx()+"px system-ui,-apple-system,sans-serif"; ctx.textBaseline="middle"; ctx.textAlign=off[0]<0?"right":"left"; ctx.fillStyle=INK; ctx.fillText(text,tx+(off[0]<0?-3:3)*HAIR,ty); ctx.restore(); }
function dim(a,b,text){ const qa=cam.p(...a), qb=cam.p(...b), dx=qb[0]-qa[0], dy=qb[1]-qa[1], len=Math.hypot(dx,dy)||1, nx=-dy/len*4*HAIR, ny=dx/len*4*HAIR; ctx.save(); ctx.strokeStyle=INK2; ctx.lineWidth=HAIR*.7; ctx.beginPath(); ctx.moveTo(qa[0],qa[1]); ctx.lineTo(qb[0],qb[1]); ctx.moveTo(qa[0]-nx,qa[1]-ny); ctx.lineTo(qa[0]+nx,qa[1]+ny); ctx.moveTo(qb[0]-nx,qb[1]-ny); ctx.lineTo(qb[0]+nx,qb[1]+ny); ctx.stroke();
  ctx.font=fontPx()+"px system-ui,-apple-system,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="bottom"; ctx.fillStyle=INK; ctx.fillText(text,(qa[0]+qb[0])/2-ny*1.2,(qa[1]+qb[1])/2+nx*1.2-2*HAIR); ctx.restore(); }

/* ---- מכולה 20 רגל (6.06 × 2.44 × 2.59 מ׳) במיקום x0, חתוכה: הדופן הארוכה הקרובה הוסרה ורואים את הפנים.
   placed/wired ביחידות 0..1. הפנים (מדפי סוללות, ארון ממיר/בקרה, תעלת כבלים, מיזוג) מופיע רק כשחובר. ---- */
const CL=6.06, CW=2.44, CH=2.59;
function container(x0,placed,wired,racks){
  const L=CL,W=CW,H=CH, pz=.15, z0=pz, z1=pz+H, post=.14, a0=alpha*Math.max(.4,placed);
  if(placed<=0){ outline(x0,0,L,W); return; }
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
    box3(x0+.3,.08,z1-.42,L-.6,.26,.1,CAB);   // תעלת כבלים לאורך הדופן האחורית
    // ארון ממיר/בקרה ליד הדלת, בצד הפתוח, עם מסך; כבלים ממנו אל פתח ברצפה והחוצה (כיוון התעלה)
    const cx=x0+L-1.0, cw=.75, cd=.62, cy=W-.95, ch=2.0; box3(cx,cy,z0,cw,cd,ch,CAB);
    poly([[cx+.1,cy+cd,z0+1.35],[cx+cw-.1,cy+cd,z0+1.35],[cx+cw-.1,cy+cd,z0+1.7],[cx+.1,cy+cd,z0+1.7]],TINT.sky,INK2,HAIR*.6); seg([cx+.08,cy+cd,z0+1.05],[cx+cw-.08,cy+cd,z0+1.05],INK2,HAIR*.6);
    cables([[cx+cw*.5,cy+.12,z0+.3],[cx+cw*.5,cy+.12,z0-.02],[x0+L+.9,cy+.42,-.05]],3,.14); }
  ctx.globalAlpha=a0;
  // גג עם גליות לרוחב
  poly([[x0,0,z1],[x0+L,0,z1],[x0+L,W,z1],[x0,W,z1]],METAL.top,INK); roofRibs(x0,x0+L,0,W,z1,.28);
  // דופן קצה קרובה (x=L): שתי דלתות עם מוטות נעילה, ידיות וצירים
  poly([[x0+L,0,z0],[x0+L,W,z0],[x0+L,W,z1],[x0+L,0,z1]],METAL.end,INK); ribs("x",x0+L,0,W,z0+.1,z1-.1,.3,"rgba(63,68,71,.18)");
  seg([x0+L,W/2,z0+.05],[x0+L,W/2,z1-.05],INK,HAIR*1.1);
  for(const yy of [.42,.82,W-.82,W-.42]){ seg([x0+L,yy,z0+.12],[x0+L,yy,z1-.12],INK,HAIR*1.2); dot(x0+L,yy,z0+1.05,4*HAIR,3*HAIR,INK); dot(x0+L,yy,z0+1.25,4*HAIR,3*HAIR,INK); }
  for(const yy of [.12,W-.12]) for(const zz of [z0+.4,z0+H/2,z1-.4]) dot(x0+L,yy,zz,3*HAIR,6*HAIR,METAL.dark,INK);
  // עמודי פינה בצד הפתוח, אביזרי פינה, קורה עליונה בשפת הגג
  for(const x of [x0,x0+L]) poly([[x-post/2,W-post,z0],[x+post/2,W-post,z0],[x+post/2,W-post,z1],[x-post/2,W-post,z1]],METAL.dark,INK);
  for(const x of [x0,x0+L]) for(const y of [0,W]) for(const z of [0,z1-.18]){ if(x===x0&&y===0) continue; box3(x-(x>x0?post:0),y-(y?post:0),z,post,post,.18,{top:"#B7BCC0",side:"#9EA4A9",end:"#8A9196"}); }
  box3(x0,W-.06,z1-.1,L,.06,.1,{top:METAL.end,side:METAL.dark,end:METAL.dark});
  if(wired>0){ box3(x0+.9,.55,z1,1.1,.95,.42,{top:METAL.side,side:METAL.end,end:METAL.dark}); louvers(x0+.95,x0+1.95,1.5,z1+.08,z1+.38,.06); }   // יחידת מיזוג על הגג
  ctx.globalAlpha=alpha;
}

/* ---- מתחם אגירה: עד 4 מכולות בשורה (קצה לקצה), על משטח משותף. st={base,conc,units:[{placed,wired},…]} ---- */
export function isoBess(c,boxPx,st,opt){ ctx=c; opt=opt||{}; st=st||{}; HAIR=opt.px||1; const D=(opt.detail||1)>=2, dA=opt.detailAlpha==null?1:opt.detailAlpha, late=[];
  const units=(st.units&&st.units.length?st.units:[{placed:st.placed==null?1:st.placed,wired:st.wired==null?1:st.wired}]).slice(0,4), n=units.length, gap=1.2, span=n*CL+(n-1)*gap;
  cam=isoCamera(boxPx,span+1.4,CW+1.4,CH+1.2,opt.pad||.86); alpha=opt.alpha==null?1:opt.alpha; ctx.save(); ctx.globalAlpha=alpha;
  pad(0,0,span,CW,st.base==null?1:st.base,st.conc==null?1:st.conc);
  units.forEach((uu,i)=>container(i*(CL+gap),uu.placed,uu.wired,opt.racks));
  if(D&&units[0].placed>0){ ctx.globalAlpha=alpha*dA; const u=units[0], z0=.15, z1=z0+CH, kl=units.map(x=>x.placed>0).lastIndexOf(true), xe=kl*(CL+gap)+CL;   // פרטי הקצה על המכולה האחרונה שהוצבה   // פירוט: שלטים, רפפת אוורור, מטף, תוויות ומידות (על המכולה הראשונה)
    dot(xe,CW*.5,z0+1.75,.5*cam.s,.14*cam.s,"#F7F8F8",INK2); dot(xe,CW*.5,z0+1.95,.16*cam.s,.14*cam.s,TINT.brand,INK2);   // לוח מספר + שלט אזהרה על דלתות הקצה
    for(let z=z1-.55;z<z1-.15;z+=.08) seg([xe,.3,z],[xe,.9,z],INK3,HAIR*.7); poly([[xe,.3,z1-.55],[xe,.9,z1-.55],[xe,.9,z1-.15],[xe,.3,z1-.15]],null,INK2);   // רפפת אוורור
    if(u.wired>0){ cyl(CL-1.75,CW-.5,z0,.1,.7,{top:"#C8352E",side:"#B32C26"});   // מטף / גליל כיבוי
      late.push(()=>{ label("מדפי סוללות",[CL*.45,.6,z0+1.6],[-2.1,-.2]); label("תעלת כבלים",[CL*.7,.2,z1-.37],[.2,-1.1]); label("ארון PCS / בקרה",[CL-.6,CW-.6,z0+2.0],[.7,-1.3]); label("יחידת מיזוג",[1.45,1.0,z1+.42],[-.6,-1.1]); }); }
    else late.push(()=>{ label("מכולה הוצבה, טרם חוברה",[CL*.5,CW*.5,z0+1.2],[-.6,-1.9]); });
    late.push(()=>{ dim([0,CW+.7,0],[CL,CW+.7,0],"6.06 מ׳"); dim([xe+.5,0,0],[xe+.5,CW,0],"2.44 מ׳"); dim([xe+.5,CW,0],[xe+.5,CW,CH],"2.59 מ׳"); }); }
  if(late.length){ ctx.globalAlpha=alpha*dA; late.forEach(f=>f()); } ctx.restore(); return cam;
}

/* ---- שנאי: מיכל עם צלעות קירור על הדופן הקרובה ושלושה מבודדים למעלה ---- */
function transformer(x,y,z,dx,dy,dz){ box3(x,y,z,dx,dy,dz,GREY);
  for(let i=0;i<Math.floor(dx/.3);i++){ const fx=x+.15+i*.3; box3(fx,y+dy,z+.15,.12,.22,dz-.3,{top:"#CBD0D4",side:"#B3B9BE",end:"#9DA4AA"}); }   // צלעות קירור
  for(let i=0;i<3;i++){ const bx=x+dx*(.25+.25*i), by=y+dy*.5; cyl(bx,by,z+dz,.07,.55,{top:"#E7E9EB",side:"#C3C8CC"}); for(let k=0;k<3;k++){ const q=cam.p(bx,by,z+dz+.15+k*.14); ctx.fillStyle="#B9BFC4"; ctx.beginPath(); ctx.ellipse(q[0],q[1],.13*cam.s,.065*cam.s,0,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=HAIR*.6; ctx.stroke(); } } }
// ארון חשמל סגור: דלתות (קווים אנכיים), ידיות, לוברים למעלה
function cabinet(x,y,z,dx,dy,dz,doors,f){ box3(x,y,z,dx,dy,dz,f||CAB); const n=doors||1, w=dx/n;
  for(let i=1;i<n;i++) seg([x+i*w,y+dy,z+.05],[x+i*w,y+dy,z+dz-.05],INK2,HAIR*.8);
  for(let i=0;i<n;i++) dot(x+i*w+w*.82,y+dy,z+dz*.5,2.2*HAIR,7*HAIR,INK);
  louvers(x+.08,x+dx-.08,y+dy,z+dz*.72,z+dz*.9,.06); }

/* ---- סקיד / תחנת MVS: מסגרת פלדה על משטח, עליה RMU, שנאי, ולוח LV (MVS) או מארז ממירי אגירה חתוך (סקיד).
   st={base,conc,placed,wired}; opt.variant "mvs" | "skid" ---- */
export function isoSkid(c,boxPx,st,opt){ ctx=c; opt=opt||{}; st=st||{}; HAIR=opt.px||1; const skid=opt.variant==="skid", D=(opt.detail||1)>=2, dA=opt.detailAlpha==null?1:opt.detailAlpha, late=[];
  const L=skid?12.2:9.6, W=2.8, Hmax=2.9; cam=isoCamera(boxPx,L+1.6,W+1.6,Hmax+1.2,opt.pad||.86); alpha=opt.alpha==null?1:opt.alpha; ctx.save(); ctx.globalAlpha=alpha;
  pad(0,0,L,W,st.base==null?1:st.base,st.conc==null?1:st.conc);
  const placed=st.placed==null?1:st.placed, wired=st.wired==null?1:st.wired;
  if(placed<=0){ outline(0,0,L,W); ctx.restore(); return cam; }
  const a0=alpha*Math.max(.4,placed); ctx.globalAlpha=a0; shadow(0,0,L,W,.5);
  // מסגרת הסקיד: רצפת פח על קורות, קווי קורות רוחב
  box3(0,0,0,L,W,.22,{top:"#D4D8DB",side:"#AEB4B9",end:"#969DA3"}); for(let t=L/6;t<L-.01;t+=L/6) seg([t,0,.22],[t,W,.22],INK2,HAIR*.7);
  const z=.22;
  if(skid){
    cabinet(.2,.3,z,1.5,2.2,2.3,2);                                           // RMU מתח גבוה
    transformer(2.2,.35,z,3.2,1.9,2.0);                                        // שנאי
    // מארז ממירי אגירה (PCS) חתוך: בלי הדופן הקרובה; בפנים ארונות ממיר כשחובר
    const px=6.0, pw=L-6.2, pd=W-.2, ph=2.6;
    poly([[px,.1,z],[px+pw,.1,z],[px+pw,.1+pd,z],[px,.1+pd,z]],TINT.floor,INK);
    poly([[px,.1,z],[px+pw,.1,z],[px+pw,.1,z+ph],[px,.1,z+ph]],METAL.inner,INK); ribs("y",.1,px,px+pw,z+.1,z+ph-.1,.28,"rgba(63,68,71,.2)");
    poly([[px,.1,z],[px,.1+pd,z],[px,.1+pd,z+ph],[px,.1,z+ph]],METAL.side,INK);
    if(wired>0){ ctx.globalAlpha=a0*Math.max(.4,wired); const n=4, cw=(pw-.8)/n;
      for(let i=0;i<n;i++){ if(i/n>wired+.01) break; const x=px+.4+i*cw; box3(x,.3,z,cw-.15,.9,2.2,{top:TINT.rack,side:TINT.rackS,end:TINT.rackE}); louvers(x+.08,x+cw-.23,1.2,z+.3,z+1.9,.09); dot(x+cw*.5,1.2,z+2.05,3*HAIR,3*HAIR,"#5BAE6B"); }
      cables([[3.8,2.25,z+.3],[3.8,W-.25,z+.3],[px+.5,W-.25,z+.3]],3,.08); cables([[1.0,2.5,z+.3],[1.0,W+.9,-.05]],3,.12);
      ctx.globalAlpha=a0; }
    poly([[px,.1,z+ph],[px+pw,.1,z+ph],[px+pw,.1+pd,z+ph],[px,.1+pd,z+ph]],METAL.top,INK); roofRibs(px,px+pw,.1,.1+pd,z+ph,.28);
    poly([[px+pw,.1,z],[px+pw,.1+pd,z],[px+pw,.1+pd,z+ph],[px+pw,.1,z+ph]],METAL.end,INK); ribs("x",px+pw,.1,.1+pd,z+.1,z+ph-.1,.3,"rgba(63,68,71,.18)");
    for(const x of [px,px+pw]) poly([[x-.07,.1+pd-.14,z],[x+.07,.1+pd-.14,z],[x+.07,.1+pd-.14,z+ph],[x-.07,.1+pd-.14,z+ph]],METAL.dark,INK);
    box3(px+1.2,.6,z+ph,1.3,1.1,.4,{top:METAL.side,side:METAL.end,end:METAL.dark});   // מיזוג
  } else {
    cabinet(.2,.3,z,1.9,2.2,2.3,3);                                           // RMU: 3 תאים
    transformer(2.6,.35,z,3.6,2.0,2.1);                                        // שנאי
    cabinet(6.8,.4,z,2.0,1.2,2.2,2);                                           // לוח LV / ICB
    cabinet(9.0,.6,z,.5,.9,1.6,1);                                             // לוח עזר
    if(wired>0){ ctx.globalAlpha=a0*Math.max(.4,wired);
      cables([[6.2,1.35,z+.25],[6.8,1.0,z+.25]],3,.1); cables([[2.6,1.4,z+.25],[2.1,1.4,z+.25]],3,.1); cables([[1.2,2.5,z+.3],[1.2,W+.9,-.05]],3,.12); cables([[7.8,1.6,z+.3],[7.8,W+.9,-.05]],2,.12);
      ctx.globalAlpha=a0; }
  }
  if(D){ ctx.globalAlpha=a0*dA;   // פירוט: שלטי אזהרה, לוח שם, פס הארקה, כניסות כבלים, תוויות ומידות
    dot(skid?1.0:1.2,2.5,z+1.9,.18*cam.s,.16*cam.s,TINT.brand,INK2); dot(skid?1.0:1.2,2.5,z+1.55,.45*cam.s,.14*cam.s,"#F7F8F8",INK2);   // משולש אזהרה + לוח שם על ה-RMU
    dot(skid?3.8:4.4,2.25,z+1.3,.18*cam.s,.16*cam.s,TINT.brand,INK2);   // שלט על השנאי
    box3(.3,W-.08,.22,L-.6,.05,.06,{top:"#D9C94A",side:"#5BAE6B",end:"#5BAE6B"});   // פס הארקה צהוב-ירוק לאורך המסגרת
    for(let t=1.0;t<L-.5;t+=1.6) dot(t,W,.11,.16*cam.s,.1*cam.s,"#3F4447");   // כניסות כבלים (אנטיגרונים) בבסיס
    late.push(()=>{ if(skid){ label("RMU מתח גבוה",[.95,1.4,z+2.3],[-.6,-1.0]); label("שנאי",[3.8,1.3,z+2.6],[-.2,-1.2]); label("מארז PCS: ארונות ממירים",[L-2.6,1.5,z+2.6],[.5,-1.2]); label("מיזוג",[L-4.4,1.1,z+3.0],[-.4,-.7]); }
      else { label("RMU מתח גבוה",[1.15,1.4,z+2.3],[-.6,-1.0]); label("שנאי",[4.4,1.35,z+2.65],[-.2,-1.2]); label("לוח מ״נ / ICB",[7.8,1.0,z+2.2],[.6,-1.1]); label("לוח עזר",[9.25,1.05,z+1.6],[.6,-.5]); }
      label("פס הארקה",[L*.5,W,.3],[.2,1.0]);
      dim([0,W+1.4,0],[L,W+1.4,0],L.toFixed(1)+" מ׳"); dim([L+.6,0,0],[L+.6,W,0],W.toFixed(1)+" מ׳"); }); }
  if(late.length){ ctx.globalAlpha=a0*dA; late.forEach(f=>f()); } ctx.restore(); return cam;
}

/* ---- חדר חשמל: מבנה 3 חדרים (מניה / מתח גבוה / LV+תקשורת) חתוך — בלי הקיר הקרוב, גג רק מעל החצי האחורי;
   סככה חיצונית עם גנרטור, שנאי בית ולוח AUX. אין לו שלבים בדיווח, לכן תמיד «כמתוכנן». ---- */
export function isoRoom(c,boxPx,st,opt){ ctx=c; opt=opt||{}; HAIR=opt.px||1; const D=(opt.detail||1)>=2, dA=opt.detailAlpha==null?1:opt.detailAlpha, late=[];   // late: תוויות ומידות מצוירות אחרונות, מעל הכל
  const L=12, W=5, H=3.2, sx=13, sw=4.5; cam=isoCamera(boxPx,sx+sw+1.6,W+1.6,H+1.2,opt.pad||.9); alpha=opt.alpha==null?1:opt.alpha; ctx.save(); ctx.globalAlpha=alpha;
  box3(-.8,-.8,-.15,sx+sw+1.6,W+1.6,.15,{top:TINT.conc,side:TINT.concL,end:TINT.concL});   // משטח בטון
  shadow(0,0,L,W,.5);
  poly([[0,0,0],[L,0,0],[L,W,0],[0,W,0]],"#EEEBE4",INK);   // רצפה עם אריחים
  for(let t=1;t<L;t+=1) seg([t,0,.001],[t,W,.001],"rgba(63,68,71,.08)",HAIR*.6); for(let t=1;t<W;t+=1) seg([0,t,.001],[L,t,.001],"rgba(63,68,71,.08)",HAIR*.6);
  poly([[0,0,0],[L,0,0],[L,0,H],[0,0,H]],TINT.wall,INK);      // קיר אחורי
  poly([[0,0,0],[0,W,0],[0,W,H],[0,0,H]],TINT.wallS,INK);     // קיר קצה רחוק
  box3(.3,.05,2.55,L-.6,.2,.08,STEEL);                         // תעלת רשת על הקיר האחורי
  // חדר מניה: ארון מונה + ארון תקשורת
  cabinet(.5,.1,0,1.0,.5,2.0,1); cabinet(1.8,.1,0,.8,.5,1.6,1);
  // חדר מתח גבוה: שורת תאי מסדר MV
  for(let i=0;i<4;i++) cabinet(3.9+i*.9,.1,0,.8,1.2,2.2,1,DARK); dot(4.3,1.3,2.0,3*HAIR,3*HAIR,"#5BAE6B");
  // חדר LV ותקשורת: לוח LV רחב, ארון תקשורת, UPS וסוללות
  cabinet(7.9,.1,0,3.2,.6,2.1,4); cabinet(11.2,.1,0,.6,.6,2.0,1,DARK); cabinet(8.0,2.9,0,.8,.8,1.4,1); box3(9.0,3.0,0,1.2,.6,.6,{top:TINT.rack,side:TINT.rackS,end:TINT.rackE});
  // מחיצות בין החדרים: מלאות בחלק האחורי, חתוכות נמוך בחזית כדי לראות את הציוד
  for(const x of [3.6,7.6]){ poly([[x,0,0],[x,1.6,0],[x,1.6,H],[x,0,H]],TINT.wallS,INK); poly([[x,1.6,0],[x,W,0],[x,W,1.0],[x,1.6,1.0]],TINT.wallS,INK); poly([[x-.06,1.6,1.0],[x+.06,1.6,1.0],[x+.06,W,1.0],[x-.06,W,1.0]],"#E9E6DF",INK); }
  // דלתות חוץ על הקיר שהוסר: משקוף וקשת פתיחה על הרצפה
  for(const dx of [1.8,5.6,9.8]){ ctx.strokeStyle=INK2; ctx.lineWidth=HAIR*.7; ctx.beginPath(); for(let a=0;a<=Math.PI/2+.01;a+=Math.PI/16){ const q=cam.p(dx-.45+.9*Math.cos(a),W-.9*Math.sin(a),.002); a?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); } ctx.stroke(); seg([dx-.45,W,0],[dx-.45,W,2.1],INK,HAIR); seg([dx+.45,W,0],[dx+.45,W,2.1],INK,HAIR); seg([dx-.45,W,2.1],[dx+.45,W,2.1],INK,HAIR); }
  // הגג הוסר (חתך); נשארת קורת הגג על הקיר האחורי
  box3(-.15,-.15,H,L+.3,.3,.18,{top:METAL.top,side:METAL.end,end:METAL.dark});
  // קיר קצה קרוב (x=L) עם דלת חוץ
  poly([[L,0,0],[L,W,0],[L,W,H],[L,0,H]],TINT.wallE,INK); poly([[L,W*.5-.45,0],[L,W*.5+.45,0],[L,W*.5+.45,2.1],[L,W*.5-.45,2.1]],"#CFCBC2",INK); dot(L,W*.5+.3,1.05,2.5*HAIR,2.5*HAIR,INK);
  // סככה: 4 עמודים, מתחתיה גנרטור, שנאי בית ולוח AUX; גג פח
  for(const [px,py] of [[sx,.2],[sx+sw,.2],[sx,W-.2],[sx+sw,W-.2]]) box3(px-.08,py-.08,0,.16,.16,2.8,STEEL);
  box3(sx+.3,.4,0,1.8,2.9,1.0,{top:"#CBD0D4",side:"#B3B9BE",end:"#9DA4AA"}); box3(sx+.3,.4,1.0,1.8,2.9,.55,GREY); cyl(sx+1.7,.9,1.55,.07,.6,{top:"#8A9196",side:"#6F777E"});   // גנרטור + ארובה
  transformer(sx+2.6,.5,0,1.5,1.3,1.4); cabinet(sx+2.6,3.2,0,1.6,.6,2.0,2);
  cables([[L,2.5,.3],[sx+2.6,3.5,.3]],3,.12);
  if(D){ ctx.globalAlpha=alpha*dA;   // פירוט גבוה: ציוד על הדלתות, תעלת רצפה, מזגנים, אוורור, מטפים, שמות החדרים ומידות
    for(let i=0;i<4;i++){ const fx=3.9+i*.9; seg([fx+.25,1.3,1.2],[fx+.25,1.3,1.9],INK2,HAIR*.8); seg([fx+.15,1.3,1.55],[fx+.35,1.3,1.55],INK2,HAIR*.8); dot(fx+.55,1.3,1.75,2.4*HAIR,2.4*HAIR,i%3?"#5BAE6B":"#D64541"); dot(fx+.4,1.3,.9,.3*cam.s,.08*cam.s,"#F7F8F8",INK2); }   // תאי מ״ג: סכמה חד-קווית, מנורת מצב, שלט
    for(let r=0;r<3;r++) for(let k=0;k<12;k++) dot(8.15+k*.25,.7,1.75-r*.35,.1*cam.s,.14*cam.s,r?"#3F4447":"#2A2E30");   // לוח מ״נ: שורות מפסקים
    for(let k=0;k<3;k++) dot(8.4+k*1.0,.7,.55,.5*cam.s,.08*cam.s,"#F7F8F8",INK2);   // שלטי שדות
    dot(.8,.6,1.55,.3*cam.s,.22*cam.s,"#EAF0F3",INK2); dot(1.2,.6,1.55,.3*cam.s,.22*cam.s,"#EAF0F3",INK2);   // חלונות מונים
    for(const fx of [1.0,2.2,4.3,5.2,6.1,7.0,9.5,11.5]) box3(fx-.1,.05,2.0,.2,.2,.55,STEEL);   // ירידות מתעלת הרשת לארונות
    poly([[0,.95,.002],[L,.95,.002],[L,1.35,.002],[0,1.35,.002]],"#DAD6CC",INK2); for(let t=.5;t<L;t+=.5) seg([t,.95,.003],[t,1.35,.003],INK3,HAIR*.6);   // תעלת רצפה עם מכסים
    for(const fx of [2.0,6.0,10.0]){ box3(fx,.05,2.3,.9,.25,.3,{top:"#F7F8F8",side:"#EEF0F1",end:"#DDE0E2"}); louvers(fx+.08,fx+.82,.3,2.36,2.56,.05); }   // מזגנים על הקיר האחורי
    for(let z=2.3;z<2.8;z+=.1) seg([0,1.5,z],[0,3.5,z],INK3,HAIR*.7); poly([[0,1.5,2.3],[0,3.5,2.3],[0,3.5,2.8],[0,1.5,2.8]],null,INK2);   // רפפת אוורור בקיר הקצה
    for(const fx of [3.2,7.2,11.4]) cyl(fx,W-.4,0,.09,.55,{top:"#C8352E",side:"#B32C26"});   // מטפים ליד הדלתות
    box3(sx+.3,.4,1.55,1.8,.5,.25,{top:"#B3B9BE",side:"#9DA4AA",end:"#8A9196"}); louvers(sx+.4,sx+2.0,.9,1.6,1.78,.05);   // מאוורר קירור של הגנרטור
    late.push(()=>{ label("חדר מניה",[1.0,W,0],[.1,.9]); label("חדר מתח גבוה",[5.0,W,0],[.1,.9]); label("חדר מתח נמוך ותקשורת",[9.0,W,0],[.1,.9]); label("סככה: גנרטור, שנאי עזר, לוח AUX",[sx+sw-.3,W,0],[-.1,1.3]);
      dim([0,-.6,H],[L,-.6,H],"12 מ׳"); dim([-.6,0,0],[-.6,W,0],"5 מ׳"); dim([-.5,0,0],[-.5,0,H],"3.2 מ׳"); }); ctx.globalAlpha=alpha; }
  box3(sx-.3,-.3,2.8,sw+.6,W+.6,.1,{top:"#F2F4F5",side:METAL.end,end:METAL.dark}); roofRibs(sx-.3,sx+sw+.3,-.3,W+.3,2.9,.3);
  if(late.length){ ctx.globalAlpha=alpha*dA; late.forEach(f=>f()); ctx.globalAlpha=alpha; }
  ctx.restore(); return cam;
}

/* ---- שורת פאנלים: שולחנות 3×9 (3 מודולים לגובה, 9 לרוחב) על עמודים, נטויים 15° דרומה (אל הצופה);
   עמדת ממיר + לוח מנתק על עמודי השולחן האמצעי, כבלי סטרינג מאחור ויורדים לתעלה.
   st={piles,panels,strings} ביחידות 0..1 (ממלאים משמאל לימין) ---- */
export function isoPvRow(c,boxPx,st,opt){ ctx=c; opt=opt||{}; st=st||{}; HAIR=opt.px||1; const D=(opt.detail||1)>=2, dA=opt.detailAlpha==null?1:opt.detailAlpha;
  const tables=opt.tables||4, cols=9, mw=1.14, ml=2.38, tilt=15*Math.PI/180, gap=.5, TL=cols*mw, span=tables*TL+(tables-1)*gap, DD=3*ml*Math.cos(tilt), zb=2.75, zf=zb-3*ml*Math.sin(tilt);
  cam=isoCamera(boxPx,span+2,DD+3.2,zb+1,opt.pad||.92); alpha=opt.alpha==null?1:opt.alpha; ctx.save(); ctx.globalAlpha=alpha;
  const piles=st.piles==null?1:st.piles, panels=st.panels==null?1:st.panels, strings=st.strings==null?1:st.strings, zAt=y=>zb-(y/DD)*(zb-zf);
  poly([[-1,-.8,0],[span+1,-.8,0],[span+1,DD+2.2,0],[-1,DD+2.2,0]],TINT.ground,null);   // קרקע
  for(let t=0;t<tables;t++){ const x0=t*(TL+gap), f0=t/tables, pp=clamp((piles-f0)*tables);
    if(pp<=0){ outline(x0,0,TL,DD); continue; }
    ctx.globalAlpha=alpha*Math.max(.45,pp);
    // כלונסאות: שתי שורות (אחורית וקדמית), לפי שיעור הכלונסאות
    const nPost=4; for(let i=0;i<nPost;i++){ if(i/nPost>pp+.01) break; const px=x0+.6+i*(TL-1.2)/(nPost-1); for(const py of [1.0,DD-1.0]) box3(px-.07,py-.07,0,.14,.14,zAt(py)-.25,STEEL); }
    if(pp>=.99) for(const py of [1.0,DD-1.0]) box3(x0+.2,py-.05,zAt(py)-.25,TL-.4,.1,.1,STEEL);   // קורות אורך
    // מודולים: 3 שורות × 9 עמודות במישור הנטוי
    const pn=clamp((panels-f0)*tables);
    if(pn>0){ ctx.globalAlpha=alpha*Math.max(.45,pn);
      for(let j=0;j<cols;j++){ if(j/cols>pn+.005) break; for(let m=0;m<3;m++){ const y0=m*ml*Math.cos(tilt), y1=y0+ml*Math.cos(tilt)-.03, xa=x0+j*mw+.03, xb=xa+mw-.06;
        poly([[xa,y0,zAt(y0)],[xb,y0,zAt(y0)],[xb,y1,zAt(y1)],[xa,y1,zAt(y1)]],TINT.pv,INK,HAIR*.6);
        for(let k=1;k<4;k++){ const yy=y0+(y1-y0)*k/4; seg([xa,yy,zAt(yy)],[xb,yy,zAt(yy)],TINT.pvGrid,HAIR*.5); } seg([(xa+xb)/2,y0,zAt(y0)],[(xa+xb)/2,y1,zAt(y1)],TINT.pvGrid,HAIR*.5); } }
      poly([[x0,0,zAt(0)+.005],[x0+TL*pn,0,zAt(0)+.005],[x0+TL*pn,DD*.35,zAt(DD*.35)+.005],[x0,DD*.35,zAt(DD*.35)+.005]],"rgba(255,255,255,.12)",null); }   // ברק על הזכוכית
    // כבלי סטרינג מתחת לשולחן לאורך הקורה האחורית
    const ps=clamp((strings-f0)*tables); if(ps>0){ ctx.globalAlpha=alpha*Math.max(.5,ps); cables([[x0,1.0,zAt(1.0)-.45],[x0+TL*ps,1.0,zAt(1.0)-.45]],2,.08,1.4); }
  }
  // עמדות ממיר/מנתק: במקום שבו הן בתוכנית (opt.invAt = שברים 0..1 לאורך השורה; ברירת מחדל באמצע), תלויות על עמודי השולחן, כבלים יורדים לתעלה.
  // עמדה מצוירת רק כשהשרשורים הגיעו לשולחן שלה. תווית אחת על הראשונה.
  const invAt=(Array.isArray(opt.invAt)&&opt.invAt.length?opt.invAt:[.5]).map(clamp); let labeled=false;
  invAt.forEach(fr=>{ const t=Math.min(tables-1,Math.floor(fr*tables)); if(strings<=t/tables+.001) return; ctx.globalAlpha=alpha*Math.max(.5,strings);
    const x0=t*(TL+gap), ix=x0+Math.max(1.2,Math.min(TL-1.2,(fr*tables-t)*TL));
    box3(ix-.9,DD-1.35,1.0,.75,.3,.6,CAB); louvers(ix-.85,ix-.2,DD-1.05,1.1,1.5,.07);   // ממיר
    cabinet(ix+.1,DD-1.3,.9,.5,.25,.7,1);                                            // לוח מנתק
    cables([[ix-.5,DD-1.0,1.0],[ix-.5,DD-1.0,0],[ix-.5,DD+1.4,-.05]],2,.1); cables([[ix+.35,DD-1.0,.9],[ix+.35,DD-1.0,0],[ix+.35,DD+1.4,-.05]],1,.1,2.2);
    if(D&&!labeled){ labeled=true; ctx.globalAlpha=alpha*dA; label("עמדת ממיר / מנתק",[ix-.2,DD-1.0,.9],[ix>span*.5?-1.0:1.0,1.8]); ctx.globalAlpha=alpha; } });
  ctx.restore(); return cam;
}

/* ---- תעלה: גוש קרקע חתוך לאורך; חפירה פתוחה עם ערימת עפר בצד, חול ריפוד, כבל, כיסוי עם סרט סימון.
   st={dig,cable,cover} ביחידות 0..1 (מתקדמים לאורך x) ---- */
export function isoTrench(c,boxPx,st,opt){ ctx=c; opt=opt||{}; st=st||{}; HAIR=opt.px||1; const D=(opt.detail||1)>=2, X3=(opt.detail||1)>=3, dA=opt.detailAlpha==null?1:opt.detailAlpha, late=[];   // D = שמות בלבד (ברירת המחדל); X3 = גם שרוולים, עמוד סימון, כבלים לפי סוג ומידות
  const L=14, W=4.2, dep=1.0, tw=.9, ty=1.7; cam=isoCamera(boxPx,L+1,W+1,dep+1.6,opt.pad||.92); alpha=opt.alpha==null?1:opt.alpha; ctx.save(); ctx.globalAlpha=alpha;
  const dig=clamp(st.dig==null?1:st.dig), cab=clamp(st.cable==null?1:st.cable), cov=clamp(st.cover==null?1:st.cover), xd=L*dig, xc=Math.min(L*cab,xd), xv=Math.min(L*cov,xd);
  // גוש הקרקע: פאת קצה, פאה קדמית (חתך), פני השטח
  poly([[L,0,-dep],[L,W,-dep],[L,W,0],[L,0,0]],TINT.soilE,INK);
  poly([[0,W,-dep],[L,W,-dep],[L,W,0],[0,W,0]],TINT.soilS,INK);
  poly([[0,0,0],[L,0,0],[L,W,0],[0,W,0]],TINT.ground,INK);
  // שכבות בחתך הקדמי (כמו גיליון החתכים): קו פני השטח, חול בתחתית, נקודות אבן
  seg([0,W,-.25],[L,W,-.25],"rgba(63,68,71,.25)",HAIR*.6); for(let i=0;i<40;i++) dot(((i*37)%97)/97*L,W,-.3-((i*53)%89)/89*(dep-.4),1.6*HAIR,1.2*HAIR,"#B59A74");
  if(dig<1){ ctx.setLineDash([6*HAIR,5*HAIR]); seg([xd,ty+tw/2,.002],[L,ty+tw/2,.002],INK2,HAIR); ctx.setLineDash([]); }   // מתוכנן
  if(dig>0){
    poly([[0,ty,-dep],[xd,ty,-dep],[xd,ty+tw,-dep],[0,ty+tw,-dep]],TINT.sand,INK);          // ריפוד חול בתחתית
    poly([[0,ty,-dep],[xd,ty,-dep],[xd,ty,0],[0,ty,0]],"#D9C19B",INK);                       // דופן אחורית
    poly([[xd,ty,-dep],[xd,ty+tw,-dep],[xd,ty+tw,0],[xd,ty,0]],"#C9AE85",INK);               // קצה החפירה
    if(cab>0&&!X3){ path([[0,ty+tw*.42,-dep+.05],[xc,ty+tw*.42,-dep+.05]],"#2A2E30",HAIR*2.4); path([[0,ty+tw*.62,-dep+.05],[xc,ty+tw*.62,-dep+.05]],TINT.cableO,HAIR*1.6); }   // כבלים על החול
    if(cab>0&&X3){ // פירוט גבוה: שלושה כבלי מ״ג בתלתן, שני כבלי DC/מ״נ כתומים, כבל תקשורת דק; שרוולים במעבר
      for(const [yy,zz] of [[.3,.05],[.4,.05],[.35,.13]]) path([[0,ty+tw*yy,-dep+zz],[xc,ty+tw*yy,-dep+zz]],"#2A2E30",HAIR*2.2);
      path([[0,ty+tw*.62,-dep+.05],[xc,ty+tw*.62,-dep+.05]],TINT.cableO,HAIR*1.6); path([[0,ty+tw*.72,-dep+.05],[xc,ty+tw*.72,-dep+.05]],TINT.cableO,HAIR*1.6); path([[0,ty+tw*.84,-dep+.04],[xc,ty+tw*.84,-dep+.04]],"#8E959B",HAIR*1.0);
      const s0=Math.min(xd,L*.52), s1=Math.min(xd,s0+2.2); if(s1>s0+.3){ for(const yy of [.3,.62]){ path([[s0,ty+tw*yy,-dep+.12],[s1,ty+tw*yy,-dep+.12]],"#C4C9CD",HAIR*5.5); path([[s0,ty+tw*yy,-dep+.12],[s1,ty+tw*yy,-dep+.12]],INK2,HAIR*.6); for(let t=s0+.12;t<s1;t+=.16) seg([t,ty+tw*yy-.06,-dep+.12],[t,ty+tw*yy+.06,-dep+.12],INK2,HAIR*.6); } } }
    if(cov>0){ // מילוי חזרה: דופן קרובה סגורה, פני שטח, ובקצה המכוסה חתך השכבות כמו בגיליון החתכים (חול → כבל → חול → סרט סימון → מילוי)
      poly([[0,ty+tw,-dep],[xv,ty+tw,-dep],[xv,ty+tw,0],[0,ty+tw,0]],"rgba(185,154,108,.62)",INK);   // דופן קרובה «רנטגן»: הכבלים והשכבות נראים דרך המילוי
      seg([0,ty+tw,-dep*.55],[xv,ty+tw,-dep*.55],"rgba(63,68,71,.22)",HAIR*.7); seg([0,ty+tw,-dep*.5],[xv,ty+tw,-dep*.5],"rgba(200,50,43,.45)",HAIR*1.1);   // גבול החול וסרט הסימון לאורך הקטע המכוסה
      poly([[0,ty,-.001],[xv,ty,-.001],[xv,ty+tw,-.001],[0,ty+tw,-.001]],"#E3D5BA",INK); for(let t=.6;t<xv;t+=.9) dot(t,ty+tw*.5,.002,2*HAIR,1.2*HAIR,"#C9B48E");
      const X=xv; poly([[X,ty,-dep],[X,ty+tw,-dep],[X,ty+tw,-dep*.55],[X,ty,-dep*.55]],TINT.sand,INK2);                 // ריפוד חול
      poly([[X,ty,-dep*.55],[X,ty+tw,-dep*.55],[X,ty+tw,0],[X,ty,0]],"#E3D5BA",INK2);                                   // מילוי
      seg([X,ty+.05,-dep*.5],[X,ty+tw-.05,-dep*.5],"#C8322B",HAIR*1.3);                                                  // סרט סימון
      for(const yy of [ty+tw*.42,ty+tw*.62]){ const q=cam.p(X,yy,-dep+.12); ctx.fillStyle=yy<ty+tw*.5?"#2A2E30":TINT.cableO; ctx.beginPath(); ctx.arc(q[0],q[1],Math.max(1.5*HAIR,.07*cam.s),0,Math.PI*2); ctx.fill(); }   // חתכי הכבלים
      poly([[X,ty,-dep],[X,ty+tw,-dep],[X,ty+tw,0],[X,ty,0]],null,INK);
      if(X3){ box3(.5,ty+tw+.35,0,.14,.14,.6,{top:"#F2B03D",side:"#E8E4DA",end:"#D6D1C4"}); dot(.57,ty+tw+.49,.5,.14*cam.s,.1*cam.s,"#F2B03D",INK2); }   // עמוד סימון תוואי
      if(D){ late.push(()=>{ label("סרט סימון",[X,ty+tw*.5,-dep*.5],[1.2,-.9]); label("ריפוד חול",[X,ty+tw*.5,-dep*.85],[1.4,.3]); label("מילוי מהודק",[X,ty+tw*.5,-dep*.2],[1.0,-1.6]); }); } }
    if(D) late.push(()=>{ if(xd>xv+1){ const lx=xv+Math.min(1.2,(xd-xv)*.4); label(X3?"כבלי מתח גבוה":"כבלים על ריפוד החול",[lx,ty+tw*.35,-dep+.1],[-1.4,-.5]); if(X3) label("כבלי DC / מ״נ",[lx+.6,ty+tw*.67,-dep+.06],[.6,1.1]); if(X3&&xc>L*.52+.6) label("שרוולים במעבר דרך",[Math.min(xd,L*.52+1.1),ty+tw*.3,-dep+.12],[.3,-1.3]); }
      if(X3&&xd>xv+1){ dim([xd+.4,ty,-dep],[xd+.4,ty,0],"עומק "+dep.toFixed(1)+" מ׳"); dim([xd+.4,ty,-dep],[xd+.4,ty+tw,-dep],"רוחב "+tw.toFixed(1)+" מ׳"); } });   // מידות רק כשיש קטע פתוח, אחרת הן מתנגשות בתוויות החתך
    if(xd>xv){ poly([[xv,ty+tw,-dep],[xd,ty+tw,-dep],[xd,ty+tw,0],[xv,ty+tw,0]],"rgba(185,154,108,.35)",INK2);   // דופן קרובה שקופה למחצה: רואים את העומק
      const my=ty+tw+.8; let i=0; for(let x=xv+.6;x<xd-.4;x+=.95,i++){ const q=cam.p(x,my+(i%2?.15:-.1),0), r=(.38+(i%3)*.06)*cam.s; ctx.fillStyle=i%2?"#D9C4A0":"#D0B890"; ctx.strokeStyle=INK2; ctx.lineWidth=HAIR*.7; ctx.beginPath(); ctx.ellipse(q[0],q[1]-.1*cam.s,r,r*.5,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); } }   // ערימת עפר
  }
  if(late.length){ ctx.globalAlpha=alpha*dA; late.forEach(f=>f()); } ctx.restore(); return cam;
}

// איזה סוגי אלמנט יש להם איור איזומטרי
export const ISO_KINDS=["bess","mvs","skid","room","pv","trench"];
// רמת פירוט ברירת מחדל לכל סוג באפליקציה: 2 = עם תוויות, מידות ופרטים קטנים; 1 = האיור הנקי
export const ISO_DETAIL={bess:2,mvs:2,skid:2,room:2,pv:2,trench:2};   // ישי (2026-10-30): הכל מפורט חוץ מתעלות (שמות בלבד) ופאנלים (רק שם לעמדות ממיר/מנתק). מגרסה 19 הפירוט = רמת זום 2
/* הדיספאצ'ר: מצייר את האלמנט el (מהפריסה) לפי מצב השלבים F שלו (שברים 0..1) במסגרת box. מחזיר false אם אין איור לסוג הזה.
   opt.rowF: לשדה — השברים של השורה שנבחרה (במקום של השדה כולו) */
export function isoScene(c,box,el,F,alpha,px,opt){
  if(!el||!ISO_KINDS.includes(el.kind)) return false; F=F||{}; opt=opt||{}; if(opt.detail==null) opt={...opt,detail:ISO_DETAIL[el.kind]||1}; if(opt.detailAlpha!=null&&opt.detailAlpha<=0) opt={...opt,detail:1};   // detailAlpha 0 = רמה 1, בלי פירוט
  if(el.kind==="bess"){ const n=Math.max(1,el.units||1), m=Math.min(n,4), units=[]; for(let i=0;i<m;i++) units.push({placed:clamp((F.bess||0)*m-i),wired:clamp((F.wire||0)*m-i)});   // עד 4 מכולות מייצגות: כל אחת = רבע מהכמות
    isoBess(c,box,{base:F.base||0,conc:F.conc||0,units},{alpha,px,detail:opt.detail}); return true; }
  if(el.kind==="mvs"||el.kind==="skid"){ isoSkid(c,box,{base:F.base||0,conc:F.conc||0,placed:F.skid||0,wired:F.wire||0},{alpha,px,variant:el.kind,detail:opt.detail}); return true; }
  if(el.kind==="room"){ isoRoom(c,box,{},{alpha,px,detail:opt.detail}); return true; }
  if(el.kind==="pv"){ const R=opt.rowF||F; isoPvRow(c,box,{piles:R.piles||0,panels:R.panels||0,strings:R.strings||0},{alpha,px,invAt:opt.invAt||el.invAt,tables:opt.tables||el.tables}); return true; }
  if(el.kind==="trench"){ isoTrench(c,box,{dig:F.dig||0,cable:F.cable||0,cover:F.cover||0},{alpha,px,detail:opt.detail}); return true; }
  return false;
}

// אין מה לאתחל: המודול מצייר רק כשקוראים לו מ-24-site-stages
export function __init(){}
