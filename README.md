# Claude Bridge

A Microsoft Teams agent that forwards messages to the locally installed [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) and returns responses. This gives Teams users access to a full Claude Code session through a chat interface.

## Architecture

```
Teams (cloud) --> Bot Framework --> Dev Tunnel --> Local Machine --> Claude CLI
                                                       |
                                                  Dashboard
                                              (localhost:3981)
```

- **Inbound**: Messages arrive from Teams via Bot Framework, through a dev tunnel, to your local server
- **Processing**: The server spawns `claude --print` with the user's message piped via stdin
- **Outbound**: Claude's response is sent back through Bot Framework to Teams
- **Sessions**: Each Teams conversation maps to a persistent Claude session, so context is maintained across messages

## Features

- **Session continuity** -- follow-up messages in the same Teams conversation share Claude context
- **Response chunking** -- long responses are split at paragraph/line boundaries to fit Teams' ~28KB message limit
- **Live dashboard** -- real-time web UI showing all messages flowing through the bridge
- **Dev tunnel support** -- expose your local server to the internet via Azure Dev Tunnels

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [Azure Dev Tunnels CLI](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/) (for Teams integration)

### Install

```sh
git clone https://github.com/yemi33/claude-bridge.git
cd claude-bridge
npm install
```

### Run locally (devtools only)

```sh
npm run dev
```

Open http://localhost:3979/devtools to chat with Claude through the local test UI.

### Run with Teams

1. Create a dev tunnel:
   ```sh
   devtunnel user login -e -w
   devtunnel create claude-bridge --allow-anonymous
   devtunnel port create -p 3978
   ```

2. Provision the Teams app (requires [Teams Toolkit CLI](https://www.npmjs.com/package/@microsoft/teamsapp-cli)):
   ```sh
   npx @microsoft/teamsapp-cli provision --env local
   ```

3. Start everything:
   ```bat
   start.bat
   ```

4. Sideload or publish the app package from `appPackage/build/` in Teams.

### Dashboard

The live gateway dashboard runs at http://localhost:3981/dashboard and shows:

- Inbound messages from Teams users
- Outbound responses from Claude
- Errors and timing information
- Real-time updates via Server-Sent Events

## Project Structure

```
src/
  index.ts           # Main entry -- Teams message handler + dashboard startup
  claude-runner.ts   # Spawns claude CLI, manages session IDs
  session-map.ts     # Conversation ID -> deterministic UUID (SHA-256)
  chunker.ts         # Splits long responses for Teams message limit
  dashboard.ts       # Live gateway dashboard (HTML + SSE)
appPackage/
  manifest.json      # Teams app manifest
env/
  .env.local         # Bot ID, tunnel endpoint, etc.
start.bat            # One-click startup script
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3978` | Teams bot server port |
| `DASHBOARD_PORT` | `3981` | Dashboard UI port |
| `CLAUDE_TIMEOUT_MS` | `120000` | Claude CLI timeout in milliseconds |

## Known Limitations

- The backend must be running on your local machine for the Teams app to respond
- Dev tunnel URLs expire after 30 days and need to be recreated
- Bot Framework authentication requires an Entra app registration with valid credentials (password or certificate). Some corporate tenants restrict credential creation on app registrations.

## License

MIT
