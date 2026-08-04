# Design

Why this renders the way it does, and what was rejected on the way. The README
says what the package is; this says why, so the next change is a decision rather
than a re-derivation.

Designed against a real corpus of ~50 pages: rules derived from tests, flows,
hand-written guides, generated reference, and a visible coverage burn-down. Every
call below was made against that content and then adversarially reviewed. Where a
first answer was overturned, the overturning is recorded, because the reason it
was wrong is more useful than the answer that replaced it.

---

## Direction in one line

> **A register of numbered claims, each arriving cold and expected to stand up
> alone. The statement leads, the evidence follows, and nothing is ever rendered
> more certain than it is.**

Every clause does work.

**Register** is literal. IDs are sequential and never reused, because old tickets
link to old IDs. A register is a numbered list of individually citable entries,
which is what this is and is not what a manual is.

**Arriving cold** names the dominant journey and kills the manual furniture. The
reader has a ticket citing `AREA-012` and lands mid-page. No reading order, no
prev/next, no tutorial spine, no onboarding.

**The statement leads, the evidence follows** is the highest-leverage layout
ruling here, stated as a law.

**Never rendered more certain than it is** promotes an authoring rule (a
confidently wrong claim is worse than a missing one) into a design veto. It is
what fails a status chip that flattens a caveat, a git-derived "last updated"
beside a human `verified:` date, and any provenance transform that guesses.

Three questions every decision has to pass:

1. Is this element the claim, or the warrant? If neither, justify it or delete it.
2. Does this treatment make anything look more certain than it is? If yes it is a
   correctness bug, not a style note.
3. Does it survive both a 375-byte stub and a 20 KB page of 35 rules? If not, it
   is not a system.

---

## The rule atom

### The mark column

The load-bearing form. A narrow left channel runs the length of every rules page
carrying the ID and, beside the first line of prose, the status verdict. It is
the marginal-reference column of a ledger or a statute, not the inline badge a
docs theme reaches for.

It earns its place because the reader arrived holding an ID, not a phrase. A
column of IDs is scannable by the exact key they have. It also gives the page a
vertical rhythm that survives 35 consecutive rules without boxes.

**Rejected: a card or bordered box per rule.** Thirty-five boxes read as a form,
not a document, and the border breaks the reading measure of the one thing that
needs it. Separation comes from space, the marching mark column, and the
terminating warrant line.

### The fold

Below 720px the mark column has nowhere to be, so it folds into the heading: the
ID and the verdict take row one together, the statement takes the full measure
below them. They fold as a **pair**, because they are the same channel. The
statement is not demoted by this — the law being protected is that nothing sits
between the heading and the first sentence of the answer, and the ID and the
verdict are heading furniture, not an interruption.

**Rejected: the verdict on its own row above the ID.** This is what the first
implementation actually did, against its own comment. Three rows where two will
do, the least important line first, and a verdict floating above an ID it
belongs beside — a status banner introducing a rule rather than a mark against
one.

### The ID is a sibling of the heading, not a child

Two things fall out of it. The heading's accessible name becomes the statement
alone, rather than `ORD-001, permalink An order cannot be placed…`. And the ID
and the verdict become siblings, which is the only way they can share a row when
the column folds without moving a status string inside an `<h3>` — which would
put the verdict in the first thing a screen reader announces, the exact burial
the DOM order below exists to prevent.

### DOM order is not visual order, deliberately

The verdict sits in the margin beside the first line of prose, but **after** the
body in the DOM. A serial reader hears statement, then answer, then status. A
sighted reader sees status parallel to the prose.

Getting this backwards reinstates exactly the burial the design exists to remove,
for the reader who can least skip it.

### The metadata line splits by role

A corpus line like `**Status:** … **Test:** … **Source:** …` stops existing as a
line. Status is a conclusion and rises into the margin. Test and Source are the
*warrant* for that conclusion and sink below the prose as the article's closing
line. Nothing sits between the heading and the first sentence of the answer.

Position was the defect, not weight. Those lines run 174 to 414 characters;
shrinking the type produces a smaller grey wall in the same damaging place.
Moving it costs nothing.

**Rejected: collapsing the citations behind `<details>`.** A closed `<details>`
is not reachable by find-in-page in Firefox or Safari, which would break Ctrl-F
for every cited test name on the page. It also adds roughly three focusable
controls per rule, and it creates a print problem, since `details { display:
block }` does not open a closed element in Chrome or Safari. All of that to hide
something that is no longer in the way.

**Rejected: setting test names in the prose face.** They are citations, and some
contain parameterised placeholders that read as typos in prose. The readability
win comes instead from hoisting a repeated suite prefix to a label shown once,
leaving only the distinguishing tail per citation.

**Rejected: left-truncating source paths.** Truncating a citation is exactly as
unusable as truncating a route. They wrap.

### The warrant's last row is navigation, and stays per-rule

A guide or flow linking down to a rule earns that rule a row naming it, last in
the same `<dl>` that carries Test and Source. Last because the evidence backing
the claim precedes the pages that merely mention it; getting it backwards would
read as though a narrative were warrant.

Each entry carries **the linking page's own `verified:` state**, never the
rule's. A guide is `verified: never` until a human walks it, so a bare "walked
in X" would launder exactly the distinction the per-claim marker system exists
to keep. The row says a narrative exists and how far it has been checked. It
never says the rule was observed.

**Rejected: collapsing the repetition when one guide narrates many rules on a
page.** Measured on the first real corpus — 9 of 20 rules carrying an identical
row — the repetition costs 2.1% of page height on desktop and 2.7% at 390px,
where it is the shortest row in the warrant. Against that, every collapse moves
the fact off the rule the cold reader landed on and onto the page, which trades
the dominant journey for the one this design de-prioritises. It is also an
artifact of a corpus having exactly one guide: a second guide covering different
rules makes the warrants distinct on its own. Source rows and hoisted suites
already repeat identically down the same page and were never collapsed either.

The axis that does not self-limit is the opposite one — many narratives on a
single foundational rule, one row per guide, unbounded. Each entry costs 20.6px
against a 169px claim, so the navigation block reaches the claim's own height at
eight entries and passes it on the ninth. The answer there is a cap or a fold,
never a collapse. Not built: no corpus is near it. `DEFECTS.md` §4 carries the
measurements, including the reason a test-heavy rule's warrant already exceeds
its claim before any of this applies.

### Anchors are hoisted, never generated

If the corpus author wrote an explicit anchor above the heading, that becomes the
rule's address. A slugified title changes the moment someone rewords it, and
every link pasted into a ticket dies with it.

This is subtle to implement: a bare `<a id="…"></a>` sitting directly above a
heading with no blank line is lexed as a **paragraph**, not an HTML block. Miss
that and every rule silently gets a slugified title instead. It has a test.

### Status is a tier plus caveats, never a ladder

The correction that makes the axis true rather than tidy.

A rule can match production and still have **nothing testing it**. A pure ladder
renders those at maximum confidence, visually identical to a fully warranted
rule. So tier answers *can I act on this?* and caveats attach orthogonally to any
tier, including the confirmed one:

```
Matches production · nothing tests this
```

**Rejected: a status pill or badge per rule.** No room for the caveat, and on a
typical page most rules would say the same unremarkable thing, which is
wallpaper.

**Rejected: rendering a "not yet in production" token as "not live".** A corpus
may compute one status token that carries more than one fact: the implementation
moved, or only the evidence moved. Those are different answers to *can I rely on
this?* and the second one is live in production today. A control that says "not
live" would be wrong about it. The renderer therefore supports a declared
sidecar that separates the cases, and renders them differently. Declare nothing
and it degrades to the bare token, which is less detail rather than a wrong
answer.

Computed versus author-asserted is carried structurally, never by hue: a computed
status renders with an as-of date, an asserted one with a visible reason instead.
Two non-colour signals, no widgets.

### The machine surface mirrors the page, from the run that produced it

A status says *this matches production*. It never says *as of when*, and a reader
who cannot date the answer cannot tell a current one from a stale one. That is
the whole of what `environment` adds, and it is not a new fact: a corpus that
computes statuses against source refs already renders the refs and commits it
read, because a human reader needs the same date the machine one does. So the
sidecar is the mirror of a page that already ships, and the field set is that
page's columns.

Mirroring is what makes it correct rather than merely present. The tool that
computes the statuses writes the file in the same run, so the date beside a
commit is the date that commit was read. `baseline` travels inside the file
beside the `ahead` count it qualifies — a number is ahead *of* something, and
splitting the two across a config file and a data file is how they come to
disagree. A source that states one without the other keeps the commit and drops
the count.

**Rejected: reading whatever sync-state file the corpus already keeps.** It is
the tempting version, because the file usually exists. It is also how you publish
a different tool's clock under this one's name — a forward-sync cursor answers
*when did we last pull*, not *when was this computed*, and the two differ by
however long sits between those jobs. A freshness field that is quietly stale is
worse than an absent one.

**Rejected: the CI runner's clock, or the docs repo's own commit.** Both are free
and neither answers the question. They date the *build*, and a build re-run today
against a month-old sync would date itself today while stating month-old truths.

**Rejected: passing the corpus's file through verbatim.** It keeps this package
honest at the cost of moving the coupling into every reader, and it makes
"agrees with what the page shows" undefinable — there is nothing to agree about
if the shape is whatever one customer emitted. The package declares a shape; the
corpus meets it. Anything the file invents beyond that shape is dropped.

---

## Provenance

Some corpora mark individual claims with their evidence: *seen rendering* versus
*read from source*. These are the most epistemically important marks on a page
and a generic renderer treats them as emoji in prose.

**Declared tokens become drawn glyphs** in `currentColor`, from a closed set of
shapes. Raw emoji are vendor-coloured bitmaps that differ across platforms,
cannot take a semantic tone, and at body size are optically louder than the
sentence they annotate.

**Shape carries the state; colour never does.** The two states are not pass and
fail, so any tick/cross or red/green read is a content lie in both directions:
*from source* means code-accurate and unobserved, not wrong.

**The minority state gets permanent quiet decoration.** This inverted once the
distribution was measured. The first pass assumed nearly all prose was marked and
therefore that any permanent decoration would be texture, which forced the entire
interaction budget into a hover popover. The real figure was under half the
prose, roughly five to one in favour of *seen*. Decorating the rare state instead
makes it legible on arrival, at rest, on touch, with no JavaScript and no control.

**Rejected: the hover popover.** It rejected `title` tooltips as unavailable on
touch and unreliable in assistive tech, then shipped a bespoke popover that was
unavailable on touch, not dismissible without moving the pointer, and reachable
by keyboard only after finding a toggle. A strictly worse `title`.

**Rejected: binding the feature to a path glob.** A page gets this treatment
because it *declares* a marker vocabulary or carries a recognised legend, not
because it sits in a folder. The glob broke on the very README that documents the
notation, rendering the definition of the marks in the marks.

**Rejected: content-hashed claim IDs.** They were justified by citing the passage
that mandates authored anchors precisely because derived ones are unstable, then
shipped a derived anchor whose stated virtue was instability.

**The token is an arbitrary string.** `(v)`, `[src]` or `†` work exactly as well.
The feature is declared provenance notation, not emoji support.

### Scope inference

A marker *closes* a run: the run starts at the previous marker or the container
start and ends before this one. Two guards keep it honest.

**Position.** A token is a mark only when it closes a clause. Used as a noun
("the rest are 📄.") it renders as a bare glyph and opens nothing.

**Topic.** A run that is nothing but coverage words is a topic sentence, not a
claim, and is left unwrapped. A paragraph that is *only* coverage words plus a
marker attaches as a block-level tag to the block above it.

Everything fails toward leaving the author's bytes alone.

### Counts are computed by the renderer

The page-level tally is accumulated during rendering, never by a second scan of
the source. Two counts that can disagree is precisely the drift failure this kind
of corpus exists to prevent, and the honesty strip would be the thing telling the
lie.

---

## Navigation

**The sidebar is a ledger.** Areas carry a rule count and a short proportional
bar showing the confirmed share. Groups come from the corpus's declared
navigation, in declared order, so the generator cannot disagree with the corpus
about what the site contains.

**A group of nothing but undocumented areas is set back**, so it reads as the
burn-down it is rather than as a second, larger section. The promise it carries
is that a search returning nothing can only mean *undocumented*, never
*published but unfindable*. On desktop that promise is the group itself, always
rendered. Below 860px the collapse takes it along with every other group, and
the promise is carried by the route instead, which indexes the stub pages like
any other page. This said "it is never hidden", flatly, which is how it came to
be false on a phone for a release without ever contradicting the page.

**The area label is the link to that area's index**, and the count covers every
page in the area including that index. A ledger row that names an area, counts
it, and cannot be clicked to it leaves a published page named nowhere — and
since the mobile collapse keeps the group holding the current page, and decides
that by `aria-current`, arriving on a page the nav never names rendered an empty
sidebar rather than a wrong one.

**No coloured status dot per nav item.** A page's status is a rollup of a mix, so
any single dot picks one and lies about the rest.

**The in-page index is an ID chip rail, not a title ToC.** Rule titles average
about 70 characters and wrap to three lines each in a rail, producing something
that needs its own scrollbar. Worse, a title ToC indexes the wrong key: the
reader arrived holding an ID. Chips are three characters, fit in a fraction of
the space, and carry the tier mark, so the rail doubles as a release-test view
for free.

**No breadcrumb.** That slot carries the page warrant instead: content type,
area, and the status distribution. A breadcrumb restates the H1 and the URL.

**No prev/next, in either form.** A reference corpus has no reading order, and
per-rule adjacency pagers assert continuity across topic boundaries that is not
there while pointing at a rule already visible one screen down. Linear paging
stays available behind a flag for corpora that genuinely are books.

**Mobile is a route, not a modal.** Search is a real URL, so the back button
works and a query is pasteable. There is no dialog, therefore no focus trap to
get wrong and no JavaScript floor to fall through.

This was written as a ruling and then not built: v0.1.0 shipped the modal mobile
sheet named two sections down as cut outright, at every width, and ten of the
fourteen defects left after the browser pass were symptoms of that one thing.
The rebuild is what the ruling already said. Three things it settles that the
original text left open, because leaving them open is how a rules-only index
shipped without ever contradicting the page:

**The whole corpus is indexed, not just the rules.** A search that returns
nothing has to mean *the behaviour is undocumented* — that is the promise the
undocumented-areas group is never hidden for. While the index was `rules.json`,
it could equally mean *published, but not searchable*: a phone reader searching
`inventory` got nothing while the area sat in the nav beside them. Two meanings
for one empty result is the ambiguity this design refuses everywhere else.

**The index is baked, and the client only hides rows.** The generator already
holds every string and already escapes it. Writing fetched corpus text into
`innerHTML` at read time re-did that work in the one place that did it wrong,
and put a network race in front of an answer that was already known at build.
Nothing is constructed at runtime; the query is written back with `textContent`
and reaches the DOM nowhere else.

**The floor is the index itself.** A static host cannot filter `?q=` before it
is sent, so with JavaScript off the route renders the complete list — every rule
and every page, each one a live link — and says so. That is the honest version
of "no JavaScript floor to fall through": not that the query works without
script, but that the page is a browsable index of the site rather than nothing.

**Rejected: keeping the overlay on desktop and routing only on a phone.** It
reads as the conservative option and is the expensive one — two search
implementations, two ARIA models, and the desktop half keeps every defect the
ruling was aimed at, since a dialog is a dialog at 1440px too.

**The rail has an in-flow twin below its breakpoint.** The sticky column cannot
exist at phone widths, and hiding it left nothing behind: no way to reach a rule
by the one key the reader arrived holding. The same chips, in the flow, closed,
one control, no JavaScript. It is closed on arrival because the dominant journey
lands mid-page on a deep link — the index is the second action, never the first.

The two are never both on screen, so the duplicate chips are never both
findable.

**Rejected: letting the jump list stand in for it.** It carries only the
unconfirmed rules, which is a warning, not an index, and it is already on screen
on desktop where the rail is too.

**This `<details>` is not a reversal of the one refused under the warrant.**
That refusal rested on two facts, and neither holds here. The citations existed
nowhere else on the page, so hiding them broke Ctrl-F for every cited test name;
every chip here is a second copy of an ID that is still a heading in the
document. And it was three focusable controls *per rule*; this is one for the
page.

---

## Links, permalinks, keyboard

**The ID is the permalink control.** Not a hover-revealed gutter glyph, which is
undiscoverable, absent on touch, and copies the wrong thing.

**The clipboard carries both flavours.** A gated site never unfurls, so a bare
URL pastes as an opaque string. Only a dual-MIME write produces linked text that
reads as the rule ID in the surfaces this audience uses.

**The URL is derived at copy time, never baked at build.** A site's canonical
address changes over its life, so a baked origin is stale the moment a domain is
attached.

**Case recovery on arrival.** A hand-typed uppercase fragment from a ticket is
repaired with `location.replace`, because `history.replaceState` does not update
the document's target element and `:target` would never match, in exactly the
case named as the most likely permalink failure.

**The target frame persists.** It is not a two-second flash, which is gone before
a phone finishes painting. Readers demonstrably leave a rule and come back,
because rules qualify each other.

**Links resolve against the source page's directory.** Never string-matched. A
relative link from one area to another is a live link, and treating it as
unpublished silently downgrades it to grey text.

**A corpus link is recognised by its target, not by its prefix.** Only
`./` and `../` were being matched, so `[…](rules/orders/lifecycle.md)` — the
more natural way to write one, and the way this corpus's own README does — was
left untouched and shipped as a live href to a `.md` file that no host serves.
A link is a corpus link when it names a `.md` file or a directory, which is also
what keeps the rewrite off the nav, whose hrefs are already `.html` by then,
and off `#main`, the stylesheets and every absolute URL in the shell.

**A page that cannot be produced is named, never dropped.** Two corpus paths can
flatten to one output filename, and an ID can be declared twice; both used to
resolve by silently keeping the last one. The URL scheme is not changing —
every published address depends on it — so the clash is reported instead, and
`--strict` makes it a failed build. A machine surface quietly missing a rule is
the drift this corpus exists to prevent.

**Source paths and test names are not hyperlinks.** The premise of this kind of
corpus is that readers have no source access, so a link that 401s advertises a
door they cannot open. The engineer's actual next action is pasting the path into
an editor, which a copy control serves and a hyperlink does not.

**Two keyboard bindings**, and the count is honest. Both `/` and `⌘K` go to the
search route, because this audience's muscle memory is split and refusing one to
look opinionated costs a failed keystroke. Rejected: vim-style chords, since a
letter key firing mid-read in a reading surface is a bug.

The count said six, and six was already wrong: the sheet also bound `Esc`, `↑`,
`↓`, `↵`, `⌥↵` and `⌘↵`, which is eight. That is the shape this document's own
third question is meant to catch, and it was written by the same hand that
wrote the question. A route needs almost none of them — `↵` on a link, `Tab`
between links and `Esc` closing nothing are the browser's, not ours — so the
number fell to two by deleting code rather than by counting more carefully.

---

## The reflex-reject list

The category has a convergent form. Naming it is what stops the design
reproducing it unconsciously.

| Category feature | Verdict |
|---|---|
| Persistent nav, build-time search index, `⌘K`, copy-link anchors | **keep** — solved problems, spending a design idea here is vanity |
| Collapsible page-group sidebar | **reshape** — a coverage ledger instead |
| Right-hand heading scrollspy ToC | **reshape** — an ID chip rail instead |
| Breadcrumb | **reshape** — the page warrant instead |
| Note/Tip/Warning/Danger callout set | **reshape** — two mechanical stamps plus untyped prose; authored severity only |
| Prev/Next pagers | **cut** — no reading order exists |
| Status pill per rule | **cut** — no room for the caveat |
| Card grid on index pages | **cut** — and it cannot represent a priority table |
| One page per rule | **cut** — context is the neighbouring rules |
| Version dropdown | **reshape** — a read-only freshness stamp |
| "Was this page helpful?" | **reshape** — one link to ask the question the page didn't answer |
| Git-derived "last updated" | **cut** — the one cut that is harm prevention: it competes with a human `verified:` date and always looks fresher |
| Try-it playground, verb pills | **cut** — a polished reference layout styles a grep-grade listing into authority |
| Tutorial spine, hero landing, "edit on GitHub" | **cut** — wrong reader, wrong journey, no repo access |
| Hosted search | **cut** — no server, and the site may be gated. See the deferred note: the "no server" half is now less absolute than when this was written |

### The second-order trap

Having rejected the docs-theme look, the next reflex is its opposite: every rule
statement in monospace, hairline boxes, bracketed `[STATUS]` tags, uppercase
micro-labels as texture, terminal green.

**Monospace is a citation typeface, not a mood.** It is permitted only on strings
that paste into a tool: IDs, repo-qualified paths, test names, routes, code.
Statements, steps, notices, nav and headings are the prose face. This is the
corpus's own editorial rule, which fights to write behaviour as English for a
reader who cannot read source. Setting those sentences in mono re-encodes as code
the one thing the author worked to decode.

Check every treatment against both extremes: any texture that survives a
seven-line stub smothers a dense page, and any density that works on the dense
page is invisible on the stub.

---

## Theme and tokens

**Light default, dark a real peer.** The scene decides it: a tester at a desk
mid-sprint with a ticket open in the next tab, reading dense rules for minutes at
a time. That is a different scene from an instrument you glance at, and it is why
this does not inherit a dark-committed app's answer.

`tokens.css` is deliberately two layers.

**Layer one is portable**: canvas, surface, line and ink at a single tinted hue,
in both themes, plus the state accents. It carries no product vocabulary, so
another product can adopt it whole.

**Layer two maps that onto docs vocabulary**: tier, provenance, callouts. Only
this layer knows what a rule is. Merged into one file it would be a set that fits
neither.

**Light is not an inversion.** Chroma has to fall off faster at the light end or
a violet-tinted neutral turns lilac and reads sickly, and accents need retuning
rather than flipping: an accent tuned to glow on a dark canvas is invisible on a
light one. Surface steps mean "N steps of separation from canvas", so dark
separates upward and light downward and every component works in both unchanged.

**One accent is the customer's.** Links, active nav, focus ring. The semantic
colours are not: a reader learns that vocabulary once and reads it everywhere,
and a machine-readable sidecar has to agree with what the page shows.

---

## On a phone

The breakpoints were written before anything had been looked at, and three of
the four things they were believed to do were not happening. What follows is
what they do now.

**A two-column table is a definition list that was authored as a table.** At
390px it is otherwise two ribbons of wrapped words in a 108px and a 218px
column. It stacks: the first cell is the term, the rest carry the header the
dropped `<thead>` was providing. **Three columns and up keep scrolling** — a
priority table is a matrix, and stacking one destroys the comparison that is the
only reason it is a table.

**Gutters match.** The 28px left offset is the desktop spine anchor and has to
be undone at the collapse point, or it stacks on the padding and puts the
content 46px from the left edge and 18px from the right. There is no spine to
anchor to in a single column.

**Targets are thumb-sized where a thumb is what is available.** The rail's chips
are a pointer target in a 196px column; the in-flow twin's are the only way to
reach a rule by ID on a phone, and are sized accordingly. Nothing tappable is
under 24px.

**A rule that hides needs a rule that unhides, at the same level of support.**
The group collapse hides with plain CSS and unhides with `:has()`, so an engine
that lacks `:has()` kept the first half and dropped the second: an empty sidebar
on every page of the site. It sits behind `@supports` now. The fallback for a
collapse is the whole thing, never nothing.

**A group that cannot move the reader is not rendered.** The collapse keeps the
group holding the current page, which on a one-page group is a link to the page
you are already on: the H1 restated a screen-inch above itself, which is the
breadcrumb cut under Navigation, arrived at by a rule about `aria-current`
rather than by a decision. Three of the first real corpus's 22 pages rendered
it, and one of them was the hand-written guide — the page a phone reader is
likeliest to arrive on from a pasted link.

**The way out is a route, not a disclosure.** One ledger line at the foot of the
nav, a name and a count, pointing at the index that already exists. Search being
a route is what makes this enough: the reader who does not know what to search
for still lands on a page listing every rule and every page as live links.

**Rejected: a disclosure holding the other groups.** It is the obvious shape and
it was queued as one. It is a second in-page copy of the nav and a second
control meaning *index* on a page that already carries the in-flow rail, and at
rest it does not even remove the self-link it was reached for: measured at 390px
it added 40px of chrome and pushed the title further down the page than doing
nothing at all.

**Rejected: moving the nav below the content.** It buys the best number on the
board — a rules page's title climbs from 597px down the page to 301px — and it
buys it for nobody. The dominant journey is a deep link, which scrolls past the
nav on arrival and never paid for its height; the reader it charges is the one
who wants the ledger, now twenty rules below the fold.

**The layout is chosen by the screen, not by the paper.** A bare `max-width`
query applies to paged media too, and the page box is about 698px on A4 and
720px on Letter — either side of the fold. Printing one file on two paper sizes
gave two different layouts. Every responsive block says `screen and`.

**A good floor hides its own ceiling falling in.** Everything here works with
JavaScript off — nav is baked, `:target` frames the rule, provenance is decorated
in CSS — which is why nobody noticed that the client layer had been throwing on
every load without a fragment, taking search, the permalink copy, the rail
scroll-spy and the key bar with it. Arriving on a deep link was the only path
that worked, and it is the path this design calls dominant, so it was the only
path anyone walked. The floor is worth having and it is not evidence of
anything above it.

---

## Deferred, with reasons

- **A `/r/<ID>/` alias tree.** A real feature from a real promise, deferred
  because the canonical URL resolves today and an alias is a second address to
  keep correct.
- **Release-view filters.** A handful of rows do not need filtering. They start
  earning their keep in the hundreds.
- **A provenance lens** that dims non-matching claims. With the minority state
  permanently decorated, its job is mostly done.
- **A build-over-build diff** of what moved since the last publish. The natural
  second release, deferred because it puts a network dependency in the build and
  has a cold-start case. The artifact keeps the door open at no cost: stable IDs,
  a schema version, and caveat kinds as an enum rather than free text.

- **Search across every site in a workspace**, served from an index rather than
  baked into a page. This is the one thing a baked index structurally cannot do,
  and it is a different feature from the search on this page rather than a
  better implementation of it — so it belongs at the platform layer, consuming
  `rules.json` at publish time, not in the generator.

  Worth stating plainly because the reflex-reject table cuts hosted search on
  the grounds of "no server", and that is now half true: a machine credential
  and a publish step exist. The rest of the reason still holds at this size. A
  corpus of ~50 pages bakes to a couple of hundred kilobytes, which is three
  orders of magnitude below where indexing earns its keep, and a hosted index
  would put a round trip and a gated-site auth story in front of a reader who
  gets the answer today with the page. It would also be a second copy of the
  corpus that can disagree with the built artifact, which is the drift this
  whole design exists to prevent.

## Cut outright, not deferred

Run-collapsing of consecutive same-status rules; the status disclosure widget;
the hover popover; hashed claim IDs; the modal mobile sheet; the sticky rule bar;
adjacent-rule pagers; left-truncated paths; a link-graph visualisation, which is
a hero-metric tile in a d3 costume.
