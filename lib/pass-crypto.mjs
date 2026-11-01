const encoder=new TextEncoder(),decoder=new TextDecoder();
export const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const unb64=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export const hash=async text=>b64(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
export const newKeyPair=()=>crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
export async function signBlob(value,privateKey){const payload=b64(encoder.encode(JSON.stringify(value)));return {payload,signature:b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,encoder.encode(payload)))};}
export async function readSigned(blob,publicKey){if(!blob||typeof blob.payload!=='string'||typeof blob.signature!=='string'||blob.payload.length>20000)throw new Error('Invalid signed pass.');const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,unb64(blob.signature),encoder.encode(blob.payload));if(!ok)throw new Error('Signature invalid. This pass was changed or not issued by the trusted parking system.');return JSON.parse(decoder.decode(unb64(blob.payload)));}
export const importPublic=jwk=>crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
export const importPrivate=jwk=>crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function base45(bytes){let out='';for(let i=0;i<bytes.length;i+=2){let n=bytes[i];const pair=i+1<bytes.length;if(pair)n=n*256+bytes[i+1];out+=alphabet[n%45]+alphabet[Math.floor(n/45)%45];if(pair)out+=alphabet[Math.floor(n/2025)];}return out;}
function from45(text){const out=[];for(let i=0;i<text.length;i+=3){const size=Math.min(3,text.length-i);if(size===1)throw new Error('Invalid compact pass.');const values=[...text.slice(i,i+size)].map(c=>alphabet.indexOf(c));if(values.some(v=>v<0))throw new Error('Invalid compact pass.');const n=values[0]+45*values[1]+(size===3?2025*values[2]:0);if(n>(size===3?65535:255))throw new Error('Invalid compact pass.');if(size===3)out.push(n>>8,n&255);else out.push(n);}return new Uint8Array(out);}
export async function encodePassToken(token){const compressed=await new Response(new Blob([JSON.stringify(token)]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();return 'GP1:'+base45(new Uint8Array(compressed));}
export async function decodePassToken(text){if(text.length>16000)throw new Error('Pass is too large.');if(!text.startsWith('GP1:'))return JSON.parse(text);const stream=new Blob([from45(text.slice(4))]).stream().pipeThrough(new DecompressionStream('deflate')),reader=stream.getReader(),chunks=[];let size=0;for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16000){await reader.cancel();throw new Error('Expanded pass is too large.');}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(decoder.decode(bytes));}
export async function makeRotatingPass(certificate,privateKey,direction,at=Date.now()){return {v:1,certificate,proof:await signBlob({kind:'presence',certificateHash:await hash(JSON.stringify(certificate)),bucket:Math.floor(at/30000),direction},privateKey)};}
export async function verifyRotatingPass(token,trust,at=Date.now(),seen=[]){
  if(typeof token==='string')token=await decodePassToken(token);
  if(!trust?.publicKey)throw new Error('No trusted issuer is cached. Synchronize the verifier before going offline.');
  const cert=await readSigned(token.certificate,await importPublic(trust.publicKey));
  if(cert.kind!=='booking-pass'||cert.issuer!==trust.issuer||at<(cert.validFrom??cert.startsAt-15*60000)||at>cert.expiresAt)throw new Error('Pass is outside its validity period or belongs to another issuer.');
  const proof=await readSigned(token.proof,await importPublic(cert.deviceKey));
  if(proof.kind!=='presence'||proof.certificateHash!==await hash(JSON.stringify(token.certificate))||!Number.isInteger(proof.bucket)||Math.abs(Math.floor(at/30000)-proof.bucket)>1||!['entry','exit'].includes(proof.direction))throw new Error('Rotating proof expired or invalid. Ask the driver to refresh the code.');
  const replayId=`${cert.bookingId}:${cert.bookingVersion}:${proof.direction}`;
  if(seen.includes(replayId))throw new Error('This booking/version already has an offline crossing recorded in that direction.');
  const manifest=trust.manifest?await readSigned(trust.manifest,await importPublic(trust.publicKey)):null;
  const status=manifest?.bookings?.find(b=>b.id===cert.bookingId);
  if(status&&(['cancelled','no_show','disrupted','completed'].includes(status.status)||status.version!==cert.bookingVersion))throw new Error('Cached records show this pass was cancelled, changed or completed. Ask staff to reconcile it.');
  return {valid:true,certificate:cert,direction:proof.direction,replayId,statusKnown:!!status,provisional:true,snapshotAt:manifest?.at||null,warning:'Signature and recent device proof verified. Offline revocation and cross-device replay cannot be ruled out. Staff must identify the vehicle and observe its passage.'};
}
