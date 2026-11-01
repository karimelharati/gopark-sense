import { env } from 'cloudflare:workers';
import { ownerFor } from '../../../lib/repository';
import { searchPlaces, PlaceSearchError } from '../../../lib/place-search.mjs';

export async function POST(request: Request) {
  try {
    ownerFor(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('query' in body)) throw new PlaceSearchError('Enter a place or address.', 400);
    const configured = env as typeof env & { PHOTON_SEARCH_URL?: string };
    const results = await searchPlaces(body.query, { endpoint: configured.PHOTON_SEARCH_URL || 'https://photon.komoot.io/api/' });
    return Response.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const status = error instanceof PlaceSearchError ? error.status : 400;
    return Response.json({ error: (error as Error).message }, { status, headers: { 'Cache-Control': 'private, no-store', ...(status === 429 ? { 'Retry-After': '2' } : {}) } });
  }
}
