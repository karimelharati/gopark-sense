import { randomUUID } from 'node:crypto';

export class PhoneTestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const fail = (message, status) => { throw new PhoneTestError(message, status); };
const gpsValid = point => point && [point.lat, point.lon, point.accuracy].every(Number.isFinite) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180 && point.accuracy >= 0;
const FRESH_MS = 25000;
export function phoneDistance(a, b) {
  const radians = value => value * Math.PI / 180;
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lon - a.lon) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function event(room, message, at) {
  room.events.unshift({ id: randomUUID(), at, message });
  room.events = room.events.slice(0, 30);
}
export function createPhoneRoom(at = Date.now()) {
  return {
    id: randomUUID(), tripId: randomUUID(), createdAt: at, expiresAt: at + 8 * 3600000,
    version: 1, radius: 10, phase: 'waiting', gate: 'closed', occupied: 0, capacity: 10,
    driver: { name: 'Test driver', plate: 'B123456', vehicle: 'White Toyota' },
    fixes: { driver: null, attendant: null }, seen: { driver: 0, attendant: 0 },
    arrival: null, processed: [], events: [{ id: randomUUID(), at, message: 'Two-phone test ready. Both phones must enable live location.' }],
  };
}
export function proximity(room, at = Date.now()) {
  const a = room.fixes.attendant, d = room.fixes.driver;
  const attendantFresh = !!a && at - a.receivedAt <= FRESH_MS && at - a.observedAt <= FRESH_MS;
  const driverFresh = !!d && at - d.receivedAt <= FRESH_MS && at - d.observedAt <= FRESH_MS;
  const bothFresh = attendantFresh && driverFresh;
  const distance = a && d ? phoneDistance(a, d) : null;
  const accuracy = a && d ? Math.round(a.accuracy + d.accuracy) : null;
  const quality = bothFresh && a.accuracy <= 75 && d.accuracy <= 75;
  // Proximity is an advisory alert; staff still identify the vehicle before opening.
  // Adding both accuracy radii to the threshold prevented short-distance alerts.
  const nearby = !!bothFresh && distance <= room.radius;
  const confident = !!quality && distance + a.accuracy + d.accuracy <= room.radius;
  return { attendantFresh, driverFresh, bothFresh, quality: !!quality, confident,
    distance: distance === null ? null : Math.round(distance), combinedAccuracy: accuracy, nearby,
    attendantAccuracy: a ? Math.round(a.accuracy) : null, driverAccuracy: d ? Math.round(d.accuracy) : null,
    attendantAgeSeconds: a ? Math.max(0, Math.round((at - a.receivedAt) / 1000)) : null,
    driverAgeSeconds: d ? Math.max(0, Math.round((at - d.receivedAt) / 1000)) : null };
}
function evaluate(room, at) {
  const signal = proximity(room, at);
  if (signal.nearby && ['waiting', 'approaching', 'nearby'].includes(room.phase)) {
    room.phase = 'nearby';
    if (!room.arrival) {
      room.arrival = { id: randomUUID(), at, trigger: 'phone-proximity', confirmedAt: null };
      event(room, 'The two phones are close. The attendant was notified automatically.', at);
    }
  } else if (!room.arrival && ['waiting', 'approaching'].includes(room.phase)) {
    room.phase = signal.bothFresh ? 'approaching' : 'waiting';
  }
}
export function applyPhoneAction(input, role, action, at = Date.now()) {
  if (!['driver', 'attendant'].includes(role)) fail('Unrecognized phone role.', 403);
  if (at > input.expiresAt) fail('This test session expired. Create a new session on the laptop.', 410);
  const { type, data = {}, requestId, tripId } = action || {};
  if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100) fail('Action identifier is missing.');
  if (input.processed.includes(`${role}:${requestId}`)) return input;
  if (tripId !== input.tripId) fail('The test was reset. Refresh this phone and try again.', 409);
  const room = structuredClone(input);
  if (type === 'gps') {
    if (!gpsValid(data) || !Number.isFinite(data.observedAt) || !Number.isFinite(data.sequence)) fail('Invalid phone location.');
    if (data.observedAt < at - FRESH_MS || data.observedAt > at + 15000) fail('Location is stale or the phone clock is incorrect. Get a fresh GPS fix.');
    const previous = room.fixes[role];
    if (previous && (data.sequence <= previous.sequence || data.observedAt < previous.observedAt)) return input;
    room.fixes[role] = { lat: data.lat, lon: data.lon, accuracy: data.accuracy, observedAt: data.observedAt, receivedAt: at, sequence: data.sequence };
    room.seen[role] = at;
    evaluate(room, at);
  } else if (type === 'pause_gps') {
    room.fixes[role] = null;
    evaluate(room, at);
    event(room, `${role === 'driver' ? 'Driver' : 'Attendant'} paused live location.`, at);
  } else if (type === 'profile') {
    if (role !== 'driver') fail('Only the driver can edit this profile.', 403);
    if (['open', 'parked'].includes(room.phase)) fail('Finish this visit before changing the vehicle.');
    const name = String(data.name || '').trim().slice(0, 60), vehicle = String(data.vehicle || '').trim().slice(0, 100);
    const plate = String(data.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name || !/^[A-Z0-9]{4,12}$/.test(plate)) fail('Enter a driver name and a plate with 4–12 letters/numbers.');
    room.driver = { name, plate, vehicle }; event(room, 'Driver details updated.', at);
  } else {
    if (role !== 'attendant') fail('Only the attendant can perform this action.', 403);
    if (type === 'radius') {
      if (![10, 20, 30, 50, 80, 100, 150, 200, 300].includes(data.radius)) fail('Choose an alert distance from the list.');
      if (['open', 'parked'].includes(room.phase)) fail('Reset the test before changing the distance.');
      room.radius = data.radius; evaluate(room, at); event(room, `Proximity alert distance set to ${data.radius} m.`, at);
    } else if (type === 'open') {
      if (data.vehicleVerified !== true) fail('Confirm you can identify the arriving car.');
      if (room.phase === 'open') return input;
      if (room.phase !== 'nearby' || !room.arrival || !proximity(room, at).nearby) fail('Both phones need fresh nearby GPS before opening.');
      room.phase = 'open'; room.gate = 'open'; room.arrival.confirmedAt = at;
      event(room, 'Attendant identified the car and opened the simulated gate. Occupancy unchanged.', at);
    } else if (type === 'entered') {
      if (room.phase === 'parked') return input;
      if (room.phase !== 'open' || data.vehicleVerified !== true) fail('Open the gate and confirm actual entry first.');
      room.phase = 'parked'; room.gate = 'closed'; room.occupied = 1;
      event(room, 'Attendant confirmed actual entry. One car parked; gate closed.', at);
    } else if (type === 'departed') {
      if (room.phase === 'complete') return input;
      if (room.phase !== 'parked' || data.vehicleVerified !== true) fail('Confirm the parked car really departed.');
      room.phase = 'complete'; room.occupied = 0; room.gate = 'closed';
      event(room, 'Vehicle departure confirmed. Space released.', at);
    } else if (type === 'reset') {
      room.tripId = randomUUID(); room.phase = 'waiting'; room.gate = 'closed'; room.occupied = 0;
      room.fixes = { driver: null, attendant: null }; room.arrival = null;
      event(room, 'Test reset. Waiting for a fresh location from both phones.', at);
    } else fail('Unknown test action.');
  }
  room.version++;
  room.processed = [...room.processed, `${role}:${requestId}`].slice(-300);
  return room;
}
export function phoneRoomView(room, role, at = Date.now()) {
  const signal = proximity(room, at);
  return {
    id: room.id, tripId: room.tripId, version: room.version, expiresAt: room.expiresAt, serverTime: at, role,
    radius: room.radius, phase: room.phase, gate: room.gate, occupied: room.occupied, capacity: room.capacity,
    driver: room.driver, arrival: room.arrival, proximity: signal, events: room.events,
    driverOnline: at - room.seen.driver <= 12000, attendantOnline: at - room.seen.attendant <= 12000,
    ownAccuracy: room.fixes[role] ? Math.round(room.fixes[role].accuracy) : null,
    canOpen: role === 'attendant' && room.phase === 'nearby' && signal.nearby,
  };
}
