import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

// node:sqlite is a new Node.js built-in that Vite doesn't know about yet.
// We intercept the import and serve a virtual CJS module that delegates to
// the real built-in via require(), which works in Node.js at runtime.
const nodeBuiltinFix: Plugin = {
  name: 'node-sqlite-external',
  enforce: 'pre',
  resolveId(id) {
    if (id === 'node:sqlite' || id === 'sqlite') {
      return '\0virtual:node-sqlite';
    }
  },
  load(id) {
    if (id === '\0virtual:node-sqlite') {
      return `module.exports = require('node:sqlite');`;
    }
  },
};

export default defineConfig({
  plugins: [nodeBuiltinFix],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
