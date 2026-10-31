import { ownerFor, readWorld, updateWorld } from '../../../lib/repository';
export async function GET(request: Request) {
  try { return Response.json((await readWorld(ownerFor(request))).world, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { return Response.json({ error: (e as Error).message }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Invalid origin.' }, { status: 403 });
    const text = await request.text();
    if (text.length > 20000) return Response.json({ error: 'Request too large.' }, { status: 413 });
    return Response.json(await updateWorld(ownerFor(request), JSON.parse(text)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
}
