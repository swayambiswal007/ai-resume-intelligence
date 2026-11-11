// Ranking rubrics derived line-by-line from JD1 (LCA Consultant) and JD2
// (UI/UX Design Intern). Each criterion has a weight (all weights sum to 100),
// the JD line it comes from, and the evidence terms it looks for.
//
// Term = [label, regex, weight]. A term's contribution is
//   termWeight × sectionWeight(best place it was found)
// and a "coverage" criterion scores min(1, sum / target).

const t = (label, re, w = 1) => ({ label, re, w });

// ---- Shared vocabularies -------------------------------------------------
export const LCA_CORE = /\b(life[- ]?cycle (assessments?|analys[ie]s|inventor(y|ies)|impacts?)|LCAs?|LCI|cradle[- ]to[- ](gate|grave|cradle)|EPDs?|environmental product declarations?|product carbon footprints?|PCF|product environmental profile|PEP eco-?passport)\b/i;
export const SUSTAIN_ADJ = /\b(sustainab\w*|ESG|GHG|greenhouse|carbon|emissions?|environment(al)?|climate|EHS|decarboni[sz]\w*|BRSR|CDP|EcoVadis|circular|net zero|scope [123]|energy (audit|efficiency)|renewable|pollution|air quality|waste|RoHS|REACH|IMDS|CBAM|effluent|wastewater)\b/i;
export const DESIGN_CORE = /\b(UI|UX|UI\/UX|UX\/UI|user experience|user interface|product design(er)?|interaction design|wireframes?|wireframing|prototyp\w*|figma|usability|design systems?|user flows?|user research)\b/i;
export const DESIGN_ADJ = /\b(graphic design(er)?|visual design(er)?|front[- ]?end|web (design|developer)|app developer|full stack|brand(ing| identity)|creative head|motion graphics|illustration)\b/i;

// ---- JD1: LCA Consultant -----------------------------------------------
export const LCA_RUBRIC = {
  id: 'lca',
  title: 'LCA Consultant',
  subtitle: 'Chennai (onsite) · client of a Pune sustainability consultancy',
  jdFile: 'jd1_lca_consultant.txt',
  coreRe: LCA_CORE,
  adjRe: SUSTAIN_ADJ,
  experienceModes: {
    jd: { label: 'JD text: 2–3 yrs', min: 2, full: 3, note: 'JD1 requires "2 to 3 years of experience running LCA projects independently".' },
    brief: { label: 'Brief: 4–6 yrs', min: 4, full: 5, note: 'The assignment brief describes the LCA role as "4-6 years experience". Use this mode to rank against that bar instead.' }
  },
  criteria: [
    {
      key: 'lca_practice', label: 'Hands-on LCA work', weight: 25, type: 'lcaPractice',
      jd: 'Build LCI datasets, run LCA studies; "completed at least 03 LCA projects"',
      target: 4
    },
    {
      key: 'software', label: 'LCA software (GaBi / SimaPro)', weight: 20, type: 'software',
      jd: '"Hands-on experience using either GaBi or SimaPro software"',
      required: [t('GaBi', /\bgabi\b/i), t('SimaPro', /\bsima ?pro\b/i)],
      transferable: [t('openLCA', /\bopen ?lca\b/i), t('One Click LCA', /\bone ?click ?lca\b/i), t('Umberto', /\bumberto\b/i), t('EIME', /\beime\b/i), t('Air.e LCA', /\bair\.e\b/i), t('Sphera', /\bsphera\b/i), t('LCA for Experts', /lca for experts/i)],
      databases: [t('ecoinvent', /\becoinvent\b/i), t('ELCD', /\belcd\b/i), t('ReCiPe', /\brecipe\b/i), t('BAFU', /\bbafu\b/i), t('GaBi database', /gabi database/i)]
    },
    {
      key: 'experience', label: 'Relevant experience', weight: 20, type: 'experience',
      jd: '"2 to 3 years of experience running LCA projects independently"'
    },
    {
      key: 'standards', label: 'ISO 14040/44, data quality & documentation', weight: 12, type: 'coverage', target: 4,
      jd: 'Follow ISO 14040/14044; validate LCI data; document assumptions; audit-ready models',
      terms: [
        t('ISO 14040/14044', /ISO\s*14040|ISO\s*14044|ISO\s*\/\s*s?\b|ISO\s*\/(?=\s*(-|in|compl|and|,|\)))|\bISO\s*:?\s*2006/i, 1.5),
        t('ISO standards in LCA context', /ISO\s+(LCA|life cycle)|ISO\s*(and|,)\s*ISO|accordance with ISO|compliance with ISO|aligned with[^.]{0,40}ISO|ISO[^.]{0,25}(LCA|PCF|life cycle)/i, 1),
        t('Data collection', /data collection|collected[^.]{0,40}data|gather(ed|ing)[^.]{0,40}data|compiled[^.]{0,30}data/i),
        t('Data validation / QA', /validat\w*[^.]{0,30}data|data validation|quality (control|assessment|assurance)|QA\/QC|accuracy[^.]{0,30}consisten/i),
        t('Life cycle inventory', /life cycle inventor|\bLCI\b|LCI (model|dataset)|inventory model/i),
        t('Goal, scope, system boundary', /system boundar|functional unit|goal and scope|allocation/i),
        t('Documentation / audit-ready', /audit[- ]ready|traceab|documentation|documented/i, 0.7),
        t('PCR / EN 15804 / product rules', /\bPCR\b|EN\s*15804|EN\s*\+A2|catena\s*-?\s*x|PEF\b/i),
        t('Sensitivity / hotspot analysis', /sensitivity analysis|hotspot/i)
      ]
    },
    {
      key: 'domain', label: 'Operational data, sectors & benchmarking', weight: 10, type: 'coverage', target: 4,
      jd: 'Plant-level assembly, energy, logistics, supplier data; public benchmarking; manufacturing/construction/healthcare clients',
      terms: [
        t('Manufacturing / plant data', /manufactur\w*|plant[- ]level|production|assembl(y|ies)/i),
        t('Bill of materials', /\bBOMs?\b|bill of materials/i),
        t('Energy data', /energy (use|consumption|audit|data)|kwh|\bSEC\b/i),
        t('Logistics / transport', /logistic|transport|distribution|supply chain/i),
        t('Supplier engagement', /supplier/i),
        t('Construction / building materials', /construction|buildings?\s(material|typolog|sector|systems?)|\bbuildings\b|cement|concrete|embodied carbon|real estate/i),
        t('Automotive / industrial products', /automotive|vehicle|\bEV\b|\bICE\b|OEM/i, 0.7),
        t('Healthcare / pharma', /healthcare|pharma/i, 0.7),
        t('Benchmarking / literature research', /benchmark|literature|secondary (data|database)|public (data|sources|disclosures)|published (data|studies)|industry reports?/i),
        t('Cross-functional teams', /cross[- ]functional|CFTs?\b/i, 0.7)
      ]
    },
    {
      key: 'education', label: 'Education (environmental domain desired)', weight: 8, type: 'education',
      jd: '"Bachelor\'s or Master\'s (Environmental domain highly desired)"',
      fieldScores: { environmental: 1, stem: 0.6, computing: 0.35, design: 0.2, business: 0.3, arts: 0.2, other: 0.3 }
    },
    {
      key: 'professional', label: 'Consulting & preferred extras', weight: 5, type: 'coverage', target: 3,
      jd: 'Stakeholder management, EPD experience (preferred), business finance basics, multi-tasking, travel',
      terms: [
        t('Client / stakeholder management', /client|stakeholder|customer/i),
        t('EPD experience (preferred)', /\bEPDs?\b|environmental product declaration/i, 1.2),
        t('Consulting role', /consult(ant|ing)/i),
        t('Report writing', /report(s|ing)?\b/i, 0.6),
        t('Business finance basics', /financ(e|ial)|budget|cost (analysis|model|benefit|saving)|OPEX|CAPEX|carbon pricing|(?<!(carbon|ghg|gas|emissions?)\s)accounting\b/i, 0.7),
        t('Fluent English', /english/i, 0.4)
      ]
    }
  ],
  mustHaves: [
    { key: 'exp', label: 'Relevant LCA experience meets the bar' },
    { key: 'software', label: 'GaBi or SimaPro' },
    { key: 'projects', label: '≥ 3 LCA studies evidenced' },
    { key: 'iso', label: 'ISO 14040/44 evidence' }
  ]
};

// ---- JD2: UI/UX Design Intern -----------------------------------------
export const UIUX_RUBRIC = {
  id: 'uiux',
  title: 'UI/UX Design Intern',
  subtitle: 'Remote · Growth For Impact (LinkedIn for sustainability) · ₹10–15k/month',
  jdFile: 'jd2_uiux_intern.txt',
  coreRe: DESIGN_CORE,
  adjRe: DESIGN_ADJ,
  adjTitleCaps: true, // a "Graphic Designer" title stays adjacent even if bullets mention UX
  criteria: [
    {
      key: 'ux_practice', label: 'UI/UX execution', weight: 22, type: 'coverage', target: 6,
      jd: 'Design engaging interfaces for website & job board across devices; hi-fi prototypes & specs',
      terms: [
        t('Wireframing', /wirefram/i),
        t('Prototyping', /prototyp/i),
        t('High-fidelity UI', /high[- ]fidelity|hi-fi/i),
        t('User flows', /user flows?|task flows?|user journeys?/i),
        t('Interface / UI design', /\bUI\b|user interface|interface design|screens?\b/i),
        t('Interaction design', /interaction design|micro-?interactions?/i),
        t('Responsive / multi-device', /responsive|mobile[- ]first|cross[- ]platform|web and mobile|mobile and web|across devices/i),
        t('Design systems / components', /design systems?|component librar|reusable (ui )?components|design tokens|style guide/i),
        t('Developer handoff / specs', /hand-?off|design specifications|specs\b/i, 0.8),
        t('Landing pages / websites', /landing page|website/i, 0.8)
      ]
    },
    {
      key: 'research', label: 'User research & user psychology', weight: 20, type: 'coverage', target: 5,
      jd: 'MANDATORY "great at understanding user psychology"; conduct user research on psychology & behaviour',
      terms: [
        t('User research', /user research|ux research|design research|primary research/i, 1.2),
        t('Interviews / surveys', /interviews?|surveys?/i),
        t('Personas', /personas?/i),
        t('Usability testing', /usability test|user testing|usability feedback|task success/i, 1.2),
        t('Journey mapping', /journey map/i),
        t('Heuristic evaluation', /heuristic/i),
        t('Information architecture', /information architecture|\bIA\b|card sort/i),
        t('A/B testing', /a\/b test/i),
        t('Accessibility', /accessib|WCAG/i),
        t('Behaviour / cognitive load', /behavio(u)?r|cognitive load|psycholog|friction|pain points?|mental model|trust/i, 1.2),
        t('Competitive analysis', /competit(or|ive) analysis/i, 0.7)
      ]
    },
    {
      key: 'tools', label: 'Figma & prototyping tools', weight: 13, type: 'designTools',
      jd: '"Create high-fidelity prototypes and design specifications using Figma"',
      figma: t('Figma', /\bfigma\b/i),
      extras: [t('Framer', /\bframer\b/i), t('Adobe XD', /adobe xd/i), t('ProtoPie', /protopie/i), t('Principle', /\bprinciple\b/i), t('Sketch', /\bsketch\b(?! ?wizard)/i), t('FigJam', /figjam/i), t('Miro', /\bmiro\b/i), t('Maze', /\bmaze\b/i), t('Penpot', /penpot/i), t('Spline / Rive', /\b(spline|rive)\b/i)]
    },
    {
      key: 'visual', label: 'Visual craft & attention to detail', weight: 10, type: 'coverage', target: 4,
      jd: 'MANDATORY "great aesthetic sense", "an eye for detail"; cohesive design language & visual identity',
      terms: [
        t('Visual design', /visual design|visually|aesthetic/i),
        t('Typography', /typograph/i),
        t('Visual hierarchy / layout', /visual hierarchy|hierarchy|layout|grid|spacing/i),
        t('Colour', /colou?r/i, 0.7),
        t('Brand identity / design language', /brand|visual identity|design language/i),
        t('Consistency / detail', /consisten|attention to detail|detail-oriented|polish/i),
        t('Motion / illustration', /motion|animation|illustrat/i, 0.6)
      ]
    },
    {
      key: 'portfolio', label: 'Relevant projects (website / job board / platforms)', weight: 17, type: 'portfolio',
      jd: '90-day goals: revamp the entire website; build the job board',
      relevance: [
        t('Job board / hiring / careers', /job board|hiring|recruit|career|jobs?\b|talent|worker/i, 1.5),
        t('Website redesign', /website|landing page|web app|redesign/i),
        t('Platform / marketplace / community', /platform|marketplace|community|social|network|discovery|listing/i),
        t('Dashboards / SaaS', /dashboard|saas|admin/i),
        t('Sustainability / impact', /sustainab|climate|impact|green|eco/i, 1.2),
        t('Search & filters', /search|filter|onboarding/i, 0.8)
      ]
    },
    {
      key: 'fit', label: 'Experience level & education fit', weight: 13, type: 'designFit',
      jd: '"Open to candidates with 0-1 year of experience"; recent graduates welcome',
      eduScores: { design: 1, computing: 0.75, arts: 0.6, stem: 0.5, business: 0.5, environmental: 0.4, other: 0.5 }
    },
    {
      key: 'collab', label: 'Collaboration, experimentation & mission', weight: 5, type: 'coverage', target: 3,
      jd: 'Cross-functional work, design critiques, creative experimentation, remote team, sustainability mission',
      terms: [
        t('Cross-functional collaboration', /cross[- ]functional|collaborat|developers|engineers|stakeholders/i),
        t('Feedback / critique / iteration', /feedback|critique|iterat/i),
        t('Experimentation / creativity', /experiment|creativ|explor/i),
        t('Remote / agile teams', /remote|agile|sprint/i, 0.7),
        t('Sustainability interest', /sustainab|climate|impact/i)
      ]
    }
  ],
  mustHaves: [
    { key: 'figma', label: 'Figma' },
    { key: 'research', label: 'User research / psychology evidence' },
    { key: 'prototype', label: 'Prototyping' },
    { key: 'visual', label: 'Visual / aesthetic evidence' }
  ]
};

export const RUBRICS = { lca: LCA_RUBRIC, uiux: UIUX_RUBRIC };
