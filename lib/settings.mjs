import fs from 'node:fs';
import path from 'node:path';

export function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) {
    throw new Error(`${label} 必须是绝对路径，请在插件 config 中设置。`);
  }
  return path.normalize(value);
}

export function settings(input = {}) {
  const workspace = fs.realpathSync(absolute(input.workspace, 'workspace'));
  if (!fs.statSync(workspace).isDirectory()) throw new Error('workspace 必须是目录。');
  const rufloPackage = fs.realpathSync(absolute(input.rufloPackage, 'rufloPackage'));
  const manifest = JSON.parse(fs.readFileSync(path.join(rufloPackage, 'package.json'), 'utf8'));
  if (manifest.name !== 'ruflo' || typeof manifest.version !== 'string') throw new Error('rufloPackage 不是有效的 Ruflo 包目录。');
  const serverName = input.serverName ?? 'ruflo';
  if (typeof serverName !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(serverName)) throw new Error('serverName 只能包含 1–32 个字母、数字、下划线或连字符。');
  const relative = input.memoryDatabase ?? '.swarm/agentdb-memory.db';
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\0')) throw new Error('memoryDatabase 必须是工作区内的相对路径。');
  const memoryDatabase = path.resolve(workspace, relative);
  const rel = path.relative(workspace, memoryDatabase);
  if (rel === '..' || rel.startsWith('..' + path.sep) || !rel) throw new Error('memoryDatabase 必须在 workspace 内。');
  return { workspace, rufloPackage, version: manifest.version, serverName, memoryDatabase };
}
