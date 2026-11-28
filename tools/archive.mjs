// Cake Factory – Sweet Automation · © 2026 Brakeco Games
//
// Release archive (run after every push to main):  npm run archive
//
// Creates, in the game folder (the parent of "02. Broncode"):
//   Cake Factory versie <YYYY-MM-DD> v<version>/
//     Cake Factory v<version> CrazyGames.zip   ← upload this to the CrazyGames developer portal
//     versie.txt                               ← version, date, commit, live link, contents
//   Cake Factory.url                           ← shortcut to the live game (created once)
//
// Options:  --out <folder>   write somewhere else (default: the parent folder of this repo)
// No dependencies: the zip is written with Node's zlib.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const GAME = 'Cake Factory';
const LINK = 'https://brakecogames.github.io/Cake-Factory/';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const OUT = outArg >= 0 ? resolve(args[outArg + 1]) : resolve(ROOT, '..');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const cfg = readFileSync(join(ROOT, 'src/core/Config.js'), 'utf8');
const m = /GAME_VERSION = '([^']+)'/.exec(cfg);
if (!m || m[1] !== version) {
  console.error(`Version mismatch: package.json ${version}, Config.js GAME_VERSION ${m ? m[1] : '?'} – make them equal first.`);
  process.exit(1);
}
const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sh = (c) => execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
let commit = 'unknown', dirty = false;
try { commit = sh('git rev-parse --short HEAD'); dirty = sh('git status --porcelain').length > 0; } catch { /* no git */ }

// ---- build the CrazyGames version, zip it, then restore the normal build
console.log('building CrazyGames version…');
execSync('npm run build:crazygames', { cwd: ROOT, stdio: 'inherit' });
const DIST = join(ROOT, 'dist');
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p); else files.push(p);
  }
};
walk(DIST);

// Minimal ZIP writer (deflate, CRC-32).
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
const local = [], central = [];
let offset = 0;
for (const f of files) {
  const name = Buffer.from(relative(DIST, f).split(sep).join('/'), 'utf8');
  const data = readFileSync(f);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt16LE(dosTime, 10); h.writeUInt16LE(dosDate, 12); h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
  local.push(h, name, comp);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt16LE(dosTime, 12); c.writeUInt16LE(dosDate, 14); c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += h.length + name.length + comp.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...local, cd, end]);

const folder = join(OUT, `${GAME} versie ${date} v${version}`);
mkdirSync(folder, { recursive: true });
const zipName = `${GAME} v${version} CrazyGames.zip`;
writeFileSync(join(folder, zipName), zip);
writeFileSync(join(folder, 'versie.txt'), [
  `${GAME} – Sweet Automation`,
  `Versie:   ${version}`,
  `Datum:    ${date}`,
  `Commit:   ${commit}${dirty ? ' (met niet-gecommitte wijzigingen!)' : ''}`,
  `Online:   ${LINK}`,
  '',
  `${zipName}`,
  '  Speelklare build met de CrazyGames SDK v3. Upload deze zip in het CrazyGames developer portal.',
  `  ${files.length} bestanden: ${files.map((f) => relative(DIST, f).split(sep).join('/')).join(', ')}`,
  '',
  '© 2026 Brakeco Games',
  '',
].join('\r\n'));
const url = join(OUT, `${GAME}.url`);
if (!existsSync(url)) writeFileSync(url, `[InternetShortcut]\r\nURL=${LINK}\r\n`);

console.log('restoring the normal build…');
execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
console.log(`klaar: ${GAME} versie ${date} v${version}  (${(zip.length / 1024).toFixed(0)} kB)  →  ${folder}`);
