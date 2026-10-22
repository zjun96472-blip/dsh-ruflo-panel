import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { args, platform, absolute, defaults } from './common.mjs';

export async function connect({ node = process.execPath, ruflo = defaults().ruflo, workspace }) {
  const cli = path.join(absolute(ruflo, '--ruflo'), 'bin/ruflo.js');
  if (!fs.existsSync(cli) || !fs.statSync(absolute(workspace, '--workspace')).isDirectory()) throw new Error('Ruflo 程序或工作区不存在。');
  const child = spawn(node, [cli, 'mcp', 'start', '--tools', 'memory,task,swarm,workflow,agent,system'], {
    cwd: workspace, stdio: ['pipe', 'pipe', 'pipe'],
    env: { HOME: os.homedir(), PATH: path.dirname(node) + ':/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8',
      RUFLO_DAEMON_AUTOSTART: '0', CLAUDE_FLOW_AUTO_UPDATE: 'false' }
  });
  let id = 0;
  let closed = false;
  const pending = new Map();
  const rejectPending = error => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
  };
  const lines = createInterface({ input: child.stdout });
  child.stderr.resume();
  child.stdin.on('error', () => rejectPending(new Error('MCP 输入流已关闭。')));
  child.on('error', e => rejectPending(new Error('Ruflo 无法启动：' + e.code)));
  const exited = new Promise(resolve => child.once('close', code => { closed = true; rejectPending(new Error(`Ruflo 已退出（${code}）`)); resolve(); }));
  lines.on('line', line => {
    if (line.length > 4 * 1024 * 1024) { rejectPending(new Error('MCP 响应超过上限。')); return; }
    let data;
    try { data = JSON.parse(line); } catch { rejectPending(new Error('MCP 返回了非 JSON 数据。')); return; }
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id); clearTimeout(item.timer);
    if (data.error) item.reject(new Error('MCP 请求失败：' + (data.error.code ?? 'unknown')));
    else item.resolve(data.result);
  });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    if (closed) return reject(new Error('MCP 连接已关闭。'));
    const seq = ++id;
    const timer = setTimeout(() => { pending.delete(seq); reject(new Error(`MCP 请求超时：${method}`)); }, 30000);
    pending.set(seq, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: seq, method, params }) + '\n', error => {
      if (error) { clearTimeout(timer); pending.delete(seq); reject(new Error('MCP 输入流已关闭。')); }
    });
  });
  const close = async () => {
    lines.close();
    if (!closed) { child.stdin.end(); child.kill('SIGTERM'); }
    let timer;
    await Promise.race([exited, new Promise(resolve => { timer = setTimeout(() => { if (!closed) child.kill('SIGKILL'); resolve(); }, 3000); })]);
    clearTimeout(timer);
    await exited;
  };
  try {
    await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ruflo-panel-install-check', version: '0.2.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return { request, close };
  } catch (e) { await close(); throw e; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let client;
  try {
    const options = args(process.argv.slice(2), ['node', 'ruflo', 'workspace'], ['help']);
    if (options.help) console.log('node scripts/probe.mjs --workspace /path/to/ruflo-workspace [--ruflo /path/to/node_modules/ruflo] [--node /path/to/node]');
    else {
      platform();
      client = await connect({ node: options.node ?? process.execPath, ruflo: options.ruflo ?? defaults().ruflo, workspace: options.workspace ?? defaults().workspace });
      const result = await client.request('tools/list');
      if (!result.tools?.some(x => x.name === 'memory_store') || !result.tools?.some(x => x.name === 'task_create')) throw new Error('缺少预期的记忆或任务工具。');
      console.log(JSON.stringify({ connected: true, toolCount: result.tools.length, modelRequests: 0 }));
    }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await client?.close(); }
}
