import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const pdfWasmDirectory = join(dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'wasm')

function pdfWasmAssets(): Plugin {
  return {
    name: 'pdf-wasm-assets',
    configureServer(server) {
      server.middlewares.use(`${server.config.base}pdfjs-wasm/`, (request, response, next) => {
        const name = new URL(request.url ?? '', 'http://localhost').pathname.slice(1)
        if (!/^[\w-]+\.(wasm|js)$/.test(name)) {
          response.writeHead(404).end()
          return
        }
        void readFile(join(pdfWasmDirectory, name)).then((content) => {
          response.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
          response.end(content)
        }).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') response.writeHead(404).end()
          else next(error)
        })
      })
    },
    async generateBundle() {
      for (const name of await readdir(pdfWasmDirectory)) {
        this.emitFile({ type: 'asset', fileName: `pdfjs-wasm/${name}`, source: await readFile(join(pdfWasmDirectory, name)) })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), pdfWasmAssets()],
})
