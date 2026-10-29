// נתוני דוגמה סינתטיים לבדיקות. בלי נתוני חברה, בלי שמות אמיתיים, בלי מחירים.
const DAY = 86400000, T0 = Date.UTC(2026, 9, 1, 9);
module.exports = {
  deliveries: {
    n1: { supplier: "ספק א", noteNo: "1001", dateText: "01/10/2026", ts: T0, source: "app",
      lines: [ { name: "בורג M8", qty: 100, unit: "יח'", cat: "construction" },
               { name: "כבל סולארי 6", qty: 500, unit: "מ'", cat: "electrical" } ] },
    n2: { supplier: "ספק א", noteNo: "1002", dateText: "05/10/2026", ts: T0 + 4 * DAY, source: "app",
      lines: [ { name: "בורג M8", qty: 50, unit: "יח'", cat: "construction" },
               { name: "כבל סולארי 6", qty: -20, unit: "מ'", cat: "electrical" } ] },
  },
  moves: {
    m1: { item: "בורג M8", qty: 30, dir: "out", who: "צוות 1", ts: T0 + 1 * DAY },
    m2: { item: "בורג M8", qty: 5, dir: "in", who: "צוות 1", ts: T0 + 2 * DAY },
    m3: { item: "מקדחה", qty: 2, dir: "out", who: "צוות 2", ts: T0 + 2 * DAY },
  },
  counts: {
    c1: { item: "כבל סולארי 6", qty: 470, who: "בודק", ts: T0 + 6 * DAY },
  },
};
