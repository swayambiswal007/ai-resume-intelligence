// Global engine configuration. Everything that changes a score lives either
// here or in rubrics.js so the ranking method is auditable in one place.

// Reference date used to resolve "Present" / "Current" and to clamp future dates.
// Fixed (not "now") so that rankings are reproducible between runs and between
// the offline build and the browser.
export const REF_DATE = { y: 2026, m: 11 };
export const REF_DATE_LABEL = 'Nov 2026';

// How much a keyword hit counts depending on where in the resume it was found.
// Demonstrated use (work bullets, projects) counts more than a skills list.
export const SECTION_WEIGHTS = {
  work: 1.0,
  project: 0.9,
  skill: 0.6,
  summary: 0.5,
  cert: 0.5,
  edu: 0.4,
  award: 0.4,
  other: 0.7 // unstructured text (fallback when sections can't be detected)
};

export const SECTION_LABELS = {
  work: 'Experience',
  project: 'Projects',
  skill: 'Skills',
  summary: 'Summary',
  cert: 'Certifications',
  edu: 'Education',
  award: 'Awards',
  other: 'Resume text'
};

// Classification thresholds (scores are 0-100 per role).
export const CLASSIFY = {
  matchMin: 40, // a role score at or above this is a credible match
  bothMin: 40, // both scores at/above this → "Both"
  neitherMax: 8, // below this on both roles → "Neither"
  minLead: 5, // the leading role must be ahead by at least this many points…
  relLead: 0.3 // …and by at least 30% of its own score, otherwise "Uncertain"
};

// Each unmet must-have (4 per role) multiplies the score by (1 - penalty).
export const MUSTHAVE_PENALTY = 0.08;

export const FIT_BANDS = [
  { min: 70, label: 'Strong fit', key: 'strong' },
  { min: 55, label: 'Good fit', key: 'good' },
  { min: 40, label: 'Moderate fit', key: 'moderate' },
  { min: 0, label: 'Weak fit', key: 'weak' }
];
