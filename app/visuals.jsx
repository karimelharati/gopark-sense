'use client';
import { Crown, ShieldCheck } from 'lucide-react';
import { availability } from '../lib/parking.mjs';

export function LotArt({ style = 'garden', large = false }) {
  const roof = style === 'roof', garden = style === 'garden';
  return <div className={`lot-art ${style} ${large ? 'large' : ''}`} aria-hidden="true"><svg viewBox="0 0 320 180" fill="none">
    <path d="M0 146L187 52 320 120V180H0Z" fill={roof ? '#d8c8c5' : '#cbd8cc'} />
    <path d="M-28 143L163 49 365 151 174 246Z" fill="#939b98" />
    <path d="M-28 132L163 38 365 140 174 235Z" fill={roof ? '#b6aeb6' : '#a8b5ac'} />
    <path d="M-28 125L163 31 365 133 174 228Z" fill={roof ? '#ded7df' : '#dbe1d7'} />
    <path d="M-15 126L164 37 346 130" stroke="#f9f8f2" strokeWidth="3" />
    {[0,1,2,3,4,5].map(i => <path key={i} d={`M${55+i*31} ${91+i*15.5}l39 -19.5`} stroke="#fbfbf4" strokeWidth="2" />)}
    <path d="M-10 164L154 82 329 170" stroke="#f8f9f1" strokeWidth="2" strokeDasharray="12 8" />
    {[{x:103,y:100,c:'#f6f3e8'},{x:166,y:132,c:'#7c6d9d'},{x:228,y:163,c:'#eee5db'},{x:39,y:146,c:'#5e8174'}].map((v,i) => <g key={i} transform={`translate(${v.x} ${v.y})`}><path d="M0 0l27 -14 33 16 -27 14Z" fill="#6c756f" opacity=".2" transform="translate(3 6)" /><path d="M0 -4l27 -14 33 16v10l-27 14L0 6Z" fill={v.c} /><path d="M9 -4l19 -9 20 10 -19 10Z" fill="#61727b" /><path d="M9 -4v5l20 10V7Z" fill="#afbcc1" /></g>)}
    {garden && [25,65,245,281].map((x,i) => <g key={x} transform={`translate(${x} ${i<2 ? 66-i*16 : 74+(i-2)*18})`}><path d="M0 10v22" stroke="#647763" strokeWidth="4" /><ellipse cy="4" rx="17" ry="24" fill={i%2 ? '#789979' : '#92ad8e'} /><ellipse cx="-5" cy="-1" rx="10" ry="17" fill="#a2ba9a" /></g>)}
    {roof && <><path d="M0 76V34l50 -22 36 18v25" fill="#ddd8d9" /><path d="M270 83V28l25 -13 25 13v76" fill="#c9c2cf" /><circle cx="248" cy="28" r="17" fill="#f8e0ae" /></>}
    {!garden && !roof && <><path d="M12 80V12l46 -23 41 21v52" fill="#c5cecc" /><path d="M58 -11v69l41 4V10" fill="#a6b5b3" />{[14,30,46].map(y => <path key={y} d={`M20 ${y}l29 -14`} stroke="#e4e9e4" strokeWidth="5" />)}</>}
  </svg><span className="art-chip">{roof ? <><Crown size={12} /> Gold access</> : <><ShieldCheck size={12} /> Smart entry</>}</span></div>;
}

export function CityMap({ lots, selected, onSelect, world }) {
  const positions = { aub:[29,51], hamra:[47,74], bdd:[80,61], roof:[60,29] };
  return <div className="city-map"><svg viewBox="0 0 1000 350" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <rect width="1000" height="350" fill="#eceee5" /><path d="M0 0H213L171 51 192 78 129 124 144 168 79 204 55 264 0 287Z" fill="#d4e9e7" /><path d="M213 0L171 51 192 78 129 124 144 168 79 204 55 264 0 287" stroke="#fafbf4" strokeWidth="12" />
    {[0,1,2,3,4,5,6,7].map(i => <g key={i}><path d={`M${220+i*115} -60L${110+i*115} 420`} stroke="#fcfcf8" strokeWidth="13" /><path d={`M120 ${-80+i*75}L1080 ${35+i*75}`} stroke="#fcfcf8" strokeWidth="10" /></g>)}
    <path d="M107 141L478 193 1000 100" stroke="#daddd2" strokeWidth="21" /><path d="M107 141L478 193 1000 100" stroke="#fffefa" strokeWidth="15" /><path d="M373 0L322 119 400 350" stroke="#fffefa" strokeWidth="17" /><path d="M224 31L303 40 289 100 210 89Z" fill="#d5dfc8" /><path d="M519 231L594 241 579 307 502 297Z" fill="#d9e1cf" /><path d="M697 45L771 52 758 118 685 110Z" fill="#dde3d0" />
    <g fill="#adb3a7" fontSize="11" fontFamily="system-ui" letterSpacing="2"><text x="73" y="67" transform="rotate(-31 73 67)">MEDITERRANEAN SEA</text><text x="215" y="140">AUB CAMPUS</text><text x="395" y="280">HAMRA</text><text x="550" y="62">CLEMENCEAU</text><text x="794" y="301">BACHOURA</text></g><g fill="#b2b7ad" fontSize="9" fontFamily="system-ui"><text x="477" y="174" transform="rotate(-10 477 174)">Bliss Street</text><text x="602" y="250" transform="rotate(7 602 250)">Hamra Street</text></g>
  </svg><span className="map-location"><span className="pulse" /> Beirut, Lebanon</span>
  {lots.filter(l=>positions[l.id]).map(l => { const a=availability(world,l.id); return <button key={l.id} className={`map-pin ${selected===l.id?'selected':''} ${!a.available?'full':''}`} style={{left:`${positions[l.id][0]}%`,top:`${positions[l.id][1]}%`}} onClick={()=>onSelect(l.id)} aria-label={`View ${l.name}, ${a.available} spaces available`}><span>P</span>{a.available?`$${l.price.toFixed(2)}/h`:'Full'}</button>; })}
  <div className="you-marker" title="Illustrative starting position"><span /><small>You</small></div><span className="map-caption">Illustrative map · demo parking locations</span><span className="map-scale">200 m <i /></span></div>;
}
