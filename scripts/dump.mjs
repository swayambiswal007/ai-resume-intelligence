// Prints a compact view of every extracted profile for manual audit.
import fs from 'node:fs';
const which = process.argv[2] || 'public/data/profiles.json';
const data = JSON.parse(fs.readFileSync(which, 'utf8'));
const profiles = Array.isArray(data) ? data : data.profiles;
for (const p of profiles) {
  console.log(`\n## ${p.id} | ${p.headline} | claimed=${p.claimed?.text || '-'} | total=${(p.totalMonths/12).toFixed(1)}y | len=${p.textLength}`);
  p.experience.forEach((e,i)=>console.log(`  E${i} ${e.role} | ${e.company} | ${e.dateRaw} | ${e.dates.months}mo | b=${e.bullets.length}${e.isProject?' [PROJECT]':''}`));
  p.education.forEach((e,i)=>console.log(`  D${i} ${e.degree} | ${e.institution} | ${e.years} | ${e.level}/${e.field} | ${e.grade}`));
  console.log(`  P: ${p.projects.map(x=>x.title+(x.description?'*':'')+`(${x.bullets.length})`).join(' || ')}`);
  console.log(`  S: ${Object.entries(p.skills).map(([k,v])=>k+':'+v.length).join(', ')} | C:${p.certifications.length} L:${p.languages.join('/')} A:${p.awards.length}`);
  p.issues.forEach(i=>console.log(`  ! ${i.level} ${i.code}: ${i.message}`));
}
