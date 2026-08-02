#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { build } from '../src/build.mjs'
import { publish, report, readFileset, DEFAULT_ENDPOINT } from '../src/publish.mjs'

const argv = process.argv.slice(2)
const cmd = argv[0]
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

const COMMANDS = ['build', 'publish']

if (!COMMANDS.includes(cmd) || argv.includes('--help') || argv.includes('-h')) {
  console.log(`arcdoq-docsite — build a docs site from a markdown corpus, and publish it

  arcdoq-docsite build   [--corpus <dir>] [--out <dir>] [--strict]
  arcdoq-docsite publish --site <slug> [--dir <dir>] [--name <name>]
                         [--visibility public|private] [--repo <owner/name>]
                         [--endpoint <url>] [--dry-run]

build
  --corpus  corpus root, the directory holding docs.json  (default: .)
  --out     output directory                              (default: dist)
  --strict  exit non-zero if the build reported any warning

publish
  --site        the site's slug on arcdoq — the stable key this deploy targets
  --dir         the built directory to send                (default: dist)
  --name        display name, used only when creating      (default: the slug)
  --visibility  public | private, honoured only on create
  --repo        provenance label recorded with the version (e.g. owner/name)
  --endpoint    override the deploy endpoint
  --dry-run     report what would be sent, and send nothing

  The token comes from ARCDOQ_DEPLOY_TOKEN, never a flag — a flag is visible in
  the process table and lands in shell traces, and this credential is long-lived.

Reads docs.json for the nav and the publish set, and docs.config.json for
branding and vocabulary if present. Emits self-contained HTML plus rules.json.`)
  process.exit(COMMANDS.includes(cmd) ? 0 : 1)
}

if (cmd === 'publish') {
  const dir = path.resolve(flag('dir', 'dist'))
  const site = flag('site')

  // Worth having as a first-class mode: the fileset IS the whole payload, so being
  // able to see exactly what would be sent without holding a credential is what
  // makes a wiring problem debuggable from a fork or a local checkout.
  if (argv.includes('--dry-run')) {
    try {
      const { files, skipped, bytes } = readFileset(dir)
      console.log(`${files.length} files, ${(bytes / 1024).toFixed(0)} KB -> (dry run, nothing sent)`)
      for (const f of files) console.log(`  ${f.path}${f.encoding ? '  [binary]' : ''}`)
      if (skipped.length) console.log(`\n${skipped.length} skipped (not servable): ${skipped.join(', ')}`)
      process.exit(0)
    } catch (err) {
      console.error(`arcdoq-docsite: ${err.message}`)
      process.exit(1)
    }
  }

  let result
  try {
    result = await publish({
      dir,
      site,
      endpoint: flag('endpoint', process.env.ARCDOQ_DEPLOY_ENDPOINT || DEFAULT_ENDPOINT),
      token: process.env.ARCDOQ_DEPLOY_TOKEN,
      name: flag('name'),
      visibility: flag('visibility'),
      // GITHUB_REPOSITORY is set by every Actions runner, so the published version
      // records where it came from without the workflow having to say so.
      repo: flag('repo', process.env.GITHUB_REPOSITORY),
    })
  } catch (err) {
    console.error(`arcdoq-docsite: ${err.message}`)
    process.exit(1)
  }

  const { status, body, files, skipped, bytes } = result
  console.log(`${files.length} files, ${(bytes / 1024).toFixed(0)} KB -> ${site}`)
  if (skipped.length) {
    console.log(`  ${skipped.length} skipped (not servable): ${skipped.join(', ')}`)
  }

  const { lines, exitCode } = report(status, body)
  for (const line of lines) console.log(line)
  process.exit(exitCode)
}

const corpus = path.resolve(flag('corpus', '.'))
const out = path.resolve(flag('out', 'dist'))

const configPath = path.join(corpus, 'docs.config.json')
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : {}

let result
try {
  result = build({ corpus, out, config })
} catch (err) {
  console.error(`arcdoq-docsite: ${err.message}`)
  process.exit(1)
}

const { pages, ruleCount, warnings } = result
console.log(`${pages.length} pages, ${ruleCount} rules -> ${path.relative(process.cwd(), out) || '.'}`)
for (const p of pages) {
  console.log(`  ${p.path.padEnd(40)} ${p.rules ? String(p.rules).padStart(3) + ' rules' : ''}`)
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning${warnings.length > 1 ? 's' : ''}:`)
  for (const w of warnings) console.log(`  ! ${w}`)
  // Silence ships a live site with the defect in it. The push model means
  // nobody sees the build output again once CI is green, so --strict is what
  // turns a warning into a red check instead of a quiet regression.
  if (argv.includes('--strict')) process.exit(2)
}
