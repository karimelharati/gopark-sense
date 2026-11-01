import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';

const parameters = new URLSearchParams(location.hash.slice(1));
const adminKey = parameters.get('admin');
const supplied = parameters.get('room') && parameters.get('key') ? { id: parameters.get('room'), key: parameters.get('key') } : null;
if (supplied) localStorage.setItem('gopark-phone-session', JSON.stringify(supplied));
let credentials = supplied;
if (!credentials) { try { credentials = JSON.parse(localStorage.getItem('gopark-phone-session')); } catch {} }
const formatDistance = value => value === null ? '—' : value < 1000 ? `${value} m` : `${(value / 1000).toFixed(1)} km`;
const time = value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

async function api(path, token, method = 'GET', data) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(path, { method, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: controller.signal });
    const value = await response.json(); if (!response.ok) throw new Error(value.error || 'The test server is unavailable.');
    return value;
  } catch (error) { if (error.name === 'AbortError') throw new Error('Connection timed out. Keep the laptop running and try again.'); throw error; }
  finally { clearTimeout(timer); }
}
function Header({ label, connected = true }) {
  return <header><div className="brand"><span>P</span>Go<span>Park</span></div><span className={`connection ${connected ? '' : 'offline'}`}><i/>{label}</span></header>;
}
function QR({ value }) {
  const [image, setImage] = useState(null);
  useEffect(() => { let active = true; QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 4, scale: 4 }).then(url => { if (active) setImage(url); }); return () => { active = false; }; }, [value]);
  return image ? <img className="pair-qr" src={image} alt="Scan to pair this phone"/> : <span>Preparing pairing code…</span>;
}
function Setup() {
  const [status, setStatus] = useState(null), [pair, setPair] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const creating = useRef(false);
  async function create() {
    if (creating.current) return;
    creating.current = true; setBusy(true);
    try { const value = await api('/admin/rooms', adminKey, 'POST', {}); setPair(value); localStorage.setItem('gopark-phone-pair', JSON.stringify(value)); setError(''); }
    catch (error) { setError(error.message); }
    finally { creating.current = false; setBusy(false); }
  }
  useEffect(() => {
    let active = true, selected = false;
    async function refresh() {
      try {
        const next = await api('/admin/status', adminKey);
        if (!active) return; setStatus(next); setError('');
        if (!selected) {
          selected = true; let saved; try { saved = JSON.parse(localStorage.getItem('gopark-phone-pair')); } catch {}
          if (saved && next.activeRooms.includes(saved.id)) setPair(saved); else await create();
        }
      } catch (error) { if (active) setError(error.message); }
    }
    refresh(); const interval = setInterval(refresh, 2500);
    return () => { active = false; clearInterval(interval); };
  }, []);
  function link(role) { return `${status.publicUrl}/#room=${encodeURIComponent(pair.id)}&key=${encodeURIComponent(role === 'driver' ? pair.driverKey : pair.attendantKey)}`; }
  return <div className="setup-shell"><Header label="Laptop pairing"/><main><span className="eyebrow">A REAL TWO-PHONE TEST</span><h1>Two phones. One live arrival.</h1><p className="lead">The alert uses the distance between the two phones, wherever you move. There is no fixed parking location.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {!status?.publicUrl && <div className="notice">Starting the temporary HTTPS phone link. Keep the launcher running.</div>}
    {pair && status?.publicUrl && <><p className="pair-session">Both phones must show session <b>{pair.id.slice(0, 8).toUpperCase()}</b>. Enable location on both. The attendant can select a 10 m alert.</p><div className="pair-grid">{['attendant', 'driver'].map((role, i) => <section className="card pair-card" key={role}><span className="step">PHONE {i + 1}</span><h2>{role === 'attendant' ? 'Test attendant' : 'Test driver'}</h2><p>Scan with this phone’s camera, then enable live location.</p><QR value={link(role)}/><a className="button secondary" href={link(role)} target="_blank" rel="noreferrer">Open {role} link</a><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(link(role)); } catch { prompt('Copy this phone link', link(role)); } }}>Copy private phone link</button></section>)}</div></>}
    <section className="card instructions"><h2>How to test it</h2><ol><li>Open the attendant link on phone 1 and the driver link on phone 2.</li><li>Tap <b>Enable live location</b> on both phones and allow precise location.</li><li>Move the phones closer. When both are inside the selected distance with good GPS, the attendant gets an arrival popup.</li><li>The attendant identifies the car and taps <b>Confirm car & open gate</b>. Both phones show the simulated gate opening.</li><li>Tap <b>Car has entered</b> on the attendant phone to count the car and close the gate.</li></ol><p className="muted">Keep both phone screens open, and keep this laptop awake with the launcher running. The link works on Wi-Fi or mobile data. GPS is an estimate; an outdoor test is best. Pairing codes only connect the phones—drivers do not scan anything when arriving.</p></section>
    <div className="setup-footer"><button className="button secondary" disabled={busy} onClick={create}>Create a new paired test</button><span>Sessions expire after 8 hours. A restarted tunnel may get a new address.</span></div>
  </main></div>;
}
function Gate({ open }) { return <div className={`gate-scene ${open ? 'is-open' : ''}`} aria-label={open ? 'Simulated gate open' : 'Simulated gate closed'}><div className="lane-mark"/><div className="gate-post"/><div className="gate-arm"/><div className="mini-car">▰</div><span>SIMULATED GATE</span></div>; }
function Phone() {
  const [room, setRoom] = useState(null), [connected, setConnected] = useState(false), [error, setError] = useState(''), [gpsError, setGpsError] = useState('');
  const [gpsEnabled, setGpsEnabled] = useState(false), [busy, setBusy] = useState(false), [popup, setPopup] = useState(false), [soundOn, setSoundOn] = useState(false);
  const [profile, setProfile] = useState(null), [installed, setInstalled] = useState(false);
  const roomRef = useRef(null), geoBusy = useRef(false), gpsActive = useRef(false), sequence = useRef(Date.now()), audio = useRef(null), gpsInterval = useRef(null), wake = useRef(null), acknowledged = useRef(new Set());
  const gpsGeneration = useRef(0);
  roomRef.current = room;
  const path = `/api/rooms/${credentials.id}`;
  useEffect(() => {
    let alive = true, polling = false;
    async function refresh() {
      if (polling) return; polling = true;
      try { const value = await api(path, credentials.key); if (alive) { setRoom(previous => previous && (previous.version > value.version || previous.version === value.version && previous.serverTime > value.serverTime) ? previous : value); setConnected(true); setError(''); } }
      catch (error) { if (alive) { setConnected(false); setError(error.message); } }
      finally { polling = false; }
    }
    refresh(); const interval = setInterval(refresh, 1500);
    const resumed = () => { if (!document.hidden) { refresh(); if (gpsInterval.current) locate(); } };
    document.addEventListener('visibilitychange', resumed);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/phone-sw.js').catch(() => {});
    return () => { alive = false; gpsActive.current = false; gpsGeneration.current++; clearInterval(interval); clearInterval(gpsInterval.current); document.removeEventListener('visibilitychange', resumed); wake.current?.release().catch(() => {}); };
  }, []);
  useEffect(() => {
    if (!room || room.role !== 'attendant') return;
    const id = room.arrival?.id;
    if (room.phase !== 'nearby') { setPopup(false); return; }
    if (id && !acknowledged.current.has(id)) {
      setPopup(true);
      navigator.vibrate?.([160, 80, 160]);
      if (audio.current) {
        try { const oscillator = audio.current.createOscillator(), gain = audio.current.createGain(); oscillator.connect(gain); gain.connect(audio.current.destination); oscillator.frequency.value = 780; gain.gain.value = .1; oscillator.start(); oscillator.stop(audio.current.currentTime + .25); } catch {}
      }
    }
  }, [room?.arrival?.id, room?.phase]);
  function dismissPopup() { if (roomRef.current?.arrival?.id) acknowledged.current.add(roomRef.current.arrival.id); setPopup(false); }
  useEffect(() => {
    if (!popup) return;
    const section = document.querySelector('[role="alertdialog"]');
    section?.querySelector('button:not(:disabled)')?.focus();
    const onKey = event => {
      if (event.key === 'Escape') dismissPopup();
      if (event.key === 'Tab') {
        const buttons = [...section.querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [popup]);
  async function send(type, data = {}, silent = false, retryId = crypto.randomUUID()) {
    const current = roomRef.current;
    if (!current) return false;
    if (!silent) setBusy(true);
    try {
      const next = await api(path + '/actions', credentials.key, 'POST', { type, data, requestId: retryId, tripId: current.tripId });
      setRoom(previous => !previous || next.version >= previous.version ? next : previous);
      if (!silent) setError(''); setConnected(true); return true;
    } catch (error) { if (!silent) setError(error.message); else setGpsError(error.message); return false; }
    finally { if (!silent) setBusy(false); }
  }
  async function receivePosition(position, generation) {
    if (!gpsActive.current || generation !== gpsGeneration.current || document.hidden) return;
    const success = await send('gps', { lat: position.coords.latitude, lon: position.coords.longitude, accuracy: position.coords.accuracy, observedAt: position.timestamp, sequence: ++sequence.current }, true);
    if (success && gpsActive.current && generation === gpsGeneration.current) setGpsError('');
  }
  function locationFailure(failure, generation) {
    if (!gpsActive.current || generation !== gpsGeneration.current) return;
    setGpsError(failure.code === 1 ? 'Location permission was denied. Allow precise location in Safari or Chrome settings, then enable again.' : 'No fresh GPS yet. Move outdoors, enable precise location, and keep this screen open.');
    if (failure.code === 1) {
      gpsActive.current = false; gpsGeneration.current++; clearInterval(gpsInterval.current); gpsInterval.current = null;
      setGpsEnabled(false); send('pause_gps', {}, true);
    }
  }
  async function locate() {
    if (geoBusy.current || !roomRef.current || document.hidden) return;
    const generation = gpsGeneration.current;
    geoBusy.current = true;
    navigator.geolocation.getCurrentPosition(async position => {
      try { await receivePosition(position, generation); } finally { geoBusy.current = false; }
    }, failure => { geoBusy.current = false; locationFailure(failure, generation); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  async function enableGps() {
    if (gpsEnabled) { gpsActive.current = false; gpsGeneration.current++; clearInterval(gpsInterval.current); gpsInterval.current = null; setGpsEnabled(false); wake.current?.release().catch(() => {}); await send('pause_gps', {}, true); return; }
    if (!window.isSecureContext) { setGpsError('Use the HTTPS phone link from the laptop pairing screen to enable location.'); return; }
    if (!navigator.geolocation) { setGpsError('This browser does not support location. Open the link in Safari or Chrome.'); return; }
    gpsActive.current = true; gpsGeneration.current++; setGpsEnabled(true); setGpsError(''); locate();
    gpsInterval.current = setInterval(locate, 5000);
    try { wake.current = await navigator.wakeLock?.request('screen'); } catch {}
  }
  async function enableSound() {
    try { const AudioContext = window.AudioContext || window.webkitAudioContext; audio.current = new AudioContext(); await audio.current.resume(); setSoundOn(true); } catch { setError('Sound is unavailable in this browser. The arrival popup still works.'); }
  }
  if (!room) return <div className="phone-shell"><Header label="Connecting…" connected={false}/><main><h1>Opening your phone test.</h1><p className="error" role="alert">{error || 'Connecting to the shared test session…'}</p></main></div>;
  const attendant = room.role === 'attendant', signal = room.proximity;
  const otherOnline = attendant ? room.driverOnline : room.attendantOnline;
  const currentFresh = attendant ? signal.attendantFresh : signal.driverFresh;
  const waiting = !signal.bothFresh ? 'Waiting for fresh location from both phones.' : signal.nearby ? signal.confident ? 'The two phones are close.' : 'Estimated match. GPS uncertainty is larger than the distance: the attendant must check the car.' : `Estimated distance is outside ${room.radius} m. Move the phones closer.`;
  const locationStatus = role => {
    const accuracy = signal[`${role}Accuracy`], fresh = signal[`${role}Fresh`], age = signal[`${role}AgeSeconds`];
    return accuracy === null ? 'No location yet — enable location on this phone.' : !fresh ? `Location expired (${age}s ago). Keep this phone open.` : `Live · ±${accuracy} m accuracy · ${age}s ago`;
  };
  const phaseLabel = { waiting: 'Waiting for location', approaching: 'Phones approaching', nearby: 'Arrival detected', open: 'Gate open', parked: 'Parked', complete: 'Visit complete' }[room.phase];
  async function openGate() { if (await send('open', { vehicleVerified: true })) setPopup(false); }
  return <div className="phone-shell"><Header label={connected ? `${attendant ? 'Attendant' : 'Driver'} connected` : 'Reconnecting…'} connected={connected}/><main>
    <span className="eyebrow">{attendant ? 'TEST ATTENDANT' : 'TEST DRIVER'}</span><h1>{attendant ? 'Your phone is the entrance.' : 'Approach the attendant’s phone.'}</h1><p className="lead">{attendant ? 'Your live position moves with you. The driver’s phone triggers the arrival alert.' : 'No fixed destination. We compare both phones’ live GPS locations.'}</p>
    <div className={`live-pill ${otherOnline ? 'online' : ''}`}><i/>{otherOnline ? `The ${attendant ? 'driver' : 'attendant'} phone is connected` : `Waiting for the ${attendant ? 'driver' : 'attendant'} phone`}</div>
    <p className="pair-session">Paired session <b data-testid="phone-session">{room.id.slice(0, 8).toUpperCase()}</b> · This must match on both phones.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="card proximity-card"><div className="card-top"><h2>Phone-to-phone distance</h2><span className="small-badge">LIVE GPS</span></div><div className="distance" data-testid="phone-distance">{formatDistance(signal.distance)}</div><p className="distance-caption" role="status">{waiting}</p><div className="accuracy-row"><span>Your GPS accuracy <b>{room.ownAccuracy === null ? '—' : `±${room.ownAccuracy} m`}</b></span><span>Alert distance <b>{room.radius} m</b></span></div><div className="location-diagnostics"><p data-testid="driver-gps-status"><b>Driver GPS</b><span>{locationStatus('driver')}</span></p><p data-testid="attendant-gps-status"><b>Attendant GPS</b><span>{locationStatus('attendant')}</span></p></div><button className={`button wide ${gpsEnabled ? 'secondary' : 'primary'}`} onClick={enableGps}>{gpsEnabled ? currentFresh ? 'Live location on · tap to pause' : 'Getting fresh location… · tap to pause' : 'Enable live location'}</button>{gpsError && <p className="gps-error" role="status">{gpsError}</p>}<p className="small-note">Keep this screen open. Both phones must allow precise location. Alerts use the estimated GPS distance. A 10 m setting cannot guarantee 10 m physical accuracy; the attendant checks the car before opening.</p></section>
    <section className="card visit-card"><div className="card-top"><h2>{phaseLabel}</h2><span className={`status-badge ${room.gate === 'open' ? 'green' : ''}`} data-testid="phone-gate-status">Gate {room.gate}</span></div><div className="driver-details"><span className="driver-avatar">{room.driver.name[0]}</span><div><b>{room.driver.name}</b><small>{room.driver.vehicle || 'Vehicle description'}</small></div><span className="plate">{room.driver.plate}</span></div><Gate open={room.gate === 'open'}/><div className="stats"><div><b data-testid="phone-occupied">{room.occupied}</b><span>parked</span></div><div><b>{room.capacity - room.occupied}</b><span>available</span></div><div><b>{room.capacity}</b><span>capacity</span></div></div>
      {attendant ? <div className="attendant-actions">{['waiting', 'approaching', 'nearby'].includes(room.phase) && <><p>{room.canOpen ? 'Identify this car, then confirm and open the gate.' : 'The gate control unlocks after the two phones are close with fresh GPS.'}</p><button className="button primary wide" disabled={busy || !connected || !room.canOpen} onClick={openGate}>Confirm car & open gate</button></>}{room.phase === 'open' && <><p>Opening alone does not count the car. Confirm when you see it enter.</p><button className="button primary wide" disabled={busy || !connected} onClick={() => send('entered', { vehicleVerified: true })}>Car has entered</button></>}{room.phase === 'parked' && <button className="button secondary wide" disabled={busy || !connected} onClick={() => send('departed', { vehicleVerified: true })}>Confirm car has departed</button>}{room.phase === 'complete' && <p className="success">Departure confirmed. All spaces are available.</p>}</div> : <p className="driver-status">{room.phase === 'nearby' ? 'The attendant received your arrival automatically. No confirmation is needed on your phone.' : room.phase === 'open' ? 'The attendant opened the gate. Proceed when clear.' : room.phase === 'parked' ? 'Your entry was confirmed. You are parked.' : room.phase === 'complete' ? 'You have checked out.' : 'Keep live location on and move toward the attendant’s phone. The alert is automatic.'}</p>}
    </section>
    {attendant ? <section className="card"><h2>Test controls</h2><label className="field">Alert when the phones are within<select aria-label="Phone proximity alert distance" value={room.radius} disabled={busy || ['open', 'parked'].includes(room.phase)} onChange={event => send('radius', { radius: Number(event.target.value) })}>{[10, 20, 30, 50, 80, 100, 150, 200, 300].map(radius => <option key={radius} value={radius}>{radius} metres</option>)}</select></label><div className="button-stack"><button className="button secondary" onClick={enableSound} disabled={soundOn}>{soundOn ? 'Alert sound enabled' : 'Enable alert sound'}</button><button className="button secondary" disabled={busy} onClick={() => { if (confirm('Reset this simulated visit? Both phones will stay paired.')) { setPopup(false); send('reset'); } }}>Reset test</button></div>{room.phase === 'nearby' && room.arrival && <button className="text-button" onClick={() => setPopup(true)}>Show arrival popup again</button>}<p className="small-note">For a repeat approach, pause the driver’s location, move outside the distance, reset, then enable it again.</p></section> : <section className="card"><h2>Driver information</h2><form onSubmit={async event => { event.preventDefault(); if (await send('profile', profile || room.driver)) setProfile(null); }}><label className="field">Name<input value={profile?.name ?? room.driver.name} onChange={event => setProfile({ ...(profile || room.driver), name: event.target.value })} maxLength={60}/></label><label className="field">Plate<input value={profile?.plate ?? room.driver.plate} onChange={event => setProfile({ ...(profile || room.driver), plate: event.target.value.toUpperCase() })} maxLength={16}/></label><label className="field">Vehicle description<input value={profile?.vehicle ?? room.driver.vehicle} onChange={event => setProfile({ ...(profile || room.driver), vehicle: event.target.value })} maxLength={100}/></label><button className="button secondary wide" disabled={busy || !profile}>Save driver details</button></form></section>}
    <section className="card history"><h2>Shared activity</h2>{room.events.slice(0, 8).map(event => <div key={event.id}><span>{time(event.at)}</span><p>{event.message}</p></div>)}</section>
    <p className="footer-note">Live two-phone GPS test · gate movement and parking inventory are simulated. There is no fixed location. Your phone’s precise coordinates are not saved to disk.</p><button className="text-button install-help" onClick={() => setInstalled(!installed)}>Use like an app on this phone</button>{installed && <p className="notice">iPhone: Safari → Share → Add to Home Screen. Android: Chrome menu → Add to Home screen. Keep the paired link saved and location allowed.</p>}
  </main>{popup && <div className="popup-backdrop"><section className="arrival-popup" role="alertdialog" aria-modal="true" aria-labelledby="popup-title"><span className="popup-icon">!</span><span className="eyebrow">AUTOMATIC PHONE PROXIMITY ALERT</span><h2 id="popup-title">The driver is close to your phone.</h2><p><b>{room.driver.name}</b> · {room.driver.plate}<br/>{room.driver.vehicle}<br/>Estimated distance: <b>{formatDistance(signal.distance)}</b></p>{!signal.bothFresh ? <p className="gps-error" role="status">Waiting for fresh GPS again. The alert is kept here; opening stays disabled.</p> : !signal.nearby ? <p className="gps-error" role="status">The latest estimate is outside {room.radius} m. Move closer before opening.</p> : !signal.confident && <p className="gps-error" role="status">Approximate GPS match. Driver accuracy ±{signal.driverAccuracy} m; attendant accuracy ±{signal.attendantAccuracy} m. Visually identify the car before confirming.</p>}<p className="small-note">Identify the vehicle before opening. The driver does not need to tap anything.</p><button className="button primary wide" disabled={busy || !connected || !room.canOpen} onClick={openGate}>Confirm car & open gate</button><button className="text-button" onClick={dismissPopup}>Review on dashboard</button></section></div>}</div>;
}
function Welcome() { return <div className="phone-shell"><Header label="Phone test"/><main><span className="eyebrow">TWO PHONES · LIVE PROXIMITY</span><h1>Pair your driver and attendant.</h1><p className="lead">On the laptop, open <b>Open GoPark Two Phones.cmd</b> from the project folder. Scan its attendant pairing code on one phone and its driver code on the other.</p><section className="card"><h2>No fixed location needed.</h2><p>Each phone enables live location. The attendant gets a popup when both phones are close, then confirms the car and opens the simulated gate.</p></section></main></div>; }
createRoot(document.getElementById('root')).render(adminKey && location.pathname === '/setup' ? <Setup/> : credentials?.id && credentials?.key ? <Phone/> : <Welcome/>);
