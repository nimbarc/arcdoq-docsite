# Product

> The impeccable context file: who this is for, how it should feel, and the
> principles the interface is held to. Paired with `DESIGN.md`, which holds the
> visual system and the reasoning behind it — read that second, and treat it as
> the authority wherever the two touch.
>
> Sits at the repo root beside `DESIGN.md`, and has to: the context loader resolves
> BOTH files from one directory, so splitting them makes one invisible. That is
> fine here — DESIGN.md already keeps this package's reasoning in the open at the
> front door, and this is its sibling, not marketing.

## Register

product

The **output** is the product, not this repository and not its own presentation.
Nobody admires a docs generator; they arrive at a page it built, holding a rule ID
from a ticket, and need an answer in seconds. Every judgment call resolves in
favour of the reader of a generated page, never the person configuring the build
and never the package's own shelf appeal.

There is no brand moment anywhere in scope. No landing page, no hero, no campaign.
If a change would only make sense as one, it is out.

## Users

**Primary: the reader arriving cold.** An engineer, support lead, or QA tester who
followed a link from a ticket, a Slack message, or a search result. They land
mid-page on a deep link. They did not read the page above it and will not scroll
up. They want one specific claim, and they want to know how much to trust it
before acting on it.

They are technical but not necessarily on the team that wrote the docs. They are
often mid-incident. They are on a laptop, sometimes a phone, occasionally printing
to paper for a meeting.

**Secondary: the person who owns the corpus.** They write markdown, run a build in
CI, and never touch the theme. Their whole interface is `docs.json`, frontmatter,
and a version tag. They should be able to upgrade by bumping one line.

**Third, and newly real: the UAT tester.** They have a passcode and a browser and
no repo access. They walk a guide to find out whether it still works, and record
that they did. They are the reason the write path exists (arcdoq#43); before it,
the only way to record a walk was a commit, which is exactly the barrier they
cannot cross.

**Not users:** end customers, marketing sites, blogs, anyone browsing for pleasure.
Nothing here is optimised for discovery, engagement, or time-on-page.

## Product purpose

Turn a markdown corpus into a finished, self-contained static site: HTML, CSS, one
JS file, and a `rules.json` sidecar. No server, no request-time rendering, no theme
engine. Point it at a directory and it emits a site a host can serve as-is.

Two things make it worth existing rather than reaching for an off-the-shelf docs
theme:

1. **It renders certainty honestly.** A claim carries its own evidence — computed
   from tests, asserted by a person, or unresolved — and the rendering never
   flattens the difference.
2. **It has a machine surface on purpose.** `rules.json` and the `data-*` contract
   let an agent filter a corpus by genre and coverage instead of grepping prose.

## Direction

DESIGN.md states it in one line and it governs here too:

> **A register of numbered claims, each arriving cold and expected to stand up
> alone. The statement leads, the evidence follows, and nothing is ever rendered
> more certain than it is.**

## Principles

**Never render anything more certain than it is.** This is the one that outranks
the others, and it is a correctness rule, not a style note. A confidently wrong
claim is worse than a missing one. It is what vetoes a status chip that flattens a
caveat, a git-derived "last updated" beside a human verification date, a
self-asserted name shown like a proven one, and any provenance transform that
guesses.

**The reader arrives cold.** No reading order, no prev/next, no tutorial spine, no
onboarding. Every page is a landing page for the one claim someone linked to.

**A good floor, and its ceiling's state is observable.** Everything works with
JavaScript off — nav is baked, `:target` frames the rule, provenance is decorated
in CSS. That floor once hid a client layer throwing on every load for an entire
version. So the enhancement layer reports whether it completed, because a floor
this good will otherwise absorb a failure silently.

**One fact, one place, and that place is addressable.** Two copies of the same
state drift, and the second copy is always the one nobody updates.

**The package ships no customer's vocabulary.** Area labels, evidence markers,
status groups and rule ID patterns are all corpus-declared and empty by default. A
package carrying one customer's nouns to every other customer is how a product
becomes a fork of itself.

**A feature that cannot work in the default path does not ship on in the default
path.** The walk control posts a token only a host can mint, so it is off unless a
corpus asks for it. A dead control is worse than no control.

## Tone

Plain, specific, unhurried. Short labels in the interface; full sentences where
something genuinely needs explaining, and none where it does not.

Never reassuring. "Not verified" is more useful than "pending review". The
interface's job is to be accurate about how much is known, including when the
answer is nothing.

No exclamation marks, no encouragement, no celebration of completed work. Marking a
step walked is quieter afterwards than before — done is a thing to stop looking at.

## Anti-references

- **Docusaurus / GitBook / Mintlify defaults.** Tutorial spines, prev/next
  pagination, "was this helpful?", a search modal, a landing page for the docs.
  Every one assumes a reader who started at the beginning. Ours did not.
- **Status badges as decoration.** A green check that means nothing specific is
  worse than no badge, because it spends the reader's trust on nothing.
- **Anything that guesses.** Auto-derived freshness, inferred categories,
  confidence scores. If it was not stated or computed, it is not rendered.
- **A theme engine.** Configurability here is the corpus's vocabulary, not the
  look. One considered design, versioned by tag.

## Constraints that shape the interface

- **Self-contained output.** No CDNs, no external fonts at runtime, no network
  calls on load. Exactly one request exists in the whole client layer, it is
  user-initiated, and it had to argue for itself.
- **Tag-pinned.** A consumer references the action at a tag; that is the entire
  upgrade path. A host that serves these pages substitutes values into slots this
  template owns and never injects markup, or tag-pinning stops meaning anything.
- **Paper is a target.** Pages get printed for meetings. Nothing is silently cut
  off, and no dark override escapes the screen scope.
- **Both themes, equally.** Light and dark are each tuned against the same AA
  floor, measured against `--surface-1` rather than the canvas because that is the
  tighter case.
