import { ls, toast } from "./core.js";
import { loadImg } from "./01-stock.js";
import { saveFile } from "./08-settings.js";
export let SCAN_MAX, canvasBlob;
export function boxBlurF(src,W,H,r){
  const tmp=new Float32Array(W*H), out=new Float32Array(W*H); const n=2*r+1;
  for(let y=0;y<H;y++){ let s=0; const row=y*W;
    for(let x=-r;x<=r;x++) s+=src[row+Math.min(W-1,Math.max(0,x))];
    for(let x=0;x<W;x++){ tmp[row+x]=s/n; const a=x-r, b=x+r+1; s+=src[row+Math.min(W-1,b)]-src[row+Math.max(0,a)]; } }
  for(let x=0;x<W;x++){ let s=0;
    for(let y=-r;y<=r;y++) s+=tmp[Math.min(H-1,Math.max(0,y))*W+x];
    for(let y=0;y<H;y++){ out[y*W+x]=s/n; const a=y-r, b=y+r+1; s+=tmp[Math.min(H-1,b)*W+x]-tmp[Math.max(0,a)*W+x]; } }
  return out;
}
export function grayOf(c,maxSide){
  const s=Math.min(1,maxSide/Math.max(c.width,c.height)); const W=Math.max(2,Math.round(c.width*s)), H=Math.max(2,Math.round(c.height*s));
  const sc=document.createElement("canvas"); sc.width=W; sc.height=H; const g=sc.getContext("2d"); g.drawImage(c,0,0,W,H);
  const d=g.getImageData(0,0,W,H).data; const gray=new Float32Array(W*H);
  for(let i=0,j=0;i<d.length;i+=4,j++) gray[j]=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
  return {gray,W,H,s};
}
export function lineX(l,y){ return (l.rho-y*Math.sin(l.th))/Math.cos(l.th); }
export function lineY(l,x){ return (l.rho-x*Math.cos(l.th))/Math.sin(l.th); }
export function isect(a,b){ // x cosA + y sinA = rA ; x cosB + y sinB = rB
  const ca=Math.cos(a.th),sa=Math.sin(a.th),cb=Math.cos(b.th),sb=Math.sin(b.th); const det=ca*sb-sa*cb; if(Math.abs(det)<1e-9) return null;
  return {x:(a.rho*sb-b.rho*sa)/det, y:(ca*b.rho-cb*a.rho)/det};
}
export function detectQuad(c){
  const {gray,W,H,s}=grayOf(c,440);
  const bl=boxBlurF(gray,W,H,1);
  const mag=new Float32Array(W*H), ang=new Float32Array(W*H); let maxM=0;
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){ const i=y*W+x;
    const gx=(bl[i-W+1]+2*bl[i+1]+bl[i+W+1])-(bl[i-W-1]+2*bl[i-1]+bl[i+W-1]);
    const gy=(bl[i+W-1]+2*bl[i+W]+bl[i+W+1])-(bl[i-W-1]+2*bl[i-W]+bl[i-W+1]);
    const m=Math.hypot(gx,gy); mag[i]=m; if(m>maxM) maxM=m; let a=Math.atan2(gy,gx)*180/Math.PI; if(a<0) a+=180; if(a>=180) a-=180; ang[i]=a; }
  // סף: 8% הפיקסלים החזקים
  const hist=new Uint32Array(257); for(let i=0;i<mag.length;i++) hist[Math.min(256,Math.round(mag[i]/maxM*256))]++;
  let cnt=0, thr=maxM; for(let b=256;b>=0;b--){ cnt+=hist[b]; if(cnt>=W*H*0.08){ thr=b/256*maxM; break; } }
  thr=Math.max(maxM*0.03,Math.min(thr,maxM*0.08)); const sat=maxM*0.15;
  const TH=[]; for(let t=0;t<=32;t++) TH.push(t); for(let t=148;t<180;t++) TH.push(t); for(let t=58;t<=122;t++) TH.push(t);
  const diag=Math.ceil(Math.hypot(W,H)); const NR=2*diag+1; const acc=new Float32Array(TH.length*NR);
  const cosT=TH.map(t=>Math.cos(t*Math.PI/180)), sinT=TH.map(t=>Math.sin(t*Math.PI/180));
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++){ const i=y*W+x; const m=mag[i]; if(m<thr) continue; const a=ang[i]; const w=Math.min(1,m/sat);
    for(let k=0;k<TH.length;k++){ let d=Math.abs(a-TH[k]); if(d>90) d=180-d; if(d>9) continue;
      const r=Math.round(x*cosT[k]+y*sinT[k])+diag; acc[k*NR+r]+=w; } }
  const avgM=1;
  const pick=(vert,lo,hi,outerIsMin)=>{ // vert: קווים אנכיים (θ ליד 0/180), אחרת אופקיים
    let best=0; const cand=[];
    for(let k=0;k<TH.length;k++){ const t=TH[k]; const isV=(t<=32||t>=148); if(isV!==vert) continue;
      for(let r=0;r<NR;r++){ const v=acc[k*NR+r]; if(v<=0) continue; const rho=r-diag; const l={th:t*Math.PI/180,rho};
        const p=vert?lineX(l,H/2):lineY(l,W/2); if(!(p>=lo&&p<=hi)) continue; if(v>best) best=v; cand.push({l,v,p}); } }
    const L=vert?H:W; if(best<0.12*L*avgM) return null;
    const ok=cand.filter(cd=>cd.v>=0.75*best); ok.sort((a,b)=>outerIsMin?a.p-b.p:b.p-a.p); return ok[0].l;
  };
  const top=pick(false,0.015*H,0.42*H,true)||{th:Math.PI/2,rho:0};
  const bot=pick(false,0.58*H,0.985*H,false)||{th:Math.PI/2,rho:H-1};
  const left=pick(true,0.015*W,0.42*W,true)||{th:0,rho:0};
  const right=pick(true,0.58*W,0.985*W,false)||{th:0,rho:W-1};
  const pts=[isect(top,left),isect(top,right),isect(bot,right),isect(bot,left)];
  if(pts.some(p=>!p)) return null;
  const cl=p=>({x:Math.min(W-1,Math.max(0,p.x)),y:Math.min(H-1,Math.max(0,p.y))});
  const q=pts.map(cl);
  // קמור ושטח סביר
  let area=0; for(let i=0;i<4;i++){ const a=q[i], b=q[(i+1)%4]; area+=a.x*b.y-b.x*a.y; } area=Math.abs(area)/2;
  const cross=[]; for(let i=0;i<4;i++){ const a=q[i],b=q[(i+1)%4],c2=q[(i+2)%4]; cross.push((b.x-a.x)*(c2.y-b.y)-(b.y-a.y)*(c2.x-b.x)); }
  if(area<0.15*W*H || !(cross.every(v=>v>0)||cross.every(v=>v<0))) return null;
  return q.map(p=>({x:p.x/s,y:p.y/s}));
}
export function defaultQuad(w,h){ const ix=w*0.04, iy=h*0.04; return [{x:ix,y:iy},{x:w-ix,y:iy},{x:w-ix,y:h-iy},{x:ix,y:h-iy}]; }
export function solveH(src,dst){ // הומוגרפיה 3x3: src→dst (ארבע נקודות)
  const A=[], b=[];
  for(let i=0;i<4;i++){ const {x,y}=src[i], {x:u,y:v}=dst[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v); }
  const n=8; const M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r; [M[c],M[p]]=[M[p],M[c]];
    const d=M[c][c]||1e-12; for(let k=c;k<=n;k++) M[c][k]/=d;
    for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]; for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; } }
  const h=M.map(r=>r[n]); return [h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];
}
export function warpQuad(c,quad){
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  let w=Math.round(Math.max(d(quad[0],quad[1]),d(quad[3],quad[2]))), h=Math.round(Math.max(d(quad[0],quad[3]),d(quad[1],quad[2])));
  const k=Math.min(1,SCAN_MAX/Math.max(w,h)); w=Math.max(8,Math.round(w*k)); h=Math.max(8,Math.round(h*k));
  const Hm=solveH([{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}],quad); // יעד → מקור
  const sg=c.getContext("2d"); const src=sg.getImageData(0,0,c.width,c.height).data; const SW=c.width, SH=c.height;
  const out=new ImageData(w,h); const o=out.data;
  for(let y=0;y<h;y++){ for(let x=0;x<w;x++){
    const den=Hm[6]*x+Hm[7]*y+1; const sx=(Hm[0]*x+Hm[1]*y+Hm[2])/den, sy=(Hm[3]*x+Hm[4]*y+Hm[5])/den;
    const x0=Math.floor(sx), y0=Math.floor(sy); const i=(y*w+x)*4;
    if(x0<0||y0<0||x0>=SW-1||y0>=SH-1){ o[i]=o[i+1]=o[i+2]=255; o[i+3]=255; continue; }
    const fx=sx-x0, fy=sy-y0; const p=(y0*SW+x0)*4;
    for(let ch=0;ch<3;ch++){ const a=src[p+ch], b=src[p+4+ch], c2=src[p+SW*4+ch], d2=src[p+SW*4+4+ch];
      o[i+ch]=(a*(1-fx)+b*fx)*(1-fy)+(c2*(1-fx)+d2*fx)*fy; }
    o[i+3]=255; } }
  const oc=document.createElement("canvas"); oc.width=w; oc.height=h; oc.getContext("2d").putImageData(out,0,0); return oc;
}
export function enhanceCanvas(c,mode){
  if(mode==="orig") return c;
  const W=c.width,H=c.height; const g=c.getContext("2d"); const img=g.getImageData(0,0,W,H); const d=img.data;
  // רקע: מקסימום בבלוקים של 8 + טשטוש
  const B=8, bw=Math.ceil(W/B), bh=Math.ceil(H/B); const pool=new Float32Array(bw*bh);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=(y*W+x)*4; const l=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114; const j=((y/B)|0)*bw+((x/B)|0); if(l>pool[j]) pool[j]=l; }
  const bgS=boxBlurF(pool,bw,bh,3);
  const out=new ImageData(W,H); const o=out.data;
  for(let y=0;y<H;y++){ const by=Math.min(bh-1,y/B); const y0=by|0, fy=by-y0, y1=Math.min(bh-1,y0+1);
    for(let x=0;x<W;x++){ const bx=Math.min(bw-1,x/B); const x0=bx|0, fx=bx-x0, x1=Math.min(bw-1,x0+1);
      const bg=Math.max(40,(bgS[y0*bw+x0]*(1-fx)+bgS[y0*bw+x1]*fx)*(1-fy)+(bgS[y1*bw+x0]*(1-fx)+bgS[y1*bw+x1]*fx)*fy);
      const i=(y*W+x)*4;
      if(mode==="bw"){ const l=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114; const r=l/bg; const v=r<=0.72?0:r>=0.9?255:(r-0.72)/0.18*255; o[i]=o[i+1]=o[i+2]=v; }
      else { for(let ch=0;ch<3;ch++){ const r=d[i+ch]/bg; o[i+ch]=Math.max(0,Math.min(255,(r-0.1)/0.88*255)); } }
      o[i+3]=255; } }
  const oc=document.createElement("canvas"); oc.width=W; oc.height=H; oc.getContext("2d").putImageData(out,0,0); return oc;
}
export function rotateCanvas(c,times){ times=((times%4)+4)%4; if(!times) return c; const odd=times%2; const oc=document.createElement("canvas"); oc.width=odd?c.height:c.width; oc.height=odd?c.width:c.height;
  const g=oc.getContext("2d"); g.translate(oc.width/2,oc.height/2); g.rotate(times*Math.PI/2); g.drawImage(c,-c.width/2,-c.height/2); return oc; }
/* ---- ממשק הסורק ---- */
export function openScanner(opts){
  opts=opts||{}; const pages=[]; let step="pick", photo=null, quad=null, filter=ls.get("scanFilter")||"magic", rot=0, warped=null, cache={}, drag=null;
  const root=document.createElement("div"); root.className="scan"; root.setAttribute("role","dialog"); root.setAttribute("aria-modal","true"); root.setAttribute("aria-label","סריקת תעודה");
  root.innerHTML='<div class="scan-top"><span id="scTitle">סריקת תעודה</span><button type="button" id="scClose" aria-label="סגור">✕</button></div>'
    +'<div class="scan-stage" id="scStage"></div><div class="scan-bot" id="scBot"></div>'
    +'<input type="file" accept="image/*" capture="environment" id="scCam" hidden><input type="file" accept="image/*" multiple id="scGal" hidden>';
  document.body.appendChild(root);
  const q=s=>root.querySelector(s); const stage=q("#scStage"), bot=q("#scBot");
  const title=()=>{ q("#scTitle").textContent="סריקת תעודה · עמוד "+(pages.length+(step==="pick"?1:1))+(pages.length?" · "+pages.length+" נסרקו":""); };
  function close(){ document.removeEventListener("keydown",esck); window.removeEventListener("resize",layout); root.remove(); }
  function esck(ev){ if(ev.key==="Escape") close(); }
  document.addEventListener("keydown",esck);
  q("#scClose").onclick=()=>{ if(pages.length&&opts.onDone){ opts.onDone(pages); } close(); };
  q("#scCam").onchange=e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=""; if(f) load(f); };
  q("#scGal").onchange=async e=>{ const fs=[...e.target.files]; e.target.value=""; if(!fs.length) return;
    if(fs.length===1){ load(fs[0]); return; }
    // כמה תמונות מהגלריה: כל אחת עמוד, אוטומטי
    for(const f of fs){ try{ await autoPage(f); }catch(err){} } showPick(); };
  async function autoPage(f){ const im=await loadImg(f); const c=scanCanvasFromImage(im,SCAN_MAX); const qd=detectQuad(c)||defaultQuad(c.width,c.height); const w=enhanceCanvas(warpQuad(c,qd),filter); await acceptCanvas(w); }
  function showPick(){
    step="pick"; title(); stage.innerHTML='<div class="scan-pick"><label><i class="ic ic-cam big"></i>צלם תעודה<input type="file" accept="image/*" capture="environment"></label><label><i class="ic ic-gal big"></i>מהגלריה<input type="file" accept="image/*" multiple></label>'
      +'<div class="hint3" style="grid-column:1/3">מצלמים את כל התעודה על רקע כהה. הקצוות יזוהו לבד, אפשר לתקן באצבע.</div></div>';
    stage.querySelectorAll("input")[0].onchange=q("#scCam").onchange; stage.querySelectorAll("input")[1].onchange=q("#scGal").onchange;
    drawBot();
  }
  async function load(f){
    stage.innerHTML='<div class="hint3">טוען…</div>';
    let im; try{ im=await loadImg(f); }catch(e){ toast("התמונה לא נקראה."); showPick(); return; }
    photo=scanCanvasFromImage(im,SCAN_MAX); rot=0; cache={}; warped=null;
    quad=detectQuad(photo)||defaultQuad(photo.width,photo.height);
    showCrop();
  }
  let wrap=null, svg=null, cv=null, loupe=null;
  function showCrop(){
    step="crop"; title();
    stage.innerHTML='<div class="scan-wrap" id="scWrap"><canvas id="scCv"></canvas><svg id="scSvg" xmlns="http://www.w3.org/2000/svg"></svg><canvas class="loupe" id="scLoupe" width="220" height="220"></canvas></div>';
    wrap=q("#scWrap"); cv=q("#scCv"); svg=q("#scSvg"); loupe=q("#scLoupe");
    cv.width=photo.width; cv.height=photo.height; cv.getContext("2d").drawImage(photo,0,0);
    svg.setAttribute("viewBox","0 0 "+photo.width+" "+photo.height);
    layout(); drawQuad(); bindDrag(); drawBot();
  }
  function layout(){
    if(!wrap||step!=="crop") return;
    const sw=stage.clientWidth-16, sh=stage.clientHeight-16; const k=Math.min(sw/photo.width,sh/photo.height);
    wrap.style.width=Math.round(photo.width*k)+"px"; wrap.style.height=Math.round(photo.height*k)+"px"; drawQuad();
  }
  function drawQuad(){
    if(!svg) return; const k=photo.width/Math.max(1,wrap.clientWidth); const r=15*k;
    svg.innerHTML='<polygon points="'+quad.map(p=>p.x+","+p.y).join(" ")+'" fill="rgba(255,170,0,.16)" stroke="#FFAA00" stroke-width="'+(2.2*k)+'"/>'
      +quad.map((p,i)=>'<circle data-i="'+i+'" cx="'+p.x+'" cy="'+p.y+'" r="'+r+'" fill="rgba(255,255,255,.92)" stroke="#FFAA00" stroke-width="'+(2.5*k)+'"/>'
        +'<circle data-i="'+i+'" cx="'+p.x+'" cy="'+p.y+'" r="'+(r*2.2)+'" fill="transparent"/>').join("");
  }
  function toImg(ev){ const r=svg.getBoundingClientRect(); return {x:(ev.clientX-r.left)/r.width*photo.width,y:(ev.clientY-r.top)/r.height*photo.height}; }
  function bindDrag(){
    svg.onpointerdown=ev=>{ const t=ev.target.closest&&ev.target.closest("[data-i]"); if(!t) return; drag=Number(t.dataset.i); svg.setPointerCapture(ev.pointerId); ev.preventDefault(); move(ev); };
    svg.onpointermove=ev=>{ if(drag==null) return; move(ev); ev.preventDefault(); };
    svg.onpointerup=svg.onpointercancel=()=>{ drag=null; loupe.style.display="none"; };
    function move(ev){ const p=toImg(ev); quad[drag]={x:Math.min(photo.width,Math.max(0,p.x)),y:Math.min(photo.height,Math.max(0,p.y))}; drawQuad();
      // זכוכית מגדלת
      const g=loupe.getContext("2d"); const Z=3, S=220/Z; g.fillStyle="#000"; g.fillRect(0,0,220,220);
      g.drawImage(photo,quad[drag].x-S/2,quad[drag].y-S/2,S,S,0,0,220,220);
      g.strokeStyle="#FFAA00"; g.lineWidth=2; g.beginPath(); g.moveTo(110,80); g.lineTo(110,140); g.moveTo(80,110); g.lineTo(140,110); g.stroke();
      loupe.style.display="block"; const onRight=quad[drag].x<photo.width/2; loupe.style.insetInlineStart=onRight?"auto":"10px"; loupe.style.insetInlineEnd=onRight?"10px":"auto"; }
  }
  function showPreview(){
    step="preview"; title();
    const key=filter+"|"+rot;
    if(!warped) warped=warpQuad(photo,quad);
    if(!cache[key]) cache[key]=rotateCanvas(enhanceCanvas(warped,filter),rot);
    const c=cache[key];
    stage.innerHTML='<div class="scan-wrap" style="max-width:100%;max-height:100%"><canvas id="scPv"></canvas></div>';
    const pv=q("#scPv"); pv.width=c.width; pv.height=c.height; pv.getContext("2d").drawImage(c,0,0);
    const sw=stage.clientWidth-16, sh=stage.clientHeight-16; const k=Math.min(sw/c.width,sh/c.height); pv.style.width=Math.round(c.width*k)+"px"; pv.style.height=Math.round(c.height*k)+"px";
    drawBot();
  }
  async function acceptCanvas(c){
    const blob=await canvasBlob(c); const th=document.createElement("canvas"); const tk=Math.min(1,160/Math.max(c.width,c.height)); th.width=Math.round(c.width*tk); th.height=Math.round(c.height*tk); th.getContext("2d").drawImage(c,0,0,th.width,th.height);
    pages.push({blob,w:c.width,h:c.height,url:URL.createObjectURL(blob),thumb:th.toDataURL("image/jpeg",0.7)});
  }
  async function acceptCurrent(){ const key=filter+"|"+rot; const c=cache[key]||rotateCanvas(enhanceCanvas(warped||(warped=warpQuad(photo,quad)),filter),rot); await acceptCanvas(c); photo=null; warped=null; cache={}; }
  function pagesStrip(){
    if(!pages.length) return "";
    return '<div class="scan-pages">'+pages.map((p,i)=>'<div class="pg"><img src="'+p.thumb+'" alt=""><b>'+(i+1)+'</b><button type="button" data-rm="'+i+'" aria-label="הסר עמוד">×</button></div>').join("")+'</div>';
  }
  function drawBot(){
    if(step==="pick"){
      bot.innerHTML=pagesStrip()+(pages.length?'<div class="scan-row"><button class="save" type="button" id="scDone">סיום · '+pages.length+(pages.length===1?' עמוד':' עמודים')+'</button></div>':'<div class="hint3">עמוד אחד או יותר לכל תעודה. בסוף: סיום.</div>');
    } else if(step==="crop"){
      bot.innerHTML='<div class="hint3">גרור את הפינות לקצוות התעודה</div><div class="scan-row"><button class="ghost" type="button" id="scAuto">אוטומטי</button><button class="ghost" type="button" id="scAll">כל התמונה</button><button class="ghost" type="button" id="scRetake">צלם שוב</button></div>'
        +'<div class="scan-row"><button class="save" type="button" id="scNext">המשך ›</button></div>';
      q("#scAuto").onclick=()=>{ quad=detectQuad(photo)||defaultQuad(photo.width,photo.height); drawQuad(); };
      q("#scAll").onclick=()=>{ quad=[{x:0,y:0},{x:photo.width,y:0},{x:photo.width,y:photo.height},{x:0,y:photo.height}]; drawQuad(); };
      q("#scRetake").onclick=()=>q("#scCam").click();
      q("#scNext").onclick=()=>{ warped=null; cache={}; showPreview(); };
    } else {
      bot.innerHTML='<div class="scan-row" id="scFilters">'+[["magic","שיפור"],["bw","שחור-לבן"],["orig","מקור"]].map(([k,l])=>'<button class="ghost" type="button" data-f="'+k+'" aria-pressed="'+(filter===k)+'">'+l+'</button>').join("")+'<button class="ghost" type="button" id="scRot" aria-label="סובב">⟳</button></div>'
        +'<div class="scan-row"><button class="ghost" type="button" id="scBack">‹ חיתוך</button><button class="ghost" type="button" id="scMore">+ עמוד</button><button class="save" type="button" id="scDone2">סיום ✓</button></div>'+pagesStrip();
      q("#scFilters").onclick=e=>{ const b=e.target.closest("[data-f]"); if(!b) return; filter=b.dataset.f; ls.set("scanFilter",filter); showPreview(); };
      q("#scRot").onclick=()=>{ rot=(rot+1)%4; showPreview(); };
      q("#scBack").onclick=()=>showCrop();
      q("#scMore").onclick=async()=>{ await acceptCurrent(); showPick(); q("#scCam").click(); };
      q("#scDone2").onclick=async()=>{ await acceptCurrent(); if(opts.onDone) opts.onDone(pages); close(); };
    }
    const dn=q("#scDone"); if(dn) dn.onclick=()=>{ if(opts.onDone) opts.onDone(pages); close(); };
    bot.querySelectorAll("[data-rm]").forEach(b=>{ b.onclick=()=>{ const i=Number(b.dataset.rm); URL.revokeObjectURL(pages[i].url); pages.splice(i,1); title(); drawBot(); }; });
  }
  window.addEventListener("resize",layout);
  if(opts.file) load(opts.file); else showPick();
  return {close};
}
export function scanCanvasFromImage(im,max){ const iw=im.naturalWidth||im.width, ih=im.naturalHeight||im.height; const k=Math.min(1,max/Math.max(iw,ih)); const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(iw*k)); c.height=Math.max(1,Math.round(ih*k)); c.getContext("2d").drawImage(im,0,0,c.width,c.height); return c; }
/* ---- PDF מעמודים סרוקים (JPEG) ---- */
export async function jpegPage(src){ // src: Blob | url → {bytes,w,h} JPEG RGB
  let blob=src; if(typeof src==="string"){ const r=await fetch(src); blob=await r.blob(); }
  const im=await loadImg(blob); const c=scanCanvasFromImage(im,2000);
  const jb=await canvasBlob(c,0.85); return {bytes:new Uint8Array(await jb.arrayBuffer()),w:c.width,h:c.height};
}
export async function buildPdf(pages,title){
  const enc=new TextEncoder(); const chunks=[]; let off=0; const offs=[];
  const put=s=>{ const b=typeof s==="string"?enc.encode(s):s; chunks.push(b); off+=b.length; };
  const obj=(n,body)=>{ offs[n]=off; put(n+" 0 obj\n"); put(body); put("\nendobj\n"); };
  put("%PDF-1.4\n"); put(new Uint8Array([0x25,0xE2,0xE3,0xCF,0xD3,0x0A]));
  const N=pages.length; const kids=[]; for(let i=0;i<N;i++) kids.push((4+i*3)+" 0 R");
  obj(1,"<< /Type /Catalog /Pages 2 0 R >>");
  obj(2,"<< /Type /Pages /Kids ["+kids.join(" ")+"] /Count "+N+" >>");
  obj(3,"<< /Title ("+String(title||"scan").replace(/[()\\]/g,"")+") /Producer (Yoman Atar) >>");
  pages.forEach((p,i)=>{
    const pn=4+i*3, cn=pn+1, xn=pn+2;
    const PW=595.28, PH=841.89, M=24; const k=Math.min((PW-2*M)/p.w,(PH-2*M)/p.h); const w=p.w*k, h=p.h*k; const x=(PW-w)/2, y=(PH-h)/2;
    const content="q "+w.toFixed(2)+" 0 0 "+h.toFixed(2)+" "+x.toFixed(2)+" "+y.toFixed(2)+" cm /Im"+i+" Do Q";
    obj(pn,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+PW+" "+PH+"] /Resources << /XObject << /Im"+i+" "+xn+" 0 R >> >> /Contents "+cn+" 0 R >>");
    obj(cn,"<< /Length "+enc.encode(content).length+" >>\nstream\n"+content+"\nendstream");
    offs[xn]=off; put(xn+" 0 obj\n<< /Type /XObject /Subtype /Image /Width "+p.w+" /Height "+p.h+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+p.bytes.length+" >>\nstream\n"); put(p.bytes); put("\nendstream\nendobj\n");
  });
  const total=4+N*3; const xref=off;
  put("xref\n0 "+total+"\n0000000000 65535 f \n"); for(let i=1;i<total;i++) put(String(offs[i]).padStart(10,"0")+" 00000 n \n");
  put("trailer\n<< /Size "+total+" /Root 1 0 R /Info 3 0 R >>\nstartxref\n"+xref+"\n%%EOF\n");
  return new Blob(chunks,{type:"application/pdf"});
}
export async function exportNotePdf(srcs,name,title){
  try{
    const pages=[]; for(const s of srcs){ if(!s) continue; try{ pages.push(await jpegPage(s)); }catch(e){} }
    if(!pages.length){ toast("אין צילום לתעודה הזאת."); return; }
    const blob=await buildPdf(pages,title); await saveFile(name,blob);
  }catch(e){ toast("יצירת ה-PDF נכשלה."); }
}
export function __init(){
/* ================= סורק תעודות (בסגנון CamScanner): זיהוי קצוות, יישור, ניקוי רקע, כמה עמודים ================= */
SCAN_MAX = 1600;
canvasBlob = (c,q)=>new Promise(r=>c.toBlob(r,"image/jpeg",q||0.86));
}
