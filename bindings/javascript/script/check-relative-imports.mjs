import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(d, a = []) {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p, a)
    else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) a.push(p)
  }
  return a
}

const bad = []
for (const f of walk('src')) {
  const c = readFileSync(f, 'utf8')
  for (const m of c.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const s = m[1]
    if (!/\.(js|json|css|wasm)(\?|$)/.test(s)) bad.push(`${f}: ${s}`)
  }
}
console.log('remaining extensionless:', bad.length)
for (const line of bad.slice(0, 30)) console.log(line)
