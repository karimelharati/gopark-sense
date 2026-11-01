import fs from 'node:fs';
let s=fs.readFileSync('lib/parking.mjs','utf8');
s=s.replace("type==='walkin'&&!availability(w,l.id).available","type==='walkin'&&(!availability(w,l.id).available||!intervalCapacity(w,l.id,time,Number(data.expectedExitAt)>time?Number(data.expectedExitAt):time+24*HOUR).available)");
fs.writeFileSync('lib/parking.mjs',s);
