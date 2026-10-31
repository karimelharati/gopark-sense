export const DEFAULT_RULES = { graceMinutes: 10, penaltyBlockMinutes: 15, penaltyPerBlock: 2, tierLossPerBlock: 4, severeMinutes: 60, severeTierLoss: 25, pointsPerStay: 2, tierGainPerStay: 5, rewardCost: 10 };
export const TIERS = [
  { name: 'Explorer', min: 0, discount: 0, priority: 0, color: '#73817d', perks: ['Points on every on-time stay', 'Rewards from 10 points'] },
  { name: 'Silver', min: 20, discount: 5, priority: 1, color: '#7988a1', perks: ['5% off demo parking', 'Priority over Explorer in the queue'] },
  { name: 'Gold', min: 50, discount: 10, priority: 2, color: '#ba8a34', perks: ['10% off demo parking', 'Higher queue priority', 'Access to rooftop parking'] },
  { name: 'Platinum', min: 100, discount: 15, priority: 3, color: '#7960d5', perks: ['15% off demo parking', 'Highest queue priority', 'Access to rooftop parking'] },
];
export const OFFERS = [
  { id: 'hour', title: 'Your next hour, on us', detail: 'One free hour at a standard GoPark demo lot.', kind: 'parking', partner: 'GoPark', icon: 'parking', color: 'lilac' },
  { id: 'coffee', title: 'A little coffee break', detail: '20% off one drink at a fictional nearby café.', kind: 'partner', partner: 'Corner Coffee · demo partner', icon: 'coffee', color: 'peach' },
  { id: 'lunch', title: 'Park. Walk. Lunch.', detail: '15% off one meal at a fictional nearby restaurant.', kind: 'partner', partner: 'The Green Table · demo partner', icon: 'utensils', color: 'mint' },
];
export const tier = score => [...TIERS].reverse().find(t => score >= t.min) || TIERS[0];
export const normalizePlate = text => String(text || '').replace(/[٠-٩]/g, x => String(x.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, x => String(x.charCodeAt(0) - 1776)).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const now = w => Date.now() + w.offset;
export const activeBooking = (w, id) => w.bookings.find(b => b.personId === id && ['reserved', 'parked'].includes(b.status));
export function availability(w, id) {
  const l = w.lots.find(l => l.id === id);
  const occupied = w.bookings.filter(b => b.lotId === id && b.status === 'parked').length + w.visits.filter(v => v.lotId === id && !v.leftAt).length;
  const reserved = w.bookings.filter(b => b.lotId === id && b.status === 'reserved').length;
  return { occupied, reserved, physical: Math.max(0, l.capacity - occupied), available: Math.max(0, l.capacity - occupied - reserved), capacity: l.capacity };
}
export function queueFor(w, id) {
  return w.queue.filter(q => q.lotId === id && q.status === 'waiting').sort((a, b) => tier(w.people.find(p => p.id === b.personId).tierScore).priority - tier(w.people.find(p => p.id === a.personId).tierScore).priority || a.joinedAt - b.joinedAt);
}
export function overstay(w, b, at = now(w)) {
  const late = Math.max(0, (at - b.endsAt) / 60000), r = w.rules;
  const blocks = late > r.graceMinutes ? Math.ceil((late - r.graceMinutes) / r.penaltyBlockMinutes) : 0;
  return { lateMinutes: Math.floor(late), penalty: blocks * r.penaltyPerBlock, tierLoss: blocks * r.tierLossPerBlock + (late > r.severeMinutes ? r.severeTierLoss : 0), severe: late > r.severeMinutes };
}
export function distanceMeters(a, b) {
  const rad = d => d * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
const uid = p => `${p}_${crypto.randomUUID().slice(0, 8)}`;
const fail = message => { throw new Error(message); };
const person = (w, id) => w.people.find(p => p.id === id) || fail('Choose a valid demo driver.');
const lot = (w, id) => w.lots.find(l => l.id === id) || fail('Parking lot not found.');
const audit = (w, text, kind = 'info') => w.activity.unshift({ id: uid('log'), at: now(w), text, kind });
export function seedWorld() {
  const time = Date.now();
  const lots = [
    { id: 'aub', name: 'AUB Garden Parking', area: 'Bliss Street, Hamra', lat: 33.8974, lon: 35.4815, capacity: 48, price: 2, minTier: 0, type: 'Gated', tag: 'Campus favorite', style: 'garden', walk: 3 },
    { id: 'hamra', name: 'Hamra Central', area: 'Hamra, Beirut', lat: 33.8940, lon: 35.4844, capacity: 32, price: 1.5, minTier: 0, type: 'Staffed', tag: 'Easy in, easy out', style: 'city', walk: 5 },
    { id: 'bdd', name: 'District Parking', area: 'Beirut Digital District', lat: 33.8890, lon: 35.5062, capacity: 20, price: 2.5, minTier: 0, type: 'Gated', tag: 'Workday made easy', style: 'district', walk: 2 },
    { id: 'roof', name: 'Skyline Rooftop', area: 'Clemenceau, Beirut', lat: 33.8984, lon: 35.4898, capacity: 12, price: 3, minTier: 50, type: 'Rooftop', tag: 'A space above the city', style: 'roof', walk: 4 },
  ];
  const people = [
    { id: 'rashid', name: 'Rashid', fullName: 'Rashid · demo driver', plate: 'B123456', points: 28, tierScore: 62, penalties: 0, completed: 12 },
    { id: 'layla', name: 'Layla', fullName: 'Layla Haddad · demo', plate: 'G234567', points: 8, tierScore: 28, penalties: 2, completed: 6 },
    { id: 'sami', name: 'Sami', fullName: 'Sami Khoury · demo', plate: 'T345678', points: 4, tierScore: 8, penalties: 0, completed: 2 },
  ];
  const visits = [];
  for (const [index, count] of [35, 26, 20, 6].entries()) for (let i = 0; i < count; i++) visits.push({ id: `visitor_${index}_${i}`, lotId: lots[index].id, plate: `D${index}${i + 10000}`, name: `Visitor ${String(i + 1).padStart(2, '0')}`, enteredAt: time - (i + 1) * 180000, leftAt: null, source: 'Seeded demo vehicle' });
  return { rules: { ...DEFAULT_RULES }, offset: 0, lots, people, visits,
    bookings: [
      { id: 'GP-LAYLA', personId: 'layla', plate: 'G234567', lotId: 'aub', status: 'reserved', createdAt: time, endsAt: time + 7200000, hours: 2, quote: 3.8, discount: 5 },
      { id: 'GP-SAMI', personId: 'sami', plate: 'T345678', lotId: 'aub', status: 'reserved', createdAt: time, endsAt: time + 3600000, hours: 1, quote: 2, discount: 0 }],
    queue: [], gateEvents: [], rewards: [], receipts: [], processed: [],
    ledger: [{ id: 'seed-points', personId: 'rashid', at: time - 86400000, title: 'Previous on-time stays', points: 28, tierChange: 62, penalty: 0, seed: true }],
    activity: [{ id: 'welcome', at: time, text: 'Demo network online. All lots, drivers and partner offers are illustrative.', kind: 'info' }] };
}
export function applyCommand(world, command) {
  const { type, data = {}, requestId } = command;
  if (!requestId || typeof requestId !== 'string' || requestId.length > 100) fail('Missing action identifier. Please try again.');
  if (world.processed.includes(requestId)) return world;
  const w = structuredClone(world), time = now(w);
  if (type === 'reserve') {
    const p = person(w, data.personId), l = lot(w, data.lotId);
    if (activeBooking(w, p.id)) fail('You already have an active booking. Complete or cancel it first.');
    if (p.tierScore < l.minTier) fail('Gold or Platinum is required for rooftop parking.');
    if (!availability(w, l.id).available) fail('This lot is full. Join the priority queue.');
    const queue = queueFor(w, l.id);
    if (queue.length && queue[0].personId !== p.id) fail('The next space goes to the driver at the front of the priority queue.');
    const plate = normalizePlate(data.plate);
    if (!/^[A-Z0-9]{4,12}$/.test(plate)) fail('Enter a plate with 4–12 letters and numbers.');
    if (w.bookings.some(b => ['reserved', 'parked'].includes(b.status) && normalizePlate(b.plate) === plate) || w.visits.some(v => !v.leftAt && normalizePlate(v.plate) === plate)) fail('That vehicle already has an active visit or reservation.');
    const hours = Number(data.hours);
    if (![1, 2, 3, 4].includes(hours)) fail('Choose a valid parking duration.');
    const discount = tier(p.tierScore).discount;
    const reward = data.rewardId ? w.rewards.find(r => r.id === data.rewardId && r.personId === p.id && r.offerId === 'hour' && r.status === 'available') : null;
    if (data.rewardId && (!reward || l.type === 'Rooftop')) fail('That parking reward is unavailable for this lot.');
    const id = uid('GP').toUpperCase();
    w.bookings.unshift({ id, personId: p.id, plate, lotId: l.id, status: 'reserved', createdAt: time, endsAt: time + hours * 3600000, hours, discount, quote: Number((Math.max(0, hours - (reward ? 1 : 0)) * l.price * (1 - discount / 100)).toFixed(2)), rewardId: reward?.id || null });
    p.plate = plate;
    if (reward) { reward.status = 'held'; reward.bookingId = id; }
    w.queue.filter(q => q.personId === p.id && q.status === 'waiting').forEach(q => q.status = 'claimed');
    audit(w, `${p.name} reserved ${l.name} · ${plate}.`, 'booking');
  } else if (type === 'cancel') {
    const b = w.bookings.find(b => b.id === data.bookingId && b.personId === data.personId);
    if (!b || b.status !== 'reserved') fail('Only an unchecked reservation can be cancelled.');
    b.status = 'cancelled'; b.cancelledAt = time;
    const reward = w.rewards.find(r => r.id === b.rewardId);
    if (reward) { reward.status = 'available'; delete reward.bookingId; }
    audit(w, `${person(w, b.personId).name} cancelled ${b.id}. Space released.`, 'booking');
  } else if (type === 'queue') {
    const p = person(w, data.personId), l = lot(w, data.lotId);
    if (activeBooking(w, p.id)) fail('Complete your active booking before joining another queue.');
    if (p.tierScore < l.minTier) fail('Gold or Platinum is required for rooftop access.');
    if (!w.queue.some(q => q.personId === p.id && q.lotId === l.id && q.status === 'waiting')) w.queue.push({ id: uid('queue'), personId: p.id, lotId: l.id, joinedAt: time, status: 'waiting' });
    audit(w, `${p.name} joined the ${l.name} priority queue.`, 'booking');
  } else if (type === 'leaveQueue') {
    w.queue.filter(q => q.personId === data.personId && q.lotId === data.lotId && q.status === 'waiting').forEach(q => q.status = 'left');
  } else if (type === 'gps') {
    const b = activeBooking(w, data.personId);
    if (!b) fail('Reserve a space before enabling arrival assistance.');
    const { lat, lon, accuracy } = data;
    if (![lat, lon, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || accuracy < 0) fail('Invalid GPS reading.');
    const distance = distanceMeters({ lat, lon }, lot(w, b.lotId));
    b.gps = { distance: Math.round(distance), accuracy: Math.round(accuracy), nearby: distance <= 150 && accuracy <= 100, checkedAt: time };
    // GPS never changes inventory: the phone may leave while its car remains parked.
  } else if (type === 'scan') {
    const l = lot(w, data.lotId), plate = normalizePlate(data.plate);
    if (!/^[A-Z0-9]{4,12}$/.test(plate)) fail('The plate could not be read. Capture again or use staff correction.');
    if (!['entry', 'exit'].includes(data.direction)) fail('Choose an entry or exit lane.');
    const confidence = Number(data.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) fail('Invalid OCR confidence.');
    if (w.gateEvents.some(e => e.lotId === l.id && e.plate === plate && e.direction === data.direction && ['pending', 'review'].includes(e.status))) return world;
    const b = w.bookings.find(b => b.lotId === l.id && normalizePlate(b.plate) === plate && b.status === (data.direction === 'entry' ? 'reserved' : 'parked'));
    const v = data.direction === 'exit' ? w.visits.find(v => v.lotId === l.id && normalizePlate(v.plate) === plate && !v.leftAt) : null;
    const source = ['camera', 'demo', 'manual'].includes(data.source) ? data.source : 'manual';
    w.gateEvents.unshift({ id: uid('gate'), lotId: l.id, plate, direction: data.direction, confidence, source, at: time, bookingId: b?.id || null, visitId: v?.id || null, status: (b || v) && confidence >= 85 ? 'pending' : 'review', reason: !(b || v) ? 'No matching active booking or visit' : confidence < 85 ? 'Low OCR confidence: staff verification required' : 'Plate matched. Waiting for vehicle crossing.' });
    audit(w, `${plate} detected at ${l.name} ${data.direction} · ${source === 'demo' ? 'simulated plate' : source}.`, 'gate');
  } else if (type === 'cross') {
    const e = w.gateEvents.find(e => e.id === data.eventId);
    if (!e) fail('Gate event not found.');
    if (e.status === 'confirmed') return world;
    if (e.status !== 'pending') fail('Resolve the uncertain plate before confirming a crossing.');
    if (!['simulated', 'staff-observed'].includes(data.evidence)) fail('A crossing observation is required.');
    const b = w.bookings.find(b => b.id === e.bookingId), v = w.visits.find(v => v.id === e.visitId);
    if (e.direction === 'entry') {
      if (!b || b.status !== 'reserved') fail('This booking is no longer waiting for entry.');
      if (!availability(w, e.lotId).physical) fail('No physical spaces remain. Ask staff to reconcile occupancy.');
      b.status = 'parked'; b.enteredAt = time; audit(w, `${person(w, b.personId).name} entered · ${e.plate}.`, 'entry');
    } else if (b) {
      if (b.status !== 'parked') fail('This visit has already ended.');
      const late = overstay(w, b, time), p = person(w, b.personId), oldScore = p.tierScore, previousTier = tier(p.tierScore).name;
      b.status = 'completed'; b.leftAt = time; b.penalty = late.penalty;
      const earned = late.penalty === 0 ? w.rules.pointsPerStay : 0, gain = late.penalty === 0 ? w.rules.tierGainPerStay : 0;
      p.points += earned; p.tierScore = Math.max(0, p.tierScore + gain - late.tierLoss); p.penalties += late.penalty; p.completed++;
      const reward = w.rewards.find(r => r.id === b.rewardId); if (reward) reward.status = 'used';
      w.ledger.unshift({ id: uid('points'), personId: p.id, at: time, title: late.penalty ? `Overstay · ${late.lateMinutes} minutes` : `On-time stay · ${lot(w, b.lotId).name}`, points: earned, tierChange: p.tierScore - oldScore, penalty: late.penalty });
      w.receipts.unshift({ id: uid('receipt'), personId: p.id, bookingId: b.id, at: time, earned, ...late, previousTier, newTier: tier(p.tierScore).name });
      audit(w, `${p.name} exited · ${earned ? `+${earned} loyalty points` : `${late.penalty} penalty points`}.`, 'exit');
    } else if (v && !v.leftAt) { v.leftAt = time; audit(w, `${v.plate} exited · walk-in visit completed.`, 'exit'); }
    else fail('No active visit matches this exit.');
    e.status = 'confirmed'; e.crossedAt = time; e.evidence = data.evidence;
  } else if (type === 'reject') {
    const e = w.gateEvents.find(e => e.id === data.eventId);
    if (!e || !['pending', 'review'].includes(e.status)) fail('This event has already been resolved.');
    e.status = 'rejected'; audit(w, `Staff dismissed ${e.plate}: no crossing confirmed.`, 'gate');
  } else if (type === 'walkin') {
    const l = lot(w, data.lotId), plate = normalizePlate(data.plate);
    if (!/^[A-Z0-9]{4,12}$/.test(plate)) fail('Enter a valid plate.');
    if (!availability(w, l.id).available) fail('All spaces are occupied or reserved.');
    if (w.visits.some(v => !v.leftAt && normalizePlate(v.plate) === plate) || w.bookings.some(b => ['reserved', 'parked'].includes(b.status) && normalizePlate(b.plate) === plate)) fail('That vehicle is already tracked.');
    w.visits.unshift({ id: uid('visit'), lotId: l.id, plate, name: String(data.name || 'Walk-in visitor').slice(0, 50), enteredAt: time, leftAt: null, source: 'Staff-observed crossing' });
    audit(w, `${plate} entered as a staff-confirmed walk-in.`, 'entry');
  } else if (type === 'redeem') {
    const p = person(w, data.personId), offer = OFFERS.find(o => o.id === data.offerId);
    if (!offer) fail('Reward not found.');
    if (p.points < w.rules.rewardCost) fail(`You need ${w.rules.rewardCost} loyalty points.`);
    p.points -= w.rules.rewardCost;
    w.rewards.unshift({ id: uid('reward'), code: `GP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, personId: p.id, offerId: offer.id, title: offer.title, createdAt: time, status: 'available' });
    w.ledger.unshift({ id: uid('points'), personId: p.id, at: time, title: `Redeemed · ${offer.title}`, points: -w.rules.rewardCost, tierChange: 0, penalty: 0 });
    audit(w, `${p.name} redeemed ${w.rules.rewardCost} points. Tier unchanged.`, 'reward');
  } else if (type === 'useReward') {
    const r = w.rewards.find(r => r.id === data.rewardId && r.personId === data.personId);
    if (!r || r.status !== 'available' || r.offerId === 'hour') fail('This voucher cannot be marked used here.');
    r.status = 'used'; r.usedAt = time; audit(w, 'Demo partner voucher marked used.', 'reward');
  } else if (type === 'advance') {
    const minutes = Number(data.minutes);
    if (![5, 15, 60, 120].includes(minutes)) fail('Choose a valid demo time jump.');
    w.offset += minutes * 60000; audit(w, `Demo clock advanced ${minutes} minutes.`, 'info');
  } else if (type === 'rules') {
    for (const key of Object.keys(DEFAULT_RULES)) {
      const value = Number(data[key]);
      if (!Number.isInteger(value) || value < (['penaltyBlockMinutes', 'rewardCost'].includes(key) ? 1 : 0) || value > 240) fail(`Enter a valid value for ${key}.`);
      w.rules[key] = value;
    }
    if (w.rules.severeMinutes < w.rules.graceMinutes) fail('Severe overstay must be after the grace period.');
    audit(w, 'Loyalty and overstay demo rules updated.', 'info');
  } else if (type === 'reset') return seedWorld();
  else fail('Unknown action.');
  w.processed.push(requestId); w.processed = w.processed.slice(-300); w.activity = w.activity.slice(0, 200);
  return w;
}
