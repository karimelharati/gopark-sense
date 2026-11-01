import { distanceMeters, tier } from './parking-v1.mjs';
export const MINUTE=60000, HOUR=3600000;
export const POLICY_RULES={arrivalEarlyMinutes:15,noShowMinutes:30,cancellationFullRefundMinutes:120,overstayRatePercent:150,disruptionFee:5,disruptionPenalty:4,inconveniencePoints:5,difficultSpacePoints:2,starGain:.05,starLossPerBlock:.1,disruptionStarLoss:.3,locationRetentionHours:24};
export const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export const stars=p=>Math.min(5,Math.max(1,Number(p.stars??4))).toFixed(1);
export const membership=p=>{const score=tier(p.tierScore),rating=Number(stars(p));const rank=rating>=4.7?3:rating>=4.2?2:rating>=3.5?1:0;const tiers=[0,20,50,100];return tier(Math.min(p.tierScore,tiers[rank]===100?p.tierScore:tiers[rank]+19));};
export const bookingStart=b=>b.startsAt??b.createdAt;
export const inUse=b=>['reserved','parked'].includes(b.status);
export function cancelQuote(w,b,at=Date.now()+w.offset){const minutes=Math.max(0,(bookingStart(b)-at)/MINUTE),eligible=b.status==='reserved'&&at<bookingStart(b);const fraction=eligible?Math.min(1,minutes/Math.max(1,w.rules.cancellationFullRefundMinutes)):0;return {eligible,percent:Math.round(fraction*100),amount:round(b.quote*fraction),minutes:Math.floor(minutes)};}
export function intervalCapacity(w,lotId,start,end,excludeId=null){
  const lot=w.lots.find(l=>l.id===lotId),time=Date.now()+w.offset;if(!lot||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('Choose a valid reservation interval.');
  const periods=[];
  for(const b of w.bookings){if(b.id===excludeId||b.lotId!==lotId||!inUse(b))continue;const s=b.status==='parked'?(b.enteredAt??bookingStart(b)):bookingStart(b);const e=b.status==='parked'&&b.endsAt<=time?Infinity:b.endsAt;if(s<end&&e>start)periods.push([Math.max(s,start),Math.min(e,end)]);}
  for(const v of w.visits){if(v.lotId!==lotId||v.leftAt)continue;const e=v.expectedExitAt>time?v.expectedExitAt:Infinity;if(v.enteredAt<end&&e>start)periods.push([Math.max(start,v.enteredAt),Math.min(end,e)]);}
  const events=periods.flatMap(([s,e])=>[[s,1],[e,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let count=0,peak=0;for(const [,change]of events){count+=change;peak=Math.max(peak,count);}return {available:Math.max(0,lot.capacity-peak),peak,capacity:lot.capacity};
}
export function alternativeLots(w,b,kind='displaced'){
  const origin=w.lots.find(l=>l.id===b.lotId),p=w.people.find(p=>p.id===b.personId),time=Date.now()+w.offset;
  const start=Math.max(time,bookingStart(b)),end=Math.max(start+HOUR,b.endsAt);
  return w.lots.filter(l=>l.id!==origin.id&&p.tierScore>=l.minTier&&intervalCapacity(w,l.id,start,end).available>0).map(l=>{const normal=round((end-start)/HOUR*l.price*(1-membership(p).discount/100));return {...l,startsAt:start,endsAt:end,distance:Math.round(distanceMeters(origin,l)),normalPrice:normal,offerPrice:kind==='displaced'?round(Math.min(normal,b.quote)*.8):normal};}).sort((a,b)=>a.distance-b.distance);
}
export function operationalAlerts(w){
  const time=Date.now()+w.offset,out=w.alerts.filter(a=>!a.resolvedAt);
  for(const b of w.bookings){const start=bookingStart(b),p=w.people.find(p=>p.id===b.personId);if(b.status==='reserved'&&start-time<=30*MINUTE&&start>=time)out.push({id:`upcoming:${b.id}`,kind:'upcoming',lotId:b.lotId,personId:b.personId,bookingId:b.id,text:`${p?.name??b.plate} expected at ${new Date(start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Beirut'})}`,at:start});if(b.status==='parked'&&b.endsAt>=time&&b.endsAt-time<=15*MINUTE)out.push({id:`departure-due:${b.id}`,kind:'departure-due',lotId:b.lotId,personId:b.personId,bookingId:b.id,text:`${b.plate} is due to leave within 15 minutes. Ask for a confirmed departure, not a GPS-only checkout.`,at:b.endsAt});if(b.status==='parked'&&time>b.endsAt)out.push({id:`overstay:${b.id}`,kind:'overstay',lotId:b.lotId,personId:b.personId,bookingId:b.id,text:`${b.plate} is ${Math.floor((time-b.endsAt)/MINUTE)} minutes late. Departure unconfirmed.`,at:b.endsAt});}
  return out.filter(a=>!w.acknowledgedAlerts.includes(a.id));
}
