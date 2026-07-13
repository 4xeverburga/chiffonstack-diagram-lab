import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Public-demo posture (assessment §3 B1): ship NO source maps so the
    // minified bundle can't be reconstructed back into readable UI source.
    // Vite already omits them by default; we pin it explicitly as a guard so
    // a future `sourcemap: true` for debugging can't silently ship to prod.
    // Honest threat model: this only deters casual copying — the real IP
    // protection is the BSL 1.1 license (the engine is already open, MIT).
    sourcemap: false,
  },
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
