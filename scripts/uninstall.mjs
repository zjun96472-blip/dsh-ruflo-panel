import fs from 'node:fs';
import path from 'node:path';
import { args, platform, profileInfo, manifestPaths, ownedState, splitBlock, atomic, lock, backup, offline } from './common.mjs';

try {
  const options = args(process.argv.slice(2), ['profile', 'dsh', 'node']);
  if (options.help) console.log('node scripts/uninstall.mjs --profile /path/to/data/profiles/web [--dsh /path/to/dsh/lib/bin.js] [--apply]');
  else {
    platform();
    const info = profileInfo(options.profile);
    const state = ownedState(info);
    if (!state) throw new Error('没有本安装器的安装记录；不会删除未知插件。');
    const executable = manifestPaths(options, state);
    const original = fs.readFileSync(info.patch, 'utf8');
    const parts = splitBlock(original, state);
    const before = state.separator && parts.before.endsWith(state.separator) ? parts.before.slice(0, -state.separator.length) : parts.before;
    const next = before + parts.unmanaged + parts.after;
    console.log(JSON.stringify({ action: 'uninstall', profile: info.profile, apply: Boolean(options.apply), keepsRufloData: true }));
    if (options.apply) lock(info, () => {
      ownedState(info);
      if (fs.readFileSync(info.patch, 'utf8') !== original) throw new Error('配置发生并发修改。');
      const dir = backup(info, original, state);
      const mode = fs.statSync(info.patch).mode & 0o777;
      let moved = false;
      try {
        atomic(info.patch, next, mode);
        offline(info, executable, path.join(dir, 'config-uninstalled.yml'));
        fs.renameSync(info.plugin, path.join(dir, 'plugin-uninstalled')); moved = true;
        if (!state.patchExisted && next === '') fs.unlinkSync(info.patch);
        fs.renameSync(info.state, path.join(dir, 'install-uninstalled.json'));
        console.log('卸载完成。仅移除本插件配置，程序保留在备份中；Ruflo 运行时和数据均保留。按原方式重启 Harness 生效。');
      } catch (e) {
        const current = fs.existsSync(info.patch) ? fs.readFileSync(info.patch, 'utf8') : '';
        if (current !== next && !(next === '' && current === '')) throw new Error('检测到并发修改；未覆盖新配置。恢复资料：' + dir);
        atomic(info.patch, original, mode);
        if (moved) fs.renameSync(path.join(dir, 'plugin-uninstalled'), info.plugin);
        throw new Error(e.message + '\n本次卸载已回退。');
      }
    });
    else console.log('预览完成。添加 --apply 执行卸载。');
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
