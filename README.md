# Resume Ranker — Growth For Impact (Software Engineering Assignment)

A prototype that **ingests** 47 resumes and 2 job descriptions, **extracts** job-relevant information, **classifies** each resume as LCA / UI/UX / Both / Neither / Uncertain, and **ranks** resumes separately for each role with a **traceable explanation** of every score. It is built for a non-technical HR team: open the link, click a candidate, read why they rank where they do, or upload a new resume to see where it lands.

- **Live prototype:** `https://<your-project>.vercel.app` ← *paste your Vercel URL here after deploying (steps below)*
- **Stack:** Next.js 14 (static export) + a plain-JavaScript scoring engine shared by the offline build and the browser. No server, database or API key, so it runs on Vercel's free tier.
- **Roles:** JD1 *LCA Consultant* (Chennai, onsite) · JD2 *UI/UX Design Intern* (remote)

---

## Contents
1. [Quick start](#1-quick-start)
2. [Deploy to Vercel (free)](#2-deploy-to-vercel-free)
3. [Using the prototype (HR guide)](#3-using-the-prototype-hr-guide)
4. [Methodology](#4-methodology)
5. [Data clean-up](#5-data-clean-up)
6. [Results on the supplied pile](#6-results-on-the-supplied-pile)
7. [Design decisions & trade-offs](#7-design-decisions--trade-offs)
8. [Limitations & next steps](#8-limitations--next-steps)
9. [Project structure](#9-project-structure)
10. [How AI was used and what was checked by hand](#10-how-ai-was-used-and-what-was-checked-by-hand)

---

## 1. Quick start

Requires Node.js 18+.

```bash
npm install
npm run build        # 1) parses data/resumes/*.docx → public/data/profiles.json  2) next build → out/
npm start            # serves out/ at http://localhost:3000
# or, for development with hot reload:
npm run data && npm run dev
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run data` | Re-extracts all resumes and applies reviewer corrections (`data/review/overrides.json`) |
| `npm run report` | Writes `data/output/rankings.csv` (+ `_brief`) and `summary.md` (+ `_brief`) |
| `npm run audit` | Regenerates `data/review/AUDIT_LOG.md` (the clean-up trail) |
| `npm run test:engine` | Engine tests: date formats, non-template resumes, empty file |
| `npm run explain -- HM lca` | Prints the full score breakdown with quoted evidence for one candidate |

## 2. Deploy to Vercel (free)

The app is a fully static site (`output: 'export'`), so it deploys on the Hobby plan without configuration.

**Option A: GitHub + Vercel dashboard (recommended for HR handover)**
1. Unzip, `git init`, commit, and push to a new GitHub repository.
2. On vercel.com: **Add New → Project → Import** the repository. Vercel detects Next.js automatically.
3. Leave the defaults (Build command `npm run build`) and click **Deploy**.
4. Copy the `*.vercel.app` URL into the submission form and at the top of this README.

**Option B: Vercel CLI**
```bash
npm i -g vercel
vercel          # first run links/creates the project
vercel --prod   # production deployment → prints the URL
```

## 3. Using the prototype (HR guide)

| Where | What you can do |
|---|---|
| **LCA Consultant / UI/UX Design Intern tabs** | The job profile (key requirements, link to the full JD) and its ranked list. Each row shows rank, score, fit band, 4 must-have dots, relevant experience, the top evidence, and data-quality flags. |
| **Filters & sorting** | Search (ID, headline, skill, evidence) · show only resumes classified for this role or all 47 · fit band · minimum relevant experience · minimum must-haves met · sort by score, relevant experience, must-haves or total experience (click headers to reverse). |
| **Experience bar toggle (LCA)** | The brief says the LCA role is "4–6 years" but JD1 says "2 to 3 years". The default uses the JD text; one click re-ranks against 4–6 yrs. |
| **Candidate panel (click a row)** | Scores and ranks for both roles · classification and its reason · **"Why this score"**, with each criterion's points and the quoted resume lines behind them · must-haves ✓/✗ and gaps · the extracted profile (experience with core/adjacent tags, education, skills, projects, certifications) · **Data quality** (warnings, reviewer notes, corrections shown as before → after) · raw extracted text · links to open the rendered resume or download the original. |
| **All resumes tab** | Every resume with both scores and its classification, filterable by class, weak matches, or resumes with warnings/corrections. |
| **＋ Upload a resume** | Drop a `.docx`, `.pdf` (with a text layer) or `.txt`. It is extracted and scored **in the browser** with the same engine and ranked within the pile (e.g. "#2 of 48 for LCA"). It then appears in every list with a **NEW** badge. Uploads persist in that browser (localStorage) and can be removed. Unreadable files (image-only PDFs, empty documents) are added with a clear error instead of a misleading 0. |
| **Try it** | `samples/` has two fictional test resumes: `sample_new_uiux_resume.docx` (lands around #6 for UI/UX) and `sample_new_lca_resume.pdf` (lands around #2 for LCA). |
| **Export CSV** | Downloads the current rankings with scores, ranks, fit, must-haves, experience, warnings and source file. |
| **Method tab** | The rubric, weights, rules and limitations, rendered from the same code that scores. |

## 4. Methodology

### 4.1 Pipeline

```
 .docx/.pdf/.txt ──► text ──► normalise ──► section parser ──► structured profile ──► reviewer overrides ──► scorer (per role) ──► classify ──► rank
   (mammoth/pdf.js)         (dashes, quotes,  (experience, edu,   (roles, dates, months,   (data/review/         (rubric × evidence,   (both scores)  (per role,
                             spaced hyphens)   skills, projects…)  claims, issues)           overrides.json)       must-haves, gate)                  ties → rel. exp)
```

- **Offline (build time):** `scripts/build-data.mjs` extracts the 47 resumes, writes a rendered HTML copy of each (so reviewers can read the original in the browser), parses them, applies reviewer corrections, and writes `public/data/profiles.json`.
- **Online (browser):** the app loads the profiles and **scores them live**, which is what makes the experience-bar toggle and uploads possible. Uploaded files go through the same `parseResume → evaluate → rank` functions as the pile.

### 4.2 Extraction (`lib/engine/parse.js`)
- **Sections:** headers are matched against aliases (Experience / Work Experience / Employment…, Education, Skills, Tools, Summary, Projects, Certifications, Languages, Awards). The supplied pile uses one template; the aliases cover common other layouts. If fewer than two sections are found, the resume is flagged **UNSTRUCTURED** and scored from full text with a warning.
- **Experience entries:** `Role — Company   Dates` lines, or any line containing a date range (fallback). Bullets attach to the entry above.
- **Dates (`lib/engine/dates.js`):** handles `Jul 2025 – Present`, `11/2025 – 01/2026`, `Sep '25`, `Jan 26`, `Jan – April 2026`, year-only (month assumed mid-year, flagged), `8 Months` (duration only, flagged), and `Ongoing` / `null` / `Not specified` (tenure unknown, flagged). Future end dates are capped at the snapshot date (**Nov 2026**, fixed for reproducibility).
- **Tenure:** months are laid on a timeline and **overlaps are counted once** (e.g. two concurrent IIT roles).
- **Education:** degree level (PhD / master / bachelor / certificate / school) and field (environmental / design / computing / STEM / business / arts).
- **Claimed experience:** "3+ years", "over 4 years", "close to 4 years" and similar in the summary are captured. A mismatch of ≥ 1.5 yrs with dated roles is shown as an info note.
- **Issue detection:** empty file (error), date problems, missing sections, very short resume, and anonymisation artefacts (see §5).

### 4.3 Scoring (`lib/engine/rubrics.js`, `lib/engine/score.js`)
Each role has a **100-point rubric derived line by line from its JD**. Each criterion produces a 0–1 score × its weight, and lists the **resume lines** that earned it.

**Evidence weighting:** the same keyword is worth more when it describes work done than when it is only listed:

| Experience | Projects | Unstructured text | Skills | Summary / Certifications | Education / Awards |
|---|---|---|---|---|---|
| ×1.0 | ×0.9 | ×0.7 | ×0.6 | ×0.5 | ×0.4 |

**JD1 — LCA Consultant**

| Criterion | Pts | JD source | How it is scored |
|---|---|---|---|
| Hands-on LCA work | 25 | "build LCI datasets, running LCA studies", "completed at least 03 LCA projects" | Number of LCA work items/projects described in experience or projects (LCA, LCI, cradle-to-gate/grave, EPD, PCF…). Full marks at 4. Only listed in skills/certs → 20%. |
| LCA software | 20 | "hands-on experience using either GaBi or SimaPro" | GaBi/SimaPro described in work = 1.0, in skills = 0.85. Other LCA tools (openLCA, One Click LCA, Umberto, EIME, Air.e) = 0.3–0.4 only. +0.05 per database/method (ecoinvent, ELCD, ReCiPe…), max +0.1. |
| Relevant experience | 20 | "2 to 3 years of experience running LCA projects independently" | Months in LCA roles ×1 + sustainability-adjacent roles (ESG, GHG, EHS, environmental compliance) ×0.5, overlaps merged. Full marks at 3 yrs (JD mode) or 5 yrs (brief mode). |
| ISO 14040/44, data quality & documentation | 12 | ISO 14040/14044, validate & standardise LCI data, document assumptions, audit-ready | Coverage of: ISO 14040/44 (incl. redacted "ISO /"), data collection, validation/QA, LCI, goal & scope / system boundary, documentation, PCR / EN 15804 / Catena-X, sensitivity/hotspots. |
| Operational data, sectors & benchmarking | 10 | plant-level assembly, energy, logistics, suppliers; public benchmarking; manufacturing / construction / healthcare clients | Coverage of those topics. |
| Education | 8 | "Environmental domain highly desired" | Environmental = 1.0, STEM = 0.6, other fields 0.2–0.35. |
| Consulting & preferred extras | 5 | stakeholder management, EPD (preferred), business finance | Coverage. |

**JD2 — UI/UX Design Intern**

| Criterion | Pts | JD source | How it is scored |
|---|---|---|---|
| UI/UX execution | 22 | interfaces for website & job board across devices; hi-fi prototypes & specs | Coverage of wireframing, prototyping, hi-fi UI, user flows, UI design, interaction design, responsive, design systems, hand-off, landing pages. |
| User research & user psychology | 20 | **mandatory** "great at understanding user psychology", conduct user research | Coverage of user research, interviews, personas, usability testing, journey maps, heuristics, IA, A/B tests, accessibility, behaviour / cognitive load / friction, competitive analysis. |
| Figma & prototyping tools | 13 | "high-fidelity prototypes … using Figma" | Figma = 0.7–0.75, + 0.08 per extra tool (Framer, XD, ProtoPie, FigJam, Miro, Maze…). No Figma → max 0.35. |
| Visual craft & attention to detail | 10 | **mandatory** "great aesthetic sense", "an eye for detail" | Coverage of visual design, typography, hierarchy/layout/grid, colour, brand/visual identity, consistency, motion. |
| Relevant projects | 17 | 90-day goals: revamp the website, build the job board | 55% number of design roles/projects (full at 5) + 45% relevance: job board / hiring / careers, website / redesign, platforms / marketplaces, dashboards / SaaS, sustainability / impact, search & filters. |
| Experience level & education fit | 13 | "0-1 year of experience"; recent grads welcome | 70% experience fit (0–15 months = 1.0, ≤ 3 yrs 0.9, ≤ 5 yrs 0.8, > 5 yrs 0.7 "may be over-qualified"; freshers with projects 0.7) + 30% education (design 1.0, computing 0.75…). Graphic-design / front-end titles count at half weight. |
| Collaboration, experimentation & mission | 5 | cross-functional, critiques, "without fear of experimentation", remote, sustainability | Coverage. |

**Adjustments after summing the criteria:**
1. **Domain gate (×0.5):** applies when the resume never describes hands-on work in the discipline (no LCA study, or no UI/UX work, in experience/projects). Without it, generic words like "stakeholder", "data validation" or "dashboard" would lift off-profile resumes.
2. **Must-have penalty (−8% each):** 4 must-haves per role. LCA: relevant experience ≥ bar, GaBi or SimaPro, ≥ 3 LCA studies evidenced, ISO 14040/44. UI/UX: Figma, user research/psychology, prototyping, visual craft. A missing must-have hurts the score but doesn't zero it, so a reviewer can still see a promising near-miss.

The candidate panel shows the arithmetic, e.g. `Sum of criteria 70.1 × 0.84 (2 must-haves unmet) = 58.9`.

**Fit bands:** Strong ≥ 70 · Good ≥ 55 · Moderate ≥ 40 · Weak < 40.

### 4.4 Classification (`classify()` in `score.js`)
| Label | Rule |
|---|---|
| **Both** | LCA ≥ 40 **and** UI/UX ≥ 40 |
| **Neither** | both scores < 8 |
| **LCA** or **UI/UX** | the higher score leads by ≥ 5 pts **and** ≥ 30% of itself. Tagged **weak** when the leading score is below 40 (e.g. an ESG analyst with no hands-on LCA) |
| **Uncertain** | scores too close to call, or the file could not be read |

### 4.5 Ranking
Every resume is ranked on **both** roles (so HR can still spot a cross-over). Order: score, then relevant experience, then ID. The rank shown is the position among the whole pile, so filtering never changes a candidate's rank.

## 5. Data clean-up

The brief warns that "not every resume would be scraped correctly". This is how that was handled. The full trail is in **`data/review/AUDIT_LOG.md`**.

**Process**
1. Ran the automatic extractor, then dumped every record (`scripts/dump.mjs`) and **compared each of the 47 against its source resume**: headline, every role / company / date / month count, education rows, projects and claims.
2. **Generalisable errors → fixed in the parser** (so uploads benefit too):
   - role/company split on the wrong em dash (VM)
   - "MS Ramaiah University" read as an MS degree (TM)
   - MM/YYYY left inside institution names (MS)
   - date hyphens glued to words by the normaliser
   - plural "Life Cycle Assessments" not detected (VG was wrongly "no hands-on LCA")
   - freelance graphic design counted as 5 years of UX (AL)
3. **Record-specific errors → `data/review/overrides.json`**, each with a reason, shown in the UI as *before → after*:
   - 4 undated "Independent Product Case Study" entries reclassified from jobs to portfolio projects (FT)
   - a project title split from its project merged back (DVJ)
   - a company name with conversion spacing fixed ("S K ILLS AN D TOOLS")
   - a future internship end date normalised (FK)
4. **Reviewer notes (18):** context that changes no data, e.g. "summary years claim redacted ('over 2.s'), ignored rather than guessed", "PwC role has no start date, not counted", "GaBi/SimaPro only in the skills list".
5. **Evidence spot-checks** (`npm run explain -- <ID> lca|uiux`) found keyword false positives, which were removed from the rubric:
   - "emission inventory" counted as LCI
   - "building strong foundations" counted as construction
   - "GHG accounting" counted as business finance
   - "research paper" counted as benchmarking

**Dataset issues found**
- **1 empty file** (`anonymized_resume_1793685080327.docx`, no text, images or tables). It stays in the pile as *Uncertain* with an explicit "ask the candidate to resend" note.
- **Anonymisation artefacts:** ISO standard numbers are stripped everywhere ("ISO /s", "ISO :2006"), as are some numbers and words ("over 2.s", "Scope s", "Led ion"). They are detected and flagged in the candidate panel. "ISO /" in an LCA sentence is accepted as ISO 14040/44 evidence. Redacted figures are never guessed.
- **10+ date formats**, including `null`, `Not specified`, `Dates not provided`, `Ongoing`, duration-only and future dates. All are parsed or flagged.
- **JD inconsistency:** 4–6 yrs (brief) vs 2–3 yrs (JD1). Both are supported via the toggle.
- **Overlapping roles** (concurrent jobs/internships): counted once.

## 6. Results on the supplied pile

**Classification (JD experience bar):** LCA **20** (10 credible + 10 weak) · UI/UX **24** (23 + 1 weak) · Neither **2** · Uncertain **1** (empty file) · Both **0**.

**LCA Consultant: top 10** (`data/output/summary.md`)

| # | ID | Headline | Score | Fit | Must-haves |
|---|---|---|---|---|---|
| 1 | HM_1793682784257 | LCA Analyst | 92.5 | Strong | 4/4 |
| 2 | PW_1793682784228 | Project Associate 1 (CSIR NEERI) | 90.4 | Strong | 4/4 |
| 3 | TM_1793682784495 | Sustainability Engineer | 82.6 | Strong | 4/4 |
| 4 | MS_1793682784442 | Sustainability & Compliance Consultant | 76.0 | Strong | 3/4 |
| 5 | SRK_1793682784455 | Associate LCA Consultant | 74.6 | Strong | 3/4 |
| 6 | SS_1793682784470 | Engineer, Energy Efficiency & Climate Change | 73.2 | Strong | 3/4 |
| 7 | NP_1793682784325 | Senior Engineer – R&D | 66.9 | Good | 3/4 |
| 8 | RR_1793682784428 | LCA Associate Consultant | 58.9 | Good | 2/4 |
| 9 | VM_1793682784520 | Energy & Sustainability Consultant | 55.5 | Good | 2/4 |
| 10 | UI_1793682784506 | Sustainability Consultant / Operations In-charge | 46.2 | Moderate | 2/4 |

Reading the top of the list:
- **HM** has 4 yrs as an LCA Analyst, SimaPro, 40 published EPDs and ISO-compliant reports.
- **PW** has 2.5 yrs of LCA research at CSIR NEERI using GaBi and OpenLCA, with many studies.
- **TM** has 3.8 yrs of SimaPro automotive LCAs.
- **SRK** has the most LCA tenure (4.7 yrs at Mondra) but only OpenLCA, so it misses the GaBi/SimaPro must-have.
- **MS** and **SS** have strong hands-on SimaPro LCA but under 2 yrs of dated relevant experience.

With the brief's **4–6 yr bar**, HM stays #1 and PW stays #2 but drops to 77 (2.5 yrs < 4). SRK rises to #3, TM falls to #5, and VM/UI drop further because their relevant LCA experience is below 4 yrs (`summary_brief.md`).

**UI/UX Design Intern: top 10**

| # | ID | Headline | Score | Fit | Must-haves |
|---|---|---|---|---|---|
| 1 | CG_1793685080278 | UI/UX Designer | 90.5 | Strong | 4/4 |
| 2 | MM_1793685080338 | UI/UX Designer | 88.8 | Strong | 4/4 |
| 3 | AA_1793685080402 | Graphic Designer | 86.2 | Strong | 4/4 |
| 4 | MI_1793685080235 | UI/UX Intern | 81.1 | Strong | 4/4 |
| 5 | AY_1793685080440 | UX/UI Designer | 80.8 | Strong | 3/4 |
| 6 | AS_1793685080379 | Product Designer | 78.8 | Strong | 3/4 |
| 7 | DVJ_1793685080268 | UI/UX Designer | 76.6 | Strong | 3/4 |
| 8 | FK_1793685080451 | UI/UX Designer | 76.4 | Strong | 4/4 |
| 9 | AL_1793685080183 | UI/UX Designer | 75.3 | Strong | 4/4 |
| 10 | APS_1793685080222 | Product Design Intern | 74.7 | Strong | 3/4 |

The design pile is strong overall: 23 of 24 score ≥ 55; the exception is KN, whose resume has no projects or experience. The differences come from depth of research evidence (usability testing, heuristics, IA), internship-level experience, and how relevant the projects are to a website and job board. For example, AY designed a worker-hiring platform and APS a sustainability dashboard.

Full per-candidate output for both roles: `data/output/rankings.csv` (and the in-app **Export CSV**).

## 7. Design decisions & trade-offs

- **Transparent rules instead of an LLM at scoring time.** HR needs to defend a shortlist. Every point here traces to a JD line and a quoted resume line, results are identical on every run, and there is no API key, cost or data-privacy issue on a free Vercel instance. The trade-off is recall on unusual wording, which is mitigated by synonyms, evidence quotes and the raw-text view.
- **One engine, two runtimes.** `lib/engine` is plain ES modules used by the Node build script and the browser, so an uploaded resume is ranked exactly like the original 47.
- **Static site.** No server functions, so nothing can time out and nothing leaves the reviewer's browser.
- **Soft knock-outs.** Missing a must-have costs 8% instead of disqualifying, and the panel lists what is missing. The final call stays with a human.
- **Reproducibility.** A fixed snapshot date resolves "Present", and reviewer corrections live in a versioned JSON file instead of hand-edited outputs.
- **Errors are first-class.** Unreadable or partial resumes stay visible with a plain-English reason, never silently dropped or scored 0 as if they were weak.

## 8. Limitations & next steps
- Keyword rules can miss synonyms or creative phrasing, and can't judge quality. A designer's aesthetic sense and user-psychology depth (both JD2 mandatory items) need a **portfolio review**.
- "≥ 3 LCA studies" is estimated from described work items, not verified.
- Image-only PDFs need OCR (not run in the browser). They are reported as unreadable.
- Uploads live in one browser's localStorage. A shared store (e.g. Vercel KV) would let a team see each other's uploads.
- Possible next steps:
  - an optional LLM pass to *suggest* corrections that a reviewer accepts into `overrides.json`
  - recruiter feedback on the rankings to recalibrate the weights
  - reviewer accounts with shortlist / reject actions

## 9. Project structure

```
app/                     Next.js app router (page.jsx = main client app, globals.css)
components/              RoleView, AllView, Drawer (candidate panel), UploadModal, MethodView, ui
lib/engine/              Shared scoring engine
  config.js              snapshot date, section weights, classification thresholds, fit bands, penalty
  text.js                normalisation, list splitting, anonymisation-artefact detection
  dates.js               date-range parsing + overlap-aware month counting
  parse.js               resume text → structured profile + issues
  rubrics.js             JD1 / JD2 rubrics (criteria, weights, JD lines, evidence patterns)
  score.js               criterion scoring, gate, must-haves, classification, ranking
  overrides.js           applies reviewer corrections and logs them on the profile
lib/client/extract.js    browser text extraction for uploads (mammoth / pdf.js / txt)
scripts/                 build-data, report, audit-log, dump, explain, test-engine
samples/                 two fictional resumes (.docx, .pdf) to test the upload flow
data/resumes/            the 47 supplied resumes (input)
data/jd/                 the two job descriptions (input)
data/review/             overrides.json (corrections), AUDIT_LOG.md, auto_extraction.json (pre-review)
data/output/             rankings.csv, rankings_brief.csv, summary.md, summary_brief.md
public/data/             profiles.json (cleaned, consumed by the app) + JD texts
public/resumes/          original files + rendered HTML copies for in-browser review
```

## 10. How AI was used and what was checked by hand

This prototype was built with an AI coding assistant, as the brief expects. The AI's output was **not trusted as-is**:
- The extractor's output for all 47 resumes was checked record by record against the source files. Every discrepancy was either fixed in the parser (and re-verified) or recorded in `overrides.json` with a reason (§5, `AUDIT_LOG.md`).
- Scored evidence was spot-checked per candidate. False-positive patterns were removed and the rubric re-run until the quoted evidence actually supported each criterion.
- The rankings were sanity-checked against a manual reading of the resumes. For example, the LCA analyst with 40 EPDs ranks #1, ESG generalists without hands-on LCA are marked *weak*, and the empty file is surfaced, not hidden.
- End-to-end browser tests covered both rankings, the candidate panel, the experience toggle, a `.docx` upload, a `.pdf` upload, persistence after reload, the unreadable-file path, and mobile layout (no horizontal scroll at 390 px).
