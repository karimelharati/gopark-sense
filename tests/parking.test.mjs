import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorld, applyCommand, availability, activeBooking, overstay, queueFor, tier, distanceMeters, intervalCapacity } from '../lib/parking.mjs';
const act = (w, type, data = {}, requestId = crypto.randomUUID()) => applyCommand(w, { type, data, requestId });
const reserve = w => act(w, 'reserve', { personId: 'rashid', lotId: 'aub', plate: 'B123456', hours: 1 });
function crossing(w, direction, plate = 'B123456') {
  w = act(w, 'scan', { lotId: 'aub', plate, direction, confidence: 98, source: 'demo' });
  return act(w, 'cross', { eventId: w.gateEvents[0].id, evidence: 'simulated' });
}
test('inventory distinguishes occupied, reserved and bookable spaces', () => {
  const w = seedWorld(); assert.deepEqual(availability(w, 'aub'), { occupied: 35, reserved: 0, physical: 13, available: 13, capacity: 48 });
  const next = reserve(w); assert.equal(availability(next, 'aub').available, 12); assert.equal(availability(next, 'aub').occupied, 35);
});
test('GPS proximity never checks a vehicle in or out', () => {
  let w = reserve(seedWorld()); w = act(w, 'gps', { personId: 'rashid', lat: 33.8974, lon: 35.4815, accuracy: 5 });
  assert.equal(activeBooking(w, 'rashid').gps.nearby, true); assert.equal(activeBooking(w, 'rashid').status, 'reserved');
  w = crossing(w, 'entry'); w = act(w, 'gps', { personId: 'rashid', lat: 34, lon: 35.5, accuracy: 5 });
  assert.equal(activeBooking(w, 'rashid').status, 'parked'); assert.equal(availability(w, 'aub').occupied, 36);
});
test('plate observation waits for physical crossing; duplicate exits do not duplicate points', () => {
  let w = reserve(seedWorld()); w = act(w, 'scan', { lotId: 'aub', plate: 'B123456', direction: 'entry', confidence: 98, source: 'demo' });
  assert.equal(activeBooking(w, 'rashid').status, 'reserved');
  w = act(w, 'cross', { eventId: w.gateEvents[0].id, evidence: 'simulated' });
  assert.equal(availability(w, 'aub').occupied, 36); assert.equal(availability(w, 'aub').reserved, 0);
  w = crossing(w, 'exit'); const points = w.people[0].points;
  assert.equal(points, 30); assert.equal(availability(w, 'aub').available, 13);
  const next = act(w, 'cross', { eventId: w.gateEvents[0].id, evidence: 'simulated' });
  assert.equal(next.people[0].points, points); assert.equal(next.receipts.length, 1);
});
test('low-confidence and unmatched plates require review', () => {
  let w = reserve(seedWorld()); w = act(w, 'scan', { lotId: 'aub', plate: 'B123456', direction: 'entry', confidence: 50, source: 'camera' });
  assert.equal(w.gateEvents[0].status, 'review'); assert.throws(() => act(w, 'cross', { eventId: w.gateEvents[0].id, evidence: 'simulated' }), /uncertain/);
  w = act(w, 'scan', { lotId: 'aub', plate: 'UNKNOWN', direction: 'entry', confidence: 99, source: 'camera' });
  assert.equal(w.gateEvents[0].status, 'review'); assert.equal(availability(w, 'aub').occupied, 35);
});
test('a gate opening without crossing cannot check in', () => {
  let w = reserve(seedWorld()); w = act(w, 'scan', { lotId: 'aub', plate: 'B123456', direction: 'entry', confidence: 99, source: 'demo' });
  assert.throws(() => act(w, 'cross', { eventId: w.gateEvents[0].id }), /observation/);
  w = act(w, 'reject', { eventId: w.gateEvents[0].id }); assert.equal(availability(w, 'aub').occupied, 35);
});
test('grace and started penalty blocks have exact boundaries', () => {
  const w = seedWorld(), b = { endsAt: 1000000, lotId: 'aub' };
  assert.equal(overstay(w, b, b.endsAt + 10 * 60000).penalty, 0);
  assert.equal(overstay(w, b, b.endsAt + 10 * 60000 + 1).penalty, 2);
  assert.equal(overstay(w, b, b.endsAt + 25 * 60000).penalty, 2);
  assert.equal(overstay(w, b, b.endsAt + 25 * 60000 + 1).penalty, 4);
});
test('severe overstay downgrades tier, gives no loyalty reward and releases the space', () => {
  let w = crossing(reserve(seedWorld()), 'entry'); w = act(w, 'advance', { minutes: 120 }); w = act(w, 'advance', { minutes: 15 });
  w = crossing(w, 'exit'); assert.equal(w.people[0].points, 28); assert.ok(w.people[0].penalties > 0);
  assert.notEqual(tier(w.people[0].tierScore).name, 'Gold'); assert.equal(w.receipts[0].severe, true); assert.equal(availability(w, 'aub').available, 13);
  assert.equal(w.ledger[0].tierChange, w.people[0].tierScore - 62);
});
test('redemption consumes ten wallet points and preserves tier; same action is idempotent', () => {
  const requestId = 'same-reward-action'; const w = act(seedWorld(), 'redeem', { personId: 'rashid', offerId: 'hour' }, requestId);
  assert.equal(w.people[0].points, 18); assert.equal(w.people[0].tierScore, 62);
  const next = act(w, 'redeem', { personId: 'rashid', offerId: 'hour' }, requestId); assert.equal(next.people[0].points, 18); assert.equal(next.rewards.length, 1);
});
test('free-hour coupon reduces booking quote and cancellation returns the coupon', () => {
  let w = act(seedWorld(), 'redeem', { personId: 'rashid', offerId: 'hour' }); const rewardId = w.rewards[0].id;
  w = act(w, 'reserve', { personId: 'rashid', lotId: 'aub', plate: 'B123456', hours: 1, startsAt: Date.now() + 3600000, rewardId });
  assert.equal(activeBooking(w, 'rashid').quote, 0); assert.equal(w.rewards[0].status, 'held');
  w = act(w, 'cancel', { personId: 'rashid', bookingId: activeBooking(w, 'rashid').id }); assert.equal(w.rewards[0].status, 'available'); assert.equal(w.people[0].points, 18);
});
test('insufficient balance, rooftop restrictions and full capacity are enforced on the server', () => {
  const w = seedWorld(); assert.throws(() => act(w, 'redeem', { personId: 'sami', offerId: 'coffee' }), /need 10/);
  assert.throws(() => act(w, 'reserve', { personId: 'sami', lotId: 'roof', plate: 'T345678', hours: 1 }), /Gold/);
  const cancelled = act(w, 'cancel', { personId: 'sami', bookingId: 'GP-SAMI' });
  assert.throws(() => act(cancelled, 'reserve', { personId: 'sami', lotId: 'roof', plate: 'T345678', hours: 1 }), /Gold/);
  assert.throws(() => act(w, 'reserve', { personId: 'rashid', lotId: 'bdd', plate: 'B123456', hours: 1 }), /capacity/);
});
test('tier priority determines who can claim the next available queued space', () => {
  let w = seedWorld(); w = act(w, 'cancel', { personId: 'layla', bookingId: 'GP-LAYLA' });
  w = act(w, 'queue', { personId: 'layla', lotId: 'bdd' }); w = act(w, 'queue', { personId: 'rashid', lotId: 'bdd' });
  assert.equal(queueFor(w, 'bdd')[0].personId, 'rashid');
  const v = w.visits.find(v => v.lotId === 'bdd'); v.leftAt = Date.now();
  assert.throws(() => act(w, 'reserve', { personId: 'layla', lotId: 'bdd', plate: 'G234567', hours: 1 }), /front/);
  w = act(w, 'reserve', { personId: 'rashid', lotId: 'bdd', plate: 'B123456', hours: 1 }); assert.equal(availability(w, 'bdd').available, 0);
});
test('last remaining capacity cannot be allocated twice', () => {
  let w = seedWorld(); w.lots[0].capacity = 38; w = reserve(w);
  assert.equal(intervalCapacity(w, 'aub', Date.now(), Date.now()+3600000).available, 0);
  assert.throws(() => act(w, 'walkin', { lotId: 'aub', plate: 'NEW123' }), /occupied or reserved/);
});
test('walk-in vehicles can be recorded and checked out', () => {
  let w = act(seedWorld(), 'walkin', { lotId: 'aub', plate: 'XYZ123', name: 'Visitor' });
  assert.equal(availability(w, 'aub').occupied, 36); w = crossing(w, 'exit', 'XYZ123'); assert.equal(availability(w, 'aub').occupied, 35);
});
test('distance calculation is finite and GPS rejects invalid coordinates', () => {
  const w = reserve(seedWorld()); assert.equal(distanceMeters({ lat: 33, lon: 35 }, { lat: 33, lon: 35 }), 0);
  assert.throws(() => act(w, 'gps', { personId: 'rashid', lat: 999, lon: 35, accuracy: 5 }), /Invalid GPS/);
});
