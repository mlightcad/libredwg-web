import type { MainModule } from '../wasm/libredwg-web'
import createModule from '../wasm/libredwg-web.js'
import { DwgThumbnailImageType, LibreDwgCore } from './libredwg-core'

export { createModule }
export { DwgThumbnailImageType }
export type { DwgThumbnail } from './libredwg-core'

export type LibreDwgEx = LibreDwg & MainModule

export class LibreDwg extends LibreDwgCore {
  static instance: LibreDwgEx

  static createByWasmInstance(wasmInstance: MainModule): LibreDwgEx {
    return this.instance == null
      ? (new LibreDwg(wasmInstance) as LibreDwgEx)
      : this.instance
  }

  static async create(filepath?: string): Promise<LibreDwgEx> {
    const wasmInstance =
      filepath == null
        ? await createModule()
        : await createModule({
            locateFile: (filename: string) => {
              return `${filepath}/${filename}`
            }
          })
    return this.createByWasmInstance(wasmInstance)
  }
}
