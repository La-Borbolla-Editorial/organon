// Sustituto del núcleo nativo para desarrollar en el navegador (`npm run dev`).
// Implementa los mismos comandos que src-tauri/src/lib.rs. La lista de
// proyectos recientes se guarda en .dev-state/.
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { basename, isAbsolute, join, resolve } from 'node:path'
import type { Plugin } from 'vite'

function body(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => ok(Buffer.concat(chunks)))
    req.on('error', fail)
  })
}

export function devBackend(): Plugin {
  return {
    name: 'organon-dev-backend',
    configureServer(server) {
      const stateDir = resolve('.dev-state')
      mkdirSync(stateDir, { recursive: true })
      const recentsFile = join(stateDir, 'recientes.json')
      const readRecents = (): string[] => (existsSync(recentsFile) ? JSON.parse(readFileSync(recentsFile, 'utf8')) : [])
      const writeRecents = (list: string[]) => writeFileSync(recentsFile, JSON.stringify(list, null, 2))
      const describe = (path: string) => ({ path, name: basename(path), exists: existsSync(path) && statSync(path).isDirectory() })
      let current: string | null = null
      const project = () => {
        if (!current) throw new Error('No hay ningún proyecto abierto')
        return current
      }
      const safe = (name: string, ext: string) => {
        if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(name) || !name.endsWith(ext)) throw new Error(`Nombre de archivo no válido: ${name}`)
        return name
      }

      const commands: Record<string, (args: any) => unknown> = {
        recent_projects: () => readRecents().map(describe),
        forget_project: ({ path }) => writeRecents(readRecents().filter((p) => p !== path)),
        current_project: () => (current ? describe(current) : null),
        pick_folder: () => null, // en el navegador la ruta se escribe a mano
        open_project: ({ path }) => {
          if (!isAbsolute(path)) throw new Error('La ruta del proyecto debe ser absoluta')
          mkdirSync(join(path, 'pdfs'), { recursive: true })
          writeRecents([path, ...readRecents().filter((p) => p !== path)].slice(0, 15))
          current = path
          return describe(path)
        },
        close_project: () => { current = null },
        read_data: ({ name }) => {
          const file = join(project(), safe(name, '.json'))
          return existsSync(file) ? readFileSync(file, 'utf8') : null
        },
        write_data: ({ files }: { files: { name: string; content: string }[] }) => {
          const dir = project()
          for (const f of files) safe(f.name, '.json')
          for (const f of files) writeFileSync(join(dir, `${f.name}.tmp`), f.content)
          for (const f of files) renameSync(join(dir, `${f.name}.tmp`), join(dir, f.name))
        },
      }

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x')
        try {
          if (url.pathname.startsWith('/__dev/fixture/')) {
            const name = decodeURIComponent(url.pathname.slice('/__dev/fixture/'.length))
            if (name.includes('/') || name.includes('..')) throw new Error('ruta no válida')
            return res.end(readFileSync(join('fixtures', name)))
          }
          if (!url.pathname.startsWith('/__dev/invoke/')) return next()
          const cmd = url.pathname.slice('/__dev/invoke/'.length)
          const raw = await body(req)
          if (cmd === 'save_pdf') {
            writeFileSync(join(project(), 'pdfs', safe(String(req.headers['x-name']), '.pdf')), raw)
            return res.end('null')
          }
          const args = raw.length ? JSON.parse(raw.toString('utf8')) : {}
          if (cmd === 'read_pdf') return res.end(readFileSync(join(project(), 'pdfs', safe(args.name, '.pdf'))))
          if (!commands[cmd]) throw new Error(`Comando desconocido: ${cmd}`)
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(commands[cmd](args) ?? null))
        } catch (e) {
          res.statusCode = 500
          res.end(e instanceof Error ? e.message : String(e))
        }
      })
    },
  }
}
