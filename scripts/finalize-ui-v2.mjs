import fs from 'node:fs';
let s=fs.readFileSync('app/operations.jsx','utf8');
s=s.replace("import { useState } from 'react';","import { useState } from 'react';\nimport CorrectionForm from './corrections';");
s=s.replace('>Flag incorrect record for review</button></div>','>Flag incorrect record for review</button><CorrectionForm booking={b}/></div>');
fs.writeFileSync('app/operations.jsx',s);
let hardware=fs.readFileSync('app/api/hardware/route.ts','utf8');
hardware=hardware.replace("else throw new Error('Unmatched exit needs attendant identification; no booking was released.');","else command={type:'sensorAlert',data:{lotId:d.lot_id,message:'Unmatched sensor exit. Attendant must identify the departing vehicle before releasing a booking.',actor:d.id}};");
fs.writeFileSync('app/api/hardware/route.ts',hardware);
for(const f of ['hardware/README.md','hardware/gopark_gate.ino']){const body=fs.readFileSync(f,'utf8').replaceAll('4173/api/hardware','4174/api/hardware').replace('LAN listener; localhost','token-only hardware bridge on port 4174; localhost').replace('Windows firewall approval may be required. The default launcher remains loopback-only.','This starts a token-only hardware bridge on port 4174; the app remains loopback-only on 4173. Windows firewall approval may be required.');fs.writeFileSync(f,body);}
