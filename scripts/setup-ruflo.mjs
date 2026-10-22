import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { args, platform, absolute, defaults, packageRoot, digest } from './common.mjs';

try {
  const options = args(process.argv.slice(2), ['dir'], ['help']);
  if (options.help) console.log('node scripts/setup-ruflo.mjs [--dir /path/to/private-runtime]');
  else {
    platform();
    if (process.arch !== 'x64') throw new Error('自动运行时安装目前仅验证 Linux x64；其他架构请先自行安装 Ruflo。');
    const dir = absolute(options.dir ?? path.resolve(defaults().ruflo, '../..'), '--dir');
    const lock = fs.readFileSync(path.join(packageRoot, 'runtime/package-lock.json'));
    const marker = path.join(dir, '.ruflo-panel-runtime.json');
    if (fs.existsSync(dir)) {
      if (!fs.existsSync(marker)) throw new Error('目标目录已经存在且不属于此安装器；请选择新的空路径。');
      const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (saved.lockHash !== digest(lock) || fs.realpathSync(dir) !== saved.dir) throw new Error('运行时安装记录不匹配，未覆盖。');
      if (digest(fs.readFileSync(path.join(dir, 'package-lock.json'))) !== (saved.installedLockHash ?? digest(lock))) throw new Error('运行时依赖锁文件被修改，未覆盖。');
    } else {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.copyFileSync(path.join(packageRoot, 'runtime/package.json'), path.join(dir, 'package.json'));
      fs.copyFileSync(path.join(packageRoot, 'runtime/package-lock.json'), path.join(dir, 'package-lock.json'));
      fs.writeFileSync(marker, JSON.stringify({ dir: fs.realpathSync(dir), lockHash: digest(lock) }), { mode: 0o600 });
    }
    const expected = JSON.parse(fs.readFileSync(path.join(packageRoot, 'runtime/package.json'), 'utf8')).dependencies;
    const verify = () => {
      for (const [name, version] of Object.entries(expected)) {
        const installed = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', name, 'package.json'), 'utf8'));
        if (installed.version !== version) throw new Error('运行时版本不匹配：' + name);
      }
      // Keep verification out of the installer isolate: a failed native load
      // must not leave a cached binary mapped while npm rebuilds that binary.
      for (const script of [
        "const D=require('better-sqlite3');const db=new D(':memory:');db.exec('SELECT 1');db.close();",
        "require('ruvector');"
      ]) {
        const result = spawnSync(process.execPath, ['-e', script], { cwd: dir, encoding: 'utf8', timeout: 15000 });
        if (result.status !== 0 || result.error) throw new Error('原生模块检查失败；需要完成构建或核对 Node 版本。');
      }
    };
    try { verify(); console.log('运行时已安装且检查通过：' + dir); process.exit(0); } catch { /* complete an interrupted owned install */ }
    for (const command of ['python3', 'make', 'g++']) {
      if (spawnSync(command, ['--version'], { stdio: 'ignore', timeout: 5000 }).status !== 0) throw new Error('缺少构建依赖：' + command + '。Ubuntu 可安装 build-essential python3。');
    }
    const npm = fs.realpathSync(path.join(path.dirname(process.execPath), 'npm'));
    const run = arguments_ => {
      const result = spawnSync(process.execPath, [npm, ...arguments_], {
        cwd: dir, stdio: 'inherit', timeout: 15 * 60 * 1000,
        env: { ...process.env, PATH: path.dirname(process.execPath) + ':/usr/local/bin:/usr/bin:/bin' }
      });
      const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
      saved.installedLockHash = digest(fs.readFileSync(path.join(dir, 'package-lock.json')));
      fs.writeFileSync(marker, JSON.stringify(saved), { mode: 0o600 });
      if (result.status !== 0 || result.error) throw new Error('依赖安装未完成，可修复网络或构建环境后使用同一命令继续。');
    };
    // Ruflo's optional slim-bindings metadata names unpublished platform packages.
    // npm ci rejects that metadata even with --omit=optional. npm install honors
    // the supplied locked versions and can omit the unavailable optional branch.
    run(['install', '--ignore-scripts', '--omit=optional', '--no-audit', '--no-fund', '--loglevel=error']);
    run(['rebuild', 'better-sqlite3', '--build-from-source', '--loglevel=error']);
    verify();
    console.log('Ruflo 3.59.13 运行时准备完成：' + dir);
    console.log('此步骤没有配置模型密钥、启动智能体或下载 embedding 模型。');
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
