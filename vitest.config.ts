import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [nodePolyfills()],
  test: {
    environment: 'node',
    include: ['services/__tests__/**/*.test.ts'],
  },
});
