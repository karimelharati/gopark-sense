import { env } from 'cloudflare:workers';
import { newKeyPair,importPrivate,signBlob,hash } from './pass-crypto.mjs';
export async function issuerKeys(owner: string) {
  let row = await env.DB!.prepare('SELECT private_jwk, public_jwk FROM parking_keys WHERE owner = ?').bind(owner).first<{private_jwk:string;public_jwk:string}>();
  if(!row){const pair=await newKeyPair();const privateJwk=await crypto.subtle.exportKey('jwk',pair.privateKey);const publicJwk=await crypto.subtle.exportKey('jwk',pair.publicKey);await env.DB!.prepare('INSERT OR IGNORE INTO parking_keys (owner, private_jwk, public_jwk) VALUES (?, ?, ?)').bind(owner,JSON.stringify(privateJwk),JSON.stringify(publicJwk)).run();row=await env.DB!.prepare('SELECT private_jwk, public_jwk FROM parking_keys WHERE owner = ?').bind(owner).first<{private_jwk:string;public_jwk:string}>();}
  if(!row)throw new Error('Unable to load the offline pass issuer.');const publicKey=JSON.parse(row.public_jwk);return {publicKey,privateKey:await importPrivate(JSON.parse(row.private_jwk)),issuer:await hash(JSON.stringify(publicKey))};
}
export async function trustManifest(owner:string,world:any){const keys=await issuerKeys(owner);return {publicKey:keys.publicKey,issuer:keys.issuer,manifest:await signBlob({at:Date.now()+world.offset,bookings:world.bookings.map((b:any)=>({id:b.id,status:b.status,version:b.version}))},keys.privateKey)};}
