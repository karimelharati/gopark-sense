import { env } from 'cloudflare:workers';
import { readWorld,updateWorld } from '../../../lib/repository';
import { availability } from '../../../lib/parking.mjs';
import { hash } from '../../../lib/pass-crypto.mjs';
async function device(request:Request){
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token)throw new Error('Device token required.');
  const row=await env.DB!.prepare('SELECT id, owner, lot_id FROM gate_devices WHERE token_hash = ?').bind(await hash(token)).first<{id:string;owner:string;lot_id:string}>();
  if(!row)throw new Error('Unknown device.');return row;
}
export async function GET(request:Request){try{
  const d=await device(request),{world}=await readWorld(d.owner),time=Date.now()+world.offset;
  const event=world.gateEvents.find((e:any)=>{const b=world.bookings.find((b:any)=>b.id===e.bookingId);return e.lotId===d.lot_id&&e.status==='pending'&&e.authorized===true&&!e.openedAt&&time-e.at<120000&&b&&b.version===e.bookingVersion&&b.status===(e.direction==='entry'?'reserved':'parked');});
  return Response.json({command:event?{type:'open',eventId:event.id,direction:event.direction}:null},{headers:{'Cache-Control':'no-store'}});
}catch(e){return Response.json({error:(e as Error).message},{status:401});}}
export async function POST(request:Request){try{
  const d=await device(request),data=await request.json() as any;
  if(!Number.isSafeInteger(data.sequence)||data.sequence<0)throw new Error('Monotonic device sequence required.');
  const {world}=await readWorld(d.owner),e=world.gateEvents.find((e:any)=>e.id===data.eventId&&e.lotId===d.lot_id);
  let command:any;
  if(data.type==='opened'){
    if(!e)throw new Error('An authorized gate event is required.');
    command={type:'openGate',data:{eventId:e.id,source:'hardware',actor:d.id}};
  }else if(data.type==='crossing'){
    if(!['entry','exit'].includes(data.direction))throw new Error('Direction required.');
    const b=e?world.bookings.find((b:any)=>b.id===e.bookingId):null;
    const current=e&&e.status==='pending'&&e.direction===data.direction&&b&&b.version===e.bookingVersion&&b.status===(data.direction==='entry'?'reserved':'parked');
    if(current&&(data.direction==='exit'||availability(world,d.lot_id).physical>0))command={type:'cross',data:{eventId:e.id,evidence:'sensor'}};
    else if(data.direction==='entry')command={type:'observedEntry',data:{lotId:d.lot_id,plate:e?.status==='pending'?e.plate:`UNK${String(data.sequence).slice(-7).padStart(4,'0')}`,name:'Unmatched sensor crossing',actor:d.id}};
    else command={type:'sensorAlert',data:{lotId:d.lot_id,message:'Unmatched sensor exit. Attendant must identify the departing vehicle before releasing a booking.',actor:d.id}};
  }else throw new Error('Unknown device event.');
  const next=await updateWorld(d.owner,{...command,requestId:`hw:${d.id}:${data.sequence}`});
  return Response.json({ok:true,recorded:true,source:'paired-device',activityId:next.activity[0]?.id});
}catch(e){return Response.json({error:(e as Error).message},{status:400});}}
