/* arcdoq-docsite — the publisher.
 *
 * Sends a built site to arcdoq. This is the second half of the push model: the
 * generator turns a corpus into a fileset, and this hands that fileset to a host
 * that already knows how to serve, gate, version and roll it back. arcdoq never
 * sees the repo, never sees markdown, and has no idea GitHub exists.
 *
 * It talks to arcdoq's machine deploy endpoint, which takes a long-lived deploy
 * token rather than the interactive OAuth the MCP publish tool needs. That is the
 * whole reason a workflow step can do this at all: an OAuth access token expires
 * and is issued through a browser, so there was nothing a CI job could hold.
 *
 * Keyed on the SITE SLUG, not an id arcdoq hands back. A CI job has nowhere
 * durable to keep an id from a previous run, so an id-keyed publish would either
 * create a new site every time or need state committed back into the repo. The
 * slug already lives in the workflow file.
 */

import fs from 'node:fs'
import path from 'node:path'

/** Where arcdoq's machine deploy endpoint lives. Its own origin, not the app's:
 *  the app runs on Azure Static Web Apps, whose managed Functions overwrite the
 *  inbound Authorization header before the app can read it. */
export const DEFAULT_ENDPOINT = 'https://mcp.arcdoq.com/deploy'

/* Servable extensions, mirroring arcdoq's own ingest rules so a file that would
 * be dropped server-side is reported HERE, where the person who can fix it is
 * still looking at the build log. arcdoq re-validates everything at publish; this
 * is fast feedback, not a trust boundary. */
const TEXT_EXT = new Set([
  'html', 'css', 'js', 'mjs', 'json', 'map', 'xml', 'txt', 'svg', 'webmanifest',
])
const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'pdf',
])
/** Build/OS cruft that looks servable but is never part of the hosted site. */
const JUNK_SEGMENT = /(^|\/)(__MACOSX|node_modules|\.git)(\/|$)/

const ext = (p) => {
  const i = p.lastIndexOf('.')
  return i === -1 ? '' : p.slice(i + 1).toLowerCase()
}

/** Any dot segment (.well-known, .DS_Store, .env) — not served, and never ours. */
const hasDotSegment = (p) => p.split('/').some((seg) => seg.startsWith('.'))

function walk(dir, prefix, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) walk(path.join(dir, entry.name), rel, out)
    else if (entry.isFile()) out.push(rel)
  }
}

/**
 * Read a built directory into the fileset arcdoq's deploy endpoint takes: text as
 * UTF-8, binaries as base64, junk dropped. Returns the entries plus what was
 * skipped, so the caller can say so out loud rather than silently shipping less
 * than the author built.
 *
 * Throws on the two conditions arcdoq would also reject, because failing here
 * costs a second and failing there costs a round trip and a red check.
 */
export function readFileset(dir) {
  const root = path.resolve(dir)
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`No such directory: ${root}. Build the site before publishing it.`)
  }

  const found = []
  walk(root, '', found)

  const files = []
  const skipped = []
  let bytes = 0

  for (const rel of found.sort()) {
    if (JUNK_SEGMENT.test(rel) || hasDotSegment(rel)) continue
    const x = ext(rel)
    const abs = path.join(root, rel)
    const size = fs.statSync(abs).size

    if (TEXT_EXT.has(x)) {
      files.push({ path: rel, content: fs.readFileSync(abs, 'utf8') })
    } else if (BINARY_EXT.has(x)) {
      files.push({ path: rel, content: fs.readFileSync(abs).toString('base64'), encoding: 'base64' })
    } else {
      skipped.push(rel)
      continue
    }
    bytes += size
  }

  if (!files.length) {
    throw new Error(`Nothing servable in ${root}. Did the build run?`)
  }
  if (!files.some((f) => f.path === 'index.html')) {
    throw new Error(`${root} has no index.html at its root. A site needs one to serve at /.`)
  }

  return { files, skipped, bytes }
}

/**
 * Turn the endpoint's answer into what a CI log should say, and — the part that
 * matters — into an exit code that means something.
 *
 * "Published" is not "reachable". arcdoq stores the content and then brings up
 * the edge route, and for a gated site those are minutes apart. A step that
 * prints a URL the moment it gets a 200 teaches everyone downstream to open a
 * link that 404s, so `provisioning` says so plainly instead.
 *
 * The exit codes: 0 published, 1 refused or failed. `failed` serving is a 1 —
 * the bytes landed but the address never came up, which is not a green check.
 */
export function report(status, body) {
  const lines = []
  const ok = status >= 200 && status < 300 && body?.success

  if (!ok) {
    lines.push(`arcdoq refused the deploy (HTTP ${status}).`)
    if (body?.message) lines.push(`  ${body.message}`)
    for (const e of body?.errors ?? []) {
      lines.push(`  - ${e.field ? `[${e.field}] ` : ''}${e.message}`)
    }
    // The two a workflow author can act on without reading arcdoq's docs.
    if (status === 401) {
      lines.push('  Check the ARCDOQ_DEPLOY_TOKEN secret is set and has not been revoked.')
    }
    if (status === 429 && body?.message) {
      lines.push('  This is a per-token ceiling; a retry later will succeed.')
    }
    return { ok: false, exitCode: 1, lines }
  }

  const what = body.created ? 'Created and deployed' : 'Deployed'
  lines.push(`${what} "${body.slug}" (${body.visibility}).`)

  if (body.serving === 'live') {
    lines.push(`  Live at ${body.url}`)
    return { ok: true, exitCode: 0, lines }
  }

  if (body.serving === 'failed') {
    lines.push('  The content is stored, but its address never came up.')
    lines.push('  Check the site in the arcdoq app — this needs attention, not a retry.')
    return { ok: false, exitCode: 1, lines }
  }

  // provisioning
  lines.push(`  NOT reachable yet — the content is stored, but the edge route for a`)
  lines.push(`  ${body.visibility} site takes a few minutes to come up. Do not announce it as live.`)
  if (body.url) lines.push(`  It will serve at ${body.url}`)
  return { ok: true, exitCode: 0, lines }
}

/**
 * Publish a built directory. The token is read from the environment, never taken
 * as a flag: a flag is visible in the process table and lands verbatim in a shell
 * trace, and this credential is long-lived.
 */
export async function publish({
  dir = 'dist',
  site,
  endpoint = DEFAULT_ENDPOINT,
  token,
  name,
  visibility,
  repo,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!site) throw new Error('Which site? Pass --site <slug>.')
  if (!token) {
    throw new Error(
      'No deploy token. Set ARCDOQ_DEPLOY_TOKEN (a repo secret in CI). Mint one with arcdoq.'
    )
  }

  const { files, skipped, bytes } = readFileset(dir)

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      site,
      files,
      ...(name ? { name } : {}),
      ...(visibility ? { visibility } : {}),
      ...(repo ? { repo } : {}),
    }),
  })

  let body
  try {
    body = await res.json()
  } catch {
    // A non-JSON answer is the platform rejecting the request before arcdoq saw
    // it — almost always an oversized body. Say that, rather than "unexpected
    // token < in JSON", which sends people looking in the wrong place.
    body = {
      success: false,
      message:
        `arcdoq returned a non-JSON response (HTTP ${res.status}). If the site is large, ` +
        'this is usually the upload size limit.',
    }
  }

  return { status: res.status, body, files, skipped, bytes }
}
