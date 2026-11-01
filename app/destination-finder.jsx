'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Compass, MapPin, Navigation, Search, ShieldCheck, X } from 'lucide-react';
import { useParking, money, clock } from './context';
import { now } from '../lib/parking.mjs';
import { DESTINATION_PRESETS, coordinatesFromText, presetFromText, parkingNearDestination, formatDistance } from '../lib/destinations.mjs';

const localInput = value => new Date(value - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
function walkingLink(lot, destination) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1'); url.searchParams.set('origin', `${lot.lat},${lot.lon}`);
  url.searchParams.set('destination', `${destination.lat},${destination.lon}`); url.searchParams.set('travelmode', 'walking');
  return url.href;
}

export default function DestinationFinder() {
  const { world, personId, openLot, setSelected, busy: appBusy } = useParking();
  const [query, setQuery] = useState(''), [destination, setDestination] = useState(null);
  const [arrival, setArrival] = useState(() => localInput(now(world) + 15 * 60000));
  const [duration, setDuration] = useState(2), [choices, setChoices] = useState([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const request = useRef(null), revision = useRef(0), arrivalInput = useRef(null);
  useEffect(() => () => { revision.current++; request.current?.abort(); }, []);

  function cancelSearch() { revision.current++; request.current?.abort(); setLoading(false); }
  function choose(place) {
    cancelSearch(); setDestination(place); setQuery(place.name); setChoices([]); setError('');
  }
  function editQuery(value) {
    cancelSearch(); setQuery(value); setDestination(null); setChoices([]); setError('');
  }
  async function search(event) {
    event.preventDefault(); cancelSearch(); setError(''); setChoices([]); setDestination(null);
    const version = revision.current;
    try {
      const direct = coordinatesFromText(query) || presetFromText(query);
      if (direct) { choose(direct); return; }
      if (query.trim().length < 3) throw new Error('Enter a place or address, or choose a quick destination.');
      const controller = new AbortController();
      request.current = controller; setLoading(true);
      const response = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim() }), signal: controller.signal });
      const data = await response.json();
      if (version !== revision.current) return;
      if (!response.ok) throw new Error(data.error || 'Place search could not be completed.');
      if (!Array.isArray(data.results) || !data.results.length) throw new Error('No matching place was found. Try a fuller address in Lebanon, a quick destination, or latitude, longitude.');
      if (data.results.length === 1) choose(data.results[0]);
      else setChoices(data.results);
    } catch (failure) {
      if (version === revision.current && failure.name !== 'AbortError') setError(failure.message || 'Could not find this destination.');
    } finally {
      if (version === revision.current) setLoading(false);
    }
  }

  const startsAt = new Date(arrival).getTime();
  let result = null, planError = '';
  if (destination) {
    try { result = parkingNearDestination(world, destination, { personId, startsAt, hours: duration }); }
    catch (failure) { planError = failure.message; }
  }
  const nearest = result?.matches[0];
  useEffect(() => { if (nearest) setSelected(nearest.id); }, [nearest?.id, setSelected]);
  function reserve(lot) {
    openLot(lot.id, { startsAt, hours: duration, destination: { name: destination.name, lat: destination.lat, lon: destination.lon } });
  }

  return <section className="destination-finder" aria-labelledby="destination-title">
    <div className="destination-heading"><span className="destination-heading-icon"><Compass size={22}/></span><div><span className="eyebrow">PARK NEAR YOUR PLANS</span><h2 id="destination-title">Where are you going?</h2><p>Enter your destination. We’ll find the closest available GoPark space.</p></div></div>
    <form className="destination-form" onSubmit={search}>
      <label className="destination-input"><MapPin size={18}/><input aria-label="Your destination" aria-describedby="destination-help" placeholder="Place, address, or latitude, longitude" value={query} onChange={event => editQuery(event.target.value)} maxLength={180}/>{query && <button type="button" aria-label="Clear destination" onClick={() => editQuery('')}><X size={15}/></button>}</label>
      <button className="button primary" type="submit" disabled={loading || !query.trim()}><Search size={16}/>{loading ? 'Finding place…' : 'Find closest parking'}</button>
    </form>
    <p className="destination-help" id="destination-help">Search a place or address in Lebanon, or enter coordinates. Online searches run when you submit.</p>
    <div className="destination-quick"><span>Try a demo destination</span><div>{DESTINATION_PRESETS.map(place => <button className={destination?.id === place.id ? 'active' : ''} aria-label={`Use destination ${place.name}`} key={place.id} onClick={() => choose(place)}>{place.name}</button>)}</div></div>
    <div className="destination-plan"><label className="field"><span><Clock3 size={13}/>Arrival · device local time</span><input ref={arrivalInput} aria-label="Destination parking arrival time" type="datetime-local" min={localInput(now(world))} value={arrival} onChange={event => setArrival(event.target.value)}/></label><label className="field">Parking duration<select aria-label="Destination parking duration" value={duration} onChange={event => setDuration(Number(event.target.value))}>{[1, 2, 3, 4].map(hours => <option key={hours} value={hours}>{hours} hour{hours > 1 ? 's' : ''}</option>)}</select></label></div>

    {error && <p className="destination-error" role="alert">{error}</p>}
    {!!choices.length && <div className="destination-choices"><h3>Which place did you mean?</h3><ul aria-label="Matching destinations">{choices.map(place => <li key={place.id}><button onClick={() => choose(place)} aria-label={`Choose destination ${place.name}`}><MapPin size={17}/><span><b>{place.name}</b><small>{place.description}</small></span><ArrowRight size={15}/></button></li>)}</ul></div>}

    {destination && <div className="destination-selected"><span><MapPin size={16}/><b>{destination.name}</b></span><small>{destination.source === 'demo-preset' ? 'Illustrative demo destination' : destination.source === 'coordinates' ? 'Your coordinates' : 'Place matched'} · {destination.lat.toFixed(5)}, {destination.lon.toFixed(5)}</small></div>}
    {planError && <p className="destination-error" role="alert">{planError}</p>}

    {result && <div className="destination-results" aria-live="polite">
      {nearest ? <>
        <article className="destination-best" data-testid="nearest-parking" data-lot-id={nearest.id}>
          <div className="destination-best-top"><span><CheckCircle2 size={14}/>CLOSEST AVAILABLE</span><b>{formatDistance(nearest.distance)}<small> from your destination</small></b></div>
          <div className="destination-best-main"><div><h3>{nearest.name}</h3><p><MapPin size={12}/>{nearest.area}</p><span className="destination-capacity"><i/>{nearest.available} spaces for {clock(result.startsAt)}–{clock(result.endsAt)}</span></div><div className="destination-price"><b>{money(nearest.total)}</b><small>for {duration} hour{duration > 1 ? 's' : ''} · tier price</small></div></div>
          <div className="destination-proximity" aria-label={`${nearest.name} is ${formatDistance(nearest.distance)} in a straight line from ${destination.name}`}><span className="destination-parking-icon">P</span><div><i/><span>{formatDistance(nearest.distance)} · straight-line distance</span></div><MapPin size={21}/></div>
          <div className="button-row"><button className="button primary" disabled={appBusy} onClick={() => reserve(nearest)}>Reserve closest parking<ArrowRight size={16}/></button><a className="button secondary" href={walkingLink(nearest, destination)} target="_blank" rel="noreferrer"><Navigation size={15}/>Walking route</a></div>
          {nearest.inconvenient && <p className="destination-conditions">Roadside location: review and accept its conditions before booking.</p>}
        </article>
        {result.matches.length > 1 && <div className="destination-alternatives"><h3>Other available options · nearest first</h3>{result.matches.slice(1, 4).map(lot => <article key={lot.id}><span className="destination-alternative-icon">P</span><div><b>{lot.name}</b><small>{formatDistance(lot.distance)} away · {lot.available} spaces · {money(lot.total)} for your stay</small></div><button aria-label={`Reserve alternative ${lot.name}`} onClick={() => reserve(lot)}><ArrowRight size={17}/></button></article>)}</div>}
      </> : <div className="destination-empty"><MapPin size={29}/><h3>{!result.nearby.length ? 'No GoPark locations within 5 km.' : 'No available parking for this visit.'}</h3><p>{!result.nearby.length ? 'This demo’s parking network is in Beirut. Try a closer destination.' : 'Nearby locations are full for this interval, reserved for another tier, or held for a priority queue. Try another arrival time or duration.'}</p><button className="button secondary" onClick={() => arrivalInput.current?.focus()}>Change arrival time</button></div>}
      {result.nearby.some(lot => lot.reason) && <p className="destination-skipped"><ShieldCheck size={12}/>{result.nearby.filter(lot => lot.reason).length} nearby location(s) excluded because of capacity, access, or queue rules.</p>}
      <p className="destination-disclaimer">Ranked by straight-line distance to your destination, not road distance. Availability covers your full visit and is checked again when you reserve. Parking locations and prices are illustrative.</p>
    </div>}
    <p className="destination-attribution">Online place search: <a href="https://github.com/komoot/photon" target="_blank" rel="noreferrer">Photon</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. Quick destinations and coordinates also work without online place lookup.</p>
  </section>;
}
