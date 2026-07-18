import fs from 'fs'
import path from 'path'

for (const dir of ['wasm', 'dist']) {
  fs.cpSync(dir, path.join('examples', dir), { recursive: true, force: true })
}
