import { validDestination } from './destinations.mjs';

// Only explicitly submitted searches reach the provider. There is no network autocomplete.
const cache = new Map(), pending = new Map();
let lastRequest = 0;
export class PlaceSearchError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
export async function searchPlaces(query, { endpoint = 'https://photon.komoot.io/api/', fetcher = fetch } = {}) {
  if (typeof query !== 'string') throw new PlaceSearchError('Enter a place or address.', 400);
  const normalized = String(query || '').trim().replace(/\s+/g, ' ');
  if (normalized.length < 3 || normalized.length > 180 || /[\u0000-\u001f]/.test(normalized)) throw new PlaceSearchError('Enter a place or address with 3–180 characters.', 400);
  const key = normalized.toLocaleLowerCase(), cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.results;
  if (pending.has(key)) return pending.get(key);
  // A conservative rate limit and bounded in-memory cache suit this local demo.
  if (Date.now() - lastRequest < 1100) throw new PlaceSearchError('Please wait a moment before searching for another place.', 429);
  lastRequest = Date.now();
  const task = (async () => {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') throw new PlaceSearchError('Place search is not configured correctly.', 503);
    url.searchParams.set('q', normalized);
    url.searchParams.set('limit', '5'); url.searchParams.set('lang', 'en');
    url.searchParams.set('countrycode', 'LB');
    url.searchParams.set('lat', '33.895'); url.searchParams.set('lon', '35.49');
    const response = await fetcher(url.href, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new PlaceSearchError('Online place search is temporarily unavailable. Try a quick destination or coordinates.', 503);
    const data = await response.json(), seen = new Set();
    if (!Array.isArray(data.features)) throw new PlaceSearchError('The place service returned an unreadable response.', 502);
    const results = data.features.flatMap((feature, index) => {
      const properties = feature.properties || {}, coordinates = feature.geometry?.coordinates;
      if (properties.countrycode && String(properties.countrycode).toUpperCase() !== 'LB') return [];
      if (feature.geometry?.type !== 'Point' || !Array.isArray(coordinates)) return [];
      const point = { lat: coordinates[1], lon: coordinates[0] };
      if (!validDestination(point)) return [];
      const parts = [...new Set([properties.name, [properties.housenumber, properties.street].filter(Boolean).join(' '), properties.district, properties.city, properties.state, properties.country].filter(value => typeof value === 'string' && value.trim()))];
      const name = String(properties.name || properties.street || parts[0] || normalized).slice(0, 160);
      const id = `${properties.osm_type || 'point'}:${properties.osm_id || `${point.lat},${point.lon}:${index}`}`;
      const dedupe = `${point.lat},${point.lon}:${name}`;
      if (seen.has(dedupe)) return [];
      seen.add(dedupe);
      return [{ ...point, id, name, description: parts.join(', ').slice(0, 400), source: 'photon' }];
    }).slice(0, 5);
    cache.set(key, { expires: Date.now() + 30 * 60000, results });
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return results;
  })();
  pending.set(key, task);
  try { return await task; }
  catch (error) {
    if (error instanceof PlaceSearchError) throw error;
    throw new PlaceSearchError('Could not reach place search. Try a quick destination or enter latitude, longitude.', 503);
  } finally { pending.delete(key); }
}
