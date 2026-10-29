// נקודת הכניסה: מריץ את __init של כל קובץ לפי הסדר הישן, ואז מציב את מה שהם מייצאים על window
// (כך שהכפתורים ב-HTML, הבדיקות והמסוף ממשיכים לקרוא לפונקציות בשמן).
import * as m0 from "./core.js";
import * as m1 from "./01-stock.js";
import * as m2 from "./02-concrete.js";
import * as m3 from "./03-kit.js";
import * as m4 from "./04-contractors.js";
import * as m5 from "./05-panels.js";
import * as m6 from "./06-alerts.js";
import * as m7 from "./07-new-site.js";
import * as m8 from "./08-settings.js";
import * as m9 from "./09-doc-scanner.js";
import * as m10 from "./10-barcode.js";
import * as m11 from "./11-daylog.js";
import * as m12 from "./12-ui-cleanup.js";
import * as m13 from "./13-purchasing.js";
import * as m14 from "./14-cba.js";
import * as m15 from "./15-weekly-report.js";
import * as m16 from "./16-status.js";
import * as m17 from "./17-eta.js";
import * as m18 from "./18-identity.js";
import * as m19 from "./19-site-build.js";
const mods=[m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19];
for (const m of mods) m.__init();
for (const m of mods) for (const k in m) if (k !== "__init") window[k] = m[k];
