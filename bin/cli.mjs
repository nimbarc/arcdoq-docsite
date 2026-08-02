#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { build } from '../src/build.mjs'

const argv = process.argv.slice(2)
const cmd = argv[0]
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}

if (cmd !== 'build' || argv.includes('--help') || argv.includes('-h')) {
  console.log(`arcdoq-docsite — build a docs site from a markdown corpus

  arcdoq-docsite build [--corpus <dir>] [--out <dir>] [--strict]

  --corpus  corpus root, the directory holding docs.json  (default: .)
  --out     output directory                              (default: dist)
  --strict  exit non-zero if the build reported any warning

Reads docs.json for the nav and the publish set, and docs.config.json for
branding and vocabulary if present. Emits self-contained HTML plus rules.json.`)
  process.exit(cmd === 'build' ? 0 : 1)
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
