#!/usr/bin/env node
// Usage:
//   npm run release          → patch bump (0.1.0 → 0.1.1)
//   npm run release:minor    → minor bump (0.1.0 → 0.2.0)
//   npm run release:major    → major bump (0.1.0 → 1.0.0)

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

function run(cmd, capture = false) {
  return execSync(cmd, { stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' }).trim()
}

const args = process.argv.slice(2)
const bump = args.includes('--major') ? 'major' : args.includes('--minor') ? 'minor' : 'patch'

// Pre-flight: must be on master with a clean working tree
const branch = run('git rev-parse --abbrev-ref HEAD', true)
if (branch !== 'master') {
  console.error(`Error: releases must be made from master (current branch: ${branch})`)
  process.exit(1)
}

const status = run('git status --porcelain', true)
if (status) {
  console.error('Error: working directory is not clean — commit or stash changes first')
  process.exit(1)
}

// npm version bumps package.json, commits, and creates an annotated tag
run(`npm version ${bump} -m "chore: release v%s"`)

// Push the commit and the new tag together
run('git push origin master --follow-tags')

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
console.log(`\nv${version} pushed — GitHub Actions will build and publish the packages.`)
