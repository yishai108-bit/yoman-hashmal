// מסדר מחדש את שורות ה-import של כל מודול ב-src/js לפי מה שהקובץ באמת משתמש בו.
// שם שהקובץ מזכיר (כקוד, לא במחרוזת או בהערה) ולא מגדיר בעצמו, מיובא מהמודול שמייצא אותו.
// שימושי אחרי שמזיזים פונקציה בין קבצים או מוחקים מודול:  node tools/fix-imports.js
const fs = require("fs");
const path = require("path");
const { parseAst } = require("rollup/parseAst");

const D = path.join(__dirname, "..", "src", "js");
const files = fs.readdirSync(D).filter(f => f.endsWith(".js") && f !== "main.js").sort();
const order = fs.readFileSync(path.join(D, "main.js"), "utf8").split("\n").filter(l => l.startsWith("import")).map(l => l.split('"./')[1].split('"')[0]);
for (const f of files) if (!order.includes(f)) order.push(f);

const info = {};
for (const f of files){
  const src = fs.readFileSync(path.join(D, f), "utf8");
  const ast = parseAst(src);
  const exported = new Set(), declared = new Set(), used = new Set();
  const pat = (p, set) => { if (!p) return;
    if (p.type === "Identifier") set.add(p.name);
    else if (p.type === "ObjectPattern") p.properties.forEach(x => pat(x.type === "RestElement" ? x.argument : x.value, set));
    else if (p.type === "ArrayPattern") p.elements.forEach(x => pat(x, set));
    else if (p.type === "RestElement") pat(p.argument, set);
    else if (p.type === "AssignmentPattern") pat(p.left, set); };
  for (const n of ast.body){
    if (n.type === "ExportNamedDeclaration" && n.declaration){
      const d = n.declaration;
      if (d.id) exported.add(d.id.name);
      if (d.declarations) d.declarations.forEach(x => pat(x.id, exported));
    }
  }
  exported.delete("__init");
  // שמות שמוגדרים בתוך פונקציה (כולל פרמטרים), בלי להיכנס לפונקציות פנימיות. בלוקים נחשבים חלק מהפונקציה.
  const declsOf = (fn) => { const s = new Set(); if (fn.params) fn.params.forEach(p => pat(p, s));
    if (fn.type === "FunctionExpression" && fn.id) s.add(fn.id.name);
    (function d(n, top){ if (!n || typeof n.type !== "string") return;
      if (!top && /Function/.test(n.type)){ if (n.type === "FunctionDeclaration" && n.id) s.add(n.id.name); return; }
      if (n.type === "VariableDeclarator") pat(n.id, s);
      if (n.type === "ClassDeclaration" && n.id) s.add(n.id.name);
      if (n.type === "CatchClause") pat(n.param, s);
      if (n.type === "ImportDeclaration") return;
      for (const k of Object.keys(n)){ const v = n[k]; if (Array.isArray(v)) v.forEach(c => d(c, false)); else if (v && typeof v.type === "string") d(v, false); }
    })(fn.type === "Program" ? fn : fn.body, fn.type === "Program");
    return s; };
  const top = declsOf(ast); top.forEach(x => declared.add(x));
  (function walk(n, parent, key, scopes){
    if (!n || typeof n.type !== "string") return;
    if (n.type === "ImportDeclaration") return;
    if (/Function/.test(n.type)) scopes = scopes.concat([declsOf(n)]);
    if (n.type === "Identifier"){
      const skip = (parent && parent.type === "MemberExpression" && key === "property" && !parent.computed)
        || (parent && (parent.type === "Property" || parent.type === "MethodDefinition" || parent.type === "PropertyDefinition") && key === "key" && !parent.computed && !parent.shorthand)
        || (parent && /Label/.test(parent.type));
      if (!skip && !scopes.some(s => s.has(n.name))) used.add(n.name);
      return;
    }
    for (const k of Object.keys(n)){
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, n, k, scopes));
      else if (v && typeof v.type === "string") walk(v, n, k, scopes);
    }
  })(ast, null, null, [top]);
  info[f] = { src, ast, exported, declared, used };
}

const owner = {};
for (const f of order) for (const n of (info[f] ? info[f].exported : [])){
  if (owner[n] && owner[n] !== f) console.error("אזהרה: " + n + " מיוצא גם מ-" + owner[n] + " וגם מ-" + f);
  if (!owner[n]) owner[n] = f;
}

let changed = 0;
for (const f of files){
  const { src, ast, declared, used } = info[f];
  const need = {};
  for (const w of used){
    const m = owner[w];
    if (m && m !== f && !declared.has(w)) (need[m] = need[m] || new Set()).add(w);
  }
  const imports = ast.body.filter(n => n.type === "ImportDeclaration");
  const lines = order.filter(m => need[m]).map(m => 'import { ' + [...need[m]].sort().join(", ") + ' } from "./' + m + '";');
  let out;
  if (imports.length){
    const a = imports[0].start, b = imports[imports.length - 1].end;
    out = src.slice(0, a) + lines.join("\n") + src.slice(b).replace(/^\n?/, lines.length ? "\n" : "");
  } else out = (lines.length ? lines.join("\n") + "\n" : "") + src;
  if (out !== src){ fs.writeFileSync(path.join(D, f), out); changed++; console.log("עודכן: " + f); }
  const missing = [...used].filter(w => !declared.has(w) && !owner[w] && !(w in globalThis) && !/^(window|document|navigator|localStorage|location|history|fetch|Image|Blob|File|FileReader|URL|TextEncoder|TextDecoder|crypto|performance|requestAnimationFrame|cancelAnimationFrame|getComputedStyle|innerWidth|innerHeight|matchMedia|Intl|DOMParser|XMLHttpRequest|HTMLElement|Event|CustomEvent|MutationObserver|ResizeObserver|IntersectionObserver|OffscreenCanvas|createImageBitmap|alert|confirm|prompt|JSZip|BarcodeDetector|structuredClone|ImageData|Path2D|AbortController|Notification|Option|devicePixelRatio|XLSX|ZXing|claude|addEventListener)$/.test(w));
  if (missing.length) console.error("לא מוגדר ב-" + f + ": " + missing.join(", "));
}
if (!changed) console.log("כל ה-import כבר מסודרים.");
