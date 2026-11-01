import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installPhoneHelper } from './phone-helper.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || major === 22 && minor < 13) throw new Error('Install Node.js 22.13 or newer from https://nodejs.org/en/download, then run SETUP.cmd again.');
if (!process.env.npm_execpath) throw new Error('Run npm run setup or double-click SETUP.cmd.');
process.chdir(project);
const environment = { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '') };
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: project, env: environment, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Setup stopped (${signal || code}). Fix the error above, then rerun SETUP.cmd.`)));
  });
}
try {
  const npm = process.env.npm_execpath;
  const required = ['vinext/dist/cli.js', 'wrangler/bin/wrangler.js', 'esbuild/package.json', 'react/package.json'];
  if (process.argv.includes('--reinstall') || required.some(file => !fs.existsSync(path.join(project, 'node_modules', file)))) {
    console.log('1/4 Installing project dependencies...');
    await run([npm, 'run', 'install:ci']);
  } else console.log('1/4 Project dependencies are already installed.');
  console.log('2/4 Building GoPark...');
  await run([npm, 'run', 'build']);

  console.log('3/4 Preparing this laptop\'s local database...');
  // Both current migrations only create tables. IF NOT EXISTS makes this bootstrap
  // safe for existing laptops as well as fresh clones, without replacing saved data.
  const migrations = ['0000_lovely_klaw.sql', '0001_keen_jubilee.sql'];
  const sql = migrations.map(file => fs.readFileSync(path.join(project, 'drizzle', file), 'utf8').replace(/\bCREATE TABLE\s+`/g, 'CREATE TABLE IF NOT EXISTS `')).join('\n');
  const runtime = path.join(project, '.sites-runtime'); fs.mkdirSync(runtime, { recursive: true });
  const bootstrap = path.join(runtime, 'local-bootstrap.sql'); fs.writeFileSync(bootstrap, sql);
  await run(['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state', '--file', bootstrap]);

  console.log('4/4 Preparing the two-phone HTTPS helper...');
  try { await installPhoneHelper(project); }
  catch (error) {
    console.error(`The main GoPark app is ready, but the two-phone helper is not: ${error.message}`);
    process.exitCode = 1; returnToInstructions();
  }
  if (!process.exitCode) {
    fs.writeFileSync(path.join(runtime, 'local-setup.json'), JSON.stringify({ readyAt: new Date().toISOString(), node: process.versions.node }, null, 2));
    console.log('\nSetup complete. Double-click Open GoPark.cmd or Open GoPark Two Phones.cmd.');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
function returnToInstructions() { console.error('Rerun SETUP.cmd after installing cloudflared. Existing bookings will be preserved.'); }
