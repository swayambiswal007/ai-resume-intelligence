// Offline ingestion: data/resumes/*.docx|pdf|txt → public/data/profiles.json
//  1. extract text (mammoth for .docx) and a rendered HTML copy for reviewers
//  2. parse with the shared engine (lib/engine/parse.js)
//  3. apply human-review corrections from data/review/overrides.json
//  4. write the cleaned profiles + an auto-vs-reviewed diff for the audit trail
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mammoth from 'mammoth';
import { parseResume } from '../lib/engine/parse.js';
import { applyOverrides } from '../lib/engine/overrides.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data/resumes');
const OUT = path.join(ROOT, 'public/data');
const FILES = path.join(ROOT, 'public/resumes/files');
const HTML = path.join(ROOT, 'public/resumes/html');
for (const d of [OUT, FILES, HTML]) fs.mkdirSync(d, { recursive: true });

const overrides = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/review/overrides.json'), 'utf8'));
const idOf = (f) => f.replace(/^anonymized_/, '').replace(/\.[^.]+$/, '');

const htmlPage = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:32px auto;padding:0 20px;line-height:1.5;color:#1d1d1b;background:#fff}h1,h2,h3{font-family:system-ui,sans-serif}p{margin:.35em 0}.empty{padding:24px;border:1px dashed #c33;color:#933;font-family:system-ui}</style></head><body>${body}</body></html>`;

const files = fs.readdirSync(SRC).filter((f) => /\.(docx|txt)$/i.test(f)).sort();
const profiles = [];
const auto = [];
for (const f of files) {
  const id = idOf(f);
  const full = path.join(SRC, f);
  let text = '', html = '';
  const extractionErrors = [];
  try {
    if (/\.docx$/i.test(f)) {
      text = (await mammoth.extractRawText({ path: full })).value;
      html = (await mammoth.convertToHtml({ path: full })).value;
    } else {
      text = fs.readFileSync(full, 'utf8');
      html = `<pre>${text.replace(/</g, '&lt;')}</pre>`;
    }
  } catch (e) {
    extractionErrors.push(`Extraction failed: ${e.message}`);
  }
  fs.copyFileSync(full, path.join(FILES, f));
  fs.writeFileSync(path.join(HTML, `${id}.html`), htmlPage(id, html.trim() ? html : '<div class="empty">This document contains no readable text.</div>'));

  const p = parseResume(text, { id, fileName: f });
  for (const e of extractionErrors) p.issues.unshift({ level: 'error', code: 'EXTRACT', message: e });
  p.source = { file: `/resumes/files/${f}`, html: `/resumes/html/${id}.html` };
  auto.push(JSON.parse(JSON.stringify(p)));
  applyOverrides(p, overrides[id]);
  profiles.push(p);
}

fs.writeFileSync(path.join(OUT, 'profiles.json'), JSON.stringify({ generated: new Date().toISOString(), count: profiles.length, profiles }));
fs.writeFileSync(path.join(ROOT, 'data/review/auto_extraction.json'), JSON.stringify(auto, null, 1));
const corrected = profiles.filter((p) => p.corrections.length).length;
console.log(`Parsed ${profiles.length} resumes → public/data/profiles.json (${corrected} with reviewer corrections)`);
