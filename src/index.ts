import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';

import { conversationToSessionId } from './session-map';
import { runClaude } from './claude-runner';
import { chunkResponse } from './chunker';
import { addLog, startDashboard } from './dashboard';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

// Teams SDK message handler (devtools / Bot Framework)
app.on('message', async ({ send, activity }) => {
  const userText = activity.text?.trim();
  if (!userText) return;

  const conversationId = activity.conversation?.id ?? 'default';
  const sessionId = conversationToSessionId(conversationId);
  const user = activity.from?.name ?? activity.from?.id ?? 'unknown';

  // Log inbound FIRST, before any send() calls that might throw 401
  addLog({
    direction: 'inbound',
    user,
    conversationId,
    sessionId,
    message: userText,
  });

  // Typing indicator — ignore auth failures
  try { await send({ type: 'typing' }); } catch {}

  const start = Date.now();

  try {
    const response = await runClaude(userText, sessionId);
    const durationMs = Date.now() - start;
    const chunks = chunkResponse(response);

    addLog({
      direction: 'outbound',
      user: 'Claude',
      conversationId,
      sessionId,
      message: response.length > 500 ? response.slice(0, 500) + '...' : response,
      durationMs,
    });

    for (const chunk of chunks) {
      try { await send(chunk); } catch {}
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);

    addLog({
      direction: 'error',
      user: 'system',
      conversationId,
      sessionId,
      message,
      durationMs,
    });

    try { await send(`Sorry, something went wrong:\n\n\`\`\`\n${message}\n\`\`\``); } catch {}
  }
});

// Start dashboard on separate port
startDashboard(Number(process.env.DASHBOARD_PORT || 3981));

app.start(process.env.PORT || 3978).catch(console.error);
