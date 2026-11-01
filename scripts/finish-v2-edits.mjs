import fs from 'node:fs';
function edit(file,fn){const s=fs.readFileSync(file,'utf8');fs.writeFileSync(file,fn(s));}
edit('app/booking-features.jsx',s=>s.replace('l.price*(1-p.tierScore/Infinity)','l.price*(1-membership(p).discount/100)'));
edit('lib/parking.mjs',s=>s.replace("accuracy:Math.round(accuracy),nearby,checkedAt:time","accuracy:Math.round(accuracy),nearby,checkedAt:time,source:data.simulated?'simulated':'device'"));
edit('lib/parking.mjs',s=>s.replace("refund>b.quote+(b.overstayFee||0)","refund>Math.max(0,w.payments.filter(x=>x.bookingId===b.id).reduce((sum,x)=>sum+(x.kind==='charge'?x.amount:-x.amount),0))"));
edit('app/parking-app.jsx',s=>s.replace("if(['rashid','layla','sami'].includes(saved))setPersonId(saved);","if(saved&&/^[a-z0-9_-]{1,60}$/.test(saved))setPersonId(saved);"));
edit('app/parking-app.jsx',s=>s.replace("const p=world.people.find(p=>p.id===personId),b=activeBooking(world,personId),currentTier=membership(p);","const p=world.people.find(p=>p.id===personId)||world.people[0],b=activeBooking(world,p.id),currentTier=membership(p);"));
