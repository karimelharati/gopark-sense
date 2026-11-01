import { ownerFor,readWorld } from '../../../lib/repository';
import { issuerKeys,trustManifest } from '../../../lib/pass-server';
import { signBlob } from '../../../lib/pass-crypto.mjs';
export async function GET(request:Request){try{const owner=ownerFor(request),{world}=await readWorld(owner);return Response.json(await trustManifest(owner,world),{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
export async function POST(request:Request){try{
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Error('Invalid origin.');
  const owner=ownerFor(request),{world}=await readWorld(owner),data=await request.json() as any;
  const b=world.bookings.find((b:any)=>b.id===data.bookingId&&b.personId===data.personId);if(!b||!['reserved','parked'].includes(b.status))throw new Error('Only an active booking can receive a pass.');
  if(data.deviceKey?.kty!=='EC'||data.deviceKey.crv!=='P-256'||data.deviceKey.d||typeof data.deviceKey.x!=='string'||typeof data.deviceKey.y!=='string')throw new Error('Invalid device public key.');
  const keys=await issuerKeys(owner),l=world.lots.find((l:any)=>l.id===b.lotId),at=Date.now()+world.offset;
  const certificate=await signBlob({kind:'booking-pass',issuer:keys.issuer,bookingId:b.id,bookingVersion:b.version,personId:b.personId,plate:b.plate,lotId:b.lotId,lotName:l.name,startsAt:b.startsAt,validFrom:b.startsAt-world.rules.arrivalEarlyMinutes*60000,endsAt:b.endsAt,issuedAt:at,expiresAt:Math.max(b.endsAt,at)+24*3600000,quote:b.quote,deviceKey:data.deviceKey},keys.privateKey);
  return Response.json({certificate,trust:await trustManifest(owner,world)},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
