import fs from 'node:fs';
let s=fs.readFileSync('app/driver-views.jsx','utf8').replace('TIERS.find(t=>t.min>p.tierScore)','TIERS.find(t=>t.min>currentTier.min)').replace('${next.min-p.tierScore} to ${next.name}','${Math.max(0,next.min-p.tierScore)} score + rating to ${next.name}').replace('Spending loyalty points never lowers your tier. Overstays can.','Spending points never lowers your tier. Rating minimums: Silver 3.5, Gold 4.2, Platinum 4.7. Overstays can reduce both rating and tier score.');
fs.writeFileSync('app/driver-views.jsx',s);
