// Minimal agent step for the CommentBox demo. Node 20, no dependencies.
//
// Listens on POST http://localhost:8790/hooks/commentbox, verifies the signed webhook and, for each
// new comment, saves the screenshot to ./data/shots/<id>.jpg, opens a GitHub issue with `gh` and
// marks the comment as in progress on the CommentBox server.
//
// Env: WEBHOOK_SECRET (required), ADMIN_TOKEN, COMMENTBOX_API_URL, DEMO_REPO,
// SCREENSHOT_PUBLIC_URL_PREFIX, REQUESTED_TEXT, AGENT_DRY_RUN=1 (or --dry-run), AGENT_PORT.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const env = process.env
const PORT = Number(env.AGENT_PORT ?? 8790)
const HOOK_PATH = '/hooks/commentbox'
const SECRET = env.WEBHOOK_SECRET ?? ''
const API_URL = (env.COMMENTBOX_API_URL || 'http://localhost:8787').replace(/\/+$/, '')
const REPO = env.DEMO_REPO || 'loek-solutionslab/commentbox-demo'
const SHOT_PREFIX = (env.SCREENSHOT_PUBLIC_URL_PREFIX ?? '').replace(/\/+$/, '')
const DRY_RUN = process.argv.includes('--dry-run') || /^(1|true|yes)$/i.test(env.AGENT_DRY_RUN ?? '')
const TOLERANCE_SECONDS = 300
const DATA_DIR = resolve('data')

if (!SECRET) {
  console.error('WEBHOOK_SECRET is not set; refusing to accept unsigned webhooks.')
  process.exit(1)
}

// --- Signature: X-CommentBox-Signature: t=<unix>,v1=<hex>, HMAC-SHA256 of `${t}.${rawBody}` ---

function verifySignature(rawBody, header) {
  if (!header) return false
  let t = NaN
  const sigs = []
  for (const part of header.split(',')) {
    const [k, v] = part.trim().split('=', 2)
    if (k === 't') t = Number(v)
    else if (k === 'v1' && v) sigs.push(v)
  }
  if (!Number.isInteger(t) || !sigs.length) return false
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > TOLERANCE_SECONDS) return false
  const expected = createHmac('sha256', SECRET).update(`${t}.${rawBody}`).digest()
  return sigs.some((hex) => {
    const got = Buffer.from(hex, 'hex')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

// --- Turning a comment into an issue ---

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

function elementLabel(c) {
  const selector = c.selector ?? ''
  if (c.tagName?.toUpperCase() === 'P' && /(^|[\s.#])hero-sub\b/.test(selector)) return 'Hero subline'
  return 'Page text'
}

function issueTitle(c) {
  let text = oneLine(c.text).replace(/[.\s]+$/, '')
  // "Make it shorter" -> "make it shorter", but leave words like "CTA" alone.
  if (/^[A-Z][a-z]/.test(text)) text = text[0].toLowerCase() + text.slice(1)
  if (text.length > 60) text = text.slice(0, 60).trimEnd()
  return `${elementLabel(c)}: ${text || 'comment'}`
}

function requestedText(c) {
  if (env.REQUESTED_TEXT?.trim()) return env.REQUESTED_TEXT.trim()
  const text = oneLine(c.text)
  const quoted = text.match(/"([^"]+)"|“([^”]+)”|(?<![\w])'([^']+)'(?![\w])/)
  if (quoted) return (quoted[1] ?? quoted[2] ?? quoted[3]).trim()
  const colon = text.indexOf(':')
  if (colon !== -1 && text.slice(colon + 1).trim()) return text.slice(colon + 1).trim()
  return null
}

const quote = (s) => `> ${oneLine(s) || '(empty)'}`

function issueBody(c, { shotSaved }) {
  const lines = []
  lines.push('## Comment', '', quote(c.text))
  if (c.name?.trim()) lines.push('', `From: ${oneLine(c.name)}`)
  lines.push('', '## Element', '')
  lines.push(`- Page: \`${c.pathname || c.pageUrl || '/'}\``)
  lines.push(`- Selector: \`${c.selector ?? 'none (general comment)'}\``)
  lines.push(`- Tag: \`${c.tagName ? c.tagName.toLowerCase() : 'none'}\``)
  lines.push('', '## Current text', '', quote(c.elementText))
  const wanted = requestedText(c)
  lines.push('', '## Requested text', '', wanted ? quote(wanted) : 'To be decided by the agent')
  lines.push('', '## Screenshot', '')
  const link = screenshotSource(c)
  if (SHOT_PREFIX && shotSaved) lines.push(`![Screenshot](${SHOT_PREFIX}/${c.id}.jpg)`, '')
  lines.push(link ? `Original: ${link}` : 'No screenshot was attached.')
  lines.push('', `Filed by the local agent step from a CommentBox comment (id ${c.id}).`)
  return lines.join('\n') + '\n'
}

// Prefer a highlighted variant if the server provides one; 0.1.2 sends only screenshotUrl.
const screenshotSource = (c) => c.highlightedScreenshotUrl || c.screenshotUrl || null

async function saveScreenshot(c) {
  const url = screenshotSource(c)
  if (!url) return false
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await mkdir(resolve(DATA_DIR, 'shots'), { recursive: true })
    await writeFile(resolve(DATA_DIR, 'shots', `${c.id}.jpg`), Buffer.from(await res.arrayBuffer()))
    return true
  } catch (err) {
    console.warn(`Could not download the screenshot for ${c.id}: ${err.message}`)
    return false
  }
}

function ghIssueCreate(title, body) {
  return new Promise((done, fail) => {
    const child = spawn('gh', ['issue', 'create', '--repo', REPO, '--label', 'demo', '--title', title, '--body-file', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', fail)
    child.on('close', (code) => {
      const url = out.match(/https:\/\/github\.com\/\S+\/issues\/\d+/)?.[0]
      if (code === 0 && url) done(url)
      // gh errors do not contain the token; keep only the first line anyway.
      else fail(new Error(`gh exited with ${code}: ${err.split('\n')[0]}`))
    })
    child.stdin.end(body)
  })
}

async function markInProgress(id, issueNumber) {
  if (!env.ADMIN_TOKEN) {
    console.warn('ADMIN_TOKEN is not set; comment status was not updated.')
    return
  }
  const res = await fetch(`${API_URL}/v1/comments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ADMIN_TOKEN}` },
    body: JSON.stringify({ status: 'in-progress', note: `Issue #${issueNumber} opened` }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) console.warn(`Could not update comment ${id}: HTTP ${res.status}`)
}

const seen = new Set()

async function handleComment(c) {
  if (seen.has(c.id)) return
  seen.add(c.id)
  const shotSaved = await saveScreenshot(c)
  const title = issueTitle(c)
  const body = issueBody(c, { shotSaved })
  if (DRY_RUN) {
    console.log(`--- dry run: issue for comment ${c.id} ---`)
    console.log(`Title: ${title}\n`)
    console.log(body)
    return
  }
  try {
    const url = await ghIssueCreate(title, body)
    await mkdir(DATA_DIR, { recursive: true })
    await writeFile(resolve(DATA_DIR, 'last-issue.txt'), url + '\n')
    console.log(`Issue ${url} for comment ${c.id}`)
    await markInProgress(c.id, url.split('/').pop())
  } catch (err) {
    seen.delete(c.id)
    console.error(`Could not file an issue for comment ${c.id}: ${err.message}`)
  }
}

// --- HTTP ---

createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (req.method !== 'POST' || path !== HOOK_PATH) {
    res.writeHead(404).end()
    return
  }
  const chunks = []
  let size = 0
  req.on('data', (chunk) => {
    size += chunk.length
    if (size > 1_000_000) req.destroy()
    else chunks.push(chunk)
  })
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!verifySignature(raw, req.headers['x-commentbox-signature'])) {
      res.writeHead(401).end('invalid signature')
      return
    }
    let payload
    try {
      payload = JSON.parse(raw)
    } catch {
      res.writeHead(400).end('invalid json')
      return
    }
    const event = req.headers['x-commentbox-event'] ?? payload.event
    res.writeHead(200).end('ok')
    if (event === 'comment.created' && payload.id) void handleComment(payload)
  })
}).listen(PORT, () => {
  console.log(`Agent listening on http://localhost:${PORT}${HOOK_PATH}${DRY_RUN ? ' (dry run)' : ''}`)
})
