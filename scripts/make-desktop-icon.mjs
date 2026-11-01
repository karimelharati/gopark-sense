import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const png = fs.readFileSync(new URL('../public/icon-192.png', import.meta.url));
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 192; header[7] = 192;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync(fileURLToPath(new URL('../public/gopark.ico', import.meta.url)), Buffer.concat([header, png]));
