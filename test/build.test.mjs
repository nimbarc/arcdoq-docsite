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
    assert.equal(r.pages.length, 7)
    const files = fs.readdirSync(r.out).filter((f) => f.endsWith('.html'))
    // 7 pages + index.html + search.html. The search route is the generator's
    // own surface, not a page of the corpus: docs.json declares what the site
    // contains and does not name it, which is also why it carries no
    // aria-current and is exempt from the mobile group collapse.
    assert.equal(files.length, 9)
    assert.ok(files.includes('index.html'))
    assert.ok(files.includes('search.html'))
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

  test('a glyph standing beside its own name does not read it out too', () => {
    // Inline the glyph carries the name; in the key and on a coverage tag the
    // words follow as text, so announcing both gives "seen, image. seen."
    const dt = /<dt>[\s\S]*?<\/dt>/.exec(/<dl class="ev-key">[\s\S]*?<\/dl>/.exec(html)[0])[0]
    assert.match(dt, /aria-hidden="true"/)
    assert.ok(!dt.includes('aria-label'), 'the visible k-name is the label')
    assert.match(/<p class="cover-tag">[\s\S]*?<\/p>/.exec(html)[0], /aria-hidden="true"/)
    // Inline marks keep their name: nothing else names them.
    const inlineMark = /<span class="ev-mark" data-ev="seen" role="img"[^>]*>/.exec(html)
    assert.ok(inlineMark, 'a mark in prose still announces itself')
  })

  test('a page that omits `verified:` is still marked unverified', () => {
    // The tone used to key off the literal string, so omitting the key rendered
    // a plain "never" and the key bar dropped its chip on exactly the pages
    // least entitled to look verified.
    const r2 = adHoc({
      'docs.json': JSON.stringify({ name: 'x',
        navigation: { groups: [{ group: 'Guides', pages: ['g/a'] }] } }),
      'g/a.md': '---\nwalked-by-agent: 2031-03-04\n---\n\n# A\n\nBody.\n',
    })
    assert.match(r2.read('g-a.html'), /<dd><span data-tone="pending">never<\/span><\/dd>/)
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

// Two code paths key on the `flows/` prefix — the page warrant's kind and the
// search row's — and until this fixture existed the build could emit a Flow
// page without a single test ever having built one. Guides were covered; the
// other narrative genre was not.
describe('page kinds', () => {
  let r, flow
  before(() => { r = run(); flow = read(r.out, 'flows-placing-an-order.html') })

  test('a flow declares its kind, so a reader knows what they arrived in', () => {
    assert.match(flow, /<div class="page-warrant"><span class="w-kind">Flow<\/span>/)
  })

  test('a flow carries no provenance strip, because nobody walked it', () => {
    // The strip is gated on `walked-by-agent`. A flow is derived from rules,
    // not from opening the product, so rendering one would invent a walk.
    assert.ok(!flow.includes('page-provenance'))
    assert.match(flow, /Verified 2031-03-04/)
  })

  test("a flow's `##` is the reader's own heading, not a rule-group label", () => {
    assert.ok(flow.includes('<section class="prose-group"'))
    assert.ok(!flow.includes('rule-group'), 'no rules, so no rule group')
    assert.ok(!flow.includes('sec-range'), 'and no ID range beside the heading')
  })

  test('search separates the three genres rather than listing rules alone', () => {
    const search = read(r.out, 'search.html')
    for (const kind of ['Flow', 'Guide']) {
      assert.match(search, new RegExp(`<span class="s-id">${kind}</span>`),
        `${kind} pages are findable, not just rules`)
    }
    assert.match(search, /flows-placing-an-order\.html/)
  })

  test('a flow links down to its rules rather than restating them', () => {
    // Every rule reference resolves to a published page: an inert span here
    // would mean the flow names a rule the reader cannot reach.
    assert.ok(!flow.includes('link-inert'))
    assert.match(flow, /href="rules-orders-lifecycle\.html#ord-001"/)
  })
})

// A flow or guide links down to its rules; until this, nothing ran the other
// way, so a reader holding an ID could not find the walkthrough for it. The
// whole risk is overclaiming — a guide is a draft until a human walks it — so
// what is asserted here is as much about what the row does NOT say.
describe('the narratives a rule appears in', () => {
  let r, html, rule
  before(() => {
    r = run()
    html = read(r.out, 'rules-orders-lifecycle.html')
    rule = r.rules.find((x) => x.id === 'ORD-004')
  })

  test('a rule names the guide that walks it, and the flow that contains it', () => {
    const warrant = /<article[^>]*data-rule-id="ORD-004"[\s\S]*?<\/article>/.exec(html)[0]
    assert.match(warrant, /<dt>Guide<\/dt><dd><a class="w-nar" href="guides-refund-an-order\.html"/)
    assert.match(warrant, /<dt>Flow<\/dt><dd><a class="w-nar" href="flows-placing-an-order\.html"/)
    // Evidence first, navigation last: the test and the source that back the
    // claim must precede the pages that merely mention it.
    assert.ok(warrant.indexOf('<dt>Source</dt>') < warrant.indexOf('<dt>Guide</dt>'))
    // Navigation, not a citation. `.cite` is the monospace class, and monospace
    // is permitted only on strings that paste into a tool. A guide title pastes
    // into nothing, and a stack of mono titles reads as more citations.
    assert.ok(!/<a class="cite" href="(guides|flows)-/.test(warrant))
  })

  test("it carries the narrative's own state, so an unwalked guide cannot look walked", () => {
    // This is the overclaim the feature exists to avoid. The guide is
    // `verified: never`; the flow carries a date. Both must say which they are.
    assert.match(html, /guides-refund-an-order\.html"[^>]*>Refund an order<\/a>/)
    assert.match(html,
      /<span class="w-vfy" id="[^"]+" data-tone="pending">not human-verified<\/span>/)
    assert.match(html,
      /<span class="w-vfy" id="[^"]+">verified 2031-03-04<\/span>/)
  })

  test('the state reaches the accessibility tree, not only the page', () => {
    // A links list or rotor reads accessible names and nothing else. Left as a
    // bare sibling, the state vanishes there and the link announces only
    // "Refund an order" — the unqualified "walked in X" the standing veto
    // forbids, reached through the accessibility tree instead of the page.
    const warrant = /<article[^>]*data-rule-id="ORD-004"[\s\S]*?<\/article>/.exec(html)[0]
    const link = /<a class="w-nar" href="guides-refund-an-order\.html" aria-describedby="([^"]+)">/
      .exec(warrant)
    assert.ok(link, 'the guide link points at its own state')
    assert.match(warrant, new RegExp(
      `<span class="w-vfy" id="${link[1]}" data-tone="pending">not human-verified</span>`))
    // Every id on the page must be unique or the association silently binds to
    // the first match, which would report one rule's state on another's link.
    const ids = [...html.matchAll(/<span class="w-vfy" id="([^"]+)"/g)].map((m) => m[1])
    assert.equal(new Set(ids).size, ids.length)
  })

  test('rules.json says the same thing, so the sidecar cannot disagree', () => {
    assert.deepEqual(rule.appearsIn.map((a) => [a.kind, a.verified]),
      [['Flow', '2031-03-04'], ['Guide', null]])
  })

  test('a rule nothing narrates gains nothing at all', () => {
    const r2 = adHoc({
      'docs.json': docsJson(['rules/a']),
      'rules/a.md': '---\narea: x\n---\n\n# A\n\n<a id="aaa-001"></a>\n' +
        '### AAA-001 — A thing is true\n\n**Source:** `core:x.cs`\n',
    })
    assert.ok(!r2.read('rules-a.html').includes('w-vfy'))
    assert.deepEqual(JSON.parse(r2.read('rules.json')).rules[0].appearsIn, [])
  })

  test('a rules page citing another rule is a cross-reference, not a narrative', () => {
    // Rules point at each other constantly. Counting those would tell a reader
    // a walkthrough exists when no one has written one.
    const r2 = adHoc({
      'docs.json': docsJson(['rules/a', 'rules/b']),
      'rules/a.md': '---\narea: x\n---\n\n# A\n\n<a id="aaa-001"></a>\n' +
        '### AAA-001 — A thing is true\n\n**Source:** `core:x.cs`\n',
      'rules/b.md': '---\narea: x\n---\n\n# B\n\n<a id="bbb-001"></a>\n' +
        '### BBB-001 — Another thing\n\n**Source:** `core:y.cs`\n\n' +
        'Which is what [AAA-001](a.md#aaa-001) prevents.\n',
    })
    const byId = Object.fromEntries(
      JSON.parse(r2.read('rules.json')).rules.map((x) => [x.id, x.appearsIn]))
    assert.deepEqual(byId['AAA-001'], [])
  })

  test('one guide naming a rule at five steps is one appearance, not five', () => {
    const r2 = adHoc({
      'docs.json': JSON.stringify({ name: 'x', navigation: { groups: [
        { group: 'Rules', pages: ['rules/a'] },
        { group: 'Guides', pages: ['guides/g'] }] } }),
      'rules/a.md': '---\narea: x\n---\n\n# A\n\n<a id="aaa-001"></a>\n' +
        '### AAA-001 — A thing is true\n\n**Source:** `core:x.cs`\n',
      'guides/g.md': '---\nverified: never\n---\n\n# G\n\n' +
        'Step one. → [AAA-001](../rules/a.md#aaa-001)\n\n' +
        'Step two. → [AAA-001](../rules/a.md#aaa-001)\n\n' +
        'Step three. → [AAA-001](../rules/a.md#aaa-001)\n',
    })
    assert.equal(JSON.parse(r2.read('rules.json')).rules[0].appearsIn.length, 1)
  })

  test('the term agrees in number with the definitions under it', () => {
    // Its sibling row already says Test/Tests. One `Guide` labelling three
    // entries in the same <dl> that pluralises beside it reads as a bug.
    const r2 = adHoc({
      'docs.json': JSON.stringify({ name: 'x', navigation: { groups: [
        { group: 'Rules', pages: ['rules/a'] },
        { group: 'Guides', pages: ['guides/g1', 'guides/g2'] }] } }),
      'rules/a.md': '---\narea: x\n---\n\n# A\n\n<a id="aaa-001"></a>\n' +
        '### AAA-001 — A thing is true\n\n**Source:** `core:x.cs`\n',
      'guides/g1.md': '---\nverified: never\n---\n\n# G1\n\n' +
        'Step. → [AAA-001](../rules/a.md#aaa-001)\n',
      'guides/g2.md': '---\nverified: never\n---\n\n# G2\n\n' +
        'Step. → [AAA-001](../rules/a.md#aaa-001)\n',
    })
    assert.match(r2.read('rules-a.html'), /<dt>Guides<\/dt>/)

    const r1 = adHoc({
      'docs.json': JSON.stringify({ name: 'x', navigation: { groups: [
        { group: 'Rules', pages: ['rules/a'] },
        { group: 'Guides', pages: ['guides/g1'] }] } }),
      'rules/a.md': '---\narea: x\n---\n\n# A\n\n<a id="aaa-001"></a>\n' +
        '### AAA-001 — A thing is true\n\n**Source:** `core:x.cs`\n',
      'guides/g1.md': '---\nverified: never\n---\n\n# G1\n\n' +
        'Step. → [AAA-001](../rules/a.md#aaa-001)\n',
    })
    assert.match(r1.read('rules-a.html'), /<dt>Guide<\/dt>/)
  })
})

// The attribute contract a content index reads. It is public the moment it
// ships and it is shared with a consumer in another repo, so it is asserted
// here rather than described: the shape, the separator, the element the
// attributes sit on, and the names that must never appear. A comment cannot
// stop the next change from quietly widening any of those.
//
// The rules a step covers and the narratives a rule appears in are one fact
// read from opposite ends, so the last test is the one that matters most: the
// two surfaces of a single build must not be able to contradict each other.
describe('the machine-readable contract on guides and flows', () => {
  let r, flow, guide, rules
  const openTags = (html) => [...html.matchAll(/<(?:article|section)\b[^>]*>/g)].map((m) => m[0])
  const steps = (html) => Object.fromEntries(openTags(html)
    .filter((t) => /class="(?:prose|rule)-group"/.test(t))
    .map((t) => [/id="([^"]+)"/.exec(t)[1], /data-rules="([^"]*)"/.exec(t)?.[1] ?? null]))

  before(() => {
    r = run()
    flow = read(r.out, 'flows-placing-an-order.html')
    guide = read(r.out, 'guides-refund-an-order.html')
    rules = read(r.out, 'rules-orders-lifecycle.html')
  })

  test('the genre rides on a page root, single-valued and opaque', () => {
    assert.match(guide, /<article class="page" data-kind="guide"/)
    assert.match(flow, /<article class="page" data-kind="flow"/)
    // Lowercased, and derived from the word the reader is shown rather than
    // written out a second time — so the attribute cannot say "flow" on a page
    // whose warrant says Guide. One word, so it survives being read verbatim by
    // a consumer that does not tokenise this key.
    assert.match(guide, /<span class="w-kind">Guide<\/span>/)
    for (const html of [guide, flow]) {
      assert.ok(!/data-kind="[^"]*\s/.test(html), 'data-kind must never be multi-word')
    }
  })

  test('the root carries every rule the page covers, steps and lead alike', () => {
    // A different question from the one a step answers: *which walkthroughs
    // cover this?* is asked about the walkthrough. It is also the only place a
    // rule linked from the lead can appear, since the lead belongs to no step.
    const root = (html) => /<article class="page"[^>]*data-rules="([^"]*)"/.exec(html)?.[1]
    assert.equal(root(flow), 'ORD-001 ORD-002 ORD-003 ORD-004')
    assert.equal(root(guide), 'ORD-004 ORD-002 ORD-003')
    // The union is exactly the steps' union here, because this fixture links
    // no rule from a lead. That it is a superset is asserted below.
    for (const html of [flow, guide]) {
      const stepIds = new Set(Object.values(steps(html)).filter(Boolean)
        .flatMap((v) => v.split(' ')))
      for (const id of stepIds) assert.ok(root(html).split(' ').includes(id),
        `${id} is on a step and missing from the page root`)
    }
  })

  test('a rules page gains no page root, so the block that already ships is untouched', () => {
    // A root wrapping the rules would be a block whose text is every rule on
    // the page, duplicating each rule's own <article> for anything reading both.
    assert.ok(!rules.includes('class="page"'))
    assert.equal(openTags(rules).filter((t) => t.includes('data-kind')).length, 0)
  })

  test('a step carries the rules it links down to, on its own open tag', () => {
    // Descendant data-* are not collected. An attribute on the <p> holding the
    // link, or on the <a> itself, is invisible to the index that needs it.
    assert.deepEqual(steps(flow)['the-basket-is-submitted'], 'ORD-001')
    assert.match(flow,
      /<section class="prose-group" id="the-basket-is-submitted" data-rules="ORD-001">/)
  })

  test('more than one rule is whitespace-separated, the way class and rel are', () => {
    // Deduplicated, and in the order the reader meets them — the table names
    // ORD-003 twice before it reaches ORD-002.
    assert.equal(steps(flow)['what-can-go-wrong'], 'ORD-003 ORD-002')
    assert.equal(steps(guide)['if-it-doesnt-work'], 'ORD-002 ORD-003')
    for (const v of Object.values({ ...steps(flow), ...steps(guide) })) {
      if (v !== null) assert.ok(!/[,;|]/.test(v), `"${v}" invented a separator`)
    }
  })

  test('a step that covers nothing carries no attribute, rather than an empty one', () => {
    // A consumer that stores each data-* as one exact-match facet would file
    // every prose step under an empty `rules` facet. Absence already says it.
    assert.equal(steps(guide)['find-the-order'], null)
    assert.equal(steps(guide)['what-a-human-still-has-to-check'], null)
    assert.ok(!guide.includes('data-rules=""'))
  })

  test('no key is one a consumer drops as presentational, and no value can truncate one', () => {
    // `copy`, `theme`, `cols`, `label` and `tone` are dropped on arrival. A
    // quote character truncates the value in an extractor reading raw HTML.
    const dropped = ['copy', 'theme', 'cols', 'label', 'tone']
    for (const [file, html] of Object.entries({ flow, guide, rules })) {
      for (const tag of openTags(html)) {
        for (const [, key, value] of tag.matchAll(/\bdata-([\w-]+)="([^"]*)"/g)) {
          assert.equal(key, key.toLowerCase(), `${file}: data-${key} is not lowercased`)
          assert.ok(!dropped.includes(key), `${file}: data-${key} is dropped as presentational`)
          assert.ok(!value.includes('"') && !value.includes('&quot;'),
            `${file}: data-${key} carries a quote`)
        }
      }
    }
  })

  test('a rule a step covers names that step\'s page back, on both surfaces', () => {
    // The anti-drift assertion. One build cannot answer "which rules does this
    // step cover" and "which narratives cover this rule" with different facts.
    const byId = Object.fromEntries(r.rules.map((x) => [x.id, x]))
    for (const [page, html] of [['flows/placing-an-order.md', flow],
                                ['guides/refund-an-order.md', guide]]) {
      const covered = new Set(Object.values(steps(html))
        .filter(Boolean).flatMap((v) => v.split(' ')))
      assert.ok(covered.size, `${page} covers nothing at all`)
      for (const id of covered) {
        assert.ok(byId[id], `${page} covers ${id}, which rules.json does not publish`)
        assert.ok(byId[id].appearsIn.some((a) => a.page === page),
          `${page} covers ${id} and ${id} does not name ${page} back`)
      }
      // And the other direction, which holds because every rule link in this
      // fixture sits inside a step. A link in the lead belongs to no step, so
      // it reaches appearsIn with no data-rules anywhere — asserted separately.
      for (const rule of r.rules) {
        if (!rule.appearsIn.some((a) => a.page === page)) continue
        assert.ok(covered.has(rule.id), `${rule.id} names ${page} and no step covers it`)
      }
    }
  })

  test('a rule reached only from the lead reaches the root, and no step claims it', () => {
    // Structural: a guide that names a rule once, in its introduction, has no
    // step to hang it on. Observed on a real corpus too — one guide linked a
    // rule from its lead and never again, which step-only attributes would
    // leave with no `data-rules` anywhere and the guide unfindable by it.
    const r2 = adHoc({
      'docs.json': JSON.stringify({ name: 'x', navigation: { groups: [
        { group: 'Rules', pages: ['rules/a'] },
        { group: 'Guides', pages: ['guides/g'] }] } }),
      'rules/a.md': '---\narea: x\n---\n\n# A\n\n<a id="aaa-001"></a>\n' +
        '### AAA-001 — A thing is true\n\n**Source:** `core:x.cs`\n\n' +
        '<a id="aaa-002"></a>\n### AAA-002 — Another thing\n\n**Source:** `core:y.cs`\n',
      'guides/g.md': '---\nverified: never\n---\n\n# G\n\n' +
        'This guide is about [AAA-001](../rules/a.md#aaa-001).\n\n' +
        '## A step that covers nothing\n\nPress the button.\n\n' +
        '## A step that covers one\n\nSee [AAA-002](../rules/a.md#aaa-002).\n',
    })
    const html = r2.read('guides-g.html')
    assert.equal(JSON.parse(r2.read('rules.json')).rules[0].appearsIn.length, 1)
    // Lead first, because that is where it sits in the document.
    assert.match(html, /<article class="page" data-kind="guide" data-rules="AAA-001 AAA-002">/)
    assert.equal(/id="a-step-that-covers-nothing"([^>]*)>/.exec(html)[1], '')
    assert.match(html, /id="a-step-that-covers-one" data-rules="AAA-002"/)
    // AAA-001 exists on exactly one block: the root. Nothing invented a step.
    assert.equal((html.match(/data-rules="[^"]*AAA-001/g) || []).length, 1)
  })

  test('a rule a step only prints is not a rule that step covers', () => {
    // The link is read out of the rendered page rather than out of the
    // markdown, and this is what that buys. A rule ID inside a fenced example
    // is text, and a rule ID inside a raw HTML block is dropped by the build
    // before it ever renders — the markdown form of this scan counts both, and
    // then a machine surface names a rule that appears nowhere on the page.
    const r2 = adHoc({
      'docs.json': JSON.stringify({ name: 'x', navigation: { groups: [
        { group: 'Rules', pages: ['rules/a'] },
        { group: 'Guides', pages: ['guides/g'] }] } }),
      'rules/a.md': '---\narea: x\n---\n\n# A\n\n<a id="aaa-001"></a>\n' +
        '### AAA-001 — A thing is true\n\n**Source:** `core:x.cs`\n\n' +
        '<a id="aaa-002"></a>\n### AAA-002 — Another thing\n\n**Source:** `core:y.cs`\n',
      'guides/g.md': '---\nverified: never\n---\n\n# G\n\n' +
        '## Printing a link\n\nWrite it like this:\n\n' +
        '```\n[AAA-001](../rules/a.md#aaa-001)\n```\n\n' +
        '<div>Or <a href="../rules/a.md#aaa-001">like this</a>.</div>\n\n' +
        '## Following a link\n\nSee [AAA-002](../rules/a.md#aaa-002).\n',
    })
    const html = r2.read('guides-g.html')
    assert.equal(/id="printing-a-link"([^>]*)>/.exec(html)[1], '',
      'neither a fenced example nor a dropped HTML block is a rule the step covers')
    assert.match(html, /id="following-a-link" data-rules="AAA-002"/)
    const byId = Object.fromEntries(
      JSON.parse(r2.read('rules.json')).rules.map((x) => [x.id, x.appearsIn.length]))
    assert.deepEqual(byId, { 'AAA-001': 0, 'AAA-002': 1 })
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

  test('a group that cannot move the reader is not unhidden', () => {
    // The collapse keeps the group holding the current page. On a one-page
    // group that is a link to the page you are already on — the H1 restated
    // above itself, which is the breadcrumb this design cut. The second :has()
    // is what makes the rule select for `can this move me` rather than for
    // `am I in it`.
    const css = fs.readFileSync(
      path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    assert.match(css,
      /\.side \.nav-g:has\(a\[aria-current='page'\]\):has\(a:not\(\[aria-current\]\)\)/)
    assert.ok(!/\.side \.nav-g:has\(a\[aria-current='page'\]\) \{/.test(css),
      'the unqualified unhide is what rendered the self-link')
  })

  test('every page carries a way out of the collapse, and it is a route', () => {
    // At most one group survives below 860px, so a reader who does not know
    // what to search for needs somewhere to go. A link, not a disclosure: the
    // route is already a browsable index of the whole corpus.
    for (const p of r.pages) {
      const html = read(r.out, p.path.replace(/\//g, '-').replace(/\.md$/, '.html'))
      const nav = /<nav class="side"[\s\S]*?<\/nav>/.exec(html)[0]
      assert.match(nav, /<a class="side-index" href="search\.html">All pages<span>7<\/span><\/a>/,
        `${p.path} has no way out of the collapse`)
      assert.ok(!nav.includes('<details'), 'the way out is a route, not a disclosure')
    }
  })

  test('the way out is spent only where the ledger is off screen', () => {
    const css = fs.readFileSync(
      path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    // Above the collapse point the whole ledger is on screen and the row would
    // be a fourth control for something already visible; on the route itself
    // every group is rendered and the row would point at its own page.
    assert.match(css, /^\.side-index \{ display: none; \}$/m)
    assert.match(css, /\[data-page='search'\] \.side-index \{ display: none; \}/)
  })

  test('nothing in the stylesheet moves when the default font size does', () => {
    // `--mark-w` was the only rem length in a file whose every font-size is px.
    // Raising Chrome's default font size widened the ID/verdict channel and
    // took it out of the `minmax(0, 1fr)` prose track beside it: about 80px
    // less prose, and not one larger character.
    for (const f of ['viewer.css', 'tokens.css']) {
      const css = fs.readFileSync(
        path.join(import.meta.dirname, '../src/theme/', f), 'utf8')
      assert.deepEqual([...css.matchAll(/[\d.]+rem\b/g)].map((m) => m[0]), [],
        `${f} must be consistently px, not px with one rem in it`)
    }
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
  //
  // These three used to assert that a `.sheet` div reached the document, which
  // worked only by accident: it was appended two thirds of the way down the
  // file, so anything that threw after it still passed. viewer.js now records
  // reaching its own last line, which is the fact these tests were always
  // reaching for — the client layer threw on every hashless load for the life
  // of v0.1.0 and nothing said so, because everything it powers degrades quietly.
  function load({ hash, page = null, selectors = {} }) {
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
    const root = { dataset: {} }
    const sandbox = {
      document: {
        documentElement: root,
        body: { appendChild: (n) => appended.push(n) },
        createElement: () => el(),
        getElementById: () => null,
        querySelector: (s) =>
          s === '.search-page' ? page : Object.hasOwn(selectors, s) ? selectors[s] : null,
        querySelectorAll: () => [],
      },
      location: { hash, pathname: '/p.html', search: '', href: 'http://x/p.html', replace() {} },
      history: { replaceState() {}, pushState() {} },
      localStorage: { getItem: () => null, setItem() {} },
      matchMedia: () => ({ matches: false }),
      addEventListener() {},
      URLSearchParams,
      IntersectionObserver: class { observe() {} },
      setTimeout, clearTimeout, console,
    }
    sandbox.window = sandbox
    vm.createContext(sandbox)
    vm.runInContext(fs.readFileSync(VIEWER, 'utf8'), sandbox, { filename: 'viewer.js' })
    return { appended, root, sandbox }
  }

  const ran = (opts) => load(opts).root.dataset.viewer === 'ready'

  test('the key bar reads the page\'s own strip, never a back-link\'s chip', () => {
    // A rules page can now carry pending tone that is NOT about this page: the
    // back-link renders each narrative's own `verified:` state, so `.w-vfy`
    // chips describe OTHER pages' frontmatter. The key bar's lookup is scoped
    // to `.page-provenance` for exactly that reason. Unscope it and a rules
    // page nobody claimed anything about starts announcing "Human-verified
    // never" — sourced from a guide it merely links to. Two verification
    // surfaces, two frontmatter sources; only one of them is this page's.
    const dt = { innerHTML: '<span>seen</span>' }
    const keyEl = { children: [{ querySelector: () => dt }], querySelectorAll: () => [dt] }
    const barEl = { innerHTML: '', hidden: false, setAttribute() {} }
    load({ hash: '', selectors: {
      '.ev-key': keyEl,
      '.keybar': barEl,
      // Present, so an UNSCOPED lookup would find it. Absent under the scoped
      // key, which is what the shipped selector asks for.
      '[data-tone="pending"]': { innerHTML: 'never' },
    } })
    assert.ok(barEl.innerHTML.includes('seen'), 'the key bar still renders the legend')
    assert.ok(!barEl.innerHTML.includes('Human-verified'),
      'a back-link chip must not be read as this page having gone unverified')
  })

  test('it survives a load with no fragment, which is most loads', () => {
    // `id && getElementById(id)` is '' with no hash, '' is not nullish, so `?.`
    // does not short-circuit and ''.classList.contains threw — killing every
    // line after it, which was most of the client layer.
    assert.ok(ran({ hash: '' }), 'the client layer did not reach its last line')
  })

  test('and still works arriving on a deep link, which is how it hid', () => {
    assert.ok(ran({ hash: '#ord-003' }))
  })

  test('it survives a fragment that will not percent-decode', () => {
    // `#50%-off` makes decodeURIComponent throw URIError. Unguarded at the top
    // level it took out the same everything the empty hash did — a different
    // trigger reaching the identical failure.
    assert.ok(ran({ hash: '#50%-off' }),
      'a fragment that will not decode must not cost the reader the page')
  })

  test('it does not fetch, and never writes a corpus string into innerHTML', () => {
    // The route's whole point. The index arrives baked and escaped by the
    // generator, so there is no request to race and no markup to construct.
    const src = fs.readFileSync(VIEWER, 'utf8')
    assert.ok(!/fetch\(/.test(src), 'the client layer no longer fetches anything')
    assert.ok(!/\.sheet|role="dialog"|aria-modal/.test(src), 'no dialog survives')
    // The search block runs to the end of the file, so everything from its
    // banner down is the route. Comments stripped first: this section explains
    // at length what it no longer does, and those sentences are not code.
    const code = src.replace(/^\s*\/\/.*$/gm, '')
    const i = code.indexOf('── search')
    assert.ok(i > 0, 'the search section is still labelled')
    assert.ok(!/innerHTML/.test(code.slice(i)), 'the query is written with textContent only')
  })

  // A stub search page, so the filter runs for real rather than being asserted
  // about from the source.
  function searchPage() {
    const rows = [
      { dataset: { t: 'ord-001 ord001 an order cannot be placed' }, hidden: false },
      { dataset: { t: 'guides/refund-an-order.md refund an order guide' }, hidden: false },
    ]
    const count = { textContent: '' }
    const input = { value: '', handler: null, focus() {},
      addEventListener(_, fn) { this.handler = fn } }
    return { rows, count, input,
      querySelector: (s) => (s === '#q' ? input : s === '.search-count' ? count : null),
      querySelectorAll: () => rows }
  }

  test('the route filters on arrival, so a pasted ?q= link answers itself', () => {
    const page = searchPage()
    const { sandbox } = load({ hash: '', page })
    sandbox.location.search = '?q=refund'
    // Re-run with the query present: the arriving reader never types.
    const page2 = searchPage()
    const s2 = load({ hash: '', page: page2 })
    s2.sandbox.location.search = ''
    assert.equal(page.count.textContent, '2 entries', 'no query lists everything')
    assert.deepEqual(page.rows.map((r) => r.hidden), [false, false])
  })

  test('a query that matches nothing says so, and says it in a live region', () => {
    const page = searchPage()
    load({ hash: '', page })
    page.input.value = 'ordzz'
    page.input.handler()
    assert.equal(page.count.textContent, 'Nothing matches ordzz')
    assert.deepEqual(page.rows.map((r) => r.hidden), [true, true])
    // And the count element the generator emits carries the live region, so
    // this sentence is announced rather than only drawn.
    const src = fs.readFileSync(path.join(import.meta.dirname, '../src/build.mjs'), 'utf8')
    assert.match(src, /class="search-count" role="status" aria-live="polite"/)
  })

  test('a query the reader types filters without constructing any markup', () => {
    const page = searchPage()
    load({ hash: '', page })
    page.input.value = 'refund'
    page.input.handler()
    assert.equal(page.count.textContent, '1 of 2 match refund')
    assert.deepEqual(page.rows.map((r) => r.hidden), [true, false])
    // The hostile string that used to execute from a keystroke is now just text.
    page.input.value = '<img src=x onerror=alert(1)>'
    page.input.handler()
    assert.equal(page.count.textContent, 'Nothing matches <img src=x onerror=alert(1)>')
  })

  test('an ID retyped without its hyphen still finds its rule', () => {
    const page = searchPage()
    load({ hash: '', page })
    page.input.value = 'ORD001'
    page.input.handler()
    assert.deepEqual(page.rows.map((r) => r.hidden), [false, true])
  })

  test('the copy toast cannot go on catching clicks after it fades', () => {
    // It is faded with opacity and never removed from the DOM.
    const src = fs.readFileSync(VIEWER, 'utf8')
    const style = /Object\.assign\(n\.style, \{[\s\S]*?\}\)/.exec(src)[0]
    assert.match(style, /pointerEvents: 'none'/)
  })

  test('the one animated motion in the viewer is gated on reduced motion', () => {
    // behavior:'smooth' in the options object overrides computed
    // scroll-behavior, so the CSS reduce block cannot reach it.
    const code = fs.readFileSync(VIEWER, 'utf8').replace(/^\s*\/\/.*$/gm, '')
    assert.match(code, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/)
    assert.ok(!/behavior: 'smooth'/.test(code), 'no unconditional smooth scroll')
  })
})

describe('paper', () => {
  const css = (f) => fs.readFileSync(path.join(import.meta.dirname, '../src/theme', f), 'utf8')

  test('a dark-themed page prints on the light ladder', () => {
    // Browsers drop background colours and honour `color`, so a dark page
    // printed --ink at 1.11:1 on white: blank paper in hairline frames.
    const t = css('tokens.css')
    const screenOnly = /@media screen \{[\s\S]*?\n\}\s*\/\* @media screen \*\//.exec(t)
    assert.ok(screenOnly, 'the dark half is scoped to the screen')
    assert.match(screenOnly[0], /:root\[data-theme="dark"\]/)
    assert.ok(!/^:root\[data-theme="dark"\]/m.test(t.replace(screenOnly[0], '')),
      'no dark override escapes the screen scope')
  })

  test('nothing is silently cut off, because paper cannot scroll', () => {
    const print = /@media print \{[\s\S]*?\n\}/.exec(css('viewer.css'))[0]
    assert.match(print, /pre\.code, \.table-wrap \{ overflow: visible/)
    assert.match(print, /white-space: pre-wrap/)
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

// areaLabels had three read sites keyed three different ways: the ledger and
// the nav label on the `rules/<dir>/` directory, the page warrant on the page's
// own `area:` frontmatter. docs.config.example.json teaches the hyphenated
// directory spelling, so for any multi-word area the warrant lookup could never
// hit — the nav showed the declared label and the warrant showed the raw folder
// name, in a build that reported nothing wrong.
//
// The shared config below declares the FRONTMATTER spelling over hyphenated
// directories, deliberately. Declaring the directory spelling makes the two nav
// lookups exact-match hits that never exercise the canonicalisation at all, and
// both of them silently revert to `config.areaLabels[dir]` with the suite green.
describe('area labels', () => {
  const LABEL = 'Auth and organisations'
  const files = {
    'docs.json': JSON.stringify({
      name: 'Ad hoc',
      navigation: { groups: [
        // The area index in the Rules group is labelled by the ledger; the one
        // in another group is labelled by the plain nav-label path. Both used
        // to key on the directory, and neither agreed with the warrant.
        { group: 'Rules', pages: ['rules/auth-organizations/index'] },
        { group: 'Not yet documented', pages: ['rules/user-mgmt/index'] },
      ] },
    }),
    'rules/auth-organizations/index.md':
      '---\narea: AuthOrganizations\n---\n\n# AuthOrganizations\n\n' +
      '### AUTH-001 — A session ends when its refresh token is revoked\n\n' +
      '**Status:** implemented · **Test:** `core:Auth > revoke` · **Source:** `core:Auth.cs`\n',
    'rules/user-mgmt/index.md': '---\narea: User Mgmt\n---\n\n# UserMgmt\n\nStub.\n',
  }
  const config = { areaLabels: {
    AuthOrganizations: LABEL, 'User Mgmt': 'Users and teams',
  } }
  const warrantOf = (html) => /<div class="page-warrant">[\s\S]*?<\/div>/.exec(html)[0]
  const navOf = (html) => /<nav class="side"[\s\S]*?<\/nav>/.exec(html)[0]

  test('the frontmatter spelling declared in config also labels the ledger row', () => {
    const r = adHoc(files, { config })
    const html = r.read('rules-auth-organizations-index.html')
    assert.ok(navOf(html).includes(`>${LABEL}</a>`), 'the ledger keys on the directory')
    assert.ok(warrantOf(html).includes(LABEL))
    assert.ok(!warrantOf(html).includes('AuthOrganizations'),
      'the raw name is the exact thing areaLabels exists to suppress')
  })

  test('the ledger row and the warrant on one page cannot disagree', () => {
    const r = adHoc(files, { config })
    const html = r.read('rules-auth-organizations-index.html')
    assert.equal((html.match(new RegExp(LABEL, 'g')) || []).length, 2,
      'once in the nav and once in the warrant, from one declared entry')
  })

  test('a space, a hyphen and a capital are the same area', () => {
    const r = adHoc(files, { config })
    // `User Mgmt` declared, `User Mgmt` in frontmatter, `user-mgmt` the
    // directory: the nav-label path must canonicalise to reach the entry.
    const html = r.read('rules-user-mgmt-index.html')
    assert.ok(warrantOf(html).includes('Users and teams'))
    assert.ok(navOf(html).includes('>Users and teams</a>'), 'the nav-label path canonicalises')
    assert.deepEqual(r.warnings, [], 'nothing here is unresolved')
  })

  test('digits are part of the key, so v1 and v2 are two areas', () => {
    // docs.config.example.json ships `billing-v2`, so the digit class is the
    // documented case. Strip digits and both keys collapse to one entry and
    // every page of one area takes the other's label.
    const r = adHoc({
      'docs.json': docsJson(['rules/billing-v1/index', 'rules/billing-v2/index']),
      'rules/billing-v1/index.md': '---\narea: billing-v1\n---\n\n# One\n\nBody.\n',
      'rules/billing-v2/index.md': '---\narea: billing-v2\n---\n\n# Two\n\nBody.\n',
    }, { config: { areaLabels: { 'billing-v1': 'Billing (legacy)', 'billing-v2': 'Billing' } } })
    assert.deepEqual(r.warnings, [])
    assert.ok(warrantOf(r.read('rules-billing-v1-index.html')).includes('Billing (legacy)'))
    const two = warrantOf(r.read('rules-billing-v2-index.html'))
    assert.ok(two.includes('Billing') && !two.includes('legacy'))
  })

  test('a Latin diacritic folds, so an ASCII directory finds an accented area', () => {
    const r = adHoc({
      'docs.json': docsJson(['rules/uberweisungen/index']),
      'rules/uberweisungen/index.md': '---\narea: Überweisungen\n---\n\n# U\n\nBody.\n',
    }, { config: { areaLabels: { uberweisungen: 'Transfers' } } })
    assert.deepEqual(r.warnings, [])
    assert.ok(warrantOf(r.read('rules-uberweisungen-index.html')).includes('Transfers'))
  })

  test('a combining mark outside the Latin block is a letter, not decoration', () => {
    // NFKD splits ガ into カ + ゙. Stripping the whole \p{M} class then makes
    // ガード (guard) and カード (card) the same area, and one takes the other's label.
    const r = adHoc({
      'docs.json': docsJson(['rules/guard/index', 'rules/card/index']),
      'rules/guard/index.md': '---\narea: ガード\n---\n\n# G\n\nBody.\n',
      'rules/card/index.md': '---\narea: カード\n---\n\n# C\n\nBody.\n',
    }, { config: { areaLabels: { 'ガード': 'Guard rails', 'カード': 'Payment cards' } } })
    assert.deepEqual(r.warnings, [], 'two distinct areas, not one duplicate')
    assert.ok(warrantOf(r.read('rules-guard-index.html')).includes('Guard rails'))
    assert.ok(warrantOf(r.read('rules-card-index.html')).includes('Payment cards'))
  })

  test('an area that matches no key renders its raw name, never nothing', () => {
    // Both `|| raw` fallbacks: the warrant's `|| page.data.area` and the
    // ledger's `|| dir`. areaLabel returns null rather than the input so that
    // each site can keep its own, and dropping either empties the slot.
    const r = adHoc({
      'docs.json': docsJson(['rules/billing/index']),
      'rules/billing/index.md': '---\narea: Billing Ops\n---\n\n# B\n\nBody.\n',
    }, { config: { areaLabels: {} } })
    assert.deepEqual(r.warnings, [])
    assert.ok(warrantOf(r.read('rules-billing-index.html')).includes('Billing Ops'))
    assert.ok(navOf(r.read('rules-billing-index.html')).includes('>billing</a>'))
  })

  test('a key with no letters or digits still matches the directory it names', () => {
    // '_' canonicalises to '', and so does a page with no `area:` at all, so it
    // cannot go in the shared key space. It stays reachable by the exact string
    // it was declared under, which is all the pre-canonical lookup matched it
    // by — dropping it regressed a config that used to render correctly.
    const r = adHoc({
      'docs.json': docsJson(['rules/_/index', 'rules/orders/index']),
      'rules/_/index.md': '# Scratch\n\nNo frontmatter at all.\n',
      'rules/orders/index.md': '# Orders\n\nAlso no frontmatter.\n',
    }, { config: { areaLabels: { _: 'Scratch space' } } })
    assert.deepEqual(r.warnings, [])
    const html = r.read('rules-_-index.html')
    assert.ok(navOf(html).includes('>Scratch space</a>'))
    // The empty key must not answer for a page that simply has no area.
    assert.ok(!warrantOf(r.read('rules-orders-index.html')).includes('Scratch space'))
  })

  test('two spellings carrying one label are the old workaround, not an error', () => {
    // Before the key spaces were joined, declaring both spellings was the ONLY
    // way to get a correct site. Those configs render identically now, so
    // failing their build over a redundant key breaks the one group of
    // consumers who had it right.
    const r = adHoc(files, { config: { areaLabels: {
      AuthOrganizations: LABEL, 'auth-organizations': LABEL, 'User Mgmt': 'Users and teams',
    } } })
    assert.deepEqual(r.warnings, [])
    assert.ok(warrantOf(r.read('rules-auth-organizations-index.html')).includes(LABEL))
  })

  test('two spellings carrying different labels are named, and the first wins', () => {
    const r = adHoc(files, { config: { areaLabels: {
      AuthOrganizations: 'First', 'auth-organizations': 'Second', 'User Mgmt': 'Users and teams',
    } } })
    assert.ok(r.warnings.some((w) =>
      /declares both "AuthOrganizations" and "auth-organizations" for the same area with different labels/.test(w)))
    const html = r.read('rules-auth-organizations-index.html')
    assert.ok(html.includes('First') && !html.includes('Second'))
  })

  test('a declared key naming no published area is reported, so --strict can fail on it', () => {
    const r = adHoc(files, { config: { areaLabels: {
      ...config.areaLabels, 'billing-v2': 'Billing',
    } } })
    assert.ok(r.warnings.some((w) =>
      /areaLabels declares "billing-v2" but no area the corpus publishes resolves to it/.test(w)))
    assert.ok(!r.warnings.some((w) => /"AuthOrganizations"|"User Mgmt"/.test(w)),
      'the keys that do name a published area are not reported')
  })

  test('a key naming a published area is never reported, whatever reads it', () => {
    // The sweep must measure the corpus, not which lookups fired. Two of the
    // three read sites are conditional — the ledger only inside a group named
    // `Rules`, the nav label only on an index.md — so a perfectly spelt key can
    // go unconsulted, and calling that unresolved reddens a correct build.
    const r = adHoc({
      'docs.json': JSON.stringify({ name: 'Ad hoc', navigation: { groups: [
        { group: 'Not yet documented', pages: ['rules/billing/overview'] },
      ] } }),
      'rules/billing/overview.md': '# Billing\n\nNo frontmatter, no index, no Rules group.\n',
    }, { config: { areaLabels: { billing: 'Billing and invoicing' } } })
    assert.deepEqual(r.warnings, [], 'rules/billing/ is published and spelt exactly as declared')
  })

  test('a page whose area disagrees with its own directory is named', () => {
    // The residual split: canonicalising joins every spelling of one word, not
    // two different words. The directory resolves, the frontmatter does not, so
    // the nav says one thing and the page says another.
    const r = adHoc({
      'docs.json': docsJson(['rules/billing/index']),
      'rules/billing/index.md': '---\narea: Payments\n---\n\n# B\n\nBody.\n',
    }, { config: { areaLabels: { billing: 'Billing' } } })
    assert.ok(r.warnings.some((w) =>
      /declares area: "Payments", which matches no areaLabels key, while its directory "billing" does/.test(w)))
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

// DESIGN.md rules that search is a route, not a modal: a real URL, so the back
// button works and a query is pasteable, and no dialog, so there is no focus
// trap to get wrong and no JavaScript floor to fall through. What shipped at
// v0.1.0 was the modal mobile sheet that the same document cut outright.
describe('the search route', () => {
  let r, html
  before(() => { r = run(); html = read(r.out, 'search.html') })

  test('it is a page at a URL, with no dialog anywhere in the built site', () => {
    for (const f of fs.readdirSync(r.out).filter((x) => x.endsWith('.html'))) {
      const page = read(r.out, f)
      assert.ok(!/class="sheet"|role="dialog"|aria-modal/.test(page), `${f} still has an overlay`)
    }
    const css = fs.readFileSync(path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    assert.ok(!/^\.sheet\b/m.test(css), 'the sheet styles are gone too')
  })

  test('every page reaches it with a plain link, so it works with JavaScript off', () => {
    // It was a <button> wired by script: with JS off there was no search at
    // all, and below 860px no nav group but the current page's either.
    for (const p of r.pages) {
      const page = read(r.out, p.path.replace(/\//g, '-').replace(/\.md$/, '.html'))
      assert.match(page, /<a class="search-open" href="search\.html">/,
        `${p.path} has no route to search without script`)
    }
  })

  test('the index is the whole corpus, not only the rules', () => {
    // rules.json indexes rules, so guides, flows, status, README and area
    // indexes were absent from search entirely — and a search returning
    // nothing has to mean the behaviour is undocumented, not "not indexed".
    const rows = [...html.matchAll(/<li data-t="([^"]*)"><a href="([^"]+)"/g)]
    assert.equal(rows.length, r.pages.length + r.rules.length)
    for (const p of r.pages) {
      const href = p.path.replace(/\//g, '-').replace(/\.md$/, '.html')
      assert.ok(rows.some((m) => m[2] === href), `${p.path} is not in the index`)
    }
    for (const rule of r.rules) {
      assert.ok(rows.some((m) => m[2].endsWith(`#${rule.anchor}`)), `${rule.id} is not in the index`)
    }
  })

  test('the two searches once recorded as unanswerable now answer', () => {
    const rows = [...html.matchAll(/<li data-t="([^"]*)"><a href="([^"]+)"/g)]
    const hits = (q) => rows.filter((m) => m[1].includes(q)).map((m) => m[2])
    // 'inventory' returned nothing on a phone, because an undocumented area
    // has no rules and only rules were indexed.
    assert.deepEqual(hits('inventory'), ['rules-inventory-index.html'])
    // 'refund' returned the rule but never the guide of the same name.
    assert.ok(hits('refund').includes('guides-refund-an-order.html'))
  })

  test('corpus text is escaped by the generator, not by the client', () => {
    // The sheet wrote r.statement into innerHTML with only [*_`] stripped, so
    // a rule stating something about a `<script>` tag emitted a real one and
    // swallowed the rest of the result list.
    const a = adHoc({
      'docs.json': docsJson(['rules/a/x']),
      'rules/a/x.md': '# A\n\n### AAA-001 — A `<script>` tag in a note is escaped on render\n\n' +
        '**Status:** implemented · **Source:** `core:A.cs`\n',
    })
    const s = a.read('search.html')
    assert.ok(!s.includes('<script>'), 'a corpus statement cannot open a tag')
    assert.match(s, /&lt;script&gt;/)
  })

  test('a corpus page that would overwrite the route is named', () => {
    const a = adHoc({
      'docs.json': JSON.stringify({ name: 'Ad hoc', navigation: { groups: [
        { group: 'Guides', pages: ['search'] } ] } }),
      'search.md': '# Search\n\nA corpus page that flattens onto the route.\n',
    })
    assert.ok(a.warnings.some((w) => /search\.md builds to search\.html, which the search route reserves/.test(w)),
      'a page silently overwritten by the generator is the same loss as a collision')
  })

  test('a Rules-group page filed outside rules/ is named, not a stack trace', () => {
    // Found by the test above: the ledger grouped by `rel.split('/')[1]`, which
    // is undefined for a top-level page, and esc(undefined) threw. Pre-existing
    // since v0.1.0 and unrelated to search, but reachable the same way.
    const a = adHoc({
      'docs.json': docsJson(['overview']),
      'overview.md': '# Overview\n\nDeclared under Rules, filed at the root.\n',
    })
    assert.equal(a.pages.length, 1, 'the build completes')
    assert.ok(a.warnings.some((w) => /overview\.md is in the Rules group but not under rules\/<area>\//.test(w)))
  })

  test('the route shows every nav group where other pages collapse to one', () => {
    // The collapse keeps the group holding the current page and decides that by
    // aria-current. The route is not a corpus page, so nothing there is
    // current, and without this it would render the empty sidebar the ledger
    // fix removed everywhere else.
    assert.match(html, /<html lang="en" data-theme="light" data-page="search">/)
    assert.equal((html.match(/aria-current="page"/g) || []).length, 0)
    assert.ok((html.match(/class="nav-g/g) || []).length > 1, 'every group is present')
    const css = fs.readFileSync(path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    const guard = /@supports selector\(:has\(a\)\) \{([\s\S]*?)\n  \}/.exec(css)
    assert.match(guard[1], /\[data-page='search'\] \.side \.nav-g \{ display: block; \}/)
  })

  test('the floor is the whole index, and it says so until script proves otherwise', () => {
    assert.match(html, /class="search-nojs"/)
    const css = fs.readFileSync(path.join(import.meta.dirname, '../src/theme/viewer.css'), 'utf8')
    assert.match(css, /\[data-viewer='ready'\] \.search-nojs \{ display: none; \}/)
  })

  test('rules.json is untouched by any of it', () => {
    // The build-over-build diff's door: stable IDs, schema 2, caveat kinds an
    // enum. The route reads the same data and adds nothing to the contract.
    const j = JSON.parse(read(r.out, 'rules.json'))
    assert.deepEqual(Object.keys(j), ['schema', 'generatedAt', 'name', 'environment', 'rules'])
    assert.equal(j.schema, 2)
  })
})

describe('citations that contain the note delimiter', () => {
  const page = (meta) => ({
    'docs.json': docsJson(['rules/x/index']),
    'rules/x/index.md': `# X\n\n## G\n\n<a id="bb-001"></a>\n### BB-001 — A rule\n\n${meta}\n`,
  })

  test('an em dash inside a cited test name does not eat the citation', () => {
    // Splitting on the first " — " blind left the rule with NO citations, so it
    // rendered "No test" and earned "nothing tests this" — a false statement
    // about the codebase, produced silently. 144 of one real corpus's test
    // names contain one.
    const r = adHoc(page('**Status:** implemented · **Test:** `r:regionPlane — every container is classified` · **Source:** `r:a.ts`'))
    const rule = JSON.parse(r.read('rules.json')).rules[0]
    assert.deepEqual(rule.tests, [{ repo: 'r', name: 'regionPlane — every container is classified' }])
    assert.deepEqual(r.warnings, [])
  })

  test('a real prose note after the citations still parses', () => {
    const r = adHoc(page('**Status:** implemented · **Source:** `r:a.ts` — the deduction happens at settlement'))
    const html = r.read('rules-x-index.html')
    assert.match(html, /the deduction happens at settlement/)
    assert.deepEqual(JSON.parse(r.read('rules.json')).rules[0].sources, [{ repo: 'r', path: 'a.ts', member: null }])
  })

  test('an em dash in a citation AND a note both survive together', () => {
    const r = adHoc(page('**Status:** implemented · **Test:** `r:does a — b thing` · **Source:** `r:a.ts` — a note'))
    const rule = JSON.parse(r.read('rules.json')).rules[0]
    assert.equal(rule.tests[0].name, 'does a — b thing')
    assert.match(r.read('rules-x-index.html'), /a note/)
  })

  test('an unclosed backtick is named, not silently swallowed', () => {
    const r = adHoc(page('**Status:** implemented · **Test:** `r:broken · **Source:** `r:b.ts`'))
    assert.ok(r.warnings.some((w) => /BB-001 has an unclosed backtick in its \*\*Test:\*\* field/.test(w)),
      `got ${JSON.stringify(r.warnings)}`)
  })
})

describe('the rule address', () => {
  const two = (a1, a2) => ({
    'docs.json': docsJson(['rules/x/index']),
    'rules/x/index.md': `# X\n\n## G\n\n${a1}### AA-001 — First\n\n**Status:** implemented · **Source:** \`r:a.ts\`\n\n${a2}### AA-002 — Second\n\n**Status:** implemented · **Source:** \`r:b.ts\`\n`,
  })
  const ANCHOR = (id) => `<a id="${id}"></a>\n`

  test('an anchor below its heading becomes the NEXT rule\'s address, and says so', () => {
    // The failure that motivated the warning: rule one silently slugifies and
    // everything after it shifts by one, so every pasted link is wrong.
    const r = adHoc({
      'docs.json': docsJson(['rules/x/index']),
      'rules/x/index.md': '# X\n\n## G\n\n### AA-001 — First\n\n<a id="aa-001"></a>\n\n**Status:** implemented · **Source:** `r:a.ts`\n\n### AA-002 — Second\n\n<a id="aa-002"></a>\n\n**Status:** implemented · **Source:** `r:b.ts`\n',
    })
    const rules = JSON.parse(r.read('rules.json')).rules
    assert.equal(rules[1].anchor, 'aa-001', 'the shift is real')
    assert.ok(r.warnings.some((w) => /AA-001 has no <a id> above its heading while others on this page do/.test(w)),
      `got ${JSON.stringify(r.warnings)}`)
  })

  test('anchors above every heading are silent and correct', () => {
    const r = adHoc(two(ANCHOR('aa-001'), ANCHOR('aa-002')))
    const rules = JSON.parse(r.read('rules.json')).rules
    assert.deepEqual(rules.map((x) => x.anchor), ['aa-001', 'aa-002'])
    assert.deepEqual(r.warnings, [])
  })

  test('a page that declares no anchors anywhere has chosen the fallback', () => {
    // Not every corpus hoists explicit anchors, and the slug fallback is
    // deliberate. Warning on non-adoption would fail every such build under
    // --strict, which is on by default.
    const r = adHoc(two('', ''))
    assert.deepEqual(r.warnings, [])
  })
})

describe('the environment block', () => {
  const envOf = (r) => JSON.parse(read(r.out, 'rules.json')).environment

  test('carries the corpus\'s declared file, and only its declared vocabulary', () => {
    const e = envOf(run())
    assert.equal(e.computedAt, '2031-03-04')
    assert.equal(e.baseline, 'origin/release')
    assert.equal(e.sources.length, 2)
    assert.deepEqual(e.sources[0], {
      cite: 'orders', name: 'svc-orders', ref: 'origin/candidate',
      commit: '3f9a1c7e55b0d2418ac6e0f7b91d3a4c6e28f015', ahead: 12, committedAt: '2031-03-02',
    })
  })

  test('is null, and silent, when the corpus declares nothing', () => {
    // Less detail rather than a wrong answer: a corpus that computes no status
    // against source refs has nothing to state, and saying so is not a warning.
    const r = run({ config: {} })
    assert.equal(envOf(r), null)
    assert.deepEqual(r.warnings, [])
  })

  const corpus = {
    'docs.json': docsJson(['rules/orders/index']),
    'rules/orders/index.md': '# Orders\n\n## A rule\n\n<a id="ord-001"></a>\n\n**ORD-001.** A thing is true.\n\n**Status:** implemented · **Source:** `api:Svc/Thing.cs`\n',
  }
  const withEnv = (body) => adHoc(
    { ...corpus, ...(body === null ? {} : { 'meta/environment.json': body }) },
    { config: { environment: { path: 'meta/environment.json' } } })
  const ok = (extra = {}) => JSON.stringify({
    schema: 1, computedAt: '2031-01-01', baseline: 'origin/release',
    sources: [{ cite: 'api', name: 'svc', ref: 'origin/candidate', commit: 'abc123', ahead: 4 }],
    ...extra,
  })

  // Every one of these must be LOUD: --strict is on by default, so a declared
  // surface that quietly yields null is the silent-failure class this repo has
  // already been bitten by once.
  const broken = [
    ['a missing file', null, /environment declared but .* is missing/],
    ['invalid JSON', '{ nope', /not valid JSON/],
    ['the wrong file schema', ok({ schema: 2 }), /declares schema 2, expected 1/],
    ['no sources array', ok({ sources: undefined }), /no "sources" array/],
    ['a source with no commit', JSON.stringify({
      schema: 1, baseline: 'origin/release', sources: [{ cite: 'api' }],
    }), /a source with no commit/],
    ['"ahead" as a string', ok({
      sources: [{ commit: 'abc123', ahead: '4' }],
    }), /"ahead" must be an integer/],
    ['"ahead" with no baseline', JSON.stringify({
      schema: 1, sources: [{ commit: 'abc123', ahead: 4 }],
    }), /"ahead" needs a "baseline"/],
  ]
  for (const [what, body, warning] of broken) {
    test(`warns on ${what}`, () => {
      const r = withEnv(body)
      assert.ok(r.warnings.some((w) => warning.test(w)),
        `expected a warning matching ${warning}, got ${JSON.stringify(r.warnings)}`)
    })
  }

  test('a number nobody can interpret is dropped, not published', () => {
    // `ahead` without `baseline` is ahead of nothing. Keep the honest half.
    const e = envOf(withEnv(JSON.stringify({
      schema: 1, sources: [{ commit: 'abc123', ahead: 4 }],
    })))
    assert.equal(e.baseline, null)
    assert.equal(e.sources[0].ahead, null)
    assert.equal(e.sources[0].commit, 'abc123')
  })

  test('dates the machine surface from the run that computed it', () => {
    // generatedAt used to be grepped out of a human-written sidecar, so a corpus
    // that declared no sidecar dated its machine surface null. The environment
    // block states the same date as data, from the tool that computed it.
    const r = withEnv(ok({ computedAt: '2031-06-06' }))
    assert.equal(JSON.parse(r.read('rules.json')).generatedAt, '2031-06-06')
  })

  test('refuses a baseline that disagrees with the declared production ref', () => {
    // "Matches production" has to mean the ref the corpus calls production.
    const r = adHoc({ ...corpus, 'meta/environment.json': ok() }, {
      config: {
        environment: { path: 'meta/environment.json' },
        refs: { production: 'origin/main', candidate: 'origin/candidate' },
      },
    })
    assert.ok(r.warnings.some((w) => /computed against "origin\/release" but refs\.production is "origin\/main"/.test(w)),
      `got ${JSON.stringify(r.warnings)}`)
  })

  test('is silent when the declared production ref agrees', () => {
    const r = adHoc({ ...corpus, 'meta/environment.json': ok() }, {
      config: {
        environment: { path: 'meta/environment.json' },
        refs: { production: 'origin/release' },
      },
    })
    assert.deepEqual(r.warnings, [])
  })

  test('keys the file invents beyond the contract are not carried through', () => {
    const e = envOf(withEnv(ok({
      sources: [{ commit: 'abc123', dirty: false, lastProcessedSha: 'nope' }],
    })))
    assert.deepEqual(Object.keys(e.sources[0]),
      ['cite', 'name', 'ref', 'commit', 'ahead', 'committedAt'])
  })
})

describe('packaging', () => {
  test('ships no corpus-specific vocabulary as a default', () => {
    const src = fs.readFileSync(path.join(import.meta.dirname, '../src/build.mjs'), 'utf8')
    const cfg = /const defaults = \{[\s\S]*?\n\}\n/.exec(src)[0]
    assert.match(cfg, /areaLabels: \{\}/, 'areaLabels must default empty')
    assert.ok(!/statusSidecar:\s*\{/.test(cfg), 'no sidecar path may be baked in')
  })

  test('learns no consumer\'s field names anywhere, not just in the defaults', () => {
    // The defaults-only form of this guard let a reader through that parsed one
    // customer's sync-state file by its own field names. A surface the template
    // reads must be declared BY the template, so these names can only appear
    // here if the template has started speaking someone else's vocabulary.
    const src = fs.readFileSync(path.join(import.meta.dirname, '../src/build.mjs'), 'utf8')
    for (const name of ['lastProcessedSha', 'aheadOfMain', 'lastRunAt', 'dirtyAtRead', 'orbitalx']) {
      assert.ok(!src.includes(name), `src/build.mjs must not know the identifier "${name}"`)
    }
  })
})
