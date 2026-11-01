// Seeded discrete-event model. Estimates illustrate assumptions, not field accuracy.
function random(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function peak(intervals,start,end){const events=intervals.filter(b=>b.start<end&&b.end>start).flatMap(b=>[[Math.max(start,b.start),1],[Math.min(end,b.end),-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let count=0,max=0;for(const[,v]of events){count+=v;max=Math.max(max,count);}return max;}
function runPolicy(trace,options,assisted){
  const events=trace.flatMap(v=>[{at:v.request,type:'request',v},{at:v.arrival,type:'arrival',v},{at:v.departure,type:'departure',v}]);for(let t=0;t<=options.minutes;t++)events.push({at:t,type:'sample'});
  const order={departure:0,reconcile:1,request:2,arrival:3,sample:4};events.sort((a,b)=>a.at-b.at||order[a.type]-order[b.type]);
  const reservations=[],active=new Map(),observed=new Map();let accepted=0,rejected=0,conflicts=0,correct=0,samples=0,error=0,interventions=0,completed=0,delaySum=0,detected=0;const chart=[];
  for(let index=0;index<events.length;index++){
    const e=events[index],v=e.v;
    if(e.type==='request'){
      const intervals=reservations.map(b=>({start:b.start,end:assisted&&observed.has(b.id)&&b.end<e.at?Infinity:b.end}));
      if(peak(intervals,v.start,v.end)>=options.capacity){rejected++;v[assisted?'smartAccepted':'baseAccepted']=false;}else{accepted++;reservations.push(v);v[assisted?'smartAccepted':'baseAccepted']=true;}
    }else if(e.type==='arrival'&&v[assisted?'smartAccepted':'baseAccepted']&&!v.noShow){
      if(active.size>=options.capacity){conflicts++;continue;}active.set(v.id,v);
      if(assisted){if(!v.missEntry){observed.set(v.id,v);detected++;}else{const correction={at:e.at+options.recoveryMinutes,type:'reconcile'};events.splice(index+1,0,correction);events.sort((a,b)=>a.at-b.at||order[a.type]-order[b.type]);}}
    }else if(e.type==='departure'&&active.has(v.id)){
      active.delete(v.id);completed++;if(assisted){if(!v.missExit){observed.delete(v.id);detected++;}else{events.splice(index+1,0,{at:e.at+options.recoveryMinutes,type:'reconcile'});events.sort((a,b)=>a.at-b.at||order[a.type]-order[b.type]);}}
    }else if(e.type==='reconcile'&&assisted){if(observed.size!==active.size||[...observed.keys()].some(k=>!active.has(k))){observed.clear();for(const[k,b]of active)observed.set(k,b);interventions++;delaySum+=options.recoveryMinutes;detected++;}}
    else if(e.type==='sample'){
      const estimate=assisted?observed.size:reservations.filter(b=>b.start<=e.at&&b.end>e.at).length,difference=Math.abs(estimate-active.size);samples++;if(difference===0)correct++;error+=difference;if(e.at%30===0)chart.push({minute:e.at,actual:active.size,estimated:estimate});
    }
  }
  return{policy:assisted?'Observed crossings + recovery':'Schedule-only baseline',accepted,rejected,conflicts,completed,occupancyAccuracy:Math.round(correct/Math.max(1,samples)*10000)/100,meanCountError:Math.round(error/Math.max(1,samples)*100)/100,staffInterventions:assisted?interventions:0,meanDetectionDelayMinutes:assisted?Math.round(delaySum/Math.max(1,detected)*100)/100:null,chart};
}
export function runSimulation(input={}){
  const options={seed:Number(input.seed??42),vehicles:Number(input.vehicles??160),capacity:Number(input.capacity??12),minutes:1440,overstayProbability:Number(input.overstayProbability??.3),missProbability:Number(input.missProbability??.04),recoveryMinutes:Number(input.recoveryMinutes??8),hardwareCost:Number(input.hardwareCost??0)};
  if(!Object.values(options).every(Number.isFinite)||!Number.isInteger(options.seed)||!Number.isInteger(options.vehicles)||options.vehicles<10||options.vehicles>600||!Number.isInteger(options.capacity)||options.capacity<1||options.capacity>100||options.overstayProbability<0||options.overstayProbability>1||options.missProbability<0||options.missProbability>1||!Number.isFinite(options.recoveryMinutes)||options.recoveryMinutes<1||options.recoveryMinutes>60||!Number.isFinite(options.hardwareCost)||options.hardwareCost<0||options.hardwareCost>10000)throw new Error('Simulation inputs are outside the supported range.');
  const rng=random(options.seed),trace=[];for(let i=0;i<options.vehicles;i++){const start=Math.floor(120+rng()*1020),duration=30+Math.floor(rng()*5)*30,overstay=rng()<options.overstayProbability?15+Math.floor(rng()*90):0,arrival=start-5+Math.floor(rng()*16);trace.push({id:i,start,end:start+duration,request:Math.max(0,start-15-Math.floor(rng()*105)),arrival,departure:arrival+duration+overstay,noShow:rng()<.08,missEntry:rng()<options.missProbability,missExit:rng()<options.missProbability});}
  const baseline=runPolicy(structuredClone(trace),options,false),assisted=runPolicy(structuredClone(trace),options,true);
  return{options,baseline,assisted,assumptions:['Identical seeded demand is offered to both policies. Accepted bookings can differ.','No-shows: 8%. Late/early arrivals and 15–104 minute overstays are synthetic.','The assisted policy models missed passage events and staff reconciliation; it does not assume perfect detection.','Rejected requests may be offered another lot. This model does not assume all alternatives are accepted.','Hardware cost is a user-entered setup assumption. Staff effort and recurring costs are not converted to money.','Results are simulation evidence, not measured production accuracy or vendor price quotes.']};
}
