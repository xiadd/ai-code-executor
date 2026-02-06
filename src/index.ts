import { getSandbox, type Sandbox } from "@cloudflare/sandbox";

export { Sandbox } from "@cloudflare/sandbox";

type Env = {
  Sandbox: DurableObjectNamespace<Sandbox>;
  CODE_BUCKET: R2Bucket;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_ALLOWED_ORG?: string;
  GITHUB_ALLOWED_TEAM?: string;
  R2_BUCKET_NAME?: string;
  R2_S3_ENDPOINT?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
};

const LOGIN_HTML = (reason = "", nextPath = "/") => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Sandbox IDE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      background: radial-gradient(circle at top left, #2b2f48, #11131a 52%, #090a0f);
      color: #e9edf5;
      font-family: "SF Pro Display", "Segoe UI", sans-serif;
    }
    .page {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      width: 420px;
      max-width: 100%;
      background: rgba(26, 29, 42, 0.82);
      border: 1px solid rgba(122, 141, 199, 0.25);
      border-radius: 14px;
      padding: 22px;
      box-shadow: 0 18px 40px rgba(4, 6, 13, 0.45);
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #f5f7ff;
    }
    .desc {
      font-size: 13px;
      line-height: 1.6;
      color: #c6d0e9;
      margin-bottom: 14px;
    }
    .error {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px;
      color: #ffd8d8;
      background: rgba(176, 56, 56, 0.35);
      border: 1px solid rgba(210, 84, 84, 0.6);
    }
    .btn {
      width: 100%;
      height: 40px;
      border: 1px solid #5f709f;
      border-radius: 8px;
      background: #223666;
      color: #f4f7ff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn:hover { background: #2a3f78; }
    .foot {
      margin-top: 10px;
      font-size: 11px;
      color: #99a6c7;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="title">GitHub 登录</div>
      <div class="desc">只有指定 GitHub 组织成员可访问此 Sandbox IDE。</div>
      ${reason ? `<div class="error">${escapeHtmlText(reason)}</div>` : ""}
      <button class="btn" onclick="location.href='/auth/login?next=${encodeURIComponent(
        nextPath,
      )}'">使用 GitHub 登录</button>
      <div class="foot">登录成功后自动跳转到 IDE 页面。</div>
    </div>
  </div>
</body>
</html>`;

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sandbox IDE</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      font-family: "SF Pro Display", "Segoe UI", sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      overflow: hidden;
    }
    .app {
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      height: 46px;
      padding: 0 12px;
      border-bottom: 1px solid #2a2a2a;
      background: #252526;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
    }
    .header h1 {
      font-size: 13px;
      font-weight: 600;
      color: #f3f3f3;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    button {
      border: 1px solid #3d3d3d;
      background: #313131;
      color: #e9e9e9;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1;
      padding: 7px 10px;
      cursor: pointer;
    }
    button:hover { background: #3a3a3a; }
    button.primary { background: #0e639c; border-color: #1177bb; }
    button.primary:hover { background: #1177bb; }
    button.success { background: #1f7a34; border-color: #2c8f43; }
    button.success:hover { background: #2c8f43; }
    button.warning { background: #8b5f00; border-color: #9f7000; }
    button.warning:hover { background: #9f7000; }

    .main {
      flex: 1;
      display: flex;
      min-height: 0;
    }

    .sidebar {
      width: 280px;
      min-width: 220px;
      max-width: 380px;
      border-right: 1px solid #2a2a2a;
      background: #1b1b1c;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .panel-header {
      height: 34px;
      border-bottom: 1px solid #2a2a2a;
      background: #252526;
      color: #bdbdbd;
      font-size: 11px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      flex-shrink: 0;
      gap: 8px;
    }

    .path-label {
      font-size: 11px;
      color: #9f9f9f;
      padding: 8px 10px;
      border-bottom: 1px solid #252526;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }

    .file-tree {
      flex: 1;
      overflow: auto;
      padding: 8px;
      min-height: 0;
    }

    .file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border-radius: 4px;
      padding: 6px 8px;
      cursor: pointer;
      font-size: 13px;
      color: #d4d4d4;
    }
    .file-item:hover { background: #2a2d2e; }
    .file-item .icon { width: 18px; text-align: center; }
    .file-item .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-item .actions {
      opacity: 0;
      pointer-events: none;
      display: flex;
      gap: 4px;
      transition: opacity 0.12s ease;
    }
    .file-item:hover .actions {
      opacity: 1;
      pointer-events: auto;
    }
    .file-item .actions button {
      padding: 3px 6px;
      font-size: 10px;
    }

    .workspace {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .editor-panel {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid #2a2a2a;
    }

    .editor-tabs {
      min-height: 34px;
      max-height: 34px;
      overflow-x: auto;
      display: flex;
      background: #2d2d30;
      border-bottom: 1px solid #1f1f1f;
      flex-shrink: 0;
    }

    .tab {
      display: flex;
      align-items: center;
      gap: 8px;
      border-right: 1px solid #1f1f1f;
      padding: 0 12px;
      font-size: 12px;
      color: #cccccc;
      cursor: pointer;
      white-space: nowrap;
    }
    .tab:hover { background: #36363a; }
    .tab.active {
      background: #1e1e1e;
      color: #ffffff;
      border-top: 2px solid #0e639c;
    }
    .tab .close {
      font-size: 13px;
      opacity: 0.6;
      cursor: pointer;
    }
    .tab .close:hover { opacity: 1; }
    .tab.new-tab {
      border-right: none;
      min-width: 34px;
      justify-content: center;
      font-size: 16px;
      padding: 0;
    }

    .editor-content {
      flex: 1;
      min-height: 0;
      display: flex;
    }

    textarea {
      width: 100%;
      height: 100%;
      border: none;
      resize: none;
      outline: none;
      background: #1e1e1e;
      color: #d4d4d4;
      font-size: 14px;
      line-height: 1.6;
      font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
      padding: 14px;
      tab-size: 2;
    }

    .terminal-panel {
      height: 38%;
      min-height: 220px;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      background: #111;
    }

    .terminal-header {
      height: 34px;
      border-bottom: 1px solid #252525;
      background: #1a1a1b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      font-size: 12px;
      color: #b8b8b8;
      flex-shrink: 0;
    }

    .terminal-container {
      flex: 1;
      min-height: 0;
      padding: 6px;
    }

    #terminal {
      width: 100%;
      height: 100%;
    }

    .empty-state, .no-editor {
      margin: auto;
      color: #7c7c7c;
      font-size: 13px;
      text-align: center;
      padding: 24px;
    }

    .status-bar {
      height: 24px;
      background: #0e639c;
      color: #fff;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      flex-shrink: 0;
      gap: 12px;
    }
    .status-bar.error { background: #b93030; }
    .status-bar.success { background: #1f7a34; }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.64);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.active { display: flex; }

    .modal {
      width: 420px;
      max-width: calc(100vw - 24px);
      background: #232325;
      border: 1px solid #3b3b3b;
      border-radius: 8px;
      padding: 16px;
    }
    .modal h3 {
      font-size: 14px;
      margin-bottom: 12px;
      color: #f2f2f2;
    }
    .modal input {
      width: 100%;
      height: 36px;
      border-radius: 6px;
      border: 1px solid #4a4a4a;
      background: #1a1a1b;
      color: #f0f0f0;
      padding: 0 10px;
      margin-bottom: 12px;
      outline: none;
    }
    .modal input:focus { border-color: #0e639c; }
    .modal .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    @media (max-width: 920px) {
      .header {
        height: auto;
        padding: 8px;
        align-items: flex-start;
        flex-direction: column;
      }
      .toolbar { width: 100%; justify-content: flex-start; }
      .sidebar { width: 220px; }
      .terminal-panel { height: 42%; }
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="header">
      <h1>Sandbox IDE (R2 Persistent Files)</h1>
      <div class="toolbar">
        <button onclick="startSandbox()" class="primary">启动 Sandbox</button>
        <button onclick="stopSandbox()" class="warning">关闭 Sandbox</button>
        <button onclick="reconnectTerminal()">重连终端</button>
        <button onclick="runCurrentFile()" class="success">运行当前文件</button>
        <button onclick="saveCurrentFile()">保存</button>
        <button onclick="refreshFiles()">刷新文件</button>
        <button onclick="clearTerminal()">清屏</button>
        <button onclick="logout()">退出登录</button>
      </div>
    </div>

    <div class="main">
      <aside class="sidebar">
        <div class="panel-header">
          <span>文件资源管理器</span>
          <div class="toolbar">
            <button onclick="showNewFileModal()" style="padding:4px 8px;">+ 文件</button>
            <button onclick="showNewFolderModal()" style="padding:4px 8px;">+ 文件夹</button>
          </div>
        </div>
        <div class="path-label" id="currentPathLabel">/</div>
        <div class="file-tree" id="fileTree">
          <div class="empty-state">加载中...</div>
        </div>
      </aside>

      <section class="workspace">
        <section class="editor-panel">
          <div class="editor-tabs" id="editorTabs">
            <div class="tab new-tab" onclick="showNewFileModal()">+</div>
          </div>
          <div class="editor-content" id="editorContent">
            <div class="no-editor">从左侧选择或创建文件</div>
          </div>
        </section>

        <section class="terminal-panel">
          <div class="terminal-header">
            <span>终端</span>
            <span id="termStatus">● 未启动</span>
          </div>
          <div class="terminal-container">
            <div id="terminal"></div>
          </div>
        </section>
      </section>
    </div>

    <div class="status-bar" id="statusBar">
      <span id="statusText">就绪</span>
      <span id="sessionDisplay"></span>
    </div>
  </div>

  <div class="modal-overlay" id="newFileModal">
    <div class="modal">
      <h3>新建文件</h3>
      <input type="text" id="newFileName" placeholder="例如: main.py" />
      <div class="buttons">
        <button onclick="hideModal('newFileModal')">取消</button>
        <button class="primary" onclick="createNewFile()">创建</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="newFolderModal">
    <div class="modal">
      <h3>新建文件夹</h3>
      <input type="text" id="newFolderName" placeholder="例如: src" />
      <div class="buttons">
        <button onclick="hideModal('newFolderModal')">取消</button>
        <button class="primary" onclick="createNewFolder()">创建</button>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>

  <script>
    const savedSession = localStorage.getItem('sandbox-ide-session-id');
    const sessionId = savedSession || ('ide-' + Math.random().toString(36).slice(2, 10));
    if (!savedSession) {
      localStorage.setItem('sandbox-ide-session-id', sessionId);
    }

    const ROOT_PATH = '/';

    let ws = null;
    let connected = false;
    let sandboxRunning = false;
    let manualDisconnect = false;
    let currentPath = ROOT_PATH;

    let openFiles = new Map();
    let activeFile = null;
    let fileTreeData = [];

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      theme: {
        background: '#0c0c0c',
        foreground: '#d5d5d5',
        cursor: '#d5d5d5',
        selectionBackground: '#264f78'
      },
      scrollback: 10000,
      allowProposedApi: true,
      cursorStyle: 'block'
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    function updateStatus(text, type) {
      document.getElementById('statusText').textContent = text;
      document.getElementById('statusBar').className = 'status-bar ' + (type || '');
    }

    function updateTermStatus(text, isConnected) {
      const el = document.getElementById('termStatus');
      el.textContent = '● ' + text;
      el.style.color = isConnected ? '#4caf50' : '#d86161';
    }

    function requireSandbox(actionName) {
      if (sandboxRunning) return true;
      updateStatus((actionName || '操作') + '失败：请先启动 Sandbox', 'error');
      return false;
    }

    function updateCurrentPathLabel() {
      document.getElementById('currentPathLabel').textContent = currentPath;
    }

    function normalizeClientPath(input, fallback) {
      var raw = (input || fallback || ROOT_PATH).trim();
      if (!raw) raw = ROOT_PATH;
      raw = raw.replace(/\\\\/g, '/');
      if (raw[0] !== '/') raw = '/' + raw;
      var parts = raw.split('/');
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p || p === '.') continue;
        if (p === '..') {
          out.pop();
          continue;
        }
        out.push(p);
      }
      return out.length ? '/' + out.join('/') : '/';
    }

    function joinPath(base, name) {
      if (base === '/') return '/' + name;
      return base + '/' + name;
    }

    function getParentPath(path) {
      if (!path || path === '/') return '/';
      var parts = path.split('/').filter(Boolean);
      parts.pop();
      return parts.length ? '/' + parts.join('/') : '/';
    }

    function toWorkspacePath(path) {
      var clean = normalizeClientPath(path, '/');
      return clean === '/' ? '/workspace' : '/workspace' + clean;
    }

    function connect() {
      if (!sandboxRunning) {
        updateTermStatus('未启动', false);
        return;
      }

      if (ws) {
        ws.close();
        ws = null;
      }

      updateTermStatus('连接中...', false);

      var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      var wsUrl = protocol + '//' + location.host + '/ws?session=' + encodeURIComponent(sessionId);

      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = function () {
        connected = true;
        updateTermStatus('已连接', true);
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      };

      ws.onmessage = function (event) {
        var text = typeof event.data === 'string'
          ? event.data
          : new TextDecoder().decode(event.data);
        term.write(text);
      };

      ws.onclose = function () {
        connected = false;
        ws = null;
        updateTermStatus(sandboxRunning ? '离线' : '未启动', false);
        if (!manualDisconnect) {
          term.writeln('\r\n\x1b[31m[终端连接已断开]\x1b[0m');
        }
        manualDisconnect = false;
      };

      ws.onerror = function () {
        connected = false;
        updateTermStatus('错误', false);
      };
    }

    function disconnectTerminal() {
      if (ws) {
        manualDisconnect = true;
        ws.close();
        ws = null;
      } else {
        manualDisconnect = false;
      }
      connected = false;
      updateTermStatus(sandboxRunning ? '离线' : '未启动', false);
    }

    async function checkSandboxStatus() {
      try {
        var res = await fetch('/api/sandbox/status?session=' + encodeURIComponent(sessionId));
        var data = await res.json();
        sandboxRunning = !!data.running;

        if (sandboxRunning) {
          updateStatus('Sandbox 已运行', 'success');
          connect();
        } else {
          disconnectTerminal();
          updateStatus('Sandbox 未启动');
        }
      } catch (_err) {
        sandboxRunning = false;
        disconnectTerminal();
        updateStatus('Sandbox 状态检查失败', 'error');
      }
    }

    async function startSandbox() {
      if (sandboxRunning) {
        updateStatus('Sandbox 已在运行');
        if (!connected) connect();
        return;
      }

      updateStatus('正在启动 Sandbox...');

      try {
        var res = await fetch('/api/sandbox/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId })
        });
        var data = await res.json();

        if (!data.success) {
          updateStatus('启动失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        sandboxRunning = true;
        connect();

        if (data.mounted) {
          updateStatus('Sandbox 已启动（已挂载 R2）', 'success');
        } else {
          var detail = data.mountMessage ? ('，' + data.mountMessage) : '';
          updateStatus('Sandbox 已启动（未挂载 R2' + detail + '）', 'success');
        }
      } catch (_err) {
        updateStatus('启动 Sandbox 失败', 'error');
      }
    }

    async function stopSandbox() {
      if (!sandboxRunning) {
        updateStatus('Sandbox 当前未运行');
        return;
      }

      if (!confirm('确定要关闭 Sandbox 吗？这会终止当前运行中的进程。')) {
        return;
      }

      updateStatus('正在关闭 Sandbox...');

      try {
        var res = await fetch('/api/sandbox/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId })
        });
        var data = await res.json();

        if (!data.success) {
          updateStatus('关闭失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        sandboxRunning = false;
        disconnectTerminal();
        updateStatus('Sandbox 已关闭', 'success');
      } catch (_err) {
        updateStatus('关闭 Sandbox 失败', 'error');
      }
    }

    function reconnectTerminal() {
      if (!requireSandbox('重连终端')) return;
      disconnectTerminal();
      connect();
    }

    term.onData(function (data) {
      if (connected && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data: data }));
      }
    });

    window.addEventListener('resize', function () {
      fitAddon.fit();
      if (connected && ws) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });

    async function refreshFiles() {
      updateCurrentPathLabel();
      try {
        var res = await fetch('/api/files?session=' + encodeURIComponent(sessionId) + '&path=' + encodeURIComponent(currentPath));
        var data = await res.json();

        if (!data.success) {
          updateStatus('加载文件失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        fileTreeData = data.files || [];
        renderFileTree();
      } catch (_err) {
        updateStatus('加载文件失败', 'error');
      }
    }

    function renderFileTree() {
      var container = document.getElementById('fileTree');
      var html = '';

      if (currentPath !== '/') {
        var upPath = encodeURIComponent(getParentPath(currentPath));
        html += '<div class="file-item" onclick="openFolderFromEncoded(\'' + upPath + '\')">'
          + '<span class="icon">↩</span><span class="name">..</span></div>';
      }

      if (!fileTreeData.length) {
        html += '<div class="empty-state">当前目录为空</div>';
        container.innerHTML = html;
        return;
      }

      for (var i = 0; i < fileTreeData.length; i++) {
        var file = fileTreeData[i];
        var encodedPath = encodeURIComponent(file.path);
        var isDir = file.type === 'directory';
        var icon = isDir ? '📁' : getFileIcon(file.name);
        var openFn = isDir ? 'openFolderFromEncoded' : 'openFileFromEncoded';

        html += '<div class="file-item" onclick="' + openFn + '(\'' + encodedPath + '\')">'
          + '<span class="icon">' + icon + '</span>'
          + '<span class="name">' + escapeHtml(file.name) + '</span>'
          + '<div class="actions" onclick="event.stopPropagation()">'
          + '<button onclick="deleteFileFromEncoded(\'' + encodedPath + '\')">删除</button>'
          + '</div>'
          + '</div>';
      }

      container.innerHTML = html;
    }

    function getFileIcon(filename) {
      if (filename.endsWith('.py')) return '🐍';
      if (filename.endsWith('.js')) return '📜';
      if (filename.endsWith('.ts')) return '🔷';
      if (filename.endsWith('.json')) return '🧩';
      if (filename.endsWith('.md')) return '📝';
      if (filename.endsWith('.html')) return '🌐';
      if (filename.endsWith('.css')) return '🎨';
      if (filename.endsWith('.sh')) return '⚡';
      return '📄';
    }

    function openFileFromEncoded(encoded) {
      openFile(decodeURIComponent(encoded));
    }

    function openFolderFromEncoded(encoded) {
      openFolder(decodeURIComponent(encoded));
    }

    function deleteFileFromEncoded(encoded) {
      deleteFile(decodeURIComponent(encoded));
    }

    async function openFile(path) {
      try {
        var res = await fetch('/api/read?session=' + encodeURIComponent(sessionId) + '&path=' + encodeURIComponent(path));
        var data = await res.json();

        if (!data.success) {
          updateStatus('读取文件失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        openFiles.set(path, { content: data.content, modified: false });
        activeFile = path;
        renderTabs();
        renderEditor();
      } catch (_err) {
        updateStatus('读取文件失败', 'error');
      }
    }

    function openFolder(path) {
      currentPath = normalizeClientPath(path, '/');
      refreshFiles();
    }

    async function saveCurrentFile() {
      if (!activeFile) return;

      var textarea = document.getElementById('editorTextarea');
      if (!textarea) return;

      var content = textarea.value;

      try {
        var res = await fetch('/api/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            path: activeFile,
            content: content
          })
        });

        var data = await res.json();
        if (!data.success) {
          updateStatus('保存失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        openFiles.get(activeFile).content = content;
        openFiles.get(activeFile).modified = false;
        renderTabs();
        updateStatus('文件已保存', 'success');
        await refreshFiles();
      } catch (_err) {
        updateStatus('保存失败', 'error');
      }
    }

    async function runCurrentFile() {
      if (!requireSandbox('运行文件')) return;
      if (!activeFile) {
        updateStatus('请先打开一个文件', 'error');
        return;
      }

      await saveCurrentFile();

      var command = getRunCommand(activeFile);
      if (!command) {
        updateStatus('当前文件类型暂不支持一键运行', 'error');
        return;
      }

      if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
        updateStatus('终端未连接，正在重连...', 'error');
        reconnectTerminal();
        return;
      }

      term.writeln('\r\n\x1b[36m$ ' + command + '\x1b[0m\r\n');
      ws.send(JSON.stringify({ type: 'input', data: command + '\r' }));
    }

    function getRunCommand(path) {
      var workspacePath = toWorkspacePath(path);
      if (path.endsWith('.py')) return 'python3 "' + workspacePath + '"';
      if (path.endsWith('.js')) return 'node "' + workspacePath + '"';
      if (path.endsWith('.ts')) return 'npx tsx "' + workspacePath + '"';
      if (path.endsWith('.sh')) return 'bash "' + workspacePath + '"';
      return null;
    }

    function renderTabs() {
      var tabsContainer = document.getElementById('editorTabs');
      var html = '';

      openFiles.forEach(function (file, path) {
        var filename = path.split('/').pop();
        var encodedPath = encodeURIComponent(path);
        var isActive = path === activeFile;
        var modified = file.modified ? ' ●' : '';

        html += '<div class="tab ' + (isActive ? 'active' : '') + '" onclick="switchTabFromEncoded(\'' + encodedPath + '\')">'
          + '<span>' + escapeHtml(filename + modified) + '</span>'
          + '<span class="close" onclick="closeTabFromEncoded(\'' + encodedPath + '\', event)">×</span>'
          + '</div>';
      });

      html += '<div class="tab new-tab" onclick="showNewFileModal()">+</div>';
      tabsContainer.innerHTML = html;
    }

    function switchTabFromEncoded(encoded) {
      switchTab(decodeURIComponent(encoded));
    }

    function closeTabFromEncoded(encoded, event) {
      closeTab(decodeURIComponent(encoded), event);
    }

    function renderEditor() {
      var container = document.getElementById('editorContent');
      if (!activeFile) {
        container.innerHTML = '<div class="no-editor">从左侧选择或创建文件</div>';
        return;
      }

      var file = openFiles.get(activeFile);
      container.innerHTML = '<textarea id="editorTextarea" spellcheck="false">' + escapeHtml(file.content) + '</textarea>';

      var textarea = document.getElementById('editorTextarea');
      textarea.focus();

      textarea.addEventListener('input', function () {
        var opened = openFiles.get(activeFile);
        if (opened) {
          opened.modified = true;
          renderTabs();
        }
      });

      textarea.addEventListener('keydown', function (event) {
        if (event.key === 'Tab') {
          event.preventDefault();
          var start = textarea.selectionStart;
          var end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          saveCurrentFile();
        }
      });
    }

    function switchTab(path) {
      activeFile = path;
      renderTabs();
      renderEditor();
    }

    function closeTab(path, event) {
      event.stopPropagation();
      openFiles.delete(path);
      if (activeFile === path) {
        var next = openFiles.keys().next();
        activeFile = next.done ? null : next.value;
      }
      renderTabs();
      renderEditor();
    }

    function showNewFileModal() {
      document.getElementById('newFileModal').classList.add('active');
      var input = document.getElementById('newFileName');
      input.value = '';
      input.focus();
    }

    function showNewFolderModal() {
      document.getElementById('newFolderModal').classList.add('active');
      var input = document.getElementById('newFolderName');
      input.value = '';
      input.focus();
    }

    function hideModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    async function createNewFile() {
      var name = (document.getElementById('newFileName').value || '').trim();
      if (!name) return;

      var path = joinPath(currentPath, name);

      try {
        var res = await fetch('/api/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, path: path, content: '' })
        });

        var data = await res.json();
        if (!data.success) {
          updateStatus('创建文件失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        hideModal('newFileModal');
        await refreshFiles();
        await openFile(path);
        updateStatus('文件已创建', 'success');
      } catch (_err) {
        updateStatus('创建文件失败', 'error');
      }
    }

    async function createNewFolder() {
      var name = (document.getElementById('newFolderName').value || '').trim();
      if (!name) return;

      var path = joinPath(currentPath, name);

      try {
        var res = await fetch('/api/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, path: path })
        });

        var data = await res.json();
        if (!data.success) {
          updateStatus('创建文件夹失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        hideModal('newFolderModal');
        await refreshFiles();
        updateStatus('文件夹已创建', 'success');
      } catch (_err) {
        updateStatus('创建文件夹失败', 'error');
      }
    }

    async function deleteFile(path) {
      var filename = path.split('/').pop() || path;
      if (!confirm('确定删除 ' + filename + ' 吗？')) return;

      try {
        var res = await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionId, path: path })
        });

        var data = await res.json();
        if (!data.success) {
          updateStatus('删除失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        if (openFiles.has(path)) {
          openFiles.delete(path);
          if (activeFile === path) {
            var next = openFiles.keys().next();
            activeFile = next.done ? null : next.value;
          }
          renderTabs();
          renderEditor();
        }

        await refreshFiles();
        updateStatus('删除成功', 'success');
      } catch (_err) {
        updateStatus('删除失败', 'error');
      }
    }

    function clearTerminal() {
      term.clear();
    }

    function logout() {
      location.href = '/auth/logout';
    }

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text == null ? '' : String(text);
      return div.innerHTML;
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        hideModal('newFileModal');
        hideModal('newFolderModal');
      }
    });

    document.getElementById('sessionDisplay').textContent = sessionId;
    updateTermStatus('未启动', false);
    updateCurrentPathLabel();
    checkSandboxStatus();
    refreshFiles();
  </script>
</body>
</html>`;

const WORKSPACE_ROOT = "/workspace";
const VFS_ROOT = "/";
const SESSION_OBJECT_ROOT = "sessions";

const AUTH_SESSION_COOKIE = "sandbox_auth_session";
const OAUTH_STATE_COOKIE = "sandbox_oauth_state";
const OAUTH_NEXT_COOKIE = "sandbox_oauth_next";
const AUTH_SESSION_PREFIX = "auth/sessions";
const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

type AuthUser = {
  id: number;
  login: string;
  name: string;
  avatar: string;
  email: string | null;
  org: string;
  team?: string;
};

type AuthSession = {
  sessionId: string;
  expiresAt: number;
  user: AuthUser;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const activeSandboxSessions = new Set<string>();
const mountedSandboxSessions = new Set<string>();

const resolveSessionId = (
  raw: string | null | undefined,
  fallback = "default",
): string => (raw && raw.trim() ? raw.trim() : fallback);

const normalizeVirtualPath = (
  rawPath: string | null | undefined,
  fallback = VFS_ROOT,
): string => {
  const input = rawPath && rawPath.trim() ? rawPath.trim() : fallback;
  const raw = input.replace(/\\/g, "/");
  const absolute = raw.startsWith("/") ? raw : `/${raw}`;

  const segments: string[] = [];
  for (const part of absolute.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      segments.pop();
      continue;
    }
    segments.push(part);
  }

  return segments.length ? `/${segments.join("/")}` : VFS_ROOT;
};

const toRelativePath = (path: string): string =>
  path === VFS_ROOT ? "" : path.replace(/^\//, "");

const getSessionPrefix = (sessionId: string): string =>
  `${SESSION_OBJECT_ROOT}/${sessionId}`;

const getDirectoryPrefix = (sessionId: string, directoryPath: string): string => {
  const relativePath = toRelativePath(directoryPath);
  const sessionPrefix = getSessionPrefix(sessionId);
  return relativePath ? `${sessionPrefix}/${relativePath}/` : `${sessionPrefix}/`;
};

const buildFileKey = (sessionId: string, filePath: string): string => {
  const relativePath = toRelativePath(filePath);
  if (!relativePath) {
    throw new Error("Path points to root directory");
  }
  return `${getSessionPrefix(sessionId)}/${relativePath}`;
};

const decodeObjectPath = (
  sessionId: string,
  key: string,
): { name: string; path: string } | null => {
  const sessionPrefix = `${getSessionPrefix(sessionId)}/`;
  if (!key.startsWith(sessionPrefix)) return null;

  const relativePath = key.slice(sessionPrefix.length);
  if (!relativePath || relativePath === ".keep") return null;

  const slashIndex = relativePath.lastIndexOf("/");
  const name = slashIndex >= 0 ? relativePath.slice(slashIndex + 1) : relativePath;
  const path = `/${relativePath}`;

  return { name, path };
};

const getMountConfig = (env: Env):
  | { bucketName: string; endpoint: string }
  | null => {
  const bucketName = (env.R2_BUCKET_NAME || "").trim();
  const endpoint =
    (env.R2_S3_ENDPOINT || "").trim() ||
    ((env.R2_ACCOUNT_ID || "").trim()
      ? `https://${(env.R2_ACCOUNT_ID || "").trim()}.r2.cloudflarestorage.com`
      : "");

  if (!bucketName || !endpoint) {
    return null;
  }

  return { bucketName, endpoint };
};

const ensureBucketMounted = async (
  sandbox: Sandbox,
  env: Env,
  sessionId: string,
): Promise<{ mounted: boolean; message?: string }> => {
  if (mountedSandboxSessions.has(sessionId)) {
    return { mounted: true };
  }

  const mountConfig = getMountConfig(env);
  if (!mountConfig) {
    return {
      mounted: false,
      message: "缺少 R2 挂载配置（R2_BUCKET_NAME / R2_S3_ENDPOINT）",
    };
  }

  const options: {
    endpoint: string;
    provider: "r2";
    prefix: string;
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  } = {
    endpoint: mountConfig.endpoint,
    provider: "r2",
    prefix: `/${getSessionPrefix(sessionId)}`,
  };

  if (env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
    options.credentials = {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    };
  }

  try {
    await sandbox.mountBucket(mountConfig.bucketName, WORKSPACE_ROOT, options);
    mountedSandboxSessions.add(sessionId);
    return { mounted: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lowercase = message.toLowerCase();

    if (lowercase.includes("already mounted")) {
      mountedSandboxSessions.add(sessionId);
      return { mounted: true };
    }

    if (
      lowercase.includes("wrangler dev") ||
      lowercase.includes("fuse") ||
      lowercase.includes("operation not permitted")
    ) {
      return {
        mounted: false,
        message: "本地 wrangler dev 不支持 bucket mount（生产部署可用）",
      };
    }

    throw error;
  }
};

const ensureTerminalServer = async (sandbox: Sandbox) => {
  let terminalRunning = false;

  try {
    const process = await sandbox.getProcess("pty-server");
    if (process) {
      terminalRunning = (await process.getStatus()) === "running";
    }
  } catch {
    terminalRunning = false;
  }

  if (terminalRunning) return;

  await sandbox.startProcess("python3 /workspace/terminal-server.py", {
    processId: "pty-server",
    cwd: WORKSPACE_ROOT,
  });
  await sleep(1200);
};

const ensureSandboxRuntime = async (
  sandbox: Sandbox,
  env: Env,
  sessionId: string,
): Promise<{ mounted: boolean; mountMessage?: string }> => {
  const mountResult = await ensureBucketMounted(sandbox, env, sessionId);
  await ensureTerminalServer(sandbox);

  return {
    mounted: mountResult.mounted,
    mountMessage: mountResult.message,
  };
};

const listAllKeysWithPrefix = async (
  bucket: R2Bucket,
  prefix: string,
): Promise<string[]> => {
  const keys: string[] = [];
  let cursor: string | undefined;

  do {
    const listed = await bucket.list({ prefix, cursor });
    keys.push(...listed.objects.map((obj) => obj.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return keys;
};

const parseCookies = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  for (const chunk of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    if (!rawKey) continue;
    const raw = rawValue.join("=") || "";
    try {
      cookies[rawKey] = decodeURIComponent(raw);
    } catch {
      cookies[rawKey] = raw;
    }
  }
  return cookies;
};

const buildSetCookie = (
  name: string,
  value: string,
  options: {
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    path?: string;
  } = {},
): string => {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (typeof options.maxAge === "number") parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
};

const sanitizeNextPath = (raw: string | null | undefined): string => {
  const fallback = "/";
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
};

const escapeHtmlText = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createRandomToken = () =>
  crypto.randomUUID().replace(/-/g, "") + crypto.getRandomValues(new Uint32Array(1))[0];

const createUnauthorizedApiResponse = (clearCookie: string | null = null) => {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  if (clearCookie) headers.append("Set-Cookie", clearCookie);
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized" }),
    { status: 401, headers },
  );
};

const createUnauthorizedWebSocketResponse = (clearCookie: string | null = null) => {
  const headers = new Headers();
  if (clearCookie) headers.append("Set-Cookie", clearCookie);
  return new Response("Unauthorized", { status: 401, headers });
};

const createUnauthorizedPageRedirect = (
  url: URL,
  clearCookie: string | null = null,
) => {
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set(
    "next",
    sanitizeNextPath(`${url.pathname}${url.search}`),
  );
  const headers = new Headers({ Location: loginUrl.toString() });
  if (clearCookie) headers.append("Set-Cookie", clearCookie);
  return new Response(null, { status: 302, headers });
};

const getAuthSessionKey = (sessionId: string) =>
  `${AUTH_SESSION_PREFIX}/${sessionId}.json`;

const loadAuthSession = async (
  env: Env,
  authSessionId: string,
): Promise<AuthSession | null> => {
  const object = await env.CODE_BUCKET.get(getAuthSessionKey(authSessionId));
  if (!object) return null;

  try {
    const raw = await object.text();
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      await env.CODE_BUCKET.delete(getAuthSessionKey(authSessionId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveAuthSession = async (env: Env, session: AuthSession): Promise<void> => {
  await env.CODE_BUCKET.put(getAuthSessionKey(session.sessionId), JSON.stringify(session));
};

const deleteAuthSession = async (
  env: Env,
  authSessionId: string,
): Promise<void> => {
  await env.CODE_BUCKET.delete(getAuthSessionKey(authSessionId));
};

const exchangeGithubCodeForToken = async (
  env: Env,
  code: string,
  redirectUri: string,
) => {
  const clientId = (env.GITHUB_CLIENT_ID || "").trim();
  const clientSecret = (env.GITHUB_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("Missing GitHub OAuth credentials");
  }

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: payload.toString(),
  });

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error || "Failed to fetch GitHub access token");
  }

  return tokenData.access_token;
};

const getGithubUser = async (accessToken: string) => {
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "cloudflare-sandbox-ide",
    },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch GitHub user");
  }

  return (await userResponse.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string | null;
    email?: string | null;
  };
};

const ensureGithubOrgMembership = async (
  accessToken: string,
  allowedOrg: string,
) => {
  const membershipResponse = await fetch(
    `https://api.github.com/user/memberships/orgs/${allowedOrg}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-sandbox-ide",
      },
    },
  );

  if (membershipResponse.status === 404) return false;
  if (!membershipResponse.ok) {
    throw new Error("Failed to validate organization membership");
  }

  const membership = (await membershipResponse.json()) as { state?: string };
  return membership.state === "active";
};

const ensureGithubTeamMembership = async (
  accessToken: string,
  allowedOrg: string,
  allowedTeam: string,
  userLogin: string,
) => {
  const teamsResponse = await fetch(
    `https://api.github.com/orgs/${allowedOrg}/teams?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-sandbox-ide",
      },
    },
  );

  if (!teamsResponse.ok) {
    throw new Error("Failed to fetch organization teams");
  }

  const teams = (await teamsResponse.json()) as Array<{
    id: number;
    name: string;
    slug: string;
  }>;

  const targetTeam = teams.find(
    (team) => team.name === allowedTeam || team.slug === allowedTeam,
  );

  if (!targetTeam) {
    throw new Error("Configured team was not found");
  }

  const memberResponse = await fetch(
    `https://api.github.com/teams/${targetTeam.id}/memberships/${userLogin}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-sandbox-ide",
      },
    },
  );

  if (memberResponse.status === 404) return false;
  if (!memberResponse.ok) {
    throw new Error("Failed to validate team membership");
  }

  const membership = (await memberResponse.json()) as { state?: string };
  return membership.state === "active";
};

const assertAuthenticated = async (
  request: Request,
  url: URL,
  env: Env,
): Promise<{ session: AuthSession | null; response: Response | null }> => {
  const publicPaths = new Set([
    "/login",
    "/auth/login",
    "/auth/callback",
    "/auth/logout",
  ]);
  if (publicPaths.has(url.pathname)) {
    return { session: null, response: null };
  }

  const cookies = parseCookies(request.headers.get("Cookie"));
  const authSessionId = cookies[AUTH_SESSION_COOKIE];
  const secureCookie = url.protocol === "https:";
  const clearAuthCookie = buildSetCookie(AUTH_SESSION_COOKIE, "", {
    maxAge: 0,
    sameSite: "Lax",
    secure: secureCookie,
  });

  if (!authSessionId) {
    if (url.pathname === "/ws") {
      return {
        session: null,
        response: createUnauthorizedWebSocketResponse(),
      };
    }
    if (url.pathname.startsWith("/api/")) {
      return {
        session: null,
        response: createUnauthorizedApiResponse(),
      };
    }
    return {
      session: null,
      response: createUnauthorizedPageRedirect(url),
    };
  }

  const session = await loadAuthSession(env, authSessionId);
  if (session) {
    return { session, response: null };
  }

  if (url.pathname === "/ws") {
    return {
      session: null,
      response: createUnauthorizedWebSocketResponse(clearAuthCookie),
    };
  }
  if (url.pathname.startsWith("/api/")) {
    return {
      session: null,
      response: createUnauthorizedApiResponse(clearAuthCookie),
    };
  }
  return {
    session: null,
    response: createUnauthorizedPageRedirect(url, clearAuthCookie),
  };
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/login") {
      const cookies = parseCookies(request.headers.get("Cookie"));
      const authSessionId = cookies[AUTH_SESSION_COOKIE];
      if (authSessionId) {
        const session = await loadAuthSession(env, authSessionId);
        if (session) {
          return Response.redirect(new URL("/", url.origin).toString(), 302);
        }
      }

      const nextPath = sanitizeNextPath(url.searchParams.get("next"));
      const reason = (url.searchParams.get("reason") || "").slice(0, 200);
      return new Response(LOGIN_HTML(reason, nextPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/auth/login") {
      const clientId = (env.GITHUB_CLIENT_ID || "").trim();
      const allowedOrg = (env.GITHUB_ALLOWED_ORG || "").trim();
      if (!clientId || !allowedOrg) {
        return new Response("Missing GitHub OAuth configuration", { status: 500 });
      }

      const nextPath = sanitizeNextPath(url.searchParams.get("next"));
      const state = createRandomToken();
      const redirectUri = `${url.origin}/auth/callback`;
      const oauthUrl = new URL("https://github.com/login/oauth/authorize");
      oauthUrl.searchParams.set("client_id", clientId);
      oauthUrl.searchParams.set("redirect_uri", redirectUri);
      oauthUrl.searchParams.set("scope", "read:user read:org read:team");
      oauthUrl.searchParams.set("state", state);

      const secureCookie = url.protocol === "https:";
      const headers = new Headers({ Location: oauthUrl.toString() });
      headers.append(
        "Set-Cookie",
        buildSetCookie(OAUTH_STATE_COOKIE, state, {
          maxAge: OAUTH_STATE_TTL_SECONDS,
          sameSite: "Lax",
          secure: secureCookie,
        }),
      );
      headers.append(
        "Set-Cookie",
        buildSetCookie(OAUTH_NEXT_COOKIE, nextPath, {
          maxAge: OAUTH_STATE_TTL_SECONDS,
          sameSite: "Lax",
          secure: secureCookie,
        }),
      );

      return new Response(null, { status: 302, headers });
    }

    if (url.pathname === "/auth/callback") {
      const secureCookie = url.protocol === "https:";
      const clearStateCookie = buildSetCookie(OAUTH_STATE_COOKIE, "", {
        maxAge: 0,
        sameSite: "Lax",
        secure: secureCookie,
      });
      const clearNextCookie = buildSetCookie(OAUTH_NEXT_COOKIE, "", {
        maxAge: 0,
        sameSite: "Lax",
        secure: secureCookie,
      });

      const redirectToLogin = (reason: string) => {
        const loginUrl = new URL("/login", url.origin);
        loginUrl.searchParams.set("reason", reason);
        const headers = new Headers({ Location: loginUrl.toString() });
        headers.append("Set-Cookie", clearStateCookie);
        headers.append("Set-Cookie", clearNextCookie);
        return new Response(null, { status: 302, headers });
      };

      const code = (url.searchParams.get("code") || "").trim();
      const state = (url.searchParams.get("state") || "").trim();
      if (!code || !state) {
        return redirectToLogin("GitHub 回调参数缺失");
      }

      const cookies = parseCookies(request.headers.get("Cookie"));
      const expectedState = cookies[OAUTH_STATE_COOKIE];
      const nextPath = sanitizeNextPath(cookies[OAUTH_NEXT_COOKIE] || "/");
      if (!expectedState || expectedState !== state) {
        return redirectToLogin("OAuth state 校验失败");
      }

      const allowedOrg = (env.GITHUB_ALLOWED_ORG || "").trim();
      const allowedTeam = (env.GITHUB_ALLOWED_TEAM || "").trim();
      if (!allowedOrg) {
        return redirectToLogin("未配置允许访问的 GitHub 组织");
      }

      try {
        const accessToken = await exchangeGithubCodeForToken(
          env,
          code,
          `${url.origin}/auth/callback`,
        );

        const user = await getGithubUser(accessToken);
        const orgAllowed = await ensureGithubOrgMembership(accessToken, allowedOrg);
        if (!orgAllowed) {
          return redirectToLogin(`当前账号不在组织 ${allowedOrg} 中`);
        }

        if (allowedTeam) {
          const teamAllowed = await ensureGithubTeamMembership(
            accessToken,
            allowedOrg,
            allowedTeam,
            user.login,
          );
          if (!teamAllowed) {
            return redirectToLogin(`当前账号不在团队 ${allowedTeam} 中`);
          }
        }

        const authSessionId = createRandomToken();
        const authSession: AuthSession = {
          sessionId: authSessionId,
          expiresAt: Date.now() + AUTH_SESSION_TTL_SECONDS * 1000,
          user: {
            id: user.id,
            login: user.login,
            name: user.name || user.login,
            avatar: user.avatar_url || "",
            email: user.email || null,
            org: allowedOrg,
            team: allowedTeam || undefined,
          },
        };
        await saveAuthSession(env, authSession);

        const headers = new Headers({
          Location: new URL(nextPath, url.origin).toString(),
        });
        headers.append(
          "Set-Cookie",
          buildSetCookie(AUTH_SESSION_COOKIE, authSessionId, {
            maxAge: AUTH_SESSION_TTL_SECONDS,
            sameSite: "Lax",
            secure: secureCookie,
          }),
        );
        headers.append("Set-Cookie", clearStateCookie);
        headers.append("Set-Cookie", clearNextCookie);

        return new Response(null, { status: 302, headers });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "GitHub OAuth 登录失败";
        return redirectToLogin(message);
      }
    }

    if (url.pathname === "/auth/logout") {
      const cookies = parseCookies(request.headers.get("Cookie"));
      const authSessionId = cookies[AUTH_SESSION_COOKIE];
      if (authSessionId) {
        await deleteAuthSession(env, authSessionId);
      }

      const secureCookie = url.protocol === "https:";
      const headers = new Headers({
        Location: new URL("/login", url.origin).toString(),
      });
      headers.append(
        "Set-Cookie",
        buildSetCookie(AUTH_SESSION_COOKIE, "", {
          maxAge: 0,
          sameSite: "Lax",
          secure: secureCookie,
        }),
      );
      headers.append(
        "Set-Cookie",
        buildSetCookie(OAUTH_STATE_COOKIE, "", {
          maxAge: 0,
          sameSite: "Lax",
          secure: secureCookie,
        }),
      );
      headers.append(
        "Set-Cookie",
        buildSetCookie(OAUTH_NEXT_COOKIE, "", {
          maxAge: 0,
          sameSite: "Lax",
          secure: secureCookie,
        }),
      );
      return new Response(null, { status: 302, headers });
    }

    const auth = await assertAuthenticated(request, url, env);
    if (auth.response) {
      return auth.response;
    }

    if (url.pathname === "/api/auth/me") {
      return Response.json({ success: true, user: auth.session?.user || null });
    }

    if (url.pathname === "/ws") {
      const upgrade = request.headers.get("Upgrade");
      if (upgrade !== "websocket") {
        return new Response("Expected websocket", { status: 400 });
      }

      const sessionId = resolveSessionId(
        url.searchParams.get("session"),
        `term-${Date.now()}`,
      );
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        await ensureSandboxRuntime(sandbox, env, sessionId);
        activeSandboxSessions.add(sessionId);
      } catch {
        return new Response("Failed to start sandbox terminal", { status: 500 });
      }

      return sandbox.wsConnect(request, 9000);
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/sandbox/status") {
      const sessionId = resolveSessionId(url.searchParams.get("session"));
      return Response.json({
        success: true,
        running: activeSandboxSessions.has(sessionId),
      });
    }

    if (url.pathname === "/api/sandbox/start") {
      const body = (await request.json()) as { sessionId?: string };
      const sessionId = resolveSessionId(body.sessionId);
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        const runtime = await ensureSandboxRuntime(sandbox, env, sessionId);
        activeSandboxSessions.add(sessionId);

        return Response.json({
          success: true,
          running: true,
          mounted: runtime.mounted,
          mountMessage: runtime.mountMessage,
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to start",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/api/sandbox/stop") {
      const body = (await request.json()) as { sessionId?: string };
      const sessionId = resolveSessionId(body.sessionId);
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        try {
          await sandbox.killAllProcesses();
        } catch {}

        try {
          await sandbox.destroy();
        } catch {}

        activeSandboxSessions.delete(sessionId);
        mountedSandboxSessions.delete(sessionId);

        return Response.json({ success: true, running: false });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to stop",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/api/files") {
      const sessionId = resolveSessionId(url.searchParams.get("session"));

      try {
        const directoryPath = normalizeVirtualPath(url.searchParams.get("path"), VFS_ROOT);
        const prefix = getDirectoryPrefix(sessionId, directoryPath);

        const listed = await env.CODE_BUCKET.list({
          prefix,
          delimiter: "/",
        });

        const directories = (listed.delimitedPrefixes || []).map((folderPrefix) => {
          const name = folderPrefix.slice(prefix.length).replace(/\/$/, "");
          const path = directoryPath === "/" ? `/${name}` : `${directoryPath}/${name}`;
          return {
            name,
            path,
            type: "directory",
            size: "-",
            modified: "",
          };
        });

        const files = listed.objects
          .map((obj) => decodeObjectPath(sessionId, obj.key))
          .filter((item): item is { name: string; path: string } => !!item)
          .filter((item) => {
            const expectedPrefix = directoryPath === "/" ? "/" : `${directoryPath}/`;
            const relative = item.path.slice(expectedPrefix.length);
            return !relative.includes("/") && item.name !== ".keep";
          })
          .map((item) => {
            const objectKey = buildFileKey(sessionId, item.path);
            const object = listed.objects.find((entry) => entry.key === objectKey);
            return {
              name: item.name,
              path: item.path,
              type: "file",
              size: object ? String(object.size) : "0",
              modified: object?.uploaded ? object.uploaded.toISOString() : "",
            };
          });

        const merged = [...directories, ...files].sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        return Response.json({ success: true, files: merged });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to list files",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/api/read") {
      const sessionId = resolveSessionId(url.searchParams.get("session"));
      const rawPath = url.searchParams.get("path");

      if (!rawPath) {
        return Response.json(
          { success: false, error: "No path" },
          { status: 400 },
        );
      }

      try {
        const filePath = normalizeVirtualPath(rawPath, VFS_ROOT);
        const key = buildFileKey(sessionId, filePath);
        const object = await env.CODE_BUCKET.get(key);

        if (!object) {
          return Response.json(
            { success: false, error: "File not found" },
            { status: 404 },
          );
        }

        const content = await object.text();
        return Response.json({ success: true, content });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to read file",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/api/write") {
      const body = (await request.json()) as {
        sessionId?: string;
        path: string;
        content: string;
      };
      const sessionId = resolveSessionId(body.sessionId);

      try {
        const filePath = normalizeVirtualPath(body.path, VFS_ROOT);
        const key = buildFileKey(sessionId, filePath);
        const content = typeof body.content === "string" ? body.content : String(body.content ?? "");

        await env.CODE_BUCKET.put(key, content);
        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to write file",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/api/mkdir") {
      const body = (await request.json()) as {
        sessionId?: string;
        path: string;
      };
      const sessionId = resolveSessionId(body.sessionId);

      try {
        const folderPath = normalizeVirtualPath(body.path, VFS_ROOT);
        if (folderPath === VFS_ROOT) {
          return Response.json({ success: true });
        }

        const folderKey = `${buildFileKey(sessionId, folderPath)}/.keep`;
        await env.CODE_BUCKET.put(folderKey, "");

        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create folder",
          },
          { status: 500 },
        );
      }
    }

    if (url.pathname === "/api/delete") {
      const body = (await request.json()) as {
        sessionId?: string;
        path: string;
      };
      const sessionId = resolveSessionId(body.sessionId);

      try {
        const targetPath = normalizeVirtualPath(body.path, VFS_ROOT);
        if (targetPath === VFS_ROOT) {
          return Response.json(
            { success: false, error: "Cannot delete root path" },
            { status: 400 },
          );
        }

        const baseKey = buildFileKey(sessionId, targetPath);
        const keys = new Set<string>([baseKey, `${baseKey}/.keep`]);

        const nestedKeys = await listAllKeysWithPrefix(env.CODE_BUCKET, `${baseKey}/`);
        for (const key of nestedKeys) keys.add(key);

        const deleteTargets = Array.from(keys).filter(Boolean);
        if (deleteTargets.length > 0) {
          await env.CODE_BUCKET.delete(deleteTargets);
        }

        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete path",
          },
          { status: 500 },
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
