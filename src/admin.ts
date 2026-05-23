export function getAdminHTML(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Proxy Gateway</title>
  <link rel="icon" type="image/png" href="/favicon.ico">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f4; color: #1c1917; line-height: 1.6; }

    /* Login */
    #login-view { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f4; }
    .login-card { background: #fff; border-radius: 16px; padding: 40px; width: 380px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .login-card h1 { font-size: 1.5rem; text-align: center; margin-bottom: 6px; color: #1c1917; }
    .login-card .sub { text-align: center; color: #a8a29e; margin-bottom: 28px; font-size: 0.9rem; }
    .login-card .logo { text-align: center; margin-bottom: 20px; font-size: 2.5rem; }
    .login-card .remember { display: flex; align-items: center; gap: 6px; margin: 12px 0; font-size: 0.85rem; color: #78716c; }

    /* Layout */
    #app { display: none; min-height: 100vh; }
    .sidebar { width: 220px; background: #fff; border-right: 1px solid #e7e5e4; position: fixed; top: 0; left: 0; bottom: 0; display: flex; flex-direction: column; z-index: 10; }
    .sidebar-logo { padding: 24px 20px 20px; display: flex; align-items: center; gap: 10px; font-size: 1.15rem; font-weight: 700; color: #1c1917; border-bottom: 1px solid #e7e5e4; }
    .sidebar-logo span.icon { font-size: 1.4rem; }
    .sidebar-nav { flex: 1; padding: 12px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; cursor: pointer; color: #78716c; font-size: 0.9rem; font-weight: 500; transition: all 0.15s; margin-bottom: 2px; }
    .nav-item:hover { background: #f5f5f4; color: #1c1917; }
    .nav-item.active { background: #1c1917; color: #fff; }
    .nav-item .nav-icon { font-size: 1.1rem; width: 22px; text-align: center; }
    .sidebar-footer { padding: 16px 20px; border-top: 1px solid #e7e5e4; }
    .sidebar-footer button { width: 100%; padding: 8px; background: none; border: 1px solid #e7e5e4; border-radius: 8px; cursor: pointer; color: #78716c; font-size: 0.85rem; transition: all 0.15s; }
    .sidebar-footer button:hover { background: #fef2f2; color: #ef4444; border-color: #fecaca; }

    .main { margin-left: 220px; padding: 28px 24px 28px 24px; min-height: 100vh; width: calc(100% - 220px); display: flex; flex-direction: column; }
    .page { display: none; width: 100%; flex-direction: column; flex: 1; }
    .page.active { display: flex; }
    .page-title { font-size: 1.4rem; font-weight: 700; color: #1c1917; margin-bottom: 24px; }

    /* Cards */
    .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #e7e5e4; width: 100%; }
    .card-fill { flex: 1; display: flex; flex-direction: column; margin-bottom: 0; }
    .card-fill .pagination { margin-top: auto; }
    .card h3 { font-size: 1rem; font-weight: 600; color: #1c1917; margin-bottom: 16px; }

    /* Stats */
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; width: 100%; }
    .stat-card { background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; }
    .stat-card .label { font-size: 0.8rem; color: #a8a29e; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-card .value { font-size: 2rem; font-weight: 700; margin-top: 4px; }
    .stat-card .value.blue { color: #3b82f6; }
    .stat-card .value.green { color: #22c55e; }
    .stat-card .value.red { color: #ef4444; }
    .stat-card .value.purple { color: #8b5cf6; }

    /* Form */
    .input-group { margin-bottom: 14px; }
    .input-group label { display: block; font-size: 0.85rem; color: #78716c; margin-bottom: 5px; font-weight: 500; }
    input[type="text"], input[type="password"] {
      width: 100%; padding: 10px 14px; border: 1px solid #d6d3d1; border-radius: 8px;
      font-size: 0.9rem; color: #1c1917; background: #fff; outline: none; transition: border 0.15s;
    }
    input:focus { border-color: #1c1917; }
    textarea {
      width: 100%; padding: 10px 14px; border: 1px solid #d6d3d1; border-radius: 8px;
      font-size: 0.85rem; color: #1c1917; background: #fff; outline: none; resize: vertical;
      min-height: 100px; font-family: 'SF Mono', Monaco, monospace; transition: border 0.15s;
    }
    textarea:focus { border-color: #1c1917; }

    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 0.9rem; cursor: pointer; font-weight: 600; transition: all 0.15s; }
    .btn:hover { opacity: 0.9; }
    .btn-primary { background: #1c1917; color: #fff; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-outline { background: #fff; border: 1px solid #d6d3d1; color: #78716c; }
    .btn-outline:hover { border-color: #1c1917; color: #1c1917; }
    .btn-success { background: #22c55e; color: #fff; }
    .btn-sm { padding: 6px 14px; font-size: 0.8rem; }
    .btn-block { width: 100%; }

    /* Table */
    .table-wrap { overflow-x: auto; width: 100%; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th { text-align: left; font-size: 0.75rem; color: #a8a29e; font-weight: 600; padding: 8px 10px; border-bottom: 1px solid #e7e5e4; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
    td { padding: 10px 10px; border-bottom: 1px solid #f5f5f4; font-size: 0.85rem; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    tr:hover td { background: #fafaf9; }
    .token-mono { font-family: 'SF Mono', Monaco, monospace; font-size: 0.82rem; color: #78716c; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .badge-on { background: #dcfce7; color: #16a34a; }
    .badge-off { background: #fee2e2; color: #dc2626; }
    .badge-valid { background: #dcfce7; color: #16a34a; }
    .badge-invalid { background: #fee2e2; color: #dc2626; }
    .badge-unchecked { background: #f5f5f4; color: #a8a29e; }
    .disable-reason { font-size: 0.7rem; color: #a8a29e; margin-top: 2px; }
    .btn-warn { background: #f59e0b; color: #fff; }
    .check-actions { display: flex; gap: 8px; margin-bottom: 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinning { display: inline-block; animation: spin 1s linear infinite; }
    .actions-cell { display: flex; gap: 6px; }
    .empty-state { text-align: center; color: #a8a29e; padding: 48px; font-size: 0.9rem; }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 12px; border-top: 1px solid #f5f5f4; }
    .pagination .info { font-size: 0.8rem; color: #a8a29e; }
    .pagination .pages { display: flex; gap: 4px; }
    .page-btn { min-width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: 1px solid #e7e5e4; border-radius: 8px; background: #fff; cursor: pointer; font-size: 0.85rem; color: #78716c; transition: all 0.15s; }
    .page-btn:hover { border-color: #1c1917; color: #1c1917; }
    .page-btn.active { background: #1c1917; color: #fff; border-color: #1c1917; }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Add form */
    .add-grid { display: grid; grid-template-columns: 1fr 2fr auto; gap: 12px; align-items: end; }
    .add-grid .input-group { margin-bottom: 0; }

    /* Info */
    .code-box { background: #1c1917; color: #e7e5e4; border-radius: 8px; padding: 16px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.85rem; word-break: break-all; margin: 8px 0 16px; white-space: pre-wrap; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .info-item { background: #fafaf9; border-radius: 8px; padding: 12px; border: 1px solid #e7e5e4; }
    .info-item .label { font-size: 0.75rem; color: #a8a29e; margin-bottom: 2px; }
    .info-item .val { font-size: 0.85rem; color: #1c1917; font-weight: 500; font-family: 'SF Mono', Monaco, monospace; }

    /* Bulk */
    .bulk-toggle { margin-top: 12px; }
    .bulk-box { margin-top: 12px; }
    .bulk-hint { color: #a8a29e; font-size: 0.8rem; margin-top: 4px; }
    .hidden { display: none !important; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 100; display: flex; align-items: center; justify-content: center; }
    .modal { background: #fff; border-radius: 16px; padding: 28px; width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    .modal h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }

    /* Toast */
    .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 10px; font-size: 0.9rem; z-index: 1000; animation: slideIn 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .toast-ok { background: #dcfce7; color: #16a34a; }
    .toast-err { background: #fee2e2; color: #dc2626; }
    @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  </style>
</head>
<body>

<!-- Login -->
<div id="login-view">
  <div class="login-card">
    <div class="logo">&#128640;</div>
    <h1>API Proxy Gateway</h1>
    <p class="sub">统一号池与限流管理</p>
    <div class="input-group">
      <label>Gateway Key</label>
      <input type="password" id="login-key" placeholder="输入管理密钥" autofocus>
    </div>
    <label class="remember"><input type="checkbox" id="remember-me" checked> 记住登录状态</label>
    <button class="btn btn-primary btn-block" onclick="login()">登录</button>
  </div>
</div>

<!-- App -->
<div id="app">
  <div class="sidebar">
    <div class="sidebar-logo"><span class="icon">&#128640;</span> API Gateway</div>
    <nav class="sidebar-nav">
      <div class="nav-item active" data-page="dashboard"><span class="nav-icon">&#9632;</span> 仪表盘</div>
      <div class="nav-item" data-page="tokens"><span class="nav-icon">&#9883;</span> 号池管理</div>
      <div class="nav-item" data-page="info"><span class="nav-icon">&#8635;</span> 接入信息</div>
    </nav>
    <div class="sidebar-footer">
      <button onclick="logout()">退出登录</button>
    </div>
  </div>

  <div class="main">
    <!-- Dashboard -->
    <div class="page active" id="page-dashboard">
      <div class="page-title">仪表盘</div>
      <div class="stats">
        <div class="stat-card"><div class="label">总计 Token</div><div class="value blue" id="s-total">0</div></div>
        <div class="stat-card"><div class="label">可用 (含环境变量)</div><div class="value green" id="s-available">0</div></div>
        <div class="stat-card"><div class="label">已禁用</div><div class="value red" id="s-disabled">0</div></div>
        <div class="stat-card"><div class="label">已验证有效</div><div class="value green" id="s-valid">0</div></div>
      </div>
      <div class="card card-fill">
        <h3>最近添加的 Token</h3>
        <div class="table-wrap" style="flex:1">
          <table>
            <thead><tr><th>名称/备注</th><th>添加时间</th><th>状态</th></tr></thead>
            <tbody id="recent-list"></tbody>
          </table>
          <div id="recent-empty" class="empty-state hidden">暂无账号</div>
        </div>
        <div id="recent-pagination" class="pagination"></div>
      </div>
    </div>

    <!-- Tokens -->
    <div class="page" id="page-tokens">
      <div class="page-title">号池管理</div>
      <div class="card">
        <h3>连通性检测</h3>
        <p style="font-size:0.85rem;color:#78716c;margin-bottom:12px">向配置的目标服务器发送 Google/gemini-3.1-pro-preview 模型的简单测试对话，验证 Key 是否真实存活可用。</p>
        <div class="check-actions">
          <button class="btn btn-primary" id="btn-check-all" onclick="checkAllTokens()">&#9889; 一键检测所有状态</button>
          <span id="check-progress" style="font-size:0.85rem;color:#78716c;align-self:center"></span>
        </div>
      </div>
      <div class="card">
        <h3>添加真实 API Key</h3>
        <div class="add-grid">
          <div class="input-group"><label>名称 / 备注</label><input type="text" id="add-name" placeholder="例如：主账号、备用Key1"></div>
          <div class="input-group"><label>API Key / Token</label><input type="text" id="add-token" placeholder="sk-..."></div>
          <button class="btn btn-primary" onclick="addToken()">添加</button>
        </div>
        <div class="bulk-toggle">
          <button class="btn btn-outline btn-sm" onclick="toggleBulk()">批量导入</button>
        </div>
        <div id="bulk-box" class="bulk-box hidden">
          <textarea id="bulk-tokens" placeholder="每行一个，格式：名称,Token&#10;主号,sk-xxx&#10;&#10;也支持只填Token（名称自动设为Unnamed）：&#10;sk-yyy"></textarea>
          <p class="bulk-hint">格式：名称,Token（使用英文逗号分隔）</p>
          <button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="bulkAdd()">批量添加</button>
        </div>
      </div>
      <div class="card card-fill">
        <h3>Token 列表</h3>
        <div class="table-wrap" style="flex:1">
          <table>
            <thead><tr><th>名称/备注</th><th>API Key</th><th>添加时间</th><th>启用</th><th>有效性</th><th>操作</th></tr></thead>
            <tbody id="token-list"></tbody>
          </table>
          <div id="list-empty" class="empty-state hidden">还没有 Token</div>
        </div>
        <div id="token-pagination" class="pagination"></div>
      </div>
    </div>

    <!-- Info -->
    <div class="page" id="page-info">
      <div class="page-title">接入信息</div>
      <div class="card">
        <h3>通用 API 端点</h3>
        <div class="info-grid">
          <div class="info-item"><div class="label">Base URL</div><div class="val">${baseUrl}</div></div>
          <div class="info-item"><div class="label">OpenAI 格式聊天</div><div class="val">/v1/chat/completions</div></div>
          <div class="info-item"><div class="label">Anthropic 格式聊天</div><div class="val">/v1/messages</div></div>
          <div class="info-item"><div class="label">模型列表获取</div><div class="val">/v1/models</div></div>
        </div>
      </div>
      <div class="card">
        <h3>OpenAI 客户端调用示例</h3>
        <div class="code-box">curl -s ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role":"user","content":"你好"}]
  }'</div>
      </div>
      <div class="card">
        <h3>Anthropic (Claude) 调用示例</h3>
        <div class="code-box">curl -s ${baseUrl}/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_GATEWAY_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "claude-3-opus-20240229",
    "max_tokens": 1024,
    "messages": [{"role":"user","content":"你好"}]
  }'</div>
      </div>
      <div class="card">
        <h3>Claude Code 配置</h3>
        <div class="code-box">export ANTHROPIC_BASE_URL=${baseUrl}
export ANTHROPIC_API_KEY=YOUR_GATEWAY_KEY

claude</div>
      </div>
    </div>
  </div>
</div>

<!-- Edit Modal -->
<div id="edit-modal" class="modal-overlay hidden">
  <div class="modal">
    <h3>编辑账号信息</h3>
    <input type="hidden" id="edit-token-id">
    <div class="input-group">
      <label>名称 / 备注</label>
      <input type="text" id="edit-name" placeholder="账号备注">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeEditModal()">取消</button>
      <button class="btn btn-primary" onclick="saveEdit()">保存</button>
    </div>
  </div>
</div>

<script>
const BASE = '${baseUrl}';
let authKey = '';
const PAGE_SIZE = 10;
let tokenPage = 1;
let recentPage = 1;
let allTokens = [];

function toast(msg, ok = true) {
  const el = document.createElement('div');
  el.className = 'toast ' + (ok ? 'toast-ok' : 'toast-err');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function mask(t) {
  if (!t) return '-';
  if (t.length <= 12) return t;
  return t.slice(0, 8) + '...' + t.slice(-4);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authKey } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(BASE + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderPagination(containerId, total, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  container.classList.remove('hidden');
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);
  let html = '<div class="info">显示 ' + start + '-' + end + ' / 共 ' + total + ' 条</div><div class="pages">';
  html += '<button class="page-btn" onclick="' + onPageChange + '(' + (currentPage - 1) + ')"' + (currentPage <= 1 ? ' disabled' : '') + '>&lt;</button>';
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 3 && i < totalPages - 2 && Math.abs(i - currentPage) > 1) {
      if (i === 4 || i === totalPages - 3) html += '<span style="padding:0 6px;color:#a8a29e">...</span>';
      continue;
    }
    html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" onclick="' + onPageChange + '(' + i + ')">' + i + '</button>';
  }
  html += '<button class="page-btn" onclick="' + onPageChange + '(' + (currentPage + 1) + ')"' + (currentPage >= totalPages ? ' disabled' : '') + '>&gt;</button>';
  html += '</div>';
  container.innerHTML = html;
}

// Auto login
(function tryAutoLogin() {
  const saved = localStorage.getItem('api_gw_key');
  if (saved) {
    authKey = saved;
    api('GET', '/admin/tokens').then(() => {
      document.getElementById('login-view').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      loadDashboard();
    }).catch(() => {
      localStorage.removeItem('api_gw_key');
    });
  }
})();

async function login() {
  authKey = document.getElementById('login-key').value.trim();
  if (!authKey) return toast('请输入 Gateway Key', false);
  try {
    await api('GET', '/admin/tokens');
    if (document.getElementById('remember-me').checked) {
      localStorage.setItem('api_gw_key', authKey);
    }
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    loadDashboard();
  } catch (e) { toast('密钥错误', false); }
}

function logout() {
  authKey = '';
  localStorage.removeItem('api_gw_key');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('login-key').value = '';
}

document.getElementById('login-key').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + item.dataset.page).classList.add('active');
    if (item.dataset.page === 'dashboard') loadDashboard();
    if (item.dataset.page === 'tokens') { tokenPage = 1; loadTokens(); }
  });
});

async function loadDashboard() {
  try {
    const data = await api('GET', '/admin/tokens');
    allTokens = data.tokens;
    renderStats(data.tokens, data.pool_status);
    recentPage = 1;
    renderRecent();
  } catch (e) { toast('加载失败：' + e.message, false); }
}

async function loadTokens() {
  try {
    const data = await api('GET', '/admin/tokens');
    allTokens = data.tokens;
    renderTokenList();
  } catch (e) { toast('加载失败：' + e.message, false); }
}

function renderStats(tokens, pool) {
  const enabled = tokens.filter(t => t.enabled).length;
  const disabled = tokens.length - enabled;
  const valid = tokens.filter(t => t.status === 'valid').length;
  document.getElementById('s-total').textContent = tokens.length;
  document.getElementById('s-available').textContent = pool.available;
  document.getElementById('s-disabled').textContent = disabled;
  document.getElementById('s-valid').textContent = valid;
}

function goRecentPage(p) {
  const sorted = allTokens.slice().sort((a, b) => b.addedAt - a.addedAt);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  recentPage = p;
  renderRecent();
}

function renderRecent() {
  const tbody = document.getElementById('recent-list');
  const empty = document.getElementById('recent-empty');
  const sorted = allTokens.slice().sort((a, b) => b.addedAt - a.addedAt);
  if (sorted.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); renderPagination('recent-pagination', 0, 1, 'goRecentPage'); return; }
  empty.classList.add('hidden');
  const start = (recentPage - 1) * PAGE_SIZE;
  const page = sorted.slice(start, start + PAGE_SIZE);
  tbody.innerHTML = page.map(t => {
    const st = t.enabled ? '<span class="badge badge-on">启用</span>' : '<span class="badge badge-off">禁用</span>';
    return \`<tr>
      <td class="token-mono">\${t.name || 'Unnamed'}</td>
      <td style="color:#a8a29e">\${new Date(t.addedAt).toLocaleDateString('zh-CN')}</td>
      <td>\${st}</td>
    </tr>\`;
  }).join('');
  renderPagination('recent-pagination', sorted.length, recentPage, 'goRecentPage');
}

function goTokenPage(p) {
  const totalPages = Math.ceil(allTokens.length / PAGE_SIZE);
  if (p < 1 || p > totalPages) return;
  tokenPage = p;
  renderTokenList();
}

function statusBadge(t) {
  if (t.status === 'valid') return '<span class="badge badge-valid">有效</span>';
  if (t.status === 'invalid') return '<span class="badge badge-invalid">失效</span>' + (t.disableReason ? '<div class="disable-reason">' + t.disableReason + '</div>' : '');
  return '<span class="badge badge-unchecked">未检测</span>';
}

function lastCheckedText(t) {
  if (!t.lastChecked) return '';
  return '<div style="font-size:0.7rem;color:#a8a29e;margin-top:2px">' + new Date(t.lastChecked).toLocaleString('zh-CN') + '</div>';
}

function renderTokenList() {
  const tbody = document.getElementById('token-list');
  const empty = document.getElementById('list-empty');
  if (allTokens.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); renderPagination('token-pagination', 0, 1, 'goTokenPage'); return; }
  empty.classList.add('hidden');
  const start = (tokenPage - 1) * PAGE_SIZE;
  const page = allTokens.slice(start, start + PAGE_SIZE);
  tbody.innerHTML = page.map(t => {
    const st = t.enabled ? '<span class="badge badge-on">启用</span>' : '<span class="badge badge-off">禁用</span>';
    const tBtn = t.enabled
      ? \`<button class="btn btn-outline btn-sm" onclick="toggleTk('\${t.token}',false)">禁用</button>\`
      : \`<button class="btn btn-success btn-sm" onclick="toggleTk('\${t.token}',true)">启用</button>\`;
    return \`<tr>
      <td class="token-mono">\${t.name || 'Unnamed'}</td>
      <td class="token-mono">\${mask(t.token)}</td>
      <td style="color:#a8a29e">\${new Date(t.addedAt).toLocaleDateString('zh-CN')}</td>
      <td>\${st}</td>
      <td>\${statusBadge(t)}\${lastCheckedText(t)}</td>
      <td><div class="actions-cell">
        <button class="btn btn-outline btn-sm" onclick="openEdit('\${t.token}','\${(t.name||'').replace(/'/g,"\\\\'")}')">编辑</button>
        <button class="btn btn-outline btn-sm" onclick="checkSingle('\${t.token}')">检测</button>
        \${tBtn}
        <button class="btn btn-danger btn-sm" onclick="removeTk('\${t.token}')">删除</button>
      </div></td>
    </tr>\`;
  }).join('');
  renderPagination('token-pagination', allTokens.length, tokenPage, 'goTokenPage');
}

async function addToken() {
  const name = document.getElementById('add-name').value.trim();
  const token = document.getElementById('add-token').value.trim();
  if (!token) return toast('请输入 Token', false);
  try {
    await api('POST', '/admin/tokens', { token, name: name || undefined });
    document.getElementById('add-name').value = '';
    document.getElementById('add-token').value = '';
    toast('添加成功');
    loadTokens();
  } catch (e) { toast(e.message, false); }
}

function toggleBulk() { document.getElementById('bulk-box').classList.toggle('hidden'); }

async function bulkAdd() {
  const raw = document.getElementById('bulk-tokens').value.trim();
  if (!raw) return toast('请输入 Token', false);
  const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);
  let ok = 0, fail = 0;
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    let name = '', token = '';
    if (parts.length >= 2) {
      name = parts[0]; token = parts[1];
    } else {
      token = parts[0];
    }
    if (!token) { fail++; continue; }
    try {
      await api('POST', '/admin/tokens', { token, name: name || undefined });
      ok++;
    } catch { fail++; }
  }
  document.getElementById('bulk-tokens').value = '';
  toast(\`导入完成：\${ok} 成功\${fail > 0 ? '，' + fail + ' 失败' : ''}\`);
  loadTokens();
}

// Edit modal
function openEdit(token, name) {
  document.getElementById('edit-token-id').value = token;
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit() {
  const token = document.getElementById('edit-token-id').value;
  const name = document.getElementById('edit-name').value.trim();
  try {
    await api('PATCH', '/admin/tokens', { token, name });
    toast('保存成功');
    closeEditModal();
    loadTokens();
  } catch (e) { toast(e.message, false); }
}

async function removeTk(token) {
  if (!confirm('确定删除？')) return;
  try { await api('DELETE', '/admin/tokens', { token }); toast('已删除'); loadTokens(); }
  catch (e) { toast(e.message, false); }
}

async function toggleTk(token, enabled) {
  try { await api('PATCH', '/admin/tokens', { token, enabled }); toast(enabled ? '已启用' : '已禁用'); loadTokens(); }
  catch (e) { toast(e.message, false); }
}

async function checkAllTokens() {
  const btn = document.getElementById('btn-check-all');
  const progress = document.getElementById('check-progress');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinning">&#9889;</span> 检测中...';
  progress.textContent = '正在发起对话测试，验证存活状态...';
  try {
    const data = await api('POST', '/admin/check-tokens');
    toast('检测完成: ' + data.valid + ' 有效, ' + data.invalid + ' 失效');
    progress.textContent = '上次检测: ' + new Date().toLocaleString('zh-CN');
    loadTokens();
  } catch (e) {
    toast('检测失败: ' + e.message, false);
    progress.textContent = '';
  }
  btn.disabled = false;
  btn.innerHTML = '&#9889; 一键检测所有状态';
}

async function checkSingle(token) {
  toast('正在测试...');
  try {
    const data = await api('POST', '/admin/check-token', { token });
    const msg = data.valid ? '有效' : '失效';
    toast('检测结果: ' + msg, data.valid);
    loadTokens();
  } catch (e) {
    toast('检测失败: ' + e.message, false);
  }
}
</script>
</body>
</html>`;
}