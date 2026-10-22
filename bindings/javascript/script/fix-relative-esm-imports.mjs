/**
 * Rewrite relative import/export specifiers to Node-native ESM form:
 *   ./foo      → ./foo.js
 *   ./foo/     → ./foo/index.js
 *
 * Usage:
 *   node script/fix-relative-esm-imports.mjs [--dry-run]
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const srcDir = join(pkgRoot, 'src')
const dryRun = process.argv.includes('--dry-run')

function walkTs(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walkTs(p, acc)
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) acc.push(p)
  }
  return acc
}

function resolveSpecifier(fromFile, spec) {
  if (!(spec.startsWith('./') || spec.startsWith('../'))) return null
  if (extname(spec) && !spec.endsWith('/')) return null

  const base = join(dirname(fromFile), spec.replace(/\/$/, ''))
  if (existsSync(`${base}.ts`) || existsSync(`${base}.tsx`) || existsSync(`${base}.js`)) {
    return spec.replace(/\/$/, '') + '.js'
  }
  if (
    existsSync(join(base, 'index.ts')) ||
    existsSync(join(base, 'index.tsx')) ||
    existsSync(join(base, 'index.js'))
  ) {
    return `${spec.replace(/\/$/, '')}/index.js`
  }
  throw new Error(
    `Cannot resolve relative specifier "${spec}" from ${relative(pkgRoot, fromFile)}`
  )
}

const SPEC_RE =
  /((?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g

let filesChanged = 0
let specsChanged = 0

for (const file of walkTs(srcDir)) {
  const source = readFileSync(file, 'utf8')
  let changed = 0
  const out = source.replace(SPEC_RE, (full, prefix, quote, spec) => {
    const next = resolveSpecifier(file, spec)
    if (!next || next === spec) return full
    changed++
    return `${prefix}${quote}${next}${quote}`
  })
  if (changed === 0) continue
  filesChanged++
  specsChanged += changed
  console.log(`${dryRun ? 'DRY ' : ''}${relative(pkgRoot, file)}: ${changed}`)
  if (!dryRun) writeFileSync(file, out)
}

console.log(
  `\n${dryRun ? 'Dry run — ' : ''}files=${filesChanged} specifiers=${specsChanged}`
)
