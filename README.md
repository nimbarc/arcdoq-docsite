# arcdoq-docsite

Turns a markdown corpus into a finished, self-contained static docs site.

No server, no request-time rendering, no theme engine. The output is HTML, CSS,
one JS file and a `rules.json` sidecar, which is exactly what a host serves.
Point it at a directory holding a `docs.json` and it emits a site.

```bash
npx arcdoq-docsite build
```

## In CI

The whole consumer workflow, with no `package.json` and no dependency of their
own:

```yaml
- uses: actions/checkout@v4
- uses: nimbarc/arcdoq-docsite@v0.6.0
  with:
    corpus: .
```

Referencing the action at a tag pins the generator to the same tag, so one line
carries one version and bumping it is the entire upgrade path.

### Publishing

Add a token and a slug, and the same step ships the site:

```yaml
- uses: actions/checkout@v4
- uses: nimbarc/arcdoq-docsite@v0.6.0
  with:
    corpus: .
    site: docs
    visibility: private
    arcdoq-token: ${{ secrets.ARCDOQ_DEPLOY_TOKEN }}
```

That is the whole thing. There is no deploy job, no artifact hand-off, no
credential to refresh: your CI builds a fileset and hands it to a host that
already knows how to serve, gate, version and roll back a site. arcdoq never
sees your repo.

**Publishing is opt-in by the presence of the token.** Omit `arcdoq-token` and
the action only builds, exactly as it did before — so bumping the tag can never
start publishing something you did not ask it to.

**Only your default branch publishes, and only from a trusted trigger.** A docs
repo usually runs `on: [push, pull_request]`, and a pull request from a branch in
the same repo does receive secrets — so without this, opening a PR would put that
branch's docs into production. Runs on any other ref say so and skip. Point it
elsewhere with `publish-branch: release`, or pass `publish-branch: "*"` if you
genuinely want every branch to publish.

The branch check alone is not enough, so publishing also requires the event to be
`push`, `schedule`, `workflow_dispatch` or `release`. `pull_request_target` and
`workflow_run` report your *default branch* as the ref while running a pull
request's head — and `pull_request_target` deliberately delivers secrets to fork
PRs — so a branch check by itself would let an outside contributor's markdown
publish to production. `merge_group` is excluded for the same reason: a merge
queue runs code that has not landed. If you need one of these, say so rather than
working around it; the allowlist is the point.

**The slug is the key.** Every run deploys to the site named by `site`, so
nothing is stored between runs and no id is ever committed back into your repo.
The first run creates the site; every run after updates it. Renaming that site
in the arcdoq app breaks the link, and the next run will create a new one — so
don't, or change `site` to match.

| Input | | |
|---|---|---|
| `arcdoq-token` | — | a deploy token, from a secret. Its presence enables publishing |
| `site` | — | the site's slug on arcdoq. Required when publishing |
| `site-name` | the slug | display name, used only when the site is first created |
| `visibility` | none — **required on create** | `public` or `private`, honoured only on create |
| `publish-branch` | your default branch | which branch may publish; `"*"` for every ref |

**`visibility` is required the first time, and has no default.** arcdoq refuses to
choose: a deploy runs with nobody watching, and guessing wrong is either an outage
(private when it should be public) or a leak (public when it should not be). For
internal documentation — anything naming your source paths, test names, or what is
live in production versus only on stage — `private` is almost certainly right. It
is the example above for that reason.

After the first deploy you can drop the line: a republish keeps whatever the site
already is. `visibility` applies on create and is then left alone, because a
routine CI run should not be able to flip a live site's exposure. Asking for one
that disagrees with what is live is refused rather than ignored, so a job can never
believe it made something private when it did not. Change it in the app.

A published site is not always *reachable* the instant the step goes green. A
private site needs its own edge route, which takes a few minutes to come up, and
the step says so rather than printing a URL that would 404. It still passes —
the deploy succeeded — but it will not call the site live until it is.

### Getting a token

Ask whoever administers your arcdoq workspace. Tokens are long-lived, scoped to
one workspace, and revocable; store one as a repository secret (the example
above expects `ARCDOQ_DEPLOY_TOKEN`) and never in a file. It is shown once at
issue and cannot be recovered afterwards.

**`ARCDOQ_DEPLOY_TOKEN` is the only credential this package uses.** If your
corpus *computes* its statuses, it needs a second one — a GitHub token with read
access to the repository your rules cite — but that is between your workflow and
GitHub, and nothing here reads it.

Name it so it cannot be mistaken for an arcdoq credential: `SOURCE_REPO_TOKEN`,
not `ARCDOQ_REPO_TOKEN`. A name one word away from the mandated one, sharing the
`ARCDOQ_` prefix, turns `ARCDOQ_REPO_TOKEN is not set` into a line a reader
correctly hears as *something is wrong with my arcdoq token* — and sends them
looking for the fault in arcdoq rather than in an unset, optional, unrelated
GitHub PAT. That has already happened once, within an hour of a first publish.

## Install

```bash
npm i -D github:nimbarc/arcdoq-docsite#v0.6.0
```

A git dependency, versioned by tag. No registry and no auth needed. Publishing
to a registry later is a one line change here and nothing else.

## Use

```bash
arcdoq-docsite build   [--corpus <dir>] [--out <dir>] [--strict]
arcdoq-docsite publish --site <slug> [--dir <dir>] [--name <name>]
                       [--visibility public|private] [--repo <owner/name>] [--dry-run]
```

| `build` | Default | |
|---|---|---|
| `--corpus` | `.` | the directory holding `docs.json` |
| `--out` | `dist` | output directory |
| `--strict` | off | exit non-zero if the build reported any warning |

Use `--strict` in CI. Under a push model nobody reads the build log again once
the check is green, so a warning that does not fail is a defect that ships.

| `publish` | Default | |
|---|---|---|
| `--site` | — | the site's slug on arcdoq (required) |
| `--dir` | `dist` | the built directory to send |
| `--name` | the slug | display name, used only on create |
| `--visibility` | none — **required on create** | `public` or `private`, honoured only on create |
| `--repo` | `$GITHUB_REPOSITORY` | provenance recorded with the published version |
| `--dry-run` | off | print exactly what would be sent, and send nothing |

The token comes from `ARCDOQ_DEPLOY_TOKEN`, never a flag — a flag is visible in
the process table and lands verbatim in shell traces, and this credential is
long-lived. `--dry-run` needs no token, which is what makes a wiring problem
debuggable from a local checkout.

Files that arcdoq cannot serve (a stray `.md`, a `.zip`) are skipped and named
in the output rather than dropped quietly; junk like `.DS_Store` and
`node_modules` is dropped outright.

## What it reads

**`docs.json`** is required, and it is both the navigation and the publish
filter. A page absent from its nav is not published. Groups render in declared
order, and a group whose pages hold no rules is set back so it reads as a gap
rather than as a second, larger section.

**`rules/`, `flows/` and `guides/` are load-bearing directory names.** A page's
path prefix is what gives it its kind, and the kind changes how it renders: a
`##` on a rules page groups rules and is set as a structural label, while the
same heading on a flow or a guide is the reader's own and is set as one. The kind
shows on the page and beside every search result. Nothing else about the layout
is prescribed — depth, area folders and filenames are yours.

Exactly four page-level frontmatter keys are read, and three of them exist for
guides:

| Key | |
|---|---|
| `area` | the corpus's own spelling of the area, matched loosely against `areaLabels` |
| `verified` | the date a **person** walked the steps, or `never` |
| `walked-by-agent` | the date an agent drove a browser against a deployed build |
| `walked-in` | which environment, and which build, it was walked in |

`walked-by-agent` is what turns the provenance strip on: it renders the human
date — or `never`, toned as pending — the agent date, where it was walked, and
how many claims the page makes with how many are still unobserved. `verified:`
alone rides in the warrant line beside the kind. Declare neither and neither
renders, which is less detail rather than a wrong answer. Anything else in the
frontmatter is the corpus's own and is ignored here; a page's title comes from
its `#` heading, never from a key.

**`docs.config.json`** is optional. See `docs.config.example.json`. It carries
the accent colour, the area label map, and the evidence marker vocabulary.
Merging is shallow per top level key: overriding `areaLabels` supplies the whole
map. Half a customer's labels and half of ours is worse than either.

An `areaLabels` key is matched loosely, because the same area is spelt three
ways across a corpus: `rules/auth-organizations/` is the directory, which the
nav and the ledger key on, and the page's own `area:` frontmatter is whatever
the corpus wrote there — often the source folder, `AuthOrganizations`. Case,
separators and Latin accents are ignored, so one declared entry serves all three
sites and no map needs the same area twice. Declaring it twice anyway is
harmless while both spellings carry the same label — that was the only way to
get a correct site before the key spaces were joined. Two *different* labels for
one area are reported, and the first declaration wins.

Two warnings guard the way this shape fails, and `--strict` makes either a red
build. A key that names no area the corpus publishes is a typo or a directory
that was renamed. A page whose `area:` matches no key while its own directory
does is a site that names one area two ways — the declared label in the nav, the
raw string on the page — which is the thing the map exists to prevent.

**`docs.config.json` -> `evidence`** declares the per-claim marker vocabulary,
and it exists for guides. A walked page cannot honestly be stamped once at the
top: some of it was seen rendering and some was only read from source, and the
reader needs to know which sentence is which. Declare the tokens and each becomes
a designed glyph in place, the claim it closes is marked and counted, and a
legend table on the page renders as a key rather than as a table.

```json
"evidence": {
  "coverageWords": ["all", "both", "each", "every"],
  "markers": [
    { "token": "✅", "id": "seen", "short": "seen",
      "label": "seen rendering in the browser", "glyph": "solid" },
    { "token": "📄", "id": "from-source", "short": "from source",
      "label": "read from source, silent about what renders", "glyph": "dashed" }
  ]
}
```

A token is an arbitrary string, so `(v)`, `[src]` and `†` work as well as an
emoji. `coverageWords` is what keeps a summary line — *"All 📄."*, *"The rest are
📄."* — from counting as a claim of its own and inflating the tally: a run built
only from those words takes the glyph without opening a claim.

**`docs.config.json` -> `statusSidecar`** is optional and worth knowing about.
Some corpora compute a status token that carries more than one fact: the same
token can mean "the behaviour changed" or "only the evidence changed", which are
not the same answer to *can I rely on this?* Declare the file and the headings
that separate them and the rendering respects the split. Declare nothing and the
status renders unsplit, which is less detail rather than a wrong answer.

**`docs.config.json` -> `refs`** names which branch plays which role. Every
corpus that computes statuses has a ref that is live, one the docs are written
from, and one earlier than both — but only the spellings vary, so the package
keys on the roles and you supply the names:

```json
"refs": { "production": "origin/main", "candidate": "origin/stage", "development": "origin/dev" }
```

Declare `production` and a corpus can no longer say *matches production* about a
comparison it ran against something else: an `environment` file whose `baseline`
disagrees with it fails a `--strict` build. Declare nothing and nothing is
checked, which is less detail rather than a wrong answer.

**`docs.config.json` -> `environment`** is optional and matters to anyone whose
statuses are computed from code living somewhere else. A status says *this
matches production*; it never says *as of when*, so a reader has no way to tell a
current answer from a stale one. Declare the file and `rules.json` carries the
refs and commits the statuses were computed against. Declare nothing and the key
is `null`, which is less detail rather than a wrong answer.

The corpus writes that file; this package only carries it. Write it from the same
tool, in the same run, that computes the statuses — a date taken from some
neighbouring tool's clock is a different fact wearing this one's name.

```json
{
  "schema": 1,
  "computedAt": "2031-03-04",
  "baseline": "origin/release",
  "sources": [
    { "cite": "orders", "name": "svc-orders", "ref": "origin/candidate",
      "commit": "3f9a1c7e55b0d2418ac6e0f7b91d3a4c6e28f015",
      "ahead": 12, "committedAt": "2031-03-02" }
  ]
}
```

`baseline` is what `ahead` is ahead *of*, and it travels beside the number rather
than in config so the two cannot drift apart; a source stating `ahead` without a
`baseline` keeps the commit and drops the number. `cite` is the prefix your rules
use in `Source:` — supplying it is what lets a reader join a single rule to the
repo state it was computed against. Only `commit` is required; a source without
one is dropped and warned about. Everything is warned about: with `--strict` on
by default, a declared file that is missing, unparseable, or the wrong `schema`
fails the build rather than quietly yielding nothing.

**`docs.css`** is optional, copied last so it wins the cascade. It is the way
out for anyone going off road. Nothing about it is supported.

## Authoring with an agent

`skill/SKILL.md` ships in the package. It is the authoring discipline the
conventions above assume: what may be asserted versus what must be computed,
how to write a statement, how a guide is drafted from front-end source and then
walked in a browser without laundering a guess into an observation, and the
questions to ask a new corpus before writing a single rule — starting with what
your three branches are called, which nothing can guess.

Point an agent at it at the tag you are pinned to. It is deliberately thin:
principles and a pointer back to this README, not a copy of it. A skill that
restates the package is a fork of the package that ages separately.

## Why a dependency and not a template

A template freezes each site at the moment it was forked, and no improvement
ever reaches it again. This ships as a versioned dependency instead, so a better
design arrives with `npm update`. Customisation is `docs.config.json` plus that
CSS override. Forking stays possible; nobody should need to.

## What it is opinionated about

The design is the product here, so it makes decisions rather than exposing
knobs. The ones worth knowing before you point it at a corpus:

**A rule is an addressable object.** If a heading matches `AREA-NNN — statement`
it renders as a bounded article carrying the corpus's own `<a id>` anchor, with
the ID as its permalink control. Explicit anchors are hoisted, never
regenerated, because a slugified title changes the moment someone rewords it and
every link that was pasted into a ticket dies with it.

**The statement leads and the evidence follows.** A `**Status:** … **Test:** …
**Source:** …` line under a rule heading is split by role: the status rises into
the margin, the citations sink below the prose. It renders open, never behind a
disclosure, because a closed `<details>` is invisible to find-in-page in Firefox
and Safari and a page of them is a page of tab stops.

**Status is a tier plus caveats, never a ladder.** A rule can match production
and still have nothing testing it. A single badge cannot say that, so the
rendering carries the qualification alongside the verdict. Labels and vocabulary
are yours to declare; the structure is not. Nothing about any one corpus's
statuses, area names or section headings is baked in.

**Declared provenance markers become designed glyphs.** If a page declares a
marker vocabulary, or carries a legend table, those tokens are replaced in place
and the claims they close are marked. The minority state gets permanent quiet
decoration so it is legible at rest, with no hover and no JavaScript. The token
is an arbitrary string, so `(v)`, `[src]` or `†` work exactly as well as an
emoji. The feature is declared provenance notation, not emoji support.

**Monospace is a citation typeface, not a mood.** It is used only on strings
that paste into a tool: IDs, paths, test names, code. Prose stays prose.

**It is built to be read on a phone, not merely to fit one.** Below 720px the
mark column folds into the heading: the ID and the verdict take one row, the
statement takes the full measure below them. The sticky ID rail is *replaced* in
the flow rather than hidden, because the reader still arrived holding an ID.
Two-column tables stack into term-and-definition pairs; wider ones keep their
columns and scroll, because a matrix does not survive being stacked.

## Output

```
dist/
  index.html          a copy of the first published page
  <page>.html         one per published page
  rules.json          every rule with id, status, tier, caveats, tests, sources,
                      the flows and guides that narrate it, and the code state
                      it was all computed against
  tokens.css          the portable primitive ladder, light and dark
  viewer.css
  viewer.js
```

`rules.json` is the machine surface. It is what lets an agent answer *which
rules in this area are not confirmed against production* as a filter rather
than a fuzzy text match, and — when the corpus declares an `environment` file —
*and how stale is that answer*, which the statuses alone never say.

`appearsIn` answers the reader's other question, the one a status cannot: *is
there a walkthrough for this, and has anyone actually walked it?* A flow or guide
links down to the rules behind its steps; that link is read back so a rule names
the narratives that contain it, each carrying its own `verified:` state. Empty
when nothing narrates the rule. It says a narrative exists and how far it has
been checked — never that the rule itself was observed.

The same values ride on the rendered page: each rule's `<article>` carries
`data-rule-id`, `data-status`, `data-tier` and `data-origin`, so a reader that
parses the HTML is never told less than one that parses the sidecar.

### The attributes on the page, as a contract

A content index that harvests `data-*` off the HTML is reading a public
interface, so here is the whole of it. It is stated rather than implied because
it is shared with software in another repository, and a shape that only exists
as a habit is one a later change widens without noticing.

| Element | Attribute | Value |
|---|---|---|
| `<article class="rule">` | `data-rule-id` | the rule's ID, e.g. `ORD-004` |
| | `data-status` | the corpus's own status token, unchanged |
| | `data-tier` | `confirmed` · `unconfirmed` · `broken` · `neutral` |
| | `data-origin` | `computed` · `asserted` · `none` |
| `<article class="page">` | `data-kind` | `guide` · `flow` — the page's genre |
| | `data-rules` | every rule the page links down to |
| `<section class="prose-group">` | `data-rules` | the rules that step links down to |

Four properties hold across all of it, and each one is asserted by a test:

- **Every attribute sits on the open tag of the block that owns the fact** — an
  `<article>` or a `<section>`, never a descendant of one. A `data-*` on the
  paragraph holding a link, or on the link, is not part of this contract and is
  not collected by anything.
- **A multi-value attribute is whitespace-separated**, the way `class` and `rel`
  already are. `data-rules="ORD-002 ORD-003"` is the shape. A step usually
  covers more than one rule and HTML cannot repeat an attribute.
- **An attribute with nothing to say is absent**, never empty. A consumer that
  files each `data-*` as an exact-match facet would otherwise index every prose
  step under an empty `rules`.
- **No value contains a quote character**, and every key is lowercase. `copy`,
  `theme`, `cols`, `label` and `tone` are avoided as key names: content indexes
  treat them as presentational and drop them.

`data-kind` is the genre, single-valued and opaque, and always one word — a
consumer that stores it verbatim rather than tokenising it still gets a value
that matches a filter for `guide`. Only guides and flows carry a page root — a
rules page's root would be a block whose text is every rule on the page,
duplicating each rule's own `<article>` for anything reading both. The page
warrant and the provenance strip sit outside that root, because they are the
generator describing the document rather than the document's own prose.

The root's `data-rules` is not a convenience rollup of its steps'. *Which
walkthroughs cover this?* is asked about the walkthrough, and the root is the
only block a rule linked from the page's lead can appear on, because the lead
belongs to no step. A guide that mentions a rule once, in its introduction,
would otherwise be unfindable by an ID it genuinely covers.

`data-rules` and `appearsIn` are one fact read from opposite ends — the step
names the rules it covers, the rule names the narratives that cover it — and
both are derived from the same scan of the rendered page, so a build cannot
answer the two questions differently.

## Theming

`tokens.css` is two layers. Layer one is the portable ladder: canvas, surface,
line and ink at a single tinted hue, in both themes, with the state accents
retuned per theme rather than inverted. Layer two maps that onto docs
vocabulary. Only layer two knows what a rule is.

Light is the default and dark is a real peer, not a token. A corpus is read for
minutes at a time, which is a different scene from an instrument you glance at.

## Tests

```bash
npm test
```

Builds a small fictional corpus under `test/fixture/` and asserts the calls
above actually hold: that a rule is addressed by the corpus's own anchor rather
than a slugified title, that the evidence follows the statement in the DOM, that
no declared marker survives as a raw glyph, that a marker used as a noun is not
treated as a claim, that claim counts come from the render so the page cannot
disagree with itself, that a relative link resolves against its own directory,
and that a declared status sidecar splits one token into its two meanings while
declaring nothing degrades to less detail rather than a wrong answer.

They also cover the parts a phone depends on: that the ID is a sibling of the
heading rather than inside it, that a rules page carries an ID index for the
widths where the sticky rail cannot exist, that a two-column table carries what
is needed to stack it while a three-column one does not, and — running the
shipped `viewer.js` against a small fake DOM — that the client layer survives a
load with no fragment, which is every load that is not a deep link.

The fixture is invented. Nothing in this package is shaped around one corpus.

## Why it renders this way

[`DESIGN.md`](DESIGN.md) carries the reasoning and the rejected alternatives:
why the metadata line splits by role, why status cannot be a ladder, why the
minority provenance state gets the decoration, and the reflex-reject table of
what every docs theme does and which of it was kept, reshaped or cut.

## Licence

MIT.
