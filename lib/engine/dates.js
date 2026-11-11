// Date-range parsing for resume experience lines. Handles the formats found in
// the supplied pile: "Jul 2025 – Present", "11/2025 – 01/2026", "Sep '25 – Dec '25",
// "Jan 26 - April 26", "Jan – April 2026", "2016 - 2019", "8 Months",
// "Ongoing", "null", "Not specified", "Dates not provided".
import { REF_DATE } from './config.js';

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const PRESENT_RE = /\b(present|current|currently|now|till date|to date|ongoing)\b/i;

export const toIndex = (d) => d.y * 12 + (d.m - 1);
export const fromIndex = (i) => ({ y: Math.floor(i / 12), m: (i % 12) + 1 });
export const fmt = (d) =>
  d ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.m - 1]} ${d.y}` : '?';

function normYear(y) {
  if (y == null) return null;
  let n = parseInt(String(y).replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(n)) return null;
  if (n < 100) n += 2000;
  return n;
}

// Parse one side of a range. Returns {y, m, monthAssumed} | {present:true} | {m (no year)} | null
function parsePoint(s) {
  s = s.trim().replace(/[.,]$/, '');
  if (!s) return null;
  if (PRESENT_RE.test(s)) return { present: true };
  let m;
  if ((m = s.match(/^(\d{1,2})\s*[\/.-]\s*(\d{4})$/))) return { y: +m[2], m: Math.min(12, Math.max(1, +m[1])) };
  if ((m = s.match(new RegExp(`^${MONTH_RE}\\.?\\s*['’]?\\s*(\\d{2,4})$`, 'i'))))
    return { y: normYear(m[2]), m: monthKey(m[1]) };
  if ((m = s.match(new RegExp(`^${MONTH_RE}\\.?$`, 'i'))))
    return { m: monthKey(m[1]) };
  if ((m = s.match(/^(19|20)\d{2}$/))) return { y: +s, m: 7, monthAssumed: true };
  return null;
}

const monthKey = (w) => MONTHS[w.toLowerCase()] || MONTHS[w.toLowerCase().slice(0, 3)];

/**
 * Parse a date string. Returns
 * { raw, start, end, months, ongoing, issues:[], kind: 'range'|'duration'|'unknown' }
 */
export function parseDateRange(raw, ref = REF_DATE) {
  const res = { raw: (raw || '').trim(), start: null, end: null, months: 0, ongoing: false, issues: [], kind: 'unknown' };
  const s = res.raw;
  if (!s || /^(null|none|n\/a|na|not specified|dates? not provided|-)$/i.test(s)) {
    res.issues.push(s ? `Dates given as "${s}" — tenure unknown` : 'No dates given — tenure unknown');
    return res;
  }
  // Duration only: "8 Months", "1 year"
  let dm = s.match(/^(\d+(?:\.\d+)?)\s*(months?|mos?|years?|yrs?)$/i);
  if (dm) {
    const n = parseFloat(dm[1]);
    res.months = Math.round(/^y/i.test(dm[2]) ? n * 12 : n);
    res.kind = 'duration';
    res.issues.push(`Only a duration ("${s}") is given — counted as ${res.months} months, timing unknown`);
    return res;
  }
  if (/^(ongoing|present|current)$/i.test(s)) {
    res.ongoing = true;
    res.issues.push(`"${s}" with no start date — tenure unknown`);
    return res;
  }
  const parts = s.split(/\s*(?:–|—|-|to|until|till)\s*/i).filter((x) => x.length);
  let a, b;
  if (parts.length >= 2) {
    a = parsePoint(parts[0]);
    b = parsePoint(parts.slice(1).join(' '));
  } else {
    a = parsePoint(parts[0] || s);
    b = a && !a.present ? { ...a } : null;
    if (a && a.monthAssumed) b = { ...a };
  }
  if (!a || !b) {
    res.issues.push(`Could not read dates "${s}"`);
    return res;
  }
  if (b.present) {
    b = { ...ref };
    res.ongoing = true;
  }
  if (a.present) {
    res.issues.push(`Start date missing in "${s}"`);
    return res;
  }
  if (a.y == null && b.y != null) a = { ...a, y: a.m > b.m ? b.y - 1 : b.y }; // "Jan – April 2026"
  if (a.y == null || b.y == null || !a.m || !b.m) {
    res.issues.push(`Could not read dates "${s}"`);
    return res;
  }
  if (a.monthAssumed || b.monthAssumed) res.issues.push('Year-only dates — months assumed (mid-year)');
  let start = { y: a.y, m: a.m };
  let end = { y: b.y, m: b.m };
  const refI = toIndex(ref);
  if (toIndex(end) > refI) {
    res.issues.push(`End date ${fmt(end)} is in the future — capped at ${fmt(ref)}`);
    end = { ...ref };
  }
  if (toIndex(start) > refI) {
    res.issues.push(`Start date ${fmt(start)} is in the future — not counted`);
    res.start = start;
    res.end = end;
    res.kind = 'range';
    return res;
  }
  if (toIndex(start) > toIndex(end)) {
    res.issues.push(`Start after end in "${s}" — dates swapped`);
    [start, end] = [end, start];
  }
  res.start = start;
  res.end = end;
  res.months = toIndex(end) - toIndex(start) + 1;
  res.kind = 'range';
  return res;
}

// Find a trailing date range inside a free-text line (used for non-template resumes).
const RANGE_IN_TEXT = new RegExp(
  `((?:${MONTH_RE}\\.?\\s*['’]?\\s*\\d{2,4}|\\d{1,2}[\\/.]\\d{4}|(?:19|20)\\d{2}))\\s*(?:–|—|-|to)\\s*((?:${MONTH_RE}\\.?\\s*['’]?\\s*\\d{2,4}|\\d{1,2}[\\/.]\\d{4}|(?:19|20)\\d{2}|present|current|now|till date|ongoing))`,
  'i'
);
export function findRangeInText(line) {
  const m = line.match(RANGE_IN_TEXT);
  if (!m) return null;
  return { text: m[0], index: m.index };
}

// Sum months on a timeline, letting the highest weight win where entries overlap.
export function weightedMonths(entries) {
  const grid = new Map();
  let extra = 0;
  for (const e of entries) {
    const w = e.weight ?? 1;
    if (w <= 0) continue;
    const d = e.dates;
    if (!d) continue;
    if (d.kind === 'duration') {
      extra += d.months * w;
      continue;
    }
    if (d.kind !== 'range' || !d.months) continue;
    for (let i = toIndex(d.start); i <= toIndex(d.end); i++) grid.set(i, Math.max(grid.get(i) || 0, w));
  }
  let total = extra;
  for (const v of grid.values()) total += v;
  return total;
}
