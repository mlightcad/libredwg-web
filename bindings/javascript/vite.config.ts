import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist',
    minify: false,
    lib: {
      entry: 'src/index.ts',
      name: 'libredwg-web',
      fileName: 'libredwg-web'
    },
    rollupOptions: {
      // Keep the emscripten glue as a separate module so Node.js can use
      // createRequire from node:module instead of Vite's browser stub.
      external: ['module', 'node:module', '../wasm/libredwg-web.js']
    }
  }
})
