import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

// Prefer an existing installation, including the original laptop's portable copy.
// Fresh clones download into ignored, project-local runtime storage.
export function findPhoneHelper(project) {
  const name = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const candidates = [process.env.GOPARK_CLOUDFLARED,
    path.join(project, '..', '.tools', 'phone-test', name),
    path.join(project, '.sites-runtime', 'tools', name)];
  for (const folder of (process.env.PATH || '').split(path.delimiter)) if (folder) candidates.push(path.join(folder, name));
  return candidates.find(file => file && fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}

export async function installPhoneHelper(project) {
  const existing = findPhoneHelper(project);
  if (existing) return existing;
  if (process.platform !== 'win32' || !['x64', 'ia32'].includes(process.arch)) {
    throw new Error('Install cloudflared for your system and put it on PATH, then run setup again: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/');
  }
  const assetName = `cloudflared-windows-${process.arch === 'x64' ? 'amd64' : '386'}.exe`;
  const releaseUrl = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';
  const metadata = await fetch(releaseUrl, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'GoPark-local-setup' }, signal: AbortSignal.timeout(30000) });
  if (!metadata.ok) throw new Error(`Cloudflare helper lookup failed (${metadata.status}). Check internet access and rerun SETUP.cmd.`);
  const release = await metadata.json(), asset = release.assets?.find(value => value.name === assetName);
  if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) throw new Error('The official helper release has no verifiable SHA-256 digest. Install cloudflared from Cloudflare manually, then rerun setup.');
  const source = new URL(asset.browser_download_url);
  if (source.origin !== 'https://github.com' || !source.pathname.startsWith('/cloudflare/cloudflared/releases/download/')) throw new Error('Unexpected Cloudflare helper source.');
  console.log(`Downloading the official Cloudflare helper (${release.tag_name})...`);
  const response = await fetch(source, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Cloudflare helper download failed (${response.status}). Rerun SETUP.cmd.`);
  const binary = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(binary).digest('hex');
  if (`sha256:${sha256}` !== asset.digest || binary.subarray(0, 2).toString() !== 'MZ') throw new Error('Cloudflare helper verification failed. Nothing was installed.');
  const directory = path.join(project, '.sites-runtime', 'tools');
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, 'cloudflared.exe'), temporary = `${destination}.${randomUUID()}.download`;
  try { fs.writeFileSync(temporary, binary, { flag: 'wx' }); fs.renameSync(temporary, destination); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  fs.writeFileSync(path.join(directory, 'cloudflared-source.json'), JSON.stringify({ release: release.tag_name, source: source.href, sha256 }, null, 2));
  const verified = spawnSync(destination, ['--version'], { windowsHide: true, encoding: 'utf8', timeout: 10000 });
  if (verified.status !== 0) throw new Error('The downloaded helper could not run. Check that Windows supports this cloudflared build.');
  console.log(verified.stdout.trim());
  return destination;
}
