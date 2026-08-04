# Known defects

Produced 2026-08-02 by a browser pass at 390px plus a seven-dimension adversarial
audit (38 candidate findings, each independently attacked by a second agent
before it was allowed to stand; 3 refuted, 35 confirmed). Twenty-one of the 35
are fixed on `mobile-verification-pass`. Fourteen remain and are recorded below
with enough detail to act on without re-deriving them.

Every entry was reproduced against real source, most against a real build, and
several in a real browser. Anything that could not be reproduced was dropped.

---

## Already fixed (do not redo)

On branch `mobile-verification-pass`. Tests went 22 -> 50; every new test was
verified to fail against the defect it covers and pass against the fix.

**From the 390px browser pass**

- `viewer.js` threw on every page load with no `#fragment` (`'' ` is not nullish,
  so `?.` did not short-circuit and `''.classList.contains` threw), killing
  search, the permalink copy, the rail scroll-spy and the key bar. Arriving on a
  deep link was the only path that worked, which is why nobody saw it.
- The mark column folded to three rows (`trust -> ID -> statement`) with the
  verdict ahead of the statement. `.rule-id` is now a sibling of the heading, so
  it and the verdict share row one and the heading names the statement alone.
- No in-flow replacement existed for the ID rail below 1180px. There is one now.
- Two-column tables did not restack; wider ones still scroll, deliberately.
- Gutters were 46px left / 18px right; tap targets were 19.5px; `.cover-tag`
  floated its glyph between wrapped lines.

**From the audit**

- The empty key bar painted on every page with no legend (`display: flex` beat
  the UA `[hidden]`) and swallowed taps across the full viewport width.
- A `rules/<area>/index.md` in the Rules group got no `aria-current`, so at
  <=860px it rendered a sidebar with **zero** links. The area label now links to
  its index, and the ledger counts that index's rules.
- `.side` kept its column-boundary hairline below 860px; ledger sub-items sat
  1px to the *left* of their parent.
- The `:has()` collapse hid groups in plain CSS and unhid them with `:has()`, so
  an engine without it emptied the nav everywhere. Now behind `@supports`.
- The responsive blocks carried no media type, so paper size picked the layout
  (A4 ~698px vs Letter ~720px straddle the fold). All say `screen and` now.
- Body links written without a `./` or `../` prefix were never resolved and
  shipped as live `.md` hrefs — `index.html` had two 404s in it.
- A rule with no `**Status:**` line crashed the build at `esc(null)`, three lines
  after the code said it should warn and continue.
- A frontmatter key with an empty value became `[]` and crashed the renderer.
- `htmlName()` collisions and duplicate rule IDs silently discarded a page and a
  rule; both are reported now, and `--strict` makes them fail the build.

**From the cheap-correctness batch**

- A page left in dark theme printed its light ink onto white paper — `--ink` at
  1.11:1, so every statement and every sentence of prose came out blank inside
  near-black hairline frames. The dark half of `tokens.css` is scoped to
  `@media screen`, so paged media falls back to the light ladder and the two
  can never drift; layer 2 follows for free, being aliases all the way down.
- `decodeURIComponent` on the raw fragment threw `URIError` on `#50%-off` and
  took out the rest of the IIFE — the same failure as the empty hash, reached by
  a different trigger. Both read sites go through a `hashId()` that falls back
  to the raw bytes.
- The permalink click ran an unconditional smooth scroll the length of the page.
  `behavior: 'smooth'` in the options object overrides computed
  `scroll-behavior`, so no CSS the reduce block writes can reach it; it is gated
  in script now.
- The copy toast faded with opacity and was never removed, going on catching
  clicks at bottom-centre for the life of the page. `pointer-events: none`.
- The key bar's unverified chip keyed off a span that only existed when
  `verified:` was written literally, so a page that omitted the key looked
  unverified in the strip and verified in the bar. The tone follows the value.
- `pre.code` and `.table-wrap` are scroll containers, and paper cannot scroll:
  long citations and wide tables were cut off with no sign they continued. They
  wrap in print instead — truncating a citation is the one thing this design
  refuses to do.
- Evidence glyphs announced their own name immediately before the same word
  appeared as text ("seen, image. seen."). Beside a written label the glyph is
  decoration; inline in prose, where nothing else names it, it still announces.

The `rules.json` contract is byte-identical to HEAD: stable IDs and anchors,
`schema: 1`, caveat kinds still an enum. The door the deferred build-over-build
diff needs is still open at no cost.

---

## 1. Search — one rebuild, not ten patches

**Done.** Search is a route. Everything below is kept as the record of what was
wrong and why one rebuild was the answer rather than ten patches; nothing in it
is outstanding. What closed, and how:

- **Seven closed by construction.** No overlay exists, so there is no focus
  trap, no `inert` to forget, no `close()` to restore focus from, and no sheet
  left covering a same-page result. No combobox exists, so `aria-expanded` and
  `aria-activedescendant` cannot go stale; the result count is a live region and
  is the only thing that speaks. No fetch exists, so there is no pre-fetch race
  and no swallowed `.catch`. Nothing is built from a string at read time, so the
  escaping hole is gone — the generator escapes the index with the same `esc()`
  as every other surface, and the query is written back with `textContent`.

- **Two closed by removing the feature, which is not the same as fixing it.**
  The result list's `⌥↵` copy-link binding wrote a bare `text/plain` URL and
  then flashed *Link copied*, and it read `navigator.clipboard` without the
  guard the permalink path has. Both are gone because the binding is gone. A
  reader who wants a rule's link now follows the result to the rule and uses the
  ID, which is the control `DESIGN.md` names for it and the one that honours the
  dual-MIME ruling. That is a deliberate loss of one keystroke, not an
  oversight.

- **One thing improved that this was not aimed at.** The `<=860px` collapse
  below is unchanged, but its dead end is not: every page's header now carries a
  plain `<a href="search.html">`, the route shows every nav group, and the index
  covers pages as well as rules. Searching `inventory` on a phone returns the
  inventory area index instead of *Nothing matches* — the exact failure recorded
  under *the gap group is hidden on every mobile page except its own*.

The original write-up follows.

---

Ten of the fourteen are symptoms of a single thing: search shipped as the
JS-only modal that `DESIGN.md` **cut outright**, and was never built to the spec
that is already written down there:

> **Mobile is a route, not a modal.** Search is a real URL, so the back button
> works and a query is pasteable. There is no dialog, therefore no focus trap to
> get wrong and no JavaScript floor to fall through.

Patching these individually means ten changes to code that the design says should
not exist in this shape. Rebuilding search as a route resolves most of them by
construction — the URL, the back button, the focus trap, the close-on-select and
the stale ARIA all stop being problems when there is no dialog. The escaping bug
must be fixed regardless of shape.

#### Search ships as the JS-only modal sheet that DESIGN.md cut outright, not as a route

`src/theme/viewer.js:138` · **high**

DESIGN.md rules: "**Mobile is a route, not a modal.** Search is a real URL, so
the back button works and a query is pasteable. There is no dialog, therefore
no focus trap to get wrong and no JavaScript floor to fall through." The "Cut
outright, not deferred" list names "the modal mobile sheet" explicitly. What
ships is exactly that: viewer.js:138-148 creates a div literally classed
`.sheet`, viewer.css:548-554 styles it `position:fixed; inset:0; z-index:40`
with a blurred scrim, and it opens by setting `sheet.dataset.open`
(viewer.js:223). No URL is written, no history entry is pushed, and grep over
build.mjs finds no search page or route -- the only search affordance emitted
is the `.search-open` button (build.mjs:757). Because it IS a dialog, the
three things the ruling says cannot go wrong all do: there is no
`role="dialog"`, no `aria-modal`, no `inert` on the background, and the
keydown handler (viewer.js:234-259) never handles Tab -- so focus walks out of
the overlay onto the page it is covering. `close()` (viewer.js:228) calls
`input.blur()` and never restores focus to the trigger. The JS floor is gone
too, and it is worst where the ruling is aimed: viewer.css:600-601 sets `.side
.nav-g { display: none }` with only `:has(a[aria-current='page'])` restored,
so below 860px the JS-only sheet is the ONLY route to any other part of the
site.

*Fails when:* On a phone, open search, type "refund", press the browser Back button ->
instead of closing the sheet, the browser leaves the page entirely (no history
entry was pushed). The query "refund" appears in no URL, so it cannot be
pasted to a colleague. Press Tab from the search input -> focus moves to the
"Skip to content" link on the page behind the scrim, which is visually
covered. With JS disabled, there is no search at all and, below 860px, no nav
group except the current page's.

*Verifier’s correction:* Search ships as the JS-only modal overlay that DESIGN.md cut outright,
contradicting three of that ruling's four promises.

#### Search sheet is not a modal and has no focus containment: Tab walks the result links then leaves the open overlay into the page behind it

`src/theme/viewer.js:136` · **high**

The sheet built at viewer.js:136-148 is a bare `<div class="sheet">` appended
to `<body>`: no `role="dialog"`, no `aria-modal="true"`, no `aria-label`.
`open()` (viewer.js:222) only sets `data-open` and focuses the input; nothing
sets `inert`/`aria-hidden` on `.top`, `.frame` or `.keybar`, and no keydown
handler cycles Tab within `.sheet-in` (the keydown listener at viewer.js:234
handles Escape/Arrow/Enter only). Compounding it, each result is `<li
role="option" id="oN">` wrapping a real `<a href>` (viewer.js:213-217). The
ARIA combobox pattern forbids focusable descendants inside `role="option"`
precisely because the option is supposed to be reachable only via `aria-
activedescendant`; here every option is also a tab stop, so the listbox itself
becomes 12 stops the arrow-key model knows nothing about (moving DOM focus to
a link does not update `sel` or `aria-activedescendant`, so the two selection
models immediately disagree).

*Fails when:* Press `/` to open search, type "ord" (4 hits in the fixture), then press Tab:
DOM focus leaves the combobox and lands on the first result's `<a>` — while
`aria-activedescendant` still says "o0" — then walks all remaining result
links, then exits the overlay entirely onto "Skip to content" and the header
Search/theme buttons and every sidebar nav link, all of which sit behind a
still-open, dimmed, blurred sheet the user cannot see through. A screen reader
user in browse mode can likewise arrow through the whole document underneath,
because the background is never inert and the sheet is not announced as a
dialog at all.

*Verifier’s correction:* Real defect, accurate in substance; two details are slightly overstated and
one related bug is missed.

#### aria-expanded stays "true" and aria-activedescendant points at a deleted option when a query stops matching

`src/theme/viewer.js:209` · **high**

`render()` sets `aria-expanded="true"` and `aria-activedescendant="o0"` on the
hits path (viewer.js:212, 219). The no-hits path at viewer.js:208-211 replaces
`list.innerHTML` with a single `<li class="sheet-empty">` and `return`s
without touching either attribute. The empty-query path (viewer.js:202-206)
sets `aria-expanded="false"` but likewise never removes `aria-
activedescendant`, so the dangling reference also survives close-and-reopen
(`open()` → `render('')`). Separately, both empty states are `<li>` with no
role inside `<ul role="listbox">` — an invalid listbox child that is not an
option, is not a live region, and never receives focus, so it is the one piece
of feedback in the whole search UI that assistive tech can never reach.

*Fails when:* Open search, type "ord" → combobox reports expanded with active option "o0".
Type one more character, "ordz" → the listbox now contains zero
`role="option"` elements, yet the input still advertises `aria-
expanded="true"` and `aria-activedescendant="o0"`, an id that no longer exists
in the DOM. NVDA/JAWS/VoiceOver either announce nothing or keep repeating the
stale "ORD-001" option, and the actual answer — "Nothing matches ordz" — is
never announced. The same applies to the opening hint "Try a rule ID
(ORD-001), a behaviour (…), a path (…)": a screen reader user who presses `/`
hears the combobox and then silence.

*Verifier’s correction:* Real defect, with two overstatements corrected.

#### Search results interpolate the query and corpus text into innerHTML unescaped

`src/theme/viewer.js:201` · **medium**

Line 201 puts the raw query into `list.innerHTML` (`Nothing matches
<strong>${q}</strong>`), and lines 205-210 put `r.id`, `r.caveats[].text`,
`r.tier` and `r.statement` in unescaped (the statement only has `[*_\`]`
stripped — no HTML escaping). rules.json carries the raw markdown statement
straight from the H3 (build.mjs:842), and every other surface in the generator
is careful here: build.mjs escapes the same strings with `esc()` in renderRule
and renderRail. viewer.js is the one place that does not.

*Fails when:* Type `<img src=x onerror=alert(1)>` into the search box: search() finds no
hits, the string is written into innerHTML by line 201, the image fails to
load and the handler executes — script runs from a keystroke. Corpus variant:
a rule stated as "A `<script>` tag in a note is escaped on render" — after the
backtick strip, line 210 emits a real `<script>` open tag, which swallows the
remaining `</span></a></li>` and every following result row as script text, so
the whole result list collapses into one mangled row.

*Verifier’s correction:* Not an XSS hole; a markup-integrity bug in the search results, plus latent
self-XSS with no attacker-controlled entry point.

#### A query typed before rules.json resolves reports "Nothing matches" permanently

`src/theme/viewer.js:147` · **medium**

`rules` starts as `[]` and the fetch `.then` (147-161) assigns `rules` and
`examples` but never calls `render(input.value)`, so a search performed before
the response lands is answered against an empty corpus and is never corrected.
Nothing re-runs until the user types another character. The `.catch(() => {})`
on line 161 makes a hard failure (rules.json 404, or opening dist/index.html
over file://, where fetch is blocked) indistinguishable from a genuinely empty
result — every query answers 'Nothing matches' forever with no error shown,
and the empty-state hint silently falls back to the generic text.

*Fails when:* On a cold load (or throttled network), hit `/` and type `ORD-001` within the
first few hundred ms: the sheet says 'Nothing matches ORD-001' and keeps
saying it after rules.json arrives, even though the rule exists. Same result
permanently if the site is opened from the filesystem, where
fetch('rules.json') rejects.

*Verifier’s correction:* In /Users/kevinmistry/Dev/arcdoq-docsite/src/theme/viewer.js the rules.json
fetch block (155-169, not 147) never re-renders after the corpus arrives: the
only render() call sites are open() (225) and the input listener (231). Two
real consequences. (a) A query typed before the fetch resolves is answered
against an empty `rules` array and shows "Nothing matches <q>" until the user
types another character — stale, not permanent, and only reachable on a
slow/throttled load or a large rules.json since the script is last in <body>
and the fetch starts before the user can press `/` and type. The empty-state
hint is likewise stuck on its generic fallback (204) for a sheet opened before
the data lands, even though `examples` gets populated. (b) `.catch(() => {})`
(169) swallows a genuine failure (404, or fetch blocked over file://), leaving
search silently and permanently empty with no error surfaced — which is
exactly the ambiguity DESIGN.md:239 says the design must not create. file://
is not a documented deployment target, so that is a robustness gap rather than
a broken supported path. Fix is two lines: call render(input.value) at the end
of the .then, and set an error flag in the catch that render() reports instead
of "Nothing matches".

#### Choosing a search result on the current page leaves the search sheet open over it

`src/theme/viewer.js:251` · **medium**

Neither the Enter path (`location.href = a.href`, line 251) nor a plain click
on a result anchor calls `close()`. When the result's `pageFile(r.page)`
equals the page already loaded, the assignment is a same-document fragment
navigation: no unload, no reload, the sheet keeps its `data-open` attribute
and stays on screen with its backdrop blur. The keydown handler also keeps
intercepting arrows/Escape because `'open' in sheet.dataset` is still true.
Cross-page results happen to work only because the full navigation destroys
the DOM, so the bug is invisible in exactly half the cases.

*Fails when:* On dist/rules-orders-lifecycle.html press `/`, type `ORD-003`, press Enter:
the URL becomes #ord-003 and the rule is framed, but the sheet is still
covering the page — the reader sees only the search UI and has to guess to
press Escape. The same click from README.html works, because that is a
different document.

*Verifier’s correction:* Real defect, mildly overstated. Accurate version: neither the plain-Enter path
(viewer.js:259, `location.href = a.href`) nor a plain click on a result anchor
calls close(), so whenever the chosen result lives on the page already loaded,
the navigation is same-document (fragment-only) and the sheet keeps its data-
open attribute — it stays on screen and the keydown handler keeps intercepting
arrows and Escape because `'open' in sheet.dataset` is still true. Cross-page
results only appear to work because the full navigation discards the DOM. Two
corrections to the report: (1) the sheet is a translucent scrim, `color-mix(in
oklch, var(--canvas) 55%, transparent)` with `blur(3px)` (viewer.css:597-598),
so the newly framed rule is dimmed and blurred behind the sheet rather than
hidden outright, and the sheet foot still shows the `esc close` hint — the
reader is stuck but not without a visible exit; (2) "exactly half the cases"
is rhetorical — the ratio depends on corpus shape, though same-page hits are
the common case on a multi-rule page. The Alt-Enter (copy link) and Cmd/Ctrl-
Enter (new tab) branches leaving the sheet open are intentional and not part
of the defect. Fix is to call close() on the plain-Enter branch and add a
delegated click handler on `.results a` that closes before navigating.

#### Search's copy-link binding writes a bare URL as text/plain only, then reports "Link copied"

`src/theme/viewer.js:254` · **medium**

DESIGN.md rules: "**The clipboard carries both flavours.** A gated site never
unfurls, so a bare URL pastes as an opaque string. Only a dual-MIME write
produces linked text that reads as the rule ID in the surfaces this audience
uses." The rule-ID permalink control honours this (viewer.js:67-71 writes a
`ClipboardItem` with both `text/html` and `text/plain`). The search sheet's
copy path does not: `navigator.clipboard.writeText(url)` writes a single bare
URL as plain text -- precisely the opaque string the ruling exists to prevent
-- and then flashes "Link copied", the exact message the dual-MIME path uses
at viewer.js:72, so the reader has no way to know the two controls behave
differently. The sheet footer (viewer.js:146) labels this binding "copy link"
with no qualification. Contrast the rule-ID control's deliberate escape hatch
at viewer.js:66, which writes a bare URL but honestly flashes "URL copied".

*Fails when:* Open search, type ORD-003, press Alt+Enter. Toast reads "Link copied". The
clipboard holds only text/plain `https://docs.example.com/rules-orders-
lifecycle.html#ord-003`. Pasted into Linear on a gated site it stays an opaque
URL string, where clicking the ORD-003 heading on the page itself would have
pasted linked text reading "ORD-003".

*Verifier’s correction:* Real, but the framing of "the two controls behave differently with no way to
know" is partly wrong. The Alt modifier is actually consistent across both
controls: Alt+click on a rule ID (viewer.js:66) also writes a bare text/plain
URL, so Alt already means "bare URL, escape hatch" in this codebase, and
Alt+Enter in search producing the same payload is not itself the surprise.

#### close() blurs to <body> instead of restoring focus, stranding the keyboard user on an off-screen skip link

`src/theme/viewer.js:228` · **medium**

`const close = () => { delete sheet.dataset.open; input.blur() }`
(viewer.js:228). Blurring moves focus to `<body>`, so the sequential focus
navigation starting point resets to the top of the document; nothing records
or restores the element that was focused when `open()` ran (`.search-open`, or
whatever had focus when `/` was pressed). This is the standard dialog focus-
restore requirement, and the consequence is made invisible rather than merely
annoying by `.skip` being `position: absolute; left:12px; top:-60px` with
`.skip:focus { top: 12px }` (viewer.css:40-46): with no positioned ancestor
its containing block is the initial containing block, so "top: 12px" means
12px from the top of the *document*, not the viewport.

*Fails when:* Scroll down to ORD-004 on rules-orders-lifecycle.html, press `/` to search,
then press Escape. Focus is now on `<body>`, so the next Tab focuses `.skip`,
which renders 12px from the document top — hundreds of pixels above the
current scroll position. The user sees no focus ring anywhere on screen (WCAG
2.4.7 / 2.4.11) and must then Tab through the header buttons and the entire
sidebar nav ledger to get back to the rule they were reading.

*Verifier’s correction:* The search sheet does not restore focus on close. `close()`
(src/theme/viewer.js:228) removes the data-open attribute, which drops the
sheet to display:none and sends focus to <body>; nothing captured the element
that was focused when open() ran. This violates the WAI-ARIA dialog focus-
restore requirement. Real consequence: a keyboard user who had a focused
element (a .side nav link, a .rule-id, or the .search-open button) when they
pressed / or Cmd+K finds that the next Tab starts from the top of the document
and lands on .skip, which — being position:absolute against the initial
containing block (viewer.css:40-46) — causes the page to scroll back to the
document top, losing the reading position. The focus indicator itself remains
visible (browsers scroll the focused element into view, and .skip's z-index 20
clears the sticky header), so this is a lost-context annoyance rather than a
WCAG 2.4.7/2.4.11 failure. The scenario in the original claim does not
reproduce: scrolling by wheel leaves focus on <body> before search is opened,
so close() restores the exact prior state. Fix: capture document.activeElement
in open() and call restore?.focus() in close(). Note a related and arguably
more serious gap not covered by the claim: the sheet has no role="dialog", no
aria-modal, and no focus trap, so Tab from the search input escapes into the
background page while the overlay is still open — and DESIGN.md:261's "there
is no dialog, therefore no focus trap to get wrong" describes a mobile search
route that viewer.js does not implement.

#### Alt+Enter in search calls navigator.clipboard without the guard the permalink path has

`src/theme/viewer.js:246` · **low**

Line 246 does `navigator.clipboard.writeText(url).then(...).catch(...)`. The
`.catch` only handles a rejected promise; if `navigator.clipboard` is
undefined the property read throws synchronously and is uncaught. The
permalink handler at 60-70 wraps the identical call in try/catch, so the two
copy paths disagree about the same hostile environment. `e.preventDefault()`
has already run by then, so the keystroke is consumed and nothing at all
happens.

*Fails when:* Serve the built site over plain http:// (an insecure context, plausible for a
gated internal host) — navigator.clipboard is undefined in Chrome. Open
search, arrow to a result, press Alt+Enter: 'TypeError: Cannot read properties
of undefined (reading writeText)' in the console, no copy, no flash, no
fallback.

*Verifier’s correction:* src/theme/viewer.js:254 (not 246) reads navigator.clipboard.writeText inside a
non-async keydown listener with no try/catch, so in an insecure context the
property read throws a synchronous TypeError that the trailing .catch cannot
handle — an uncaught console error where the permalink path at 65-75 fails
silently instead. The inconsistency is a genuine defect worth a one-line fix
(optional chaining or the permalink's try/catch). The consequences are
narrower than claimed: the permalink path also produces no copy and no flash
in the same environment, so only the console error differs; preventDefault is
not load-bearing because the search input has no form and Enter has no default
action; the throw does not disable the handler or affect plain Enter and
Cmd+Enter navigation; and the only trigger is navigator.clipboard being
undefined in an insecure context, which is off the project's documented arcdoq
https publish path — a permission denial, the ordinary failure mode, rejects
the promise and is caught correctly.

#### Combobox ARIA state goes stale on the no-results and empty-query branches

`src/theme/viewer.js:201` · **low**

render() sets `aria-expanded="true"` and `aria-activedescendant="o0"` on the
hit path (204, 211), but the no-results branch (200-203) returns without
clearing either, and the empty-query branch clears aria-expanded but never
removes aria-activedescendant. The input therefore keeps pointing at an option
id that no longer exists in the listbox, while still claiming the popup is
expanded.

*Fails when:* Type `ord` (results render, aria-activedescendant=o0, aria-expanded=true),
then keep typing to `ordzz`: the list shows 'Nothing matches ordzz' but the
input still advertises aria-expanded="true" and aria-activedescendant="o0"
pointing at a removed element, so a screen reader announces a stale/absent
option instead of the no-results message.

*Verifier’s correction:* Real but narrower than stated. In src/theme/viewer.js, render()'s no-hits
branch (208-211) returns without resetting either attribute, so after a query
that matched (which sets aria-expanded="true" at 212 and aria-
activedescendant="o0" at 219), typing on to a non-matching query leaves the
combobox claiming aria-expanded="true" with a listbox that contains no
role="option" children, plus an aria-activedescendant referencing the now-
removed `#o0`. The empty-query branch (197-207) clears aria-expanded but
likewise never removes aria-activedescendant, and `open()` (222-227) re-enters
that branch on every reopen, so the stale reference persists for the life of
the page. The concrete harm is the false expanded state and an ARIA-invalid
activedescendant, not a spoken "stale option" — screen readers typically
ignore an activedescendant whose target does not exist, and with aria-
expanded="false" on the empty branch it is doubly inert. Separately, the
"Nothing matches" text would not be announced anyway: it is a plain `<li>` in
a listbox with no live region. Fix: call input.removeAttribute('aria-
activedescendant') on both non-hit branches and input.setAttribute('aria-
expanded', 'false') on the no-hits branch (or hoist both resets to the top of
render() before the branch dispatch).
---

## 2. Decisions, not defects

Each of these has a real trade-off and should be decided rather than patched.
Recommendations are mine; the call is not.

#### Before the build-over-build diff: the artifact has no build identity

`src/build.mjs:879` · **decide before building the diff, not after**

The three things `DESIGN.md` says keep the door open — stable IDs, a schema
version, caveat kinds as an enum — are all intact, and `rules.json` is
byte-identical to v0.1.0 across both commits on this branch. Verified, not
assumed. But two artifacts of the same corpus cannot currently be **ordered**,
which is the one thing a "what moved since the last publish" diff needs first.

`generatedAt` is deliberately *not* a build timestamp. `readGeneratedDate` reads
the date the corpus states its statuses were computed at, and `DESIGN.md` is
explicit about why: deriving it from the clock "would put a fresh date on a
stale answer". So two builds a week apart carry the **same** `generatedAt`, and
a corpus that declares no `statusSidecar` carries `null` — measured:

```
with the declared statusSidecar   generatedAt: "2031-03-04"
with no config at all             generatedAt: null
```

The diff therefore needs its own field, distinct from `generatedAt` and not
derived from the clock either — a content hash over the rule set would order
builds without claiming freshness. Deciding it now is free; adding it once
v0.1.0 artifacts exist in the wild is a schema bump.

#### Before the build-over-build diff: caveat kinds are an enum per corpus, not globally

`src/build.mjs:323-325` · **decide before building the diff, not after**

Only `unpinned` is ours. Every other kind is `b.id`, which comes from the
customer's own `statusSidecar.groups[].id` in `docs.config.json` — `changed` and
`newly-tested` in the fixture are the fixture's names, not the package's. The
enum is therefore customer-declared and mutable.

If the diff keys on `kind` to say "this rule gained the *nothing tests this*
caveat", then renaming a group id in `docs.config.json` makes every affected
rule appear to have simultaneously lost one caveat and gained another, with no
behaviour having changed at all — which is precisely the false-movement report
this feature exists to avoid. Either the ids have to be documented as
rename-hostile, or the diff has to compare on something stabler.

#### At <=860px no group other than the reader's current one is reachable, and the home page's nav is a single self-link

`src/theme/viewer.css:600` · **medium — was high; see the 2026-08-04 correction
below, which overturns the load-bearing half of what follows**

`.side .nav-g { display: none }` + the `:has()` override leave exactly one
group visible, and nothing else in the shell replaces it. The only other in-
chrome affordances are the wordmark (`href="index.html"`, build.mjs:719) and
search. Search cannot substitute: viewer.js:152-153 does
`fetch('rules.json').then(d => rules = d.rules)` and every code path in
`search()` filters `rules`, so guides, flows, status, README and area index
pages are not in the index at all (rules.json in the built fixture has keys
schema/generatedAt/name/rules, and every entry's `page` is a rules topic
file). So the wordmark is the only cross-group route, and it lands on
`config.publish[0]` (build.mjs:891) — the first page of the first declared
group. That group is conventionally 'Start here' with one page, which is the
page you just landed on.

*Fails when:* Open dist/guides-refund-an-order.html at 390px. Visible nav = the Guides group
only (one link, the current page). Tap the wordmark -> index.html, which is
README.html; its nav at 390px is the 'Start here' group only, containing one
link that points at the page you are already on. There is no path from a guide
to the Rules ledger, and typing 'refund' into search returns only rule rows,
never the guide.

*Verifier’s correction:* At <=860px `.side .nav-g { display: none }` plus the `:has(a[aria-
current='page'])` override (src/theme/viewer.css:653-654) leaves exactly one
nav group visible, and nothing in the shell or viewer.js provides a
disclosure, toggle, or alternate browse surface to reach the rest. The
severity depends on the group: on a rules page the surviving group is the
whole Rules ledger, so intra-Rules movement still works — the collapse only
strands you on single-page groups, which is what "Start here", "Guides" and
"Status" conventionally are.

*Superseded in part, 2026-08-04 — checked against a real corpus rather than the
fixture:* `nimbarc/arcdoq-docs` now has a one-page **Guides** group, which is
precisely the shape above. At 390px its guide page shows one nav group holding
one link, and that link points at the page the reader is already on. Reproduced
through a same-origin iframe, since Chrome on macOS will not resize below ~606px.
So the collapse is exactly as described.

**But "search cannot substitute" no longer holds, and it was the load-bearing
half.** The search rebuild removed the `fetch` and bakes the whole corpus into
`search.html` as live links — the arcdoq build indexes 93 rows, including that
guide and the Deploy ledger — and `viewer.js` now makes no network call at all.
The search control is in the shell at 390px, so a phone reader is one tap from a
browsable index of the entire site rather than stranded, and it survives
JavaScript being off because the list is baked rather than fetched.

What is left is real but smaller: at <=860px you can **search** the site and
still cannot **browse** it, so a reader who does not know what to search for has
only the wordmark. Worth fixing — a disclosure that reveals the other groups is
the obvious shape — but it is not the dead end this entry described, and it
should not be queued as one.

**FIXED, this commit — and the obvious shape was not the answer.** Measured
across all 22 pages of `nimbarc/arcdoq-docs` first, because the entry describes
one symptom of three. The collapse selects by adjacency, `which group am I in`,
and that produced: 3 pages whose whole sidebar is a link to themselves, 14 stub
pages carrying the fullest ledger on the site, and 5 rules pages where it works.
The emptiest pages got the most navigation and the hand-written guide got none.

Two changes, both in `DESIGN.md` now. A group is unhidden only when it can move
the reader — a second `:has()` on the existing rule — so a group holding nothing
but the current page is not rendered at all rather than restating the H1 above
it. And one ledger line at the foot of the nav, `All pages · 22`, linking to the
route. Measured at 390px on the guide page: 128px of nav with 0 ways out becomes
87px with 1, and the title moves up 41px. A rules page pays 49px for it.

The disclosure was built and rendered before it was rejected, which is the only
reason this is stated with any confidence: at rest it does not remove the
self-link it was reached for, so it *added* 40px of chrome and pushed the title
further down than doing nothing. Opened, it buries the guide's title at 951px.
Moving the nav below the content was rendered too and rejected in `DESIGN.md`
for a reason worth keeping: it wins the numbers and charges the only reader who
wants a ledger.

#### --mark-w is the only rem length in an all-px stylesheet, so a raised browser font size steals the reading column instead of enlarging text

`src/theme/viewer.css:638` · **medium**

`--mark-w` (11.5rem at line 113, 10rem at line 638) is the sole rem length in
viewer.css — every font-size in the file, including `body` 15px, `.rule-
statement` 17.5px and `.rule-trust` 11.5px, is a hard px value. A reader who
raises Chrome's default font size (Settings > Appearance > Font size: Large =
20px, Very large = 24px) changes the root em and therefore changes exactly one
thing on the page: the width of the margin channel. `.rule` is `grid-template-
columns: var(--mark-w) minmax(0, 1fr)` (line 255), so every pixel the mark
column gains comes straight out of the prose column, and no glyph on the page
gets any bigger. The damage is worst in the 861-1180 band because `main` is at
its narrowest there (518px at 861, 557px at 900) — the 250px/232px sidebar and
the 44px gap are fixed px and do not yield. Verified by injecting `html {
font-size: Npx }` (which is precisely what the browser default-font-size
setting sets) and reading getComputedStyle on `.rule`. The measured widths of
the ID/verdict channel vs. the prose column across the band: root 16px ->
160/328 at 861, 160/367 at 900, 160/647 at 1180; root 20px -> 200/288,
200/327, 200/607; root 24px -> 240/248, 240/287, 240/567. Fix is one unit:
160px / 184px, or clamp() against the viewport.

*Fails when:* Chrome default font size set to "Very large" (root font-size 24px), viewport
861px, any rules page: getComputedStyle('.rule').gridTemplateColumns returns
"240px 248px" — the margin channel carrying a 6-character ID and a 3-line
verdict is wider than the column carrying the rule statement and all its
prose. At 900px it is "240px 287px", and the statement "A site cannot be
published while a previous deploy for the same site is still running" goes
from 47.6px tall (2 lines) to 71.4px (3 lines) while its font-size stays
17.5px. The reader who asked for larger text gets 80px less prose column and
not one larger character.

*Verifier’s correction:* Real defect, with the severity figures slightly overstated. `--mark-w` is the
only rem length in an otherwise all-px stylesheet, so raising Chrome's default
font size (Settings > Appearance > Font size) widens the ID/verdict margin
channel and takes that width straight out of the `minmax(0, 1fr)` prose track,
while not enlarging a single character. The claimed "240px 248px" at 861px
assumes a 15px classic scrollbar (Windows/Linux); with macOS overlay
scrollbars `main` is 533px and the tracks compute to 240px/263px, so the
margin channel is roughly equal to - not wider than - the prose column there.
The loss is real at every width above the 720px breakpoint: at root 24px the
prose track loses about 80px in the 861-1180 band and about 92px on desktop
(11.5rem = 276px vs 184px). Browser zoom is unaffected, since zoom scales px
as well; only the default-font-size preference triggers it. Fix is to give the
token px values (184px / 160px) or clamp it, so the page is at least
consistently unresponsive to the setting rather than actively penalising it.

**FIXED, this commit.** 184px and 160px, the verifier's numbers. A test asserts
that no rem length exists in either stylesheet, because the defect was never
this token: it was one unit disagreeing with a whole file, and the next one
would read as normal.

#### The gap group DESIGN.md says is 'never hidden' is hidden on every mobile page except its own

`src/theme/viewer.css:600` · **medium**

DESIGN.md:213-216 and the CSS comment at viewer.css:641-644 both state the
undocumented-areas group 'is never hidden: a search that returns nothing
cannot tell a reader whether the behaviour is undocumented or whether they
searched for the wrong word.' The <=860px collapse hides it on every page that
is not itself a 'Not yet documented' page, and search cannot compensate
because rules.json indexes only rules — an undocumented area has no rules, so
it can never appear in a result. The exact failure the design was written to
prevent is the default state on a phone.

*Fails when:* Phone reader on rules-orders-lifecycle.html at 390px wants to know whether
inventory behaviour is documented. Search 'inventory': `search()` scans only
`rules[]`, all of which live on rules/orders/lifecycle.md, so 0 hits —
'Nothing matches inventory.' The 'Not yet documented' group that would have
answered the question is `display:none` because it holds no `a[aria-
current='page']`.

*Verifier’s correction:* The defect is real, and one detail is understated rather than overstated, but
the claim's line citations are wrong and its framing implies the gap group is
singled out when it is not.

**CLOSED, this commit — by correcting the sentence, not the CSS.** The verifier
is right that the gap group is not singled out: the collapse takes it like every
other group, and after the search rebuild it is indexed like every other page,
so the promise it carries — *a search returning nothing means undocumented, not
unfindable* — is honoured at every width, just not by the same thing at each.
`DESIGN.md` said "it is never hidden", flatly, and the flat version is what made
this a defect rather than a description. It now names which surface carries the
promise above and below the collapse point.

#### The linear-paging flag DESIGN.md says stays available does not exist

`src/build.mjs:44` · **low**

DESIGN.md rules: "**No prev/next, in either form.** A reference corpus has no
reading order... **Linear paging stays available behind a flag for corpora
that genuinely are books.**" The cut itself is honoured -- nothing renders a
pager -- but the escape hatch the ruling promises is not implemented. The
`defaults` object (build.mjs:44-77) declares no such key, `config` is never
consulted for one, and a grep for pager/prev/next/paging across src/ and bin/
returns only the unrelated `tokens[i + 1]` lookahead at build.mjs:393 and the
theme-toggle local in viewer.js. The ruling is stated in the present tense as
a shipped affordance, which is the one form of overclaim the document's own
third question forbids.

*Fails when:* A book-shaped corpus adds any paging flag to docs.config.json and rebuilds:
the key is dropped by the shallow merge, no pager markup is emitted on any
page, and no warning tells the author the flag is unrecognised.

*Verifier’s correction:* Documentation-only inaccuracy, no code defect. DESIGN.md:233-234 says "Linear
paging stays available behind a flag for corpora that genuinely are books,"
which reads as a shipped affordance, but no such flag is implemented:
`defaults` (src/build.mjs:44-77) declares no paging key, no `config.*` read in
build.mjs consults one, bin/cli.mjs exposes only --corpus/--out/--strict, and
nothing in src/theme/ emits pager markup. The fix is to correct the sentence —
either move the item to the "Deferred, with reasons" list (DESIGN.md:351-363)
and phrase it as a door left open, or implement the flag. The claimed runtime
failure does not occur: the shallow merge at build.mjs:83 preserves
unrecognised top-level keys (statusSidecar is an in-repo example of a merge-
surviving key absent from defaults), the build succeeds unchanged, and the
absence of a pager is the intended behaviour, not a regression. The missing-
unknown-key warning is a repo-wide property of an intentionally open config
schema, not a paging-specific gap.
---

## 3. From the first real consumer corpus (2026-08-03)

Found standing up `nimbarc/arcdoq-docs` — 71 rules over 21 pages, the first corpus
built by anyone other than this repo's own fixture. Both v0.4.2 fixes are
confirmed working against it and need no further attention: 9 citations
containing an em dash now parse whole, and no anchor warning fires on a page that
declares an `<a id>` for every rule. Recorded so neither gets re-litigated.

#### `action.yml` targets Node 20, which GitHub now force-runs on Node 24

`action.yml:30` (the `node-version` default), `action.yml:117` and
`action.yml:145` · **cosmetic today, a hard break whenever the runners drop it**

Every consumer build now ends with a yellow annotation:

```
Node.js 20 is deprecated. The following actions target Node.js 20 but are
being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4,
actions/upload-artifact@v4
```

Reproduced on a real run, not inferred: `nimbarc/arcdoq-docs`, run
`30848403115`, 2026-08-03. The build and the publish both succeed, so this costs
nothing yet — but the warning is on a green check, which is precisely where a
warning goes unread until it becomes an error.

Default `node-version` to `22`. The generator itself has no Node 20 dependency;
`src/build.mjs` and `src/publish.mjs` use only stable built-ins, and the consumer
corpus's own tooling already runs on 22 locally.

**FIXED in v0.4.3** — `action.yml` now defaults to `'22'`. A consumer who pins
`node-version` explicitly is unaffected; everyone else stops seeing the
annotation on the next tag bump.

#### The second credential a computing corpus needs has no name, and the obvious one collides

`README.md`, publishing section · **documentation, and it misdirected a real user
within an hour of first publish**

The package names exactly one secret, `ARCDOQ_DEPLOY_TOKEN`. But any corpus that
*computes* its statuses — which is the arrangement `skill/SKILL.md` describes as
the whole point — resolves citations against a **different repository**, so in CI
it needs a second credential: a GitHub token with read access to the source repo.
The package says nothing about this, so the consumer invents a name.

The obvious invention is `ARCDOQ_REPO_TOKEN`, and it is a trap. It differs from
the mandated name by one word, shares the `ARCDOQ_` prefix, and appears in build
output as `ARCDOQ_REPO_TOKEN is not set` — which a reader correctly parses as
"something about my arcdoq token is wrong". Observed: the corpus author read that
line, concluded the deploy token they had just minted was misconfigured, and went
looking for the fault in arcdoq rather than in a missing, optional, unrelated
GitHub PAT.

Two lines in the README would prevent it: name the second credential's existence,
and suggest a name that cannot be mistaken for an arcdoq one — `SOURCE_REPO_TOKEN`
or `DOCS_SOURCE_TOKEN`. It is a GitHub credential, and nothing about it should
read as arcdoq's.

**FIXED in v0.4.3** — the README's token section now states that
`ARCDOQ_DEPLOY_TOKEN` is the only credential the package uses, names the second
one's existence, and says why `ARCDOQ_REPO_TOKEN` is the wrong name for it. Note
what is NOT claimed: the package still reads no such token and takes no position
on whether a corpus should grant source access in CI. That is a posture decision
for the corpus — `arcdoq-docs` gates it behind a `secrets.* != ''` check, uses it
only for a `--check` revalidation, and deletes the checkout before building,
which is the shape to copy if you do grant it.

---

## 4. The guide and flow genres (2026-08-03)

Found while answering whether a corpus tells a reader how to *test* a rule — what
to do on a screen to make a behaviour happen. It does, in one genre, and the
package had no written idea that genre existed.

#### The walkthrough genre renders fully and was documented nowhere

`skill/SKILL.md`, `README.md` · **FIXED, this commit**

The generator has carried guides and flows since v0.1.0: the kind label from the
`guides/` / `flows/` path prefix (`src/build.mjs:869`), the `##`-as-content-
heading treatment (`:883`), the provenance strip reading `verified`,
`walked-by-agent` and `walked-in` (`:837`), the whole per-claim marker system in
`config.evidence`, and both genres in the search index (`:923`). It was designed
against real content — `src/theme/viewer.css:387` is tuned to an actual guide's
mark distribution.

None of it was documented. `skill/SKILL.md` said one line about guides ("Draft
new guides freely"), `README.md` never mentioned `guides/` or `flows/` as
directories at all, and the four frontmatter keys the renderer reads appeared in
no documentation. Nor did the skill's own `description:` — which is what decides
whether an agent loads it in the first place, so the feature was invisible from
exactly the surface a new corpus is pointed at.

That mattered because of where the discipline actually lived: `orbitalx-docs`, a
corpus that predates the package and is being deleted. Its `guides/README.md` and
`flows/README.md` carried the shape rules, the `verified:` versus
`walked-by-agent:` split, and the walk discipline. Deleting it would have left a
shipped feature with no specification anywhere but `build.mjs` and a fixture the
README explicitly describes as invented.

Now in `skill/SKILL.md` (the three genres and their differing drift clocks, flow
and guide shape, `verified:` versus `walked-by-agent:`, the four rules for
walking a screen) and `README.md` (the path-prefix contract, the four frontmatter
keys, and a `docs.config.json -> evidence` entry saying what the marker
vocabulary is *for*). No version bump: everything now documented shipped in
v0.1.0, so `requires: ">=0.4.0"` still holds.

#### `flows/` was rendered, and nothing in the fixture exercised it

`test/fixture/` · **FIXED, this commit**

Two code paths key on the `flows/` prefix — the page warrant's kind at
`src/build.mjs:869` and the search row's at `:932` — and `test/fixture/` had no
`flows/` directory at all. Guides were covered by `guides/refund-an-order.md`;
flows were covered by nothing, so all 124 tests passed without the build ever
producing a Flow page.

The `##`-as-content-heading treatment reads like a third path and is not one: the
comment at `:883` explains the intent, but the branch keys on whether a section
holds rules, not on the path prefix, and the guide already exercises it.

Closed with `test/fixture/flows/placing-an-order.md` and a `page kinds` block
asserting that the kind renders `Flow`, that a flow carries no provenance strip
because nobody walked it, that its `##` is a content heading with no rule-group
and no ID range, that search separates the genres rather than listing rules
alone, and that its rule references resolve rather than going inert. Tests
124 -> 129. Each of the two prefix branches was removed in turn and confirmed to
fail exactly the test covering it.

#### Rule -> guide back-link: BUILT, with the three questions answered

`src/build.mjs` · **BUILT, this commit — the reasoning is kept because the
placement is provisional**

A guide links down to the rules behind its steps — `→ [ORD-004](../rules/orders/
lifecycle.md#ord-004)` in the fixture. Nothing runs the other way, so a reader
holding a rule ID cannot discover that a walkthrough for it exists; they have to
already know the guide is there and read it hunting for their ID.

**The derivation is free and the plumbing is small.** `ruleIndex` is already
built in a pass before any page renders (`:1138`), so a second pass collecting
each page's `#anchor` targets that resolve into `rules/` gives an anchor ->
[pages] map in about thirty lines. Note that link resolution itself runs
per-page at the very end (`:1175`), after `renderPage` has produced HTML — which
is why this has to be a pre-pass rather than a hook into the existing rewrite.

Three things to settle first, and the second is why this is a ruling rather than
a patch:

1. **Where does it go in the rule atom?** DESIGN.md asks of every element whether
   it is the claim or the warrant. A back-link is neither — it is navigation. The
   atom is the most deliberately designed thing in the package, and giving it a
   fourth part is a decision on its own.
2. **It can render a rule more certain than it is, which is the standing veto.** A
   guide is `verified: never` until a human walks it, and inside a walked guide
   each individual claim is either seen or only read from source. A bare "Walked
   in: Refund an order" on the rule launders both distinctions away at the far
   end — precisely what the per-claim marker system exists to prevent. Doing it
   honestly means carrying the linking claim's own marker state through, and
   `provenance()` does not currently track which claim run a link sits in.
3. **Does it belong in `rules.json` too?** That is the surface an agent queries,
   and *which rules have a walkthrough* is a natural question to ask it. But the
   field set is schema 2, and there is already an open decision above about
   giving artifacts a build identity before the build-over-build diff. Add a
   field here and settle that one in the same change.

**How each was answered.**

1. **Placement — inside the existing warrant `<dl>`, last.** Not a fourth part of
   the atom. It is another row in the definition list that already carries Test
   and Source, so it introduces no new visual language, and it sits *after* them:
   the evidence that backs the claim precedes the pages that merely mention it. A
   test asserts that ordering, because getting it backwards would read as though
   a guide were warrant.
2. **The overclaim is closed by carrying the narrative's own state.** Each entry
   ships the linking page's `verified:`, rendered beside the link — a date, or
   *not human-verified* in the same amber the page-level strip uses for pending.
   The row therefore says *a narrative exists, and here is how far it has been
   checked*. It never says the rule was observed. Mutation-tested: forcing every
   entry to report as verified fails exactly the test that guards this.
3. **`rules.json` carries it as `appearsIn`, and `schema` stays 2.** The field is
   additive and always present — an empty array when nothing narrates the rule —
   so a reader that ignores unknown keys is unaffected and one that wants *which
   rules have a walkthrough* can filter rather than guess. This deliberately does
   **not** settle the build-identity question above; that one is about ordering
   two artifacts, which no additive field affects.

Rows are labelled by kind (`Guide`, `Flow`) rather than with a new noun, because
the reader already meets both words on the page warrant and a third word for the
same idea reads as a second idea. Only flows and guides count: a rules page
pointing at another rule is a cross-reference between two claims, not a narrative
containing one, and counting those would tell a reader a walkthrough exists when
nobody has written one. One narrative naming a rule at five steps is one
appearance. Both are tested, and both mutation-tested.

**A rules page now carries two verification surfaces, and only one is its own.**
Raised from the arcdoq side while this was being built, checked, and locked. The
`.page-provenance` strip describes *this* page, from *this* page's frontmatter.
A `.w-vfy` chip describes a narrative that merely links here, from *that* page's
frontmatter. `viewer.js:144` derives the sticky key bar's "Human-verified never"
from the first, and its selector is scoped — `.page-provenance [data-tone=…]` —
so the two cannot be confused today. Unscope it and a rules page nobody has
claimed anything about starts announcing it went unverified, on the strength of
a guide it happens to reference. There is now a client-layer test holding that
scope, mutation-verified against exactly that edit.

**Do not give `viewer.js` a fetch for this.** The live-overlay design that would
justify one is a roadmap entry on the arcdoq side and is not built; the file's
no-network property should not be spent ahead of it. Nothing in this change goes
near it — `viewer.js` is byte-identical.

**What is still provisional: the rendering at scale.** The fixture is 4 rules on
one page. DESIGN.md's third question — does it survive a 20 KB page of 35 rules —
is unanswerable until a real corpus has guides, and `arcdoq-docs` has none. If
every rule on a long page carries the same two rows, the warrant may need the
repetition collapsed. Look at it on the first real guide before deciding it is
finished.

---

## Notes for whoever picks this up

**Where the work is.** Branch `mobile-verification-pass`, not yet merged or
pushed. A patch of the first commit is at `../arcdoq-docsite-mobile.patch`.

**Reproducing 390px.** Chrome on macOS will not resize a window below ~606px
outer width, so `resize_window` cannot reach a phone viewport. Drive it through a
same-origin iframe instead — media queries resolve against the iframe's own
viewport, so it is a real 390px layout. Suppress the classic 15px scrollbar
(`html { scrollbar-width: none }`) or the layout viewport is 375, not 390;
phones use overlay scrollbars, so suppressing it is the faithful choice.

**One behaviour change worth knowing.** Hoisting `.rule-id` out of the `<h3>`
shrank its hit area from 184px (the full mark column, an `<a>` stretched by
subgrid) to 53.4px, the width of its own text. Visible position is unchanged.
This is a fix — 130px of invisible margin used to copy a permalink and fire a
toast when clicked — but it is a change, and it was not asked for.

**`DESIGN.md` no longer contradicts the shipped search — the code moved.** The
"Cut outright, not deferred" list still names *the modal mobile sheet*, and that
line is untouched, because it was never the thing that was wrong. `DESIGN.md`
and its own cut list agreed with each other the whole time; only `viewer.js`
disagreed with both. What did have to change there was smaller and elsewhere:
the ruling now states what the index covers and what the JavaScript-off floor
actually is, since leaving those unsaid is how a rules-only index shipped
without ever contradicting the page. And the keyboard count moved from six to
two — six was already wrong when it was written, because the sheet bound eight.
