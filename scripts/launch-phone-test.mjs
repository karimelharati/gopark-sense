import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(project, '.sites-runtime');
fs.mkdirSync(runtime, { recursive: true });
const recordPath = path.join(runtime, 'phone-test-server.json');
const tunnelBinary = path.join(project, '..', '.tools', 'phone-test', 'cloudflared.exe');
const serverScript = path.join(project, 'scripts', 'phone-test-server.mjs');
const address = 'http://127.0.0.1:4175';
const children = [];
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));
let record;
try { record = JSON.parse(fs.readFileSync(recordPath, 'utf8')); } catch { record = null; }
async function request(endpoint, data) {
  const response = await fetch(address + endpoint, { method: data ? 'POST' : 'GET', headers: { Authorization: `Bearer ${record.adminToken}`, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(2000) });
  const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Phone test unavailable.'); return value;
}
function ownedProcess(pid, expected, extra) {
  if (!Number.isInteger(pid)) return false;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object -ExpandProperty CommandLine`], { windowsHide: true, encoding: 'utf8' });
  return (result.stdout || '').toLowerCase().includes(expected.toLowerCase()) && (!extra || result.stdout.includes(extra));
}
if (process.argv.includes('--stop')) {
  if (!record || record.project !== project) { console.log('No GoPark two-phone test is recorded.'); process.exit(0); }
  for (const [pid, expected, extra] of [[record.tunnelPid, tunnelBinary, address], [record.pid, serverScript, null]]) {
    if (ownedProcess(pid, expected, extra)) spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  }
  console.log('Two-phone test stopped. The temporary phone link is closed.'); process.exit(0);
}
async function start() {
  if (!fs.existsSync(path.join(project, 'public', 'phone-test.js'))) throw new Error('Build the two-phone client first.');
  let running = false;
  if (record?.project === project) { try { await request('/admin/status'); running = true; } catch {} }
  if (!running) {
    if (record?.project === project && ownedProcess(record.tunnelPid, tunnelBinary, address)) spawnSync('taskkill.exe', ['/PID', String(record.tunnelPid), '/T', '/F'], { windowsHide: true });
    record = { project, adminToken: randomBytes(32).toString('base64url'), startedAt: new Date().toISOString() };
    const log = fs.openSync(path.join(runtime, 'phone-test-server.log'), 'a');
    const child = spawn(process.execPath, [serverScript], { cwd: project, detached: true, windowsHide: true, stdio: ['ignore', log, log], env: { ...process.env, GOPARK_PHONE_ADMIN_TOKEN: record.adminToken } });
    children.push(child); child.unref(); fs.closeSync(log); record.pid = child.pid;
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    let ready = false;
    for (let i = 0; i < 30; i++) { await sleep(500); try { await request('/admin/status'); ready = true; break; } catch {} }
    if (!ready) throw new Error('Two-phone server could not start. Check .sites-runtime/phone-test-server.log.');
  }
  if (!process.argv.includes('--local-only')) {
    if (!fs.existsSync(tunnelBinary)) throw new Error('The official cloudflared helper is missing from .tools/phone-test.');
    let activeTunnel = false;
    const status = await request('/admin/status');
    if (status.publicUrl && record.tunnelPid && ownedProcess(record.tunnelPid, tunnelBinary, address)) {
      try { const response = await fetch(status.publicUrl + '/health', { signal: AbortSignal.timeout(5000) }); activeTunnel = response.ok && (await response.json()).service === 'gopark-two-phones'; } catch {}
    }
    if (!activeTunnel) {
      const logPath = path.join(runtime, 'phone-test-tunnel.log');
      fs.writeFileSync(logPath, ''); const log = fs.openSync(logPath, 'a');
      const tunnel = spawn(tunnelBinary, ['tunnel', '--url', address, '--protocol', 'http2', '--no-autoupdate'], { cwd: project, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
      children.push(tunnel); tunnel.unref(); fs.closeSync(log); record.tunnelPid = tunnel.pid;
      let publicUrl = null;
      for (let i = 0; i < 90; i++) {
        await sleep(700); const logText = fs.readFileSync(logPath, 'utf8');
        const match = logText.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) { publicUrl = match[0]; break; }
      }
      if (!publicUrl) throw new Error('Temporary HTTPS link was not created. Check .sites-runtime/phone-test-tunnel.log.');
      await request('/admin/public-url', { url: publicUrl }); record.publicUrl = publicUrl;
      fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    }
  }
  const status = await request('/admin/status');
  console.log(`GoPark two-phone pairing: ${address}/local-setup`);
  if (status.publicUrl) console.log(`Temporary phone HTTPS address: ${status.publicUrl}`);
  if (!process.argv.includes('--no-open')) {
    const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file => fs.existsSync(file));
    if (browser) { const window = spawn(browser, [`--app=${address}/local-setup`, `--user-data-dir=${path.join(runtime, 'phone-pairing-browser')}`, '--window-size=1120,900', '--no-first-run'], { detached: true, windowsHide: false, stdio: 'ignore' }); window.unref(); }
  }
  if (process.argv.includes('--stay')) await new Promise(resolve => {
    const keepAlive = setInterval(async () => { try { await request('/admin/status'); } catch { clearInterval(keepAlive); resolve(); } }, 3000);
    process.once('SIGINT', () => { clearInterval(keepAlive); children.forEach(child => child.kill()); resolve(); });
  });
}
start().catch(error => { fs.appendFileSync(path.join(runtime, 'phone-test-launcher.log'), `${new Date().toISOString()} ${error.stack}\n`); console.error(error.message); process.exitCode = 1; });
