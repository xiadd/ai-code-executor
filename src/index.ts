import { getSandbox, proxyToSandbox, type Sandbox } from "@cloudflare/sandbox";

export { Sandbox } from "@cloudflare/sandbox";

type Env = {
  Sandbox: DurableObjectNamespace<Sandbox>;
};

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sandbox IDE</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      height: 100%;
      background: #1e1e1e;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      color: #ccc;
    }
    .app {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      background: #2d2d30;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #333;
      flex-shrink: 0;
    }
    .header h1 {
      font-size: 14px;
      font-weight: 500;
      color: #fff;
    }
    .toolbar {
      display: flex;
      gap: 8px;
    }
    button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background: #0e639c;
      color: #fff;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    button:hover { background: #1177bb; }
    button.secondary {
      background: #3c3c3c;
    }
    button.secondary:hover { background: #4c4c4c; }
    button.success { background: #238636; }
    button.success:hover { background: #2ea043; }
    button.warning { background: #9e6a03; }
    button.warning:hover { background: #b47d0b; }
    .main {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    /* 左侧终端 */
    .left-panel {
      width: 50%;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #333;
    }
    .panel-header {
      background: #252526;
      padding: 8px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #bbb;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .terminal-container {
      flex: 1;
      padding: 4px;
      background: #0c0c0c;
    }
    #terminal {
      width: 100%;
      height: 100%;
    }
    /* 右侧文件管理 */
    .right-panel {
      width: 50%;
      display: flex;
      flex-direction: column;
    }
    .file-explorer {
      height: 35%;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid #333;
    }
    .file-tree {
      flex: 1;
      overflow: auto;
      padding: 8px;
      font-size: 13px;
    }
    .file-item {
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .file-item:hover { background: #2a2d2e; }
    .file-item.selected { background: #094771; }
    .file-item .icon { font-size: 14px; }
    .file-item .name { flex: 1; }
    .file-item .actions { display: none; }
    .file-item:hover .actions { display: flex; gap: 4px; }
    .file-item .actions button {
      padding: 2px 6px;
      font-size: 10px;
      background: transparent;
      border: 1px solid #555;
    }
    .folder-contents { padding-left: 16px; }
    .empty-state {
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    /* 编辑器 */
    .editor {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .editor-tabs {
      background: #2d2d30;
      display: flex;
      overflow-x: auto;
      min-height: 35px;
    }
    .tab {
      padding: 8px 16px;
      background: #2d2d30;
      border-right: 1px solid #1e1e1e;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
    }
    .tab:hover { background: #3c3c3c; }
    .tab.active { background: #1e1e1e; border-top: 2px solid #007acc; }
    .tab .close { opacity: 0.5; font-size: 14px; }
    .tab .close:hover { opacity: 1; color: #fff; }
    .tab.new-tab {
      padding: 8px 12px;
      background: transparent;
      border: none;
    }
    .editor-content {
      flex: 1;
      display: flex;
    }
    textarea {
      flex: 1;
      background: #1e1e1e;
      color: #d4d4d4;
      border: none;
      padding: 16px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
      resize: none;
      outline: none;
      tab-size: 2;
    }
    .no-editor {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      font-size: 14px;
    }
    /* 服务面板 */
    .services-panel {
      height: 25%;
      display: flex;
      flex-direction: column;
      border-top: 1px solid #333;
      background: #1e1e1e;
    }
    .services-list {
      flex: 1;
      overflow: auto;
      padding: 8px;
    }
    .service-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: #252526;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .service-item .port {
      background: #007acc;
      color: #fff;
      padding: 2px 8px;
      border-radius: 3px;
      font-weight: bold;
    }
    .service-item .url {
      flex: 1;
      color: #4ec9b0;
      font-family: monospace;
    }
    .service-item .url a {
      color: #4ec9b0;
      text-decoration: none;
    }
    .service-item .url a:hover {
      text-decoration: underline;
    }
    .service-item .status {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #4caf50;
    }
    .service-item .status::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
    }
    /* 状态栏 */
    .status-bar {
      background: #007acc;
      color: #fff;
      padding: 4px 16px;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
    }
    .status-bar.error { background: #f44336; }
    .status-bar.success { background: #4caf50; }
    /* 模态框 */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: #252526;
      padding: 20px;
      border-radius: 6px;
      min-width: 400px;
    }
    .modal h3 {
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 500;
    }
    .modal .field {
      margin-bottom: 12px;
    }
    .modal label {
      display: block;
      font-size: 12px;
      color: #bbb;
      margin-bottom: 4px;
    }
    .modal input, .modal select {
      width: 100%;
      padding: 8px 12px;
      background: #3c3c3c;
      border: 1px solid #555;
      color: #fff;
      border-radius: 4px;
      font-size: 13px;
    }
    .modal .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="header">
      <h1>🚀 Sandbox IDE</h1>
      <div class="toolbar">
        <button onclick="startSandbox()">🟢 启动 Sandbox</button>
        <button onclick="stopSandbox()" class="warning">⏹ 关闭 Sandbox</button>
        <button class="secondary" onclick="reconnectTerminal()">🔌 重连终端</button>
        <button onclick="runCurrentFile()" class="success">▶ 运行</button>
        <button onclick="saveCurrentFile()">💾 保存</button>
        <button onclick="showStartServerModal()">🌐 启动服务</button>
        <button onclick="refreshFiles()">🔄 刷新</button>
        <button class="secondary" onclick="clearTerminal()">🗑 清屏</button>
      </div>
    </div>

    <div class="main">
      <!-- 左侧终端 -->
      <div class="left-panel" id="leftPanel">
        <div class="panel-header">
          <span>终端</span>
          <span class="status-indicator" id="termStatus">● 离线</span>
        </div>
        <div class="terminal-container">
          <div id="terminal"></div>
        </div>
      </div>

      <!-- 右侧文件管理 + 编辑器 + 服务 -->
      <div class="right-panel">
        <!-- 文件树 -->
        <div class="file-explorer">
          <div class="panel-header">
            <span>文件资源管理器</span>
            <div class="toolbar">
              <button onclick="showNewFileModal()" style="padding: 4px 8px;">+ 文件</button>
              <button onclick="showNewFolderModal()" style="padding: 4px 8px;">+ 文件夹</button>
            </div>
          </div>
          <div class="file-tree" id="fileTree">
            <div class="empty-state">加载中...</div>
          </div>
        </div>

        <!-- 编辑器 -->
        <div class="editor">
          <div class="editor-tabs" id="editorTabs">
            <div class="tab new-tab" onclick="showNewFileModal()">+</div>
          </div>
          <div class="editor-content" id="editorContent">
            <div class="no-editor">选择一个文件开始编辑</div>
          </div>
        </div>

        <!-- 服务面板 -->
        <div class="services-panel">
          <div class="panel-header">
            <span>已暴露的服务</span>
            <div class="toolbar">
              <button onclick="refreshServices()" style="padding: 4px 8px;">刷新</button>
              <button class="secondary" onclick="stopAllServices()" style="padding: 4px 8px;">停止全部</button>
            </div>
          </div>
          <div class="services-list" id="servicesList">
            <div class="empty-state">暂无运行的服务，点击"启动服务"按钮</div>
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar" id="statusBar">
      <span id="statusText">就绪</span>
      <span id="sessionDisplay"></span>
    </div>
  </div>

  <!-- 新建文件模态框 -->
  <div class="modal-overlay" id="newFileModal">
    <div class="modal">
      <h3>新建文件</h3>
      <input type="text" id="newFileName" placeholder="文件名 (如: main.py)" />
      <div class="buttons">
        <button class="secondary" onclick="hideModal('newFileModal')">取消</button>
        <button onclick="createNewFile()">创建</button>
      </div>
    </div>
  </div>

  <!-- 新建文件夹模态框 -->
  <div class="modal-overlay" id="newFolderModal">
    <div class="modal">
      <h3>新建文件夹</h3>
      <input type="text" id="newFolderName" placeholder="文件夹名" />
      <div class="buttons">
        <button class="secondary" onclick="hideModal('newFolderModal')">取消</button>
        <button onclick="createNewFolder()">创建</button>
      </div>
    </div>
  </div>

  <!-- 启动服务模态框 -->
  <div class="modal-overlay" id="startServerModal">
    <div class="modal">
      <h3>启动 HTTP 服务</h3>
      <div class="field">
        <label>端口</label>
        <select id="serverPort">
          <option value="8080">8080</option>
          <option value="5000">5000</option>
          <option value="8000">8000</option>
          <option value="5173">5173 (Vite)</option>
          <option value="3001">3001</option>
        </select>
      </div>
      <div class="field">
        <label>启动命令</label>
        <select id="serverCommand" onchange="updateServerCommand()">
          <option value='python -m http.server {port}'>Python HTTP Server</option>
          <option value='python3 -m http.server {port}'>Python3 HTTP Server</option>
          <option value='python app.py'>Python Flask (端口在代码中指定)</option>
          <option value='uvicorn main:app --host 0.0.0.0 --port {port}'>Python FastAPI (Uvicorn)</option>
          <option value='node server.js'>Node.js (端口在代码中指定)</option>
          <option value='npx vite --host 0.0.0.0 --port {port}'>Vite Dev Server</option>
          <option value='npx http-server -p {port}'>Node HTTP Server</option>
          <option value='custom'>自定义命令...</option>
        </select>
      </div>
      <div class="field" id="customCommandField" style="display:none">
        <label>自定义命令</label>
        <input type="text" id="customCommand" placeholder='如: python -m http.server 8080' />
      </div>
      <div class="buttons">
        <button class="secondary" onclick="hideModal('startServerModal')">取消</button>
        <button onclick="startServer()">启动并暴露</button>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js"></script>

  <script>
    // ============ 全局状态 ============
    const sessionId = 'ide-' + Math.random().toString(36).substring(2, 10);
    let ws = null;
    let connected = false;
    let sandboxRunning = false;
    let manualDisconnect = false;
    let currentPath = '/workspace';
    let openFiles = new Map();
    let activeFile = null;
    let fileTreeData = [];
    let exposedServices = [];

    // ============ Terminal ============
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#cccccc',
        selectionBackground: '#264f78',
        black: '#0c0c0c',
        red: '#c50f1f',
        green: '#13a10e',
        yellow: '#c19c00',
        blue: '#0037da',
        magenta: '#881798',
        cyan: '#3a96dd',
        white: '#cccccc',
        brightBlack: '#767676',
        brightRed: '#e74856',
        brightGreen: '#16c60c',
        brightYellow: '#f9f1a5',
        brightBlue: '#3b78ff',
        brightMagenta: '#b4009e',
        brightCyan: '#61d6d6',
        brightWhite: '#f2f2f2'
      },
      scrollback: 10000,
      allowProposedApi: true,
      cursorStyle: 'block',
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // ============ 状态栏 ============
    function updateStatus(text, type = '') {
      document.getElementById('statusText').textContent = text;
      document.getElementById('statusBar').className = 'status-bar ' + type;
    }

    function updateTermStatus(text, connected) {
      const el = document.getElementById('termStatus');
      el.textContent = '● ' + text;
      el.style.color = connected ? '#238636' : '#da3633';
    }

    function requireSandbox(actionName = '该操作') {
      if (sandboxRunning) return true;
      updateStatus(actionName + '失败：请先启动 Sandbox', 'error');
      return false;
    }

    // ============ WebSocket ============
    function connect() {
      if (!sandboxRunning) {
        updateTermStatus('未启动', false);
        return;
      }

      if (ws) { ws.close(); ws = null; }

      updateTermStatus('连接中...', false);

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + location.host + '/ws?session=' + sessionId;

      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        connected = true;
        updateTermStatus('已连接', true);
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        refreshFiles();
        refreshServices();
      };

      ws.onmessage = (event) => {
        const text = typeof event.data === 'string' 
          ? event.data 
          : new TextDecoder().decode(event.data);
        term.write(text);
      };

      ws.onclose = () => {
        connected = false;
        ws = null;
        updateTermStatus(sandboxRunning ? '离线' : '未启动', false);
        if (!manualDisconnect) {
          term.writeln('\\r\\n\\x1b[31m[连接已断开]\\x1b[0m');
        }
        manualDisconnect = false;
      };

      ws.onerror = () => {
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
        const res = await fetch('/api/sandbox/status?session=' + sessionId);
        const data = await res.json();
        sandboxRunning = !!data.running;
        if (sandboxRunning) {
          updateStatus('Sandbox 已就绪', 'success');
          connect();
          await refreshFiles();
          await refreshServices();
        } else {
          disconnectTerminal();
          fileTreeData = [];
          renderFileTree();
          exposedServices = [];
          renderServices();
          updateStatus('Sandbox 未启动');
        }
      } catch {
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
        const res = await fetch('/api/sandbox/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (!data.success) {
          updateStatus('启动失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        sandboxRunning = true;
        connect();
        await refreshFiles();
        await refreshServices();
        updateStatus('Sandbox 已启动', 'success');
      } catch {
        updateStatus('启动 Sandbox 失败', 'error');
      }
    }

    async function stopSandbox() {
      if (!sandboxRunning) {
        updateStatus('Sandbox 当前未运行');
        return;
      }
      if (!confirm('确定要关闭当前 Sandbox 吗？这会终止所有进程和服务。')) return;

      updateStatus('正在关闭 Sandbox...');
      try {
        const res = await fetch('/api/sandbox/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (!data.success) {
          updateStatus('关闭失败: ' + (data.error || '未知错误'), 'error');
          return;
        }

        sandboxRunning = false;
        disconnectTerminal();
        fileTreeData = [];
        renderFileTree();
        exposedServices = [];
        renderServices();
        openFiles.clear();
        activeFile = null;
        renderTabs();
        renderEditor();
        updateStatus('Sandbox 已关闭', 'success');
      } catch {
        updateStatus('关闭 Sandbox 失败', 'error');
      }
    }

    function reconnectTerminal() {
      if (!requireSandbox('重连终端')) return;
      disconnectTerminal();
      connect();
    }

    term.onData((data) => {
      if (connected && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    window.addEventListener('resize', () => {
      fitAddon.fit();
      if (connected && ws) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });

    // ============ 文件管理 ============
    async function refreshFiles() {
      if (!sandboxRunning) {
        fileTreeData = [];
        renderFileTree();
        return;
      }

      try {
        const res = await fetch('/api/files?session=' + sessionId + '&path=' + encodeURIComponent(currentPath));
        const data = await res.json();
        if (data.success) {
          fileTreeData = data.files || [];
          renderFileTree();
          return;
        }
        updateStatus('加载文件失败: ' + (data.error || '未知错误'), 'error');
      } catch (err) {
        console.error('Failed to load files:', err);
        updateStatus('加载文件失败', 'error');
      }
    }

    function renderFileTree() {
      const container = document.getElementById('fileTree');
      if (!sandboxRunning) {
        container.innerHTML = '<div class="empty-state">Sandbox 未启动，点击上方“启动 Sandbox”</div>';
        return;
      }

      if (fileTreeData.length === 0) {
        container.innerHTML = '<div class="empty-state">空文件夹</div>';
        return;
      }

      container.innerHTML = fileTreeData.map(file => {
        const isDir = file.type === 'directory';
        const icon = isDir ? '📁' : getFileIcon(file.name);
        return \`
          <div class="file-item" onclick="\${isDir ? 'openFolder' : 'openFile'}('\${file.path}')">
            <span class="icon">\${icon}</span>
            <span class="name">\${file.name}</span>
            <div class="actions" onclick="event.stopPropagation()">
              <button onclick="deleteFile('\${file.path}')">删除</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function getFileIcon(filename) {
      if (filename.endsWith('.py')) return '🐍';
      if (filename.endsWith('.js')) return '📜';
      if (filename.endsWith('.ts')) return '🔷';
      if (filename.endsWith('.json')) return '📋';
      if (filename.endsWith('.md')) return '📝';
      if (filename.endsWith('.html')) return '🌐';
      if (filename.endsWith('.css')) return '🎨';
      if (filename.endsWith('.sh')) return '⚡';
      return '📄';
    }

    async function openFile(path) {
      if (!requireSandbox('打开文件')) return;
      try {
        const res = await fetch('/api/read?session=' + sessionId + '&path=' + encodeURIComponent(path));
        const data = await res.json();
        if (data.success) {
          openFiles.set(path, { content: data.content, modified: false });
          activeFile = path;
          renderTabs();
          renderEditor();
          return;
        }
        updateStatus('读取文件失败: ' + (data.error || '未知错误'), 'error');
      } catch (err) {
        updateStatus('读取文件失败', 'error');
      }
    }

    function openFolder(path) {
      currentPath = path;
      refreshFiles();
    }

    async function saveCurrentFile() {
      if (!requireSandbox('保存文件')) return;
      if (!activeFile) return;
      
      const textarea = document.getElementById('editorTextarea');
      if (!textarea) return;

      const content = textarea.value;
      
      try {
        const res = await fetch('/api/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, path: activeFile, content })
        });
        const data = await res.json();
        if (data.success) {
          openFiles.get(activeFile).content = content;
          openFiles.get(activeFile).modified = false;
          renderTabs();
          updateStatus('文件已保存', 'success');
          return;
        }
        updateStatus('保存失败: ' + (data.error || '未知错误'), 'error');
      } catch (err) {
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

      const command = getRunCommand(activeFile);
      if (command && connected && ws) {
        term.writeln('\\r\\n\\x1b[36m$ ' + command + '\\x1b[0m\\r\\n');
        ws.send(JSON.stringify({ type: 'input', data: command + '\\r' }));
      }
    }

    function getRunCommand(path) {
      if (path.endsWith('.py')) return 'python3 "' + path + '"';
      if (path.endsWith('.js')) return 'node "' + path + '"';
      if (path.endsWith('.sh')) return 'bash "' + path + '"';
      return null;
    }

    // ============ 编辑器 ============
    function renderTabs() {
      const tabsContainer = document.getElementById('editorTabs');
      let html = '';
      
      openFiles.forEach((file, path) => {
        const filename = path.split('/').pop();
        const isActive = path === activeFile;
        const modified = file.modified ? ' ●' : '';
        html += \`
          <div class="tab \${isActive ? 'active' : ''}" onclick="switchTab('\${path}')">
            <span>\${filename}\${modified}</span>
            <span class="close" onclick="closeTab('\${path}', event)">×</span>
          </div>
        \`;
      });
      
      html += '<div class="tab new-tab" onclick="showNewFileModal()">+</div>';
      tabsContainer.innerHTML = html;
    }

    function renderEditor() {
      const container = document.getElementById('editorContent');
      if (!activeFile) {
        container.innerHTML = '<div class="no-editor">选择一个文件开始编辑</div>';
        return;
      }

      const file = openFiles.get(activeFile);
      container.innerHTML = '<textarea id="editorTextarea" spellcheck="false">' + escapeHtml(file.content) + '</textarea>';
      
      const textarea = document.getElementById('editorTextarea');
      textarea.focus();
      
      textarea.addEventListener('input', () => {
        openFiles.get(activeFile).modified = true;
        renderTabs();
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
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
        activeFile = openFiles.size > 0 ? openFiles.keys().next().value : null;
      }
      renderTabs();
      renderEditor();
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ============ 服务管理 ============
    function updateServerCommand() {
      const select = document.getElementById('serverCommand');
      const customField = document.getElementById('customCommandField');
      customField.style.display = select.value === 'custom' ? 'block' : 'none';
    }

    async function startServer() {
      if (!requireSandbox('启动服务')) return;

      const port = document.getElementById('serverPort').value;
      let command = document.getElementById('serverCommand').value;
      
      if (command === 'custom') {
        command = document.getElementById('customCommand').value;
      }
      
      // 替换 {port} 占位符
      command = command.replace(/{port}/g, port);

      hideModal('startServerModal');
      updateStatus('正在启动服务...');

      try {
        const res = await fetch('/api/start-server', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, port: parseInt(port), command })
        });
        
        const data = await res.json();
        if (data.success) {
          updateStatus('服务已启动: ' + data.publicUrl, 'success');
          // 在终端显示
          term.writeln('\\r\\n\\x1b[32m[Service Started]\\x1b[0m');
          term.writeln('\\x1b[36mPublic URL: ' + data.publicUrl + '\\x1b[0m\\r\\n');
          refreshServices();
        } else {
          updateStatus('启动失败: ' + data.error, 'error');
        }
      } catch (err) {
        updateStatus('启动失败', 'error');
      }
    }

    async function refreshServices() {
      if (!sandboxRunning) {
        exposedServices = [];
        renderServices();
        return;
      }

      try {
        const res = await fetch('/api/services?session=' + sessionId);
        const data = await res.json();
        if (data.success) {
          exposedServices = data.services || [];
          renderServices();
          return;
        }
        updateStatus('获取服务列表失败: ' + (data.error || '未知错误'), 'error');
      } catch (err) {
        console.error('Failed to load services:', err);
      }
    }

    function renderServices() {
      const container = document.getElementById('servicesList');
      if (!sandboxRunning) {
        container.innerHTML = '<div class="empty-state">Sandbox 未启动</div>';
        return;
      }

      if (exposedServices.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无运行的服务，点击"启动服务"按钮</div>';
        return;
      }

      container.innerHTML = exposedServices.map(svc => \`
        <div class="service-item">
          <span class="port">\${svc.port}</span>
          <span class="url"><a href="\${svc.url}" target="_blank">\${svc.url}</a></span>
          <span class="status">运行中</span>
          <button class="secondary" onclick="stopService(\${svc.port})">停止</button>
        </div>
      \`).join('');
    }

    async function stopService(port) {
      if (!requireSandbox('停止服务')) return;
      try {
        const res = await fetch('/api/stop-server', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, port })
        });
        const data = await res.json();
        if (data.success) {
          updateStatus('服务已停止', 'success');
          refreshServices();
        }
      } catch (err) {
        updateStatus('停止失败', 'error');
      }
    }

    async function stopAllServices() {
      if (!confirm('确定要停止所有服务吗？')) return;
      
      for (const svc of exposedServices) {
        await stopService(svc.port);
      }
    }

    // ============ 模态框 ============
    function showNewFileModal() {
      document.getElementById('newFileModal').classList.add('active');
      document.getElementById('newFileName').value = '';
      document.getElementById('newFileName').focus();
    }

    function showNewFolderModal() {
      document.getElementById('newFolderModal').classList.add('active');
      document.getElementById('newFolderName').value = '';
      document.getElementById('newFolderName').focus();
    }

    function showStartServerModal() {
      document.getElementById('startServerModal').classList.add('active');
      updateServerCommand();
    }

    function hideModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    async function createNewFile() {
      if (!requireSandbox('创建文件')) return;
      const name = document.getElementById('newFileName').value.trim();
      if (!name) return;

      const path = currentPath + '/' + name;
      
      try {
        const res = await fetch('/api/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, path, content: '' })
        });
        const data = await res.json();
        if (data.success) {
          hideModal('newFileModal');
          refreshFiles();
          openFile(path);
        }
      } catch (err) {
        updateStatus('创建文件失败', 'error');
      }
    }

    async function createNewFolder() {
      if (!requireSandbox('创建文件夹')) return;
      const name = document.getElementById('newFolderName').value.trim();
      if (!name) return;

      try {
        const res = await fetch('/api/mkdir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, path: currentPath + '/' + name })
        });
        const data = await res.json();
        if (data.success) {
          hideModal('newFolderModal');
          refreshFiles();
        }
      } catch (err) {
        updateStatus('创建文件夹失败', 'error');
      }
    }

    async function deleteFile(path) {
      if (!requireSandbox('删除文件')) return;
      if (!confirm('确定要删除 ' + path.split('/').pop() + ' 吗？')) return;

      try {
        const res = await fetch('/api/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, path })
        });
        const data = await res.json();
        if (data.success) {
          if (openFiles.has(path)) {
            openFiles.delete(path);
            if (activeFile === path) {
              activeFile = openFiles.size > 0 ? openFiles.keys().next().value : null;
            }
            renderTabs();
            renderEditor();
          }
          refreshFiles();
        }
      } catch (err) {
        updateStatus('删除失败', 'error');
      }
    }

    function clearTerminal() {
      term.clear();
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideModal('newFileModal');
        hideModal('newFolderModal');
        hideModal('startServerModal');
      }
    });

    // 初始化
    document.getElementById('sessionDisplay').textContent = sessionId;
    updateTermStatus('未启动', false);
    checkSandboxStatus();
    
    // 定期刷新服务列表
    setInterval(() => {
      if (sandboxRunning) {
        refreshServices();
      }
    }, 10000);
  </script>
</body>
</html>`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const WORKSPACE_ROOT = "/workspace";
const activeSandboxSessions = new Set<string>();

const resolveSessionId = (
  raw: string | null | undefined,
  fallback = "default",
) => (raw && raw.trim() ? raw.trim() : fallback);

const normalizeWorkspacePath = (
  rawPath: string | null | undefined,
  fallback = WORKSPACE_ROOT,
) => {
  const input = rawPath && rawPath.trim() ? rawPath.trim() : fallback;
  const raw = input.replace(/\\/g, "/");
  const prefixed = raw.startsWith("/") ? raw : `${WORKSPACE_ROOT}/${raw}`;
  const normalizedSegments: string[] = [];

  for (const part of prefixed.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      normalizedSegments.pop();
      continue;
    }
    normalizedSegments.push(part);
  }

  const normalizedPath = `/${normalizedSegments.join("/")}`;
  if (
    normalizedPath !== WORKSPACE_ROOT &&
    !normalizedPath.startsWith(`${WORKSPACE_ROOT}/`)
  ) {
    throw new Error(`Path must be under ${WORKSPACE_ROOT}`);
  }

  return normalizedPath;
};

const ensureTerminalServer = async (sandbox: Sandbox) => {
  let serverRunning = false;

  try {
    const existing = await sandbox.getProcess("pty-server");
    if (existing) {
      const status = await existing.getStatus();
      serverRunning = status === "running";
    }
  } catch {
    serverRunning = false;
  }

  if (serverRunning) return;

  await sandbox.startProcess("python3 /workspace/terminal-server.py", {
    processId: "pty-server",
    cwd: WORKSPACE_ROOT,
  });
  await sleep(1200);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket 终端 - 必须在 proxyToSandbox 之前处理
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
        await ensureTerminalServer(sandbox);
        activeSandboxSessions.add(sessionId);
      } catch {
        return new Response("Failed to start terminal server", { status: 500 });
      }

      return sandbox.wsConnect(request, 9000);
    }

    // 处理预览 URL 路由（在 WebSocket 之后）
    const proxyResponse = await proxyToSandbox(request, env);
    if (proxyResponse) return proxyResponse;

    // 主页
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // API: 查询 Sandbox 状态（仅基于当前 Worker 进程内记录）
    if (url.pathname === "/api/sandbox/status") {
      const sessionId = resolveSessionId(url.searchParams.get("session"));
      return Response.json({
        success: true,
        running: activeSandboxSessions.has(sessionId),
      });
    }

    // API: 启动 Sandbox
    if (url.pathname === "/api/sandbox/start") {
      const body = (await request.json()) as { sessionId?: string };
      const sessionId = resolveSessionId(body?.sessionId);
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        await ensureTerminalServer(sandbox);
        activeSandboxSessions.add(sessionId);
        return Response.json({ success: true, running: true });
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

    // API: 关闭 Sandbox（终止所有进程和暴露端口）
    if (url.pathname === "/api/sandbox/stop") {
      const body = (await request.json()) as { sessionId?: string };
      const sessionId = resolveSessionId(body?.sessionId);
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        try {
          const ports = await sandbox.getExposedPorts(url.hostname);
          for (const portInfo of ports) {
            try {
              await sandbox.unexposePort(portInfo.port);
            } catch {}
          }
        } catch {}

        try {
          await sandbox.killAllProcesses();
        } catch {}

        try {
          await sandbox.destroy();
        } catch {}

        activeSandboxSessions.delete(sessionId);
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

    // API: 启动并暴露 HTTP 服务
    if (url.pathname === "/api/start-server") {
      const body = (await request.json()) as {
        sessionId?: string;
        port: number;
        command: string;
      };
      const sessionId = resolveSessionId(body?.sessionId);
      const { port, command } = body;
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        await sandbox.startProcess(command, {
          processId: `server-${port}`,
          cwd: WORKSPACE_ROOT,
        });
        await sleep(2000);

        const exposed = await sandbox.exposePort(port, {
          hostname: url.hostname,
          name: `service-${port}`,
        });
        activeSandboxSessions.add(sessionId);

        return Response.json({
          success: true,
          publicUrl: exposed.url,
          port,
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to start server",
          },
          { status: 500 },
        );
      }
    }

    // API: 停止服务
    if (url.pathname === "/api/stop-server") {
      const body = (await request.json()) as {
        sessionId?: string;
        port: number;
      };
      const sessionId = resolveSessionId(body?.sessionId);
      const { port } = body;
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        try {
          const process = await sandbox.getProcess(`server-${port}`);
          if (process) {
            await process.kill("SIGTERM");
          }
        } catch {}

        try {
          await sandbox.unexposePort(port);
        } catch {}

        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed",
          },
          { status: 500 },
        );
      }
    }

    // API: 获取已暴露的服务列表
    if (url.pathname === "/api/services") {
      const sessionId = resolveSessionId(url.searchParams.get("session"));
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        const ports = await sandbox.getExposedPorts(url.hostname);
        const services = ports.map((portInfo) => ({
          port: portInfo.port,
          url: portInfo.url,
          status: portInfo.status,
        }));

        return Response.json({ success: true, services });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed",
          },
          { status: 500 },
        );
      }
    }

    // API: 列出文件
    if (url.pathname === "/api/files") {
      const sessionId = resolveSessionId(url.searchParams.get("session"));
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        const sandboxPath = normalizeWorkspacePath(url.searchParams.get("path"));
        const result = await sandbox.listFiles(sandboxPath, {
          recursive: false,
          includeHidden: true,
        });

        const files = result.files
          .filter((file) => !file.relativePath.includes("/"))
          .map((file) => ({
            name: file.name,
            path: file.absolutePath,
            type: file.type === "directory" ? "directory" : "file",
            size: file.type === "directory" ? "-" : String(file.size),
            modified: file.modifiedAt,
          }))
          .sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === "directory" ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

        return Response.json({ success: true, files });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed",
          },
          { status: 500 },
        );
      }
    }

    // API: 读取文件
    if (url.pathname === "/api/read") {
      const sessionId = resolveSessionId(url.searchParams.get("session"));
      const rawPath = url.searchParams.get("path");
      if (!rawPath) {
        return Response.json(
          { success: false, error: "No path" },
          { status: 400 },
        );
      }

      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        const sandboxPath = normalizeWorkspacePath(rawPath);
        const file = await sandbox.readFile(sandboxPath);
        return Response.json({ success: true, content: file.content });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed",
          },
          { status: 500 },
        );
      }
    }

    // API: 写入文件
    if (url.pathname === "/api/write") {
      const body = (await request.json()) as {
        sessionId?: string;
        path: string;
        content: string;
      };
      const sessionId = resolveSessionId(body?.sessionId);
      const content =
        typeof body?.content === "string" ? body.content : String(body?.content ?? "");
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        const sandboxPath = normalizeWorkspacePath(body?.path);
        await sandbox.writeFile(sandboxPath, content);
        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed",
          },
          { status: 500 },
        );
      }
    }

    // API: 创建文件夹
    if (url.pathname === "/api/mkdir") {
      const body = (await request.json()) as {
        sessionId?: string;
        path: string;
      };
      const sessionId = resolveSessionId(body?.sessionId);
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        const sandboxPath = normalizeWorkspacePath(body?.path);
        await sandbox.mkdir(sandboxPath, { recursive: true });
        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed",
          },
          { status: 500 },
        );
      }
    }

    // API: 删除文件/文件夹
    if (url.pathname === "/api/delete") {
      const body = (await request.json()) as {
        sessionId?: string;
        path: string;
      };
      const sessionId = resolveSessionId(body?.sessionId);
      const sandbox = getSandbox(env.Sandbox, sessionId, { normalizeId: true });

      try {
        const sandboxPath = normalizeWorkspacePath(body?.path);
        await sandbox.deleteFile(sandboxPath);
        return Response.json({ success: true });
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed",
          },
          { status: 500 },
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
