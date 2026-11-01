import fs from 'node:fs';
let s=fs.readFileSync('app/gate.jsx','utf8').replaceAll('e.authorized===false','e.authorized!==true');fs.writeFileSync('app/gate.jsx',s);
let model=fs.readFileSync('lib/parking.mjs','utf8').replace("e.status!=='pending'||e.authorized===false","e.status!=='pending'||e.authorized!==true");fs.writeFileSync('lib/parking.mjs',model);
