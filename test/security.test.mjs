import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'

import { ROOT, canonicalJson, parseJsonBytes } from '../src/io.mjs'
import { buildSnapshot, expandedDesignIssues } from '../src/evaluation-covenant.mjs'

function filesUnder(path) {
  const output = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = join(current, entry.name)
      const repositoryPath = relative(ROOT, child)
      if (repositoryPath === '.git') continue
      const status = lstatSync(child)
      if (status.isSymbolicLink()) throw new Error(`symbolic link is forbidden: ${repositoryPath}`)
      if (entry.name === '.git') throw new Error(`nested Git metadata is forbidden: ${repositoryPath}`)
      if (status.isDirectory()) visit(child)
      else if (status.isFile()) output.push(child)
      else throw new Error(`non-regular repository entry is forbidden: ${repositoryPath}`)
    }
  }
  visit(path)
  return output.sort()
}

test('build is offline and deterministic even when ambient network APIs are hostile', () => {
  const previousFetch = globalThis.fetch
  const previousWebSocket = globalThis.WebSocket
  globalThis.fetch = () => { throw new Error('network use forbidden') }
  globalThis.WebSocket = class { constructor() { throw new Error('network use forbidden') } }
  try {
    const first = buildSnapshot()
    const second = buildSnapshot()
    assert.equal(canonicalJson(first), canonicalJson(second))
    assert.equal(first.buildProvenance.networkUsed, false)
    assert.equal(first.buildProvenance.clockRead, false)
  } finally {
    if (previousFetch === undefined) delete globalThis.fetch
    else globalThis.fetch = previousFetch
    if (previousWebSocket === undefined) delete globalThis.WebSocket
    else globalThis.WebSocket = previousWebSocket
  }
})

test('producer source imports no network, process-launch or dynamic-code capability', () => {
  const productFiles = [...filesUnder(join(ROOT, 'src')), ...filesUnder(join(ROOT, 'scripts'))]
  const text = productFiles.map((path) => readFileSync(path, 'utf8')).join('\n')
  for (const pattern of [
    /node:(?:http|https|http2|net|tls|dns|dgram|child_process|cluster|worker_threads)/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\bEventSource\b/u,
    /\beval\s*\(/u,
    /\bnew\s+Function\b/u,
    /\b(?:spawn|execFile|execFileSync|execSync)\s*\(/u,
  ]) assert.doesNotMatch(text, pattern)
})

test('CLI exposes only bounded read-only inspection plus the fixed deterministic build verb', () => {
  for (const command of ['validate', 'check', 'overview']) {
    const stdout = execFileSync(process.execPath, ['./src/cli.mjs', command], {
      cwd: ROOT,
      env: { ...process.env, TZ: 'Pacific/Kiritimati', LANG: 'C' },
    })
    const result = parseJsonBytes(stdout, `CLI ${command}`)
    assert.equal(result.networkUsed ?? result.runtimeNetwork, false)
  }
  for (const args of [['serve'], ['run'], ['validate', 'extra'], ['build', '--output', '/tmp/escape']]) {
    const result = spawnSync(process.execPath, ['./src/cli.mjs', ...args], { cwd: ROOT, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /unknown command|unexpected argument/u)
  }
})

test('expanded output contains no personal-shaped record after the full-output scan', () => {
  const snapshot = buildSnapshot()
  for (const design of snapshot.designs) assert.deepEqual(expandedDesignIssues(design), [])
  const text = canonicalJson(snapshot)
  assert.doesNotMatch(text, /mailto:/iu)
  assert.doesNotMatch(text, /\b[A-Z]{2}\d{6}[A-D]\b/u)
  assert.doesNotMatch(text, /\b\d{10}\b/u)
  assert.doesNotMatch(text, /"(?:email|nino|utr|postcode|testimony|handle|caseId|contact)"\s*:/iu)
})

test('forbidden operational and Trial fields occur only as exact false boundaries or negative names', () => {
  const snapshot = buildSnapshot()
  const forbidden = new Set(snapshot.trialChamberSeparation.forbiddenTrialPlanFields)
  const visit = (value, path = '$') => {
    if (value === null || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}/${index}`))
      return
    }
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.has(key)) {
        assert.equal(path.endsWith('/boundaries'), true, `${path}/${key}`)
        assert.equal(child, false, `${path}/${key}`)
      }
      visit(child, `${path}/${key}`)
    }
  }
  visit(snapshot)
  assert.equal(snapshot.boundaries.mcpExposure, false)
  assert.equal(snapshot.boundaries.publicForm, false)
  assert.equal(snapshot.boundaries.accountAccess, false)
  assert.equal(snapshot.boundaries.automatedAction, false)
  assert.equal(snapshot.boundaries.submission, false)
})

test('all source URLs are exact HTTPS allowlisted links and never runtime redirects', () => {
  for (const source of buildSnapshot().sources) {
    const url = new URL(source.url)
    assert.equal(url.protocol, 'https:')
    assert.equal(['www.gov.uk', 'ico.org.uk'].includes(url.hostname), true)
    assert.equal(url.username, '')
    assert.equal(url.password, '')
    assert.equal(url.port, '')
    assert.equal(url.hash, '')
    assert.equal(source.bodyRetained, false)
    assert.equal(source.bodyReceipt, null)
  }
})

test('repository content has no symlink, device, socket, FIFO or nested Git metadata', () => {
  const rootGit = join(ROOT, '.git')
  if (existsSync(rootGit)) {
    const status = lstatSync(rootGit)
    assert.equal(status.isSymbolicLink(), false, '.git')
    assert.equal(status.isDirectory(), true, '.git')
  }
  for (const path of filesUnder(ROOT)) {
    const status = lstatSync(path)
    assert.equal(status.isSymbolicLink(), false, relative(ROOT, path))
    assert.equal(status.isFile(), true, relative(ROOT, path))
  }
})

test('repository inventory is explicit and contains no package lock or hidden runtime state', () => {
  const expected = [
    '.github/workflows/validate.yml',
    'AGENTS.md',
    'EVALUATION-COVENANT-v0.1.md',
    'NOTICE.md',
    'README.md',
    'data/config.json',
    'data/designs.json',
    'data/sources.json',
    'package.json',
    'public/evaluation-covenants.json',
    'schemas/v0.1/public-snapshot.schema.json',
    'scripts/schema-definition.mjs',
    'src/cli.mjs',
    'src/evaluation-covenant.mjs',
    'src/io.mjs',
    'src/schema-validator.mjs',
    'test/contracts.test.mjs',
    'test/io.test.mjs',
    'test/mutations.test.mjs',
    'test/schema.test.mjs',
    'test/security.test.mjs',
    'vendor/government-engine/government-2026-08-21.json',
    'vendor/transformation-engine/UK-GOVERNMENT-TRANSFORMATION-ENGINE-v0.1.md',
    'vendor/transformation-engine/public-snapshot.schema.json',
    'vendor/transformation-engine/transformations-2026-08-21.json',
  ].sort()
  assert.deepEqual(filesUnder(ROOT).map((path) => relative(ROOT, path)).sort(), expected)
})
