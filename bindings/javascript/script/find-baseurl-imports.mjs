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

const hits = []
for (const f of walk('src')) {
  const c = readFileSync(f, 'utf8')
  for (const m of c.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const s = m[1]
    if (s.startsWith('.') || s.startsWith('node:') || s.startsWith('http')) continue
    // bare / baseUrl-style
    hits.push(`${f}: ${s}`)
  }
}
console.log('count', hits.length)
for (const h of hits) console.log(h)
