FROM docker.io/cloudflare/sandbox:0.7.0

# 安装工具和 Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    socat \
    git \
    vim \
    nano \
    htop \
    tree \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 包
RUN pip3 install --no-cache-dir --break-system-packages \
    numpy pandas requests flask fastapi uvicorn websockets 2>/dev/null || \
    pip3 install --no-cache-dir numpy pandas requests flask fastapi uvicorn websockets

WORKDIR /workspace

# 创建 WebSocket -> PTY 桥接服务器 (纯 Python，无需编译)
RUN cat > /workspace/terminal-server.py << 'PYEOF'
#!/usr/bin/env python3
import asyncio
import websockets
import websockets.server
import pty
import os
import subprocess
import fcntl
import struct
import termios
import select
import sys

async def handle_client(websocket):
    print(f"[PTY] Client connected: {websocket.remote_address}")
    
    master_fd, slave_fd = pty.openpty()
    
    # 设置非阻塞
    fl = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
    
    # 设置终端大小
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
    
    # 启动 bash
    env = os.environ.copy()
    env['TERM'] = 'xterm-256color'
    env['PS1'] = '\\u@\\h:\\w\\$ '
    
    proc = subprocess.Popen(
        ['bash', '-l'],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        cwd='/workspace',
        env=env,
        preexec_fn=os.setsid
    )
    os.close(slave_fd)
    
    async def read_pty():
        try:
            while proc.poll() is None:
                ready, _, _ = select.select([master_fd], [], [], 0.05)
                if ready:
                    try:
                        data = os.read(master_fd, 4096)
                        if data:
                            await websocket.send(data.decode('utf-8', errors='replace'))
                    except OSError:
                        break
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            pass
    
    async def write_pty():
        try:
            async for message in websocket:
                try:
                    msg = __import__('json').loads(message)
                    if msg.get('type') == 'input':
                        os.write(master_fd, msg['data'].encode())
                    elif msg.get('type') == 'resize':
                        size = struct.pack('HHHH', msg.get('rows', 24), msg.get('cols', 80), 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, size)
                except:
                    os.write(master_fd, message.encode())
        except websockets.exceptions.ConnectionClosed:
            pass
    
    read_task = asyncio.create_task(read_pty())
    write_task = asyncio.create_task(write_pty())
    
    done, pending = await asyncio.wait([read_task, write_task], return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
    
    proc.terminate()
    try:
        proc.wait(timeout=1)
    except:
        proc.kill()
    os.close(master_fd)
    print(f"[PTY] Client disconnected")

async def main():
    print("[PTY] Starting WebSocket PTY server on ws://0.0.0.0:8080")
    async with websockets.server.serve(handle_client, "0.0.0.0", 9000, ping_interval=None):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
PYEOF

RUN chmod +x /workspace/terminal-server.py

EXPOSE 9000 8080 5173 3001 8000 5000
