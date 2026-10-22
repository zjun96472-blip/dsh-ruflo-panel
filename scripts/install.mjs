import fs from 'node:fs';
import path from 'node:path';
import { settings } from '../lib/settings.mjs';
import { args, platform, absolute, defaults, profileInfo, manifestPaths, ownedState, splitBlock,
  checkConflicts, BEGIN, END, digest, treeHashes, atomic, lock, backup, offline, copyPackage, packageRoot, managedEntries } from './common.mjs';

function configuration(options, executable) {
  const rufloPackage = fs.realpathSync(absolute(options.ruflo ?? defaults().ruflo, '--ruflo'));
  const workspace = absolute(options.workspace ?? defaults().workspace, '--workspace');
  if (!fs.existsSync(workspace) && !options.apply) {
    // Dry-run checks the future directory's nearest existing parent only.
    let parent = path.dirname(workspace);
    while (!fs.existsSync(parent)) parent = path.dirname(parent);
    if (!fs.statSync(parent).isDirectory()) throw new Error('workspace 父路径不是目录。');
  } else if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true, mode: 0o700 });
  const config = { workspace, rufloPackage, serverName: options['server-name'] ?? 'ruflo',
    memoryDatabase: options['memory-database'] ?? '.swarm/agentdb-memory.db' };
  const manifest = JSON.parse(fs.readFileSync(path.join(rufloPackage, 'package.json'), 'utf8'));
  if (manifest.name !== 'ruflo') throw new Error('--ruflo 不是 Ruflo 包目录。');
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.ruflo;
  if (!bin || path.isAbsolute(bin) || path.relative(rufloPackage, path.resolve(rufloPackage, bin)).startsWith('..')) throw new Error('Ruflo 命令路径不兼容。');
  const cli = path.resolve(rufloPackage, bin);
  if (!fs.existsSync(cli)) throw new Error('Ruflo CLI 不存在。');
  if (fs.existsSync(workspace)) settings(config);
  else if (!/^[\w-]{1,32}$/.test(config.serverName) || path.isAbsolute(config.memoryDatabase) || config.memoryDatabase.split(/[\\/]/).includes('..')) throw new Error('连接名或数据库路径不合法。');
  const q = JSON.stringify;
  const block = `${BEGIN}
- insert:
    - id: mcp-ruflo
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: ${q(config.serverName)}
        transport: stdio
        command: ${q(executable.node)}
        args: ${q([cli, 'mcp', 'start', '--tools', 'memory,task,swarm,workflow,agent,system'])}
        cwd: ${q(workspace)}
        env:
          PATH: ${q(path.dirname(executable.node) + ':/usr/local/bin:/usr/bin:/bin')}
          RUFLO_DAEMON_AUTOSTART: '0'
          CLAUDE_FLOW_AUTO_UPDATE: 'false'
        toolCallTimeoutMs: 60000
        failOnStartupError: false
    - id: ruflo-panel
      name: ./plugins/dsh-ruflo-panel/lib/index.js
      config:
        workspace: ${q(workspace)}
        rufloPackage: ${q(rufloPackage)}
        serverName: ${q(config.serverName)}
        memoryDatabase: ${q(config.memoryDatabase)}
${END}
`;
  return { block, config, version: manifest.version };
}

function install(options) {
  platform();
  const info = profileInfo(options.profile);
  const state = ownedState(info);
  const executable = manifestPaths(options, state ?? {});
  const { block, config, version } = configuration(options, executable);
  const patchExisted = fs.existsSync(info.patch);
  const original = patchExisted ? fs.readFileSync(info.patch, 'utf8') : '';
  const parts = splitBlock(original, state);
  checkConflicts(parts.before + parts.unmanaged + parts.after, config.serverName);
  const separator = !parts.block && parts.before && !parts.before.endsWith('\n') ? '\n' : '';
  const next = parts.before + separator + block + parts.unmanaged + parts.after;
  const release = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  console.log(JSON.stringify({ action: state ? 'upgrade' : 'install', apply: Boolean(options.apply),
    profile: info.profile, pluginVersion: release.version, rufloVersion: version, workspace: config.workspace, serverName: config.serverName }));
  if (!options.apply) { console.log('预览完成，没有修改 profile。添加 --apply 安装；安装器不重启工作台。'); return; }
  lock(info, () => {
    if ((fs.existsSync(info.patch) ? fs.readFileSync(info.patch, 'utf8') : '') !== original) throw new Error('配置发生并发修改，请重新运行。');
    ownedState(info);
    const dir = backup(info, original, state);
    const mode = patchExisted ? fs.statSync(info.patch).mode & 0o777 : 0o600;
    let moved = false;
    let copied = false;
    let patched = false;
    let saved = false;
    try {
      offline(info, executable, path.join(dir, 'config-before.yml'));
      const plugins = path.dirname(info.plugin);
      fs.mkdirSync(plugins, { recursive: true });
      if (fs.lstatSync(plugins).isSymbolicLink()) throw new Error('plugins 目录不能是符号链接。');
      if (state) { fs.renameSync(info.plugin, path.join(dir, 'plugin-before')); moved = true; }
      // Set the flag before copying so partial copies are retained in backup on failure.
      copied = true;
      copyPackage(info.plugin);
      atomic(info.patch, next, mode); patched = true;
      const dump = offline(info, executable, path.join(dir, 'config-after.yml'));
      if (!/^[-] id: mcp-ruflo$/m.test(dump) || !/^[-] id: ruflo-panel$/m.test(dump)) throw new Error('配置中缺少预期的全局 Ruflo 插件。');
      atomic(info.state, JSON.stringify({ format: 1, profile: info.profile, plugin: info.plugin,
        version: release.version, node: executable.node, dsh: executable.dsh, files: treeHashes(info.plugin),
        blockHash: digest(block), entries: managedEntries(block, executable.dsh), separator: state?.separator ?? separator,
        patchExisted: state?.patchExisted ?? patchExisted, configured: config, backup: dir }, null, 2) + '\n');
      saved = true;
      console.log('安装完成；离线配置校验通过。使用原启动方式重启 Harness，再点击左侧 Ruflo。');
      console.log('本地备份：' + dir);
    } catch (error) {
      if (patched) {
        if (fs.readFileSync(info.patch, 'utf8') !== next) throw new Error('检测到并发修改，未覆盖新配置。恢复资料位于：' + dir);
        if (patchExisted) atomic(info.patch, original, mode); else fs.unlinkSync(info.patch);
      }
      if (copied && fs.existsSync(info.plugin)) fs.renameSync(info.plugin, path.join(dir, 'plugin-failed'));
      if (moved) fs.renameSync(path.join(dir, 'plugin-before'), info.plugin);
      if (saved && state) atomic(info.state, JSON.stringify(state, null, 2) + '\n');
      if (saved && !state) fs.unlinkSync(info.state);
      throw new Error(error.message + '\n本次配置与插件改动已回退；备份：' + dir);
    }
  });
}

try {
  const options = args(process.argv.slice(2), ['profile', 'dsh', 'node', 'ruflo', 'workspace', 'server-name', 'memory-database']);
  if (options.help) console.log('node scripts/install.mjs --profile /path/to/data/profiles/web --dsh /path/to/@deepseek-ai/dsh/lib/bin.js [--ruflo /path/to/node_modules/ruflo] [--workspace /path/to/data] [--server-name ruflo] [--node /path/to/node] [--apply]');
  else install(options);
} catch (e) { console.error(e.message); process.exitCode = 1; }
