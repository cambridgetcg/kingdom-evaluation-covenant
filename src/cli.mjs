#!/usr/bin/env node

import { relative } from 'node:path'

import { ROOT, prettyCanonicalJson, sha256Json } from './io.mjs'
import {
  buildSnapshot,
  expectedReceipts,
  validateCheckedInSnapshot,
  writeSnapshot,
} from './evaluation-covenant.mjs'

const HELP = `KINGDOM Evaluation Covenant v0.1 (offline, static, synthetic, read-only)

Usage:
  kingdom-evaluation-covenant validate   validate exact lineage, sources, designs, schema and semantic holds
  kingdom-evaluation-covenant build      deterministically write only public/evaluation-covenants.json
  kingdom-evaluation-covenant check      prove the public artifact matches the deterministic build
  kingdom-evaluation-covenant overview   print a bounded non-result design summary
  kingdom-evaluation-covenant help       print this help
`

function output(value) {
  process.stdout.write(prettyCanonicalJson(value))
}

function requireNoArguments(rest) {
  if (rest.length !== 0) throw new Error(`unexpected argument(s): ${rest.join(' ')}`)
}

function main() {
  const [command = 'help', ...rest] = process.argv.slice(2)
  if (command === 'help' || command === '--help' || command === '-h') {
    requireNoArguments(rest)
    process.stdout.write(HELP)
    return
  }
  requireNoArguments(rest)

  if (command === 'validate') {
    const snapshot = buildSnapshot()
    output({
      state: 'valid-static-synthetic-evaluation-design',
      asOf: snapshot.asOf,
      nextReviewDue: snapshot.freshness.nextReviewDue,
      covenantState: snapshot.covenantState,
      counts: snapshot.counts,
      snapshotCanonicalReceipt: sha256Json(snapshot),
      transformationSnapshotByteReceipt: expectedReceipts.transformationByte,
      transformationSnapshotCanonicalReceipt: expectedReceipts.transformationCanonical,
      governmentSnapshotByteReceipt: expectedReceipts.governmentByte,
      governmentSnapshotCanonicalReceipt: expectedReceipts.governmentCanonical,
      humanReviewCompleted: snapshot.authorship.humanReviewCompleted,
      evaluationRun: false,
      evaluationResult: false,
      externalEffects: false,
      networkUsed: false,
    })
    return
  }

  if (command === 'build') {
    const built = writeSnapshot()
    output({
      state: 'built-deterministic-static-synthetic-evaluation-design',
      path: relative(ROOT, built.path),
      bytes: built.bytes,
      counts: built.snapshot.counts,
      snapshotByteReceipt: built.byteReceipt,
      snapshotCanonicalReceipt: built.canonicalReceipt,
      networkUsed: false,
    })
    return
  }

  if (command === 'check') {
    const checked = validateCheckedInSnapshot()
    if (!checked.current) throw new Error('public/evaluation-covenants.json is absent or differs from the deterministic build')
    output({
      state: 'matches-deterministic-static-synthetic-evaluation-design',
      asOf: checked.snapshot.asOf,
      nextReviewDue: checked.snapshot.freshness.nextReviewDue,
      path: 'public/evaluation-covenants.json',
      bytes: checked.bytes,
      counts: checked.snapshot.counts,
      snapshotByteReceipt: checked.byteReceipt,
      snapshotCanonicalReceipt: checked.canonicalReceipt,
      networkUsed: false,
    })
    return
  }

  if (command === 'overview') {
    const snapshot = buildSnapshot()
    output({
      product: 'Evaluation Covenant',
      discoveryName: 'Evaluation Design Engine',
      phase: snapshot.phase.id,
      asOf: snapshot.asOf,
      nextReviewDue: snapshot.freshness.nextReviewDue,
      state: snapshot.covenantState,
      designs: snapshot.designs.map((design) => ({
        id: design.id,
        title: design.title,
        dossierId: design.transformationBinding.dossierId,
        questions: design.evaluationQuestions.length,
        comparators: design.comparators.length,
        estimands: design.estimands.length,
        measures: design.measures.length,
        guardrails: design.guardrails.length,
        humanReviewCompleted: design.humanGates.every((gate) => gate.completed),
      })),
      trialChamberCompatibility: snapshot.trialChamberSeparation.trialChamberCompatibility,
      dataCollection: false,
      participantRecruitment: false,
      evaluationRun: false,
      evaluationResult: false,
      optionSelection: false,
      authority: false,
      runtimeNetwork: false,
    })
    return
  }

  throw new Error(`unknown command ${JSON.stringify(command)}\n\n${HELP}`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error?.stack ?? error}\n`)
  process.exitCode = 1
}
