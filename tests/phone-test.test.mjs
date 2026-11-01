import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhoneRoom, applyPhoneAction, phoneRoomView, proximity } from '../lib/phone-test-model.mjs';
const at=Date.now();
const action=(room,role,type,data={},time=at)=>applyPhoneAction(room,role,{type,data,tripId:room.tripId,requestId:crypto.randomUUID()},time);
const gps=(room,role,lat,lon,time=at,accuracy=5,sequence=time)=>action(room,role,'gps',{lat,lon,accuracy,observedAt:time,sequence},time);
function near(){let room=createPhoneRoom(at);room=gps(room,'attendant',33.9,35.5);return gps(room,'driver',33.90004,35.5);}
test('two fresh nearby phone fixes trigger an alert without a fixed destination or driver tap',()=>{
  let room=createPhoneRoom(at);room=gps(room,'attendant',33.9,35.5);
  assert.equal(room.arrival,null);
  room=gps(room,'driver',33.90004,35.5);
  assert.ok(room.arrival);assert.equal(room.arrival.trigger,'phone-proximity');
  assert.equal(room.phase,'nearby');assert.equal(room.gate,'closed');assert.equal(room.occupied,0);
});
test('the attendant can move toward a stationary driver at any location',()=>{
  let room=createPhoneRoom(at);room=gps(room,'driver',40,-74);room=gps(room,'attendant',40.01,-74);
  assert.equal(room.arrival,null);
  room=gps(room,'attendant',40.00004,-74,at+5000);
  assert.ok(room.arrival);assert.equal(room.phase,'nearby');
});
test('a moving driver approaching the attendant triggers only one arrival per visit',()=>{
  let room=createPhoneRoom(at);room=gps(room,'attendant',33.9,35.5);room=gps(room,'driver',33.91,35.5);
  assert.equal(room.arrival,null);
  room=gps(room,'driver',33.90004,35.5,at+5000);const first=room.arrival.id;
  room=gps(room,'driver',33.90005,35.5,at+6000);
  assert.equal(room.arrival.id,first);assert.equal(room.events.filter(e=>e.message.includes('notified automatically')).length,1);
});
test('stale location cannot issue an arrival alert',()=>{
  let room=createPhoneRoom(at);room=gps(room,'driver',33.90004,35.5);
  room=gps(room,'attendant',33.9,35.5,at+30000);
  assert.equal(proximity(room,at+30000).bothFresh,false);assert.equal(room.arrival,null);
});

test('10 m alerts report uncertainty instead of blocking an estimated nearby phone',()=>{
  let room=createPhoneRoom(at);assert.equal(room.radius,10);
  room=gps(room,'attendant',33.9,35.5,at,60);room=gps(room,'driver',33.90004,35.5,at,60);
  const signal=proximity(room,at);
  assert.ok(signal.distance<10);assert.equal(signal.nearby,true);assert.equal(signal.confident,false);
  assert.equal(signal.driverAccuracy,60);assert.equal(signal.attendantAccuracy,60);assert.ok(room.arrival);
  assert.equal(room.gate,'closed');assert.equal(room.occupied,0);
  assert.throws(()=>action(room,'attendant','open'),/Confirm/);
});

test('coarse GPS produces an approximate advisory match requiring staff confirmation',()=>{
  let room=createPhoneRoom(at);room=gps(room,'attendant',33.9,35.5,at,200);room=gps(room,'driver',33.90004,35.5,at,150);
  assert.ok(room.arrival);assert.equal(proximity(room,at).quality,false);assert.equal(proximity(room,at).confident,false);
});

test('10 m excludes phones beyond the estimated boundary; distance can be changed to 20 m',()=>{
  let room=createPhoneRoom(at);room=gps(room,'attendant',33.9,35.5);room=gps(room,'driver',33.90012,35.5);
  assert.ok(proximity(room,at).distance>10);assert.equal(room.arrival,null);
  room=action(room,'attendant','radius',{radius:20});assert.ok(room.arrival);
  room=action(room,'attendant','radius',{radius:10});assert.equal(phoneRoomView(room,'attendant',at).canOpen,false);
});

test('only the attendant can confirm/open, and actual entry changes occupancy once',()=>{
  let room=near();assert.throws(()=>action(room,'driver','open',{vehicleVerified:true}),/Only the attendant/);
  assert.throws(()=>action(room,'attendant','open'),/Confirm/);
  room=action(room,'attendant','open',{vehicleVerified:true});assert.equal(room.gate,'open');assert.equal(room.occupied,0);
  room=action(room,'attendant','entered',{vehicleVerified:true});assert.equal(room.occupied,1);assert.equal(room.gate,'closed');
  room=action(room,'attendant','entered',{vehicleVerified:true});assert.equal(room.occupied,1);
  room=action(room,'attendant','departed',{vehicleVerified:true});assert.equal(room.occupied,0);
});
test('a stale arrival cannot authorize an opening, even if the alert was already delivered',()=>{
  const room=near();assert.throws(()=>action(room,'attendant','open',{vehicleVerified:true},at+30000),/fresh/);
});
test('reset rejects in-flight actions from the previous visit',()=>{
  let room=near();const previous=room.tripId;room=action(room,'attendant','reset');
  assert.equal(room.arrival,null);assert.notEqual(room.tripId,previous);
  assert.throws(()=>applyPhoneAction(room,'driver',{type:'gps',data:{lat:33.9,lon:35.5,accuracy:5,sequence:100,observedAt:at},requestId:crypto.randomUUID(),tripId:previous},at),/reset/);
});
test('client-visible room views contain no exact phone locations or permission tokens',()=>{
  const view=phoneRoomView(near(),'attendant',at);
  const json=JSON.stringify(view);assert.equal(json.includes('"lat"'),false);assert.equal(json.includes('"lon"'),false);assert.equal(json.includes('Hash'),false);
});
test('replayed and out-of-order phone samples cannot replace a newer location',()=>{
  let room=near();const previous=room.fixes.driver;
  const unchanged=gps(room,'driver',0,0,at+1000,5,previous.sequence-1);
  assert.equal(unchanged,room);
  const requestId=crypto.randomUUID(),command={type:'radius',data:{radius:150},requestId,tripId:room.tripId};
  room=applyPhoneAction(room,'attendant',command,at);assert.equal(applyPhoneAction(room,'attendant',command,at),room);
});
test('invalid location and expired sessions are rejected',()=>{
  const room=createPhoneRoom(at);assert.throws(()=>gps(room,'driver',100,0),/Invalid/);
  assert.throws(()=>action(room,'driver','profile',{name:'Driver',plate:'B123456'},at+9*3600000),/expired/);
});
test('pausing either phone revokes its fresh proximity immediately',()=>{
  const room=action(near(),'driver','pause_gps');
  assert.equal(room.fixes.driver,null);assert.equal(proximity(room,at).nearby,false);
  assert.equal(phoneRoomView(room,'attendant',at).canOpen,false);
});
