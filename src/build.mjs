/* arcdoq-docsite — the generator.
 *
 * Turns a markdown corpus into a finished, self-contained static site. No
 * server, no request-time rendering, no theme engine: the output is HTML, CSS,
 * one JS file and a rules.json sidecar, which is exactly what a host serves.
 */

import { marked } from 'marked'
import fs from 'node:fs'
import path from 'node:path'

const THEME = path.join(import.meta.dirname, 'theme')

export function build({ corpus = process.cwd(), out = 'dist', config: overrides = {} } = {}) {
const CORPUS = path.resolve(corpus)
const OUT = path.resolve(out)

/* ── config: everything customer-declarable lives here ───────────────────── */

// docs.json IS the filter and the nav. Reading it rather than restating it
// means the generator cannot disagree with the corpus about what the site
// contains, which is the whole failure mode here.
const docsJsonPath = path.join(CORPUS, 'docs.json')
if (!fs.existsSync(docsJsonPath)) {
  throw new Error(`No docs.json in ${CORPUS}. It declares the nav and the publish set.`)
}
const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'))
const navGroups = docsJson.navigation.groups.map((g) => ({
  group: g.group, pages: g.pages.map((p) => `${p}.md`),
}))

// One line per group, from README.md's own three-content-types table. It is
// read once and forgotten today, and the moment it matters is the moment
// someone is choosing where to click.
const GROUP_NOTE = {
  Rules: 'does X work?',
  Flows: 'what happens when…?',
  Guides: 'how do I…?',
  'Start here': 'what is this corpus?',
  'Not yet documented': 'the gap, on purpose',
  Status: 'what is true where, right now',
}

const defaults = {
  name: docsJson.name,
  accent: docsJson.colors?.primary || '#5B57E8',
  publish: navGroups.flatMap((g) => g.pages),
  rules: { idPattern: /^([A-Z][A-Z0-9]{1,9})-(\d{1,4})$/ },
  // Empty by default. A package shipping ONE customer's vocabulary to every
  // other customer is how a product becomes a fork of itself. Corpora declare
  // their own map in docs.config.json; see docs.config.example.json.
  areaLabels: {},
  status: {
    // README.md, after 56c1538: `implemented` means the cited paths MATCH
    // production, not that anyone exercised the behaviour there. The earlier
    // label "Confirmed against production" overclaimed in exactly the
    // direction the corpus had just corrected.
    implemented:  { label: 'Matches production',           tier: 'confirmed',   origin: 'computed' },
    'in-stage':   { label: 'Not yet in production',        tier: 'unconfirmed', origin: 'computed' },
    'in-dev':     { label: 'Not a release candidate',      tier: 'unconfirmed', origin: 'computed' },
    unknown:      { label: 'Citation does not resolve',    tier: 'broken',      origin: 'computed' },
    unverified:   { label: 'Written, not confirmed',       tier: 'unconfirmed', origin: 'asserted' },
    planned:      { label: 'Decided, not built',           tier: 'unconfirmed', origin: 'asserted' },
    deprecated:   { label: 'No longer true',               tier: 'broken',      origin: 'asserted' },
    undocumented: { label: 'Not written yet',              tier: 'neutral',     origin: 'asserted' },
  },
  evidence: {
    coverageWords: ['all', 'both', 'each', 'every', 'the above'],
    markers: [
      { token: '✅', id: 'seen', short: 'seen',
        label: 'seen rendering in the browser', glyph: 'solid' },
      { token: '\u{1F4C4}', id: 'from-source', short: 'from source',
        label: 'read from source, accurate about what the code does, silent about what renders',
        glyph: 'dashed' },
    ],
  },
}

// Shallow merge per top-level key. A customer overriding `areaLabels` supplies
// the whole map; overriding `status` supplies the whole vocabulary. Deep
// merging a vocabulary is how you end up with half a customer's labels and
// half of ours, which is worse than either.
const config = { ...defaults, ...overrides,
  evidence: { ...defaults.evidence, ...(overrides.evidence || {}) },
  rules: { ...defaults.rules, ...(overrides.rules || {}) },
  areaLabels: { ...defaults.areaLabels, ...(overrides.areaLabels || {}) },
  status: { ...defaults.status, ...(overrides.status || {}) },
}

const warnings = []
const warn = (m) => { if (!warnings.includes(m)) warnings.push(m) }

/* ── area labels: one declared entry, read from three key spaces ─────────── */

// This map was read through three keys that never agreed. The nav label and the
// ledger key on the `rules/<dir>/` directory name; the page warrant keys on the
// page's own `area:` frontmatter, which is a human string the corpus wrote
// ("AuthOrganizations"), not a directory. Nothing normalised between them, and
// docs.config.example.json teaches the hyphenated directory spelling — so for
// every multi-word area the nav showed the declared label and the warrant
// silently showed the raw folder name, which is the one thing this map exists
// to suppress. The build looked entirely correct while doing it, which is the
// worst shape a defect can take here.
//
// One canonical key now serves all three sites: `auth-organizations`,
// `AuthOrganizations` and `Auth Organizations` are the same area, and no corpus
// has to declare a key twice to be found by both spellings.
// `\p{M}` is KEPT. Only the Latin combining block is folded, so an ASCII
// directory still finds an accented `area:`. Dropping the whole mark class
// instead \u2014 which `[^\p{L}\p{N}]` does \u2014 deletes what NFKD has just separated
// out: the dakuten that distinguishes \u30ac\u30fc\u30c9 from \u30ab\u30fc\u30c9, every Devanagari matra,
// every Thai vowel sign. Those are letters, not decoration, and collapsing them
// hands one area another area's label.
const areaKey = (s) => String(s ?? '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')      // an ASCII dir finds an accented area
  .toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '')  // case and separators carry no meaning

const areaByKey = new Map()      // canonical key -> { declared, label }
const areaByExact = new Map()    // raw declared string, for keys with no canonical form
for (const [declared, label] of Object.entries(config.areaLabels)) {
  const k = areaKey(declared)
  // A key of nothing but separators canonicalises to '', and so does a page
  // with no `area:` at all, so '' cannot be a shared key without labelling
  // every unrelated page in the corpus. Such an entry stays reachable by the
  // exact string it was declared under, which is all v0.1.0 ever matched it by.
  if (!k) { areaByExact.set(declared, label); continue }
  const prior = areaByKey.get(k)
  // Two spellings of one area is what the split key spaces used to REQUIRE, so
  // the same label under both is a redundant declaration and collapsing them is
  // provably a no-op \u2014 failing a build over it would break the only configs
  // that were correct before this change. Two DIFFERENT labels are a real
  // clash: one of them is being dropped. That is named, first declaration
  // winning, on the same precedent as a rule ID declared twice.
  if (prior) {
    if (prior.label !== label) {
      warn(`areaLabels declares both "${prior.declared}" and "${declared}" for the same ` +
           `area with different labels; "${prior.declared}" wins`)
    }
    continue
  }
  areaByKey.set(k, { declared, label })
}

// Returns null rather than the input, so each call site keeps its own fallback.
const areaLabel = (s) => {
  const raw = String(s ?? '')
  const k = areaKey(raw)
  if (!k) return areaByExact.get(raw) ?? null
  return areaByKey.get(k)?.label ?? null
}

// Claim counts are accumulated by the renderer itself, never by a second scan
// of the source. Two counts that can disagree is the drift failure this whole
// corpus exists to prevent, and the strip would be the thing telling the lie.
let tally = {}
const count = (id) => { tally[id] = (tally[id] || 0) + 1 }

/* ── small helpers ───────────────────────────────────────────────────────── */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const inline = (md) => marked.parseInline(md ?? '')

// GitHub slug: lowercase, strip outside [a-z0-9 _-], then replace each space
// INDIVIDUALLY without collapsing runs. Collapsing reports live links broken.
const slug = (s) => s.toLowerCase().normalize('NFC')
  .replace(/[^a-z0-9 _-]/g, '').replace(/ /g, '-')

// The page's genre, derived once and read by four surfaces: the warrant's
// label, the search index's key, the narrative kind a rule names back, and the
// `data-kind` a content index reads. It was three separate copies of this
// ternary, which is exactly how a machine attribute ends up disagreeing with
// the word printed beside it on the same page.
const genreOf = (rel) => rel.startsWith('rules/') ? 'Rule'
  : rel.startsWith('flows/') ? 'Flow'
  : rel.startsWith('guides/') ? 'Guide' : 'Page'

function frontmatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src)
  if (!m) return { data: {}, body: src }
  const data = {}
  let key = null
  for (const raw of m[1].split('\n')) {
    if (!raw.trim()) continue
    const kv = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(raw)
    if (kv && !raw.startsWith(' ')) {
      key = kv[1]
      data[key] = kv[2] === '' ? [] : kv[2]
    } else if (key && /^\s*-\s/.test(raw)) {
      if (!Array.isArray(data[key])) data[key] = []
      data[key].push(raw.replace(/^\s*-\s*/, ''))
    } else if (key && Array.isArray(data[key]) && data[key].length) {
      data[key][data[key].length - 1] += ' ' + raw.trim()
    }
  }
  // A key with no inline value is provisionally a list, because that is how
  // `sources:` introduces its `- ` items. One that never received an item was
  // simply empty, and leaving it as [] hands an array to every reader that
  // expects a string — `verified:` alone on a line crashed the render.
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k]) && !data[k].length) data[k] = ''
  }
  return { data, body: src.slice(m[0].length) }
}

/* ── provenance: R1 + guard A (position) + guard B (topic) + R2 ──────────── */

const MARKERS = config.evidence.markers
const MARKER_RE = new RegExp(
  '(' + MARKERS.map((m) => m.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\uFE0F?',
  'gu'
)
const markerById = Object.fromEntries(MARKERS.map((m) => [m.id, m]))
const markerByToken = Object.fromEntries(MARKERS.map((m) => [m.token, m]))

const glyphSvg = (kind) => kind === 'solid'
  ? '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.4"/></svg>'
  : '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.7" fill="none" stroke-width="1.6" stroke-dasharray="2.1 1.9"/></svg>'

// Inline in prose the glyph IS the information and carries its own name. Beside
// a written label — in the key, or on a coverage tag — that name is read out
// immediately before the same words appear as text ("seen, image. seen."), so
// there the glyph is decoration and says nothing.
function markGlyph(m, { labelled = true } = {}) {
  const a = labelled ? `role="img" aria-label="${esc(m.short)}"` : 'aria-hidden="true"'
  return `<span class="ev-mark" data-ev="${m.id}" ${a}>${glyphSvg(m.glyph)}</span>`
}

// Guard A: a token is a mark only when it closes a clause. It is NOT a mark
// when it is used as a noun ("the rest are 📄." / "Wording is 📄 from source").
function isMark(text, start, end) {
  const before = text.slice(0, start).replace(/\s+$/, '')
  const after = text.slice(end).replace(/^[ \t]+/, '')
  if (!before) return false                        // the legend's own cell
  if (/^\./.test(after)) return false              // "... are 📄."
  if (/^[a-z]/.test(after)) return false           // "📄 from source"
  if (after === '' || /^\n/.test(after)) return true  // closes its container
  if (/^\(/.test(after)) return true               // "…**Search addresses…** ✅ (on the…"
  return /[.!?)*`…\]:]$/.test(before)              // a completed clause
}

// A declared token ALWAYS becomes the designed glyph, mark or not. Raw ✅ and
// 📄 are vendor-coloured bitmaps that differ across platforms, cannot take a
// semantic tone, and at body size are optically louder than the sentence they
// annotate. Guard A decides whether it also OPENS a claim run, nothing more.
function deraw(html) {
  return html.replace(MARKER_RE, (t, tok) => markGlyph(markerByToken[tok]))
}

const isCoverageRun = (t) => {
  const words = t.toLowerCase().match(/[a-z]+/g) || []
  if (!words.length) return false
  const cover = new Set([...config.evidence.coverageWords.flatMap((w) => w.split(' ')),
    'only', 'rest', 'remain', 'remains', 'still', 'the', 'are', 'is'])
  return words.every((w) => cover.has(w))
}

// R1. Per block container, a marker CLOSES a run: the run starts at the
// previous marker (or the container start) and ends before this marker.
function provenance(md) {
  MARKER_RE.lastIndex = 0
  const marks = []
  let m
  while ((m = MARKER_RE.exec(md))) {
    if (isMark(md, m.index, m.index + m[0].length)) {
      marks.push({ at: m.index, len: m[0].length, marker: markerByToken[m[1]] })
    }
  }
  if (!marks.length) return deraw(inline(md))

  let out = ''
  let cursor = 0
  for (const mk of marks) {
    const runMd = md.slice(cursor, mk.at)
    // Guard B: a coverage statement is a topic sentence, not a claim.
    if (isCoverageRun(runMd)) {
      out += deraw(inline(runMd)) + markGlyph(mk.marker)
    } else {
      count(mk.marker.id)
      out += `<span class="claim" data-ev="${mk.marker.id}">${deraw(inline(runMd))}` +
             `${markGlyph(mk.marker)}</span>`
    }
    cursor = mk.at + mk.len
  }
  // A run can close mid-parenthetical: "…the rest grey. 📄 (**Added by admin**
  // seen. ✅)" leaves ")" stranded outside the claim that owns it. Trailing
  // punctuation belongs to the run it closes, not to the page.
  let tail = md.slice(cursor)
  const orphan = /^([)\].,;:!?"'’”]+)([\s\S]*)$/.exec(tail)
  if (orphan && out.endsWith('</span>')) {
    out = out.slice(0, -'</span>'.length) + esc(orphan[1]) + '</span>'
    tail = orphan[2]
  }
  if (tail.trim()) out += deraw(inline(tail))   // delegated prose stays unwrapped
  return out
}

const tallyMarks = (md) => {
  MARKER_RE.lastIndex = 0
  const counts = {}
  let m
  while ((m = MARKER_RE.exec(md))) {
    if (!isMark(md, m.index, m.index + m[0].length)) continue
    const id = markerByToken[m[1]].id
    counts[id] = (counts[id] || 0) + 1
  }
  return counts
}

// R2: a paragraph that is nothing but coverage words plus a marker is a
// block-level tag on the block above it. Exists for exactly one line in the
// corpus ("All 📄." governing the import-outcomes table). Narrow, fails safe.
function coverageTag(md) {
  const stripped = md.replace(MARKER_RE, '').trim()
  if (!stripped || stripped.length > 24) return null
  if (!isCoverageRun(stripped)) return null
  MARKER_RE.lastIndex = 0
  const m = MARKER_RE.exec(md)
  return m ? markerByToken[m[1]] : null
}

/* ── the rule metadata line ──────────────────────────────────────────────── */

// The FIRST " — " that is not inside backticks. Scanning for it blind eats any
// citation containing one — 144 of one real corpus's test names do — leaving the
// rule with no citations at all, which then renders as "No test" and earns the
// "nothing tests this" caveat. A silently understated warrant is the one failure
// this whole corpus format exists to prevent, so it cannot be found by eye.
function splitCitationsFromNote(rest) {
  let inCode = false
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '`') { inCode = !inCode; continue }
    if (!inCode && rest.startsWith(' — ', i)) {
      return { cites: rest.slice(0, i), note: rest.slice(i + 3).trim(), balanced: true }
    }
  }
  // An odd number of backticks means the line cannot be read the way it looks.
  return { cites: rest, note: null, balanced: !inCode }
}

function parseMetaLine(md, id) {
  const out = { status: null, tests: [], sources: [], sourceNote: null }
  for (const part of md.split(/\s+·\s+/)) {
    const f = /^\*\*(\w+):\*\*\s*([\s\S]*)$/.exec(part.trim())
    if (!f) continue
    const [, field, rest] = f
    if (field === 'Status') { out.status = rest.trim(); continue }
    const { cites, note, balanced } = splitCitationsFromNote(rest)
    if (!balanced) warn(`${id || 'a rule'} has an unclosed backtick in its **${field}:** field`)
    if (note !== null) out.sourceNote = note
    for (const c of cites.matchAll(/`([^`]+)`/g)) {
      const [repo, ...tail] = c[1].split(':')
      const value = tail.join(':')
      if (field === 'Test') out.tests.push({ repo, name: value })
      if (field === 'Source') {
        const [p, member] = value.split('#')
        out.sources.push({ repo, path: p, member: member || null })
      }
    }
  }
  return out
}

// An OPTIONAL sidecar. Some corpora compute a status token that carries more
// than one fact: the same token can mean "the behaviour changed" or "only the
// evidence changed", and those are not the same answer to "can I rely on this?"
// A corpus that separates them declares where, and under which headings, and
// the renderer respects the split. Everything here is declared, never inferred:
// a package that hardcodes one corpus's section names is that corpus's fork
// wearing a version number.
//
//   "statusSidecar": {
//     "path": "meta/status.md",
//     "appliesTo": "in-stage",
//     "groups": {
//       "<a heading in that file>": {
//         "id": "changed", "label": "…", "tier": "unconfirmed", "caveat": "…"
//       }
//     }
//   }
function readBasisSidecar() {
  const sc = config.statusSidecar
  if (!sc?.path || !sc.groups) return {}
  const p = path.join(CORPUS, sc.path)
  if (!fs.existsSync(p)) { warn(`statusSidecar declared but ${sc.path} is missing`); return {} }
  const md = fs.readFileSync(p, 'utf8')
  const basis = {}
  for (const heading of Object.keys(sc.groups)) {
    const q = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp('#{2,4}\\s+' + q + '[^\\n]*\\n([\\s\\S]*?)(?=\\n#{2,4} |$)')
    const sec = re.exec(md)
    if (!sec) { warn(`${sc.path} has no "${heading}" section`); continue }
    for (const m of sec[1].matchAll(/\[`?([A-Z][A-Z0-9]*-\d+)`?\]/g)) basis[m[1]] = heading
  }
  return basis
}
const BASIS = readBasisSidecar()
const BASIS_VOCAB = config.statusSidecar?.groups || {}

// The code state the corpus's statuses were computed against — what a reader
// needs to answer *how stale is this?*, which a status alone never says.
//
// The corpus emits it, this only carries it: the tool that computes the statuses
// writes the file in the same run, so the date beside a commit is the date that
// commit was read, not some neighbouring tool's clock. Reaching into whatever
// sync-state file a corpus happens to keep would take a different fact and
// publish it under this one's name.
//
//   "environment": { "path": "meta/environment.json" }
//
//   { "schema": 1, "computedAt": "2026-08-02", "baseline": "origin/main",
//     "sources": [ { "cite": "api", "name": "svc-api", "ref": "origin/stage",
//                    "commit": "<sha>", "ahead": 25, "committedAt": "2026-07-31" } ] }
//
// `baseline` travels beside the number it describes: `ahead` is meaningless
// without knowing what it is ahead OF, so a source stating one without the other
// keeps the honest half and drops the claim.
const ENVIRONMENT_SCHEMA = 1
function readEnvironment() {
  const rel = config.environment?.path
  if (!rel) return null
  const p = path.join(CORPUS, rel)
  if (!fs.existsSync(p)) { warn(`environment declared but ${rel} is missing`); return null }
  let raw
  try { raw = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { warn(`${rel} is not valid JSON`); return null }
  if (raw?.schema !== ENVIRONMENT_SCHEMA) {
    warn(`${rel} declares schema ${raw?.schema ?? 'nothing'}, expected ${ENVIRONMENT_SCHEMA}`); return null
  }
  if (!Array.isArray(raw.sources)) { warn(`${rel} has no "sources" array`); return null }
  const baseline = typeof raw.baseline === 'string' ? raw.baseline : null
  const sources = []
  for (const s of raw.sources) {
    // A source that cannot name the commit it was read at states nothing useful,
    // and a half-stated source is worse than an absent one.
    if (typeof s?.commit !== 'string' || !s.commit) { warn(`${rel} has a source with no commit`); continue }
    const ahead = Number.isInteger(s.ahead) ? s.ahead : null
    if (s.ahead !== undefined && ahead === null) warn(`${rel}: "ahead" must be an integer, got ${JSON.stringify(s.ahead)}`)
    if (ahead !== null && !baseline) warn(`${rel}: "ahead" needs a "baseline" to be ahead of`)
    sources.push({
      cite: s.cite ?? null, name: s.name ?? null, ref: s.ref ?? null,
      commit: s.commit, ahead: baseline ? ahead : null, committedAt: s.committedAt ?? null,
    })
  }
  if (!sources.length) return null
  // A corpus declares which ref plays which ROLE, because only the spellings
  // vary: `origin/main`, `origin/production` and `origin/release` are all the
  // same role. If it has, the baseline the statuses were computed from has to be
  // the ref the corpus calls production — otherwise the site says "matches
  // production" about a comparison against something else.
  const declared = config.refs?.production
  if (declared && baseline && declared !== baseline) {
    warn(`${rel} computed against "${baseline}" but refs.production is "${declared}"`)
  }
  return { computedAt: raw.computedAt ?? null, baseline, sources }
}
const ENVIRONMENT = readEnvironment()

function caveatsFor(meta, status, id) {
  const c = []
  // The correction that makes the axis true rather than tidy: a rule can match
  // production and still have nothing testing it. A pure tier ladder renders
  // those at maximum confidence, indistinguishable from a fully warranted one.
  if (!meta.tests.length) c.push({ kind: 'unpinned', text: 'nothing tests this' })
  const b = status === config.statusSidecar?.appliesTo && BASIS_VOCAB[BASIS[id]]
  if (b && b.caveat) c.push({ kind: b.id || 'basis', text: b.caveat })
  return c
}

function renderWarrant(meta, appearances, anchor) {
  const summary = []
  summary.push(meta.tests.length
    ? `${meta.tests.length} test${meta.tests.length > 1 ? 's' : ''}`
    : 'No test')
  const repos = [...new Set([...meta.tests, ...meta.sources].map((x) => x.repo))]
  summary.push(repos.map((r) => r).join(' + '))
  if (meta.sourceNote) summary.push(inline(meta.sourceNote))

  // Hoist a shared `suite > ` prefix so only the distinguishing tail repeats.
  let suite = null
  if (meta.tests.length > 1) {
    const heads = meta.tests.map((t) => t.name.split(' > ').slice(0, -1).join(' > '))
    if (heads[0] && heads.every((h) => h === heads[0])) suite = heads[0]
  }

  const testRows = meta.tests.map((t) => {
    const name = suite ? t.name.slice(suite.length + 3) : t.name
    return `<dd><span class="repo">${esc(t.repo)}</span>` +
           `<code class="cite">${esc(name)}</code></dd>`
  }).join('')

  const srcRows = meta.sources.map((s) => {
    const i = s.path.lastIndexOf('/')
    const dir = i === -1 ? '' : s.path.slice(0, i + 1)
    const base = i === -1 ? s.path : s.path.slice(i + 1)
    return `<dd><span class="repo">${esc(s.repo)}</span>` +
      `<code class="cite path"><span class="dir">${esc(dir)}</span>` +
      `<span class="base">${esc(base)}</span>` +
      (s.member ? `<span class="member">#${esc(s.member)}</span>` : '') + `</code></dd>`
  }).join('')

  // The narratives that contain this rule, last: the evidence comes first and
  // this is navigation, not warrant. Guide before Flow, because the reader who
  // needs this is holding an ID and wants to know what to do on a screen.
  // Labelled by kind rather than with a new noun — the reader already meets
  // Guide and Flow on the page warrant, and inventing a third word for the same
  // thing is how one idea starts reading as two.
  // The state is a SIBLING of the link, so a links-list or rotor — which reads
  // accessible names and nothing else — would announce nine identical "Create a
  // deploy token" and drop every caveat. That is the bare "walked in X" the
  // standing veto exists to forbid, reached through the accessibility tree
  // instead of through the page. `aria-describedby` puts the state back into
  // what assistive tech announces without moving it visually or repeating it.
  const byKind = {}
  for (const a of appearances || []) (byKind[a.kind] ||= []).push(a)
  let narN = 0
  const seenRows = ['Guide', 'Flow'].filter((k) => byKind[k]).map((k) =>
    // Pluralised for the same reason `Tests` is: one term labelling twelve
    // definitions while its sibling row agrees in number reads as a bug.
    `<dt>${byKind[k].length > 1 ? `${k}s` : k}</dt>` + byKind[k].map((a) => {
      const id = `${anchor}-nar${++narN}`
      return `<dd><a class="w-nar" href="${htmlName(a.page)}" ` +
        `aria-describedby="${id}">${esc(a.title)}</a>` +
        (a.walk.verified && a.walk.verified !== 'never'
          ? `<span class="w-vfy" id="${id}">verified ${esc(a.walk.verified)}</span>`
          : `<span class="w-vfy" id="${id}" data-tone="pending">not human-verified</span>`) +
        `</dd>`
    }).join('')).join('')

  return `<div class="warrant" data-tests="${meta.tests.length}">
  <p class="w-line">${summary.join('<span aria-hidden="true"> · </span>')}</p>
  <dl class="w-cites">
    ${meta.tests.length ? `<dt>${meta.tests.length > 1 ? 'Tests' : 'Test'}</dt>${
      suite ? `<dd class="w-suite"><code class="cite">${esc(suite)}</code></dd>` : ''}${testRows}` : ''}
    <dt>Source</dt>${srcRows}
    ${seenRows}
  </dl>
</div>`
}

/* ── page model ──────────────────────────────────────────────────────────── */

function buildPage(relPath) {
  const src = fs.readFileSync(path.join(CORPUS, relPath), 'utf8')
  const { data, body } = frontmatter(src)
  const tokens = marked.lexer(body)
  tally = {}

  const page = { relPath, data, title: '', lead: [], sections: [], rules: [] }
  let section = null
  let rule = null
  let pendingAnchor = null
  let lastBlock = null

  const push = (html) => {
    if (rule) rule.body.push(html)
    else if (section) section.body.push(html)
    else page.lead.push(html)
    lastBlock = { html, sink: rule ? rule.body : section ? section.body : page.lead }
  }

  const newSection = (title) => {
    section = { title, id: slug(title), body: [], rules: [] }
    page.sections.push(section)
    rule = null
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    // The `---` immediately before a `##` is an authoring artifact for
    // GitHub's flat rendering. Rendering both gives every section two rules.
    if (t.type === 'hr') {
      const next = tokens[i + 1]
      if (next && next.type === 'heading' && next.depth === 2) continue
      push('<hr>')
      continue
    }

    // The corpus's explicit `<a id="area-005"></a>` is what makes an ID
    // pasteable into a ticket and stable forever (rule-format.md:133-141).
    // It sits on the line directly above its heading with no blank line, so
    // marked lexes it as a PARAGRAPH, not an html block. Missing that means
    // every rule is addressed by a slugified title instead, which is exactly
    // the breakage the corpus writes those anchors to prevent.
    const bareAnchor = (t.type === 'html' || t.type === 'paragraph') &&
      /^\s*<a id="([^"]+)"><\/a>\s*$/.exec(t.raw)
    if (bareAnchor) { pendingAnchor = bareAnchor[1]; continue }
    if (t.type === 'html') continue                 // drop other raw HTML

    if (t.type === 'heading') {
      if (t.depth === 1) { page.title = t.text; continue }
      if (t.depth === 2) { newSection(t.text); continue }
      if (t.depth === 3) {
        const m = /^([A-Z][A-Z0-9]{1,9}-\d{1,4})\s+—\s+([\s\S]+)$/.exec(t.text)
        if (m && config.rules.idPattern.test(m[1])) {
          if (!section) newSection('')
          rule = {
            id: m[1], anchor: pendingAnchor || slug(t.text),
            statement: m[2], body: [], meta: null, caveats: [],
          }
          if (pendingAnchor && pendingAnchor !== m[1].toLowerCase()) {
            warn(`anchor/ID mismatch on ${m[1]} (${pendingAnchor})`)
          }
          rule.anchorDeclared = Boolean(pendingAnchor)
          pendingAnchor = null
          section.rules.push(rule)
          page.rules.push(rule)
          continue
        }
        rule = null
        push(`<h3 id="${slug(t.text)}">${inline(t.text)}</h3>`)
        continue
      }
      push(`<h${t.depth}>${inline(t.text)}</h${t.depth}>`)
      continue
    }

    if (t.type === 'paragraph') {
      if (rule && !rule.meta && /^\*\*Status:\*\*/.test(t.text)) {
        rule.meta = parseMetaLine(t.text, rule.id)
        continue
      }
      const cov = coverageTag(t.text)
      if (cov && lastBlock) {                                   // R2
        lastBlock.sink[lastBlock.sink.length - 1] = lastBlock.html.replace(
          /^<(table|div)/,
          `<$1 data-covered="${cov.id}"`
        )
        const sink = lastBlock.sink
        sink[sink.length - 1] = `<div class="covered">${sink[sink.length - 1]}` +
          `<p class="cover-tag">${markGlyph(cov, { labelled: false })} ` +
          `<span>${esc(cov.label)}</span></p></div>`
        continue
      }
      push(`<p>${provenance(t.text)}</p>`)
      continue
    }

    if (t.type === 'blockquote') { push(renderCallout(t)); continue }
    if (t.type === 'list') { push(renderList(t)); continue }
    if (t.type === 'table') { push(renderTable(t)); continue }
    if (t.type === 'code') {
      push(`<pre class="code"><code>${esc(t.text)}</code></pre>`)
      continue
    }
    if (t.type === 'space') continue
    push(marked.parser([t]))
  }

  for (const r of page.rules) {
    // A page that declares anchors for SOME rules and not others is not making a
    // style choice, it is broken: the unanchored ones fall back to a slugified
    // title that dies on the next reword. The usual cause is an <a id> written
    // BELOW its heading, where it silently becomes the NEXT rule's anchor — so
    // rule one slugifies and everything after it shifts by one. A page that
    // declares none anywhere has chosen the fallback, and is left alone.
    if (page.rules.some((x) => x.anchorDeclared) && !r.anchorDeclared) {
      warn(`${r.id} has no <a id> above its heading while others on this page do — its address is a slugified title`)
    }
    if (!r.meta) { r.meta = { status: null, tests: [], sources: [] }; warn(`${r.id} has no metadata line`) }
    r.status = r.meta.status
    r.vocab = config.status[r.status]
    // Two different absences. A token nobody mapped still names itself, so it
    // renders as written at the neutral tier. A rule with no metadata line at
    // all has nothing to name — `label: null` reached esc() and took the whole
    // build down, which contradicted the warn-and-continue two lines above.
    // Neither may borrow "stated by an author": nobody stated anything.
    if (!r.vocab) {
      if (r.status) warn(`unmapped status token "${r.status}"`)
      r.vocab = r.status
        ? { label: r.status, tier: 'neutral', origin: 'asserted' }
        : { label: 'No status recorded', tier: 'neutral', origin: 'none' }
    }
    // A declared basis overrides the bare status token. Rendering two rules
    // identically when the corpus computed them to mean different things is
    // the lie this whole axis exists to prevent.
    const b = r.status === config.statusSidecar?.appliesTo && BASIS_VOCAB[BASIS[r.id]]
    if (b) r.vocab = { label: b.label, tier: b.tier, origin: 'computed' }
    r.caveats = caveatsFor(r.meta, r.status, r.id)
  }
  page.tally = tally
  return page
}

/* ── block renderers ─────────────────────────────────────────────────────── */

function renderList(t) {
  const items = t.items.map((it) => {
    const raw = it.tokens.map((x) => x.raw).join('')
    const nested = it.tokens.filter((x) => x.type === 'list')
    const own = it.tokens.filter((x) => x.type !== 'list')
      .map((x) => x.raw).join('').trim()
    return `<li>${provenance(own)}${nested.map(renderList).join('')}</li>`
  }).join('')
  return t.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`
}

// A legend is a <= 2-column table whose every first cell is exactly one
// declared marker. It renders as a key using the SAME glyphs used inline:
// showing the raw token would break the match the moment the token becomes
// a designed glyph. It is also broken as a table -- the authored source is
// `> | | |`, an empty header row every generic renderer paints as two blanks.
function asLegend(t) {
  if (t.header.length > 2) return null
  if (!t.rows.length) return null
  const rows = []
  for (const r of t.rows) {
    const cell = (r[0].text || '').trim().replace(/️/g, '')
    const mk = MARKERS.find((m) => m.token === cell)
    if (!mk) return null
    rows.push({ mk, text: (r[1]?.text || '').trim() })
  }
  return rows
}

function renderTable(t) {
  const legend = asLegend(t)
  if (legend) {
    return `<dl class="ev-key">` + legend.map(({ mk, text }) =>
      `<div><dt>${markGlyph(mk, { labelled: false })}` +
      `<span class="k-name">${esc(mk.short)}</span></dt>` +
      `<dd>${inline(text)}</dd></div>`).join('') + `</dl>`
  }
  const blank = t.header.every((h) => !(h.text || '').trim())
  const head = blank ? '' : `<thead><tr>${t.header
    .map((h) => `<th>${inline(h.text)}</th>`).join('')}</tr></thead>`
  // The column count and each cell's own header travel with the markup so the
  // stylesheet can stack a two-column table into definition pairs on a phone
  // without a second pass over the DOM. The label rides only on cells AFTER the
  // first: the first cell is the term, which needs no label, and a headerless
  // table gets none at all.
  const cols = Math.max(t.header.length, ...t.rows.map((r) => r.length))
  const label = (i) => (cols === 2 && i > 0 && !blank && t.header[i]?.text)
    ? ` data-label="${esc(t.header[i].text.trim())}"` : ''
  const rows = t.rows.map((r) => `<tr>${r
    .map((c, i) => `<td${label(i)}>${provenance(c.text)}</td>`).join('')}</tr>`).join('')
  return `<div class="table-wrap"><table data-cols="${cols}"${
    blank ? ' class="no-head"' : ''}>${head}<tbody>${rows}</tbody></table></div>`
}

// Callouts: two mechanical stamps plus an untyped fallback. Type at PARAGRAPH
// granularity -- three of the corpus's most important blockquotes hold two
// authorial acts in one block, and GitHub flattens them into one grey slab.
function renderCallout(t) {
  const paras = []
  for (const b of t.tokens) {
    if (b.type === 'paragraph') paras.push(b)
    else if (b.type === 'table' || b.type === 'list' || b.type === 'code') paras.push(b)
  }
  const kindOf = (md) => /Generated by `tools\//.test(md) ? 'generated'
    : /^\*\*Not yet documented\.\*\*/.test(md) ? 'placeholder' : 'note'

  let html = ''
  let group = []
  const flush = (kind) => {
    if (!group.length) return
    html += `<aside class="note" data-kind="${kind}">${group.join('')}</aside>`
    group = []
  }
  let current = null
  for (const b of paras) {
    if (b.type !== 'paragraph') {
      group.push(b.type === 'table' ? renderTable(b) : b.type === 'list'
        ? renderList(b) : `<pre class="code"><code>${esc(b.text)}</code></pre>`)
      continue
    }
    const kind = kindOf(b.text)
    if (current && kind !== current) { flush(current); }
    current = kind
    // Title lift, two clauses only. The probe's third clause shreds every
    // generated page: it hoists a mid-sentence <strong> and leaves the body
    // reading "...describes code that is . Statuses are computed...".
    const lift = /^\*\*([^*]+)\*\*/.exec(b.text)
    let title = null, rest = b.text
    if (lift) {
      const after = b.text.slice(lift[0].length)
      const endsSentence = /[.?!]$/.test(lift[1].trim())
      const ownsFirstLine = /^\s*(\n|$)/.test(after)
      if (endsSentence || ownsFirstLine) {
        title = lift[1].replace(/[.?!]$/, '')
        rest = after.replace(/^\s*/, '')
      }
    }
    group.push((title ? `<p class="note-title">${inline(title)}</p>` : '') +
      (rest.trim() ? `<p>${provenance(rest)}</p>` : ''))
  }
  flush(current || 'note')
  return html
}

/* ── page rendering ──────────────────────────────────────────────────────── */

const TIER_MARK = {
  confirmed:   '<svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="2.2"/></svg>',
  unconfirmed: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.3 8.9 8.4H1.1Z"/></svg>',
  broken:      '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1.4" y="1.4" width="7.2" height="7.2" rx="1.2"/></svg>',
  neutral:     '<svg viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="2.2" fill="none" stroke-width="1.4"/></svg>',
}

function renderRule(rule, ctx) {
  const v = rule.vocab
  const caveat = rule.caveats.map((c) => c.text).join(' · ')
  const asOf = v.origin === 'computed' ? ctx.computedAsOf : null

  // The ID is a SIBLING of the heading, not a child of it. Two reasons, and the
  // second is why it moved: the heading's accessible name is then the statement
  // alone rather than "ORD-001, permalink An order cannot be…", and the ID and
  // the verdict become siblings, which is the only way they can share a row
  // when the mark column folds on a phone without putting a status string
  // inside an <h3>.
  // `data-status` is the corpus's own computed value, carried through unchanged.
  // The article's machine attributes are kept to the same field set rules.json
  // publishes, so a reader that parses the HTML is never told less than a reader
  // that parses the sidecar. `tier` alone cannot express "changed on stage" once
  // `in-dev` or `unknown` appear — both fold onto `unconfirmed`/`computed`.
  //
  // `data-kind` is DECLARED rather than left to be inferred from the presence of
  // `data-rule-id`. Inference was never something this side agreed to — it was a
  // consumer reading a shape and deducing a genre from it, which works right up
  // until the consumer stops. It has, and there is no fallback: a corpus that
  // does not say `rule` now indexes with no genre at all, and the one query the
  // whole surface exists to answer matches nothing. A page states its genre; so
  // does a rule. It is a literal, not `genreOf`: the genre of the entity, which
  // stays `rule` even for a rule declared on a guide, not the genre of the page
  // the entity happens to sit on.
  return `<article class="rule" id="${rule.anchor}" data-kind="rule" data-rule-id="${rule.id}"
         data-status="${rule.status}" data-tier="${v.tier}" data-origin="${v.origin}">
  <a class="rule-id" href="#${rule.anchor}" data-copy="${rule.id}"
     aria-label="${esc(rule.id)}, permalink">${esc(rule.id)}</a>
  <h3 class="rule-statement">${inline(rule.statement)}</h3>
  <div class="rule-body">${rule.body.join('\n')}</div>
  <p class="rule-trust" data-tier="${v.tier}">
    <span class="tier-mark" aria-hidden="true">${TIER_MARK[v.tier]}</span>
    <span class="tier-label">${esc(v.label)}</span>
    ${caveat ? `<span class="tier-caveat">${esc(caveat)}</span>` : ''}
    <span class="tier-origin">${v.origin === 'computed'
      ? `computed ${asOf ? `· ${asOf}` : ''}`
      : v.origin === 'asserted' ? 'stated by an author' : ''}</span>
  </p>
  ${renderWarrant(rule.meta, ctx.appearsIn?.[rule.id], rule.anchor)}
</article>`
}

function railGroups(page) {
  return page.sections.filter((s) => s.rules.length || s.title).map((s) => {
    const chips = s.rules.map((r) => {
      const n = r.id.split('-')[1]
      return `<a class="chip" href="#${r.anchor}" data-tier="${r.vocab.tier}"
        aria-label="${esc(r.id)}: ${esc(r.statement.replace(/[*_`]/g, ''))}">${esc(n)}</a>`
    }).join('')
    return `<li><a class="rail-sec" href="#${s.id}">${esc(s.title)}</a>` +
      (chips ? `<div class="chips">${chips}</div>` : '') + `</li>`
  }).join('')
}

function renderRail(page) {
  if (!page.rules.length) return ''
  const prefix = page.rules[0].id.split('-')[0]
  return `<nav class="rail" aria-label="Rules on this page">
  <p class="rail-h">${esc(prefix)}-0xx <span>${page.rules.length}</span></p>
  <ul>${railGroups(page)}</ul>
</nav>`
}

// Below the rail's breakpoint the sticky column is gone, and nothing replaced
// it: on a phone there was no way to reach a rule by the one key the reader
// arrived holding. This is the same chip index, in the flow, closed.
//
// A <details> is rejected for the warrant because a closed one is invisible to
// find-in-page in Firefox and Safari and the citations exist nowhere else on
// the page. Neither objection holds here: every chip is a second copy of a rule
// ID that is still in the document as a heading, and this is ONE control for
// the page rather than three per rule. It is closed on arrival because the
// dominant journey lands mid-page on a deep link; the index is the second
// action, not the first. No JavaScript is involved in opening it.
function renderRailFlow(page) {
  if (!page.rules.length) return ''
  return `<details class="rail-flow">
  <summary>Rules on this page <span>${page.rules.length}</span></summary>
  <ul>${railGroups(page)}</ul>
</details>`
}

/**
 * The walk-state strip: three doors a walk can arrive through, and how far each got.
 *
 * TWO THINGS THIS IS. It renders the repo's OWN frontmatter, so a standalone build (no arcdoq
 * anywhere) still shows provenance — this is an MIT package and verification must not become a
 * subscription feature. And each value sits in a SLOT that a host can substitute live state into at
 * serve time, because a state baked at build time is wrong the moment anyone walks a guide without
 * committing, which is the whole problem. The slot contract is arcdoq's `docs/WALK-SLOT-CONTRACT.md`;
 * a host writes only the element's TEXT and the two `data-walk-*` attribute values, never markup.
 *
 * WHY THREE ROWS AND NOT ONE "verified". An agent walk and a human walk are different claims: an
 * agent proves the instructions are FOLLOWABLE, a person proves IT WORKED FOR A PERSON. One field
 * lets a scheduled bot silently clear a stale human walk. Separate slots make that structurally
 * impossible, here and in the substituting host.
 *
 * WHY IT NOW RENDERS FOR A HUMAN WALK. It used to return early unless `walked-by-agent` was set, so
 * a page a person walked — the party that matters — showed no strip at all. The early return was
 * guarding something real, though: on a RULES page the `verified:` date already rides in each
 * warrant line, and rendering both duplicates it. So the guard is now about the PAGE GENRE rather
 * than about one frontmatter key. A narrative (guide / flow) is the thing that gets walked, and on
 * one of those "nobody has ever walked this" is the single most useful line on the page. Anything
 * else keeps the old behaviour: strip only if it actually claims a walk.
 */
function walkSlot(name, value, tone, proof) {
  return `<dd data-walk-slot="${name}" data-walk-tone="${tone}" data-walk-proof="${proof}">` +
    `${value}</dd>`
}

/**
 * A frontmatter walk claim → the slot's default cell. Absent/`never` reads as never.
 *
 * The state rides `data-walk-tone` ON THE SLOT ELEMENT, never a wrapper inside it. A host
 * substitutes the element's TEXT, so anything nested is destroyed on substitution — an inner
 * `<span data-tone="pending">` would take the styling with it and a served "never" would silently
 * lose its amber. The attribute survives because the host rewrites its value rather than the tag.
 */
function claimSlot(name, claim) {
  const stated = claim && claim !== 'never' ? String(claim) : ''
  // `claimed`, never `proven`: this value came out of the publisher's own repo, so it is the
  // publisher attesting to their own verification. A host that can prove a walk overwrites it.
  return stated
    ? walkSlot(name, esc(stated), 'walked', 'claimed')
    : walkSlot(name, 'never', 'never', 'none')
}

/**
 * A page's declared walk state, for the machine surface — the same three doors the strip renders.
 *
 * Every value is carried VERBATIM, including the literal `never`. Absent is `null` and means "the
 * key was not written", which is a different fact from "written, and it says nobody walked it".
 * Collapsing the two was arcdoq-docsite#2's third defect: it left `rules.json` unable to express
 * the state an attestation is recorded against.
 *
 * These are the PUBLISHER'S OWN claims, out of their own repo — self-asserted, exactly like the
 * `claimed` proof level in the rendered strip. A consumer holding live walk records should prefer
 * those; this is what the corpus says about itself.
 */
function walkStateOf(data) {
  const val = (v) => (v === undefined || v === null || v === '' ? null : String(v))
  return {
    verified: val(data.verified),
    walkedByAgent: val(data['walked-by-agent']),
    walkedIn: val(data['walked-in']),
  }
}

function renderProvenanceStrip(page, tally) {
  const d = page.data
  const narrative = /^(flows|guides)\//.test(page.relPath)
  const claimsAWalk = Boolean(d['walked-by-agent'] || (d.verified && d.verified !== 'never'))
  if (!narrative && !claimsAWalk) return ''

  const total = Object.values(tally).reduce((a, b) => a + b, 0)
  const fromSource = tally['from-source'] || 0

  // `walked-in` belongs to the AGENT claim (which environments it ran against), so it rides inside
  // that slot's text rather than as a row of its own — a separate row would survive substitution
  // and keep describing a walk the host had just replaced.
  const agentClaim = d['walked-by-agent']
    ? [d['walked-by-agent'], d['walked-in'] ? `in ${d['walked-in']}` : null].filter(Boolean).join(' · ')
    : ''

  const rows = [
    ['In a browser', claimSlot('walk-browser', d.verified)],
    ['By an agent', claimSlot('walk-agent', agentClaim)],
    // No frontmatter equivalent: a machine walk is something only a host can observe, so the repo
    // can never claim one. The slot exists so the host has somewhere to put it.
    ['By a machine', walkSlot('walk-machine', 'never', 'never', 'none')],
  ]
  if (total) rows.push(['Claims', `<dd>${total} <span class="pv-split">${fromSource} from source</span></dd>`])

  return `<header class="page-provenance"><dl>` +
    rows.map(([k, cell]) => `<div><dt>${k}</dt>${cell.startsWith('<dd') ? cell : `<dd>${cell}</dd>`}</div>`).join('') +
    `</dl></header>`
}

function renderPage(page, ctx) {
  const unconfirmed = page.rules.filter((r) => r.vocab.tier !== 'confirmed')
  const ahead = unconfirmed.length ? `<p class="page-ahead">
    <span>Behaviour can change at the next promotion, ${unconfirmed.length} of ${page.rules.length}:</span>
    ${unconfirmed.map((r) => `<a href="#${r.anchor}">${esc(r.id)}</a>`).join('')}</p>` : ''

  const kind = genreOf(page.relPath)
  // Keyed on the page's own `area:` frontmatter, which is the corpus's human
  // spelling of an area the nav keys on by directory. Both go through areaKey.
  const area = areaLabel(page.data.area) || page.data.area || ''

  const dist = page.rules.length
    ? Object.entries(page.rules.reduce((a, r) => {
        a[r.vocab.tier] = (a[r.vocab.tier] || 0) + 1; return a
      }, {})).map(([t, n]) =>
        `<span class="d-seg" data-tier="${t}">${TIER_MARK[t]}${n}</span>`).join('')
    : ''

  // A `##` that groups rules is structural furniture and is set as a label.
  // A `##` on a guide or flow is a content heading and must read as one.
  //
  // `data-rules` is the rules this step links down to, on the step's OWN open
  // tag, because that is the only place a content index reads them from — a
  // `data-*` on a descendant is not collected. Whitespace-separated, the way
  // `class` and `rel` already are, since HTML cannot repeat an attribute and a
  // step usually covers more than one rule. esc() is what keeps a quote out of
  // the value, which an extractor reading raw HTML would truncate on.
  //
  // Omitted rather than emitted empty when a step links to nothing: a consumer
  // that stores each `data-*` as one exact-match facet would otherwise index
  // every prose step under an empty `rules` facet. Absence already reads as
  // "this step covers no rule" and costs nothing to ask about.
  const body = page.sections.map((s) => `<section class="${
    s.rules.length ? 'rule-group' : 'prose-group'}" id="${s.id}"${
    s.covers?.length ? ` data-rules="${esc(s.covers.join(' '))}"` : ''}>
    <h2>${inline(s.title)}${s.rules.length
      ? `<span class="sec-range">${s.rules[0].id} to ${s.rules[s.rules.length - 1].id}</span>` : ''}</h2>
    ${s.body.join('\n')}
    ${s.rules.map((r) => renderRule(r, ctx)).join('\n')}
  </section>`).join('\n')

  const warrantBits = [`<span class="w-kind">${kind}</span>`]
  if (area) warrantBits.push(`<span>${esc(area)}</span>`)
  if (dist) warrantBits.push(`<span class="w-dist">${dist}</span>`)
  // `Verified <date>` used to ride here too. It does not any more: the provenance strip below is
  // now the ONE home for walk state, and it is substitutable. A second, baked copy in the warrant
  // would sit next to a live slot showing a different answer — the precise drift the strip exists
  // to end — and there is no way to substitute this one, because a `<span>` in a `·`-joined run has
  // no stable identity to address. One fact, one place, and that place is addressable.

  // The genre, machine-readable, on a root a content index can actually read:
  // `data-*` is collected off an `<article>`/`<section>` open tag, so `<main>`
  // — which is neither — could carry it and be ignored. It is the warrant's own
  // word lowercased rather than a second literal, so the attribute cannot say
  // "flow" beside a page labelled Guide.
  //
  // Only guides and flows are wrapped. A rules page's root would be a block
  // whose text is every rule on the page, duplicating each rule's own
  // `<article>` in any index that reads both — and the rules-page structure is
  // the one already being consumed, so it stays untouched.
  //
  // The warrant and the provenance strip stay OUTSIDE it. Both are the
  // generator talking about the document rather than the document's own prose,
  // and the strip in particular holds the values arcdoq substitutes at serve
  // time: baking serve-time state inside the block an index harvests is how a
  // search result starts quoting a walk that has since been redone.
  //
  // The root also carries the union of every rule the page links down to, which
  // is a different question from the one a step answers rather than a rollup
  // for convenience: *which walkthroughs cover this?* is asked about the
  // walkthrough. It is also the only place a rule linked from the lead can
  // appear, since the lead belongs to no step.
  const genre = kind === 'Guide' || kind === 'Flow' ? kind.toLowerCase() : null
  const root = genre ? `<article class="page" data-kind="${genre}"${
    page.covers?.length ? ` data-rules="${esc(page.covers.join(' '))}"` : ''}>\n` : ''

  return { html: `<div class="page-warrant">${
    warrantBits.join('<span class="w-sep" aria-hidden="true">·</span>')}</div>
${renderProvenanceStrip(page, page.tally)}
${root}<h1>${inline(page.title)}</h1>
${page.lead.join('\n')}
${ahead}
${renderRailFlow(page)}
${body}${genre ? '\n</article>' : ''}` }
}

/* ── the search route ────────────────────────────────────────────────────── */

// Not a dialog. A real page at a real URL, so a query is pasteable, the back
// button leaves it, and there is no focus trap to get wrong — which is what
// DESIGN.md rules and what the modal sheet could not deliver.
//
// Every rule and every page is BAKED IN as a live link, escaped by the same
// esc() as every other surface in the generator. The client layer therefore
// never constructs markup and never fetches: it hides rows that do not match,
// and writes its one piece of feedback with textContent. The escaping bug, the
// pre-fetch race and the stale combobox ARIA all stop being possible rather
// than being fixed carefully.
//
// The index is the whole corpus, not just the rules. A search that returns
// nothing has to mean the behaviour is undocumented; while guides, flows and
// area indexes were absent from the index, it could also mean "published, but
// not searchable", and the reader could not tell those apart.
//
// With JavaScript off the complete list is still here and every entry is still
// a link, so the floor is a browsable index of the site rather than nothing.
function renderSearchPage(pages, ruleIndex) {
  const titleOf = Object.fromEntries(pages.map((p) => [p.relPath, p.title || p.relPath]))

  // Every row carries the same two slots, so the list scans as one column
  // rather than as two shapes: a key on the left — the ID a reader arrived
  // holding, or the content type when there is no ID — and where it lives on
  // the right, the same place the nav ledger puts its count.
  //
  // data-t is the only thing the filter reads: one lowercased haystack per row,
  // built here, where the strings already are and where esc() already runs.
  const row = ({ href, key, tier, headline, where, terms }) =>
    `<li data-t="${esc(terms.filter(Boolean).join(' ').toLowerCase())}"><a href="${esc(href)}">` +
    `<span class="s-top"><span class="s-id">${esc(key)}</span>` +
    `${tier ? `<span class="s-tier" data-tier="${tier}">${TIER_MARK[tier]}</span>` : ''}` +
    `<span class="s-where">${esc(where)}</span></span>` +
    `<span class="s-st">${esc(headline)}</span></a></li>`

  const plain = (s) => String(s ?? '').replace(/[*_`]/g, '')

  const ruleRows = Object.values(ruleIndex).map((r) => row({
    href: `${htmlName(r.page)}#${r.anchor}`,
    key: r.id, tier: r.vocab.tier,
    headline: plain(r.statement),
    where: titleOf[r.page] || r.page,
    // `ord001` alongside `ORD-001`, because a reader retyping an ID out of a
    // ticket drops the hyphen as often as not.
    terms: [r.id, r.id.replace('-', ''), plain(r.statement),
      ...r.meta.tests.map((t) => t.name), ...r.meta.sources.map((s) => s.path),
      titleOf[r.page]],
  }))

  const pageRows = pages.map((p) => row({
    href: htmlName(p.relPath), key: genreOf(p.relPath), tier: null,
    headline: p.title || p.relPath,
    where: p.relPath,
    terms: [p.title, p.relPath, p.data.area, genreOf(p.relPath)],
  }))

  const n = ruleRows.length + pageRows.length
  return `<div class="search-page">
<h1>Search</h1>
<form class="search-form" role="search" method="get" action="search.html">
  <input id="q" name="q" type="search" value="" autocomplete="off" autofocus
    aria-label="Search this corpus"
    placeholder="A rule ID, a behaviour, a test name, a path, a page">
</form>
<p class="search-nojs">JavaScript is off, so the box above cannot filter. The
complete index is below: every rule and every page, each one a link.</p>
<p class="search-count" role="status" aria-live="polite">${n} entries</p>
<ol class="search-index">${ruleRows.join('')}${pageRows.join('')}</ol>
</div>`
}

/* ── shell ───────────────────────────────────────────────────────────────── */

const hasCustomCss = fs.existsSync(path.join(CORPUS, 'docs.css'))
function shell({ title, main, rail, nav, accent, page = '' }) {
  return `<!doctype html>
<html lang="en" data-theme="light"${page ? ` data-page="${page}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(config.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="viewer.css">
${hasCustomCss ? '<link rel="stylesheet" href="docs.css">' : ''}
<style>:root{--accent:${accent};--accent-ring:color-mix(in srgb,${accent} 32%,transparent);--accent-fill:color-mix(in srgb,${accent} 7%,transparent)}
:root[data-theme="dark"]{--accent:color-mix(in oklch,${accent} 72%,white);--accent-ring:color-mix(in srgb,${accent} 40%,transparent);--accent-fill:color-mix(in srgb,${accent} 17%,transparent)}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="top-in">
    <a class="mark" href="index.html"><span class="mark-dot"></span>${esc(config.name)}</a>
    <div class="top-r">
      <a class="search-open" href="search.html">
        <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.4" fill="none" stroke-width="1.7"/><path d="M10.4 10.4 14 14" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>
        <span>Search</span><kbd>/</kbd>
      </a>
      <button class="theme" type="button" aria-label="Switch to dark theme" aria-pressed="false">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8 5.6 5.6 0 1 0 13.2 9.6Z"/></svg>
      </button>
    </div>
  </div>
</header>
<div class="frame">
  <nav class="side" aria-label="Documentation">${nav}</nav>
  <main id="main">${main}</main>
  ${rail}
</div>
<div class="keybar" hidden aria-hidden="true"></div>
<script src="viewer.js"></script>
</body>
</html>`
}

function renderNav(pages, current) {
  const byPath = Object.fromEntries(pages.map((p) => [p.relPath, p]))
  // Nav labels come from the H1 minus a declared area prefix at the em dash:
  // The short label often exists nowhere in the corpus; it is derived.
  const label = (rel) => {
    const area = /^rules\/([^/]+)\/index\.md$/.exec(rel)
    const declared = area && areaLabel(area[1])
    if (declared) return declared
    const pg = byPath[rel]
    if (!pg) return rel
    const dash = pg.title.indexOf(' — ')
    return dash === -1 ? pg.title : pg.title.slice(dash + 3)
  }
  const link = (rel, cls = '') => `<li${cls}><a href="${htmlName(rel)}"${
    rel === current ? ' aria-current="page"' : ''}>${esc(label(rel))}</a></li>`

  // The Rules group is a ledger: area, rule count, and the confirmed share as a
  // proportional strip. The 26 undocumented areas are their OWN declared group
  // now, so the nav no longer has to invent a way to show emptiness without
  // making the spine look like a graveyard. The corpus settled that.
  const rulesLedger = (paths) => {
    const areas = new Map()
    for (const rel of paths) {
      // A page declared in the Rules group but not filed under `rules/<area>/`
      // has no area segment to group by. `rel.split('/')[1]` was undefined for
      // it, which reached esc(undefined) and took the whole build down — a
      // corpus arrangement the generator does not support is a thing to name,
      // not a stack trace. It groups under its own path instead.
      const dir = rel.split('/')[1]
      if (!dir) warn(`${rel} is in the Rules group but not under rules/<area>/`)
      const key = dir || rel.replace(/\.md$/, '')
      if (!areas.has(key)) areas.set(key, [])
      areas.get(key).push(rel)
    }
    return [...areas].map(([dir, rels]) => {
      const topics = rels.filter((r) => !r.endsWith('index.md'))
      const index = rels.find((r) => r.endsWith('index.md'))
      // Counted over every page in the area, index included. Counting only the
      // topics reports 0 for an area that writes its rules in its own index.
      const n = rels.reduce((a, r) => a + (byPath[r]?.rules.length || 0), 0)
      const tiers = rels.flatMap((r) => (byPath[r]?.rules || []).map((x) => x.vocab.tier))
      const conf = tiers.filter((t) => t === 'confirmed').length
      const strip = n ? `<span class="strip" role="img"
        aria-label="${conf} of ${n} match production">
        <span style="flex:${conf}" data-tier="confirmed"></span>
        <span style="flex:${n - conf}" data-tier="unconfirmed"></span></span>` : ''
      // The area label carries the link to its own index. Without it that page
      // is published, reachable and yet named nowhere in the nav — and because
      // the mobile nav shows only the group holding the current page, and that
      // is decided by aria-current, arriving there rendered an empty sidebar.
      const name = esc(areaLabel(dir) || dir)
      const head = index
        ? `<a href="${htmlName(index)}"${
            index === current ? ' aria-current="page"' : ''}>${name}</a>`
        : name
      return `<li class="area"><div class="area-row"><span>${head}</span>${
        strip}<span class="area-n">${n}</span></div>
        <ul>${topics.map((r) => link(r)).join('')}</ul></li>`
    }).join('')
  }

  const groups = navGroups.map((g) => {
    const note = GROUP_NOTE[g.group]
    const head = `<h2>${esc(g.group)}${note ? `<span>${esc(note)}</span>` : ''}</h2>`
    if (g.group === 'Rules') {
      return `<section class="nav-g">${head}<ul class="ledger">${rulesLedger(g.pages)}</ul></section>`
    }
    // A declared group of nothing-but-stubs is set back so it reads as the
    // burn-down it is, not as a second, larger Rules section.
    const gap = g.pages.every((r) => !(byPath[r]?.rules.length))
      && g.pages.length > 6
    return `<section class="nav-g${gap ? ' is-gap' : ''}">${head}<ul>${
      g.pages.map((r) => link(r)).join('')}</ul></section>`
  }).join('')

  // The way out of the phone collapse, which keeps at most the group holding
  // the current page. It is on every page and is spent only below 860px, where
  // the rest of the ledger is not on screen: a route to the index that already
  // exists, rather than a second copy of this nav hidden behind a control. The
  // count is the ledger's own idiom, and it counts pages because that is what
  // it is offering — the route indexes every rule as well.
  return `${groups}<a class="side-index" href="search.html">All pages<span>${
    pages.length}</span></a>`
}

const htmlName = (rel) => rel.replace(/\//g, '-').replace(/\.md$/, '.html')

/* ── run ─────────────────────────────────────────────────────────────────── */

fs.mkdirSync(OUT, { recursive: true })
// The date the statuses were computed. `environment` states it as data, from the
// run that computed it; the sidecar grep is the fallback for a corpus that has
// not declared one yet, and reads a date out of human prose to get it.
const ctx = { computedAsOf: ENVIRONMENT?.computedAt ?? readGeneratedDate(CORPUS, config) }
const pages = config.publish.map(buildPage)

// htmlName flattens the separator, so `a/b-c.md` and `a-b/c.md` are one file
// and the second write replaced the first with no sign that a page was gone.
// The scheme is not changing — every published URL depends on it — so the
// collision is reported instead, and --strict turns it into a failed build.
const byFile = new Map()
for (const rel of config.publish) {
  const f = htmlName(rel)
  // The search route owns one filename. A corpus page that flattens onto it
  // would be overwritten by a file it never asked for, which is the same silent
  // loss as a collision between two corpus pages and is reported the same way.
  if (f === 'search.html') warn(`${rel} builds to search.html, which the search route reserves`)
  if (byFile.has(f)) warn(`${rel} and ${byFile.get(f)} both build to ${f}`)
  else byFile.set(f, rel)
}

// An ID declared twice used to collapse to whichever page was rendered last,
// and the other rule left the machine surface entirely: absent from rules.json,
// so an agent asking "which rules are unconfirmed" is answered from a corpus
// that is quietly missing one. IDs are sequential and never reused, so this is
// a corpus error; the first declaration wins and the clash is named.
const ruleIndex = {}
for (const p of pages) {
  for (const r of p.rules) {
    if (ruleIndex[r.id]) {
      warn(`${r.id} is declared on both ${ruleIndex[r.id].page} and ${p.relPath}`)
      continue
    }
    ruleIndex[r.id] = { ...r, page: p.relPath }
  }
}

const anchorToId = {}
for (const r of Object.values(ruleIndex)) anchorToId[`${r.page}#${r.anchor}`] = r.id

// Which rules a passage links down to, resolved against the linking page's own
// directory. `../billing/invoices.md#dep-002` from guides/ is a rule ID; the
// same href matched as a string is not. A link to a rule the site does not
// publish resolves to nothing, so no surface here can name a rule the reader
// cannot reach.
//
// Read from the RENDERED html rather than the markdown source, for one reason:
// the machine surface must not imply more than the rendering does. A rule ID
// inside a fenced example is text, and one inside a raw HTML block is dropped
// by the build before it renders — matching `](…)` in the source counts both,
// and a rule then gets named by a surface it appears on nowhere.
const HTML_RULE_LINK = /href="([^"#]*)#([\w-]+)"/g
const rulesLinkedFrom = (html, dir) => {
  const ids = []
  for (const [, href, anchor] of html.matchAll(HTML_RULE_LINK)) {
    const id = anchorToId[`${path.posix.normalize(path.posix.join(dir, href))}#${anchor}`]
    // A passage naming a rule twice covers it once, and the order kept is the
    // order the reader meets them in — sorting would throw that away.
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

// A flow or a guide links DOWN to the rules behind its steps. Both directions
// of that one fact are published — the step names the rules it covers, the rule
// names the narratives that contain it — and both are derived HERE, from the
// same scan, so they cannot disagree. A step carrying a rule that does not
// carry the step back would be one build contradicting itself across two
// machine surfaces, which is worse than either surface being absent.
//
// The reverse direction is the half that did not exist: a reader holding a rule
// ID could not discover that a walkthrough for it existed. They had to already
// know the guide was there and read it hunting for their ID. It invents
// nothing, and a rule nothing narrates gains nothing.
//
// It has to be its own pass. Link resolution runs per page at the END of the
// render loop, after renderPage has already produced the rule's HTML.
//
// Each entry carries THE LINKING PAGE'S OWN verification state, which is the
// whole reason this can be rendered honestly. A guide is `verified: never`
// until a human walks it, and inside a walked guide each claim is separately
// seen or only read — so a bare "walked in X" on the rule would launder exactly
// the distinction the per-claim marker system exists to keep. What the rule says
// is that a narrative exists and how far it has been checked. It never says the
// rule itself was observed.
const appearsIn = {}
for (const p of pages) {
  // A rules page pointing at a rule is a cross-reference between two claims,
  // not a narrative that contains one. Only flows and guides narrate.
  if (!/^(flows|guides)\//.test(p.relPath)) continue
  const dir = path.posix.dirname(p.relPath)
  const entry = {
    page: p.relPath,
    title: p.title || p.relPath,
    kind: genreOf(p.relPath),
    // The narrative's OWN walk state, in the same shape the page renders (schema 3).
    //
    // `verified` used to collapse the literal `never` to `null`, which made a page that says
    // "nobody has ever walked this" indistinguishable from one that says nothing at all — on the
    // MACHINE surface, where telling those two apart is the entire question an attestation is
    // written against. `never` is now carried verbatim, and `null` means only "the key was absent".
    walk: walkStateOf(p.data),
  }
  // The `##` heading is part of its step. The lead is part of no step — it is
  // the page introducing itself before the first `##` — and it is read FIRST,
  // because that is where it sits in the document.
  //
  // The page's own union is why the lead is read at all. Measured on the only
  // real guide in existence: it links one rule from its lead and never again,
  // so a step-only attribute leaves that rule with no `data-rules` anywhere and
  // the page unfindable by the ID it actually covers. The union is also the
  // granularity the question is asked at — *which walkthroughs cover this?* is
  // about the walkthrough, not about step four of it.
  const onPage = new Set(rulesLinkedFrom(p.lead.join('\n'), dir))
  for (const s of p.sections) {
    s.covers = rulesLinkedFrom(inline(s.title) + s.body.join('\n'), dir)
    for (const id of s.covers) onPage.add(id)
  }
  p.covers = [...onPage]
  // One guide naming a rule at five steps is one appearance, not five.
  for (const id of onPage) (appearsIn[id] ||= []).push(entry)
}
ctx.appearsIn = appearsIn

for (const page of pages) {
  const { html } = renderPage(page, ctx)
  // Links must be RESOLVED against the source page's directory, never matched
  // as strings. `[…](../billing/invoices.md)` from rules/accounts/ is
  // rules/billing/invoices.md, and treating it as unpublished silently
  // downgrades a live link to grey text. A directory link resolves to its
  // index.md, which is how the corpus writes `../assets/`.
  const dir = path.posix.dirname(page.relPath)
  const resolveRel = (href) => {
    let t = path.posix.normalize(path.posix.join(dir, href))
    if (t.endsWith('/')) t += 'index.md'
    else if (!t.endsWith('.md')) t += '/index.md'
    return t
  }
  // Two shapes of corpus link reach this, and only one used to be recognised.
  // `../billing/invoices.md` announces itself with a prefix. `rules/orders/
  // lifecycle.md` — which is how this corpus's own README writes them, and the
  // more natural way to write one — has no prefix at all, so it fell through
  // untouched and shipped as a live href to a .md file that no host serves.
  //
  // A prefixless link has to be recognised by its TARGET instead: a corpus
  // link names a `.md` file or a directory. That is also what keeps this off
  // the nav, whose hrefs are already `.html` by the time this runs, and off
  // `#main`, `tokens.css` and every absolute URL in the shell.
  const CORPUS_LINK =
    /href="(?!#)(?!\w+:)(?!\/)((?:\.{1,2}\/[^"#]*)|(?:[^"#:]*(?:\.md|\/)))(#[\w-]+)?"/g
  const resolved = html
    .replace(CORPUS_LINK, (m, href, frag) => {
      const t = resolveRel(href)
      if (config.publish.includes(t)) return `href="${htmlName(t)}${frag || ''}"`
      if (!fs.existsSync(path.join(CORPUS, t))) warn(`broken link ${page.relPath} -> ${href}`)
      return `data-inert="${esc(t)}"`
    })
    .replace(/<a data-inert="([^"]+)">([\s\S]*?)<\/a>/g,
      (m, t, txt) => `<span class="link-inert" title="Not published in this site">${txt}</span>`)
  const out = shell({
    title: page.title, main: resolved, rail: renderRail(page),
    nav: renderNav(pages, page.relPath), accent: config.accent,
  })
  fs.writeFileSync(path.join(OUT, htmlName(page.relPath)), out)
}

// A declared key that names nothing is invisible in the output — the pages it
// was meant to label render the raw name and the build reports success — so
// here is the only place it can be caught. Both checks are measured against
// what the corpus actually publishes.
//
// Counting which lookups FIRED does not measure that: two of the three read
// sites are conditional (the ledger only inside a group literally named Rules,
// the nav label only on a `rules/<dir>/index.md`), so a key can be spelt
// perfectly and still never be consulted. Reporting that as unresolved turns
// --strict red on a config that is right, which is worse than the silence.
const publishedAreas = new Set()
for (const rel of config.publish) {
  const m = /^rules\/([^/]+)\//.exec(rel)
  if (m) publishedAreas.add(areaKey(m[1]))
}
for (const p of pages) {
  const k = areaKey(p.data.area)
  if (k) publishedAreas.add(k)
}
for (const declared of Object.keys(config.areaLabels)) {
  const k = areaKey(declared)
  if (k && !publishedAreas.has(k)) {
    warn(`areaLabels declares "${declared}" but no area the corpus publishes resolves to it`)
  }
}

// The residual form of the split this map was rekeyed to close: the directory
// resolves and the page's own `area:` does not, so the nav names the area one
// way and the page names it another. Canonicalising made the two agree for
// every spelling of the same word; it cannot make them agree when the corpus
// wrote two different words, and that is a corpus error worth naming rather
// than shipping as a site that contradicts itself.
for (const p of pages) {
  const m = /^rules\/([^/]+)\//.exec(p.relPath)
  if (!m || !p.data.area) continue
  if (areaLabel(p.data.area) || !areaLabel(m[1])) continue
  warn(`${p.relPath} declares area: "${p.data.area}", which matches no areaLabels key, ` +
       `while its directory "${m[1]}" does — the nav and the page will disagree`)
}

// The search route is built like any other page and is deliberately NOT in
// docs.json's nav: docs.json declares what the CORPUS contains, and this is the
// generator's own surface. It is reached by the header control, by `/` and by
// ⌘K, all three of which are a plain link or a navigation to it.
fs.writeFileSync(path.join(OUT, 'search.html'), shell({
  title: 'Search', main: renderSearchPage(pages, ruleIndex), rail: '',
  nav: renderNav(pages, null), accent: config.accent, page: 'search',
}))

// rules.json — the machine surface the MCP queries.
// `environment` answers "computed against WHAT, and WHEN" — without it a reader
// is told a rule matches production but never how stale that answer is. Read
// from the corpus's own sync state, so it stays computed rather than typed.
fs.writeFileSync(path.join(OUT, 'rules.json'), JSON.stringify({
  schema: 3, generatedAt: ctx.computedAsOf, name: config.name,
  environment: ENVIRONMENT,
  rules: Object.values(ruleIndex).map((r) => ({
    id: r.id, statement: r.statement, page: r.page, anchor: r.anchor,
    status: r.status, tier: r.vocab.tier, origin: r.vocab.origin,
    caveats: r.caveats, tests: r.meta.tests, sources: r.meta.sources,
    // Always present, empty when nothing narrates the rule, so a caller that wants "which rules
    // have a walkthrough" can filter rather than guess. Each entry carries the narrative's own walk
    // state for the same reason the page does: the machine surface must not imply more than the
    // rendering does. Schema 3 because that state's SHAPE changed — `verified` moved into a `walk`
    // object and stopped flattening `never` to null, which a schema 2 reader would misread as an
    // improvement in coverage rather than a change of vocabulary.
    appearsIn: appearsIn[r.id] || [],
  })),
}, null, 2))

for (const f of ['tokens.css', 'viewer.css', 'viewer.js']) {
  fs.copyFileSync(path.join(THEME, f), path.join(OUT, f))
}
// An optional per-corpus override, copied last so it always wins the cascade.
const custom = path.join(CORPUS, 'docs.css')
if (fs.existsSync(custom)) fs.copyFileSync(custom, path.join(OUT, 'docs.css'))

const home = config.publish[0]
if (home) fs.copyFileSync(path.join(OUT, htmlName(home)), path.join(OUT, 'index.html'))

return { pages: pages.map((p) => ({ path: p.relPath, rules: p.rules.length })),
         ruleCount: Object.keys(ruleIndex).length, out: OUT, warnings }
}

// The corpus states the ref and date its computed statuses were read from.
// Deriving it from the clock instead would put a fresh date on a stale answer.
function readGeneratedDate(corpus, cfg) {
  const rel = cfg?.statusSidecar?.path
  if (!rel) return null
  const p = path.join(corpus, rel)
  if (!fs.existsSync(p)) return null
  const m = /_Generated ([0-9]{4}-[0-9]{2}-[0-9]{2})\._/.exec(fs.readFileSync(p, 'utf8'))
  return m ? m[1] : null
}
