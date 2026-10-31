#!/usr/bin/env node
/**
 * Link libredwg object files into libredwg-web.{js,wasm,d.ts}.
 *
 * Workarounds for Emscripten 4.x + large LibreDWG:
 * 1. --emit-tsd runs Node on the pre-Binaryen wasm. Huge decode/dxf
 *    functions exceed V8's local limit (~50k). Wrap node so tsgen.wasm
 *    is coalesced with wasm-opt before instantiate.
 * 2. Global TypeScript 6+ errors on emcc's `tsc --outFile`. Prefer this
 *    package's TypeScript 5.x on PATH when present.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(pkgRoot, '../..')
const buildDir = path.join(repoRoot, 'build-wasm')

function which(cmd) {
  const r = spawnSync('which', [cmd], { encoding: 'utf8' })
  if (r.status !== 0) return null
  return r.stdout.trim().split('\n')[0] || null
}

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

if (!fs.existsSync(buildDir)) {
  fail(`Missing ${buildDir}. Run: pnpm build:prepare && pnpm build:obj`)
}

const emcc = which('emcc')
if (!emcc) fail('emcc not found. Source emsdk_env.sh first.')

// emcc lives at <emsdk>/upstream/emscripten/emcc; wasm-opt at <emsdk>/upstream/bin/
const emccDir = path.dirname(path.resolve(emcc))
const wasmOptCandidates = [
  which('wasm-opt'),
  path.join(emccDir, '../bin/wasm-opt'),
  process.env.EMSDK
    ? path.join(process.env.EMSDK, 'upstream/bin/wasm-opt')
    : null
].filter(Boolean)
const wasmOpt = wasmOptCandidates.find((p) => fs.existsSync(p))
if (!wasmOpt) {
  fail(`wasm-opt not found (tried ${wasmOptCandidates.join(', ')})`)
}

const realNode = process.execPath
const embindGlob = path.join(repoRoot, 'bindings/javascript/embind')
const embindFiles = fs
  .readdirSync(embindGlob)
  .filter((f) => f.endsWith('.cpp'))
  .map((f) => path.join(embindGlob, f))
  .sort()

const objFiles = fs
  .readdirSync(path.join(buildDir, 'src'))
  .filter((f) => f.endsWith('.o'))
  .map((f) => path.join(buildDir, 'src', f))
  .sort()

if (!embindFiles.length) fail('No embind *.cpp files found')
if (!objFiles.length) fail('No src/*.o files found. Run: pnpm build:obj')

const wrapDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libredwg-emcc-node-'))
const wrapNode = path.join(wrapDir, 'node')
const wrapScript = `#!/bin/bash
REAL_NODE=${JSON.stringify(realNode)}
WASM_OPT=${JSON.stringify(wasmOpt)}
for arg in "$@"; do
  case "$arg" in
    *tsgen.js)
      dir=$(dirname "$arg")
      if [ -f "$dir/tsgen.wasm" ]; then
        echo "[build-wasm] coalescing locals in $dir/tsgen.wasm" >&2
        tmp="$dir/tsgen.coalesced.wasm"
        "$WASM_OPT" -O1 --coalesce-locals --simplify-locals \\
          "$dir/tsgen.wasm" -o "$tmp" || exit 1
        mv -f "$tmp" "$dir/tsgen.wasm"
      fi
      ;;
  esac
done
exec "$REAL_NODE" "$@"
`
fs.writeFileSync(wrapNode, wrapScript, { mode: 0o755 })

const localBin = path.join(pkgRoot, 'node_modules', '.bin')
const env = {
  ...process.env,
  PATH: [localBin, wrapDir, process.env.PATH || ''].join(path.delimiter),
  EM_NODE_JS: wrapNode
}

const outJs = path.join(buildDir, 'libredwg-web.js')
const args = [
  ...embindFiles,
  ...objFiles,
  '-O2',
  '-lembind',
  '-std=c++17',
  `-I${path.join(buildDir, 'src')}`,
  `-I${path.join(repoRoot, 'src')}`,
  `-I${path.join(repoRoot, 'include')}`,
  '-o',
  outJs,
  '-s',
  'ALLOW_MEMORY_GROWTH=1',
  '-s',
  'INITIAL_MEMORY=1GB',
  '-s',
  'MAXIMUM_MEMORY=4GB',
  '-s',
  'MALLOC=mimalloc',
  '-s',
  'EXPORT_ES6=1',
  '-s',
  'MODULARIZE=1',
  '-s',
  'EXPORT_NAME=createModule',
  '-sEXPORTED_RUNTIME_METHODS=FS,ENV,ccall,cwrap,UTF8ToString,stringToNewUTF8,setValue',
  '--emit-tsd',
  path.join(buildDir, 'libredwg-web.d.ts')
]

console.log('emcc', args.filter((a) => !a.endsWith('.o') && !a.endsWith('.cpp')).join(' '))
const result = spawnSync(emcc, args, {
  cwd: buildDir,
  env,
  stdio: 'inherit'
})

try {
  fs.rmSync(wrapDir, { recursive: true, force: true })
} catch {
  // ignore
}

process.exit(result.status ?? 1)
