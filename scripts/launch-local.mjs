import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(project, '.sites-runtime');
const address = 'http://127.0.0.1:4173';
const recordFile = path.join(runtime, 'desktop-server.json');
const node = process.execPath;
const wrangler = path.join(project, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const environment = { ...process.env, PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH || ''}` };
fs.mkdirSync(runtime, { recursive: true });

async function probe() {
  try {
    const response = await fetch(address + '/api/state', { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    const data = await response.json();
    if (response.ok && Array.isArray(data.lots) && Array.isArray(data.bookings) && data.rules) return true;
    throw new Error(data.error || 'Another application is using the GoPark port.');
  } catch (error) {
    if (error.name === 'TypeError' || error.name === 'TimeoutError') return false;
    throw error;
  }
}

async function stop() {
  if (!fs.existsSync(recordFile)) { console.log('No GoPark desktop server was started by this launcher.'); return; }
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  if (record.project !== project) throw new Error('The local server record does not match this project.');
  // Verify the complete owned command before stopping any PID, including the opt-in bridge.
  for(const [pid,expected] of [[record.pid,wrangler],[record.proxyPid,path.join(project,'scripts','hardware-proxy.mjs')]]) {
    if(!Number.isInteger(pid))continue;
    const check=spawnSync('powershell.exe',['-NoProfile','-Command',`Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object -ExpandProperty CommandLine`],{windowsHide:true,encoding:'utf8'});
    if(!(check.stdout||'').includes(expected))continue;
    const result=spawnSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,encoding:'utf8'});
    if(result.status!==0)throw new Error('Could not stop a GoPark local process.');
  }
  console.log('GoPark stopped. Your bookings and points remain saved locally.');
}

async function start() {
  if (!fs.existsSync(path.join(project, 'dist', 'server', 'wrangler.json'))) throw new Error('The app build is missing. See README.md for the build steps.');
  if (!(await probe())) {
    const log = fs.openSync(path.join(runtime, 'desktop-server.log'), 'a');
    const child = spawn(node, ['--import', pathToFileURL(path.join(project, 'scripts', 'sites-env.mjs')).href, wrangler, 'dev', '--config', path.join(project, 'dist', 'server', 'wrangler.json'), '--local', '--persist-to', path.join(project, '.wrangler', 'state'), '--ip', '127.0.0.1', '--port', '4173', '--inspector-port', '0'], {
      cwd: project, env: environment, detached: true, windowsHide: true, stdio: ['ignore', log, log],
    });
    let startupFailed = false;
    child.on('error', error => { startupFailed = true; fs.appendFileSync(path.join(runtime, 'desktop-server.log'), `\n${error.message}\n`); });
    child.on('exit', () => { startupFailed = true; });
    child.unref(); fs.closeSync(log);
    fs.writeFileSync(recordFile, JSON.stringify({ pid: child.pid, project, startedAt: new Date().toISOString() }, null, 2));
    let ready = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (startupFailed) throw new Error('The local server exited. See .sites-runtime/desktop-server.log.');
      if (await probe()) { ready = true; break; }
    }
    if (!ready) throw new Error('GoPark did not start. See .sites-runtime/desktop-server.log.');
  }
  console.log(`GoPark is running locally at ${address}`);
  if (process.argv.includes('--lan')) {
    const proxyScript=path.join(project,'scripts','hardware-proxy.mjs');
    let exists=false;
    try { const response=await fetch('http://127.0.0.1:4174/health',{signal:AbortSignal.timeout(1000)});const value=await response.json();if(value.bridge!=='gopark-hardware')throw new Error('Port 4174 is used by another application.');exists=true; } catch(error) { if(error.name!=='TypeError'&&error.name!=='TimeoutError')throw error; }
    if(!exists){const log=fs.openSync(path.join(runtime,'hardware-bridge.log'),'a');const proxy=spawn(node,[proxyScript],{cwd:project,env:environment,detached:true,windowsHide:true,stdio:['ignore',log,log]});proxy.unref();fs.closeSync(log);const record=JSON.parse(fs.readFileSync(recordFile,'utf8'));record.proxyPid=proxy.pid;fs.writeFileSync(recordFile,JSON.stringify(record,null,2));}
    console.log('Opt-in hardware bridge: port 4174. The app itself remains loopback-only.');
  }
  if (process.argv.includes('--no-open')) return;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  ];
  const browser = candidates.find(file => fs.existsSync(file));
  if (!browser) throw new Error(`Open ${address} in your browser. Chrome or Edge is needed for a separate app window.`);
  const window = spawn(browser, [`--app=${address}${process.argv.includes('--arrival-demo')?'/?view=arrival':''}`, `--user-data-dir=${path.join(runtime, 'desktop-browser')}`, '--window-size=1280,860', '--no-first-run', '--no-default-browser-check'], { detached: true, windowsHide: false, stdio: 'ignore' });
  window.on('error', error => console.error(error.message)); window.unref();
}

try { await (process.argv.includes('--stop') ? stop() : start()); }
catch (error) { fs.appendFileSync(path.join(runtime, 'desktop-launcher.log'), `${new Date().toISOString()} ${error.stack}\n`); console.error(error.message); process.exitCode = 1; }
