// Text clean-up applied to every resume before parsing (offline and in-browser).

export function normalizeText(raw) {
  if (!raw) return '';
  let t = String(raw);
  t = t.replace(/\r\n?/g, '\n');
  t = t.replace(/ /g, ' '); // non-breaking spaces
  t = t.replace(/[‐‑]/g, '-'); // odd hyphens
  t = t.replace(/‒/g, '–');
  t = t.replace(/[‘’ʼ]/g, "'");
  t = t.replace(/[“”]/g, '"');
  t = t.replace(/[​﻿]/g, '');
  t = t.replace(/[ \t]+$/gm, '');
  // "cradle - to - gate" → "cradle-to-gate", "trade - offs" → "trade-offs"
  t = t.replace(/([a-z]) - (?=[a-z]+ - [a-z])/g, '$1-');
  t = t.replace(/([a-z]) - ([a-z])/g, '$1-$2');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

export function lines(t) {
  return t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export const BULLET_RE = /^[•●▪◦\-*–·]\s*/;

export function isBullet(line) {
  return /^[•●▪◦*·]\s*/.test(line) || /^[-–]\s+/.test(line);
}

export function stripBullet(line) {
  return line.replace(BULLET_RE, '').trim();
}

// Split a comma list but not inside parentheses: "MS Office (Excel, Word), SAP"
export function splitList(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';' || ch === '|') && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((x) => x.replace(/\.$/, '').trim()).filter(Boolean);
}

export function snippet(text, index, len = 150) {
  if (text.length <= len) return text;
  const start = Math.max(0, index - Math.floor(len / 3));
  const end = Math.min(text.length, start + len);
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

// Patterns left behind by the anonymisation step (digits / words removed).
// Detected so the reviewer understands odd text instead of trusting it blindly.
export function detectArtifacts(t) {
  const found = [];
  if (/ISO\s*(\/s?\b|:?\s*(and|,|\.|\)|$)|\s\/)/m.test(t) || /ISO\s*\/\s*-/.test(t))
    found.push('ISO standard numbers appear stripped (e.g. "ISO /s" — likely ISO 14040/14044)');
  if (/\b\d+\.s\b|\bover\s+[a-z]{2,}ability\b|\bwith\s+ry\b|\bScope\s+s\b|\bteam of s\b/i.test(t))
    found.push('Some numbers or words look truncated by the anonymisation step — read the original before relying on figures');
  if (/\b(\w)\s(\w{1,2})\s(\w{2,})\s(\w{1,2})\s(\w)\b/.test(t) && /\b[A-Z] [A-Z]{1,2} [A-Z]{2,}/.test(t))
    found.push('Spacing artefacts inside words (e.g. "S K ILLS")');
  return found;
}
