import { distanceMeters, intervalCapacity, membership, now, queueFor } from './parking.mjs';

// Approximate neighborhood points for the offline hackathon demonstration.
// Free-form addresses are resolved separately; these are not verified entrances.
export const DESTINATION_PRESETS = [
  { id: 'aub', name: 'AUB / Bliss Street', description: 'Illustrative destination · Hamra, Beirut', lat: 33.8978, lon: 35.4812, source: 'demo-preset', aliases: ['aub', 'bliss street', 'aub / bliss street', 'american university of beirut'] },
  { id: 'hamra', name: 'Hamra Street', description: 'Illustrative destination · Hamra, Beirut', lat: 33.8946, lon: 35.4834, source: 'demo-preset', aliases: ['hamra', 'hamra street'] },
  { id: 'bdd', name: 'Beirut Digital District', description: 'Illustrative destination · Bachoura, Beirut', lat: 33.8892, lon: 35.5060, source: 'demo-preset', aliases: ['bdd', 'beirut digital district'] },
  { id: 'clemenceau', name: 'Clemenceau', description: 'Illustrative destination · Clemenceau, Beirut', lat: 33.9000, lon: 35.4896, source: 'demo-preset', aliases: ['clemenceau', 'clemenceau street'] },
];

export function validDestination(point) {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180);
}
export function coordinatesFromText(text) {
  const match = String(text).trim().match(/^\(?\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)?$/);
  if (!match) return null;
  const point = { lat: Number(match[1]), lon: Number(match[2]) };
  if (!validDestination(point)) throw new Error('Latitude must be between −90 and 90; longitude between −180 and 180.');
  return { ...point, id: `coordinates:${point.lat},${point.lon}`, name: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`, description: 'Coordinates entered by you', source: 'coordinates' };
}
export function presetFromText(text) {
  const normalized = String(text).trim().toLocaleLowerCase();
  return DESTINATION_PRESETS.find(place => place.aliases.includes(normalized)) || null;
}
export function formatDistance(meters) {
  return meters < 1000 ? `${Math.max(0, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1)} km`;
}

// Inventory and tier rules are shared with booking, not inferred from the map.
export function parkingNearDestination(world, destination, { personId, startsAt, hours, radiusMeters = 5000 }) {
  if (!validDestination(destination)) throw new Error('Choose a valid destination first.');
  const person = world.people.find(person => person.id === personId);
  if (!person) throw new Error('Choose a driver before searching.');
  const time = now(world), endsAt = startsAt + hours * 3600000;
  if (!Number.isFinite(startsAt) || startsAt < time - 60000 || startsAt > time + 30 * 86400000) throw new Error('Choose an arrival between now and 30 days from now.');
  if (![1, 2, 3, 4].includes(hours)) throw new Error('Choose a parking duration of 1–4 hours.');
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > 50000) throw new Error('Choose a valid search radius.');
  const tier = membership(person);
  const nearby = world.lots.filter(validDestination).map(lot => {
    const distance = distanceMeters(destination, lot);
    const capacity = intervalCapacity(world, lot.id, startsAt, endsAt);
    const queue = queueFor(world, lot.id);
    const reason = tier.min < lot.minTier ? 'tier' : capacity.available < 1 ? 'full' : startsAt <= time + 60000 && queue.length && queue[0].personId !== personId ? 'queue' : null;
    return { ...lot, distance, available: capacity.available, reason, total: Math.round(lot.price * hours * (1 - tier.discount / 100) * 100) / 100 };
  }).filter(lot => lot.distance <= radiusMeters).sort((a, b) => a.distance - b.distance || a.price - b.price || a.id.localeCompare(b.id));
  return { matches: nearby.filter(lot => !lot.reason), nearby, startsAt, endsAt, radiusMeters };
}
