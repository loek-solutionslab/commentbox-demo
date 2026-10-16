// Serves the static demo site on http://localhost:3000. No dependencies.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const port = Number(process.env.SITE_PORT ?? 3000)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}
// Only the site itself is public, not the rest of the repo.
const allowed = new Set(['.html', '.css', '.svg', '.png', '.jpg', '.ico'])

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (path.endsWith('/')) path += 'index.html'
  const file = normalize(join(root, path))
  if (!file.startsWith(root) || !allowed.has(extname(file)) || /[\\/](node_modules|data|commentbox|agent)[\\/]/.test(file.slice(root.length))) {
    res.writeHead(404).end('not found')
    return
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file')
    res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-cache' })
    res.end(await readFile(file))
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(port, () => console.log(`Site on http://localhost:${port}`))
