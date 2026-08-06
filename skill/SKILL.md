---
name: arcdoq-docsite
description: "Use when starting or maintaining a documentation corpus built with the arcdoq-docsite package — standing up a new docs repo from nothing, writing or revising rules that cite real source code and tests, writing the flows and UI walkthrough guides that sit alongside them, wiring the status computation that dates those rules against a customer's branches, or upgrading a corpus to a new package tag. Covers the corpus conventions the generator parses (rule ids, Status/Test/Source meta lines, stable anchors, the rules/ flows/ guides/ path prefixes, docs.json as nav and publish filter), what may be asserted versus what must be computed, how a guide is drafted from source and then walked in a browser, and the questions to ask before writing a single rule."
license: "Apache 2.0."
package: arcdoq-docsite
requires: ">=0.4.0"
---

Build a corpus whose every claim can be **dated and traced**. A rule here is not
prose about a product — it is a statement about code, carrying the paths that
implement it, the tests that prove it, and a status computed from git rather
than typed by a person.

The generator is a versioned dependency. It parses the conventions below and
emits a site plus `rules.json`, the machine surface an agent queries. Your job
is to produce a corpus that parses, and to never state more than you can show.

## Read these first, at the tag you are pinned to

The package is the source of truth and it moves. Before writing anything, read
from the pinned tag, not from memory:

- `README.md` — what the generator reads and emits
- `docs.config.example.json` — every config key
- `DESIGN.md` — why the rendering is the way it is
- `PRODUCT.md` — who a generated page is for, and what it may never overclaim

If the corpus already has a `docs.config.json`, its `requires` above must be
satisfied by the tag in the consumer's workflow. A skill newer than its package
will describe keys the build does not know.

## Ask before you write

These are the questions whose answers you cannot guess. Ask them all, up front,
in one go — not one at a time as you hit them.

1. **What are the three branches called?** Every corpus has a ref that is live,
   a ref the docs are written from, and a ref that is earlier than both. The
   *roles* are fixed; the spellings are not. `main`/`stage`/`dev`,
   `production`/`staging`/`development`, `release`/`main`/`next` are all the
   same three roles. Record the answer in `docs.config.json`:

   ```json
   "refs": {
     "production":  "origin/main",
     "candidate":   "origin/stage",
     "development": "origin/dev"
   }
   ```

   **Never invent a role that does not exist.** Plenty of teams ship from `main`
   alone. Declare only what is real:

   ```json
   "refs": { "production": "origin/main" }
   ```

   That is a complete answer, not a degraded one, and everything downstream
   still works — it just says less, honestly. With one ref there is no
   promotion to detect, so `in-stage` and `in-development` can never occur and
   a status means only *do this rule's citations still resolve on production*.
   That still catches the failure that matters most: a rule pointing at code or
   a test that no longer exists. Do not offer to create a branch to fill the
   shape, and do not leave a role declared but empty.

2. **Which repos does this corpus document, and where are they checked out?**
   A rule cites source paths in *other* repositories. Without local clones
   nothing can be computed, and every status becomes an assertion.

3. **What prefix does a citation use for each repo?** `api:`, `dashboard:`,
   `web:`. This is what joins a rule to the repo state it was computed against.

4. **How are the tests named, and do they exist at all?** Sample fifty. You are
   deciding one thing only: whether a name can carry meaning *without being
   opened*. `Evaluate_BlocksAllMail_WhenGloballySuppressed` can;
   `it('works')` cannot. Report the answer before writing anything.

   That decision does not change what you must verify — see below — only how
   much a reader gets from the citation alone. Say which case you are in
   rather than producing weaker rules that look identical to stronger ones.

5. **Who reads this, and can they see the source?** If the audience is testers
   and BAs without repo access, the corpus is internal and the site is private —
   it names source paths, test names and what is live where.

6. **Is there a front end, and can you reach a running one?** A rule costs a
   read; a guide costs somebody opening the product. Ask whether there is a UI
   worth documenting, which deployed environment is safe to touch, and who grants
   access — before promising a walkthrough you can only draft.

## The conventions the generator parses

A rule is an `###` heading whose id matches `[A-Z][A-Z0-9]{1,9}-\d{1,4}`,
followed by a statement, a body, and a meta line:

```markdown
<a id="email-001"></a>
### EMAIL-001 — A globally suppressed address receives no mail of any kind

The global denylist is checked first and blocks every email type, including
transactional and account mail.

**Status:** implemented · **Test:** `api:Evaluate_BlocksAllMail_WhenGloballySuppressed` · **Source:** `api:Business/Services/Email/SuppressionService.cs`
```

**The explicit `<a id>` is the rule's address, and it is permanent.** A
slugified title dies the moment someone rewords the heading, taking every
pasted ticket link with it. Hoist it, never regenerate it, never renumber.

**Placement is load-bearing: directly above the heading, no blank line between.**
The lexer holds a pending anchor and the next rule heading claims it, so an
anchor written *below* its heading becomes the **next** rule's address — every
rule after it shifts by one, and the first silently falls back to a slugified
title. The build now refuses this, but write it right the first time.

Citations are repo-prefixed on both fields — `` `api:SomeTest` `` — and the
prefix is what joins the rule to the repo state it was computed against.

A citation may contain an em dash; it is read whole as long as it is inside
backticks. What must never be unbalanced is the backticks themselves.

`docs.json` is both the navigation and the publish filter — a page absent from
it is not published. An area with no rules yet still belongs in the nav, in its
own group, saying so: a gap nobody can see generates no question, and a reader
who searches and gets nothing cannot tell *undocumented* from *misremembered*.

## What may be asserted, and what must be computed

This is the line the whole corpus rests on.

**Computed, never typed:** `Status:`. It is derived by comparing a rule's
`Source:` paths across the three refs. A hand-typed status rots, because nobody
remembers to flip it on promotion day. If you find yourself editing a `Status:`
field by hand, stop — you are writing a claim you cannot support.

**And it describes the evidence, not the behaviour.** The comparison is at path
granularity: it flags that the code under a rule *moved*, not that the rule's
behaviour *changed*. A refactor pushes rules to "changed on stage" that are
still perfectly true in production. Never render such a rule as "not in
production" — it will tell a tester a live behaviour is missing.

**Asserted, and marked as such:** the statement and the body. You wrote them by
reading code. Say so with the provenance the corpus declares; never claim a
human verified something an agent read.

**Never invented:** a rule with no source path is not a rule. If the code does
not say it, do not write it, however reasonable it sounds.

## What a test citation is worth

Two things come apart, and conflating them is how a corpus starts lying.

**Warrant** is whether the test actually proves the statement. **Legibility** is
whether a reader can tell that from the name. A well-named test gives you both
for free; a badly-named one gives you the first and none of the second.

So the rule is the same either way: **open every test you cite, and read what it
asserts.** Not all the tests in the repo — only the ones a rule points at, which
is a handful per rule. A name is a claim about a body, and citing a name you
have not read is repeating someone else's claim as your own.

What changes with naming quality is only what the body is *for*. Where names are
descriptive, the citation carries the explanation. Where they are not, the rule's
body must state what the test establishes, because the name will tell the reader
nothing when they arrive at it.

Two traps worth naming:

- **A test that asserts the opposite of the intent still documents the code.**
  If the only test proves a behaviour the business considers a bug, the rule
  describes what the code does and carries a caveat. It does not describe the
  intention and cite a test that contradicts it.
- **A passing test whose name overstates its scope.** `Handles_All_Cases` that
  exercises one branch warrants one branch. Cite it, and let the rule's scope
  match what the body covers, not what the name promises.

## When there are no tests

This is expected, and the model already carries it: an untested rule keeps
whatever tier its code comparison earned and gains a caveat — *nothing tests
this* — rendered on the page and present in `rules.json`. The warrant line says
"No test" outright.

So a rule with `Source:` and no `Test:` is a legitimate rule, not a draft. What
you must not do is reach for a loosely-related test to fill the field. A wrong
citation is worse than an absent one: the absent one is visibly absent, and the
caveat says so.

If a corpus has no test suite at all, say so once, up front, and expect every
rule to carry that caveat. That is an honest corpus of source-read rules, and it
is worth building — it just should not be described as verified.

## Writing a rule

State the behaviour a reader can observe, not the mechanism:

> ✅ A click from someone who already converted queues nothing
> ❌ `NudgeService.HandleClick` early-returns when `lead.ConvertedAt` is set

The mechanism belongs in the body and the citation. The statement is what
someone scanning a list needs to recognise.

A test name states what the code **does**, not what the business wants. If the
only test asserts the opposite of the intended behaviour, the rule documents
what the code does and carries a caveat — it does not document the intention.

## The other two kinds of page

A corpus is not only rules. `flows/` and `guides/` are directory names the
generator reads, and the split is not filing — the three have different subjects,
different sources, and, the part that decides everything else, different clocks.

| | Answers | Subject | Written from | Breaks when |
|---|---|---|---|---|
| `rules/` | does X work? | the system | tests and source | the cited code moves |
| `flows/` | what happens when…? | the system | rules, in order | a rule beneath it changes |
| `guides/` | how do I…? | a person | using the product | the UI changes |

That last column is the whole reason guides are their own genre. **A guide breaks
when the front end changes, which no diff of the code a rule cites will ever
see.** So a guide cannot inherit a rule's computed status, and carries its own
freshness signal instead.

### Writing a flow

An ordered narrative of what the system does across a whole journey, with the
system as the subject. Numbered steps, each naming what triggers it and what
state it leaves behind. Name it after the reader's goal, not the subsystem.

**A flow never states a rule it could link to.** Link down for the conditional
detail — *"a click from someone who already converted queues nothing
([NUDGE-014])"* — rather than restating it. Restating is how the two drift apart.
Close with what can go wrong: the branches and failures a tester actually hits,
each pointing at the rule that explains it.

### Writing a guide

Outcome first — what the reader ends up with, and what they need before they
start. Then numbered steps **naming the real UI labels**:

> ✅ Press **Issue refund**. It stays disabled until the amount is valid.
> ❌ Trigger the refund action once the form validates.

A label is greppable and diffable, so a rename is findable; a paraphrase is
neither. Link out for the why, and close with an "If it doesn't work" table
pointing at the rules behind each failure.

Prefer named labels to screenshots. Screenshots rot faster than anything else in
a corpus, nothing tells you when they are stale, and they cannot be diffed in a
pull request. Where one is genuinely unavoidable, say what it is a picture *of*,
so the text still works when the image is wrong.

**Draft from source, freely.** The front-end code carries the real click path —
route, component, the literal label in the markup, what disables a control, where
the user lands. Reading it beats anyone's memory of clicking through, and it is
the intended way to write a first draft.

What source cannot do is confirm the thing renders that way; conditional
rendering on runtime state, flags and data is not statically evaluable. So a
drafted guide lands `verified: never` and stays there until somebody walks it.
**Never silently rewrite a guide someone has verified** — clear the date, note
what changed, propose it, and leave the steps alone. A guide rewritten by
something that never opened the product is a confident lie.

### `verified:` means a human, and nothing else

Three states, three fields, and merging them costs you the signal:

```yaml
verified: never                  # a PERSON walked these steps
walked-by-agent: 2031-03-04      # an agent drove a browser against a deployment
walked-in: staging — meridian-staging.example.com (v4.2.0), read-only
```

An agent walk confirms what actually renders, which is strictly more than reading
source and still not a person having looked. Give it its own field: `verified:`
is worth nothing the moment it means two things.

Then mark **each claim** with the corpus's declared markers — seen versus read —
rather than stamping the page once. A walk that leaves what it could not reach
unmarked is worse than no walk, because it launders a source-drafted guess into
an observation. End with a section naming what a human still has to check, in
priority order.

### Letting a reader record a walk, without a commit

Everything above is written by whoever holds the repo. That is the barrier: a
tester who walks a guide and finds it still works cannot say so without a commit,
so `verified:` stays `never` on guides people have actually walked.

Turn the write path on in `docs.config.json`:

```json
{ "walk": true }
```

Off by default, and the default is not timidity: the control posts a per-render
token only a HOST can mint, so a corpus built with `npx arcdoq-docsite build` and
served from anywhere else ships a button that can never work. Turn it on when the
corpus is published somewhere that can mint one.

What it adds, on guides and flows only — a rules page gets nothing, because a rule
is computed from tests and was never the surface anyone walks:

- a **Mark walked** button under each step, one click, no JavaScript required
- a name field, filled once, above the page

**The state stops being a build-time value.** With `walk` on, the provenance strip
renders your frontmatter into slots a host substitutes live state into. Your
`verified:` / `walked-by-agent:` values are still what a standalone build shows,
and still what the machine surface reports. They become the DEFAULT rather than
the answer — a host that has an observed walk overwrites the row, and a host with
nothing leaves your claim alone.

So keep writing them exactly as above. A value out of the repo is rendered as a
CLAIM (weaker, italic) and an observed walk as PROVEN, which is the honest
difference: your frontmatter is the publisher attesting to their own verification.

**Do not write prose that narrates walk state.** The strip owns it now, and it is live; a sentence
beside it is baked and is wrong the moment anyone walks. The first real corpus hit this within an
hour: a page whose aside read *"`verified: never`, and nothing has walked this"* sat directly under a
strip naming the person who had just walked it.

So write the frontmatter, and let the strip say what it means:

```yaml
verified: never                  # keep writing these — they are the strip's DEFAULTS
walked-by-agent: 2031-03-04
```

Prose may say what a claim RESTS ON — drafted from source, which branch, what source cannot confirm
— because none of that changes when somebody walks. It must not assert that nobody has, or that
anybody has. That is the one fact on the page with a live owner, and two owners is how it drifts.

**Visibility matters, and the wrong choice fails silently.** A walk cannot be
recorded on a `public` site — the endpoint refuses it, because a public site is
served with no cookie at all and the write would be open to the internet. The
buttons still render and every one of them is refused. Publish `private` (walkers
are signed-in members and get a proven name) or set the site to passcode in the
app (walkers hold a shared secret, so the name is self-asserted). A machine deploy
cannot create a passcode site by design — a passcode does not belong in a
workflow file — so create it `private` and flip it in the app if you want the
passcode tier; a republish keeps whatever the site already is.

### Walking a screen

Four rules, every one of them learned the hard way:

1. **Say which environment and which build.** A guide walked on a candidate ref
   may describe something production has never seen.
2. **Read-only by default, and never in production.** Opening a form to read its
   labels and cancelling out is always fine.
3. **When you have to write, ask first.** You cannot walk a screen with no data
   in it — an empty list hides the table, the row controls, and every state that
   only exists once there is a row. Do it off production, use an obviously
   disposable value on a documentation-reserved domain, remove it afterwards, and
   say in the guide what was left behind. Removal is often deactivation; the row
   survives.
4. **Never record a negative from an empty screen.** The first real walk of a
   guide concluded a screen's count badges did not exist, and marked the draft
   wrong. One throwaway row brought them straight out. Absence of a control is
   the one observation a blank list cannot support — mark it unseen instead.

## Loading context

Read per area, per page, from the first line. Do not load a whole generated
inventory to answer one question: on a real corpus that is hundreds of
kilobytes, it truncates, and a truncated read produces confident wrong answers.
Open the source files a rule cites, directly.

## Before you finish

Run the build and fix what it reports:

```bash
npx --yes "github:nimbarc/arcdoq-docsite#<tag>" build --corpus . --strict
```

`--strict` fails on any warning, and every warning here is a real defect: a
declared area nothing resolves to, a status sidecar that does not exist, an
environment file whose baseline disagrees with `refs.production`. A green
`--strict` build is the bar, not a clean-looking page.
