# Known defects

Produced 2026-08-02 by a browser pass at 390px plus a seven-dimension adversarial
audit (38 candidate findings, each independently attacked by a second agent
before it was allowed to stand; 3 refuted, 35 confirmed). Fourteen of the 35 are
already fixed **in the working tree**, uncommitted. Twenty-one remain and are
recorded below with enough detail to act on without re-deriving them.

Every entry was reproduced against real source, most against a real build, and
several in a real browser. Anything that could not be reproduced was dropped.

---

## Fixed in this working tree (do not redo)

Uncommitted. Tests went 22 -> 43; every new test was verified to fail against the
defect it covers and pass against the fix.

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

The `rules.json` contract is byte-identical to HEAD: stable IDs and anchors,
`schema: 1`, caveat kinds still an enum. The door the deferred build-over-build
diff needs is still open at no cost.

---

## 1. Search — one rebuild, not ten patches

Ten of the twenty-one are symptoms of a single thing: search shipped as the
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

## 2. Cheap correctness — one sitting, independent of each other

None of these interact; they can be done in any order and each is small.

#### Dark theme prints as invisible text on white paper — the print block never resets colour

`src/theme/viewer.css:717` · **high**

viewer.js:18 runs `setTheme(stored || (prefersDark ? 'dark' : 'light'))`, so
an OS-level dark preference (or one stored click) leaves `data-theme="dark"`
on <html> permanently — including when the page is printed. Nothing in the
@media print block (viewer.css:717-721) resets the palette, there is no
`print-color-adjust`, no `@page`, and no `:root` override under print anywhere
in tokens.css or viewer.css (grepped: zero hits for `print-color-adjust`,
`color-adjust`, `@page`).
Chrome, Safari and Firefox all default to NOT printing background colours, so
`body { background: var(--canvas) }` is dropped and the sheet is white — but
`color` IS printed. I computed the dark-theme tokens against white paper:
  --ink   oklch(0.965 0.006 285) = #f3f3f7 → 1.11:1
  --ink-2 oklch(0.820 0.012 285) = #c3c3cc → 1.75:1
  --ink-3 oklch(0.660 0.014 285) = #91919b → 3.12:1
  --amber oklch(0.800 0.135 78)  = #edb24d → 1.90:1
  --accent oklch(0.780 0.150 296)= #c0a2ff → 2.13:1
So every rule statement, h1, `strong` and `.note-title` (--ink) is effectively
blank, and all body prose (--ink-2) is unreadable. Inverted, the hairline
tokens survive: --line = #2d2d37 (13.68:1) and --line-soft = #1f1f28
(16.27:1), so the borders of `.note`, `.page-provenance`, `pre.code`, `.page-
ahead` and every table rule print as near-black frames drawn around empty
space. The only legible text on the page is --ink-4 (#6b6b74, 5.29:1) — the
tier-origin and citation metadata. If the reader instead ticks "Background
graphics" to fix it, the whole sheet prints as a solid near-black rectangle.
The light theme prints correctly, and so does the JS-disabled case
(build.mjs:705 hard-codes `data-theme="light"`), which is exactly why this
survives a casual check.

*Fails when:* macOS/Windows set to dark appearance → open any generated rules page (e.g.
rules-orders-lifecycle.html) → Cmd+P → the printed sheet shows near-black
boxes and hairlines with the rule IDs and statements rendered at 1.11:1
contrast, i.e. blank paper.

*Verifier’s correction:* Real defect, slightly overstated in its visual description. Accurate version:
the @media print block at src/theme/viewer.css:717-721 handles layout only and
never resets the palette, and there is no print-color-adjust, no @page, and no
[data-theme] override under print anywhere in tokens.css or viewer.css.
Because src/theme/viewer.js:18 sets data-theme from the OS preference (or
localStorage) at load and that attribute persists into printing, a reader on a
dark-appearance OS printing any generated page gets browsers' default "don't
print backgrounds" behaviour: the dark canvas is dropped to white while the
light ink colours are honoured. Result on paper — h1, rule IDs/statements,
strong and .note-title in --ink at 1.11:1 and all body prose in --ink-2 at
1.75:1 are effectively invisible; --ink-3 tier text at 3.12:1 is faint; only
--ink-4 metadata (5.29:1) reads normally. No filled black boxes appear, since
backgrounds are dropped — what survives is the near-black hairline borders
(--line 13.68:1, --line-soft 16.27:1) of .note, .page-provenance, pre.code,
.page-ahead and table rules, framing blank space. Enabling "Background
graphics" does produce a readable page (dark canvas, light ink), so there is a
workaround, but it prints a solid near-black sheet. Light theme and the JS-
disabled path are unaffected because build.mjs:737 hard-codes data-
theme="light". Severity is moderate: a secondary output path, conditional on
OS dark mode or one theme-toggle click, fixed by adding a light-token (or
color-scheme:light plus token) override for :root[data-theme="dark"] inside
the existing @media print block.

#### decodeURIComponent on the raw fragment throws URIError and kills the whole IIFE

`src/theme/viewer.js:29` · **medium**

Line 29 (`const h = decodeURIComponent(location.hash.slice(1))`) — and line 39
inside frame() — decode an attacker/reader-supplied fragment with no guard. A
fragment containing a `%` that does not begin a valid escape makes
decodeURIComponent throw URIError. Line 29 runs at top level of the IIFE, so
the throw takes out everything below it: permalink copying, the scroll-spy,
the keybar, and the entire search sheet are never wired. This is a distinct
trigger and a distinct line from the known `frame()` empty-hash crash; fixing
that one does not fix this.

*Fails when:* Open any generated page with `#50%-off` (a hand-typed or hand-edited fragment,
or a corpus anchor `<a id="50%-off"></a>`, which buildPage copies verbatim
into the rule id): 'URIError: URI malformed' at viewer.js:29, and the page
loses theme toggling, permalinks and search entirely.

*Verifier’s correction:* Real defect, one degree narrower than claimed. `viewer.js:29` decodes
`location.hash` with no guard at the top level of the IIFE, so any fragment
containing a `%` that does not begin a valid escape (`#50%-off`, `#100%`)
throws `URIError: URI malformed` and aborts the rest of the script. Lost: case
recovery, the `:target` framing/persistent target, permalink click-to-copy on
`.rule-id`, the rail scroll-spy, the docking key bar, and the entire search
sheet (it is created in JS, so `/` and Cmd-K do nothing and the sheet never
exists). NOT lost: theme application and the theme toggle, which are wired at
lines 8-23 before the throwing line — the page still renders and toggles
light/dark. Line 44 inside `frame()` has the identical unguarded decode; it is
unreachable on a malformed initial load (line 29 throws first) but throws on
its own if a reader edits the fragment to a malformed value after a clean
load, killing hash-change framing from then on while leaving the rest of the
page wired. The corpus-anchor path is a theoretical rather than practical
trigger: buildPage does copy `pendingAnchor` verbatim into `rule.anchor`
(src/build.mjs:404-423), but only for an anchor immediately preceding a valid
`### ID — statement` heading, and it warns `anchor/ID mismatch` when the
anchor is not the lowercased rule ID. Fix is a one-line wrapper — a
`safeHash()` helper that try/catches `decodeURIComponent` and falls back to
the raw `location.hash.slice(1)` — used at both line 29 and line 44.

#### prefers-reduced-motion block cannot reach the JS smooth scroll on every permalink click

`src/theme/viewer.css:713` · **medium**

The reduce block only zeroes `transition-duration` and `animation-duration`.
The one genuinely animated motion in the viewer is not a CSS transition or
animation — it is a script-driven scroll:
  viewer.js:64  a.closest('.rule')?.scrollIntoView({ block: 'start', behavior:
'smooth' })
`behavior: 'smooth'` passed explicitly in the options object overrides the
element's computed `scroll-behavior` and is unaffected by any CSS the reduce
block can write; there is no `scroll-behavior: smooth` declaration anywhere in
viewer.css for it to neutralise either. This fires on the primary interaction
of the whole design — clicking a `.rule-id` to take a permalink — and the
scroll can span the full length of a 35-rule page. viewer.js never reads
`matchMedia('(prefers-reduced-motion: reduce)')`; it only reads `(prefers-
color-scheme: dark)` at line 9, so the plumbing to gate this is one line away
but absent.

*Fails when:* OS set to Reduce Motion → open a rules page → click the ORD-004 rule ID to
copy its permalink → the page runs a full animated smooth scroll to that rule,
exactly the vestibular trigger the reduce block is there to suppress.

*Verifier’s correction:* Real defect, materially overstated in impact.

#### The flash toast is faded with opacity but stays in the DOM, capturing clicks at bottom-centre forever

`src/theme/viewer.js:92` · **low**

flash() creates a `position: fixed; bottom: 22px; left: 50%` div and, after
1400ms, only sets `opacity: '0'` (line 92). There is no `.flash` rule anywhere
in viewer.css (grep confirms), so it has no `pointer-events: none`, is never
removed, and is never `display: none`. An opacity-0 element still hit-tests,
so a ~110x33px invisible box permanently blocks clicks/taps at the bottom
centre of the viewport for the rest of the session.

*Fails when:* Click any rule ID to copy its permalink, wait 2 seconds, then try to click a
link that happens to sit at the bottom-centre of the viewport (easy on a
phone, where the measure is full-width): the click lands on the invisible
toast and nothing happens.

*Verifier’s correction:* Real defect, with the scope narrowed. flash() creates a single `.flash` div
and, at viewer.js:97, only sets `opacity: '0'` after 1400ms. There is no
`.flash` CSS rule anywhere, so the element keeps `pointer-events: auto`,
`display: block` and `visibility: visible`, and an opacity-0 element still
hit-tests. Measured in Chrome on the built fixture, a 92.7x38.25px invisible
box sits at `bottom: 22px; left: 50%` with `z-index: 50` and swallows clicks:
`document.elementFromPoint` at its centre returns the toast, and 6 of the 18
interactive elements on the fixture page (the "Rules on this page" summary,
two rail links, the ORD-001/ORD-003 permalinks, an inline body link) are
unclickable when scrolled under it. Two corrections to the report: (1) the
toast does not fade — computed transition-duration is 0s, so it vanishes in
one frame, which is a separate cosmetic bug in the same function; (2) the dead
hit target persists for the rest of the current page view, not the rest of the
session, since this is a multi-page static site and each navigation is a full
document load. Fix is one line: add `pointerEvents: 'none'` to the inline
style object, or replace the timeout body with `n.remove()`.

#### Keybar's unverified chip keys off a presentational span, so it silently drops when `verified:` is absent

`src/theme/viewer.js:114` · **low**

Line 114 detects 'this page has never been human-verified' via
`document.querySelector('.page-provenance [data-tone="pending"]')`, then
hardcodes the words `Human-verified <b>never</b>`. build.mjs:642 only emits
that toned span when `d.verified === 'never'` is written explicitly; when the
key is missing it falls through to `esc(d.verified || 'never')`, i.e. the
plain text 'never'. The strip and the docked bar then disagree about the same
page.

*Fails when:* Give a guide frontmatter `walked-by-agent: 2031-03-04` with no `verified:`
line. The provenance strip reads 'Human-verified never', but once the reader
scrolls past the legend the docked keybar omits the 'Human-verified never'
chip entirely — the caveat disappears exactly when the strip has scrolled out
of view.

*Verifier’s correction:* Real defect, with two corrections. (1) Line references are wrong: the keybar
logic is src/theme/viewer.js:118-135 (query at 122, chip at 128), not 114; the
strip row is src/build.mjs:677-678, not 642. (2) The divergence originates in
build.mjs, not viewer.js — the same rendered words ("never") get amber `[data-
tone="pending"]` emphasis (viewer.css:417) when the key is written explicitly
and plain ink when it is omitted, so the strip itself already under-states the
caveat before the keybar is involved; the dropped chip is the downstream
symptom of viewer.js keying off a purely presentational hook instead of the
underlying fact. The right fix is at the source: emit the toned span whenever
the effective value is 'never' (`(d.verified || 'never') === 'never'`), or
better, carry the fact as data (e.g. a `data-verified="never"` attribute on
`.page-provenance`) and have viewer.js read that. Scope limit worth noting:
the keybar block only runs when the page authors an evidence legend table
(`.ev-key`, build.mjs:520), so a `walked-by-agent` guide with no legend has no
docked bar at all and loses nothing extra; the failure needs a page that has
both a legend and a `walked-by-agent` line without `verified:` — which the
shipped fixture would hit if that one frontmatter line were dropped.

#### pre.code and .table-wrap are scroll containers, so overflowing content is silently clipped in print

`src/theme/viewer.css:460` · **low**

`pre.code` is `max-width: 70ch` + `overflow-x: auto` (:460-465) and `.table-
wrap` is `overflow-x: auto` (:468). On screen the reader scrolls; in paged
media there is no scrollbar and the scrollable overflow is clipped to the box,
with no ellipsis, no wrap and no visual indication that anything was cut. The
print block resets neither, and neither has `white-space: pre-wrap` or
`overflow: visible` under print.
At 12.5px JetBrains Mono the 70ch box is roughly 525px, so anything past about
70 characters on a line disappears. Since the corpus is arbitrary markdown and
the generator styles fenced code as a first-class element, a long command, a
fully-qualified type name or a JSON payload on one line is an ordinary input.
Same mechanism clips any 3+ column table wider than its column (the `data-
cols='2'` stacking at :694 deliberately exempts those from reflowing).

*Fails when:* Author a rule body containing a fenced code block with a 120-character line
(e.g. a `dotnet test --filter "FullyQualifiedName~Meridian.Business.Tests.Orde
rServiceTests.Place_Rejects_WhenStockUnavailable"` invocation) → on screen it
scrolls horizontally; printed, it is cut mid-token at ~70 chars and the reader
has no way to know the line continued.

*Verifier’s correction:* Real, with two corrections. (1) Effective cut is ~66-67 characters, not 70:
`box-sizing: border-box` (viewer.css:17) means the 70ch cap includes the
13px/15px padding and 1px borders. Measured cut in the printed PDF: exactly 67
chars. (2) "No visual indication" is not quite right in Chrome — it paints an
inert scrollbar track and thumb beneath the block in the PDF, which hints that
something scrolls but never says what was lost, is unusable on paper, and is
engine/print-path dependent. (3) The table half is real but narrower than
stated: it needs a cell whose min-content width is unbreakable. A genuinely
wide 6-column prose table wrapped and fit within the printed page (the print
`.frame { display: block }` plus hidden side/rail gives tables the full page
width). But a table whose cells hold long plain-text dotted identifiers does
clip: in the same PDF a 3-column table lost its entire third column and cut
both values mid-token. Note `td` has no `overflow-wrap`, while inline `code`
does (:458), so backticked long tokens in cells survive and bare ones do not.
The `data-cols='2'` stacking at :694 lives in the `max-width: 720px` block and
never fires in print (Letter is ~816 CSS px), so it neither causes nor
mitigates this. Fix is the usual one-liner in the print block: `pre.code {
white-space: pre-wrap; overflow-wrap: anywhere; overflow: visible; max-width:
none }` and `.table-wrap { overflow: visible }` with `td { overflow-wrap:
anywhere }`.

#### Evidence glyphs announce their label twice — role="img" aria-label immediately followed by the same words as text

`src/build.mjs:521` · **low**

`markGlyph()` (build.mjs:146-148) emits `<span class="ev-mark" role="img"
aria-label="<short>">`. Three call sites then place text that repeats or
subsumes that label directly beside it: the legend at build.mjs:521 renders
`<dt>{glyph}<span class="k-name">{short}</span></dt>` with the identical
string; the coverage tag at build.mjs:449 renders `{glyph}
<span>{label}</span>` where `label` begins with the same words; and
viewer.js:125 clones the legend `<dt>`'s innerHTML into the key bar, carrying
the duplication with it. Verified in the built fixture output: `<dt><span
class="ev-mark" role="img" aria-label="seen">…</span><span
class="k-name">seen</span></dt>`. The glyph is decorative wherever its label
is already written out next to it and should be `aria-hidden="true"` there,
keeping `role="img"` only for inline claim marks where nothing else names it.

*Fails when:* A screen reader reading the evidence key on dist/guides-refund-an-order.html
announces "seen, image. seen. seen rendering in the browser" for the first
term and "from source, image. from source. read from source, accurate about
what the code does…" for the second; the coverage tag reads "from source read
from source, accurate about what the code does, silent about what renders".

*Verifier’s correction:* `markGlyph()` (src/build.mjs:147) always attaches `role="img" aria-
label="<short>"`, and three renderings place equivalent text directly beside
the glyph, so a screen reader speaks the same words twice: the legend `<dt>`
(src/build.mjs:521) pairs the label with an identical `.k-name` string ("seen,
image. seen. — seen rendering in the browser"), the coverage tag
(src/build.mjs:449) pairs it with a label that begins with the same words
("from source — read from source, accurate about what the code does, silent
about what renders"), and the key bar (src/theme/viewer.js:125) clones the
legend `<dt>` markup so it repeats the legend's duplication whenever it is
docked (it is `hidden aria-hidden="true"` otherwise). This is a minor
verbosity issue, not a conformance failure — nothing is unlabeled or
unreachable, and only 3 of 18 glyph instances on dist/guides-refund-an-
order.html are affected; the 15 inline claim marks correctly need `role="img"`
because nothing else names them. The fix is to make the glyph decorative
(`aria-hidden="true"`, drop `role`/`aria-label`) at the legend and coverage-
tag call sites only, e.g. by giving `markGlyph()` a "labelled elsewhere" mode.
---

## 3. Decisions, not defects

Each of these has a real trade-off and should be decided rather than patched.
Recommendations are mine; the call is not.

#### At <=860px no group other than the reader's current one is reachable, and the home page's nav is a single self-link

`src/theme/viewer.css:600` · **high**

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

## Notes for whoever picks this up

**The working tree is the only copy.** ~690 lines across six files, uncommitted.
A patch is at `../arcdoq-docsite-mobile.patch` if the tree gets reset.

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

**`DESIGN.md` still contradicts the shipped search.** Its "Cut outright, not
deferred" list names *the modal mobile sheet*, which is what search is. Either
the code or that line has to move; the audit is why it is worth deciding
deliberately rather than quietly editing the list.
