#!/usr/bin/env node
/**
 * Copy built wasm/dist artifacts into examples/ for live-server demos.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function copyFiles(srcDir, destDir, names) {
  if (!existsSync(srcDir)) {
    return false
  }
  mkdirSync(destDir, { recursive: true })
  let copied = false
  for (const name of names) {
    const src = join(srcDir, name)
    if (!existsSync(src)) {
      continue
    }
    copyFileSync(src, join(destDir, name))
    copied = true
  }
  return copied
}

function copyDirFiles(srcDir, destDir) {
  if (!existsSync(srcDir)) {
    return false
  }
  mkdirSync(destDir, { recursive: true })
  for (const name of readdirSync(srcDir)) {
    copyFileSync(join(srcDir, name), join(destDir, name))
  }
  return true
}

function copyJsonViewer() {
  const src = join(root, 'node_modules/@andypf/json-viewer/dist/esm/index.js')
  const destDir = join(root, 'examples/vendor')
  if (!existsSync(src)) {
    return false
  }
  mkdirSync(destDir, { recursive: true })
  copyFileSync(src, join(destDir, 'andypf-json-viewer.js'))
  return true
}

const copiedJsonViewer = copyJsonViewer()
const copied32Bundle = copyFiles(join(root, 'dist'), join(root, 'examples/dist'), [
  'libredwg-web.js',
  'libredwg-web.umd.cjs'
])
const copied64Bundle = copyFiles(
  join(root, 'dist/memory64'),
  join(root, 'examples/dist/memory64'),
  ['libredwg-web.js', 'libredwg-web.umd.cjs']
)
const copied32Wasm = copyDirFiles(join(root, 'wasm'), join(root, 'examples/wasm'))
const copied64Wasm = copyDirFiles(join(root, 'wasm64'), join(root, 'examples/wasm64'))

console.log('sync-examples:', {
  jsonViewer: copiedJsonViewer,
  bundle32: copied32Bundle,
  bundle64: copied64Bundle,
  wasm32: copied32Wasm,
  wasm64: copied64Wasm
})

if (!copied32Bundle) {
  const examples32 = join(root, 'examples/dist/libredwg-web.js')
  if (existsSync(examples32)) {
    console.log(
      'sync-examples: 32-bit JS bundle not found in dist/ (skipped copy). ' +
        'examples/dist/ still has an older copy — run pnpm build:32 to refresh.'
    )
  } else {
    console.log(
      'sync-examples: 32-bit JS bundle missing. Run pnpm build:32 or pnpm build:all:32.'
    )
  }
}

if (!copied64Bundle) {
  console.log(
    'sync-examples: memory64 bundle missing in dist/memory64/ (run pnpm build:64 or pnpm build:all).'
  )
}
