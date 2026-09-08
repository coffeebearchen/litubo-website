import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Only needed so the small number of `tests/components/**` files (marked
  // `// @vitest-environment happy-dom`) can mount real `.vue` SFCs with
  // @vue/test-utils. Every other test file keeps using the default 'node'
  // environment below — this plugin/alias does not change that.
  // vitest bundles its own copy of Vite, whose plugin types don't
  // structurally match the top-level `vite` package's `Plugin` type that
  // `@vitejs/plugin-vue` is built against — a well-known duplicate-Vite-
  // instance type mismatch, not a real incompatibility (this plugin works
  // correctly with vitest at runtime; only `tsc`'s structural check fails).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [vue() as any],
  resolve: {
    alias: {
      // Mirrors Nuxt's own `~/` root alias, only so component test files can
      // mount real `.vue` files that use it — the app itself still resolves
      // `~/` via Nuxt at build time, unrelated to this test config.
      '~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
