import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { check, root } from './check.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function run(command, args, binary = false) {
  const result = spawnSync(command, args, {
    cwd: root, encoding: binary ? null : 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024
  });
  if (result.error || result.status !== 0) throw new Error('Command failed: ' + command + '\n' + (result.error?.message ?? result.stderr));
  return result.stdout;
}

try {
  const checked = check();
  if (run('git', ['status', '--porcelain', '--untracked-files=all']).trim()) throw new Error('Commit all release files before packaging');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!/^[a-z0-9-]+$/.test(manifest.name) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid release name/version');
  const revision = run('git', ['rev-parse', 'HEAD']).trim();
  const out = path.join(root, 'dist', manifest.version);
  if (fs.existsSync(out)) throw new Error('Output already exists: ' + out);
  const roots = new Set(['package.json', ...manifest.files.map(item => item.replace(/\/$/, ''))]);
  const expected = checked.files.filter(file => roots.has(file.split('/')[0]));
  const npm = fs.realpathSync(process.env.npm_execpath ?? path.join(path.dirname(process.execPath),
    process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : 'npm'));
  const preview = JSON.parse(run(process.execPath, [npm, 'pack', '--dry-run', '--ignore-scripts', '--json']))[0];
  const paths = preview.files.map(file => file.path).sort();
  if (JSON.stringify(paths) !== JSON.stringify(expected)) throw new Error('npm pack file allowlist mismatch');
  const files = paths.map(file => {
    const bytes = fs.readFileSync(path.join(root, file));
    if (hash(bytes) !== hash(run('git', ['show', 'HEAD:' + file], true))) throw new Error('Worktree differs from committed bytes: ' + file);
    return { path: file, bytes: bytes.length, sha256: hash(bytes) };
  });
  fs.mkdirSync(out, { recursive: true });
  const packed = JSON.parse(run(process.execPath, [npm, 'pack', '--ignore-scripts', '--json', '--pack-destination', out]))[0];
  if (JSON.stringify(packed.files.map(file => file.path).sort()) !== JSON.stringify(paths)) throw new Error('Package files changed while packing');
  const release = manifest.name + '-' + manifest.version;
  const zip = release + '.zip';
  run('git', ['archive', '--format=zip', '--prefix=' + release + '/', '--output=' + path.join(out, zip), 'HEAD', '--', ...paths]);
  const artifacts = [zip, packed.filename].map(file => {
    const bytes = fs.readFileSync(path.join(out, file));
    return { name: file, bytes: bytes.length, sha256: hash(bytes) };
  });
  fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), artifacts.map(file => `${file.sha256}  ${file.name}\n`).join(''));
  fs.writeFileSync(path.join(out, 'release-manifest.json'), JSON.stringify({
    name: manifest.name, version: manifest.version, revision,
    sourceFiles: files.length, maxCodeLines: checked.maxCodeLines, artifacts, files
  }, null, 2) + '\n');
  console.log(JSON.stringify({ revision, sourceFiles: files.length, artifacts, directory: out }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
