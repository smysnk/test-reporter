import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./env.test.js'],
    watch: false,
  },
});
