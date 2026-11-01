import { build } from 'esbuild';
import fs from 'node:fs';
await build({entryPoints:['lib/offline-wallet-entry.mjs'],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2020',outfile:'public/offline-wallet.js'});
fs.cpSync('hardware','public/hardware',{recursive:true});
await import('./build-phone-test.mjs');
