import { defineConfig } from 'vitest/config';
import path from 'node:path';

const mockWorkersPath = path.resolve(process.cwd(), 'tests/integration/mock-workers.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@batalha/protocol': path.resolve(process.cwd(), 'packages/protocol/src/index.ts'),
      '@batalha/game': path.resolve(process.cwd(), 'packages/game/src/index.ts'),
      '@batalha/content': path.resolve(process.cwd(), 'packages/content/src/index.ts'),
      '@batalha/ui': path.resolve(process.cwd(), 'packages/ui/src/index.ts'),
    },
  },
  plugins: [
    {
      name: 'mock-cloudflare-workers',
      resolveId(id) {
        if (id === 'cloudflare:workers') {
          return mockWorkersPath;
        }
      },
    },
  ],
  test: {
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
  },
});
