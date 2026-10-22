import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const BEGIN = '# BEGIN dsh-ruflo-panel managed';
export const END = '# END dsh-ruflo-panel managed';
export const digest = text => createHash('sha256').update(text).digest('hex');
export const stamp = () => new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex');
export const defaults = () => ({
  ruflo: path.join(os.homedir(), '.local/share/ruflo-harness/runtime/node_modules/ruflo'),
  workspace: path.join(os.homedir(), '.local/share/ruflo-harness/workspace')
});

export function args(argv, allowed, flags = ['apply', 'help']) {
  const output = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || (!allowed.includes(key) && !flags.includes(key))) throw new Error(`未知参数：${argv[i]}`);
    if (Object.hasOwn(output, key)) throw new Error(`参数重复：--${key}`);
    if (flags.includes(key)) output[key] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`--${key} 缺少参数`);
      output[key] = argv[++i];
    }
  }
  return output;
}

export function platform() {
  if (process.platform !== 'linux') throw new Error('此安装器支持 Linux / WSL Ubuntu；请进入 WSL 后运行。');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('需要 Node.js 24 或更高版本。');
}

export function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\0\r\n]/.test(value)) throw new Error(`${label} 需要绝对路径。`);
  return path.resolve(value);
}

export function regular(file, optional = false) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (e) { if (optional && e.code === 'ENOENT') return false; throw e; }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`文件类型不安全：${file}`);
  return true;
}

export function profileInfo(value) {
  const profile = fs.realpathSync(absolute(value, '--profile'));
  if (path.basename(path.dirname(profile)) !== 'profiles') throw new Error('--profile 必须位于 <DSH_HOME>/profiles/<名称>。');
  if (!fs.statSync(profile).isDirectory()) throw new Error('profile 不是目录。');
  const manifest = JSON.parse(fs.readFileSync(path.join(profile, 'package.json'), 'utf8'));
  if (!manifest.dsh?.profile) throw new Error('目标目录不是 Harness profile。');
  const patch = path.join(profile, 'cordis.patch.yml');
  regular(patch, true);
  return {
    profile, patch, name: path.basename(profile), home: path.dirname(path.dirname(profile)),
    plugin: path.join(profile, 'plugins/dsh-ruflo-panel'),
    state: path.join(profile, '.ruflo-panel-install.json')
  };
}

export function manifestPaths(options, state = {}) {
  const node = fs.realpathSync(absolute(options.node ?? state.node ?? process.execPath, '--node'));
  const dsh = fs.realpathSync(absolute(options.dsh ?? state.dsh, '--dsh'));
  regular(dsh);
  const check = spawnSync(node, ['--version'], { encoding: 'utf8', timeout: 5000 });
  if (check.status !== 0 || Number(check.stdout.trim().replace(/^v/, '').split('.')[0]) < 24) throw new Error('--node 必须指向 Node.js 24+。');
  const pkg = JSON.parse(fs.readFileSync(path.resolve(dsh, '../../package.json'), 'utf8'));
  if (pkg.name !== '@deepseek-ai/dsh') throw new Error('--dsh 需要指向 @deepseek-ai/dsh/lib/bin.js。');
  return { node, dsh, harnessVersion: pkg.version };
}

export function treeHashes(root, prefix = '') {
  const map = {};
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error('插件目录包含链接，拒绝自动覆盖。');
    if (entry.isDirectory()) Object.assign(map, treeHashes(root, relative));
    else if (entry.isFile()) map[relative] = digest(fs.readFileSync(path.join(root, relative)));
    else throw new Error('插件目录包含非常规文件。');
  }
  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
}

export function ownedState(info) {
  if (!fs.existsSync(info.state)) {
    if (fs.existsSync(info.plugin)) throw new Error('已有未受安装器管理的面板目录；请先备份并手动迁移，不会覆盖。');
    return null;
  }
  regular(info.state);
  const state = JSON.parse(fs.readFileSync(info.state, 'utf8'));
  if (state.format !== 1 || state.profile !== info.profile || state.plugin !== info.plugin) throw new Error('安装记录不匹配，拒绝覆盖。');
  if (JSON.stringify(treeHashes(info.plugin)) !== JSON.stringify(state.files)) throw new Error('面板文件在安装后被修改，请先保留这些改动；自动操作已停止。');
  return state;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}

function explicitlyTagged(node) {
  if (!node || typeof node !== 'object') return false;
  return Boolean(node.tag) || Boolean(node.items?.some(explicitlyTagged)) || explicitlyTagged(node.key) || explicitlyTagged(node.value);
}

export function managedEntries(block, dsh) {
  const yaml = createRequire(dsh)('yaml');
  const doc = yaml.parseDocument(block);
  if (doc.errors.length) throw new Error('管理配置块不是有效的 YAML。');
  const result = {};
  for (const row of doc.toJSON() ?? []) for (const entry of row.insert ?? []) {
    if (['mcp-ruflo', 'ruflo-panel'].includes(entry.id)) result[entry.id] = stable(entry);
  }
  return result;
}

export function splitBlock(text, state) {
  const begin = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (begin < 0 && end < 0) {
    if (state) throw new Error('找不到安装器原有配置块。');
    return { before: text, after: '', block: '', unmanaged: '' };
  }
  if (!state || begin < 0 || end < begin || text.indexOf(BEGIN, begin + 1) >= 0 || text.indexOf(END, end + 1) >= 0) throw new Error('配置标记不完整、重复或不属于本安装器。');
  let stop = end + END.length;
  if (text.slice(stop, stop + 2) === '\r\n') stop += 2;
  else if (text[stop] === '\n') stop++;
  const block = text.slice(begin, stop);
  let unmanaged = '';
  if (digest(block) !== state.blockHash) {
    // Harness's config editor can reformat YAML and append unrelated entries
    // before our trailing comment. Match owned entries semantically and preserve
    // all unrelated nodes byte-for-byte, even when inside those comments.
    if (!state.entries || Object.keys(state.entries).length !== 2) throw new Error('Ruflo 配置块被修改，旧安装记录不足以安全合并，请先手动迁移。');
    const yaml = createRequire(state.dsh)('yaml');
    const interior = text.slice(begin + BEGIN.length, end).replace(/^\r?\n/, '');
    const doc = yaml.parseDocument(interior);
    if (doc.errors.length || !yaml.isSeq(doc.contents)) throw new Error('Ruflo 配置块格式不兼容。');
    const found = new Set();
    const ranges = [];
    const range = node => [interior.lastIndexOf('\n', node.range[0] - 1) + 1, node.range[2]];
    for (const row of doc.contents.items) {
      const inserted = yaml.isMap(row) ? row.get('insert', true) : undefined;
      if (!yaml.isSeq(inserted)) continue;
      const owned = [];
      for (const entry of inserted.items) {
        const id = yaml.isMap(entry) ? entry.get('id') : undefined;
        if (!Object.hasOwn(state.entries, id)) continue;
        if (found.has(id) || explicitlyTagged(entry) || JSON.stringify(stable(entry.toJSON())) !== JSON.stringify(state.entries[id])) throw new Error('Ruflo 配置内容已被手动修改，未覆盖：' + id);
        found.add(id); owned.push(entry);
      }
      if (owned.length && owned.length === inserted.items.length) ranges.push(range(row));
      else for (const entry of owned) ranges.push(range(entry));
    }
    if (found.size !== 2) throw new Error('找不到两项完整的 Ruflo 配置，未覆盖。');
    unmanaged = interior;
    for (const [start, finish] of ranges.sort((a, b) => b[0] - a[0])) unmanaged = unmanaged.slice(0, start) + unmanaged.slice(finish);
  }
  return { before: text.slice(0, begin), after: text.slice(stop), block, unmanaged };
}

export function checkConflicts(text, serverName) {
  if (/^\s*-?\s*id:\s*["']?(?:mcp-ruflo|ruflo-panel)["']?\s*$/m.test(text)) throw new Error('profile 中已有 Ruflo 插件 id，拒绝重复安装。');
  const names = [...text.matchAll(/^\s*serverName:\s*["']?([\w-]+)["']?\s*$/gm)].map(x => x[1]);
  if (names.includes(serverName)) throw new Error(`MCP 名称 ${serverName} 已存在，请使用不同的 --server-name。`);
}

export function atomic(file, content, mode = 0o600) {
  regular(file, true);
  const temp = `${file}.ruflo-${stamp()}`;
  fs.writeFileSync(temp, content, { flag: 'wx', mode });
  fs.renameSync(temp, file);
}

export function lock(info, work) {
  const dir = path.join(info.profile, '.ruflo-panel-install.lock');
  fs.mkdirSync(dir, { mode: 0o700 });
  try { return work(); } finally { fs.rmdirSync(dir); }
}

export function backup(info, original, state) {
  const parent = path.join(info.profile, '.ruflo-panel-backups');
  if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('备份目录不能是符号链接。');
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const dir = path.join(parent, stamp());
  fs.mkdirSync(dir, { mode: 0o700 });
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml.before'), original, { mode: 0o600 });
  if (state) fs.copyFileSync(info.state, path.join(dir, 'install.json.before'));
  return dir;
}

export function offline(info, executable, log) {
  const result = spawnSync(executable.node, [executable.dsh, '--profile', info.name, '--dump-config'], {
    cwd: info.home, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, DSH_HOME: info.home }
  });
  // Dumps may contain the user's provider credentials. Keep them local and private.
  fs.writeFileSync(log, result.stdout ?? '', { mode: 0o600 });
  fs.writeFileSync(log + '.stderr', result.stderr ?? '', { mode: 0o600 });
  if (result.error || result.status !== 0) throw new Error('Harness 离线配置校验失败；诊断仅保存在本地备份目录。');
  return result.stdout;
}

export function copyPackage(target) {
  fs.mkdirSync(target, { recursive: false });
  const allowed = ['package.json', 'compatibility.json', 'lib', 'scripts', 'runtime', 'README.md', 'INSTALL.md', 'CHANGELOG.md', 'VERIFICATION.md', 'config.example.yml', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'docs', 'CONTRIBUTING.md', 'tools'];
  for (const item of allowed) fs.cpSync(path.join(packageRoot, item), path.join(target, item), { recursive: true, errorOnExist: true });
}
