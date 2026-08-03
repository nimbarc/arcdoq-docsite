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

   Never assume. A trunk-based shop may have only two, in which case say so and
   do not invent a third.

2. **Which repos does this corpus document, and where are they checked out?**
   A rule cites source paths in *other* repositories. Without local clones
   nothing can be computed, and every status becomes an assertion.

3. **What prefix does a citation use for each repo?** `api:`, `dashboard:`,
   `web:`. This is what joins a rule to the repo state it was computed against.

4. **How are the tests named?** Sample fifty of them. If names carry a subject,
   a condition and an outcome (`Evaluate_BlocksAllMail_WhenGloballySuppressed`),
   a test name can stand as a rule's warrant. If they are `test1`, `it works`,
   or bare method names, **say so out loud** and fall back to citing source
   paths only. Do not quietly produce weaker rules and present them as equal.

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
