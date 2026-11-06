import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(dir, '../../Test Report - Group08/group08-results.json');
if (!fs.existsSync(file)) {console.error('No group08-results.json: run the full suite first'); process.exit(2);}
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const ids=new Set();
function walk(s) {
  for(const spec of s.specs || []) {
    const failed=(spec.tests || []).some(t=>t.status==='unexpected'||(t.results||[]).some(r=>['failed','timedOut','interrupted'].includes(r.status)));
    const match=/DDV_F\d{2}_\d{3}/.exec(spec.title || '');
    if(failed && match)ids.add(match[0]);
  }
  for(const child of s.suites||[])walk(child);
}
for(const s of data.suites||[])walk(s);
if(ids.size===0) {console.error('No failed IDs found in JSON');process.exit(3)}
process.stdout.write([...ids].sort().join('|'));
