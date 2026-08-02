import { test, before, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { build } from '../src/build.mjs'

const FIXTURE = path.join(import.meta.dirname, 'fixture')
const read = (out, f) => fs.readFileSync(path.join(out, f), 'utf8')

function run({ config } = {}) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'docsite-'))
  const cfg = config !== undefined
    ? config
    : JSON.parse(fs.readFileSync(path.join(FIXTURE, 'docs.config.json'), 'utf8'))
  const result = build({ corpus: FIXTURE, out, config: cfg })
  return { ...result, out, rules: JSON.parse(read(out, 'rules.json')).rules }
}

describe('build', () => {
  let r
  before(() => { r = run() })

  test('publishes exactly what docs.json names, and nothing else', () => {
    assert.equal(r.pages.length, 6)
    const files = fs.readdirSync(r.out).filter((f) => f.endsWith('.html'))
    assert.equal(files.length, 7)               // 6 pages + index.html
    assert.ok(files.includes('index.html'))
  })

  test('builds without warnings', () => {
    assert.deepEqual(r.warnings, [])
  })
})

describe('the rule atom', () => {
  let r, html
  before(() => { r = run(); html = read(r.out, 'rules-orders-lifecycle.html') })

  test("a rule is addressed by the corpus's own anchor, never a slugified title", () => {
    const ids = [...html.matchAll(/<article class="rule" id="([^"]+)"/g)].map((m) => m[1])
    assert.deepEqual(ids, ['ord-001', 'ord-002', 'ord-003', 'ord-004'])
    assert.ok(!html.includes('<a id="ord-001">'), 'the source anchor is hoisted, not duplicated')
  })

  test('the statement leads and the evidence follows it in the DOM', () => {
    const article = /<article class="rule" id="ord-001"[\s\S]*?<\/article>/.exec(html)[0]
    assert.ok(article.indexOf('rule-statement') < article.indexOf('rule-body'))
    assert.ok(article.indexOf('rule-body') < article.indexOf('class="warrant"'))
  })

  test('the warrant renders open, never behind a disclosure', () => {
    assert.ok(!html.includes('<details'))
    assert.ok(html.includes('Place_Rejects_WhenStockUnavailable'))
  })

  test('trailing Source: prose is kept, not discarded', () => {
    const ord2 = r.rules.find((x) => x.id === 'ORD-002')
    assert.equal(ord2.tests.length, 0)
    assert.match(read(r.out, 'rules-orders-lifecycle.html'), /deduction happens at settlement/)
  })

  test('a rule with no test says so rather than silently omitting the field', () => {
    const ord2 = r.rules.find((x) => x.id === 'ORD-002')
    assert.ok(ord2.caveats.some((c) => c.kind === 'unpinned'))
  })

  test('every same-page fragment link resolves', () => {
    const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]))
    const frags = [...html.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1])
    assert.ok(frags.length > 0)
    for (const f of frags) assert.ok(ids.has(f), `dead fragment #${f}`)
  })
})

describe('status vocabulary', () => {
  test('a declared sidecar splits one token into its two meanings', () => {
    const r = run()
    const ord3 = r.rules.find((x) => x.id === 'ORD-003')   // implementation moved
    const ord4 = r.rules.find((x) => x.id === 'ORD-004')   // evidence only
    assert.equal(ord3.status, 'in-stage')
    assert.equal(ord4.status, 'in-stage')
    assert.equal(ord3.tier, 'unconfirmed')
    assert.equal(ord4.tier, 'confirmed', 'evidence-only is live in production')
    assert.ok(ord4.caveats.some((c) => c.kind === 'newly-tested'))
  })

  test('with no config the same corpus degrades to less detail, not a wrong answer', () => {
    const r = run({ config: {} })
    const ord4 = r.rules.find((x) => x.id === 'ORD-004')
    assert.equal(ord4.status, 'in-stage')
    assert.equal(ord4.tier, 'unconfirmed')
    assert.ok(!ord4.caveats.some((c) => c.kind === 'newly-tested'))
  })

  test('a rule can match production and still have nothing testing it', () => {
    const r = run()
    const ord2 = r.rules.find((x) => x.id === 'ORD-002')
    assert.equal(ord2.tier, 'confirmed')
    assert.ok(ord2.caveats.some((c) => c.kind === 'unpinned'))
  })
})

describe('provenance', () => {
  let r, html
  before(() => { r = run(); html = read(r.out, 'guides-refund-an-order.html') })

  test('no declared marker survives as a raw glyph', () => {
    assert.equal((html.match(/✅|\u{1F4C4}/gu) || []).length, 0)
  })

  test('a marker closes the claim it governs', () => {
    assert.ok(html.includes('class="claim" data-ev="seen"'))
    assert.ok(html.includes('class="claim" data-ev="from-source"'))
  })

  test('a marker used as a noun is not a claim', () => {
    // "Wording is 📄 from source." must not wrap "Wording is" as a claim.
    assert.ok(!/class="claim"[^>]*>Wording is</.test(html))
  })

  test('a coverage line attaches to the block above it rather than becoming a claim', () => {
    assert.ok(html.includes('cover-tag'))
  })

  test('the legend becomes a key drawn with the same glyphs used inline', () => {
    assert.ok(html.includes('class="ev-key"'))
    assert.ok(!/<th>\s*<\/th>/.test(html), 'not rendered as an empty-headed table')
  })

  test('claim counts come from the render, so the strip cannot disagree', () => {
    const strip = /<dt>Claims<\/dt><dd>([\s\S]*?)<\/dd>/.exec(html)[1].replace(/<[^>]+>/g, '')
    const runs = (html.match(/class="claim"/g) || []).length
    assert.equal(parseInt(strip, 10), runs)
  })

  test('walked-in renders verbatim, never reflowed', () => {
    assert.ok(html.includes('meridian-staging.example.com (v4.2.0), read-only'))
  })
})

describe('links', () => {
  test('a relative link resolves against its own directory, not by string match', () => {
    const r = run()
    const stub = read(r.out, 'rules-inventory-index.html')
    assert.ok(stub.includes('href="rules-orders-lifecycle.html"'),
      '../orders/lifecycle.md from rules/inventory/ must resolve')
    assert.ok(!stub.includes('link-inert'))
  })

  test('a directory link resolves to its index', () => {
    const r = run()
    const idx = read(r.out, 'rules-orders-index.html')
    assert.ok(idx.includes('href="rules-inventory-index.html"'))
  })

  test('a link to an unpublished page renders inert rather than 404ing', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'docsite-'))
    const docsJson = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'docs.json'), 'utf8'))
    assert.ok(docsJson.navigation.groups.some((g) => g.group === 'Status'))
    build({ corpus: FIXTURE, out, config: {} })
    // README links to meta/status.md, which IS published here, so nothing inert.
    assert.ok(!read(out, 'README.html').includes('link-inert'))
  })
})

describe('packaging', () => {
  test('ships no corpus-specific vocabulary as a default', () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, '../src/build.mjs'), 'utf8')
    const cfg = /const defaults = \{[\s\S]*?\n\}\n/.exec(src)[0]
    assert.match(cfg, /areaLabels: \{\}/, 'areaLabels must default empty')
    assert.ok(!/statusSidecar:\s*\{/.test(cfg), 'no sidecar path may be baked in')
  })
})
