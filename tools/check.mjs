import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', 'node_modules', 'dist']);
const code = /\.(?:[cm]?js|jsx|tsx?|py|sh|ps1)$/;
const sensitive = [
  /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._-]{24,}/,
  /\b[A-Z]:[\\/](?:Users|Documents and Settings)[\\/]/i,
  /\/(?:home|Users)\/[A-Za-z0-9][^\s'"`<>]+/,
];

export function check() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node.js 24+ required');
  const files = [];
  let maxCodeLines = 0;
  function walk(folder, prefix = '') {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const relative = path.posix.join(prefix, entry.name);
      const absolute = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Unexpected symlink: ' + relative);
      if (entry.isDirectory()) { walk(absolute, relative); continue; }
      if (!entry.isFile()) throw new Error('Unexpected file type: ' + relative);
      if (/(?:^|\/)(?:\.env(?:\..*)?|\.swarm|\.claude-flow|\.ruflo-panel-[^/]+)$/.test(relative)
        || /\.(?:db|sqlite3?|log)(?:-wal|-shm)?$/.test(relative)) throw new Error('Local data file: ' + relative);
      files.push(relative);
      const bytes = fs.readFileSync(absolute);
      if (relative.endsWith('.png')) {
        if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG: ' + relative);
        continue;
      }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (text.includes('\uFFFD') || bytes.subarray(0, 3).toString('hex') === 'efbbbf') throw new Error('Invalid UTF-8 text or BOM: ' + relative);
      if (text.includes('\r')) throw new Error('Expected LF line endings: ' + relative);
      if (sensitive.some(pattern => pattern.test(text))) throw new Error('Review possible credential or personal path: ' + relative);
      if (code.test(relative)) {
        const lines = text.split('\n').length;
        maxCodeLines = Math.max(maxCodeLines, lines);
        if (lines >= 3000) throw new Error('Code file must have fewer than 3000 lines: ' + relative);
      }
      if (/\.[cm]?js$/.test(relative)) {
        const result = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf8', timeout: 10000 });
        if (result.error || result.status !== 0) throw new Error('JavaScript syntax check failed: ' + relative);
      }
      if (relative.endsWith('.json')) JSON.parse(text);
      if (relative.endsWith('.md')) {
        for (const match of text.matchAll(/\]\((\.\/[^)#]+)(?:#[^)]*)?\)/g)) {
          if (!fs.existsSync(path.resolve(path.dirname(absolute), match[1]))) throw new Error('Broken local link: ' + relative + ' -> ' + match[1]);
        }
      }
    }
  }
  walk(root);
  return { files: files.sort(), utf8: true, maxCodeLines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(check(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
