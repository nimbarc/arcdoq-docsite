import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readFileset, report, publish, DEFAULT_ENDPOINT } from '../src/publish.mjs'

/** A throwaway built-site directory. `files` maps a relative path to its contents. */
function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docsite-pub-'))
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, contents)
  }
  return dir
}

const MINIMAL = { 'index.html': '<html>hi</html>' }

describe('readFileset', () => {
  test('sends every servable file, with a stable order', () => {
    const dir = tree({
      'index.html': '<html>a</html>',
      'rules.html': '<html>b</html>',
      'rules.json': '{"rules":[]}',
      'tokens.css': ':root{}',
      'viewer.js': 'export{}',
    })
    const { files } = readFileset(dir)
    assert.deepEqual(
      files.map((f) => f.path),
      ['index.html', 'rules.html', 'rules.json', 'tokens.css', 'viewer.js']
    )
  })

  test('keeps nested paths relative to the built root', () => {
    const dir = tree({ ...MINIMAL, 'assets/logo.svg': '<svg/>' })
    const { files } = readFileset(dir)
    assert.ok(files.some((f) => f.path === 'assets/logo.svg'))
  })

  test('reads a binary as base64 and text as UTF-8', () => {
    const dir = tree({ ...MINIMAL })
    // A real PNG header — bytes that are not valid UTF-8.
    fs.writeFileSync(path.join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))
    const { files } = readFileset(dir)

    const png = files.find((f) => f.path === 'logo.png')
    assert.equal(png.encoding, 'base64')
    assert.deepEqual([...Buffer.from(png.content, 'base64')], [0x89, 0x50, 0x4e, 0x47, 0x0d])

    const html = files.find((f) => f.path === 'index.html')
    assert.equal(html.encoding, undefined)
    assert.equal(html.content, '<html>hi</html>')
  })

  test('drops OS/build cruft and dotfiles rather than shipping them', () => {
    const dir = tree({
      ...MINIMAL,
      '.DS_Store': 'junk',
      '.well-known/x.txt': 'no',
      '__MACOSX/index.html': 'no',
      'node_modules/pkg/index.js': 'no',
    })
    const { files } = readFileset(dir)
    assert.deepEqual(files.map((f) => f.path), ['index.html'])
  })

  // A dropped file is reported, never silent: the author built it and would
  // otherwise find out from a 404 on a live site.
  test('reports an unservable extension as skipped instead of dropping it quietly', () => {
    const dir = tree({ ...MINIMAL, 'notes.md': '# source', 'archive.zip': 'x' })
    const { files, skipped } = readFileset(dir)
    assert.deepEqual(files.map((f) => f.path), ['index.html'])
    assert.deepEqual(skipped.sort(), ['archive.zip', 'notes.md'])
  })

  test('refuses a build with no root index.html — nothing would serve at /', () => {
    const dir = tree({ 'rules.html': '<html/>' })
    assert.throws(() => readFileset(dir), /no index\.html at its root/)
  })

  test('refuses a directory that does not exist, naming the likely cause', () => {
    assert.throws(() => readFileset(path.join(os.tmpdir(), 'nope-' + Date.now())), /Build the site/)
  })

  test('refuses a directory holding nothing servable', () => {
    assert.throws(() => readFileset(tree({ 'notes.md': '# x' })), /Nothing servable/)
  })

  test('measures decoded bytes, not the inflated base64 string', () => {
    const dir = tree({ ...MINIMAL })
    fs.writeFileSync(path.join(dir, 'a.png'), Buffer.alloc(3000))
    const { bytes } = readFileset(dir)
    assert.equal(bytes, 3000 + MINIMAL['index.html'].length)
  })
})

describe('report — what CI is told, and what the exit code means', () => {
  const ok = (over = {}) => ({
    success: true, created: false, slug: 'docs', visibility: 'public',
    url: 'https://sites.arcdoq.com/acme/docs/', serving: 'live', ...over,
  })

  test('a live public site reports its address and passes', () => {
    const r = report(200, ok())
    assert.equal(r.exitCode, 0)
    assert.match(r.lines.join('\n'), /Live at https:\/\/sites\.arcdoq\.com\/acme\/docs\//)
  })

  test('distinguishes a first deploy from a republish', () => {
    assert.match(report(200, ok({ created: true })).lines[0], /^Created and deployed/)
    assert.match(report(200, ok()).lines[0], /^Deployed/)
  })

  // The failure this exists to prevent: printing a URL the instant a 200 lands
  // teaches everyone downstream to open a link that 404s for another few minutes.
  test('a provisioning site is NOT called live, and says so explicitly', () => {
    const r = report(200, ok({ serving: 'provisioning', visibility: 'private' }))
    assert.equal(r.exitCode, 0, 'the deploy succeeded — this is not a failed build')
    const out = r.lines.join('\n')
    assert.match(out, /NOT reachable yet/)
    assert.match(out, /Do not announce it as live/)
    assert.ok(!/Live at/.test(out), 'must not claim the site is live')
  })

  test('a route that never came up FAILS the job — stored bytes are not a green check', () => {
    const r = report(200, ok({ serving: 'failed' }))
    assert.equal(r.exitCode, 1)
    assert.match(r.lines.join('\n'), /needs attention, not a retry/)
  })

  test('surfaces arcdoq’s own message and field errors on a refusal', () => {
    const r = report(422, {
      success: false,
      message: 'Please correct the errors and try again.',
      errors: [{ field: 'html', message: '[index.html] [inline-script] blocked' }],
    })
    assert.equal(r.exitCode, 1)
    const out = r.lines.join('\n')
    assert.match(out, /HTTP 422/)
    assert.match(out, /\[html\] \[index\.html\] \[inline-script\] blocked/)
  })

  test('a 401 points at the credential, which is the only thing it can be', () => {
    const r = report(401, { success: false, message: 'A valid deploy token is required.' })
    assert.equal(r.exitCode, 1)
    assert.match(r.lines.join('\n'), /ARCDOQ_DEPLOY_TOKEN/)
  })

  test('a 409 relays why the deploy was refused rather than retrying blindly', () => {
    const r = report(409, {
      success: false,
      reason: 'generated-site',
      message: '"docs" is an AI-generated site — deploying files to it would replace what the builder made.',
    })
    assert.equal(r.exitCode, 1)
    assert.match(r.lines.join('\n'), /AI-generated site/)
  })

  test('a 200 that is not success: true is still a failure', () => {
    const r = report(200, { success: false, message: 'nope' })
    assert.equal(r.exitCode, 1)
  })
})

describe('publish — the request arcdoq receives', () => {
  const dir = tree({ ...MINIMAL, 'rules.json': '{}' })
  const okResponse = { status: 200, json: async () => ({ success: true, slug: 'docs', serving: 'live' }) }

  test('POSTs the fileset as a bearer-authed JSON body', async () => {
    let seen
    await publish({
      dir, site: 'docs', token: 'arcdoq_deploy_a_b',
      fetchImpl: async (url, init) => { seen = { url, init }; return okResponse },
    })

    assert.equal(seen.url, DEFAULT_ENDPOINT)
    assert.equal(seen.init.method, 'POST')
    assert.equal(seen.init.headers.authorization, 'Bearer arcdoq_deploy_a_b')
    assert.equal(seen.init.headers['content-type'], 'application/json')

    const body = JSON.parse(seen.init.body)
    assert.equal(body.site, 'docs')
    assert.deepEqual(body.files.map((f) => f.path).sort(), ['index.html', 'rules.json'])
  })

  test('omits optional fields entirely rather than sending empties', async () => {
    let body
    await publish({
      dir, site: 'docs', token: 't',
      fetchImpl: async (_u, init) => { body = JSON.parse(init.body); return okResponse },
    })
    assert.ok(!('name' in body))
    assert.ok(!('visibility' in body))
    assert.ok(!('repo' in body))
  })

  test('passes name, visibility and repo through when given', async () => {
    let body
    await publish({
      dir, site: 'docs', token: 't', name: 'Docs', visibility: 'private', repo: 'nimbarc/x',
      fetchImpl: async (_u, init) => { body = JSON.parse(init.body); return okResponse },
    })
    assert.equal(body.name, 'Docs')
    assert.equal(body.visibility, 'private')
    assert.equal(body.repo, 'nimbarc/x')
  })

  test('honours an endpoint override, for a local or staging arcdoq', async () => {
    let url
    await publish({
      dir, site: 'docs', token: 't', endpoint: 'http://localhost:7071/deploy',
      fetchImpl: async (u) => { url = u; return okResponse },
    })
    assert.equal(url, 'http://localhost:7071/deploy')
  })

  test('refuses before sending anything when the token is missing', async () => {
    let called = false
    await assert.rejects(
      publish({ dir, site: 'docs', fetchImpl: async () => { called = true; return okResponse } }),
      /ARCDOQ_DEPLOY_TOKEN/
    )
    assert.equal(called, false)
  })

  test('refuses before sending anything when no site slug is given', async () => {
    let called = false
    await assert.rejects(
      publish({ dir, token: 't', fetchImpl: async () => { called = true; return okResponse } }),
      /--site/
    )
    assert.equal(called, false)
  })

  // The platform can reject an oversized body before arcdoq sees it, and the
  // answer is then HTML or empty. "unexpected token < in JSON" sends people
  // looking in entirely the wrong place.
  test('turns a non-JSON answer into the explanation it almost always is', async () => {
    const { status, body } = await publish({
      dir, site: 'docs', token: 't',
      fetchImpl: async () => ({ status: 413, json: async () => { throw new SyntaxError('bad') } }),
    })
    assert.equal(status, 413)
    assert.match(body.message, /size limit/)
    assert.equal(report(413, body).exitCode, 1)
  })
})
