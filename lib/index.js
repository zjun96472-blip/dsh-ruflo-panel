import fs from 'node:fs';
import { snapshot } from './store.mjs';
import { settings } from './settings.mjs';

export const name = 'dsh-ruflo-panel';
export const inject = ['webServer', 'connection', 'tools'];
export const ROUTE = '/ruflo-panel/state.json';

export function apply(ctx, config) {
  const options = settings(config);
  const compatibility = JSON.parse(fs.readFileSync(new URL('../compatibility.json', import.meta.url), 'utf8'));
  let cached;
  let lastRead = 0;
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: ROUTE,
    handler(req, res) {
      const send = (status, body) => {
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
          ...(status === 405 ? { allow: 'GET, HEAD' } : {})
        });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
      };
      // Reuse Harness's Host/Origin fence and signed operator cookie. Fail closed.
      const rejection = ctx.connection.requestRejection(req);
      if (rejection !== undefined) return send(rejection, { error: '请从已登录的工作台打开此页面。' });
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: '此面板仅提供数据查看。' });
      try {
        if (!cached || Date.now() - lastRead >= 2000) {
          cached = snapshot(options.workspace, options.memoryDatabase);
          lastRead = Date.now();
        }
        const names = ctx.tools.schemas().map(x => x.name).filter(x => x.startsWith(`mcp__${options.serverName}__`)).sort();
        send(200, { ...cached, integration: {
          version: options.version, workspace: options.workspace, serverName: options.serverName,
          versionVerified: options.version === compatibility.testedRuflo,
          registered: names.length > 0, toolCount: names.length, tools: names
        } });
      } catch { send(503, { error: 'Ruflo 数据暂时不可用，请稍后重试。' }); }
    }
  }), 'ruflo-panel: authenticated read-only route');
  ctx.logger?.info?.('[dsh-ruflo-panel] 真实数据面板已加载（只读，复用工作台登录验证）');
}
