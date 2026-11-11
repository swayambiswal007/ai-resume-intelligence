// Browser-side text extraction for uploaded resumes (.docx, .pdf, .txt).
// Everything stays on the reviewer's machine — nothing is sent to a server.

const PDFJS_VERSION = '3.11.174';
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the PDF reader (network blocked?). Try a .docx instead.'));
    document.head.appendChild(s);
  });
}

async function pdfText(buf) {
  await loadScript(PDFJS_URL);
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { items } = await page.getTextContent();
    // Rebuild lines from glyph positions so section headers / date columns survive.
    const rows = new Map();
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], w: it.width || 0, s: it.str });
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const parts = rows.get(y).sort((a, b) => a.x - b.x);
      let line = '';
      let lastEnd = null;
      for (const p of parts) {
        if (lastEnd != null) line += p.x - lastEnd > 25 ? '   ' : p.x - lastEnd > 1.5 ? ' ' : '';
        line += p.s;
        lastEnd = p.x + p.w;
      }
      out.push(line);
    }
    out.push('');
  }
  return out.join('\n');
}

async function docxText(buf) {
  const mod = await import('mammoth');
  const mammoth = mod.default || mod;
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return res.value;
}

export async function extractText(file) {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (name.endsWith('.docx')) return { text: await docxText(buf), method: 'docx (mammoth)' };
  if (name.endsWith('.pdf')) return { text: await pdfText(buf), method: 'pdf (pdf.js text layer)' };
  if (name.endsWith('.txt') || name.endsWith('.md')) return { text: new TextDecoder().decode(buf), method: 'plain text' };
  if (name.endsWith('.doc')) throw new Error('Legacy .doc files are not supported — save as .docx or PDF and try again.');
  throw new Error('Unsupported file type. Upload a .docx, .pdf or .txt resume.');
}
