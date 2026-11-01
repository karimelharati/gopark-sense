'use client';
import { useId } from 'react';
import ArrivalWorkflows from './arrival-workflows';

const clamp = value => Math.max(0, Math.min(1, value));
const lerp = (from, to, fraction) => from + (to - from) * clamp(fraction);

function carPosition(time) {
  if (time < 1000) return { x: 100, y: 286, angle: 0 };
  if (time < 6500) return { x: lerp(100, 540, (time - 1000) / 5500), y: 286, angle: 0 };
  if (time < 9500) return { x: lerp(540, 660, (time - 6500) / 3000), y: 286, angle: 0 };
  if (time < 20000) return { x: 660, y: 286, angle: 0 };
  const turnLength = Math.PI * 16;
  const travel = clamp((time - 20000) / 4200) * (195 + turnLength + 109);
  if (travel < 195) return { x: 660 + travel, y: 286, angle: 0 };
  if (travel < 195 + turnLength) {
    const angle = (travel - 195) / 32;
    return { x: 855 + 32 * Math.sin(angle), y: 254 + 32 * Math.cos(angle), angle: -angle * 180 / Math.PI };
  }
  return { x: 887, y: 254 - (travel - 195 - turnLength), angle: -90 };
}

function Vehicle({ x, y, angle = 0, color = '#7860b9', active = false }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    {active && <ellipse cx="0" cy="3" rx="40" ry="25" fill="#7761c5" opacity=".1" />}
    <rect x="-20" y="-19" width="13" height="6" rx="2" fill="#3c4545" />
    <rect x="12" y="-19" width="13" height="6" rx="2" fill="#3c4545" />
    <rect x="-20" y="13" width="13" height="6" rx="2" fill="#3c4545" />
    <rect x="12" y="13" width="13" height="6" rx="2" fill="#3c4545" />
    <rect x="-29" y="-16" width="59" height="32" rx="10" fill={color} stroke="#fff" strokeWidth="2" />
    <path d="M-13-12 L9-12 15-8 15 8 9 12-13 12-18 7-18-7Z" fill="#e6eff0" />
    <rect x="-10" y="-10" width="17" height="20" rx="4" fill={color} />
    <rect x="24" y="-11" width="4" height="6" rx="1" fill="#fff0be" />
    <rect x="24" y="5" width="4" height="6" rx="1" fill="#fff0be" />
    <rect x="-28" y="-10" width="3" height="5" rx="1" fill="#da8a78" />
    <rect x="-28" y="5" width="3" height="5" rx="1" fill="#da8a78" />
  </g>;
}

function ArrivalMap({ time, phase, crossed, checkedIn, hasGate, gateAngle, location, reducedMotion }) {
  const uid = useId().replaceAll(':', '');
  const visualTime = reducedMotion ? (phase === 1 ? 6400 : phase === 2 ? 9400 : phase === 7 ? crossed ? 24200 : 20000 : time) : time;
  const position = carPosition(visualTime);
  return <svg viewBox="0 0 1000 470" className="arrival-map-scene" role="img" aria-label={hasGate ? "Animated car approaching a gated lot and parking" : "Animated car entering an open lot with no gate"}>
    <title>Driver arrival at {location}</title>
    <desc>{hasGate ? "The attendant opens the gate after an arrival notification. Occupancy updates after vehicle passage." : "There is no barrier. The attendant confirms actual entry after the vehicle crosses the entrance."}</desc>
    <defs>
      <pattern id={`${uid}-barrier`} patternUnits="userSpaceOnUse" width="22" height="22" patternTransform="rotate(35)"><rect width="22" height="22" fill="#fff7ec" /><rect width="11" height="22" fill="#d89079" /></pattern>
      <pattern id={`${uid}-dots`} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c7cfc0" opacity=".45" /></pattern>
    </defs>
    <rect width="1000" height="470" fill="#f2f3ec" />
    <rect width="1000" height="470" fill={`url(#${uid}-dots)`} />
    <rect x="34" y="33" width="480" height="153" rx="26" fill="#e6ecdf" stroke="#d9e2ce" />
    <path d="M48 154 Q170 59 262 121 T499 84" stroke="#f7f8f1" strokeWidth="19" fill="none" />
    {[{ x: 79, y: 73, r: 24 }, { x: 160, y: 151, r: 19 }, { x: 322, y: 68, r: 27 }, { x: 463, y: 146, r: 24 }].map(tree => <g key={tree.x}><circle cx={tree.x + 3} cy={tree.y + 5} r={tree.r} fill="#b4c5a5" opacity=".4" /><circle cx={tree.x} cy={tree.y} r={tree.r} fill="#c0d0b0" /><circle cx={tree.x - 6} cy={tree.y - 6} r={tree.r * .55} fill="#ccdabf" /></g>)}
    <text x="215" y="81" className="arrival-map-label">AUB gardens</text>
    <text x="217" y="101" className="arrival-map-small">A little less circling.</text>
    <rect x="34" y="377" width="203" height="66" rx="13" fill="#e9e4dc" stroke="#e0dacf" />
    <rect x="258" y="377" width="222" height="66" rx="13" fill="#e9e4dc" stroke="#e0dacf" />
    <text x="60" y="415" className="arrival-map-small">Neighborhood shops</text>
    <text x="298" y="415" className="arrival-map-small">Bliss Street</text>
    <rect x="715" y="35" width="269" height="410" rx="22" fill="#e5e8de" stroke="#d0d8c5" strokeWidth="2" />
    <text x="739" y="69" className="arrival-map-label">GoPark parking</text>
    <text x="739" y="88" className="arrival-map-small">8-space demo lane</text>
    <path d="M0 231H984V343H0" fill="#e1e3de" />
    <path d="M0 235H714M0 339H714" stroke="#fdfdf7" strokeWidth="4" />
    <path d="M0 286H680" stroke="#fbfcf6" strokeWidth="3" strokeDasharray="20 22" />
    <path d="M30 262H71M63 255l8 7-8 7M449 312H408M416 305l-8 7 8 7" fill="none" stroke="#fbfcf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {[0, 1, 2, 3].map(i => <g key={i}>
      <rect x={735 + i * 60} y="105" width="52" height="100" rx="5" fill={i === 2 ? '#eee8f8' : '#eef0e9'} stroke={i === 2 ? '#b9a6d8' : '#fffdf7'} strokeWidth="2" strokeDasharray={i === 2 && !crossed ? '5 5' : undefined} />
      <text x={761 + i * 60} y="123" textAnchor="middle" className="arrival-bay-number">0{i + 1}</text>
      <rect x={735 + i * 60} y="352" width="52" height="76" rx="5" fill="#eef0e9" stroke="#fffdf7" strokeWidth="2" />
      <text x={761 + i * 60} y="418" textAnchor="middle" className="arrival-bay-number">0{i + 5}</text>
    </g>)}
    <Vehicle x={761} y={157} angle={-90} color="#99b0a2" /><Vehicle x={821} y={157} angle={-90} color="#d4b598" /><Vehicle x={941} y={157} angle={-90} color="#a2aebb" />
    <Vehicle x={761} y={385} angle={-90} color="#b2baa2" /><Vehicle x={881} y={385} angle={-90} color="#c4b7c6" />
    {!crossed && <text x="881" y="176" textAnchor="middle" className="arrival-reserved-label">YOUR</text>}
    {!crossed && <text x="881" y="190" textAnchor="middle" className="arrival-reserved-label">SPACE</text>}
    <circle cx="707" cy="286" r="150" fill="#9ebca8" opacity=".10" stroke="#92af9e" strokeWidth="2" strokeDasharray="5 8" />
    {phase >= 2 && phase < 8 && <circle className="arrival-gps-pulse" cx="707" cy="286" r="115" fill="none" stroke="#84aa93" strokeWidth="2" />}
    <rect x="545" y="127" width="139" height="30" rx="15" fill="#fcfdf8" stroke="#dbe3d5" />
    <circle cx="560" cy="142" r="4" fill={phase >= 2 ? '#6e9f80' : '#aab89c'} />
    <text x="572" y="146" className="arrival-map-small">120 m arrival zone</text>
    <path d="M100 286H855Q887 286 887 254V154" stroke="#a99ac8" strokeWidth="3" strokeDasharray="6 9" fill="none" />
    <path d="M713 247V326" stroke={crossed ? '#76a082' : '#ceba83'} strokeWidth="3" strokeDasharray="4 5" />
    {hasGate ? <g data-testid="demo-barrier">
    <rect x="702" y="225" width="24" height="18" rx="5" fill="#728170" />
    <g transform={`rotate(${gateAngle} 714 234)`}><rect x="709" y="234" width="10" height="104" rx="4" fill={`url(#${uid}-barrier)`} stroke="#b7a58e" strokeWidth="1.5" /></g>
    <circle cx="714" cy="234" r="8" fill="#586e5e" /><circle cx="714" cy="234" r="3" fill="#dfe7d6" />
    </g> : <g data-testid="demo-open-entrance"><path d="M699 264l13 12-13 12m0 6 13 12-13 12" fill="none" stroke="#8fac91" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><rect x="670" y="211" width="86" height="24" rx="12" fill="#f9fcf5" stroke="#cfdcca"/><text x="713" y="227" textAnchor="middle" className="arrival-map-small">No gate</text></g>}
    <rect x="646" y="370" width="79" height="29" rx="7" fill="#fbfbf6" stroke="#d8dfd0" /><text x="685" y="389" textAnchor="middle" className="arrival-map-small">Entrance</text>
    <Vehicle {...position} active />
    {phase >= 1 && phase < 8 && <g transform={`translate(${position.x} ${position.y - 45})`}><rect x="-24" y="-10" width="48" height="22" rx="11" fill="#7860b9" /><text y="5" textAnchor="middle" fontSize="11" fontWeight="700" fill="white">YOU</text></g>}
    {checkedIn && <g transform="translate(932 284)"><circle r="17" fill="#79a18a" /><path d="M-7 0l5 5 10-11" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g>}
  </svg>;
}

export default function ArrivalDemo(){return <ArrivalWorkflows MapView={ArrivalMap}/>;}
