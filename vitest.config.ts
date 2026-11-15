import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@codepilot/shared': resolve(__dirname, './packages/shared/src/index.ts'),
      '@codepilot/database': resolve(__dirname, './packages/database/src/index.ts'),
      '@codepilot/local-server': resolve(__dirname, './packages/local-server/src/index.ts'),
      '@codepilot/file-engine': resolve(__dirname, './packages/file-engine/src/index.ts')
    }
  }
});
