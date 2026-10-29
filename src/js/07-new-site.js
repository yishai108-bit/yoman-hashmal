import { $, esc, shared } from "./core.js";
import { openImport } from "./01-stock.js";
import { SITE, openSettings, showTab } from "./08-settings.js";
import { openBoqImport } from "./13-purchasing.js";
import { ROLE } from "./18-identity.js";
/* ================= אתר חדש: צעדי התחלה ================= */
export function renderOnboarding(){
  const card=$("#onbCard"), box=$("#onbSteps"); if(!card) return;
  const steps=[
    {l:"הגדרות אתר",s:"שם האתר והחברה. מופיעים בכותרת, בדוחות ובתעודות הניפוק.",done:!!SITE.custom,act:openSettings,btn:"הגדר"},
    {l:"כתב כמויות",s:"הפריטים והכמויות של הפרויקט מאקסל. מזה נגזר מה הגיע ומה חסר.",done:shared.boq.length>0,act:openBoqImport,btn:"ייבוא"},
    {l:"מלאי פתיחה",s:"מה הגיע לאתר. קליטת תעודות, או ייבוא הצ׳אט של הקבוצה.",done:shared.deliveries.length>0,act:openImport,btn:"ייבוא"},
    {l:"צוות",s:"החשמלאים, העוזרים ומנהלי הצוות. מזה נרשמות היומיות בלחיצה.",done:(shared.CREW||[]).length>0,act:()=>{ showTab("day"); },btn:"לצוות"},
  ];
  const left=steps.filter(s=>!s.done).length;
  const show=ROLE==="owner" && !shared.demoStock && (!shared.issues.length || left>=2);
  card.hidden=!show; if(!show) return;
  box.innerHTML="";
  steps.forEach(st=>{
    const el=document.createElement("div"); el.className="step";
    el.innerHTML='<div class="l">'+esc(st.l)+'</div><span class="p '+(st.done?"p-done":"p-todo")+'">'+(st.done?"בוצע":"פתוח")+'</span><div class="s">'+esc(st.s)+(st.done?'':' <button class="linkbtn" type="button" style="padding:0 6px;min-height:0;font-size:.8rem">'+esc(st.btn)+' ›</button>')+'</div>';
    const b=el.querySelector("button"); if(b) b.onclick=st.act;
    box.appendChild(el);
  });
}
export function __init(){

}
