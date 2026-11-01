'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BellRing, Check, CheckCircle2, Clock3, LockKeyhole, MapPin, Navigation, Pause, Play, Radio, RotateCcw, ShieldCheck, SkipForward, Smartphone, Wifi } from 'lucide-react';
import { useParking } from './context';

const DURATION = 26000;
const STAGE_TIMES = [0, 1000, 6500, 9500, 13000, 16000, 17800, 20000, 24200];
const NEXT_EVENTS = [1000, 6500, 9500, 13000, 17800, 21200, 22400, 26000];
const CASES = [
  { id: 'gate-driver', number: 1, gated: true, driverConfirms: true, title: 'Gate · driver confirms', detail: 'Driver confirms arrival, then the attendant opens the gate.' },
  { id: 'gate-gps', number: 2, gated: true, driverConfirms: false, title: 'Gate · automatic GPS', detail: 'GPS alerts the attendant, who opens the gate. No driver taps.' },
  { id: 'open-driver', number: 3, gated: false, driverConfirms: true, title: 'No gate · driver confirms', detail: 'Driver confirms arrival. The attendant confirms actual entry.' },
  { id: 'open-gps', number: 4, gated: false, driverConfirms: false, title: 'No gate · automatic GPS', detail: 'GPS alerts the attendant, who confirms actual entry. No driver taps.' },
];
const clamp = value => Math.max(0, Math.min(1, value));
const lerp = (from, to, fraction) => from + (to - from) * clamp(fraction);
const timestamp = ms => `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}`;

function narration(scenario, phase, crossed, checkedIn) {
  const { gated, driverConfirms } = scenario;
  if (phase === 0) return ['A space is already reserved.', `The driver has a valid booking at a ${gated ? 'gated' : 'gate-free'} parking lot. Their space is held.`];
  if (phase === 1) return ['The driver is getting closer.', 'With location permission, GPS checks the approach and estimated arrival time.'];
  if (phase === 2) return driverConfirms
    ? ['GPS detects the nearby driver.', 'The driver will confirm arrival at the entrance. The attendant’s arrival alert is sent after that confirmation.']
    : ['GPS alerts the attendant automatically.', 'The car enters the arrival zone. The attendant receives the booking and plate without any driver confirmation.'];
  if (phase === 3) return driverConfirms
    ? ['The driver confirms arrival.', 'The car is at the entrance. The driver taps Confirm my arrival to notify the attendant.']
    : ['The driver reaches the entrance.', `The attendant already has the GPS alert. The driver waits for ${gated ? 'the attendant to open the gate' : 'a clear entrance'}, without using the phone.`];
  if (phase === 4) return ['The attendant identifies the car.', `${driverConfirms ? 'The driver’s confirmation' : 'The GPS alert'} shows the booking and plate. The attendant checks the arriving vehicle.`];
  if (phase === 5) return gated
    ? ['The attendant opens the gate.', 'The barrier lifts. The space remains held until actual vehicle passage.']
    : ['The car approaches the open entrance.', 'There is no gate to open. The attendant waits to observe the car actually entering.'];
  if (phase === 6) return gated
    ? ['Gate open. Ready to enter.', 'The car has not crossed yet, so physical occupancy is still 5 of 8.']
    : ['Open entrance. No barrier.', 'The driver can enter when clear. GPS or a driver arrival confirmation alone does not count the car as parked.'];
  if (phase === 7) {
    if (checkedIn) return ['Entry confirmed. Occupancy updated.', `The car has crossed the entrance. ${gated ? 'Passage confirmation' : 'The attendant’s entry confirmation'} changes occupancy once, from 5 to 6.`];
    if (crossed) return ['The attendant confirms actual entry.', 'The car is visibly inside the lot. Tap Confirm driver arrival on the attendant screen to update occupancy.'];
    return ['The car crosses the entrance.', gated ? 'A simulated passage sensor waits for the whole vehicle to cross.' : 'The attendant watches the vehicle cross. The space stays held until actual entry is confirmed.'];
  }
  return ['Parked. Arrival complete.', gated ? 'Entry is confirmed, the gate closes, and the reservation becomes an occupied space.' : 'The attendant has confirmed entry. The car is parked, with no gate involved.'];
}

export default function ArrivalWorkflows({ MapView }) {
  const { world, gateLot, p } = useParking();
  const location = world.lots.find(lot => lot.id === gateLot)?.name || 'GoPark parking';
  const name = p.name.split(' ')[0], plate = p.plate || 'B123456';
  const [caseId, setCaseId] = useState(CASES[0].id);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timeRef = useRef(0), stopAt = useRef(DURATION);
  const scenario = CASES.find(item => item.id === caseId);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame, previous = performance.now();
    const tick = current => {
      const elapsed = Math.min(current - previous, 100) * speed;
      previous = current;
      timeRef.current = Math.min(timeRef.current + elapsed, stopAt.current);
      setTime(timeRef.current);
      if (timeRef.current >= stopAt.current) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  function seek(value, play = false, until = DURATION) {
    timeRef.current = value; stopAt.current = until;
    setTime(value); setPlaying(play);
  }
  function chooseCase(id) { seek(0); setCaseId(id); }
  function togglePlay() {
    if (playing) setPlaying(false);
    else seek(time >= DURATION ? 0 : time, true);
  }
  function tryCase() {
    // Interactive playback stops at the next human action, never at an invented check-in.
    seek(1000, true, scenario.driverConfirms || scenario.gated ? 9500 : 21400);
  }
  function confirmDriver() {
    if (!scenario.driverConfirms || time < 9500) return;
    // An open lot needs no gate authorization, so the car can continue toward the lot.
    seek(13000, !scenario.gated, scenario.gated ? DURATION : 21400);
  }
  const phase = STAGE_TIMES.findLastIndex(at => time >= at);
  const driverConfirmed = scenario.driverConfirms && time >= 13000;
  const notified = time >= (scenario.driverConfirms ? 13000 : 6500);
  const crossed = time >= 21200;
  const checkedIn = scenario.gated ? crossed : time >= 22400;
  const gateOpen = scenario.gated && phase >= 6 && phase < 8;
  const canOpen = scenario.gated && time >= 9500 && (!scenario.driverConfirms || driverConfirmed);
  const canConfirmEntry = !scenario.gated && crossed && (!scenario.driverConfirms || driverConfirmed);
  const [title, description] = narration(scenario, phase, crossed, checkedIn);
  const distance = time < 1000 ? 480 : time < 6500 ? Math.round(lerp(480, 120, (time - 1000) / 5500)) : time < 9500 ? Math.round(lerp(120, 8, (time - 6500) / 3000)) : 0;
  const gateAngle = !scenario.gated ? 0 : reducedMotion ? (gateOpen ? -88 : 0) : -88 * clamp((time - 16000) / 1800) * (1 - clamp((time - 24200) / 900));
  const gateStatus = !scenario.gated ? 'No gate' : phase >= 8 ? (time < 25100 ? 'Closing' : 'Closed') : gateOpen ? 'Open' : phase === 5 ? 'Opening' : 'Closed';
  const milestones = [
    { at: 5000, label: 'Approach', icon: Navigation },
    { at: scenario.driverConfirms ? 13000 : 6500, label: scenario.driverConfirms ? 'Driver confirms' : 'GPS notifies', icon: scenario.driverConfirms ? Smartphone : BellRing },
    { at: scenario.gated ? 17800 : 21200, label: scenario.gated ? 'Attendant opens' : 'Car enters', icon: scenario.gated ? LockKeyhole : Navigation },
    { at: scenario.gated ? 21200 : 22400, label: scenario.gated ? 'Entry confirmed' : 'Attendant confirms', icon: ShieldCheck },
    { at: 26000, label: 'Parked', icon: CheckCircle2 },
  ];

  const driverMessage = checkedIn ? 'You are checked in. Enjoy your stop.'
    : crossed ? 'You have entered. The attendant will confirm your arrival.'
    : phase >= 5 ? scenario.gated ? 'The attendant is handling the gate. Proceed slowly when clear.' : 'There is no gate. Enter slowly when the entrance is clear.'
    : driverConfirmed ? `Your confirmation was sent. The attendant will ${scenario.gated ? 'open the gate' : 'confirm your entry'}.`
    : scenario.driverConfirms ? phase >= 3 ? 'You are at the entrance. Confirm your arrival below.' : 'GPS assistance is on. Confirm arrival when you reach the entrance.'
    : notified ? `The attendant was notified automatically. ${scenario.gated ? 'Wait for the gate to open.' : 'No confirmation is needed on your phone.'}` : 'GPS will notify the attendant when you are close. No app action is needed.';

  return <section className="arrival-demo" aria-label="Visual driver arrival simulation" data-case={caseId}>
    <div className="arrival-heading"><div><span className="eyebrow">AN ARRIVAL, IN MOTION</span><h2>Every arrival. Four clear cases<span>.</span></h2><p>Compare gated and open lots, with or without driver confirmation.</p></div><span className="arrival-demo-tag"><i />Visual simulation</span></div>

    <div className="arrival-cases" role="group" aria-label="Choose an arrival case">
      {CASES.map(item => <button key={item.id} className={caseId === item.id ? 'selected' : ''} aria-pressed={caseId === item.id} aria-label={`Case ${item.number}: ${item.title}`} data-testid={`case-${item.id}`} onClick={() => chooseCase(item.id)}><span className="arrival-case-number">0{item.number}</span><span><b>{item.title}</b><small>{item.detail}</small></span>{item.gated ? <LockKeyhole size={17}/> : <Navigation size={17}/>}</button>)}
    </div>
    <div className="arrival-case-explanation" data-testid="demo-case-summary"><span>CASE {scenario.number}</span><p>{scenario.driverConfirms ? 'Driver confirms arrival' : 'GPS automatically notifies attendant'}<ArrowRight size={12}/>{scenario.gated ? 'Attendant opens gate' : 'Car enters; attendant confirms arrival'}<ArrowRight size={12}/>Checked in</p></div>
    <div className="arrival-toolbar"><span className="arrival-control-tag">{scenario.gated ? <LockKeyhole size={14}/> : <Navigation size={14}/>}{scenario.gated ? 'Gated entrance' : 'Open entrance · no gate'}</span><span className="arrival-booking-tag"><ShieldCheck size={14}/>One valid booking · {plate}</span></div>

    <div className="arrival-player-controls arrival-top-controls"><button className="button primary" onClick={togglePlay}>{playing ? <Pause size={16}/> : time >= DURATION ? <RotateCcw size={16}/> : <Play size={16}/>} {playing ? 'Pause demo' : time >= DURATION ? 'Replay demo' : time > 0 ? 'Resume demo' : 'Play full demo'}</button><button className="button secondary" onClick={tryCase}><Smartphone size={15}/>Try this case</button><button className="button secondary" disabled={time >= DURATION} onClick={() => seek(NEXT_EVENTS.find(value => value > time + 1) ?? DURATION)}><SkipForward size={15}/>Next event</button><button className="arrival-reset" aria-label="Reset arrival demo" onClick={() => seek(0)}><RotateCcw size={16}/></button><div className="arrival-speed" role="group" aria-label="Playback speed">{[1, 2].map(value => <button key={value} aria-pressed={speed === value} className={speed === value ? 'active' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</div></div>

    <div className="arrival-layout">
      <div className="arrival-map-panel">
        <div className="arrival-map-top"><span><MapPin size={15}/>{location}</span><span><Radio size={13}/>Demo GPS</span></div>
        <MapView time={time} phase={phase} crossed={crossed} checkedIn={checkedIn} hasGate={scenario.gated} gateAngle={gateAngle} location={location} reducedMotion={reducedMotion}/>
        <div className="arrival-map-readings"><div><Navigation size={16}/><span><small>Distance to entrance</small><b data-testid="demo-distance">{crossed ? 'Inside parking' : `${distance} m`}</b></span></div><div><Clock3 size={16}/><span><small>Estimated arrival</small><b>{crossed ? 'Arrived' : phase >= 3 ? 'At the entrance' : distance > 120 ? 'About 2 min' : 'Under 1 min'}</b></span></div><div><LockKeyhole size={16}/><span><small>{scenario.gated ? 'Barrier' : 'Entrance'}</small><b data-testid="demo-gate-status">{gateStatus}</b></span></div></div>
        <div className="arrival-narration" role="status" aria-live="polite" aria-atomic="true"><span className="arrival-step-number">{String(phase + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{description}</p></div></div>
        <div className="arrival-occupancy"><div className={checkedIn ? 'counted' : ''}><small>Confirmed occupied</small><strong data-testid="demo-occupied">{checkedIn ? 6 : 5}<span> / 8</span></strong></div><div><small>Your reservation</small><strong className="arrival-reservation-status" data-testid="demo-reservation">{checkedIn ? <><Check size={15}/>Checked in</> : <><LockKeyhole size={14}/>Held</>}</strong></div><div><small>Bookable spaces</small><strong data-testid="demo-bookable">2<span> available</span></strong></div></div>
        <p className="arrival-capacity-note">{crossed && !checkedIn ? 'Vehicle entry is awaiting the attendant’s confirmation. The reservation stays held until it is confirmed.' : 'Your booking already holds one space. Confirmed entry converts that hold to occupied, so bookable availability stays at 2.'}</p>
      </div>

      <div className="arrival-devices">
        <section className="arrival-device arrival-driver" aria-label="Simulated driver phone"><div className="arrival-device-heading"><span className="arrival-device-icon"><Smartphone size={17}/></span><div><h3>Driver’s phone</h3><small>{name} · {plate}</small></div><span className="arrival-online"><Wifi size={12}/>Online</span></div>
          <div className="arrival-driver-booking"><span className="eyebrow">YOUR RESERVED SPACE</span><h4>{location}</h4><span><CheckCircle2 size={13}/>{driverConfirmed ? 'Your arrival confirmation was sent' : notified ? 'Booking sent to the attendant' : 'Booking confirmed'}</span></div>
          <div className="arrival-driver-message"><span className={`arrival-status-dot ${notified ? 'active' : ''}`}/><p>{driverMessage}</p></div>
          {scenario.driverConfirms && !driverConfirmed ? <><div className="arrival-confirm-note"><Smartphone size={15}/><span>This case requires one driver tap at the entrance.</span></div><button className="button primary wide" disabled={time < 9500} onClick={confirmDriver}>Confirm my arrival</button></> : <>
            <div className="arrival-hands-free"><ShieldCheck size={17}/><div><b>{scenario.driverConfirms ? 'Confirmation sent' : 'No action needed'}</b><span>{scenario.driverConfirms ? `The attendant will ${scenario.gated ? 'handle the gate' : 'confirm actual entry'}.` : `GPS sends the alert. The attendant ${scenario.gated ? 'opens the gate' : 'confirms actual entry'}.`}</span></div></div>
            <div className={`arrival-device-state ${checkedIn ? 'complete' : ''}`}>{checkedIn ? <CheckCircle2 size={16}/> : <Navigation size={16}/>} {checkedIn ? 'Checked in' : notified ? 'Attendant notified' : 'Automatic arrival assistance active'}</div>
          </>}
        </section>

        <section className={`arrival-device arrival-attendant ${notified ? 'has-notification' : ''}`} aria-label="Simulated attendant screen"><div className="arrival-device-heading"><span className="arrival-device-icon"><BellRing size={17}/></span><div><h3>Attendant’s screen</h3><small>{scenario.gated ? 'Gate desk' : 'Open-lot attendant'}</small></div><span className="arrival-alert-count">{notified ? '1 arrival' : 'No alerts'}</span></div>
          {notified ? <div className="arrival-notification" key={caseId}><div><BellRing size={15}/><b>{checkedIn ? 'Driver checked in' : crossed ? 'Vehicle entered · confirm arrival' : phase >= 3 ? `${name} is at the entrance` : `${name} is arriving`}</b><span>Just now</span></div><p>{plate} · {checkedIn ? 'Entry confirmed' : crossed ? 'Actual entry observed' : 'Valid booking · identify the expected car'}</p><span className="arrival-notification-source" data-testid="demo-alert-source"><Radio size={12}/>{scenario.driverConfirms ? 'Driver-confirmed arrival notification' : 'Automatic GPS arrival notification'}</span></div> : <div className="arrival-notification-empty"><BellRing size={23}/><p>{scenario.driverConfirms ? 'Waiting for driver confirmation.' : 'Waiting for approaching drivers.'}</p><span>{scenario.driverConfirms ? 'The driver confirms arrival at the entrance.' : 'GPS sends the arrival alert automatically.'}</span></div>}
          <div className="arrival-attendant-status"><span>Vehicle identification</span><b>{notified ? <><Check size={13}/>{plate} · booking found</> : 'Arrival not yet notified'}</b></div>
          <div className="arrival-attendant-status"><span>Next staff action</span><b>{scenario.gated ? 'Open gate after vehicle check' : 'Confirm observed vehicle entry'}</b></div>
          {scenario.gated && phase < 5 ? <><p className="arrival-attendant-instruction">{scenario.driverConfirms && !driverConfirmed ? 'Wait for the driver’s arrival confirmation, then identify the vehicle.' : `Check plate ${plate} at the entrance, then open the gate.`}</p><button className="button primary wide" disabled={!canOpen} onClick={() => seek(16000, true)}>Open gate for driver</button></>
          : !scenario.gated && !checkedIn ? <><p className="arrival-attendant-instruction">{canConfirmEntry ? 'The car is inside. Confirm its actual entry to record check-in.' : 'Confirm only after seeing the car enter. A GPS alert or driver tap alone does not update occupancy.'}</p><button className="button primary wide" disabled={!canConfirmEntry} onClick={() => seek(22400, true)}>Confirm driver arrival</button></>
          : <div className={`arrival-attendant-footer ${checkedIn ? 'complete' : ''}`}><ShieldCheck size={14}/>{checkedIn ? 'Confirmed entry · counted once' : 'Gate opened by attendant · watching passage'}</div>}
        </section>
      </div>
    </div>

    <div className="arrival-player"><div className="arrival-scrubber"><input type="range" aria-label="Arrival demo timeline" min="0" max={DURATION} step="100" value={time} style={{ '--demo-progress': `${time / DURATION * 100}%` }} onChange={event => seek(Number(event.target.value))}/><span>{timestamp(time)} / 0:26</span></div><ol className="arrival-milestones">{milestones.map((milestone, index) => <li key={milestone.label} className={time >= milestone.at ? 'reached' : ''}><button onClick={() => seek(milestone.at)} aria-label={`Show ${milestone.label.toLowerCase()} event`}><span>{time >= milestone.at ? <Check size={14}/> : <milestone.icon size={14}/>}</span><b>{milestone.label}</b></button>{index < milestones.length - 1 && <ArrowRight size={13}/>}</li>)}</ol></div>
    <p className="arrival-demo-footnote"><Play size={12}/>Play full demo animates every actor’s steps. Try this case pauses for the required driver or attendant action. All GPS, notifications, vehicle passages and gate movements are simulated; saved bookings are unchanged.</p>
  </section>;
}
