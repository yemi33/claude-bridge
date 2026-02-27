import http from 'node:http';

export interface LogEntry {
  id: number;
  timestamp: string;
  direction: 'inbound' | 'outbound' | 'error';
  user: string;
  conversationId: string;
  sessionId: string;
  message: string;
  durationMs?: number;
}

const logs: LogEntry[] = [];
let nextId = 1;

export function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const log: LogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  logs.push(log);
  // Keep last 200 entries
  if (logs.length > 200) logs.shift();
  broadcastSSE(log);
  return log;
}

export function getLogs(): LogEntry[] {
  return logs;
}

// SSE clients for live updates
const sseClients = new Set<http.ServerResponse>();

function broadcastSSE(entry: LogEntry) {
  const data = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of sseClients) {
    client.write(data);
  }
}

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Claude Bridge Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: 'Segoe UI', system-ui, sans-serif; }
    header { background: #16213e; padding: 16px 24px; border-bottom: 1px solid #0f3460; display: flex; align-items: center; gap: 16px; }
    header h1 { font-size: 18px; font-weight: 600; }
    .status { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #8892b0; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #00d26a; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .stats { margin-left: auto; display: flex; gap: 24px; font-size: 13px; }
    .stat-value { font-weight: 700; color: #e94560; font-size: 18px; }
    .stat-label { color: #8892b0; }
    main { padding: 16px 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; color: #8892b0; font-weight: 500; border-bottom: 1px solid #0f3460; position: sticky; top: 0; background: #1a1a2e; }
    td { padding: 8px 12px; border-bottom: 1px solid #16213e; vertical-align: top; max-width: 500px; }
    tr:hover { background: #16213e; }
    .dir-inbound { color: #00d26a; }
    .dir-outbound { color: #533483; }
    .dir-error { color: #e94560; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-inbound { background: rgba(0,210,106,0.15); color: #00d26a; }
    .badge-outbound { background: rgba(83,52,131,0.15); color: #a78bfa; }
    .badge-error { background: rgba(233,69,96,0.15); color: #e94560; }
    .msg { white-space: pre-wrap; word-break: break-word; font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 12px; max-height: 120px; overflow-y: auto; }
    .time { color: #8892b0; white-space: nowrap; }
    .user { color: #e94560; font-weight: 500; }
    .duration { color: #8892b0; font-size: 11px; }
    .empty { text-align: center; padding: 60px; color: #8892b0; }
    .empty p { margin-top: 8px; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>Claude Bridge Gateway</h1>
    <div class="status"><div class="dot"></div> Live</div>
    <div class="stats">
      <div><div class="stat-value" id="total">0</div><div class="stat-label">Messages</div></div>
      <div><div class="stat-value" id="errors">0</div><div class="stat-label">Errors</div></div>
    </div>
  </header>
  <main>
    <table>
      <thead>
        <tr>
          <th style="width:140px">Time</th>
          <th style="width:80px">Type</th>
          <th style="width:120px">User</th>
          <th>Message</th>
          <th style="width:80px">Duration</th>
        </tr>
      </thead>
      <tbody id="logs"></tbody>
    </table>
    <div class="empty" id="empty">
      <div style="font-size:32px">Waiting for messages...</div>
      <p>Send a message to the Claude Bridge bot in Teams</p>
    </div>
  </main>
  <script>
    const tbody = document.getElementById('logs');
    const emptyEl = document.getElementById('empty');
    const totalEl = document.getElementById('total');
    const errorsEl = document.getElementById('errors');
    let total = 0, errors = 0;

    function addRow(entry) {
      emptyEl.style.display = 'none';
      total++;
      if (entry.direction === 'error') errors++;
      totalEl.textContent = total;
      errorsEl.textContent = errors;

      const tr = document.createElement('tr');
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const badgeClass = 'badge-' + entry.direction;
      const label = entry.direction === 'inbound' ? 'FROM TEAMS' : entry.direction === 'outbound' ? 'TO TEAMS' : 'ERROR';
      const duration = entry.durationMs ? (entry.durationMs / 1000).toFixed(1) + 's' : '';
      tr.innerHTML =
        '<td class="time">' + time + '</td>' +
        '<td><span class="badge ' + badgeClass + '">' + label + '</span></td>' +
        '<td class="user">' + escapeHtml(entry.user) + '</td>' +
        '<td class="msg">' + escapeHtml(entry.message) + '</td>' +
        '<td class="duration">' + duration + '</td>';
      tbody.prepend(tr);

      // Keep max 200 rows
      while (tbody.children.length > 200) tbody.removeChild(tbody.lastChild);
    }

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s || '';
      return d.innerHTML;
    }

    // Load existing logs
    fetch('/dashboard/api/logs').then(r => r.json()).then(entries => {
      entries.forEach(addRow);
    });

    // Live updates via SSE
    const es = new EventSource('/dashboard/api/stream');
    es.onmessage = (e) => addRow(JSON.parse(e.data));
  </script>
</body>
</html>`;

export function startDashboard(port: number) {
  const server = http.createServer((req, res) => {
    // Ignore favicon
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (req.url === '/dashboard' || req.url === '/dashboard/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(DASHBOARD_HTML);
      return;
    }

    if (req.url === '/dashboard/api/logs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getLogs()));
      return;
    }

    if (req.url === '/dashboard/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Dashboard port ${port} in use, retrying...`);
      setTimeout(() => { server.close(); server.listen(port); }, 1000);
    }
  });

  server.listen(port, () => {
    console.log(`Dashboard available at http://localhost:${port}/dashboard`);
  });
}
