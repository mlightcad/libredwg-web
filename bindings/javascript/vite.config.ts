import { defineConfig } from 'vite'

const wasmExternals = [
  'module',
  'node:module',
  '../wasm/libredwg-web.js',
  '../../wasm64/libredwg-web.js'
]

export default defineConfig(({ mode }) => {
  const memory64 = mode === 'memory64'

  return {
    build: {
      assetsInlineLimit: 0,
      outDir: 'dist',
      emptyOutDir: !memory64,
      minify: false,
      lib: {
        entry: memory64 ? 'src/memory64/index.ts' : 'src/index.ts',
        name: 'libredwg-web',
        fileName: memory64 ? 'memory64/libredwg-web' : 'libredwg-web',
        formats: ['es', 'umd']
      },
      rollupOptions: {
        external: wasmExternals
      }
    }
  }
})
