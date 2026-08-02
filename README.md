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
- uses: nimbarc/arcdoq-docsite@v0.1.0
  with:
    corpus: .
```

Referencing the action at a tag pins the generator to the same tag, so one line
carries one version and bumping it is the entire upgrade path.

Publishing is deliberately not a step in that action yet; see `action.yml` for
why. When it becomes one, consumers get it by bumping the tag they already
reference, which is the reason to use the action rather than copying its steps.

## Install

```bash
npm i -D github:nimbarc/arcdoq-docsite#v0.1.0
```

A git dependency, versioned by tag. No registry and no auth needed. Publishing
to a registry later is a one line change here and nothing else.

## Use

```bash
arcdoq-docsite build [--corpus <dir>] [--out <dir>] [--strict]
```

| Flag | Default | |
|---|---|---|
| `--corpus` | `.` | the directory holding `docs.json` |
| `--out` | `dist` | output directory |
| `--strict` | off | exit non-zero if the build reported any warning |

Use `--strict` in CI. Under a push model nobody reads the build log again once
the check is green, so a warning that does not fail is a defect that ships.

## What it reads

**`docs.json`** is required, and it is both the navigation and the publish
filter. A page absent from its nav is not published. Groups render in declared
order, and a group whose pages hold no rules is set back so it reads as a gap
rather than as a second, larger section.

**`docs.config.json`** is optional. See `docs.config.example.json`. It carries
the accent colour, the area label map, and the evidence marker vocabulary.
Merging is shallow per top level key: overriding `areaLabels` supplies the whole
map. Half a customer's labels and half of ours is worse than either.

**`docs.config.json` -> `statusSidecar`** is optional and worth knowing about.
Some corpora compute a status token that carries more than one fact: the same
token can mean "the behaviour changed" or "only the evidence changed", which are
not the same answer to *can I rely on this?* Declare the file and the headings
that separate them and the rendering respects the split. Declare nothing and the
status renders unsplit, which is less detail rather than a wrong answer.

**`docs.css`** is optional, copied last so it wins the cascade. It is the way
out for anyone going off road. Nothing about it is supported.

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
  rules.json          every rule with id, status, tier, caveats, tests, sources
  tokens.css          the portable primitive ladder, light and dark
  viewer.css
  viewer.js
```

`rules.json` is the machine surface. It is what lets an agent answer *which
rules in this area are not confirmed against production* as a filter rather
than a fuzzy text match.

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
