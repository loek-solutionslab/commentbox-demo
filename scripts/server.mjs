// Runs the CommentBox server (@commentbox/server-node) for the demo on http://localhost:8787.
// WEBHOOK_SECRET and ADMIN_TOKEN come from .env (see .env.example); the rest has local defaults.
import { startServer } from '@commentbox/server-node'

const defaults = {
  PORT: '8787',
  PUBLIC_URL: 'http://localhost:8787',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  DATA_DIR: './data',
  WEBHOOK_URL: 'http://localhost:8790/hooks/commentbox',
  PROJECT_NAME: 'commentbox-demo',
}
for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value
}
for (const key of ['WEBHOOK_SECRET', 'ADMIN_TOKEN']) {
  if (!process.env[key]) console.warn(`${key} is empty; set it in .env`)
}

const { url, close } = await startServer()
console.log(`CommentBox server on ${url} (widget: ${url}/widget.js)`)
for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => void close().then(() => process.exit(0)))
