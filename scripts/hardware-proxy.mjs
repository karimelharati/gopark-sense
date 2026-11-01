import http from 'node:http';
// Explicit opt-in bridge. Exposes only the token-authenticated hardware API.
const server=http.createServer(async(request,response)=>{
  const pathname=new URL(request.url,'http://local-device-bridge').pathname;
  if(pathname==='/health'&&request.method==='GET'){response.writeHead(200,{'Content-Type':'application/json'});response.end('{"bridge":"gopark-hardware"}');return;}
  if(pathname!=='/api/hardware'||!['GET','POST'].includes(request.method)){response.writeHead(404);response.end('Hardware route only.');return;}
  try{let body='';for await(const chunk of request){body+=chunk;if(body.length>8192)throw new Error('Device payload too large.');}
    const upstream=await fetch('http://127.0.0.1:4173/api/hardware',{method:request.method,headers:{'Authorization':request.headers.authorization||'','Content-Type':'application/json'},body:request.method==='POST'?body:undefined,signal:AbortSignal.timeout(10000)});
    response.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(await upstream.text());
  }catch{response.writeHead(503,{'Content-Type':'application/json'});response.end('{"error":"Local GoPark hardware service unavailable."}');}
});
server.listen(4174,process.argv.includes('--loopback-test')?'127.0.0.1':'0.0.0.0',()=>console.log('Opt-in GoPark hardware bridge listening on port 4174. Only /api/hardware is forwarded.'));
