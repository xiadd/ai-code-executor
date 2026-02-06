import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import {
  ArrowUp,
  File,
  Folder,
  FolderPlus,
  LogOut,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Square,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { AuthUser, FileEntry, OpenFile } from "./types";

type ApiSuccess<T> = T & { success: true };
type ApiFailure = { success: false; error?: string };
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const ROOT = "/";

const getStoredSessionId = () => {
  const key = "sandbox-ide-session-id";
  const fromStorage = globalThis.localStorage?.getItem(key);
  if (fromStorage) return fromStorage;
  const next = `ide-${Math.random().toString(36).slice(2, 10)}`;
  globalThis.localStorage?.setItem(key, next);
  return next;
};

const normalizePath = (input: string, fallback = ROOT) => {
  const raw = (input || fallback).trim() || fallback;
  const absolute = raw.startsWith("/") ? raw : `/${raw}`;
  const parts = absolute.split("/");
  const out: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }

  return out.length ? `/${out.join("/")}` : ROOT;
};

const parentPath = (path: string) => {
  if (!path || path === ROOT) return ROOT;
  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join("/")}` : ROOT;
};

const joinPath = (base: string, name: string) => {
  if (base === ROOT) return `/${name}`;
  return `${base}/${name}`;
};

const getRunCommand = (path: string) => {
  const workspacePath = path === ROOT ? "/workspace" : `/workspace${path}`;
  if (path.endsWith(".py")) return `python3 \"${workspacePath}\"`;
  if (path.endsWith(".js")) return `node \"${workspacePath}\"`;
  if (path.endsWith(".ts")) return `npx tsx \"${workspacePath}\"`;
  if (path.endsWith(".sh")) return `bash \"${workspacePath}\"`;
  return "";
};

const fileLanguageHint = (path: string) => {
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "text";
};

export function App() {
  const [sessionId] = useState(getStoredSessionId);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [statusKind, setStatusKind] = useState<"idle" | "ok" | "error">("idle");

  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [terminalConnected, setTerminalConnected] = useState(false);

  const [currentPath, setCurrentPath] = useState(ROOT);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [tabs, setTabs] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);

  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const manualDisconnectRef = useRef(false);

  const activeTab = useMemo(
    () => tabs.find((item) => item.path === activePath) || null,
    [tabs, activePath],
  );

  const setStatusLine = useCallback(
    (message: string, kind: "idle" | "ok" | "error" = "idle") => {
      setStatus(message);
      setStatusKind(kind);
    },
    [],
  );

  const apiRequest = useCallback(async <T,>(url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;

    if (response.status === 401) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.href = `/login?next=${next}`;
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      if (payload && typeof payload === "object" && "error" in payload && payload.error) {
        throw new Error(payload.error);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    if (!payload || payload.success === false) {
      throw new Error((payload as ApiFailure)?.error || "Request failed");
    }

    return payload as ApiSuccess<T>;
  }, []);

  const disconnectTerminal = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      manualDisconnectRef.current = true;
      ws.close();
      wsRef.current = null;
    }
    setTerminalConnected(false);
  }, []);

  const connectTerminal = useCallback(() => {
    if (!sandboxRunning || !xtermRef.current) return;

    disconnectTerminal();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsURL = `${protocol}//${window.location.host}/ws?session=${encodeURIComponent(sessionId)}`;

    const ws = new WebSocket(wsURL);
    wsRef.current = ws;

    ws.onopen = () => {
      setTerminalConnected(true);
      ws.send(
        JSON.stringify({
          type: "resize",
          cols: xtermRef.current?.cols || 80,
          rows: xtermRef.current?.rows || 24,
        }),
      );
    };

    ws.onmessage = (event) => {
      const text = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
      xtermRef.current?.write(text);
    };

    ws.onclose = () => {
      setTerminalConnected(false);
      wsRef.current = null;
      if (!manualDisconnectRef.current) {
        xtermRef.current?.writeln("\r\n[terminal disconnected]");
      }
      manualDisconnectRef.current = false;
    };

    ws.onerror = () => {
      setTerminalConnected(false);
    };
  }, [disconnectTerminal, sandboxRunning, sessionId]);

  const refreshSandboxStatus = useCallback(async () => {
    if (!backendReady) return;

    try {
      const data = await apiRequest<{ running: boolean }>(
        `/api/sandbox/status?session=${encodeURIComponent(sessionId)}`,
      );
      setSandboxRunning(Boolean(data.running));
      if (data.running) {
        setStatusLine("Sandbox is running", "ok");
      } else {
        setStatusLine("Sandbox is stopped", "idle");
        disconnectTerminal();
      }
    } catch (error) {
      setSandboxRunning(false);
      disconnectTerminal();
      setStatusLine(`Sandbox status check failed: ${(error as Error).message}`, "error");
    }
  }, [apiRequest, backendReady, disconnectTerminal, sessionId, setStatusLine]);

  const refreshFiles = useCallback(async () => {
    if (!backendReady) {
      setFiles([]);
      return;
    }

    try {
      const data = await apiRequest<{ files: FileEntry[] }>(
        `/api/files?session=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(currentPath)}`,
      );
      setFiles(data.files);
    } catch (error) {
      setStatusLine(`Load files failed: ${(error as Error).message}`, "error");
    }
  }, [apiRequest, backendReady, currentPath, sessionId, setStatusLine]);

  const openFile = useCallback(
    async (path: string) => {
      try {
        const data = await apiRequest<{ content: string }>(
          `/api/read?session=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(path)}`,
        );

        setTabs((prev) => {
          const existing = prev.find((tab) => tab.path === path);
          if (existing) {
            return prev.map((tab) =>
              tab.path === path ? { ...tab, content: data.content, modified: false } : tab,
            );
          }
          return [...prev, { path, content: data.content, modified: false }];
        });
        setActivePath(path);
      } catch (error) {
        setStatusLine(`Read file failed: ${(error as Error).message}`, "error");
      }
    },
    [apiRequest, sessionId, setStatusLine],
  );

  const saveActiveFile = useCallback(async () => {
    if (!activeTab) return;

    try {
      await apiRequest<{}>("/api/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          path: activeTab.path,
          content: activeTab.content,
        }),
      });

      setTabs((prev) =>
        prev.map((item) =>
          item.path === activeTab.path ? { ...item, modified: false } : item,
        ),
      );
      setStatusLine("File saved", "ok");
      await refreshFiles();
    } catch (error) {
      setStatusLine(`Save failed: ${(error as Error).message}`, "error");
    }
  }, [activeTab, apiRequest, refreshFiles, sessionId, setStatusLine]);

  const runActiveFile = useCallback(async () => {
    if (!activeTab) {
      setStatusLine("Open a file first", "error");
      return;
    }

    if (!sandboxRunning) {
      setStatusLine("Start sandbox first", "error");
      return;
    }

    const command = getRunCommand(activeTab.path);
    if (!command) {
      setStatusLine("Unsupported file type for quick run", "error");
      return;
    }

    await saveActiveFile();

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setStatusLine("Terminal is not connected", "error");
      return;
    }

    xtermRef.current?.writeln(`\r\n$ ${command}`);
    wsRef.current.send(JSON.stringify({ type: "input", data: `${command}\r` }));
  }, [activeTab, saveActiveFile, sandboxRunning, setStatusLine]);

  const createFile = useCallback(async () => {
    const name = newFileName.trim();
    if (!name) return;

    const path = normalizePath(joinPath(currentPath, name));

    try {
      await apiRequest<{}>("/api/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, path, content: "" }),
      });
      setNewFileOpen(false);
      setNewFileName("");
      await refreshFiles();
      await openFile(path);
      setStatusLine("File created", "ok");
    } catch (error) {
      setStatusLine(`Create file failed: ${(error as Error).message}`, "error");
    }
  }, [apiRequest, currentPath, newFileName, openFile, refreshFiles, sessionId, setStatusLine]);

  const createFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;

    const path = normalizePath(joinPath(currentPath, name));

    try {
      await apiRequest<{}>("/api/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, path }),
      });
      setNewFolderOpen(false);
      setNewFolderName("");
      await refreshFiles();
      setStatusLine("Folder created", "ok");
    } catch (error) {
      setStatusLine(`Create folder failed: ${(error as Error).message}`, "error");
    }
  }, [apiRequest, currentPath, newFolderName, refreshFiles, sessionId, setStatusLine]);

  const deletePath = useCallback(
    async (path: string) => {
      const confirmed = window.confirm(`Delete ${path}?`);
      if (!confirmed) return;

      try {
        await apiRequest<{}>("/api/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, path }),
        });

        setTabs((prev) => prev.filter((item) => item.path !== path));
        if (activePath === path) {
          setActivePath(null);
        }
        await refreshFiles();
        setStatusLine("Deleted", "ok");
      } catch (error) {
        setStatusLine(`Delete failed: ${(error as Error).message}`, "error");
      }
    },
    [activePath, apiRequest, refreshFiles, sessionId, setStatusLine],
  );

  const startSandbox = useCallback(async () => {
    if (!backendReady) {
      setStatusLine("Local UI mode: Cloudflare bindings are unavailable", "idle");
      return;
    }

    if (sandboxRunning) {
      connectTerminal();
      return;
    }

    setStatusLine("Starting sandbox...");

    try {
      const data = await apiRequest<{ mounted: boolean; mountMessage?: string }>(
        "/api/sandbox/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        },
      );

      setSandboxRunning(true);
      connectTerminal();
      if (data.mounted) {
        setStatusLine("Sandbox started and R2 mounted", "ok");
      } else {
        const detail = data.mountMessage ? ` (${data.mountMessage})` : "";
        setStatusLine(`Sandbox started without R2 mount${detail}`, "ok");
      }
    } catch (error) {
      setStatusLine(`Start sandbox failed: ${(error as Error).message}`, "error");
    }
  }, [apiRequest, backendReady, connectTerminal, sandboxRunning, sessionId, setStatusLine]);

  const stopSandbox = useCallback(async () => {
    if (!backendReady) return;
    if (!sandboxRunning) return;

    try {
      await apiRequest<{ running: boolean }>("/api/sandbox/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setSandboxRunning(false);
      disconnectTerminal();
      setStatusLine("Sandbox stopped", "ok");
    } catch (error) {
      setStatusLine(`Stop sandbox failed: ${(error as Error).message}`, "error");
    }
  }, [apiRequest, backendReady, disconnectTerminal, sandboxRunning, sessionId, setStatusLine]);

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "JetBrains Mono, Menlo, Monaco, monospace",
      theme: {
        background: "#0f1218",
        foreground: "#e4e9f7",
        cursor: "#9cc2ff",
        selectionBackground: "#304a7a",
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    if (terminalRef.current) {
      terminal.open(terminalRef.current);
      fitAddon.fit();
    }

    terminal.onData((data) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "input", data }));
    });

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const onResize = () => {
      fitAddon.fit();
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: "resize",
          cols: terminal.cols,
          rows: terminal.rows,
        }),
      );
    };

    window.addEventListener("resize", onResize);

    return () => {
      disconnectTerminal();
      window.removeEventListener("resize", onResize);
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [disconnectTerminal]);

  useEffect(() => {
    const boot = async () => {
      try {
        const me = await apiRequest<{ user: AuthUser | null; backendReady?: boolean }>("/api/auth/me");
        setUser(me.user);
        setBackendReady(Boolean(me.backendReady));

        if (!me.backendReady) {
          setStatusLine("Cloudflare bindings are not detected in current runtime", "idle");
          return;
        }
      } catch {
        setBackendReady(false);
        return;
      }

      await refreshSandboxStatus();
      await refreshFiles();
    };

    void boot();
  }, [apiRequest, refreshFiles, refreshSandboxStatus]);

  useEffect(() => {
    if (!backendReady) return;
    void refreshFiles();
  }, [backendReady, currentPath, refreshFiles]);

  useEffect(() => {
    if (sandboxRunning && !terminalConnected) {
      connectTerminal();
    }
  }, [connectTerminal, sandboxRunning, terminalConnected]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Cloudflare Sandbox IDE</h1>
          <p>
            {user
              ? `${user.name} · ${user.org}`
              : backendReady
                ? "Development mode (auth disabled)"
                : "Local UI mode (no Cloudflare bindings)"}
          </p>
        </div>
        <div className="header-actions">
          <Button
            size="sm"
            variant={sandboxRunning ? "ghost" : "default"}
            disabled={!backendReady}
            onClick={startSandbox}
          >
            <Play size={14} />
            Start Sandbox
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!backendReady}
            onClick={stopSandbox}
          >
            <Square size={14} />
            Stop
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!backendReady}
            onClick={() => {
              void refreshSandboxStatus();
              void refreshFiles();
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              window.location.href = "/auth/logout";
            }}
          >
            <LogOut size={14} />
            Logout
          </Button>
        </div>
      </header>

      <main className="workbench">
        <aside className="panel panel-left">
          <div className="panel-title-row">
            <h2>Explorer</h2>
            <div className="panel-title-actions">
              <Button
                size="sm"
                variant="ghost"
                disabled={!backendReady}
                onClick={() => setNewFileOpen(true)}
              >
                <Plus size={12} />
                File
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!backendReady}
                onClick={() => setNewFolderOpen(true)}
              >
                <FolderPlus size={12} />
                Folder
              </Button>
            </div>
          </div>
          <div className="path-bar">{currentPath}</div>
          <div className="tree-list">
            {currentPath !== ROOT ? (
              <button
                type="button"
                className="tree-item"
                onClick={() => setCurrentPath(parentPath(currentPath))}
              >
                <ArrowUp size={14} />
                <span>..</span>
              </button>
            ) : null}

            {files.length === 0 ? <div className="empty">No files in this folder</div> : null}

            {files.map((entry) => (
              <div key={entry.path} className="tree-item-wrapper">
                <button
                  type="button"
                  className="tree-item"
                  onClick={() => {
                    if (entry.type === "directory") {
                      setCurrentPath(normalizePath(entry.path));
                      return;
                    }
                    void openFile(entry.path);
                  }}
                >
                  {entry.type === "directory" ? <Folder size={14} /> : <File size={14} />}
                  <span>{entry.name}</span>
                </button>
                <button
                  type="button"
                  className="tree-delete"
                  onClick={() => void deletePath(entry.path)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel panel-center">
          <div className="editor-tabs">
            {tabs.map((tab) => {
              const fileName = tab.path.split("/").filter(Boolean).pop() || tab.path;
              return (
                <button
                  key={tab.path}
                  className={`editor-tab ${tab.path === activePath ? "active" : ""}`}
                  type="button"
                  onClick={() => setActivePath(tab.path)}
                >
                  <span>{fileName}{tab.modified ? " *" : ""}</span>
                </button>
              );
            })}
          </div>

          {activeTab ? (
            <>
              <div className="editor-toolbar">
                <span>{activeTab.path} · {fileLanguageHint(activeTab.path)}</span>
                <div className="editor-toolbar-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void saveActiveFile()}
                  >
                    <Save size={12} />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => void runActiveFile()}
                  >
                    <Play size={12} />
                    Run
                  </Button>
                </div>
              </div>
              <textarea
                className="editor"
                spellCheck={false}
                value={activeTab.content}
                onChange={(event) => {
                  const value = event.target.value;
                  setTabs((prev) =>
                    prev.map((item) =>
                      item.path === activeTab.path
                        ? { ...item, content: value, modified: true }
                        : item,
                    ),
                  );
                }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    void saveActiveFile();
                  }
                }}
              />
            </>
          ) : (
            <div className="editor-empty">Open or create a file to start editing</div>
          )}
        </section>

        <aside className="panel panel-right">
          <div className="panel-title-row">
            <h2>Terminal</h2>
            <div className="terminal-state">
              <Plug size={13} />
              <span>{terminalConnected ? "Connected" : sandboxRunning ? "Offline" : "Stopped"}</span>
            </div>
          </div>
          <div className="terminal-actions">
            <Button
              size="sm"
              variant="secondary"
              disabled={!backendReady}
              onClick={connectTerminal}
            >
              <TerminalSquare size={12} />
              Reconnect
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!backendReady}
              onClick={() => xtermRef.current?.clear()}
            >
              Clear
            </Button>
          </div>
          <div ref={terminalRef} className="terminal-host" />
        </aside>
      </main>

      <footer className={`status ${statusKind}`}>
        <span>{status}</span>
        <span>{sessionId}</span>
      </footer>

      <Dialog open={newFileOpen} onOpenChange={setNewFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new file</DialogTitle>
            <DialogDescription>Files are stored in R2 and can be mounted into sandbox.</DialogDescription>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(event) => setNewFileName(event.target.value)}
            placeholder="example: app.py"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFileOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={() => void createFile()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new folder</DialogTitle>
            <DialogDescription>Folder paths are normalized before writing to R2.</DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="example: src"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={() => void createFolder()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
