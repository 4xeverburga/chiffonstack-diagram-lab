import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['test/**/*.test.ts'],
    // src/engine must stay pure TS with no DOM/browser globals (constitution
    // Principle IV). Vitest's environment defaults to 'node' and this repo
    // has no jsdom/happy-dom dependency installed, so every suite —
    // including test/engine/** — already runs without any DOM shims
    // available; that absence is itself the enforcement (research.md D8).
    // The oxlint no-restricted-imports override on src/engine/** is the
    // second, import-level mechanism.
  },
})
