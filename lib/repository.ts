import { env } from 'cloudflare:workers';
import { seedWorld, applyCommand, reconcileWorld } from './parking.mjs';
export function ownerFor(request: Request): string {
  const id = request.headers.get('oai-authenticated-user-id');
  if (id) return id;
  if (['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)) return 'local-parking-demo';
  throw new Error('Sign in to open your private GoPark demo.');
}
export async function readWorld(owner: string) {
  if (!env.DB) throw new Error('Parking database is not configured.');
  let row = await env.DB.prepare('SELECT state, version FROM parking_worlds WHERE owner = ?').bind(owner).first<{ state: string; version: number }>();
  if (!row) {
    await env.DB.prepare('INSERT OR IGNORE INTO parking_worlds (owner, state, version) VALUES (?, ?, 0)').bind(owner, JSON.stringify(seedWorld())).run();
    row = await env.DB.prepare('SELECT state, version FROM parking_worlds WHERE owner = ?').bind(owner).first<{ state: string; version: number }>();
  }
  if (!row) throw new Error('Unable to open the parking workspace.');
  const original = JSON.parse(row.state);
  const world = reconcileWorld(original);
  const state = JSON.stringify(world);
  if (state !== row.state) {
    const result = await env.DB.prepare('UPDATE parking_worlds SET state = ?, version = version + 1 WHERE owner = ? AND version = ?').bind(state, owner, row.version).run();
    if (result.meta.changes !== 1) return readWorld(owner);
    return { world, version: row.version + 1 };
  }
  return { world, version: row.version };
}
export async function updateWorld(owner: string, command: unknown) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { world, version } = await readWorld(owner);
    const next = applyCommand(world, command);
    if (next === world) return world;
    const result = await env.DB!.prepare('UPDATE parking_worlds SET state = ?, version = version + 1 WHERE owner = ? AND version = ?').bind(JSON.stringify(next), owner, version).run();
    if (result.meta.changes === 1) return next;
  }
  throw new Error('Another gate just updated this lot. Please retry.');
}
