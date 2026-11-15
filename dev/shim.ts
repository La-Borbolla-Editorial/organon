// Sustituto del núcleo nativo para desarrollar en el navegador (`npm run dev`).
// Implementa los mismos comandos que src-tauri/src/lib.rs. La lista de
// proyectos recientes se guarda en .dev-state/.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
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
      const stamp = (file: string) => {
        if (!existsSync(file)) return null
        const st = statSync(file, { bigint: true })
        return `${st.mtimeNs}-${st.size}`
      }
      let current: string | null = null
      const project = () => {
        if (!current) throw new Error('No hay ningún proyecto abierto')
        return current
      }
      const safe = (name: string, ext: string) => {
        if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(name) || !name.endsWith(ext)) throw new Error(`Nombre de archivo no válido: ${name}`)
        return name
      }

      const draft = (name: string) => {
        if (!name.trim() || name.length > 120 || name.startsWith('.') || /[/\\:\0]/.test(name)) throw new Error(`Nombre de texto no válido: ${name}`)
        return join(project(), 'escritura', `${name}.md`)
      }

      const themesDir = join(stateDir, 'temas')
      mkdirSync(themesDir, { recursive: true })
      const settingsFile = join(stateDir, 'ajustes.json')

      const commands: Record<string, (args: any) => unknown> = {
        read_app_settings: () => (existsSync(settingsFile) ? readFileSync(settingsFile, 'utf8') : null),
        write_app_settings: ({ content }) => writeFileSync(settingsFile, content),
        list_themes: () => readdirSync(themesDir).filter((f) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.json$/.test(f)).sort().map((file) => ({ file, content: readFileSync(join(themesDir, file), 'utf8') })),
        write_theme: ({ file, content }) => writeFileSync(join(themesDir, safe(file, '.json')), content),
        delete_theme: ({ file }) => unlinkSync(join(themesDir, safe(file, '.json'))),
        reveal_themes_folder: () => null, // en el navegador no hay Finder
        list_drafts: () => {
          const dir = join(project(), 'escritura')
          if (!existsSync(dir)) return []
          return readdirSync(dir)
            .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
            .map((f) => ({ name: f.slice(0, -3), stamp: stamp(join(dir, f)) }))
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        },
        read_draft: ({ name }) => ({ content: readFileSync(draft(name), 'utf8'), stamp: stamp(draft(name)) }),
        write_draft: ({ name, content, expected, force }) => {
          const file = draft(name)
          if (!force && stamp(file) !== (expected ?? null)) throw new Error(`CONFLICT ${name}`)
          mkdirSync(join(project(), 'escritura'), { recursive: true })
          const tmp = join(project(), 'escritura', `.${name}.tmp`)
          writeFileSync(tmp, content)
          renameSync(tmp, file)
          return stamp(file)
        },
        rename_draft: ({ from, to }) => {
          if (existsSync(draft(to))) throw new Error(`Ya existe un texto llamado «${to}»`)
          renameSync(draft(from), draft(to))
        },
        trash_draft: ({ name }) => {
          const trash = join(project(), 'escritura', '.papelera')
          mkdirSync(trash, { recursive: true })
          renameSync(draft(name), join(trash, `${name} (${Math.floor(Date.now() / 1000)}).md`))
        },
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
        data_stamps: ({ names }: { names: string[] }) => Object.fromEntries(names.map((n) => [n, stamp(join(project(), safe(n, '.json')))])),
        write_data: ({ files, expected }: { files: { name: string; content: string }[]; expected: Record<string, string | null> }) => {
          const dir = project()
          for (const f of files) safe(f.name, '.json')
          for (const [name, seen] of Object.entries(expected)) if (stamp(join(dir, safe(name, '.json'))) !== seen) throw new Error(`CONFLICT ${name}`)
          for (const f of files) writeFileSync(join(dir, `${f.name}.tmp`), f.content)
          for (const f of files) renameSync(join(dir, `${f.name}.tmp`), join(dir, f.name))
          return Object.fromEntries(files.map((f) => [f.name, stamp(join(dir, f.name))]))
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
