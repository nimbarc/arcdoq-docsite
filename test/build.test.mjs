import { test, before, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
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
    // Scoped to the rule, not the page. The objection is to burying citations
    // that exist nowhere else and to three tab stops per rule — not to the
    // word <details>. The page-level ID index is one control and holds only
    // second copies of IDs that are headings elsewhere on the page.
    for (const [article] of html.matchAll(/<article class="rule"[\s\S]*?<\/article>/g)) {
      assert.ok(!article.includes('<details'), 'no rule may hide anything behind a disclosure')
    }
    assert.equal((html.match(/<details/g) || []).length, 1, 'exactly one, and it is the ID index')
    assert.ok(html.includes('Place_Rejects_WhenStockUnavailable'))
  })

  test('the ID is a sibling of the heading, so the heading names the statement alone', () => {
    const article = /<article class="rule" id="ord-001"[\s\S]*?<\/article>/.exec(html)[0]
    const heading = /<h3[^>]*>[\s\S]*?<\/h3>/.exec(article)[0]
    assert.ok(!heading.includes('rule-id'),
      'a permalink inside the h3 makes the accessible name "ORD-001, permalink An order cannot…"')
    assert.ok(article.indexOf('rule-id') < article.indexOf('<h3'), 'the ID still leads')
    assert.match(heading, /An order cannot be placed against unavailable stock/)
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

describe('the phone', () => {
  let r, rules, guide
  before(() => {
    r = run()
    rules = read(r.out, 'rules-orders-lifecycle.html')
    guide = read(r.out, 'guides-refund-an-order.html')
  })

  test('the ID index survives where the sticky rail cannot', () => {
    // The rail is display:none below 1180px. Without this the only way to
    // reach a rule by ID on a phone is to already know where it is.
    const flow = /<details class="rail-flow">[\s\S]*?<\/details>/.exec(rules)
    assert.ok(flow, 'a rules page carries the in-flow index')
    const chips = [...flow[0].matchAll(/<a class="chip" href="#([\w-]+)"/g)].map((m) => m[1])
    assert.deepEqual(chips, ['ord-001', 'ord-002', 'ord-003', 'ord-004'],
      'every rule, in page order, not just the unconfirmed ones')
    const ids = new Set([...rules.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]))
    for (const c of chips) assert.ok(ids.has(c), `dead chip #${c}`)
  })

  test('a page with no rules grows no index', () => {
    assert.ok(!guide.includes('rail-flow'))
    assert.ok(!read(r.out, 'README.html').includes('rail-flow'))
  })

  test('a two-column table carries what is needed to stack it into pairs', () => {
    const t = /<table data-cols="2"[\s\S]*?<\/table>/.exec(guide)
    assert.ok(t, 'the column count travels with the markup')
    const row = /<tr>[\s\S]*?<\/tr>/g
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(t[0])[1]
    const first = row.exec(body)[0]
    const cells = [...first.matchAll(/<td([^>]*)>/g)].map((m) => m[1])
    assert.equal(cells.length, 2)
    assert.equal(cells[0].trim(), '', 'the first cell is the term and needs no label')
    assert.match(cells[1], /data-label="Why"/, 'the rest carry the header the phone drops')
  })

  test('a wider table keeps its columns and scrolls instead', () => {
    // Three columns is a matrix. Stacking it destroys the comparison that is
    // the only reason it was written as a table.
    const idx = read(r.out, 'rules-orders-index.html')
    assert.match(idx, /<table data-cols="3"/)
    assert.ok(!idx.includes('data-label='), 'the label is dead weight where nothing reads it')
  })

  test('every published page is named somewhere in its own nav', () => {
    // The mobile nav shows only the group holding the current page, and that is
    // decided by aria-current. A page the nav never names therefore renders an
    // empty sidebar on a phone rather than a wrong one.
    for (const p of r.pages) {
      const html = read(r.out, p.path.replace(/\//g, '-').replace(/\.md$/, '.html'))
      const nav = /<nav class="side"[\s\S]*?<\/nav>/.exec(html)[0]
      assert.equal((nav.match(/aria-current="page"/g) || []).length, 1,
        `${p.path} is not named in its own nav`)
    }
  })

  test('an area index is reachable from the ledger row that counts it', () => {
    const nav = /<nav class="side"[\s\S]*?<\/nav>/.exec(read(r.out, 'README.html'))[0]
    assert.match(nav, /<span><a href="rules-orders-index\.html">Orders<\/a><\/span>/)
  })

  test('the collapse hides groups only where it can also unhide one', () => {
    // The hiding rule is plain CSS and the unhiding rule is :has(). Ship them
    // unguarded and an engine without :has() drops the second and keeps the
    // first, emptying the sidebar on every page of the site.
    const css = fs.readFileSync(
      path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    const guard = /@supports selector\(:has\(a\)\) \{([\s\S]*?)\n  \}/.exec(css)
    assert.ok(guard, 'the collapse is behind an @supports guard')
    assert.match(guard[1], /\.side \.nav-g \{ display: none; \}/)
    assert.ok(!/^\s*\.side \.nav-g \{ display: none; \}/m.test(css.replace(guard[0], '')),
      'nothing hides a group outside the guard')
  })

  test('the key bar cannot paint while it is hidden', () => {
    // `.keybar { display: flex }` outranks the UA `[hidden] { display: none }`,
    // so without this a 15px empty bar pins itself under the header on every
    // page with no legend to dock, and eats every tap across the viewport.
    const css = fs.readFileSync(
      path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    assert.match(css, /\.keybar\[hidden\] \{ display: none; \}/)
  })

  test('paper size cannot pick the layout', () => {
    // A4's page box is ~698px and Letter's ~720px, either side of the fold.
    const css = fs.readFileSync(
      path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    const unscoped = [...css.matchAll(/^@media \(max-width/gm)]
    assert.deepEqual(unscoped, [], 'every max-width block must say `screen and`')
  })

  test('a headerless table is labelled with nothing rather than with blanks', () => {
    // The legend is authored as `| | |`; it becomes the key, not a table. Any
    // other blank-headed table must not sprout data-label="" on its cells.
    assert.ok(!guide.includes('data-label=""'))
  })
})

describe('the client layer', () => {
  // The floor under all of this is that the page works with JavaScript off.
  // That is exactly why a total JS failure went unseen: nothing visibly broke
  // except search, the permalink copy, the rail spy and the key bar.
  const VIEWER = path.join(import.meta.dirname, '../src/theme/viewer.js')

  // Small enough to read, large enough to run the shipped file unmodified.
  function load({ hash }) {
    const appended = []
    const el = () => ({
      className: '', innerHTML: '', textContent: '', value: '', hidden: false,
      dataset: {}, style: {}, children: [],
      classList: { add() {}, remove() {}, contains: () => false },
      setAttribute() {}, removeAttribute() {}, getAttribute: () => '#x',
      addEventListener() {}, focus() {}, blur() {}, appendChild() {},
      scrollIntoView() {}, closest: () => null,
      querySelector: () => el(), querySelectorAll: () => [],
    })
    const sandbox = {
      document: {
        documentElement: { dataset: {} },
        body: { appendChild: (n) => appended.push(n) },
        createElement: () => el(),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
      },
      location: { hash, pathname: '/p.html', search: '', href: 'http://x/p.html', replace() {} },
      localStorage: { getItem: () => null, setItem() {} },
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      fetch: () => { const chain = { then: () => chain, catch: () => chain }; return chain },
      IntersectionObserver: class { observe() {} },
      setTimeout, clearTimeout, console,
    }
    sandbox.window = sandbox
    vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(VIEWER, 'utf8'), sandbox, { filename: 'viewer.js' })
    return appended
  }

  test('it survives a load with no fragment, which is most loads', () => {
    // `id && getElementById(id)` is '' with no hash, '' is not nullish, so `?.`
    // does not short-circuit and ''.classList.contains threw — killing every
    // line after it, including the whole search sheet.
    const appended = load({ hash: '' })
    assert.ok(appended.some((n) => n.className === 'sheet'),
      'search never reached the document, so / and ⌘K do nothing')
  })

  test('and still works arriving on a deep link, which is how it hid', () => {
    const appended = load({ hash: '#ord-003' })
    assert.ok(appended.some((n) => n.className === 'sheet'))
  })
})

// A corpus written for one assertion. The main fixture stays well-formed —
// `builds without warnings` is one of the things worth asserting about it — so
// the malformed cases get their own throwaway trees rather than degrading it.
function adHoc(files, { config = {} } = {}) {
  const corpus = fs.mkdtempSync(path.join(os.tmpdir(), 'docsite-c-'))
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'docsite-o-'))
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(corpus, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, body)
  }
  const result = build({ corpus, out, config })
  return { ...result, out, read: (f) => fs.readFileSync(path.join(out, f), 'utf8') }
}

const docsJson = (pages) => JSON.stringify({
  name: 'Ad hoc', navigation: { groups: [{ group: 'Rules', pages }] },
})

describe('legal corpora that used to break the build', () => {
  test('a rule with no metadata line warns and renders, rather than crashing', () => {
    // build.mjs already wrote the warn-and-continue intent for this case; the
    // renderer then handed esc() a null label and took the whole build down.
    const r = adHoc({
      'docs.json': docsJson(['rules/a/x']),
      'rules/a/x.md': '# A\n\n### AAA-001 — Someone forgot the metadata line\n\nBody.\n',
    })
    assert.equal(r.ruleCount, 1)
    assert.ok(r.warnings.some((w) => /AAA-001 has no metadata line/.test(w)))
    assert.ok(!r.warnings.some((w) => /unmapped status token "null"/.test(w)),
      'a missing line is not an unmapped token')
    const html = r.read('rules-a-x.html')
    assert.match(html, /No status recorded/)
    assert.ok(!html.includes('stated by an author'), 'nobody stated anything')
  })

  test('a frontmatter key with no value is empty, not a list', () => {
    const r = adHoc({
      'docs.json': docsJson(['rules/a/x']),
      'rules/a/x.md': '---\narea: a\nverified:\n---\n\n# A\n\nBody.\n',
    })
    assert.equal(r.pages.length, 1)
    assert.ok(!r.read('rules-a-x.html').includes('Verified'))
  })

  test('a frontmatter list still collects its items', () => {
    // The [] the fix normalises away is load-bearing when items follow it.
    const r = adHoc({
      'docs.json': docsJson(['rules/a/x']),
      'rules/a/x.md': '---\nwalked-by-agent: 2031-03-04\nverified: never\nsources:\n  - repo: core\n---\n\n# A\n\nBody.\n',
    })
    assert.match(r.read('rules-a-x.html'), /Agent walk/)
  })

  test('two corpus paths that flatten to one filename are named, not silently merged', () => {
    const r = adHoc({
      'docs.json': docsJson(['rules/orders/refund-flow', 'rules/orders-refund/flow']),
      'rules/orders/refund-flow.md': '# First\n\nFirst body.\n',
      'rules/orders-refund/flow.md': '# Second\n\nSecond body.\n',
    })
    assert.ok(r.warnings.some((w) => /both build to rules-orders-refund-flow\.html/.test(w)),
      'a page that vanished must say so')
  })

  test('an ID declared on two pages is named rather than dropped from rules.json', () => {
    const r = adHoc({
      'docs.json': docsJson(['rules/a/one', 'rules/b/two']),
      'rules/a/one.md': '# A\n\n### ORD-001 — Placement holds stock\n\n**Status:** implemented · **Source:** `core:A.cs`\n',
      'rules/b/two.md': '# B\n\n### ORD-001 — A completely different claim\n\n**Status:** implemented · **Source:** `core:B.cs`\n',
    })
    assert.ok(r.warnings.some((w) => /ORD-001 is declared on both/.test(w)))
    assert.equal(r.ruleCount, 1, 'still one entry, but no longer a silent one')
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

  test('a link written without a ./ or ../ prefix still resolves', () => {
    // README.md writes `[Order lifecycle](rules/orders/lifecycle.md)`, which is
    // the natural way to write one. Matching only prefixed links left these
    // untouched, so the home page shipped live hrefs to .md files no host
    // serves — and the assertion below passed because nothing was processed.
    const r = run()
    // Scoped to <main>. The nav already holds htmlName()'d hrefs for these
    // same pages, so asserting over the whole document would pass whether or
    // not a single body link was ever resolved.
    const body = (f) => /<main id="main">([\s\S]*)<\/main>/.exec(read(r.out, f))[1]
    assert.match(body('README.html'), /href="rules-orders-lifecycle\.html"/)
    assert.match(body('README.html'), /href="meta-status\.html"/)
    assert.match(body('rules-orders-index.html'), /href="rules-orders-lifecycle\.html"/,
      'a bare sibling link resolves against its own directory too')
  })

  test('no built page ships an href to a file the host cannot serve', () => {
    const r = run()
    for (const f of fs.readdirSync(r.out).filter((x) => x.endsWith('.html'))) {
      const bad = [...read(r.out, f).matchAll(/href="([^"]*\.md[^"]*)"/g)].map((m) => m[1])
      assert.deepEqual(bad, [], `${f} links to markdown`)
    }
  })

  test('the shell\'s own links are left alone', () => {
    const home = read(run().out, 'README.html')
    assert.match(home, /href="https:\/\/fonts\.googleapis\.com"/)
    assert.match(home, /href="#main"/)
  })

  test('a link to an unpublished page renders inert rather than 404ing', () => {
    // Published here, so nothing is inert — and now that prefixless links are
    // resolved, that is a statement about resolution rather than about a
    // regex that never fired.
    const r = run()
    assert.ok(!read(r.out, 'README.html').includes('link-inert'))
    // Drop meta/status.md from the publish set and the same link goes grey.
    const docs = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'docs.json'), 'utf8'))
    docs.navigation.groups = docs.navigation.groups.filter((g) => g.group !== 'Status')
    const corpus = fs.mkdtempSync(path.join(os.tmpdir(), 'docsite-c-'))
    fs.cpSync(FIXTURE, corpus, { recursive: true })
    fs.writeFileSync(path.join(corpus, 'docs.json'), JSON.stringify(docs))
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'docsite-o-'))
    build({ corpus, out, config: {} })
    assert.match(fs.readFileSync(path.join(out, 'README.html'), 'utf8'), /link-inert/)
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
