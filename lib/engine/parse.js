// Resume text → structured profile. Rule-based and deterministic so the same
// code runs in the offline build (Node) and on uploads (browser).
import { normalizeText, lines as toLines, isBullet, stripBullet, splitList, detectArtifacts } from './text.js';
import { parseDateRange, findRangeInText, weightedMonths } from './dates.js';

// Section aliases. The supplied pile uses one template; aliases cover other
// common resume layouts so a new upload still parses.
const SECTION_ALIASES = [
  ['experience', /^(work |professional |relevant |industry )?(experience|employment( history)?|work history|internships?|career history)$/i],
  ['education', /^(education|academic (background|qualifications?|details)|qualifications?|educational qualifications?)$/i],
  ['skills', /^((core|key|technical|professional|design|relevant)\s+)?(skills?|competenc(y|ies)|expertise|skill ?set)$/i],
  ['tools', /^(tools( \/ technologies| & technologies| and technologies)?|technologies|software|tech stack|technical tools)$/i],
  ['summary', /^(professional |career )?(summary|profile|objective|about( me)?|overview)$/i],
  ['projects', /^(projects?( \/ deliverables)?|key projects|academic projects|selected (work|projects)|case studies|portfolio)$/i],
  ['certifications', /^(certifications?( & licenses| and licenses)?|licenses|courses|trainings?|certificates)$/i],
  ['languages', /^languages?( known)?$/i],
  ['awards', /^(awards?( \/ honors| & honors| and honors)?|honors|achievements|accomplishments|publications)$/i]
];

function sectionOf(line) {
  const l = line.replace(/[:：]$/, '').trim();
  if (l.length > 40 || isBullet(line)) return null;
  for (const [key, re] of SECTION_ALIASES) if (re.test(l)) return key;
  return null;
}

const SECTION_KIND = {
  experience: 'work', projects: 'project', skills: 'skill', tools: 'skill', summary: 'summary',
  certifications: 'cert', education: 'edu', awards: 'award', languages: 'other'
};

// ---------- Experience ----------
function splitHeader(line) {
  // Template: "Role — Company   Dates"
  let role = line, company = '', dateStr = '';
  const parts = line.split(/\s{2,}|\t/);
  if (parts.length >= 2) {
    dateStr = parts[parts.length - 1].trim();
    line = parts.slice(0, -1).join(' ').trim();
  }
  const dash = line.split(' — ');
  if (dash.length >= 2) {
    // Company is the LAST segment: "Senior Consultant — Energy Efficiency — TA Europe GmbH"
    role = dash.slice(0, -1).join(' — ').trim();
    company = dash[dash.length - 1].trim();
  } else {
    role = line;
  }
  if (!dateStr) {
    const r = findRangeInText(line);
    if (r) {
      dateStr = r.text;
      role = line.slice(0, r.index).replace(/[|,–—-]\s*$/, '').trim();
    }
  }
  return { role, company, dateStr };
}

function looksLikeEntryHeader(line) {
  if (isBullet(line)) return false;
  if (/ — /.test(line) && (/\s{2,}|\t/.test(line) || findRangeInText(line))) return true;
  if (/ — /.test(line) && line.length < 140) return true;
  return !!findRangeInText(line) && line.length < 140;
}

function parseExperience(ls) {
  const entries = [];
  let cur = null;
  for (const line of ls) {
    if (looksLikeEntryHeader(line)) {
      const { role, company, dateStr } = splitHeader(line);
      cur = { role, company, dateRaw: dateStr, dates: parseDateRange(dateStr), bullets: [] };
      entries.push(cur);
    } else if (cur) {
      cur.bullets.push(stripBullet(line));
    } else {
      cur = { role: stripBullet(line), company: '', dateRaw: '', dates: parseDateRange(''), bullets: [] };
      entries.push(cur);
    }
  }
  return entries;
}

// ---------- Education ----------
const DEGREE_LEVELS = [
  ['phd', /\b(ph\.?\s?d|doctorate)\b/i],
  ['master', /\b(m\.?\s?tech|m\.?\s?e\.?|m\.?\s?sc|m\.?\s?s\.?|m\.?\s?a\.?|m\.?\s?des|mba|pgdm|pgdsm|mbm|master'?s?|post ?graduate|pg diploma|dual m\.sc)\b/i],
  ['bachelor', /\b(b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|b\.?\s?a\.?|b\.?\s?des|bca|bba|bms|b\.?\s?com|bachelor'?s?)\b/i],
  ['certificate', /\b(certificate|certification|diploma)\b/i],
  ['school', /\b(hsc|ssc|sslc|hse|sse|class\s+x{1,2}i*|xii|x\b|higher secondary|intermediate|pre[- ]?university|cbse|madhymik|12th|10th|high school|secondary)\b/i]
];
// A line that *starts* like a degree is a new entry even if it names a university.
const DEGREE_START = /^(b\.?\s?(tech|e|sc|a|des|com)\b|m\.?\s?(tech|sc|des)\b|m\.(e|a|s)\.?[\s,]|bachelor|master|mba|ph\.?d|diploma|post ?graduate|pg |pgd|dual m|class\s|higher secondary|hsc|ssc|sslc|intermediate|pre[- ]?university)/i;
const GRADE_RE = /^(c?gpa|ogpa|cgpi|percentage|score|grade)\b|^\d+(\.\d+)?\s*(%|cgpa)|^(focus|specialization|coursework)\s*:/i;
const INSTITUTION_RE = /(universit|institut|college|school|iit\b|nit\b|iiit|academy|vidyalaya|polytechnic|coursera|udemy|board|campus)/i;

const FIELD_RULES = [
  ['environmental', /(environment|sustainab|ecolog|climate|energy and environmental|energy & environmental|renewable energy, energy efficiency)/i],
  ['design', /(design|b\.?\s?des|m\.?\s?des|hci|human[- ]computer|interaction|ux|communication design|fashion)/i],
  ['computing', /(computer|information (science|technology)|\bit\b|software|artificial intelligence|machine learning|bca|data science|electronics)/i],
  ['stem', /(chemical|mechanical|civil|biotech|chemistry|automobile|automotive|thermal|physics|engineering|science|manufacturing|zoology|botany)/i],
  ['business', /(mba|business|management|commerce|finance|economics|bba|bms)/i],
  ['arts', /(arts|journalism|mass communication|multimedia|humanities)/i]
];

function eduField(text) {
  for (const [k, re] of FIELD_RULES) if (re.test(text)) return k;
  return 'other';
}
function eduLevel(text) {
  for (const [k, re] of DEGREE_LEVELS) if (re.test(text)) return k;
  return 'other';
}

function parseEducation(ls) {
  const out = [];
  let cur = null;
  for (const raw of ls) {
    const line = stripBullet(raw);
    if (cur && GRADE_RE.test(line)) {
      cur.grade = cur.grade ? `${cur.grade}; ${line}` : line;
      continue;
    }
    const hasYear = /(19|20)\d{2}/.test(line);
    if (cur && !cur.institution && (INSTITUTION_RE.test(line) || hasYear) && !DEGREE_START.test(line)) {
      cur.institution = line.replace(/,\s*((?:[A-Za-z]{3,9}\s*|\d{1,2}\/)?(19|20)\d{2}.*)$/, '').replace(/,\s*(expected|completed)\b.*$/i, '').trim();
      const y = line.match(/((?:[A-Za-z]{3,9}\s*|\d{1,2}\/)?(19|20)\d{2}(?:\s*[–-]\s*(?:[A-Za-z]{3,9}\s*|\d{1,2}\/)?((19|20)\d{2}|present))?)/i);
      cur.years = y ? y[1] : '';
      continue;
    }
    cur = { degree: line, institution: '', years: '', grade: '' };
    out.push(cur);
  }
  for (const e of out) {
    e.level = eduLevel(e.degree);
    e.field = eduField(`${e.degree}`);
  }
  return out;
}

// ---------- Skills ----------
function parseSkills(ls) {
  const groups = {};
  for (const raw of ls) {
    const line = stripBullet(raw);
    const m = line.match(/^([A-Za-z /&]{3,30}):\s*(.+)$/);
    if (m) {
      const k = m[1].trim();
      groups[k] = [...(groups[k] || []), ...splitList(m[2])];
    } else {
      groups.General = [...(groups.General || []), ...splitList(line)];
    }
  }
  return groups;
}

// ---------- Projects ----------
function parseProjects(ls) {
  const out = [];
  let cur = null;
  for (const raw of ls) {
    if (isBullet(raw)) {
      if (!cur) {
        cur = { title: '', description: '', bullets: [] };
        out.push(cur);
      }
      cur.bullets.push(stripBullet(raw));
      continue;
    }
    const line = raw.trim();
    if (!cur) {
      cur = { title: line, description: '', bullets: [] };
      out.push(cur);
    } else if (!cur.description && !cur.bullets.length && (line.length > 50 || /\.$/.test(line))) {
      cur.description = line;
    } else if (!cur.description && !cur.bullets.length && line.length <= 36 && (line.length <= 20 || cur.title.length <= 20)) {
      cur.title = `${cur.title} — ${line}`;
    } else {
      cur = { title: line, description: '', bullets: [] };
      out.push(cur);
    }
  }
  return out;
}

// ---------- Claimed experience in summary ----------
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function claimedYears(text) {
  if (!text) return null;
  const re = /(?:(over|more than|close to|nearly|almost|around|about)\s+)?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s*(\+)?\s*(?:years?|yrs?)\b/i;
  const m = text.match(re);
  if (!m) return null;
  const n = WORD_NUM[m[2].toLowerCase()] ?? parseFloat(m[2]);
  return { years: n, text: m[0].trim() };
}

// ---------- Main ----------
export function parseResume(rawText, meta = {}) {
  const text = normalizeText(rawText);
  const profile = {
    id: meta.id || 'upload',
    fileName: meta.fileName || '',
    name: '',
    headline: '',
    summary: '',
    experience: [],
    education: [],
    skills: {},
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    claimed: null,
    totalMonths: 0,
    textLength: text.length,
    rawText: text,
    structured: false,
    issues: [], // {level:'error'|'warning'|'info', code, message}
    corrections: []
  };
  const issue = (level, code, message) => profile.issues.push({ level, code, message });

  if (text.replace(/\s/g, '').length < 30) {
    issue('error', 'EMPTY', 'No readable text could be extracted from this file (empty document, image-only scan, or unsupported format). It cannot be scored — open the original to review manually.');
    return profile;
  }

  const ls = toLines(text);
  const sections = { _head: [] };
  let cur = '_head';
  let foundSections = 0;
  for (const l of ls) {
    const s = sectionOf(l);
    if (s) {
      cur = s;
      foundSections++;
      sections[cur] = sections[cur] || [];
      continue;
    }
    (sections[cur] = sections[cur] || []).push(l);
  }
  profile.structured = foundSections >= 2;

  const head = sections._head || [];
  if (head.length) {
    profile.name = head[0].length <= 40 ? head[0] : '';
    profile.headline = head.find((h, i) => i > 0 && h.length < 90) || (profile.name ? '' : head[0]);
  }
  profile.summary = (sections.summary || []).join(' ');
  profile.experience = parseExperience(sections.experience || []);
  profile.education = parseEducation(sections.education || []);
  profile.skills = { ...parseSkills(sections.skills || []) };
  if (sections.tools) profile.skills['Tools / Technologies'] = parseSkills(sections.tools).General || [];
  profile.projects = parseProjects(sections.projects || []);
  profile.certifications = (sections.certifications || []).map(stripBullet);
  profile.languages = splitList((sections.languages || []).join(', '));
  profile.awards = (sections.awards || []).map(stripBullet);

  // Fallback for resumes whose layout we could not segment.
  if (!profile.structured) {
    issue('warning', 'UNSTRUCTURED', 'Could not detect standard resume sections — scored from the full text with lower confidence. Experience dates were searched line by line.');
    const guessed = parseExperience(ls.filter((l) => findRangeInText(l) || isBullet(l)));
    profile.experience = guessed.filter((e) => e.dates.kind === 'range');
  }

  profile.claimed = claimedYears(profile.summary) || (profile.structured ? null : claimedYears(text));

  // Experience checks
  if (!profile.experience.length) issue('info', 'NO_EXPERIENCE', 'No work experience entries found (fresher, or projects only).');
  profile.experience.forEach((e) => {
    for (const msg of e.dates.issues) issue('warning', 'DATE', `${e.role || 'Entry'}${e.company ? ` @ ${e.company}` : ''}: ${msg}`);
  });
  profile.totalMonths = Math.round(weightedMonths(profile.experience.map((e) => ({ dates: e.dates, weight: 1 }))));

  if (profile.claimed && profile.totalMonths) {
    const diff = profile.claimed.years - profile.totalMonths / 12;
    if (Math.abs(diff) >= 1.5)
      issue('info', 'CLAIM_MISMATCH', `Summary claims "${profile.claimed.text}" but dated roles add up to ${(profile.totalMonths / 12).toFixed(1)} years.`);
  }
  if (!profile.education.length) issue('warning', 'NO_EDUCATION', 'No education section found.');
  if (text.length < 700) issue('warning', 'SHORT', `Very short resume (${text.length} characters) — limited evidence, score may understate the candidate.`);
  for (const a of detectArtifacts(text)) issue('info', 'ARTIFACT', a);

  return profile;
}

// Build scoring segments (each piece of text tagged with where it came from).
export function segmentsOf(p) {
  const segs = [];
  const add = (kind, text, ref) => text && segs.push({ kind, text, ref });
  if (p.headline) add('summary', p.headline, 'Headline');
  if (p.summary) add('summary', p.summary, 'Summary');
  p.experience.forEach((e, i) => {
    const ref = `${e.role}${e.company ? ` — ${e.company}` : ''}`;
    add(e.isProject ? 'project' : 'work', ref, ref);
    e.bullets.forEach((b) => add(e.isProject ? 'project' : 'work', b, ref));
  });
  p.projects.forEach((pr) => {
    add('project', `${pr.title}${pr.description ? '. ' + pr.description : ''}`, pr.title);
    pr.bullets.forEach((b) => add('project', b, pr.title));
  });
  for (const [g, items] of Object.entries(p.skills)) add('skill', items.join(', '), `Skills · ${g}`);
  p.certifications.forEach((c) => add('cert', c, 'Certification'));
  p.education.forEach((e) => add('edu', `${e.degree} ${e.institution}`, 'Education'));
  p.awards.forEach((a) => add('award', a, 'Award'));
  if (!p.structured && p.rawText) add('other', p.rawText.slice(0, 20000), 'Resume text');
  if (p.languages.length) add('other', p.languages.join(', '), 'Languages');
  return segs;
}
