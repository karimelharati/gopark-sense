'use client';
import { useState,useEffect,useRef,useCallback } from 'react';
import { Map,Car,Gift,ScanLine,Leaf,Settings2,Smartphone,Wifi,WifiOff,Bell,MapPin,ChevronRight,CheckCircle2,X } from 'lucide-react';
import { ParkingContext,clock } from './context';
import { activeBooking,tier } from '../lib/parking.mjs';
import { Discover,MyParking,Rewards } from './driver-views';
import Gate from './gate';
import Dialogs from './dialogs';
import CameraScanner from './camera';

const NAV=[{id:'discover',label:'Find parking',icon:Map},{id:'activity',label:'My parking',icon:Car},{id:'rewards',label:'Rewards',icon:Gift},{id:'gate',label:'Gate console',icon:ScanLine}];
export default function ParkingApp(){
  const [world,setWorld]=useState(null),[tab,setTab]=useState('discover'),[personId,setPersonId]=useState('rashid');
  const [selected,setSelected]=useState('aub'),[sheet,setSheet]=useState(null),[hours,setHours]=useState(2),[plate,setPlate]=useState('B123456'),[rewardId,setRewardId]=useState('');
  const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[online,setOnline]=useState(true),[loadedAt,setLoadedAt]=useState(null),[,tick]=useState(0);
  const [gateLot,setGateLot]=useState('aub'),[direction,setDirection]=useState('entry'),[gatePlate,setGatePlate]=useState(''),[camera,setCamera]=useState(false);
  const [gpsOn,setGpsOn]=useState(false),[gpsMessage,setGpsMessage]=useState(''),[position,setPosition]=useState(null),[rulesDraft,setRulesDraft]=useState(null),[installPrompt,setInstallPrompt]=useState(null);
  const watch=useRef(null),lastGps=useRef(0),mutation=useRef(false),revision=useRef(0),pending=useRef(null),toastTimer=useRef(null),worldRef=useRef(world);
  worldRef.current=world;
  const flash=useCallback(message=>{setNotice(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setNotice(''),6000);},[]);
  const refresh=useCallback(async()=>{
    if(mutation.current)return;const started=revision.current;
    try{const response=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error);if(!mutation.current&&revision.current===started){setWorld(data);setLoadedAt(Date.now());setError('');if(pending.current&&data.processed.includes(pending.current.id))pending.current=null;}}
    catch(e){setError(!navigator.onLine?'You’re offline. Reconnect to open your parking workspace.':e.message||'Could not reach the parking service.');}
  },[]);
  useEffect(()=>{
    refresh();const poll=setInterval(refresh,12000),timer=setInterval(()=>tick(t=>t+1),1000);
    const on=()=>{setOnline(true);refresh();},off=()=>setOnline(false),install=e=>{e.preventDefault();setInstallPrompt(e);};
    setOnline(navigator.onLine);const saved=localStorage.getItem('gopark-driver');if(['rashid','layla','sami'].includes(saved))setPersonId(saved);
    window.addEventListener('online',on);window.addEventListener('offline',off);window.addEventListener('beforeinstallprompt',install);
    if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    return()=>{clearInterval(poll);clearInterval(timer);clearTimeout(toastTimer.current);window.removeEventListener('online',on);window.removeEventListener('offline',off);window.removeEventListener('beforeinstallprompt',install);if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);};
  },[refresh]);
  useEffect(()=>{if(world)setPlate(world.people.find(p=>p.id===personId)?.plate||'');},[personId,!!world]);
  useEffect(()=>{
    if(!sheet&&!camera)return;const original=document.activeElement,previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const key=e=>{if(e.key==='Escape'){setSheet(null);setCamera(false);}if(e.key==='Tab'){const focusable=[...document.querySelectorAll('[role=dialog] button:not(:disabled), [role=dialog] input, [role=dialog] select, [role=dialog] a[href]')].filter(el=>el.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    document.addEventListener('keydown',key);const timer=setTimeout(()=>document.querySelector('[role=dialog] button')?.focus(),60);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',key);clearTimeout(timer);original?.focus();};
  },[sheet,camera]);
  async function send(type,data={},success){
    if(!navigator.onLine){flash('You’re offline. No parking change has been confirmed. Reconnect and retry.');return false;}
    if(mutation.current)return false;const fingerprint=JSON.stringify({type,data});
    if(pending.current&&pending.current.fingerprint!==fingerprint){await refresh();if(pending.current){flash('Check the previous action by refreshing before starting another.');return false;}}
    const requestId=pending.current?.id||crypto.randomUUID();mutation.current=true;revision.current++;setBusy(true);
    try{const response=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,data,requestId}),signal:AbortSignal.timeout(20000)});const next=await response.json();if(!response.ok){pending.current=null;throw new Error(next.error||'Action could not be completed.');}pending.current=null;setWorld(next);setLoadedAt(Date.now());setError('');if(success)flash(success);return true;}
    catch(e){if(e.name==='TimeoutError'||e.name==='TypeError'||e.name==='AbortError'){pending.current={id:requestId,fingerprint};flash('Connection interrupted. Refresh to check the result, or retry the same action safely.');}else flash(e.message);return false;}
    finally{mutation.current=false;setBusy(false);}
  }
  function switchDriver(id){if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;setGpsOn(false);setGpsMessage('');setPersonId(id);localStorage.setItem('gopark-driver',id);setRewardId('');}
  function enableGPS(){
    if(gpsOn){if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;setGpsOn(false);setGpsMessage('Location assistance paused.');return;}
    if(!navigator.geolocation){flash('This browser does not support location.');return;}
    if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);
    const user=personId;setGpsMessage('Waiting for location permission…');lastGps.current=0;
    watch.current=navigator.geolocation.watchPosition(async pos=>{setGpsOn(true);const location={lat:pos.coords.latitude,lon:pos.coords.longitude};setPosition(location);setGpsMessage(`Location accuracy ±${Math.round(pos.coords.accuracy)} m`);if(Date.now()-lastGps.current>15000&&worldRef.current&&activeBooking(worldRef.current,user)){lastGps.current=Date.now();await send('gps',{personId:user,...location,accuracy:pos.coords.accuracy});}},e=>{setGpsOn(false);setGpsMessage(e.code===1?'Location permission denied. Enable it in browser settings.':'Location unavailable. Gate check-in still works.');flash('Location unavailable. You can still check in at the gate.');},{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  }
  function exportData(){const url=URL.createObjectURL(new Blob([JSON.stringify(world,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='gopark-demo-export.json';a.click();URL.revokeObjectURL(url);}
  if(!world)return <div className="loading-screen"><div className="brand"><span className="brand-icon">P<span/></span>go<span>park</span><sup>SENSE</sup></div><div className="loading-ring"/><h1>Making room for your day.</h1><p>{error||'Opening your private parking demo…'}</p>{error&&<button className="button primary" onClick={refresh}>Try again</button>}</div>;
  const p=world.people.find(p=>p.id===personId),b=activeBooking(world,personId),currentTier=tier(p.tierScore);
  const openLot=id=>{setSelected(id);setRewardId('');setSheet('lot');};
  const showRules=()=>{setRulesDraft({...world.rules});setSheet('rules');};
  const context={world,tab,setTab,personId,p,b,currentTier,selected,setSelected,openLot,sheet,setSheet,hours,setHours,plate,setPlate,rewardId,setRewardId,busy,send,flash,gateLot,setGateLot,direction,setDirection,gatePlate,setGatePlate,setCamera,gpsOn,gpsMessage,position,enableGPS,rulesDraft,setRulesDraft,showRules,switchDriver,exportData,installPrompt,setInstallPrompt};
  return <ParkingContext.Provider value={context}><div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('discover');}}><span className="brand-icon">P<span/></span>go<span>park</span><sup>SENSE</sup></a><span className="sidebar-label">YOUR EVERYDAY, EASIER</span><nav>{NAV.map(n=><button key={n.id} className={tab===n.id?'active':''} onClick={()=>{setTab(n.id);setSheet(null);}}><n.icon size={19}/><span>{n.label}</span>{n.id==='activity'&&b&&<i/>}</button>)}</nav><div className="sidebar-bottom"><div className="small-illustration"><Leaf/><span>A little less circling.<br/><b>A little more living.</b></span></div><button onClick={showRules}><Settings2 size={18}/>Demo & parking rules</button><button onClick={()=>setSheet('about')}><Smartphone size={18}/>Get the mobile app</button><div className="demo-label"><span/>HACKATHON PROTOTYPE</div></div></aside>
    <div className="workspace"><header className="topbar"><div className="mobile-brand brand"><span className="brand-icon">P<span/></span>go<span>park</span></div><div className="breadcrumb">Your city, a little closer <span>/</span><b>{tab==='gate'?'Gate operations':'Beirut'}</b></div><div className="header-actions"><span className={`connection ${!online||error?'offline':''}`}>{online&&!error?<Wifi size={13}/>:<WifiOff size={13}/>} {online&&!error?'Live demo':'Offline'}</span><button className="icon-button notification" aria-label="Notifications" onClick={()=>setSheet('notifications')}><Bell size={18}/><i/></button><button className="avatar" aria-label="Switch demo driver" onClick={()=>setSheet('profile')}>{p.name[0]}</button></div></header>
    {(!online||error)&&<div className="offline-banner"><WifiOff size={15}/>{error||'Offline: availability may be stale. Changes need a connection.'}<button onClick={refresh}>Retry</button></div>}
    <main><div className="page-heading"><div><span className="eyebrow">{tab==='gate'?'A LITTLE INTELLIGENCE AT THE ENTRANCE':`GOOD TO SEE YOU, ${p.name.toUpperCase()}`}</span><h1>{tab==='discover'?<>Your next stop.<br className="mobile-only"/> A better space<span>.</span></>:tab==='activity'?<>Less hassle. More getting there<span>.</span></>:tab==='rewards'?<>Good parking comes back around<span>.</span></>:<>Every arrival, accounted for<span>.</span></>}</h1><p>{tab==='discover'?'Find a spot, arrive effortlessly, and get on with your day.':tab==='activity'?'Your reservations, arrivals, and little wins. All in one place.':tab==='rewards'?'Park thoughtfully. Collect points. Unlock a little more.':'A phone camera, smarter decisions, and staff only when needed.'}</p></div><button className="location-pill" onClick={enableGPS}><MapPin size={15}/><span>{gpsOn?'Location enabled':'Beirut, Lebanon'}</span><ChevronRight size={14}/></button></div>
    {tab==='discover'?<Discover/>:tab==='activity'?<MyParking/>:tab==='rewards'?<Rewards/>:<Gate/>}
    <footer><span>gopark sense <i>·</i> A little more room for life.</span><span>Private demo <i>·</i>{loadedAt?`Synced ${clock(loadedAt)}`:'Connecting'}</span></footer></main></div>
    <nav className="bottom-nav" aria-label="Mobile navigation">{NAV.map(n=><button className={tab===n.id?'active':''} key={n.id} onClick={()=>{setTab(n.id);setSheet(null);window.scrollTo({top:0,behavior:'smooth'});}}><n.icon size={21}/><span>{n.id==='discover'?'Explore':n.id==='gate'?'Gate':n.label}</span></button>)}</nav>
    {notice&&<div role="status" className="toast"><CheckCircle2 size={20}/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss notification"><X size={15}/></button></div>}{busy&&<div className="saving-line"/>}
    {camera&&<CameraScanner lotId={gateLot} direction={direction} send={send} close={()=>setCamera(false)}/>}{sheet&&<Dialogs/>}
  </div></ParkingContext.Provider>;
}
