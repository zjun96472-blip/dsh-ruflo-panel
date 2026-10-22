import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const LIMIT = 200;
const MAX_TEXT = 16384;
const MAX_STORE = 16 * 1024 * 1024;
const text = (x, max = MAX_TEXT) => String(x ?? '').slice(0, max);
const record = x => x && typeof x === 'object' && !Array.isArray(x);
const time = x => {
  if (x == null || x === '') return null;
  const date = new Date(x);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : null;
};
const tags = x => Array.isArray(x) ? x.slice(0, 30).map(y => text(y, 120)) : [];
const parse = x => { try { return JSON.parse(x); } catch { return null; } };
const serialize = x => typeof x === 'string' ? x : JSON.stringify(x ?? null);

function readRecords(workspace, file, key) {
  const target = path.join(workspace, file);
  let size;
  try { size = fs.statSync(target).size; }
  catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
  if (size > MAX_STORE) throw new Error('记录文件超过 16 MiB，暂不加载，请分批归档后刷新。');
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!record(data) || !record(data[key])) throw new Error('记录文件格式不兼容，原文件未修改。');
  return data[key];
}

function taskRows(workspace) {
  const all = Object.values(readRecords(workspace, '.claude-flow/tasks/store.json', 'tasks'));
  if (all.some(x => !record(x))) throw new Error('任务记录格式不兼容。');
  const counts = Object.create(null);
  for (const item of all) counts[text(item.status, 80)] = (counts[text(item.status, 80)] ?? 0) + 1;
  const items = all.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, LIMIT).map(x => ({
      id: text(x.taskId, 300), title: text(x.description || x.title || x.taskId),
      type: text(x.type, 100), status: text(x.status || 'unknown', 80),
      priority: text(x.priority || 'normal', 80),
      progress: Number.isFinite(x.progress) ? Math.min(100, Math.max(0, x.progress)) : null,
      assignedTo: tags(x.assignedTo), tags: tags(x.tags),
      createdAt: time(x.createdAt), updatedAt: time(x.completedAt ?? x.updatedAt ?? x.createdAt),
      result: x.result == null ? null : text(serialize(x.result)),
      demo: tags(x.tags).includes('ruflo-install-demo') || x.result?.demonstration === true
    }));
  return { total: all.length, counts, items, limited: all.length > LIMIT };
}

function memoryRows(workspace, file) {
  // Ruflo 3.59.13 memory-initializer uses the agentdb bridge for the default path.
  // An empty legacy memory.db must not override this path. Other layouts can
  // explicitly select a workspace-relative memoryDatabase in plugin config.
  if (!fs.existsSync(file)) return { initialized: false, total: 0, embedded: 0, items: [], limited: false };
  const resolved = fs.realpathSync(file);
  const relative = path.relative(fs.realpathSync(workspace), resolved);
  if (relative === '..' || relative.startsWith('..' + path.sep)) throw new Error('Ruflo 记忆数据库的链接目标不在工作区内。');
  const db = new DatabaseSync(file, { readOnly: true, timeout: 1500 });
  try {
    db.exec('PRAGMA query_only = ON; BEGIN');
    const columns = new Set(db.prepare('PRAGMA table_info(memory_entries)').all().map(x => x.name));
    const required = ['id', 'key', 'namespace', 'content', 'tags', 'created_at', 'updated_at', 'provenance_type', 'embedding', 'status', 'expires_at'];
    if (required.some(key => !columns.has(key))) throw new Error('Ruflo 记忆数据结构与当前适配器不兼容，请核对版本。');
    const where = "(status = 'active' OR status IS NULL) AND (expires_at IS NULL OR expires_at > ?)";
    const now = Date.now();
    const count = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN embedding IS NOT NULL AND embedding != '' AND embedding != '[]' THEN 1 ELSE 0 END) AS embedded
      FROM memory_entries WHERE ${where}`).get(now);
    const items = db.prepare(`SELECT id, key, namespace, substr(content, 1, ?) AS content,
      length(content) AS length, tags, created_at, updated_at, provenance_type,
      CASE WHEN embedding IS NOT NULL AND embedding != '' AND embedding != '[]' THEN 1 ELSE 0 END AS embedded
      FROM memory_entries WHERE ${where} ORDER BY updated_at DESC, id DESC LIMIT ?`)
      .all(MAX_TEXT, now, LIMIT).map(x => ({
        id: text(x.id, 300), title: text(x.key, 1024), namespace: text(x.namespace, 300),
        content: x.content, truncated: x.length > MAX_TEXT, tags: tags(parse(x.tags)),
        createdAt: time(x.created_at), updatedAt: time(x.updated_at),
        provenance: text(x.provenance_type, 100), hasEmbedding: Boolean(x.embedded),
        demo: x.namespace === 'ruflo-install-demo'
      }));
    db.exec('COMMIT');
    return { initialized: true, total: count.total, embedded: count.embedded ?? 0, items, limited: count.total > LIMIT };
  } finally { db.close(); }
}

function agentRows(workspace) {
  const canonical = readRecords(workspace, '.claude-flow/agents/store.json', 'agents');
  const hive = readRecords(workspace, '.claude-flow/agents.json', 'agents');
  const all = Object.entries({ ...hive, ...canonical });
  if (all.some(([, x]) => !record(x))) throw new Error('智能体记录格式不兼容。');
  const items = all.sort(([, a], [, b]) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, LIMIT).map(([id, x]) => ({
      id: text(x.agentId ?? x.id ?? id, 300), title: text(x.name ?? x.type ?? id, 300),
      type: text(x.type, 100), status: text(x.status ?? 'unknown', 80),
      model: text(x.model, 200), taskCount: Number.isFinite(x.taskCount) ? x.taskCount : null,
      createdAt: time(x.createdAt), updatedAt: time(x.updatedAt ?? x.createdAt),
      result: x.lastResult == null ? null : text(serialize(x.lastResult))
    }));
  return { total: all.length, items, limited: all.length > LIMIT };
}

function safeRead(read) {
  try { return { ok: true, ...read() }; }
  catch (e) {
    const known = /^(记录|任务|智能体|Ruflo)/.test(e.message);
    return { ok: false, total: null, items: [], error: known ? e.message : '读取失败；数据未修改。请稍后刷新。' };
  }
}

export function snapshot(workspace, memoryDatabase = path.join(workspace, '.swarm/agentdb-memory.db')) {
  return {
    at: new Date().toISOString(), limit: LIMIT,
    tasks: safeRead(() => taskRows(workspace)),
    memories: safeRead(() => memoryRows(workspace, memoryDatabase)),
    agents: safeRead(() => agentRows(workspace))
  };
}
