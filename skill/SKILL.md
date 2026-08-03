---
name: arcdoq-docsite
description: "Use when starting or maintaining a documentation corpus built with the arcdoq-docsite package — standing up a new docs repo from nothing, writing or revising rules that cite real source code and tests, wiring the status computation that dates those rules against a customer's branches, or upgrading a corpus to a new package tag. Covers the corpus conventions the generator parses (rule ids, Status/Test/Source meta lines, stable anchors, docs.json as nav and publish filter), what may be asserted versus what must be computed, and the questions to ask before writing a single rule."
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

## The conventions the generator parses

A rule is an `###` heading whose id matches `[A-Z][A-Z0-9]{1,9}-\d{1,4}`,
followed by a statement, a body, and a meta line:

```markdown
### EMAIL-001 — A globally suppressed address receives no mail of any kind

<a id="email-001"></a>

The global denylist is checked first and blocks every email type, including
transactional and account mail.

**Status:** implemented · **Test:** `Evaluate_BlocksAllMail_WhenGloballySuppressed` · **Source:** `api:Business/Services/Email/SuppressionService.cs`
```

**The explicit `<a id>` is the rule's address, and it is permanent.** A
slugified title dies the moment someone rewords the heading, taking every
pasted ticket link with it. Hoist it, never regenerate it, never renumber.

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

Draft new guides freely. **Never silently rewrite a guide someone has verified**
— propose the change instead.

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
