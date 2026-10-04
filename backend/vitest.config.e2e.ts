import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    testTimeout: 15000,
    hookTimeout: 20000,
    env: {
      JWT_SECRET: 'test-jwt-secret-not-for-production',
    },
  },
});
