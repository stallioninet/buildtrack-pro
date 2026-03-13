import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    hookTimeout: 15000,
    env: {
      NODE_ENV: 'test',
    },
    sequence: {
      concurrent: false,
    },
  },
});
