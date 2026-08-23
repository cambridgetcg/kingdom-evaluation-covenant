import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { ROOT, prettyCanonicalJson, readJson, sha256Bytes, sha256Json } from '../src/io.mjs'
import { buildSnapshot, expectedReceipts, schemaReceiptIssues } from '../src/evaluation-covenant.mjs'
import { loadSchema, schemaDocumentIssues, validateWithSchema } from '../src/schema-validator.mjs'

const SCHEMA_PATH = join(ROOT, 'schemas', 'v0.1', 'public-snapshot.schema.json')

test('the sole Draft 2020-12 schema is closed, supported and exactly receipt-pinned', () => {
  const schema = loadSchema()
  const bytes = readFileSync(SCHEMA_PATH)
  assert.deepEqual(readdirSync(join(ROOT, 'schemas', 'v0.1')).sort(), ['public-snapshot.schema.json'])
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  assert.equal(schema.$id, 'https://thekingdom.dev/evaluation/schemas/v0.1/public-snapshot.schema.json')
  assert.deepEqual(schemaDocumentIssues(schema), [])
  assert.deepEqual(schemaReceiptIssues(schema, bytes), [])
  assert.equal(sha256Bytes(bytes), expectedReceipts.schemaByte)
  assert.equal(sha256Json(schema), expectedReceipts.schemaCanonical)
})

test('schema generator reproduces the checked-in bytes exactly', () => {
  const generated = execFileSync(process.execPath, ['./scripts/schema-definition.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Pacific/Honolulu', LANG: 'C' },
  })
  assert.equal(generated, readFileSync(SCHEMA_PATH, 'utf8'))
})

test('schema receipt gate distinguishes whitespace drift from semantic drift', () => {
  const schema = loadSchema()
  const whitespaceDrift = Buffer.from(` ${prettyCanonicalJson(schema)}`)
  const whitespaceIssues = schemaReceiptIssues(schema, whitespaceDrift)
  assert.deepEqual(whitespaceIssues, ['schema byte receipt differs from the frozen contract'])

  const semanticDrift = structuredClone(schema)
  semanticDrift.$defs.nullResultPolicy.properties.equivalenceRequiresMarginAndDesign.const = false
  const semanticIssues = schemaReceiptIssues(semanticDrift, Buffer.from(prettyCanonicalJson(semanticDrift)))
  assert.equal(semanticIssues.includes('schema byte receipt differs from the frozen contract'), true)
  assert.equal(semanticIssues.includes('schema canonical receipt differs from the frozen contract'), true)
})

test('closed schema validates the deterministic snapshot and rejects state, result and unknown-field drift', () => {
  const schema = loadSchema()
  const snapshot = buildSnapshot()
  assert.deepEqual(validateWithSchema(snapshot, schema), [])
  const mutations = [
    (value) => { value.counts.designs = 4 },
    (value) => { value.boundaries.approval = true },
    (value) => { value.designs[0].state.sealState = 'SEALED' },
    (value) => { value.designs[0].evaluationQuestions[0].result = 'invented result' },
    (value) => { value.designs[0].measures[0].value = 1 },
    (value) => { value.designs[0].estimands[0].estimate = 0 },
    (value) => { value.designs[0].guardrails[0].threshold = 1 },
    (value) => { value.designs[0].deviations.push({ id: 'deviation:invented' }) },
    (value) => { value.designs[0].preferredOptionId = 'option:invented' },
    (value) => { value.designs[0].nullResultPolicy.equivalenceRequiresMarginAndDesign = false },
  ]
  for (const mutate of mutations) {
    const value = structuredClone(snapshot)
    mutate(value)
    assert.notDeepEqual(validateWithSchema(value, schema), [])
  }
})

test('schema meta-validator fails closed on keyword, type, array and object-contract weakening', () => {
  const base = loadSchema()
  const mutations = [
    (schema) => { delete schema.$defs.design.additionalProperties },
    (schema) => { delete schema.$defs.design.type },
    (schema) => { schema.$defs.design.required.pop() },
    (schema) => { schema.$defs.design.required = 'id' },
    (schema) => { delete schema.properties.designs.items },
    (schema) => { schema.properties.designs.items = true },
    (schema) => { schema.$defs.state.properties.designState.enum = 'DRAFT' },
    (schema) => { schema.$defs.design.properties.measures = {} },
    (schema) => { schema.$defs.measure = {} },
    (schema) => { schema.$defs.measure = false },
    (schema) => { schema.$defs.design.unevaluatedProperties = true },
    (schema) => { schema.$defs.design.$id = 'https://example.invalid/nested' },
    (schema) => { schema.description = { unsafe: true } },
  ]
  for (const mutate of mutations) {
    const schema = structuredClone(base)
    mutate(schema)
    assert.notDeepEqual(schemaDocumentIssues(schema), [])
  }
})

test('schema closes every object, requires every property and constrains every array item', () => {
  const schema = loadSchema()
  const visit = (node, path = '$') => {
    if (node === null || typeof node !== 'object') return
    if (!Array.isArray(node) && node.type === 'object') {
      assert.equal(node.additionalProperties, false, path)
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), path)
    }
    if (!Array.isArray(node) && node.type === 'array') {
      assert.equal(node.items !== undefined && node.items !== true && node.items !== false, true, path)
    }
    for (const [key, child] of Object.entries(node)) visit(child, `${path}/${key}`)
  }
  visit(schema)
})

test('package is private, unlicensed, zero-dependency and supports Node 20+', () => {
  const pkg = readJson(join(ROOT, 'package.json'))
  assert.equal(pkg.private, true)
  assert.equal(pkg.version, '0.1.0')
  assert.equal(pkg.license, 'UNLICENSED')
  assert.equal(pkg.engines.node, '>=20')
  assert.equal(Object.hasOwn(pkg, 'dependencies'), false)
  assert.equal(Object.hasOwn(pkg, 'devDependencies'), false)
})

test('CI actions are commit-pinned and validate Node 20 and 22', () => {
  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'validate.yml'), 'utf8')
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/u)
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/u)
  assert.match(workflow, /node-version: \["20", "22"\]/u)
  assert.match(workflow, /npm run build:check/u)
})
