# Known defects

Three open items. Two of them only bind when someone starts the build-over-build
diff, so one thing is actually outstanding.

Everything that closed has been **deleted rather than archived**. The reasoning
that outlived each fix lives in `DESIGN.md` — read that first; it carries the
rulings and the rejected alternatives, so a change here is a decision rather
than a re-derivation. The rest is in git history. What went: the ten search
entries (search is a route, and `DESIGN.md` already carries every ruling that
came out of it), the mobile-verification batch, the two guide/flow genre
entries, the rule → guide back-link, whose ruling now sits in `DESIGN.md` under
*The warrant's last row is navigation, and stays per-rule*, and the `action.yml`
Node 20 entry, which was marked fixed in v0.4.3 when only a third of it was —
v0.4.3 moved the `node-version` input, which is not the runtime the action's own
steps execute on. Both step pins are now at v7 (`using: node24`).

**This file is a staging area, not a tracker.** What is left should become
GitHub issues. Before adding anything new here, ask whether it belongs there
instead.

---

## Open

#### Before the build-over-build diff: the artifact has no build identity

`src/build.mjs:879` · **decide before building the diff, not after**

The three things `DESIGN.md` says keep the door open — stable IDs, a schema
version, caveat kinds as an enum — are all intact, and `rules.json` is
byte-identical to v0.1.0. Verified, not assumed. But two artifacts of the same
corpus cannot currently be **ordered**, which is the one thing a "what moved
since the last publish" diff needs first.

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
builds without claiming freshness.

Queued originally as "decide now, it's free". That window has closed and nothing
broke, so this is a brief for whoever starts the diff rather than work to do
now.

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

Same status as the entry above: a brief for whoever starts the diff.

#### The linear-paging flag DESIGN.md says stays available does not exist

`DESIGN.md:233-234` · **low — a one-sentence overclaim, no code behind it**

DESIGN.md rules: "**No prev/next, in either form.** A reference corpus has no
reading order... **Linear paging stays available behind a flag for corpora that
genuinely are books.**" The cut itself is honoured — nothing renders a pager —
but the escape hatch the ruling promises is not implemented. The `defaults`
object (`build.mjs:44-77`) declares no such key, `config` is never consulted for
one, and a grep for pager/prev/next/paging across `src/` and `bin/` returns only
the unrelated `tokens[i + 1]` lookahead at `build.mjs:393` and the theme-toggle
local in `viewer.js`.

**Documentation-only, and the originally-claimed runtime failure does not
occur.** The shallow merge at `build.mjs:83` preserves unrecognised top-level
keys (`statusSidecar` is an in-repo example of a merge-surviving key absent from
`defaults`), the build succeeds unchanged, and the absence of a pager is the
intended behaviour rather than a regression. The defect is that the sentence is
written in the present tense as a shipped affordance, which is the one form of
overclaim the document's own third question forbids.

Fix is to correct the sentence: move it to "Deferred, with reasons" and phrase
it as a door left open. Implementing the flag is the other option and nobody has
asked for it.

---

## Decided and implemented, 2026-08-04

Both were contrast failures that outgrew the surface being reviewed, and both
are now fixed in `tokens.css`. Kept as a short record because the *shape* of
each answer is the reusable part.

**`--accent` was 3.27:1 as text on the light canvas**, so every prose link on
the site was below AA. Fixed by splitting rather than darkening: `--accent`
stays exactly as it was and keeps serving rings, fills and borders, which owe
3:1 and met it. A new `--accent-text` is **derived** from it
(`color-mix(in oklch, var(--accent) 72%, var(--ink))`, 5.18:1) and is what links
use. Derived so a customer overriding `--accent` — the one token they override —
carries the correction with them. No mix can guarantee AA for an arbitrary
override; this makes the common case right instead of wrong.

**The ink ladder was tuned against the canvas, and the design puts dim text on
`--surface-1`.** Every code citation sits on a `--surface-1` fill, where the old
`--ink-4` measured 3.14:1 and even a canvas-correct 4.54:1 still failed at 4.2.
Re-tuned against `--surface-1`, the tighter of the two backgrounds, so all four
rungs clear AA on both: 16.16/14.96, 11.03/10.21, 7.35/6.81, 5.03/4.66. Two
`opacity` multipliers went with it (`.cite .dir` at .75, `.tier-origin` at .8) —
they were dividing an already-failing rung.

The lesson worth keeping: **a ladder tuned against the canvas is not tuned.**
Check the darkest background the token actually lands on.

## Notes for whoever picks this up

**Where the work is.** On `main`, merged and pushed through v0.4.5, plus the
uncommitted 2026-08-04 design pass. Nothing is parked off-trunk.

**Reproducing 390px.** Chrome on macOS will not resize a window below ~606px
outer width, so `resize_window` cannot reach a phone viewport. Drive it through a
same-origin iframe instead — media queries resolve against the iframe's own
viewport, so it is a real 390px layout. Suppress the classic 15px scrollbar
(`html { scrollbar-width: none }`) or the layout viewport is 375, not 390;
phones use overlay scrollbars, so suppressing it is the faithful choice.

**Measuring contrast here needs pixel sampling, not string parsing.**
`getComputedStyle().color` returns `oklch(...)` in this theme, not `rgb(...)`.
Parsing those three numbers as RGB produces confident nonsense — it silently
reports ratios near 1.0. Paint the colour into a 1×1 canvas and read the pixel
back.

**Measuring the claim needs the right two elements.** A rule is `.rule-id`,
`h3.rule-statement`, `div.rule-body`, `p.rule-trust`, `div.warrant`. The claim
is the `h3` plus `.rule-body`. `.rule-trust` is the status verdict rendered in
the margin, and counting it inflates the claim by roughly 70%, which makes every
warrant-to-claim ratio look better than it is.

**One behaviour change worth knowing.** Hoisting `.rule-id` out of the `<h3>`
shrank its hit area from 184px (the full mark column, an `<a>` stretched by
subgrid) to 53.4px, the width of its own text. Visible position is unchanged.
This is a fix — 130px of invisible margin used to copy a permalink and fire a
toast when clicked — but it is a change, and it was not asked for.
