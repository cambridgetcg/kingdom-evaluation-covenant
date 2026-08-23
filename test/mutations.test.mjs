import assert from 'node:assert/strict'
import test from 'node:test'

import { sha256Json } from '../src/io.mjs'
import {
  buildSnapshot,
  expandedDesignIssues,
  loadInputs,
  semanticIssues,
} from '../src/evaluation-covenant.mjs'
import { loadSchema, validateWithSchema } from '../src/schema-validator.mjs'

const baseInputs = loadInputs()

function mutatedInputs(mutate) {
  const inputs = structuredClone(baseInputs)
  mutate(inputs)
  return inputs
}

function expectInputIssue(mutate, pattern) {
  const issues = semanticIssues(mutatedInputs(mutate))
  assert.equal(issues.some((issue) => pattern.test(issue)), true, issues.join('\n'))
}

function resealDesign(design) {
  const { canonicalReceipt, ...target } = design
  design.canonicalReceipt = sha256Json(target)
}

function expectExpandedIssue(mutate, pattern) {
  const design = structuredClone(buildSnapshot().designs[0])
  mutate(design)
  resealDesign(design)
  const issues = expandedDesignIssues(design)
  assert.equal(issues.some((issue) => pattern.test(issue)), true, issues.join('\n'))
  assert.notDeepEqual(validateWithSchema(design, loadSchema().$defs.design), [])
}

test('identity, authority, route, Trial separation and related-resource drift are rejected', () => {
  const cases = [
    [(inputs) => { inputs.config.covenantState.sealState = 'SEALED' }, /product identity, phase or covenant state mismatch/u],
    [(inputs) => { inputs.config.boundaries.approval = true }, /all boundaries must be exact false/u],
    [(inputs) => { inputs.config.urls.canonical = 'https://example.invalid/result.json' }, /exact five-route family/u],
    [(inputs) => { inputs.config.trialChamberSeparation.trialChamberPlanRefs.push('trial:invented') }, /Trial Chamber ownership separation/u],
    [(inputs) => { inputs.config.relatedResources[0].evidence = true }, /related resources must remain navigation-only/u],
    [(inputs) => { inputs.config.relatedResources.push({ id: 'related:reality-influence-map' }) }, /Reality Influence and J-space/u],
    [(inputs) => { inputs.designs[0].purpose += ' J-space evidence.' }, /Reality Influence and J-space/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('method source URLs, bodies, generic-host trust, outcome, estimand, result and authority claims are rejected', () => {
  const fields = ['genericOfficialHostIsEvidence', 'supportsDossierOutcome', 'supportsEstimand', 'supportsResult', 'supportsAuthority']
  expectInputIssue((inputs) => { inputs.sources[0].url = 'https://gov.uk.example.invalid/method' }, /source URL allowlist mismatch|outside the exact HTTPS allowlist/u)
  expectInputIssue((inputs) => { inputs.sources[0].bodyReceipt = 'sha256:0000000000000000000000000000000000000000000000000000000000000000' }, /method-source firewall mismatch/u)
  expectInputIssue((inputs) => { inputs.sources[0].bodyRetained = true }, /method-source firewall mismatch/u)
  expectInputIssue((inputs) => { inputs.sources[0].rightsOrReuseInferred = true }, /method-source firewall mismatch/u)
  for (const field of fields) expectInputIssue((inputs) => { inputs.sources[0][field] = true }, /method-source firewall mismatch/u)
})

test('frozen bytes, dossier order, proposition, option, node, edge and human-gate binding drift are rejected', () => {
  const cases = [
    [(inputs) => { inputs.transformationBytes[0] ^= 1 }, /Transformation snapshot byte receipt mismatch/u],
    [(inputs) => { inputs.transformation.dossiers.reverse() }, /dossier order or inventory mismatch/u],
    [(inputs) => { inputs.config.lineage.dossierBindings[0].propositionCanonicalReceipt = 'sha256:0000000000000000000000000000000000000000000000000000000000000000' }, /proposition receipt mismatch/u],
    [(inputs) => { inputs.designs[0].transformationBinding.optionIds.reverse() }, /exact Transformation binding mismatch/u],
    [(inputs) => { inputs.designs[0].transformationBinding.assumptionNodeIds[0] = 'causal:invented-assumption' }, /exact Transformation binding mismatch/u],
    [(inputs) => { inputs.designs[0].transformationBinding.negativePathwayNodeIds[0] = 'causal:invented-negative' }, /exact Transformation binding mismatch/u],
    [(inputs) => { inputs.designs[0].transformationBinding.evaluationNeedNodeId = 'causal:invented-evaluation' }, /exact Transformation binding mismatch/u],
    [(inputs) => { inputs.designs[0].transformationBinding.humanGateIds.reverse() }, /exact Transformation binding mismatch/u],
    [(inputs) => { const edge = inputs.designs[0].theoryBinding.optionToOutputEdges[0]; [edge.fromId, edge.toId] = [edge.toId, edge.fromId] }, /edge direction mismatch/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('question type, outcome, measure and affected-party cross-reference drift is rejected', () => {
  const cases = [
    [(inputs) => { inputs.designs[0].evaluationQuestions[0].type = 'impact' }, /exactly one process, impact and economic question/u],
    [(inputs) => { inputs.designs[0].evaluationQuestions[0].transformationOutcomeIds = ['outcome:invented'] }, /exact outcome coverage mismatch/u],
    [(inputs) => { inputs.designs[0].evaluationQuestions[0].measureIds = ['measure:invented'] }, /measure reference mismatch/u],
    [(inputs) => { inputs.designs[0].evaluationQuestions[0].affectedPartyClassIds = ['affected:invented'] }, /affected-party reference mismatch/u],
    [(inputs) => {
      const design = inputs.designs[0]
      design.evaluationQuestions.find((question) => question.type === 'impact').measureIds = [design.measures.find((measure) => measure.role === 'process').id]
    }, /impact question must use outcome measures only/u],
    [(inputs) => { inputs.designs[0].evaluationQuestions[0].result = 'invented' }, /unanswered, resultless and non-authoritative/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('comparator preference, assignment, ranking and theory promotion are rejected', () => {
  const cases = [
    [(inputs) => { inputs.designs[0].comparators[0].selected = true }, /comparators must remain unselected/u],
    [(inputs) => { inputs.designs[0].comparators[1].assigned = true }, /comparators must remain unselected/u],
    [(inputs) => { inputs.designs[0].comparators[2].implemented = true }, /comparators must remain unselected/u],
    [(inputs) => { inputs.designs[0].comparators[0].role = 'candidate-alternative' }, /exact BAU and alternative comparator inventory/u],
    [(inputs) => { inputs.designs[0].comparators[0].rank = 1 }, /designs differ from exact reviewed canonical receipt/u],
    [(inputs) => { inputs.designs[0].theoryBinding.claimsCausalTruth = true }, /theory binding or causal-truth boundary/u],
    [(inputs) => { inputs.designs[0].theoryBinding.tested = true }, /theory binding or causal-truth boundary/u],
    [(inputs) => { inputs.designs[0].theoryBinding.theoryValidated = true }, /theory binding or causal-truth boundary/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('measure values, targets, frozen definitions, sources, gaming hazards and usage drift are rejected', () => {
  const cases = [
    [(inputs) => { inputs.designs[0].measures[0].value = 1 }, /measure state, target, value, definition or source firewall/u],
    [(inputs) => { inputs.designs[0].measures[0].targetStatus = 'TARGET' }, /measure state, target, value, definition or source firewall/u],
    [(inputs) => { inputs.designs[0].measures[0].definitionFrozen = true }, /measure state, target, value, definition or source firewall/u],
    [(inputs) => { inputs.designs[0].measures[0].sourceRefs = ['source:magenta-book-2026'] }, /measure state, target, value, definition or source firewall/u],
    [(inputs) => { inputs.designs[0].measures.find((measure) => measure.role === 'outcome').gamingHazardIds = [] }, /outcome measure requires gaming hazards and guardrails/u],
    [(inputs) => { inputs.designs[0].measures.find((measure) => measure.role === 'outcome').guardrailIds = [] }, /outcome measure requires gaming hazards and guardrails/u],
    [(inputs) => {
      const design = inputs.designs[0]
      const unused = design.measures.at(-1).id
      for (const question of design.evaluationQuestions) question.measureIds = question.measureIds.filter((id) => id !== unused)
    }, /every measure must be used/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('malformed, promoted or incomplete estimands are rejected', () => {
  const cases = [
    [(inputs) => { inputs.designs[0].estimands.pop() }, /each alternative and outcome-measure pair/u],
    [(inputs) => { inputs.designs[0].estimands[0].treatmentComparatorId = inputs.designs[0].estimands[0].referenceComparatorId }, /malformed or promoted estimand/u],
    [(inputs) => { inputs.designs[0].estimands[0].impactQuestionId = inputs.designs[0].evaluationQuestions.find((question) => question.type === 'process').id }, /malformed or promoted estimand/u],
    [(inputs) => { inputs.designs[0].estimands[0].outcomeMeasureId = inputs.designs[0].measures.find((measure) => measure.role === 'process').id }, /malformed or promoted estimand/u],
    [(inputs) => { inputs.designs[0].estimands[0].estimate = 0 }, /malformed or promoted estimand/u],
    [(inputs) => { inputs.designs[0].estimands[0].uncertainty = 'invented' }, /malformed or promoted estimand/u],
    [(inputs) => { inputs.designs[0].estimands[0].causalStatus = 'CLAIMED' }, /malformed or promoted estimand/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('guardrail threshold, result, stop and negative-pathway coverage drift is rejected', () => {
  const cases = [
    [(inputs) => { inputs.designs[0].guardrails[0].threshold = 0 }, /guardrail state or measure reference mismatch/u],
    [(inputs) => { inputs.designs[0].guardrails[0].result = false }, /guardrail state or measure reference mismatch/u],
    [(inputs) => { inputs.designs[0].guardrails[0].stopsInterpretation = false }, /guardrail state or measure reference mismatch/u],
    [(inputs) => { inputs.designs[0].guardrails[0].protectsAgainst = [] }, /every and only bound negative pathway/u],
    [(inputs) => { inputs.designs[0].guardrails[0].linkedMeasureIds = ['measure:invented'] }, /guardrail state or measure reference mismatch/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('territory, accessibility, digital-exclusion, language and affected-party state drift is rejected', () => {
  const cases = [
    [(inputs) => { inputs.designs[0].distribution.territories.pop() }, /distribution territory or affected-party coverage/u],
    [(inputs) => { inputs.designs[0].distribution.affectedPartyClassIds.pop() }, /distribution territory or affected-party coverage/u],
    [(inputs) => { inputs.designs[0].distribution.dimensions = ['prior-familiarity'] }, /distribution must preserve access, digital-exclusion and language/u],
    [(inputs) => { inputs.designs[0].affectedPartyClasses[0].representationState = 'REPRESENTED' }, /affected-party Phase-0 state mismatch/u],
    [(inputs) => { inputs.designs[0].affectedPartyClasses[0].personalRecords = true }, /affected-party Phase-0 state mismatch/u],
    [(inputs) => { inputs.designs[0].affectedPartyClasses[0].email = 'person@example.org' }, /possible personal identifier|personal-record-shaped key/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('automatic stops, completed gates and Trial-plan fields are rejected', () => {
  const cases = [
    [(inputs) => { inputs.designs[0].stopRules[0].automatic = true }, /stop rules cannot be observed, automatic or system-authoritative/u],
    [(inputs) => { inputs.designs[0].stopRules[0].observed = true }, /stop rules cannot be observed, automatic or system-authoritative/u],
    [(inputs) => { inputs.designs[0].humanGates[0].completed = true }, /exact incomplete outside-system human gate inventory/u],
    [(inputs) => { inputs.designs[0].execution = { command: 'run' } }, /Trial Chamber plan field is forbidden/u],
    [(inputs) => { inputs.designs[0].fixtures = [] }, /Trial Chamber plan field is forbidden/u],
  ]
  for (const [mutate, pattern] of cases) expectInputIssue(mutate, pattern)
})

test('expanded Phase-0 state, result, value, amount, threshold, deviation and personal-record promotion is rejected', () => {
  const cases = [
    [(design) => { design.state.sealState = 'SEALED' }, /expanded state/u],
    [(design) => { design.state.registrationState = 'REGISTERED' }, /expanded state/u],
    [(design) => { design.state.runState = 'RUN' }, /expanded state/u],
    [(design) => { design.state.resultState = 'RESULT' }, /expanded state/u],
    [(design) => { design.state.approvalState = 'APPROVED' }, /expanded state/u],
    [(design) => { design.processEvaluationPlan.result = 'invented' }, /plan result or economic amount/u],
    [(design) => { design.impactEvaluationPlan.result = 'invented' }, /plan result or economic amount/u],
    [(design) => { design.economicEvaluationPlan.amounts.costs = 1 }, /plan result or economic amount/u],
    [(design) => { design.deviations.push({ id: 'deviation:invented' }) }, /deviations must remain exactly empty/u],
    [(design) => { design.dataPlan.futureEmail = 'person@example.org' }, /possible personal identifier|personal-record-shaped key/u],
  ]
  for (const [mutate, pattern] of cases) expectExpandedIssue(mutate, pattern)
})

test('expanded evaluation type, distribution, missingness, data, privacy and participant promotion is rejected', () => {
  const cases = [
    [(design) => { design.processEvaluationPlan.canEstablishImpact = true }, /evaluation-type claim firewall/u],
    [(design) => { design.impactEvaluationPlan.canClaimAttribution = true }, /evaluation-type claim firewall/u],
    [(design) => { design.economicEvaluationPlan.valueForMoneyConclusion = true }, /evaluation-type claim firewall/u],
    [(design) => { design.economicEvaluationPlan.spendingAuthority = true }, /evaluation-type claim firewall/u],
    [(design) => { design.distributionPlan.aggregateCanOverrideHarm = true }, /distribution or missingness firewall/u],
    [(design) => { design.distributionPlan.weightedCanReplaceUnweighted = true }, /distribution or missingness firewall/u],
    [(design) => { design.missingnessPlan.missingNotZero = false }, /distribution or missingness firewall/u],
    [(design) => { design.missingnessPlan.missingNotNoEffect = false }, /distribution or missingness firewall/u],
    [(design) => { design.dataPlan.dataCollection = true }, /data or participant records must remain absent/u],
    [(design) => { design.dataPlan.datasetRefs.push('dataset:invented') }, /data or participant records must remain absent/u],
    [(design) => { design.privacyEthicsPlan.personalData = true }, /privacy\/ethics Phase-0 boundary/u],
    [(design) => { design.privacyEthicsPlan.dpiaState = 'COMPLETED' }, /privacy\/ethics Phase-0 boundary/u],
    [(design) => { design.affectedPartyPlan.participantRecords.push({ id: 'participant:invented' }) }, /data or participant records must remain absent/u],
    [(design) => { design.affectedPartyPlan.participationIsRepresentation = true }, /affected-party participation and representation/u],
    [(design) => { design.qualityAssurancePlan.assurerRole = design.qualityAssurancePlan.analystRole }, /quality-assurance contract/u],
  ]
  for (const [mutate, pattern] of cases) expectExpandedIssue(mutate, pattern)
})

test('expanded publication, withholding, null, equivalence and gate promotion is rejected', () => {
  const cases = [
    [(design) => { design.publicationPlan.resultsExist = true }, /publication or governed-withholding/u],
    [(design) => { design.publicationPlan.negativeAndNullResultsInScope = false }, /publication or governed-withholding/u],
    [(design) => { design.publicationPlan.withholdingPolicy.outcomeDirectionIsAllowedGround = true }, /publication or governed-withholding/u],
    [(design) => { design.publicationPlan.withholdingPolicy.reasonAndScopeMustBeRecorded = false }, /publication or governed-withholding/u],
    [(design) => { design.publicationPlan.withholdingPolicy.minimumNecessaryWithholding = false }, /publication or governed-withholding/u],
    [(design) => { design.publicationPlan.withholdingPolicy.redactionAggregationOrPartialPublicationMustBeConsidered = false }, /publication or governed-withholding/u],
    [(design) => { design.nullResultPolicy.outcomeBasedSuppressionAllowed = true }, /null-result and outcome-neutral transparency/u],
    [(design) => { design.nullResultPolicy.negativeOrNullOutcomeAloneCannotJustifySuppression = false }, /null-result and outcome-neutral transparency/u],
    [(design) => { design.nullResultPolicy.noResultIsNullResult = true }, /null-result and outcome-neutral transparency/u],
    [(design) => { design.nullResultPolicy.nullIsNoEffect = true }, /null-result and outcome-neutral transparency/u],
    [(design) => { design.nullResultPolicy.nullIsFailure = true }, /null-result and outcome-neutral transparency/u],
    [(design) => { design.nullResultPolicy.nullIsSuccess = true }, /null-result and outcome-neutral transparency/u],
    [(design) => { design.nullResultPolicy.equivalenceRequiresMarginAndDesign = false }, /null-result and outcome-neutral transparency/u],
    [(design) => { design.humanGates[0].completed = true }, /human gates must remain|required, incomplete|human gate inventory/u],
  ]
  for (const [mutate, pattern] of cases) expectExpandedIssue(mutate, pattern)
})

test('expanded cross-field references, Trial fields and inert-content threat boundaries remain enforced after receipt recomputation', () => {
  const cases = [
    [(design) => { design.estimands.pop() }, /each alternative and outcome-measure pair/u],
    [(design) => { design.comparators[0].selected = true }, /comparators must remain unselected/u],
    [(design) => { design.measures.find((measure) => measure.role === 'outcome').targetStatus = 'TARGET' }, /measure state, target, value/u],
    [(design) => { design.guardrails[0].protectsAgainst = [] }, /every and only bound negative pathway/u],
    [(design) => { design.execution = { command: 'run' } }, /Trial Chamber plan field is forbidden/u],
    [(design) => { design.threatModel.hostilePromptTextInert = false }, /inert-content threat model/u],
  ]
  for (const [mutate, pattern] of cases) expectExpandedIssue(mutate, pattern)
})
