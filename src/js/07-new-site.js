/* ================= אתר חדש: צעדי התחלה ================= */
function renderOnboarding(){
  const card=$("#onbCard"), box=$("#onbSteps"); if(!card) return;
  const hasBomStock=deliveries.some(n=>n.source==="bom");
  const steps=[
    {l:"הגדרות אתר",s:"שם האתר, סוגי השולחנות וכמה מכל סוג. מזה נגזר «לכמה שולחנות המלאי מספיק».",done:!!(SITE.custom||kitTypes.some(t=>Number(t.count)>0&&t.customized)),act:openSettings,btn:"הגדר"},
    {l:"כמויות לשולחן (BOM)",s:"מה יוצא לשולחן אחד מכל סוג. ייבוא מאקסל של היצרן, או עריכה ידנית.",done:kitSource!==KIT_SOURCE_DEFAULT||!!(SITE.bomImported),act:()=>openBomImport(),btn:"ייבוא"},
    {l:"מלאי פתיחה",s:"מה הגיע לאתר. קליטת תעודות, או ייבוא הצ׳אט של הקבוצה.",done:deliveries.length>0,act:openImport,btn:"ייבוא"},
    {l:"מאזן פאנלים ראשון",s:"כמה פאנלים באתר, מותקנים, שבורים. מהמאזן השני יש קצב וצפי.",done:panelBal.length>0,act:openPanelBal,btn:"הזן"},
  ];
  const left=steps.filter(s=>!s.done).length;
  const show=ROLE==="owner" && !demoStock && (!issues.length || left>=2);
  card.hidden=!show; if(!show) return;
  box.innerHTML="";
  steps.forEach(st=>{
    const el=document.createElement("div"); el.className="step";
    el.innerHTML='<div class="l">'+esc(st.l)+'</div><span class="p '+(st.done?"p-done":"p-todo")+'">'+(st.done?"בוצע":"פתוח")+'</span><div class="s">'+esc(st.s)+(st.done?'':' <button class="linkbtn" type="button" style="padding:0 6px;min-height:0;font-size:.8rem">'+esc(st.btn)+' ›</button>')+'</div>';
    const b=el.querySelector("button"); if(b) b.onclick=st.act;
    box.appendChild(el);
  });
}

