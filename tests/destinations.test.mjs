import test from 'node:test';
import assert from 'node:assert/strict';
import { seedWorld, applyCommand } from '../lib/parking.mjs';
import { coordinatesFromText, presetFromText, parkingNearDestination } from '../lib/destinations.mjs';
import { searchPlaces } from '../lib/place-search.mjs';
const HOUR=3600000;
function empty(){const world=seedWorld();world.bookings=[];world.visits=[];world.queue=[];world.lots=[{...world.lots[0],id:'near',capacity:1,lat:33.89,lon:35.5},{...world.lots[0],id:'far',capacity:1,lat:33.89,lon:35.51}];return world;}
const destination={lat:33.89,lon:35.5001};
function search(world,overrides={}){return parkingNearDestination(world,destination,{personId:'rashid',startsAt:Date.now()+15*60000,hours:2,...overrides});}
test('destinations resolve coordinates and exact quick aliases without confusing arbitrary addresses',()=>{
  assert.deepEqual([coordinatesFromText('33.9, 35.5').lat,coordinatesFromText('(33.9, 35.5)').lon],[33.9,35.5]);
  assert.equal(presetFromText(' AUB ').id,'aub');
  assert.equal(presetFromText('Cafe near AUB'),null);
  assert.equal(coordinatesFromText('Hamra Street'),null);
  assert.throws(()=>coordinatesFromText('91, 35'),/Latitude/);
});
test('ranking uses the destination and does not mutate parking state',()=>{
  const world=empty(),before=JSON.stringify(world),result=search(world);
  assert.equal(result.matches[0].id,'near');
  assert.ok(result.matches[0].distance<20);
  assert.equal(JSON.stringify(world),before);
});
test('a physically full nearest lot is skipped even for a future visit',()=>{
  const world=empty();world.visits.push({id:'unknown',lotId:'near',enteredAt:Date.now(),leftAt:null});
  const result=search(world);
  assert.equal(result.matches[0].id,'far');
  assert.equal(result.nearby.find(lot=>lot.id==='near').reason,'full');
});
test('a future reservation blocks the whole requested visit, while a back-to-back interval is allowed',()=>{
  const world=empty(),startsAt=Date.now()+HOUR;
  world.bookings.push({id:'future',lotId:'near',personId:'layla',status:'reserved',startsAt:startsAt+HOUR,endsAt:startsAt+2*HOUR});
  assert.equal(search(world,{startsAt,hours:2}).matches[0].id,'far');
  assert.equal(search(world,{startsAt,hours:1}).matches[0].id,'near');
});
test('reduced star rating excludes a rooftop even when the driver has enough raw tier score',()=>{
  const world=empty();world.people[0].tierScore=120;world.people[0].stars=3;world.lots[0].minTier=50;
  assert.equal(search(world).matches[0].id,'far');
  assert.equal(search(world).nearby[0].reason,'tier');
});
test('an immediate visit respects the first eligible driver in a queue',()=>{
  const world=empty();world.queue.push({id:'priority',lotId:'near',personId:'layla',status:'waiting',joinedAt:Date.now()});
  assert.equal(search(world,{startsAt:Date.now()}).matches[0].id,'far');
});
test('search validates time, duration, coordinates and coverage',()=>{
  const world=empty();
  assert.throws(()=>search(world,{startsAt:Date.now()-HOUR}),/arrival/);
  assert.throws(()=>search(world,{hours:0}),/duration/);
  assert.throws(()=>parkingNearDestination(world,{lat:NaN,lon:35},{personId:'rashid',startsAt:Date.now(),hours:1}),/destination/);
  assert.equal(parkingNearDestination(world,{lat:0,lon:0},{personId:'rashid',startsAt:Date.now(),hours:1}).matches.length,0);
});
test('the recommended interval is accepted by the real booking engine',()=>{
  let world=empty();const result=search(world,{hours:3});
  world=applyCommand(world,{requestId:crypto.randomUUID(),type:'reserve',data:{personId:'rashid',lotId:result.matches[0].id,plate:'B123456',startsAt:result.startsAt,hours:3}});
  assert.equal(world.bookings[0].startsAt,result.startsAt);
  assert.equal(world.bookings[0].endsAt,result.endsAt);
});
test('place lookup filters invalid results, caches repeated searches and throttles new ones',async()=>{
  let calls=0;
  const fetcher=async url=>{
    calls++;const parsed=new URL(url);assert.equal(parsed.searchParams.get('countrycode'),'LB');
    return Response.json({features:[{type:'Feature',geometry:{type:'Point',coordinates:[35.5,33.9]},properties:{osm_type:'N',osm_id:1,name:'Test destination',countrycode:'LB',city:'Beirut'}},{geometry:{type:'Point',coordinates:[0,NaN]},properties:{}},{geometry:{type:'Point',coordinates:[35.5,33.9]},properties:{countrycode:'DE'}}]});
  };
  await assert.rejects(searchPlaces(null,{fetcher}),/place or address/);
  const first=await searchPlaces('Unique test destination',{fetcher});
  assert.equal(first.length,1);assert.equal(first[0].lat,33.9);
  assert.deepEqual(await searchPlaces('unique test destination',{fetcher}),first);
  assert.equal(calls,1);
  await assert.rejects(searchPlaces('Another unique destination',{fetcher}),error=>error.status===429);
});
