import fs from 'node:fs';
import {runSimulation} from '../lib/simulation.mjs';
const seed=Number(process.argv[2]||42),report=runSimulation({seed});
fs.mkdirSync('outputs/evaluation',{recursive:true});
fs.writeFileSync(`outputs/evaluation/seed-${seed}.json`,JSON.stringify(report,null,2));
const keys=['policy','accepted','rejected','conflicts','completed','occupancyAccuracy','meanCountError','staffInterventions','meanDetectionDelayMinutes'];
const csv=[keys.join(','),...[report.baseline,report.assisted].map(r=>keys.map(key=>JSON.stringify(r[key])).join(','))].join('\n');
fs.writeFileSync(`outputs/evaluation/seed-${seed}.csv`,csv);
console.log(JSON.stringify({seed,baseline:report.baseline.occupancyAccuracy,assisted:report.assisted.occupancyAccuracy,baselineConflicts:report.baseline.conflicts,assistedConflicts:report.assisted.conflicts,note:'Synthetic, assumption-dependent results. See JSON assumptions and admission counts.'}));
