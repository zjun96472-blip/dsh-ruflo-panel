window.__ModuleLoader__.load({
  id: 'dsh-ruflo-panel',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;
    const PANEL = 'workbench-ruflo';
    const labels = { pending: '待处理', queued: '排队中', in_progress: '进行中', running: '运行中',
      completed: '已完成', failed: '失败', cancelled: '已取消', idle: '空闲', stopped: '已停止',
      active: '活跃', paused: '已暂停', unknown: '未知', low: '低', medium: '中', high: '高', normal: '普通', critical: '紧急' };
    const date = x => x ? new Date(x).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未记录';
    const fullDate = x => x ? new Date(x).toLocaleString('zh-CN') : '未记录';
    const titleOf = x => x.demo ? (x.namespace ? '个人工作台 · 编码约定' : 'Ruflo 安装验证') : x.title;
    function Icon({ kind = 'grid', size = 18, ...props }) {
      const paths = {
        grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
        task: 'M9 5h11 M9 12h11 M9 19h11 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',
        memory: 'M8 3v4 M16 3v4 M8 17v4 M16 17v4 M3 8h4 M3 16h4 M17 8h4 M17 16h4 M7 7h10v10H7z',
        agent: 'M9 5a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M5 21v-4a7 7 0 0 1 14 0v4 M9 16v5 M15 16v5',
        refresh: 'M20 7v5h-5 M4 17v-5h5 M19 11a7 7 0 0 0-12-5l-3 3 M5 13a7 7 0 0 0 12 5l3-3',
        arrow: 'M5 12h14 M14 7l5 5-5 5',
        search: 'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M15 15l6 6',
        link: 'M10 14l4-4 M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0',
        close: 'M6 6l12 12 M18 6L6 18',
        copy: 'M8 8h12v12H8z M4 16V4h12'
      };
      return h('svg', { ...props, width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[kind] || paths.grid }));
    }
    function Badge({ status, demo }) {
      return h('span', { className: `rf-badge ${demo ? 'rf-demo' : ['completed', 'active'].includes(status) ? 'rf-green' : ['failed', 'cancelled'].includes(status) ? 'rf-red' : ''}` },
        demo ? '安装演示' : labels[status] || status);
    }
    function Empty({ icon, title, children }) {
      return h('div', { className: 'rf-empty' }, h('span', { className: 'rf-empty-icon' }, h(Icon, { kind: icon, size: 28 })),
        h('h3', null, title), h('p', null, children));
    }
    function CopyPrompt({ text, children }) {
      const [copied, setCopied] = useState(false);
      const [failed, setFailed] = useState(false);
      return h('div', { className: 'rf-prompt' }, h('p', null, text), h('button', { className: 'rf-btn rf-small', onClick: async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setFailed(false); }
        catch { setFailed(true); }
      } }, h(Icon, { kind: 'copy', size: 14 }), copied ? '已复制，粘贴到聊天即可' : children || '复制提示词'),
      failed && h('small', { role: 'alert' }, '无法访问剪贴板，请选中上方文字复制。'));
    }
    function TaskList({ items, onOpen }) {
      return h('div', { className: 'rf-task-list' }, items.map(item => h('button', { key: item.id, className: 'rf-task-row', onClick: () => onOpen('tasks', item) },
        h('span', { className: `rf-task-symbol ${item.status === 'completed' ? 'rf-done' : ''}` }, item.status === 'completed' ? '✓' : '·'),
        h('span', { className: 'rf-task-title' }, h('strong', null, titleOf(item)), h('small', null, item.title)),
        h('span', { className: 'rf-row-meta' }, h(Badge, { status: item.status }), item.demo && h(Badge, { demo: true })),
        h('span', { className: 'rf-progress-wrap' }, h('span', { className: 'rf-progress' }, h('i', { style: { width: `${item.progress ?? 0}%` } })),
          h('small', null, item.progress == null ? '—' : `${item.progress}%`)), h(Icon, { kind: 'arrow', size: 16 })
      )));
    }
    function MemoryCard({ item, onOpen }) {
      return h('button', { className: 'rf-memory-card', onClick: () => onOpen('memories', item) },
        h('div', { className: 'rf-card-top' }, h('span', { className: 'rf-namespace' }, item.namespace), item.demo && h(Badge, { demo: true })),
        h('h3', null, titleOf(item)), h('p', null, item.content),
        h('div', { className: 'rf-card-foot' }, h('span', null, date(item.updatedAt)), h('span', null, '查看全文 ', h(Icon, { kind: 'arrow', size: 14 }))));
    }
    function Detail({ selected, close }) {
      const ref = useRef();
      useEffect(() => { ref.current?.showModal(); }, []);
      const { kind, item } = selected;
      const fields = [['记录 ID', item.id], ['创建时间', fullDate(item.createdAt)], ['更新时间', fullDate(item.updatedAt)]];
      if (kind === 'memories') fields.push(['命名空间', item.namespace], ['原始键名', item.title], ['来源', item.provenance || '未记录'], ['向量索引', item.hasEmbedding ? '该记录已有向量' : '该记录未生成向量']);
      if (kind === 'tasks') fields.push(['任务类型', item.type || '未记录'], ['优先级', labels[item.priority] || item.priority], ['分配给', item.assignedTo.join('、') || '尚未分配']);
      if (kind === 'agents') fields.push(['智能体类型', item.type || '未记录'], ['模型', item.model || '未记录'], ['任务次数', item.taskCount ?? '未记录']);
      return h('dialog', { ref, className: 'rf-dialog', onCancel: close, onClick: e => { if (e.target === ref.current) close(); } },
        h('div', { className: 'rf-detail' }, h('header', null, h('span', { className: 'rf-kicker' }, '记录详情'),
          h('button', { className: 'rf-icon-btn', onClick: close, 'aria-label': '关闭详情', autoFocus: true }, h(Icon, { kind: 'close' }))),
        h('h2', null, titleOf(item)), h('div', { className: 'rf-inline' }, item.status && h(Badge, { status: item.status }), item.demo && h(Badge, { demo: true })),
        h('div', { className: 'rf-content' }, kind === 'memories' ? item.content : item.title),
        item.truncated && h('p', { className: 'rf-notice' }, '内容超过 16,384 字符，此处显示前段。'),
        item.result && h(React.Fragment, null, h('h4', null, '记录结果'), h('pre', { className: 'rf-result' }, item.result)),
        h('dl', { className: 'rf-fields' }, fields.map(([key, value]) =>
          h('div', { key }, h('dt', null, key), h('dd', null, String(value)))
        ))
      ));
    }
    function Panel() {
      const [data, setData] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(true);
      const [tab, setTab] = useState('overview');
      const [query, setQuery] = useState('');
      const [status, setStatus] = useState('all');
      const [selected, setSelected] = useState(null);
      const [connectionOpen, setConnectionOpen] = useState(false);
      const refresh = useRef(() => {});
      useEffect(() => {
        let disposed = false;
        let running = false;
        let controller;
        async function load() {
          if (running || disposed) return;
          running = true;
          setBusy(true);
          controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          try {
            const response = await fetch('/ruflo-panel/state.json', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error(response.status === 401 ? '工作台登录已失效，请重新打开工作台后刷新。' : `暂时无法读取数据（${response.status}），可以重试。`);
            const value = await response.json();
            if (!value.integration || !value.tasks || !value.memories || !value.agents) throw new Error('数据格式不兼容，请检查插件版本。');
            if (!disposed) { setData(value); setError(''); }
          } catch (e) { if (!disposed) setError(e.name === 'AbortError' ? '读取超时，请稍后重试。' : e.message); }
          finally { clearTimeout(timeout); running = false; if (!disposed) setBusy(false); }
        }
        refresh.current = load;
        void load();
        const timer = setInterval(() => { if (!document.hidden) void load(); }, 10000);
        return () => { disposed = true; clearInterval(timer); controller?.abort(); };
      }, []);
      const choose = key => { setTab(key); setQuery(''); setStatus('all'); };
      const open = (kind, item) => setSelected({ kind, item });
      const integration = data?.integration;
      const items = tab === 'overview' ? [] : (data?.[tab]?.items ?? []).filter(x => {
        const hay = [x.title, x.content, x.namespace, x.type, x.id, ...(x.tags ?? [])].join(' ').toLowerCase();
        return hay.includes(query.toLowerCase().trim()) && (status === 'all' || x.status === status);
      });
      const tabs = [['overview', '总览'], ['tasks', '任务'], ['memories', '记忆'], ['agents', '智能体']];
      const recent = data ? [...data.tasks.items.map(x => ({ ...x, kind: 'tasks', action: `任务 · ${labels[x.status] || x.status}` })),
        ...data.memories.items.map(x => ({ ...x, kind: 'memories', action: '记忆 · 已保存' }))]
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5) : [];
      return h('section', { className: 'rf-root', 'aria-label': 'Ruflo 数据面板' }, h('style', null, CSS),
        h('div', { className: 'rf-page' },
          h('header', { className: 'rf-header' }, h('div', null, h('div', { className: 'rf-kicker' }, h('span', { className: 'rf-wordmark' }, 'R'), 'RUFLO / PERSONAL WORKSPACE'),
            h('h1', null, 'Ruflo 工作台'), h('p', null, '看任务进度，也看每一次积累。')),
            h('div', { className: 'rf-header-actions' }, h('button', { className: 'rf-connection', onClick: () => setConnectionOpen(!connectionOpen), 'aria-expanded': connectionOpen },
              h('i', { className: integration?.registered && !error ? 'rf-online' : 'rf-offline' }),
              error ? '连接待恢复' : integration?.registered ? '已接入 Harness' : data ? '工具未连接' : '正在读取…'),
              h('button', { className: 'rf-btn', disabled: busy, onClick: () => refresh.current(), 'aria-label': '刷新数据' }, h(Icon, { kind: 'refresh' }), busy ? '读取中' : '刷新'))),
          error && h('div', { className: 'rf-alert', role: 'alert' }, error, data && ' 当前显示上次成功读取的数据。'),
          connectionOpen && data && h('div', { className: 'rf-connection-detail' },
            h('strong', null, `Ruflo ${integration.version} · ${integration.toolCount} 项工具已注册到 Harness`),
            h('p', null, '显示当前配置工作区中的 Ruflo 数据。连接到同一个工作区的其他客户端会看到同一份记录；此页面每 10 秒读取一次。'),
            integration.versionVerified === false && h('p', { className: 'rf-notice' }, '此 Ruflo 版本尚未验证兼容性，升级后请核对数据结构。'),
            h('code', null, integration.workspace), h('details', null, h('summary', null, '查看已注册工具'), h('pre', null, integration.tools.join('\n')))),
          h('div', { className: 'rf-stats' }, [
            ['tasks', '任务记录', 'task', data?.tasks.total, data?.tasks.ok ? `${data.tasks.counts.completed ?? 0} 项已完成` : '等待读取'],
            ['memories', '长期记忆', 'memory', data?.memories.total, data?.memories.ok ? '已持久化的有效记录' : '等待读取'],
            ['agents', '智能体记录', 'agent', data?.agents.total, data?.agents.total === 0 ? '尚未创建智能体' : '查看登记状态'],
            ['connection', '可用工具', 'link', integration?.toolCount, '任务 / 记忆 / 协作']
          ].map(([key, label, icon, count, note]) => h('button', { key, className: 'rf-stat', onClick: () => key === 'connection' ? setConnectionOpen(!connectionOpen) : choose(key) },
            h('span', { className: 'rf-stat-label' }, label, h(Icon, { kind: icon })), h('strong', null, count ?? '—'), h('small', null, note)))),
          h('nav', { className: 'rf-tabs', 'aria-label': 'Ruflo 数据分类' }, tabs.map(([key, label]) => h('button', {
            key, className: tab === key ? 'is-active' : '', onClick: () => choose(key), 'aria-current': tab === key ? 'page' : undefined
          }, label, key !== 'overview' && h('span', null, data?.[key]?.total ?? '—')))),
          !data && !error && h(Empty, { icon: 'refresh', title: '正在读取 Ruflo 数据' }, '连接工作台，加载本地记录…'),
          data && h(React.Fragment, null,
            ['tasks', 'memories', 'agents'].filter(key => !data[key].ok).map(key => h('div', { className: 'rf-alert', role: 'alert', key },
              `${tabs.find(x => x[0] === key)[1]}：${data[key].error}`)),
            tab === 'overview' ? h('div', { className: 'rf-overview' },
              h('div', { className: 'rf-main-column' }, h('section', { className: 'rf-box' },
                h('div', { className: 'rf-section-head' }, h('h2', null, '最近任务'), h('button', { className: 'rf-text-btn', onClick: () => choose('tasks') }, '查看全部 ', h(Icon, { kind: 'arrow', size: 14 }))),
                data.tasks.items.length ? h(TaskList, { items: data.tasks.items.slice(0, 4), onOpen: open }) : h(Empty, { icon: 'task', title: data.tasks.ok ? '还没有任务记录' : '任务读取失败' }, '在聊天中让助手使用 Ruflo 创建任务，记录会出现在这里。')),
                h('section', { className: 'rf-box rf-memory-section' }, h('div', { className: 'rf-section-head' }, h('h2', null, '最近记忆'),
                  h('button', { className: 'rf-text-btn', onClick: () => choose('memories') }, '打开记忆库 ', h(Icon, { kind: 'arrow', size: 14 }))),
                  data.memories.items.length ? h('div', { className: 'rf-memory-grid' }, data.memories.items.slice(0, 2).map(x => h(MemoryCard, { key: x.id, item: x, onOpen: open }))) :
                    h(Empty, { icon: 'memory', title: data.memories.ok ? '还没有保存的记忆' : '记忆读取失败' }, '可以保存项目约定、偏好和需要长期保留的信息。'))),
              h('aside', { className: 'rf-side-column' }, h('section', { className: 'rf-guide' }, h('span', { className: 'rf-kicker' }, '从一句话开始'),
                h('h2', null, '让聊天产生积累'), h('p', null, '回到聊天，告诉助手使用 Ruflo。工具产生的记录会自动显示在这里。'),
                h(CopyPrompt, { text: '请使用 Ruflo 的任务工具，帮我创建一个任务：整理我的个人工作台待办。' }),
                h('small', null, '复制后粘贴到聊天发送。普通聊天记录不会自动变成 Ruflo 数据。')),
                h('section', { className: 'rf-box rf-history' }, h('h2', null, '最近记录'), h('p', { className: 'rf-caption' }, '按任务与记忆的保存时间排列'),
                  recent.length ? recent.map(x => h('button', { className: 'rf-event', key: x.kind + x.id, onClick: () => open(x.kind, x) },
                    h('i'), h('span', null, h('small', null, x.action), h('strong', null, titleOf(x)), h('time', null, date(x.updatedAt))))) : h('p', { className: 'rf-caption' }, '暂无保存记录')))) :
              h('div', { className: 'rf-data-view' }, h('div', { className: 'rf-toolbar' },
                h('label', { className: 'rf-search' }, h(Icon, { kind: 'search' }), h('input', { value: query, onChange: e => setQuery(e.target.value), placeholder: '搜索当前加载的记录…', 'aria-label': '搜索记录' })),
                tab === 'tasks' && h('select', { value: status, onChange: e => setStatus(e.target.value), 'aria-label': '筛选任务状态' },
                  h('option', { value: 'all' }, '全部状态'), [...new Set(data.tasks.items.map(x => x.status))].map(s => h('option', { key: s, value: s }, labels[s] || s))),
                h('span', { className: 'rf-caption' }, `显示 ${items.length} 条 / 共 ${data[tab].total ?? '—'} 条`)),
                data[tab].limited && h('p', { className: 'rf-notice' }, `当前仅加载最近 ${data.limit} 条，搜索作用于已加载记录。`),
                tab === 'memories' && h('p', { className: 'rf-notice' }, data.memories.initialized === false ? '尚未建立记忆数据库；通过 Ruflo 保存第一条记忆后，这里会自动显示。' : data.memories.embedded ? `${data.memories.embedded} 条记录已有向量。此页使用文字筛选。` : '当前记忆尚未生成向量；文字筛选和精确读取可用。'),
                tab === 'agents' && data.agents.total > 0 && h('p', { className: 'rf-notice' }, '这里显示 Ruflo 保存的状态，不代表进程仍在运行。'),
                items.length ? (tab === 'tasks' ? h('section', { className: 'rf-box' }, h(TaskList, { items, onOpen: open })) :
                  tab === 'memories' ? h('div', { className: 'rf-memory-grid' }, items.map(x => h(MemoryCard, { key: x.id, item: x, onOpen: open }))) :
                    h('div', { className: 'rf-agent-grid' }, items.map(x => h('button', { key: x.id, className: 'rf-agent-card', onClick: () => open('agents', x) },
                      h(Icon, { kind: 'agent', size: 28 }), h('h3', null, x.title), h(Badge, { status: x.status }), h('p', null, x.model || '模型未记录'))))) :
                  h('section', { className: 'rf-box' }, h(Empty, { icon: tab === 'agents' ? 'agent' : 'search', title: !data[tab].ok ? '暂时无法读取记录' : query || status !== 'all' ? '没有匹配的记录' : tab === 'agents' ? '还没有创建智能体' : '这里还没有记录' },
                    !data[tab].ok ? '请稍后刷新，读取失败不会修改原数据。' : tab === 'agents' && !query ? '接入工具不会自动创建或启动智能体。后续通过 Ruflo 创建的智能体会列在这里。' : '换一个关键词，或在聊天中使用 Ruflo 创建记录。')))),
          h('footer', { className: 'rf-footer' }, h('span', null, '本地真实数据', ' · ', '仅查看'),
            h('span', null, data ? `${error ? '上次成功读取' : '更新于'} ${date(data.at)} · 每 10 秒刷新` : '等待连接'))),
        selected && h(Detail, { key: selected.kind + selected.item.id, selected, close: () => setSelected(null) }));
    }
    const CSS = `
      .rf-root{height:100%;min-height:0;overflow:auto;background:#f8f9f7;color:#24332d;font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.6;color-scheme:light}
      .rf-root *,.rf-dialog *{box-sizing:border-box}.rf-root button,.rf-dialog button,.rf-root input,.rf-root select{font-family:inherit}
      .rf-root button,.rf-dialog button{cursor:pointer}.rf-root button:disabled{cursor:wait;opacity:.6}
      .rf-root button:focus-visible,.rf-root input:focus-visible,.rf-root select:focus-visible,.rf-dialog button:focus-visible{outline:3px solid #6eaa8b;outline-offset:3px}
      .rf-page{max-width:1440px;margin:0 auto;padding:38px 42px 24px}.rf-header{display:flex;justify-content:space-between;gap:24px;align-items:center;margin-bottom:28px}
      .rf-kicker{font-size:10px;letter-spacing:1.8px;font-weight:600;color:#718078;display:flex;align-items:center;gap:9px}
      .rf-wordmark{width:23px;height:23px;display:inline-grid;place-items:center;background:#214e3c;color:#fff;border-radius:6px;font-family:Georgia,serif;font-size:17px;font-style:italic;letter-spacing:0}
      .rf-header h1{font-size:30px;line-height:1.3;letter-spacing:-.8px;margin:13px 0 8px;font-weight:650}.rf-header p{margin:0;font-size:13px;color:#7b857f}
      .rf-header-actions,.rf-inline{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.rf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;border:1px solid #dfe4dd;border-radius:8px;padding:9px 14px;color:#3c4d44;font-size:12px}
      .rf-btn:hover{background:#eef2ed}.rf-small{font-size:11px;padding:7px 10px}.rf-connection{background:transparent;border:0;color:#567061;font-size:12px;display:flex;align-items:center;gap:7px;padding:8px 0}
      .rf-connection i{width:6px;height:6px;border-radius:100%}.rf-online{background:#519b74;box-shadow:0 0 0 3px #e3eee7}.rf-offline{background:#b59864}
      .rf-connection-detail{padding:18px 22px;background:#ecf2ed;border:1px solid #dce5dd;border-radius:10px;font-size:12px;margin-bottom:22px;overflow-wrap:anywhere}.rf-connection-detail p{color:#62726a}.rf-connection-detail pre{max-height:220px;overflow:auto;font-size:11px}
      .rf-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:28px}.rf-stat{text-align:left;border:1px solid #e4e8e0;border-radius:11px;padding:20px 22px;background:#fff;transition:background .15s}
      .rf-stat:hover{background:#f2f6f0}.rf-stat-label{display:flex;align-items:center;justify-content:space-between;color:#718078;font-size:12px;gap:10px}.rf-stat-label svg{color:#98a59b}
      .rf-stat>strong{display:block;font-size:31px;letter-spacing:-1px;line-height:1.4;margin-top:8px;font-weight:550;font-variant-numeric:tabular-nums}.rf-stat>small{color:#8a958d;font-size:10px}
      .rf-tabs{display:flex;gap:26px;border-bottom:1px solid #e1e6dd;margin-bottom:24px}.rf-tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:0 2px 12px;color:#8a958d;font-size:13px;display:flex;gap:8px;align-items:center;white-space:nowrap}
      .rf-tabs button.is-active{color:#285b43;border-color:#285b43;font-weight:600}.rf-tabs span{font-size:10px;background:#edf0e9;padding:0 6px;border-radius:4px;color:#839080}
      .rf-overview{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px}.rf-main-column,.rf-side-column{display:flex;flex-direction:column;gap:22px;min-width:0}
      .rf-box{background:#fff;border:1px solid #e4e8e0;border-radius:11px;overflow:hidden}.rf-section-head{padding:19px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px}.rf-root h2{font-size:14px;margin:0;font-weight:600}
      .rf-text-btn{border:0;background:none;color:#7c8a80;font-size:11px;padding:0;display:flex;align-items:center;gap:7px}.rf-text-btn:hover{color:#245b3b}
      .rf-task-row{background:transparent;border:0;border-top:1px solid #f0f2ec;width:100%;text-align:left;display:flex;align-items:center;gap:13px;padding:20px 22px;color:#304638}.rf-task-row:hover{background:#fafbf8}
      .rf-task-symbol{height:22px;width:22px;border:1px solid #d8dfd5;flex-shrink:0;border-radius:6px;text-align:center;line-height:20px;color:#9ca89b}.rf-done{background:#eaf2e8;color:#427b52;border-color:#d4e4d3}
      .rf-task-title{min-width:0;flex:1}.rf-task-title strong{font-size:12px;font-weight:550;display:block}.rf-task-title small{display:block;max-width:100%;color:#94a08f;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;font-size:10px;margin-top:5px}
      .rf-row-meta{display:flex;gap:5px;flex-direction:column;align-items:flex-start}.rf-badge{display:inline-block;font-size:10px;white-space:nowrap;padding:2px 7px;border-radius:4px;background:#eef1ee;color:#6b7b70}.rf-green{background:#e8f1e8;color:#54805c}.rf-red{background:#f8ebe7;color:#a76054}.rf-demo{background:#f4f1e8;color:#a3936b}
      .rf-progress-wrap{display:flex;align-items:center;gap:7px;width:83px}.rf-progress{height:4px;background:#ebefe6;border-radius:4px;flex:1;overflow:hidden}.rf-progress i{display:block;height:100%;background:#80a67d}.rf-progress-wrap small{font-size:9px;color:#81917f}
      .rf-memory-section{padding-bottom:20px}.rf-memory-section .rf-memory-grid{padding:0 20px;grid-template-columns:1fr}.rf-memory-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.rf-memory-card{background:#fff;border:1px solid #e4e8df;text-align:left;border-radius:9px;padding:20px 22px;color:#304638;min-width:0;transition:border-color .15s}
      .rf-memory-card:hover{border-color:#98b599}.rf-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.rf-namespace{font-size:10px;color:#829777;overflow:hidden;text-overflow:ellipsis}.rf-memory-card h3{font-size:15px;font-weight:550;margin:14px 0 10px;overflow-wrap:anywhere}.rf-memory-card p{font-size:12px;line-height:1.9;color:#788572;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}
      .rf-card-foot{border-top:1px solid #edf0e8;margin-top:18px;padding-top:12px;display:flex;justify-content:space-between;font-size:10px;color:#99a38f}.rf-card-foot span:last-child{display:flex;align-items:center;gap:6px;color:#6c8868}
      .rf-guide{padding:24px;background:#edf2e7;border:1px solid #e2e8d9;border-radius:11px}.rf-guide .rf-kicker{font-size:9px;color:#8d9c7b}.rf-guide h2{font-size:19px;margin:12px 0;color:#446044;letter-spacing:-.4px}.rf-guide>p{font-size:12px;line-height:1.9;color:#7a8c70}.rf-guide>small{font-size:10px;line-height:1.8;color:#8f9b85;display:block;margin-top:14px}
      .rf-prompt{background:#f8faf5;border:1px solid #dde6d4;border-radius:8px;padding:13px}.rf-prompt p{font-size:11px;color:#657d5d;line-height:1.8;margin:0 0 11px}.rf-prompt small{display:block;font-size:11px;margin-top:8px;color:#a46943}.rf-prompt .rf-btn{background:#fff;width:100%}
      .rf-history{padding:21px}.rf-caption{font-size:10px;color:#929d89;margin:5px 0 0}.rf-event{display:flex;align-items:flex-start;gap:11px;border:0;background:none;text-align:left;width:100%;padding:17px 0 0;color:#75856b}.rf-event i{margin-top:6px;width:5px;height:5px;background:#99af8c;border-radius:50%;flex-shrink:0}.rf-event small{font-size:10px;color:#91a283;display:block}.rf-event strong{font-size:11px;display:block;font-weight:500;margin:4px 0;overflow-wrap:anywhere}.rf-event time{font-size:9px;color:#b1b8a7}
      .rf-toolbar{display:flex;align-items:center;gap:13px;margin-bottom:18px;flex-wrap:wrap}.rf-search{display:flex;gap:10px;align-items:center;background:#fff;border:1px solid #dfe5db;border-radius:8px;padding:9px 13px;color:#98a38d;width:300px;max-width:100%}.rf-search input{border:0;outline:none;background:none;width:100%;min-width:0;color:#3e563a;font-size:12px}.rf-search input::placeholder{color:#9da794}.rf-toolbar select{background:#fff;border:1px solid #dfe5db;border-radius:7px;padding:9px;color:#5a7053;font-size:11px}.rf-toolbar>.rf-caption{margin-left:auto}
      .rf-empty{text-align:center;padding:50px 22px 54px;max-width:540px;margin:auto}.rf-empty-icon{display:inline-flex;padding:14px;background:#f0f4eb;border:1px solid #e3eadc;border-radius:15px;color:#95ad84}.rf-empty h3{font-size:15px;font-weight:550;margin:17px 0 8px}.rf-empty p{font-size:12px;color:#91a086;line-height:1.9;margin:0}
      .rf-notice{font-size:11px;line-height:1.8;color:#89947c;margin:0 0 18px}.rf-alert{padding:12px 17px;background:#fff4e9;border:1px solid #f1d9be;color:#9b7045;border-radius:8px;font-size:12px;margin-bottom:18px}
      .rf-agent-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}.rf-agent-card{border:1px solid #e0e7d8;border-radius:11px;background:#fff;padding:23px;color:#667f5b;text-align:left}.rf-agent-card h3{font-size:15px}.rf-agent-card p{font-size:11px;color:#92a084}
      .rf-footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #e4e8df;margin-top:32px;padding-top:16px;font-size:10px;color:#a3ac99}
      .rf-dialog{padding:0;border:1px solid #e1e5dc;border-radius:14px;width:min(650px,calc(100vw - 32px));max-height:85vh;color:#304638;background:#fff;box-shadow:0 22px 90px #14291d30;font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif}.rf-dialog::backdrop{background:#182c2450;backdrop-filter:blur(3px)}.rf-detail{padding:27px}.rf-detail>header{display:flex;justify-content:space-between;align-items:center}.rf-detail h2{font-size:23px;line-height:1.5;margin:17px 0 12px;overflow-wrap:anywhere}.rf-icon-btn{border:0;background:transparent;color:#83917c;display:inline-flex;padding:5px}.rf-content{margin:22px 0;padding:18px;background:#f5f7f0;border:1px solid #e6eadf;border-radius:9px;line-height:1.9;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.rf-fields{margin:22px 0 0;font-size:11px}.rf-fields>div{display:grid;grid-template-columns:100px 1fr;padding:10px 0;border-top:1px solid #edf0e7;gap:15px}.rf-fields dt{color:#9ca58f}.rf-fields dd{margin:0;overflow-wrap:anywhere;color:#6a7d60}.rf-result{font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere;background:#f8f9f5;padding:14px;border-radius:7px}.rf-detail h4{font-size:12px;font-weight:500}
      .rf-stat>small,.rf-task-title small,.rf-caption,.rf-card-foot,.rf-footer{font-size:11px}.rf-memory-card p{font-size:13px}.rf-guide>small{font-size:11px}
      @media(min-width:1500px){.rf-overview{grid-template-columns:minmax(0,1fr) 330px}.rf-memory-section .rf-memory-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}}
      @media(max-width:1150px){.rf-page{padding:28px 24px 20px}.rf-overview{grid-template-columns:1fr}.rf-side-column{display:grid;grid-template-columns:1fr 1fr}.rf-stat{padding:16px}.rf-header h1{font-size:27px}}
      @media(max-width:700px){.rf-page{padding:22px 16px}.rf-header{align-items:flex-start;flex-direction:column;gap:16px}.rf-stats{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.rf-stat>strong{font-size:27px}.rf-side-column{display:flex}.rf-memory-grid,.rf-agent-grid{grid-template-columns:1fr}.rf-tabs{gap:20px}.rf-task-row{padding:17px 14px;gap:10px}.rf-progress-wrap{display:none}.rf-task-row>svg{display:none}.rf-row-meta{flex-shrink:0}.rf-task-title small{max-width:180px}.rf-toolbar>.rf-caption{width:100%;margin:0}.rf-footer{flex-direction:column;gap:5px}.rf-detail{padding:21px}.rf-fields>div{grid-template-columns:78px 1fr}}
      @media(prefers-reduced-motion:reduce){.rf-root *{transition:none!important}}
    `;
    return {
      name: 'dsh-ruflo-panel', inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', function* () {
          yield ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 9, label: () => 'Ruflo' }, props => h(Icon, { ...props, kind: 'grid' }));
        });
        ctx.slots.inject('main', function* () {
          yield ctx.slots.register({ name: 'main', key: PANEL }, () => h(Panel));
        });
      }
    };
  }
});
