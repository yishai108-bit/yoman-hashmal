import { $, esc, popup, shared, toast } from "./core.js";
import { CATS, fmtN, openMove, openNote, stockRows } from "./01-stock.js";
import { openIssue, openQuickCount } from "./03-issues.js";
import { openPull } from "./20-cables.js";
import { openBlocker, openWorkReport } from "./21-work.js";
import { openDictation } from "./25-dictate.js";
/* ================= פעולות: הכפתור הצף, ניפוק כלי עבודה ותפריט המלאי ================= */
export let N, FAB_LABEL;
export function openFabMenu(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="פעולה"><div class="grab"></div><h2>מה עושים?</h2><div class="stock">'
    +'<button type="button" class="slip" data-k="work"><b>דיווח ביצוע</b><span>מה בוצע היום: פעילות, כמות, אזור, צוות</span></button>'
    +'<button type="button" class="slip" data-k="pull"><b>משיכת כבל</b><span>כמה מטר נמשכו, מאיזה תוף ולאן</span></button>'
    +'<button type="button" class="slip" data-k="note"><b><i class="ic ic-cam"></i> קליטת תעודת משלוח</b><span>סריקה או צילום של התעודה, השורות נקראות לבד</span></button>'
    +'<button type="button" class="slip" data-k="issue"><b>ניפוק חומרים</b><span>חומרים שיוצאים מהמלאי לצוות או לקבלן משנה, עם חתימת המקבל</span></button>'
    +'<button type="button" class="slip" data-k="equip"><b>ניפוק כלי עבודה</b><span>כלי שיוצא מהמלאי לעובד: מי לקח וכמה</span></button>'
    +'<button type="button" class="slip" data-k="blocker"><b>חריג</b><span>משהו תוקע: חוסר חומר, תקלה, החלטה שמחכה</span></button>'
    +'<button type="button" class="slip" data-k="dict"><b><i class="ic ic-mic"></i> דיווח בדיבור</b><span>מספרים מה היה היום (או מצלמים את הטופס), והיומן מפרק לעובדים, ביצוע וחריגים</span></button>'
    +'</div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const close=()=>scrim.remove(); scrim.querySelector(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  scrim.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{ close(); const k=b.dataset.k; if(k==="work") openWorkReport(); else if(k==="note") openNote(); else if(k==="pull") openPull(); else if(k==="equip") openEquipIssue(); else if(k==="blocker") openBlocker(); else if(k==="dict") openDictation(); else openIssue(); });
}
/* ניפוק כלי עבודה: בוחרים פריט מהמלאי (כלי עבודה ומתכלים קודם) ואז הוצאה עם «מי לקח» */
export function openEquipIssue(){
  const rows=(shared.demoStock?[]:stockRows()).filter(r=>r.name); const pri={tools:0,consumables:1,install:2,cables:3};
  rows.sort((a,b)=>(pri[a.cat]??9)-(pri[b.cat]??9)||String(a.name).localeCompare(String(b.name),"he"));
  let qtxt="";
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="ניפוק כלי עבודה"><div class="grab"></div><h2>ניפוק כלי עבודה</h2>'
    +'<div class="search" style="margin-bottom:8px"><input type="text" id="eqQ" placeholder="חפש כלי או חומר במלאי" autocomplete="off"><span class="ico">⌕</span></div>'
    +'<div class="stock" id="eqList"></div><button class="addline" type="button" id="eqNew" style="margin-top:8px">+ פריט שלא רשום במלאי</button>'
    +'<div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const q=x=>scrim.querySelector(x); const close=()=>scrim.remove();
  q(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  const draw=()=>{ const box=q("#eqList"); box.innerHTML=""; const t=qtxt.toLowerCase();
    const list=(t?rows.filter(r=>String(r.name).toLowerCase().includes(t)):rows).slice(0,20);
    if(!list.length){ box.innerHTML='<div class="hint">'+(rows.length?'אין פריט כזה במלאי.':'אין עדיין פריטים במלאי. קלוט תעודת משלוח או הוסף פריט חדש.')+'</div>'; return; }
    list.forEach(r=>{ const b=document.createElement("button"); b.type="button"; b.className="slip"; const bal=(Number(r.in)||0)-(Number(r.out)||0);
      b.innerHTML='<b>'+esc(r.name)+'</b><span>'+esc((CATS.find(c=>c.id===r.cat)||{}).label||"")+' · במלאי <b>'+fmtN(bal)+'</b> '+esc(r.unit||"")+'</span>'; b.onclick=()=>{ close(); openMove(r.name); }; box.appendChild(b); });
    if(!t&&rows.length>20){ const h=document.createElement("div"); h.className="hint"; h.textContent="ועוד "+(rows.length-20)+" · חפש"; box.appendChild(h); } };
  q("#eqQ").oninput=e=>{ qtxt=e.target.value.trim(); draw(); };
  q("#eqNew").onclick=()=>{ const nm=qtxt.trim(); if(!nm){ toast("כתוב את שם הפריט בחיפוש."); q("#eqQ").focus(); return; } close(); openMove(nm); };
  draw(); setTimeout(()=>q("#eqQ").focus(),60);
}
export function openStockActions(){
  const scrim=popup('<div class="sheet" role="dialog" aria-modal="true" aria-label="מלאי"><div class="grab"></div><h2>מה עושים?</h2><div class="stock">'
    +'<button type="button" class="slip" data-k="note"><b><i class="ic ic-cam"></i> קליטת תעודת משלוח</b><span>סריקה או צילום של התעודה, השורות נקראות לבד</span></button>'
    +'<button type="button" class="slip" data-k="issue"><b>ניפוק חומרים</b><span>חומרים שיוצאים מהמלאי לצוות או לקבלן משנה, עם חתימה</span></button>'
    +'<button type="button" class="slip" data-k="count"><b>ספירה מהירה</b><span>מה יש בפועל במלאי, פריט אחרי פריט</span></button>'
    +'</div><div class="acts"><button class="cancel" type="button" style="flex:1">סגור</button></div></div>'); const close=()=>scrim.remove(); scrim.querySelector(".cancel").onclick=close; scrim.onclick=e=>{ if(e.target===scrim) close(); };
  scrim.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{ close(); const k=b.dataset.k; if(k==="note") openNote(); else if(k==="issue") openIssue(); else openQuickCount(); });
}
export function __init(){
N = v=>Number(v)||0;
/* ---- כפתור פעולה ראשי ---- */
FAB_LABEL = "פעולה";
shared.fabTab="over";
$("#fab").onclick=()=>openFabMenu();
const be=$("#btnEquip"); if(be) be.onclick=()=>openEquipIssue();
}
