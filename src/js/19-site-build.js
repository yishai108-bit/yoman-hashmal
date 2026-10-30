/* ================= האתר נבנה: שרטוט קווים של השולחנות לאורך זמן, מהסטטוס של המופע =================
   אותו רכיב שנבנה לוויזואליזציה של עין תמר (28.10), בתוך הדאשבורד של כל אתר.
   הכמויות: סטטוס ההתקדמות (קידוחים, יציקות, קונסטרוקציה, פאנלים), מצטבר לפי תאריך. המיקום: מפת השולחנות ב-site-maps.js.
   הציור שומר על סדר הביצוע (ישי, 29.10): קידוח, אחר כך עמוד יצוק, אחר כך קונסטרוקציה, אחר כך פאנלים;
   שולחן לא מצויר לפני שכל העמודים שלו יצוקים. הכרטיסים מציגים את המספרים האמיתיים; רק הציור מיושר לסדר.
   היום משמאל, גרירה ימינה חוזרת להתחלה. אתר בלי מפה מקבל את המספרים בלבד ומצב «אין עדיין מפה». */
import { $, esc, shared } from "./core.js";
import { fmtN } from "./01-stock.js";
import { SITE } from "./08-settings.js";
import { isoOf, isoText } from "./11-daylog.js";
import { foldSum } from "./12-ui-cleanup.js";
import { SITE_MAPS } from "./site-maps.js";

const DAY=864e5, SPLIT=.2;
const STAGES=[["drill",/קידוח/,"קידוחים","#9A9EA1","עמודים"],["cast",/יציק/,"יציקות","#3F4447","עמודים"],["tables",/קונסטרוקצ|שולחנ/,"שולחנות","#FFAA00","שולחנות"],["panels",/פאנל/,"פאנלים מותקנים","#3199CC","פאנלים"]];
const MONTHS=["ינו׳","פבר׳","מרץ","אפר׳","מאי","יוני","יולי","אוג׳","ספט׳","אוק׳","נוב׳","דצמ׳"];
const dt=iso=>{ const [y,m,d]=String(iso).split("-").map(Number); return Date.UTC(y,m-1,d); };
const ddmm=t=>{ const d=new Date(t); return d.getUTCDate()+"."+(d.getUTCMonth()+1); };
const fmt=n=>fmtN(Math.round(n));

// המפה של האתר הנוכחי: לפי חלק משם האתר. null = אין מפה.
export function siteMap(name){ const n=String(name||(SITE&&SITE.name)||""); for(const k in SITE_MAPS) if(n.includes(k)) return SITE_MAPS[k]; return null; }

// סדרות מצטברות מתוך פעילויות הסטטוס: {drill:{total,pts:[[iso,cum]...],last}, ...}. רק מה שקיים.
export function siteBuildSeries(acts){
  const out={};
  for(const [k,re] of STAGES){
    const a=(acts||[]).find(x=>re.test(x.name||"")&&!/כלונס|TML/i.test(x.name||"")); if(!a) continue;
    const daily=(a.daily||[]).filter(d=>Number(d.actual)&&d.date).slice().sort((x,y)=>x.date<y.date?-1:1);
    let c=0; out[k]={total:Number(a.total)||0,pts:daily.map(d=>{ c+=Number(d.actual); return [d.date,c]; }),last:daily.length?daily[daily.length-1].date:""};
  }
  return out;
}

// המודל: ציר זמן, ערכים לפי תאריך, חלוקת הכמויות לשולחנות בסדר הביצוע (שרשרת קשיחה)
function model(map,ser,todayIso){
  const T=(map?map.tables:[]).map(([x,y,w,h,ty])=>({x,y,w,h,ty,pan:(map.types||{})[ty]||81}));
  const sumPan=T.reduce((a,b)=>a+b.pan,0);
  const TOT={}; TOT.tables=(ser.tables&&ser.tables.total)||T.length||0; TOT.panels=(ser.panels&&ser.panels.total)||sumPan||0;
  TOT.drill=(ser.drill&&ser.drill.total)||(ser.cast&&ser.cast.total)||TOT.tables*18; TOT.cast=(ser.cast&&ser.cast.total)||TOT.drill;
  T.forEach(b=>{ b.piles=sumPan?b.pan*TOT.drill/sumPan:0; });
  const firsts=Object.values(ser).map(s=>s.pts[0]&&dt(s.pts[0][0])).filter(Boolean);
  const dEnd=dt(todayIso)+DAY, first=firsts.length?Math.min(...firsts):dEnd-30*DAY;
  let d0=map&&map.start?dt(map.start):first-7*DAY; if(d0>=first) d0=first-7*DAY;
  const dMid=(first-d0>45*DAY)?Date.UTC(new Date(first).getUTCFullYear(),new Date(first).getUTCMonth(),1):d0;
  const split=dMid>d0?SPLIT:0;
  const t2u=t=>split&&t<=dMid?(t-d0)/(dMid-d0)*split:split+(t-dMid)/(dEnd-dMid)*(1-split);
  const u2t=u=>split&&u<=split?d0+u/split*(dMid-d0):dMid+(u-split)/(1-split)*(dEnd-dMid);
  // המצטבר אחרי יום d מגיע בסוף היום: נקודה ב-d+1; לפני הרישום הראשון 0; אחרי האחרון נשאר קבוע עד היום
  const PTS={}; for(const k in ser){ const p=ser[k].pts; if(!p.length) continue; PTS[k]=[[dt(p[0][0]),0],...p.map(([s,c])=>[Math.min(dEnd,dt(s)+DAY),c])]; }
  const val=(k,t)=>{ const p=PTS[k]; if(!p||t<=p[0][0]) return 0; for(let i=1;i<p.length;i++){ if(t<=p[i][0]){ const a=p[i-1],b=p[i]; return a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]); } } return p[p.length-1][1]; };
  const lastRec=(k,t)=>{ let s=""; for(const [d] of (ser[k]?ser[k].pts:[])){ if(dt(d)<=t) s=d; } return s; };
  const alloc=(units,key)=>{ const f=new Float32Array(T.length); let left=units; for(let i=0;i<T.length&&left>0;i++){ const need=key(T[i]); if(!need) continue; const g=Math.min(need,left); f[i]=g/need; left-=g; } return f; };
  const state=u=>{
    const t=u2t(u); const v={drill:val("drill",t),cast:val("cast",t),tables:val("tables",t),panels:val("panels",t)};
    const panF=alloc(v.panels,x=>x.pan); const panTables=panF.reduce((a,b)=>a+b,0);
    const strF=alloc(Math.max(v.tables,panTables),()=>1); const strPiles=strF.reduce((a,f,i)=>a+f*T[i].piles,0);
    const castF=alloc(Math.max(v.cast,strPiles),x=>x.piles); const castPiles=castF.reduce((a,f,i)=>a+f*T[i].piles,0);
    const drillF=alloc(Math.max(v.drill,castPiles),x=>x.piles);
    return {t,v,panF,strF,castF,drillF,today:u>0.999};
  };
  // אבני דרך מהנתונים: ראשון בכל שלב, ורבעי הפאנלים
  const ms=[]; const firstOf={drill:"קידוח ראשון בשדה",cast:"יציקה ראשונה",tables:"השולחנות הראשונים",panels:"הפאנלים הראשונים מותקנים"};
  for(const k in firstOf){ const p=ser[k]&&ser[k].pts[0]; if(p) ms.push([dt(p[0]),firstOf[k]]); }
  if(ser.panels&&TOT.panels){ const seen=new Set(); for(const q of [.25,.5,.75,1]){ const p=ser.panels.pts.find(x=>x[1]>=TOT.panels*q); if(p&&!seen.has(p[0])){ seen.add(p[0]); ms.push([dt(p[0]),Math.round(p[1]/TOT.panels*100)+"% מהפאנלים: "+fmt(p[1])]); } } }
  if(ser.tables&&TOT.tables){ const p=ser.tables.pts.find(x=>x[1]>=TOT.tables); if(p) ms.push([dt(p[0]),"כל השולחנות הורכבו"]); }
  ms.sort((a,b)=>b[0]-a[0]);
  return {T,TOT,d0,dMid,dEnd,t2u,u2t,val,lastRec,state,ms,hasMap:!!map&&T.length>0,map};
}

let M=null, u=1, vel=0, target=1, dragging=false, raf=0, playing=null, built=false, lastDay=-1, hist=[];
let cv, ctx, roadImg=null, roadTint=null, scale=1, px=1, SE=[];
const K=.6, TOP=26, LIFT=7, FRONT=2.5;
const reduce=()=>typeof matchMedia==="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp=x=>Math.max(0,Math.min(1,x));
export function siteBuildState(uu){ return M?M.state(uu==null?u:uu):null; }

function buildDom(){
  const box=$("#sbBody"); if(!box||built) return; built=true;
  box.innerHTML='<div class="sb-lead"><span class="sb-big num" id="sbBig">0%</span><span class="sb-cap">מהפאנלים מותקנים</span></div><div class="sb-sub" id="sbSub"></div>'
    +'<div class="sb-ph"><span class="sb-date num" id="sbDate"></span><span class="sb-today" id="sbToday">היום</span></div>'
    +'<div class="sb-cvw" id="sbCvw"><canvas id="sbCv" aria-label="שרטוט האתר: השולחנות לפי מפת הקונסטרוקציה"></canvas></div>'
    +'<div class="sb-keys"><span><i style="border-top:1px dashed #B9BBBC;height:0;border-radius:0"></i>מתוכנן</span><span><i style="width:7px;height:7px;border:1px solid #9A9EA1;background:#fff"></i>נקדח</span><span><i style="width:6px;height:6px;background:#3F4447"></i>עמוד יצוק</span><span><i style="border:1px solid #3F4447;background:#fff;transform:skewX(-30deg)"></i>קונסטרוקציה</span><span><i style="border:1px solid #1E7FB0;background:#D3E9F5;transform:skewX(-30deg)"></i>פאנלים</span><span><i style="border:1.5px solid #E40033;background:#fff"></i>עובדים כאן</span></div>'
    +'<div class="sb-rail" id="sbRail" tabindex="0" role="slider" aria-label="ציר זמן"><div class="track"></div><div class="fill" id="sbFill"></div><div id="sbTicks"></div><div class="knob" id="sbKnob"></div></div>'
    +'<div class="sb-ctrl"><span class="hint">היום משמאל. גררו ימינה כדי לחזור להתחלה.</span><div class="sb-btns"><button class="sb-go" id="sbPlay" type="button">הפעלה מההתחלה</button><button class="ghost" id="sbBack" type="button" aria-label="שבוע אחורה">אחורה</button><button class="ghost" id="sbFwd" type="button" aria-label="שבוע קדימה">קדימה</button></div></div>'
    +'<div class="sb-stats" id="sbStats"></div><div class="sb-nomap" id="sbNoMap" hidden></div><ul class="sb-ms" id="sbMs"></ul><div class="note" id="sbNote" style="margin:8px 0 0"></div>';
  cv=$("#sbCv"); ctx=cv.getContext("2d"); roadTint=document.createElement("canvas");
  SE=STAGES.map(([k,re,l,c,unit])=>{ const el=document.createElement("div"); el.className="sb-stat";
    el.innerHTML='<span class="k"><i style="background:'+c+'"></i>'+l+'</span><span class="v num">0</span><span class="of">מתוך <span class="num"></span> '+unit+'</span><div class="bar"><span style="background:'+c+'"></span></div><span class="asof"></span>';
    $("#sbStats").appendChild(el); return {k,el,v:el.querySelector(".v"),of:el.querySelector(".of .num"),b:el.querySelector(".bar span"),a:el.querySelector(".asof")}; });
  // גרירה על הציר ועל השרטוט, עם אינרציה; מקלדת; כפתורים
  const rail=$("#sbRail"); const railU=x=>{ const r=rail.getBoundingClientRect(); return (r.right-x)/r.width; };
  rail.addEventListener("pointerdown",e=>{ e.preventDefault(); rail.focus({preventScroll:true}); stopPlay(); dragging=true; hist=[]; rail.setPointerCapture(e.pointerId); track(railU(e.clientX)); kick(); });
  rail.addEventListener("pointermove",e=>{ if(dragging&&rail.hasPointerCapture(e.pointerId)) track(railU(e.clientX)); });
  rail.addEventListener("pointerup",endDrag); rail.addEventListener("pointercancel",endDrag);
  rail.addEventListener("keydown",e=>{ if(!M) return; const t=M.u2t(target);
    if(e.key==="ArrowLeft"){ goT(t+7*DAY); e.preventDefault(); } else if(e.key==="ArrowRight"){ goT(t-7*DAY); e.preventDefault(); }
    else if(e.key==="Home"){ goT(M.dEnd); e.preventDefault(); } else if(e.key==="End"){ goT(M.d0); e.preventDefault(); } });
  const cvw=$("#sbCvw"); let sx=0,sy=0,su=0,cd=false;
  cvw.addEventListener("pointerdown",e=>{ sx=e.clientX; sy=e.clientY; su=u; cd=false; cvw.setPointerCapture(e.pointerId); });
  cvw.addEventListener("pointermove",e=>{ if(!cvw.hasPointerCapture(e.pointerId)) return; const dx=e.clientX-sx;
    if(!cd){ if(Math.abs(dx)<6) return; if(Math.abs(e.clientY-sy)>Math.abs(dx)){ cvw.releasePointerCapture(e.pointerId); return; } cd=true; stopPlay(); dragging=true; hist=[]; kick(); }
    track(su-dx/cvw.clientWidth*.9); });
  cvw.addEventListener("pointerup",()=>{ if(cd) endDrag(); cd=false; }); cvw.addEventListener("pointercancel",()=>{ if(cd) endDrag(); cd=false; });
  $("#sbBack").onclick=()=>M&&goT(M.u2t(target)-7*DAY); $("#sbFwd").onclick=()=>M&&goT(M.u2t(target)+7*DAY);
  $("#sbPlay").onclick=()=>{ if(playing){ stopPlay(); return; } if(reduce()){ u=target=1; draw(); return; }
    u=0; vel=0; $("#sbPlay").textContent="עצירה"; const t0=performance.now(), dur=11000; const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
    const tick=now=>{ const x=Math.min(1,(now-t0)/dur); u=ease(x); draw(); if(x<1) playing=requestAnimationFrame(tick); else { playing=null; target=1; $("#sbPlay").textContent="הפעלה מההתחלה"; } };
    playing=requestAnimationFrame(tick); };
  addEventListener("resize",()=>{ clearTimeout(size.t); size.t=setTimeout(size,80); });
}
function track(nu){ const t=performance.now(); hist.push([t,nu]); while(hist.length>1&&t-hist[0][0]>100) hist.shift(); u=clamp(nu); }
function endDrag(){ if(!dragging) return; dragging=false; let vv=0; if(hist.length>1){ const a=hist[0],b=hist[hist.length-1]; const s=(b[0]-a[0])/1000; if(s>0) vv=(b[1]-a[1])/s; } vel=0; target=clamp(u+Math.max(-2,Math.min(2,vv))*.25); kick(); }
function step(ts){ const now=ts||performance.now(); const d=Math.min(.05,(now-(step.l||now))/1000)||.016; step.l=now;
  if(!dragging&&!playing){ const k=90,c=2*Math.sqrt(k); const a=k*(target-u)-c*vel; vel+=a*d; u+=vel*d; if(u<0){u=0;vel=0;} if(u>1){u=1;vel=0;}
    if(Math.abs(target-u)<.0003&&Math.abs(vel)<.0005){ u=target; vel=0; draw(); raf=0; step.l=0; return; } }
  draw(); raf=requestAnimationFrame(step); }
function kick(){ if(!raf){ step.l=0; raf=requestAnimationFrame(step); } }
function goT(t){ stopPlay(); target=clamp(M.t2u(t)); if(reduce()){ u=target; vel=0; draw(); } else kick(); }
function stopPlay(){ if(playing){ cancelAnimationFrame(playing); playing=null; $("#sbPlay").textContent="הפעלה מההתחלה"; target=u; vel=0; } }

function size(){ if(!M||!M.hasMap||!cv) return; const W=cv.parentElement.clientWidth; if(!W) return; const dpr=Math.min(2.5,window.devicePixelRatio||1); const VH=M.map.h*K+TOP+10;
  scale=W/M.map.w; px=1/scale; cv.width=Math.round(W*dpr); cv.height=Math.round(VH*scale*dpr); cv.style.height=(VH*scale)+"px"; ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0); roadTint.width=0; draw(); }
function tintRoad(){ if(roadTint.width||!roadImg||!roadImg.complete||!roadImg.naturalWidth) return; roadTint.width=M.map.w; roadTint.height=Math.round(M.map.h*K); const c=roadTint.getContext("2d");
  c.drawImage(roadImg,0,0,M.map.w,roadTint.height); c.globalCompositeOperation="source-in"; c.fillStyle="#E4E5E5"; c.fillRect(0,0,M.map.w,roadTint.height); }
function icoDrill(x,y){ const q=px; ctx.save(); ctx.strokeStyle="#E40033"; ctx.lineWidth=1.6*q; ctx.lineJoin="round";
  ctx.strokeRect(x-6*q,y-4*q,12*q,4*q); ctx.beginPath(); ctx.moveTo(x-2*q,y-4*q); ctx.lineTo(x-2*q,y-22*q); ctx.lineTo(x+3*q,y-4*q); ctx.moveTo(x-2*q,y-22*q); ctx.lineTo(x-2*q,y-26*q); ctx.moveTo(x-2*q,y-14*q); ctx.lineTo(x+1*q,y-14*q); ctx.stroke(); ctx.restore(); }
function icoCrane(x,y){ const q=px; ctx.save(); ctx.strokeStyle="#E40033"; ctx.lineWidth=1.6*q; ctx.lineJoin="round"; ctx.lineCap="round";
  ctx.strokeRect(x-9*q,y-6*q,14*q,5*q); ctx.strokeRect(x+5*q,y-9*q,5*q,8*q); ctx.beginPath(); ctx.arc(x-5*q,y,2*q,0,7); ctx.moveTo(x+6*q,y); ctx.arc(x+4*q,y,2*q,0,7); ctx.moveTo(x-6*q,y-6*q); ctx.lineTo(x-16*q,y-20*q); ctx.lineTo(x-16*q,y-14*q); ctx.stroke(); ctx.restore(); }
function draw(){
  if(!M) return; const s=M.state(u); ui(s); if(!M.hasMap||!cv.width) return; const q=px, T=M.T, PY=y=>TOP+y*K, VH=M.map.h*K+TOP+10;
  ctx.fillStyle="#FFFFFF"; ctx.fillRect(0,0,M.map.w,VH); tintRoad(); if(roadTint.width) ctx.drawImage(roadTint,0,TOP);
  let drillAt=null, panAt=null;
  for(const i of M.byY){ const b=T[i]; const x0=b.x,x1=b.x+b.w,gb=PY(b.y),gf=PY(b.y+b.h); const df=s.drillF[i],cf=s.castF[i],sf=s.strF[i],pf=s.panF[i];
    ctx.setLineDash([3*q,3*q]); ctx.strokeStyle="#C9CBCC"; ctx.lineWidth=.8*q; ctx.beginPath(); ctx.moveTo(x0,gf); ctx.lineTo(x1,gf); ctx.moveTo(x0,gb); ctx.lineTo(x1,gb); ctx.stroke(); ctx.setLineDash([]);
    const per=Math.max(2,Math.round(b.piles/2)), nD=Math.round(df*per*2), nC=Math.round(cf*per*2);
    for(let j=0;j<nD;j++){ const row=j<per?0:1, k=row?j-per:j; const cx=x0+(k+.5)*b.w/per, cy=row?gb:gf;
      if(j<nC){ ctx.fillStyle="#3F4447"; ctx.fillRect(cx-.9*q,cy-.9*q,1.8*q,1.8*q); } else { ctx.strokeStyle="#9A9EA1"; ctx.lineWidth=.8*q; ctx.strokeRect(cx-1.1*q,cy-1.1*q,2.2*q,2.2*q); } }
    if(df>0&&df<1&&!drillAt) drillAt=[x0+b.w*df,gf];
    if(sf>0){ const xe=x0+b.w*sf; ctx.strokeStyle="#3F4447"; ctx.lineWidth=.9*q; ctx.beginPath(); ctx.moveTo(x0,gf-FRONT); ctx.lineTo(xe,gf-FRONT); ctx.moveTo(x0,gb-LIFT); ctx.lineTo(xe,gb-LIFT);
      const legs=Math.max(2,Math.round(per/3)); for(let k=0;k<=legs;k++){ const lx=x0+k*b.w/legs; if(lx>xe+.01) break; ctx.moveTo(lx,gf); ctx.lineTo(lx,gf-FRONT); ctx.moveTo(lx,gb); ctx.lineTo(lx,gb-LIFT); ctx.moveTo(lx,gf-FRONT); ctx.lineTo(lx,gb-LIFT); } ctx.stroke(); }
    if(pf>0){ const xe=x0+b.w*pf; ctx.beginPath(); ctx.moveTo(x0,gf-FRONT); ctx.lineTo(xe,gf-FRONT); ctx.lineTo(xe,gb-LIFT); ctx.lineTo(x0,gb-LIFT); ctx.closePath(); ctx.fillStyle="#D3E9F5"; ctx.fill(); ctx.strokeStyle="#1E7FB0"; ctx.lineWidth=.9*q; ctx.stroke();
      ctx.beginPath(); const cols=Math.max(1,Math.round(b.pan/9)); for(let c=1;c<cols;c++){ const lx=x0+c*b.w/cols; if(lx>=xe) break; ctx.moveTo(lx,gf-FRONT); ctx.lineTo(lx,gb-LIFT); } ctx.lineWidth=.5*q; ctx.stroke();
      if(pf<1&&!panAt) panAt=[xe,gf]; } }
  if(drillAt) icoDrill(drillAt[0],drillAt[1]); if(panAt) icoCrane(panAt[0]+4*q,panAt[1]+2*q);
}
function ui(s){
  const p=u*100; $("#sbKnob").style.right=p+"%"; $("#sbFill").style.width=p+"%";
  const TOT=M.TOT; SE.forEach(o=>{ const x=s.v[o.k]; o.v.textContent=fmt(x); o.b.style.width=(TOT[o.k]&&x>=.5?x/TOT[o.k]*100:0)+"%"; });
  const pct=TOT.panels?s.v.panels/TOT.panels*100:0; $("#sbBig").textContent=(pct<1&&pct>0?pct.toFixed(1):Math.round(pct))+"%";
  const day=Math.round((s.t-M.d0)/DAY); if(day===lastDay) return; lastDay=day; const isToday=u>0.999;
  $("#sbDate").textContent=isToday?isoText(isoOf(Date.now())):ddmm(s.t)+"."+new Date(s.t).getUTCFullYear(); $("#sbToday").style.opacity=isToday?1:0; $("#sbRail").setAttribute("aria-valuetext",ddmm(s.t));
  SE.forEach(o=>{ const r=M.lastRec(o.k,s.t); o.a.textContent=r?"עדכון אחרון "+isoText(r):"טרם התחיל"; o.a.classList.toggle("old",isToday&&!!r&&dt(r)<M.dEnd-8*DAY); });
  $("#sbSub").innerHTML=s.v.drill<1&&s.v.cast<1&&s.v.tables<1?(s.v.panels>=1?"<b>"+fmt(s.v.panels)+"</b> פאנלים מותקנים":"<b>אדמה ריקה.</b> כאן מתחיל הסיפור."):"<b>"+fmt(s.v.panels)+"</b> פאנלים על <b>"+fmt(s.v.tables)+"</b> שולחנות · <b>"+fmt(s.v.cast)+"</b> עמודים יצוקים";
  let best=null; M.msB.forEach(([b,mt])=>{ if(mt<=s.t+DAY/2&&(!best||mt>best[1])) best=[b,mt]; }); M.msB.forEach(([b])=>b.classList.toggle("on",!!best&&b===best[0]));
}

// נקרא מ-renderStatus בכל שינוי בסטטוס. בונה את ה-DOM פעם אחת, מחשב מחדש את המודל, ושומר על מיקום הציר.
export function renderSiteBuild(){
  const card=$("#buildCard"); if(!card) return; buildDom();
  const acts=shared.demoStock?[]:(shared.STATUS||[]); const ser=siteBuildSeries(acts); const map=siteMap(); const has=Object.keys(ser).length>0;
  const empty=$("#sbEmpty"); if(empty) empty.hidden=has; $("#sbBody").hidden=!has;
  if(!has){ M=null; foldSum("build",""); return; }
  M=model(map,ser,isoOf(Date.now())); M.byY=M.T.map((_,i)=>i).sort((i,j)=>M.T[i].y-M.T[j].y||M.T[i].x-M.T[j].x);
  SE.forEach(o=>{ o.of.textContent=fmtN(M.TOT[o.k]); o.el.hidden=!ser[o.k]; });
  // ציר: תחילת חודש + היום
  const ticks=$("#sbTicks"); ticks.innerHTML=""; const months=[]; if(new Date(M.d0).getUTCDate()===1) months.push(M.d0); for(let d=new Date(M.d0);;){ const t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1); if(t>=M.dEnd-10*DAY) break; months.push(t); d=new Date(t); }
  // בקטע הדחוס (לפני העבודה) רק החודש הראשון מסומן; אחר כך כל חודש, או כל שני חודשים כשיש הרבה
  const dense=months.filter(t=>t>=M.dMid); const every=dense.length>6?2:1;
  months.forEach((t,i)=>{ if(t<M.dMid?i>0:(dense.indexOf(t)%every)) return; const x=M.t2u(t)*100; const tk=document.createElement("div"); tk.className="tk"; tk.style.right=x+"%"; ticks.appendChild(tk); const lb=document.createElement("div"); lb.className="lab"; lb.style.right=x+"%"; lb.textContent=MONTHS[new Date(t).getUTCMonth()]; ticks.appendChild(lb); });
  const now=document.createElement("div"); now.className="lab now"; now.style.right="100%"; now.textContent="היום"; ticks.appendChild(now);
  // אבני דרך
  const msEl=$("#sbMs"); msEl.innerHTML=""; M.msB=M.ms.map(([t,what])=>{ const li=document.createElement("li"); const b=document.createElement("button"); b.type="button"; b.innerHTML='<span class="when num">'+ddmm(t)+'</span><span class="what">'+esc(what)+'</span>'; b.onclick=()=>goT(t+DAY); li.appendChild(b); msEl.appendChild(li); return [b,t+DAY]; });
  // מפה או מצב «אין עדיין מפה»
  const nm=$("#sbNoMap"); nm.hidden=M.hasMap; ["#sbCvw",".sb-keys","#sbRail",".sb-ctrl","#sbDate","#sbToday"].forEach(sel=>{ const e=card.querySelector(sel); if(e) e.hidden=!M.hasMap; });
  if(!M.hasMap){ nm.innerHTML='<b>אין עדיין מפת שולחנות לאתר הזה.</b> המספרים למעלה מהסטטוס. כשתהיה מפת הקונסטרוקציה (תוכנית השולחנות עם המיקום של כל שולחן), השרטוט של האתר נבנה יופיע כאן.'; }
  else if(map.road&&(!roadImg||roadImg.src!==map.road)){ roadImg=new Image(); roadImg.onload=()=>{ roadTint.width=0; draw(); }; roadImg.src=map.road; }
  $("#sbNote").textContent=M.hasMap?(map.fictive?"המפה פיקטיבית עד שיגיע שרטוט השולחנות של האתר. ":"")+"הכמויות מסטטוס ההתקדמות. השולחנות במיקום לפי "+(map.source||"מפת הקונסטרוקציה")+". סדר הביצוע על המפה, מהשורות האחרונות למעלה עד הראשונות למטה, ולכן המיקום של כל שלב הוא קירוב; הכמויות אמיתיות.":"";
  const tv=M.val("panels",M.dEnd), tp=M.TOT.panels?Math.round(tv/M.TOT.panels*100):0; foldSum("build",M.hasMap?tp+"% פאנלים":tp+"% פאנלים · אין מפה");
  lastDay=-1; if(!raf&&!playing){ u=clamp(u); target=u; } if(M.hasMap) size(); else draw();
}
export function __init(){}
