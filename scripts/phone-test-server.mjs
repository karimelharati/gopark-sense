import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createPhoneRoom, applyPhoneAction, phoneRoomView, PhoneTestError } from '../lib/phone-test-model.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(project, '.sites-runtime');
const dataFile = path.join(runtime, 'phone-test-rooms.json');
const adminToken = process.env.GOPARK_PHONE_ADMIN_TOKEN;
if (!adminToken || adminToken.length < 32) throw new Error('Start with the GoPark Two Phones launcher.');
const port = Number(process.env.GOPARK_PHONE_PORT || 4175);
await fs.mkdir(runtime, { recursive: true });
let store = { publicUrl: process.env.GOPARK_PHONE_PUBLIC_URL || null, rooms: {} }, saveQueue = Promise.resolve();
try { store.rooms = JSON.parse(await fs.readFile(dataFile, 'utf8')).rooms || {}; } catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const [id, record] of Object.entries(store.rooms)) if (record.room.expiresAt < Date.now()) delete store.rooms[id];
const digest = token => createHash('sha256').update(String(token)).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const tokenFor = request => (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
function authenticate(request, record) {
  const hash = digest(tokenFor(request));
  if (equal(hash, record.driverHash)) return 'driver';
  if (equal(hash, record.attendantHash)) return 'attendant';
  throw new PhoneTestError('This phone link is invalid. Scan the pairing code again.', 403);
}
function isLocal(request) {
  return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(`http://${request.headers.host}`).hostname) && !request.headers['cf-ray'];
}
function requireAdmin(request) {
  if (!isLocal(request) || !equal(tokenFor(request), adminToken)) throw new PhoneTestError('Laptop setup access required.', 403);
}
async function persist() {
  // Exact live coordinates are memory-only and are never saved to disk.
  const snapshot = { rooms: Object.fromEntries(Object.entries(store.rooms).map(([id, record]) => [id, { ...record, room: { ...record.room, fixes: { driver: null, attendant: null }, seen: { driver: 0, attendant: 0 } } }])) };
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const temporary = `${dataFile}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(snapshot));
    await fs.rename(temporary, dataFile);
  });
  await saveQueue;
}
async function body(request) {
  let buffer = '';
  for await (const chunk of request) { buffer += chunk; if (Buffer.byteLength(buffer) > 8192) throw new PhoneTestError('Request too large.', 413); }
  try { return JSON.parse(buffer); } catch { throw new PhoneTestError('Invalid request.'); }
}
function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}
const assets = new Map([
  ['/', ['phone-test.html', 'text/html; charset=utf-8']],
  ['/setup', ['phone-test.html', 'text/html; charset=utf-8']],
  ['/phone-test.js', ['phone-test.js', 'application/javascript']],
  ['/phone-test.css', ['phone-test.css', 'text/css']],
  ['/phone-manifest.webmanifest', ['phone-manifest.webmanifest', 'application/manifest+json']],
  ['/phone-sw.js', ['phone-sw.js', 'application/javascript']],
  ['/icon-192.png', ['icon-192.png', 'image/png']], ['/icon-512.png', ['icon-512.png', 'image/png']],
]);
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://phone-test');
    if (request.method === 'GET' && url.pathname === '/local-setup') {
      if (!isLocal(request)) throw new PhoneTestError('Open pairing on the laptop.', 403);
      response.writeHead(303, { Location: `/setup#admin=${encodeURIComponent(adminToken)}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); response.end(); return;
    }
    if (request.method === 'POST' && request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new PhoneTestError('Invalid origin.', 403);
    if (request.method === 'GET' && url.pathname === '/health') { send(response, 200, { service: 'gopark-two-phones' }); return; }
    if (url.pathname.startsWith('/admin/')) {
      requireAdmin(request);
      if (url.pathname === '/admin/status' && request.method === 'GET') { send(response, 200, { publicUrl: store.publicUrl, activeRooms: Object.values(store.rooms).filter(record => record.room.expiresAt > Date.now()).map(record => record.room.id) }); return; }
      if (url.pathname === '/admin/diagnostics' && request.method === 'GET') {
        send(response, 200, { rooms: Object.values(store.rooms).filter(record => record.room.expiresAt > Date.now()).map(record => ({ session: record.room.id.slice(0, 8), ...phoneRoomView(record.room, 'attendant') })) }); return;
      }
      if (url.pathname === '/admin/public-url' && request.method === 'POST') {
        const input = await body(request), publicUrl = new URL(input.url);
        if (publicUrl.protocol !== 'https:' || !publicUrl.hostname.endsWith('.trycloudflare.com')) throw new PhoneTestError('Invalid temporary HTTPS host.');
        store.publicUrl = publicUrl.origin; send(response, 200, { publicUrl: store.publicUrl }); return;
      }
      if (url.pathname === '/admin/rooms' && request.method === 'POST') {
        for (const [id, record] of Object.entries(store.rooms)) if (record.room.expiresAt < Date.now()) delete store.rooms[id];
        if (Object.keys(store.rooms).length > 30) throw new PhoneTestError('Too many active test rooms. Restart expired sessions.', 429);
        const room = createPhoneRoom(), driverKey = randomBytes(24).toString('base64url'), attendantKey = randomBytes(24).toString('base64url');
        store.rooms[room.id] = { room, driverHash: digest(driverKey), attendantHash: digest(attendantKey) };
        await persist(); send(response, 201, { id: room.id, driverKey, attendantKey }); return;
      }
      throw new PhoneTestError('Setup route not found.', 404);
    }
    const match = url.pathname.match(/^\/api\/rooms\/([a-f0-9-]{36})(?:\/(actions))?$/);
    if (match) {
      const record = store.rooms[match[1]];
      if (!record) throw new PhoneTestError('Test session not found. Create a new one from the laptop.', 404);
      const role = authenticate(request, record);
      if (record.room.expiresAt < Date.now()) throw new PhoneTestError('This session expired. Create another on the laptop.', 410);
      record.room.seen[role] = Date.now();
      if (request.method === 'POST' && match[2]) {
        const input = await body(request);
        // Read the latest room after parsing, so simultaneous phone updates merge.
        record.room = applyPhoneAction(record.room, role, input);
        await persist(); send(response, 200, phoneRoomView(record.room, role)); return;
      }
      if (request.method === 'GET' && !match[2]) { send(response, 200, phoneRoomView(record.room, role)); return; }
      throw new PhoneTestError('Method not supported.', 405);
    }
    const asset = assets.get(url.pathname);
    if (asset && request.method === 'GET') {
      if (url.pathname === '/setup' && !isLocal(request)) throw new PhoneTestError('Open setup on the laptop.', 403);
      const data = await fs.readFile(path.join(project, 'public', asset[0]));
      response.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'geolocation=(self)', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
      response.end(data); return;
    }
    throw new PhoneTestError('Not found.', 404);
  } catch (error) { send(response, error.status || 500, { error: error.status ? error.message : 'The phone test could not complete this request.' }); }
});
server.listen(port, '127.0.0.1', () => console.log(`GoPark two-phone test listening on http://127.0.0.1:${port}`));
