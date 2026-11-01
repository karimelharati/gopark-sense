import fs from 'node:fs';
function edit(file,fn){const before=fs.readFileSync(file,'utf8'),after=fn(before);if(after!==before)fs.writeFileSync(file,after);}
edit('app/dialogs.jsx',s=>{
  if(!s.includes("from './booking-features'"))s=s.replace("import { LotArt } from './visuals';","import { LotArt } from './visuals';\nimport { BookingSheet,CancellationSheet,ResizeSheet,AlternativesSheet,PassSheet,Rating } from './booking-features';");
  const start=s.indexOf("  {sheet==='lot'&&"),end=s.indexOf("  {sheet==='profile'&&",start);
  if(start>=0&&end>start)s=s.slice(0,start)+"  {sheet==='lot'&&<BookingSheet/>}\n  {sheet==='cancel'&&<CancellationSheet/>}\n  {sheet==='resize'&&<ResizeSheet/>}\n  {(sheet==='alternatives'||sheet.startsWith('recovery:'))&&<AlternativesSheet/>}\n  {sheet==='pass'&&<PassSheet/>}\n"+s.slice(end);
  s=s.replace('{user.name}</b><small>','{user.name} <Rating person={user}/></b><small>');
  s=s.replace("{key:'pointsPerStay',label:'Loyalty points / on-time stay'}","{key:'cancellationFullRefundMinutes',label:'Full-refund notice (minutes)'},{key:'arrivalEarlyMinutes',label:'Early arrival window (minutes)'},{key:'noShowMinutes',label:'No-show grace (minutes)'},{key:'overstayRatePercent',label:'Overstay rate (% of normal)'},{key:'disruptionFee',label:'Extra verified disruption fee'},{key:'inconveniencePoints',label:'Displaced-driver bonus points'},{key:'difficultSpacePoints',label:'Inconvenient-space bonus'},{key:'pointsPerStay',label:'Loyalty points / on-time stay'}");
  return s;
});
edit('app/driver-views.jsx',s=>{
  if(!s.includes("from './booking-features'"))s=s.replace("import { LotArt,CityMap } from './visuals';","import { LotArt,CityMap } from './visuals';\nimport { DriverTools } from './booking-features';");
  s=s.replace('busy,send,showRules}=useParking()','busy,send,showRules,setSheet}=useParking()');
  s=s.replace("onClick={()=>send('cancel',{personId,bookingId:b.id},'Reservation cancelled. Your space has been released.')}","onClick={()=>setSheet('cancel')}");
  s=s.replace("  {queues.length>0&&", "  <DriverTools/>\n  {queues.length>0&&");
  s=s.replaceAll("['completed','cancelled']","['completed','cancelled','no_show','disrupted']");
  return s;
});
edit('app/gate.jsx',s=>{
  if(!s.includes("from './operations'"))s=s.replace("import { useState } from 'react';","import { useState } from 'react';\nimport Operations from './operations';");
  s=s.replace('export default function Gate(){','function LiveGate(){');
  if(!s.includes('export default function Gate()'))s+='\nexport default function Gate(){ return <Operations><LiveGate/></Operations>; }\n';
  s=s.replace("{e.status==='pending'?<div className=\"button-row\">","{e.status==='pending'?<div className=\"button-row\">{world.lots.find(l=>l.id===e.lotId)?.mode!=='ungated'&&<>{e.authorized===false&&<button className=\"button secondary\" disabled={busy} onClick={()=>send('authorizeGate',{eventId:e.id},'Attendant authorization recorded.')}>Authorize vehicle</button>}<button className=\"button secondary\" disabled={busy||e.authorized===false} onClick={()=>send('openGate',{eventId:e.id},'Gate opening simulated. Occupancy is unchanged until passage.')}>Simulate gate opening</button></>}");
  return s;
});
