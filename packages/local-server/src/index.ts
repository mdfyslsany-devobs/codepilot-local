import { createServer } from './server.js';
import { isMainModule } from './is-main.js';
import { DEFAULT_SERVER_PORT, DEFAULT_SERVER_HOST } from '@codepilot/shared';
import { join } from 'node:path';
import { homedir } from 'node:os';

export * from './server.js';
export * from './authentication/auth-manager.js';
export * from './websocket/broadcaster.js';
export * from './is-main.js';

async function main() {
  const dataDir = process.env.CODEPILOT_DATA_DIR || join(homedir(), '.codepilot-local');
  const dbPath = process.env.CODEPILOT_DB_PATH || join(dataDir, 'codepilot.sqlite');
  const port = parseInt(process.env.CODEPILOT_PORT || `${DEFAULT_SERVER_PORT}`, 10);
  const host = DEFAULT_SERVER_HOST; // Always 127.0.0.1

  const { server, authManager } = await createServer({
    dbPath,
    dataDir,
    port,
    host
  });

  try {
    const address = await server.listen({ port, host });
    console.log(`[CodePilot Local Server] running at ${address}`);
    console.log(`[CodePilot Local Server] Data directory: ${dataDir}`);
    console.log(`[CodePilot Local Server] SQLite database: ${dbPath}`);
    console.log(`[CodePilot Local Server] Auth token active (${authManager.getToken().substring(0, 8)}...)`);
  } catch (err) {
    console.error('[CodePilot Local Server] Failed to start:', err);
    process.exit(1);
  }
}

// If executed directly
if (isMainModule(import.meta.url, process.argv[1])) {
  main();
}
