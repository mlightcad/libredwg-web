# libredwg-web

This is a DWG/DXF JavaScript parser based on libredwg. It can be used in browser and Node.js environments. 

- [Live demo](https://mlightcad.github.io/libredwg-web/)
- [API docs](https://mlightcad.github.io/libredwg-web/docs/)

## Build WebAssembly

Download and install emscripten according to [this doc](https://emscripten.org/docs/getting_started/downloads.html). Please make sure the following command is executed to activate `PATH` and other environment variables in the current terminal before building web assembly.

Download and install [automake](https://www.gnu.org/software/automake/)

Download and install [pnpm](https://pnpm.io)

All can also be installed using homebrew:

```bash
brew install emscripten
brew install automake
brew install pnpm
```

```bash
# Activate PATH and other environment variables for emscripten in the current terminal if needed
source ./emsdk_env.sh

# run autogen
./autogen.sh

# change directory
cd bindings/javascript

# Install npm dependencies to build JavaScript bindings for libredwg
pnpm install

# One-shot: build wasm32 + wasm64 and both JavaScript bundles
pnpm build:all
```

Script naming: `:32` = wasm32 only, `:64` = wasm64 only, no suffix = both.
For example, `pnpm build:wasm` runs `build:wasm:32` and `build:wasm:64`.

To build **wasm32 only** step by step:

```bash
pnpm build:prepare:32
pnpm build:obj:32
pnpm build:wasm:32
pnpm copy:32
pnpm build:32
```

Or in one command: `pnpm build:all:32`

In order to reduce the size of wasm file, the following functionalities are not included by default when building web assembly.

- write dwg file
- read/write dxf file
- import/export json file

If you want those functionalities, just modify command `build:prepare:32` defined in [package.json](./package.json) and remove the following options.

- disable-write
- disable-json
- disable-dxf

### Memory64 build (large DWG files, experimental)

Standard wasm32 is limited to 4 GB address space. For very large drawings
that need more memory while decoding, build the Memory64 variant and use the
`@mlightcad/libredwg-web/memory64` entry point (requires a browser with
[WASM Memory64](https://github.com/WebAssembly/memory64) support, e.g. Chrome 133+).

```bash
# wasm64 only (requires build:prepare:32 / build-wasm to exist first):
pnpm build:all:64
```

Both wasm32 and wasm64: `pnpm build:all`

## Usage

There are two approaches to use this package. No matter which approach to use, please do remember copying wasm file (libredwg.wasm) to the same folder as your JavaScript bundle file when deploying your application. 

```bash
npm install @mlightcad/libredwg-web
```

### Use Raw Web Assembly

The raw web assembly module (wasm file and JavaScript glue code file) is stored in folder [wasm](./wasm/). 

```javascript
import { createModule } from "@mlightcad/libredwg-web/wasm/libredwg-web.js";

// Create libredwg module
const libredwg = await createModule();

// Store file content to one temporary file and read it
const fileName = 'tmp.dwg';
libredwg.FS.writeFile(
  fileName,
  new Uint8Array(fileContent)
);
const result = libredwg.dwg_read_file(fileName);
if (result.error != 0) {
  console.log('Failed to open dwg file with error code: ', result.error);
}
libredwg.FS.unlink(fileName);

// Get pointer to Dwg_Data
const data = result.data;
```

### Use Web Assembly Wrapper

Web assembly wrapper is stored in folder [dist](./dist/). It provides one class `LibreDwg` to wrap the web assembly. This class provides

- Method to convert dwg data to [DwgDatabase](https://mlightcad.github.io/libredwg-web/docs/interfaces/database_database.DwgDatabase.html) instance with the strong type definition so that it is easy to use.
- More methods that the raw web assembly API doesn't provide. 

```typescript
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
const libredwg = await LibreDwg.create();
const dwg = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DWG);
const db = this.libredwg.convert(dwg);

// Affter conversion, 'dwg' isn't needed any more. So you can call
// function 'dwg_free' to free its memory.
this.libredwg.dwg_free(db);
```

### Memory64 entry (large files)

Same API as above, but loads the 64-bit wasm module from `wasm64/`:

```typescript
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web/memory64'

const libredwg = await LibreDwg.create(
  './node_modules/@mlightcad/libredwg-web/wasm64/'
)
const dwg = libredwg.dwg_read_data(fileContent, Dwg_File_Type.DWG)
const db = libredwg.convert(dwg)
libredwg.dwg_free(dwg)
```

### Usage with node.js

```typescript
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web'
// manually reference the wasm directory
const libredwg = await LibreDwg.create(
  './node_modules/@mlightcad/libredwg-web/wasm/'
)
…
```

## Interfaces

There are two kinds of interfaces defined to access dwg/dxf drawing data. 

### Interfaces with prifix 'Dwg'

Those interfaces are much more easier to use with better data structure. It is quite similar to interfaces defined in project [@mlightcad/dxf-json](https://github.com/mlightcad/dxf-json). Those interfaces describe most of commonly used objects in the dwg/dxf drawing.

### Interfaces with prefix 'Dwg_'

Those interfaces are JavaScript version of `structs` defined in libredwg C++ code. Only a few `structs` have the correponding JavaScript interface. Most of them are defined to make it easier to convert libredwg data structure to [DwgDatabase](https://mlightcad.github.io/libredwg-web/docs/interfaces/database_database.DwgDatabase.html).

So it is recommend to use interfaces with prefix 'Dwg'.

## Demo App

One demo app is provided in folder [examples](./examples/). You can run the following command to launch it.

```javascript
pnpm demo
```

Use the **WASM mode** dropdown on the index page (or each example) to switch between 32-bit (`wasm/`) and 64-bit Memory64 (`wasm64/`). The choice is stored in `localStorage` and passed via `?wasm=32` or `?wasm=64` in the URL.