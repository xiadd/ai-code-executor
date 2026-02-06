FROM docker.io/cloudflare/sandbox:0.7.0

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    vim \
    nano \
    htop \
    tree \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages \
    numpy pandas requests flask fastapi uvicorn websockets 2>/dev/null || \
    pip3 install --no-cache-dir numpy pandas requests flask fastapi uvicorn websockets

WORKDIR /workspace

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


async def handle_client(websocket):
    master_fd, slave_fd = pty.openpty()

    fl = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))

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
                except Exception:
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
    except Exception:
        proc.kill()
    os.close(master_fd)


async def main():
    async with websockets.server.serve(handle_client, "0.0.0.0", 9000, ping_interval=None):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
PYEOF

RUN chmod +x /workspace/terminal-server.py

EXPOSE 9000
