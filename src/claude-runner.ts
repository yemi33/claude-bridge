import { spawn } from 'node:child_process';

const TIMEOUT_MS = parseInt(process.env.CLAUDE_TIMEOUT_MS ?? '120000', 10);
const MAX_BUFFER = 5 * 1024 * 1024; // 5 MB

// Maps our conversation session key -> Claude's actual session ID
const sessionMap = new Map<string, string>();

/**
 * Runs `claude --print` with the prompt piped via stdin.
 * First call uses JSON output to capture Claude's session ID.
 * Follow-up calls use `--resume <real-session-id>` for continuity.
 */
export function runClaude(prompt: string, sessionKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32' ? 'claude.cmd' : 'claude';
    const realSessionId = sessionMap.get(sessionKey);

    const args = ['--print'];

    if (realSessionId) {
      // Follow-up: resume with Claude's real session ID, text output
      args.push('--output-format', 'text');
      args.push('--resume', realSessionId);
    } else {
      // First message: use JSON output so we can capture session_id
      args.push('--output-format', 'json');
    }

    // Strip CLAUDECODE env var to avoid nested-session guard
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const child = spawn(cmd, args, {
      env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // Pipe the prompt via stdin to avoid shell escaping issues
    child.stdin.write(prompt);
    child.stdin.end();

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > MAX_BUFFER) {
        child.kill();
        reject(new Error('Response exceeded maximum buffer size'));
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude timed out after ${TIMEOUT_MS / 1000}s`));
    }, TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}\n${stderr}`));
        return;
      }

      const raw = stdout.trim();
      if (!raw) {
        resolve('(Claude returned an empty response)');
        return;
      }

      if (realSessionId) {
        // Text mode — return as-is
        resolve(raw);
      } else {
        // JSON mode — parse to extract session_id and result text
        try {
          const json = JSON.parse(raw);
          if (json.session_id) {
            sessionMap.set(sessionKey, json.session_id);
          }
          const text = json.result ?? json.text ?? raw;
          resolve(typeof text === 'string' ? text : JSON.stringify(text));
        } catch {
          // JSON parse failed — return raw output, no session continuity
          resolve(raw);
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start Claude: ${err.message}`));
    });
  });
}
