// Human-review corrections applied on top of automatic extraction.
// Every correction is recorded on the profile (profile.corrections) so the UI
// can show exactly what a reviewer changed and why.
import { parseDateRange, weightedMonths } from './dates.js';

export function applyOverrides(profile, ov) {
  if (!ov) return profile;
  const log = (field, before, after, reason) => profile.corrections.push({ field, before, after, reason });

  for (const [k, v] of Object.entries(ov.set || {})) {
    log(k, profile[k], v.value, v.reason);
    profile[k] = v.value;
  }
  for (const fix of ov.experience || []) {
    const e = profile.experience[fix.index];
    if (!e) continue;
    if (fix.company != null) { log(`experience[${fix.index}].company`, e.company, fix.company, fix.reason); e.company = fix.company; }
    if (fix.role != null) { log(`experience[${fix.index}].role`, e.role, fix.role, fix.reason); e.role = fix.role; }
    if (fix.dates != null) {
      log(`experience[${fix.index}].dates`, e.dateRaw, fix.dates, fix.reason);
      e.dateRaw = fix.dates;
      e.dates = parseDateRange(fix.dates);
    }
    if (fix.isProject) { log(`experience[${fix.index}]`, 'employment', 'project / case study (excluded from tenure)', fix.reason); e.isProject = true; }
  }
  for (const fix of [...(ov.projects || [])].sort((a, b) => b.index - a.index)) {
    if (fix.mergeIntoPrevious) {
      const p = profile.projects[fix.index];
      const prev = profile.projects[fix.index - 1];
      if (!p || !prev) continue;
      log(`projects[${fix.index}]`, p.title, `merged into "${prev.title}"`, fix.reason);
      prev.title = `${prev.title} — ${p.title}`;
      profile.projects.splice(fix.index, 1);
      continue;
    }
    if (fix.split) {
      const p = profile.projects[fix.index];
      if (!p) continue;
      log(`projects[${fix.index}].title`, p.title, fix.split.join(' | '), fix.reason);
      p.title = fix.split[0];
      profile.projects.splice(fix.index + 1, 0, { title: fix.split[1], description: '', bullets: [] });
    }
    if (fix.title) {
      const p = profile.projects[fix.index];
      if (!p) continue;
      log(`projects[${fix.index}].title`, p.title, fix.title, fix.reason);
      p.title = fix.title;
    }
  }
  for (const fix of ov.education || []) {
    const e = profile.education[fix.index];
    if (!e) continue;
    for (const key of ['degree', 'institution', 'years', 'field', 'level']) {
      if (fix[key] != null) { log(`education[${fix.index}].${key}`, e[key], fix[key], fix.reason); e[key] = fix[key]; }
    }
  }
  if (ov.claimed !== undefined) {
    log('claimed experience', profile.claimed ? profile.claimed.text : '—', ov.claimed ? ov.claimed.text : '—', ov.claimedReason);
    profile.claimed = ov.claimed;
  }
  // Notes add reviewer context without changing data.
  for (const n of ov.notes || []) profile.issues.push({ level: 'info', code: 'REVIEW_NOTE', message: n });
  // Issues a reviewer resolved (e.g. a date warning that was fixed).
  if (ov.resolve) profile.issues = profile.issues.filter((i) => !ov.resolve.some((r) => i.message.includes(r)));

  profile.totalMonths = Math.round(weightedMonths(profile.experience.filter((e) => !e.isProject).map((e) => ({ dates: e.dates, weight: 1 }))));
  profile.reviewed = true;
  return profile;
}
