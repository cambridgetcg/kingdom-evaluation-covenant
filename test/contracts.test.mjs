import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  PUBLIC_SNAPSHOT,
  ROOT,
  canonicalJson,
  prettyCanonicalJson,
  readJson,
  sha256Bytes,
  sha256Json,
} from '../src/io.mjs'
import { buildSnapshot, expectedReceipts, validateCheckedInSnapshot } from '../src/evaluation-covenant.mjs'

const SNAPSHOT_BYTE_RECEIPT = 'sha256:674197eab23bb70501bcf50aa4b0a6f09b25e89829e5e7e706a98e4a9fcc2328'
const SNAPSHOT_CANONICAL_RECEIPT = 'sha256:04a0c4a249e0eb02bf07643ae5c609488c6de1cd5288a7ed0056469f63a6a3f9'
const EXACT_STATE = {
  adoptionEffect: 'NONE', approvalState: 'NOT-APPROVED', designState: 'DRAFT',
  registrationState: 'UNREGISTERED', resultState: 'NO-RESULT', runState: 'NO-RUN',
  sealState: 'UNSEALED', useAuthorityEffect: 'NONE',
}
const EXPECTED = new Map([
  ['design:four-nation-information-orientation', {
    dossier: 'dossier:four-nation-public-service-information',
    dossierReceipt: 'sha256:251d9dc081d182ff7d0a843c7139f882f3b76551591f99253cdd63877cc47e64',
    propositionReceipt: 'sha256:f86be1c08e235fc20ea9727356ca1676bd8563d092de987ff901ba2d63fa0a84',
    designReceipt: 'sha256:30aa6149fa295190377ba1743bb5ad2963764a8981c944c4e6967661acb09707',
    estimands: 2,
  }],
  ['design:hmrc-notice-route-orientation', {
    dossier: 'dossier:hmrc-decision-notice-explanatory-content',
    dossierReceipt: 'sha256:f891d80e614160f64061231d592af567e0800a55a232e01bbcddaf406f17ff29',
    propositionReceipt: 'sha256:aec1cdc5a5f0b258667476a24b707fe48ee8fea8aeb613d441f38b3d6130b850',
    designReceipt: 'sha256:08dfc5a328adfa2b13d11d01ff63f1c96908d4d81c62b8ffb485f89ab538baf1',
    estimands: 4,
  }],
  ['design:public-money-category-orientation', {
    dossier: 'dossier:public-money-transparency-information-service',
    dossierReceipt: 'sha256:7889a27ad2dd1f51404ad128dcbc5f4ebe63cca11d5a42b41d198a95d70b83bd',
    propositionReceipt: 'sha256:dc4181b8179f15a3b33541c57c97e399f41bee23fb335efee9b2342a9f22e538',
    designReceipt: 'sha256:9cc9e2eea2d4972226baae06961a3f4075337bd3ac9cc3f0bb74797ec6b6fa5e',
    estimands: 4,
  }],
])

test('product identity is exact and every authority/action boundary is false', () => {
  const snapshot = buildSnapshot()
  assert.equal(snapshot.schema, 'kingdom.evaluation-covenant-public-snapshot/0.1')
  assert.equal(snapshot.contractVersion, '0.1.0')
  assert.equal(snapshot.title, 'KINGDOM Evaluation Covenant: Synthetic Transformation Designs')
  assert.equal(canonicalJson(snapshot.phase), canonicalJson({ id: '0-static-synthetic-design', scope: 'evaluation-design-only' }))
  assert.equal(canonicalJson(snapshot.covenantState), canonicalJson(EXACT_STATE))
  assert.equal(Object.keys(snapshot.boundaries).length, 59)
  assert.equal(Object.values(snapshot.boundaries).every((value) => value === false), true)
  assert.equal(snapshot.authorship.origin, 'maintainer-authorized-assisted-publication')
  assert.equal(snapshot.authorship.compiledBy, 'codex-assisted-publication')
  assert.equal(snapshot.authorship.humanDirectionRecorded, true)
  assert.equal(snapshot.authorship.exactTextHumanReviewed, false)
  assert.equal(snapshot.authorship.humanReviewRequired, true)
  assert.equal(snapshot.authorship.humanReviewCompleted, false)
})

test('lineage binds exact frozen Transformation bytes and Government transitive receipts without evidence use', () => {
  const lineage = buildSnapshot().lineage
  assert.equal(lineage.mode, 'exact-synthetic-design-context-only')
  assert.equal(lineage.useAsEvidence, false)
  assert.equal(lineage.transformationSnapshot.bytes, 83_915)
  assert.equal(lineage.transformationSnapshot.byteReceipt, expectedReceipts.transformationByte)
  assert.equal(lineage.transformationSnapshot.canonicalReceipt, expectedReceipts.transformationCanonical)
  assert.equal(lineage.transformationSchema.bytes, 47_800)
  assert.equal(lineage.transformationSchema.byteReceipt, expectedReceipts.transformationSchemaByte)
  assert.equal(lineage.transformationGuide.bytes, 6_770)
  assert.equal(lineage.transformationGuide.byteReceipt, expectedReceipts.transformationGuideByte)
  assert.equal(lineage.baseGovernment.contextMode, 'transitive-validation-context-only')
  assert.equal(lineage.baseGovernment.useAsEvidence, false)
  assert.equal(lineage.baseGovernment.bytes, 196_005)
  assert.equal(lineage.baseGovernment.byteReceipt, expectedReceipts.governmentByte)
  assert.equal(lineage.baseGovernment.canonicalReceipt, expectedReceipts.governmentCanonical)
})

test('three designs bind one-to-one exact dossiers, proposition receipts and round-trip design receipts', () => {
  const snapshot = buildSnapshot()
  assert.deepEqual(snapshot.designs.map((design) => design.id), [...EXPECTED.keys()])
  for (const design of snapshot.designs) {
    const expected = EXPECTED.get(design.id)
    assert.equal(design.synthetic, true)
    assert.equal(canonicalJson(design.state), canonicalJson(EXACT_STATE))
    assert.equal(design.transformationBinding.dossierId, expected.dossier)
    assert.equal(design.transformationBinding.dossierCanonicalReceipt, expected.dossierReceipt)
    assert.equal(design.transformationBinding.propositionCanonicalReceipt, expected.propositionReceipt)
    assert.equal(design.transformationBinding.useAsEvidence, false)
    const { canonicalReceipt, ...receiptTarget } = design
    assert.equal(canonicalReceipt, sha256Json(receiptTarget))
    assert.equal(canonicalReceipt, expected.designReceipt)
    const binding = snapshot.lineage.dossierBindings.find((entry) => entry.dossierId === expected.dossier)
    assert.equal(binding.propositionCanonicalReceipt, expected.propositionReceipt)
    assert.equal(binding.dossierCanonicalReceipt, expected.dossierReceipt)
    assert.deepEqual(design.transformationBinding.optionIds, binding.optionIds)
    assert.deepEqual(design.transformationBinding.assumptionNodeIds, binding.assumptionNodeIds)
    assert.deepEqual(design.transformationBinding.negativePathwayNodeIds, binding.negativePathwayNodeIds)
    assert.equal(design.transformationBinding.evaluationNeedNodeId, binding.evaluationNeedNodeId)
    assert.equal(design.transformationBinding.transformationOutcomeId, binding.outcomeId)
    assert.deepEqual(design.transformationBinding.humanGateIds, binding.gateIds)
  }
})

test('questions remain unanswered and process, impact and economic types stay separated', () => {
  for (const design of buildSnapshot().designs) {
    assert.deepEqual(design.evaluationQuestions.map((question) => question.type).sort(), ['economic', 'impact', 'process'])
    assert.equal(design.evaluationQuestions.every((question) => question.answerState === 'NOT-ANSWERED'
      && question.result === null && question.authorityEffect === 'NONE'), true)
    const measures = new Map(design.measures.map((measure) => [measure.id, measure]))
    for (const question of design.evaluationQuestions) {
      const roles = new Set(question.measureIds.map((id) => measures.get(id).role))
      if (question.type === 'process') assert.equal([...roles].every((role) => ['process', 'qualitative'].includes(role)), true)
      if (question.type === 'impact') assert.deepEqual([...roles], ['outcome'])
      if (question.type === 'economic') assert.deepEqual([...roles], ['economic'])
      assert.deepEqual(question.transformationOutcomeIds, [design.transformationBinding.transformationOutcomeId])
    }
    assert.equal(canonicalJson(design.evaluationTypeContract), canonicalJson({
      distinctQuestionTypes: ['economic', 'impact', 'process'], economicCannotSatisfyImpact: true,
      impactCannotEstablishValueForMoney: true, oneTypeCannotSatisfyAnother: true,
      processCannotEstablishCausality: true, processCannotEstablishImpact: true,
    }))
  }
})

test('theory references preserve upstream directions without causal truth or copied narrative', () => {
  for (const design of buildSnapshot().designs) {
    const theory = design.theoryBinding
    assert.equal(theory.desiredOutcomeId, design.transformationBinding.transformationOutcomeId)
    assert.equal(theory.evaluationNeedNodeId, design.transformationBinding.evaluationNeedNodeId)
    assert.deepEqual(theory.assumptionNodeIds, design.transformationBinding.assumptionNodeIds)
    assert.deepEqual(theory.negativePathwayNodeIds, design.transformationBinding.negativePathwayNodeIds)
    assert.equal(theory.optionToOutputEdges.length, 3)
    assert.equal(theory.claimsCausalTruth, false)
    assert.equal(theory.tested, false)
    assert.equal(theory.theoryValidated, false)
    assert.equal(theory.copiedNarrative, false)
  }
})

test('comparators cover every option once and every alternative/outcome pair has an explicit estimand against BAU', () => {
  for (const design of buildSnapshot().designs) {
    const expected = EXPECTED.get(design.id)
    const bau = design.comparators.filter((entry) => entry.role === 'business-as-usual')
    const alternatives = design.comparators.filter((entry) => entry.role === 'candidate-alternative')
    assert.equal(bau.length, 1)
    assert.equal(alternatives.length, 2)
    assert.deepEqual(design.comparators.map((entry) => entry.transformationOptionId), design.transformationBinding.optionIds)
    assert.equal(design.comparators.every((entry) => !entry.selected && !entry.assigned && !entry.implemented && entry.exposureState === 'NONE'), true)
    const impact = design.evaluationQuestions.find((question) => question.type === 'impact')
    const required = alternatives.flatMap((alternative) => impact.measureIds.map((measureId) => `${alternative.id}\0${measureId}`)).sort()
    const actual = design.estimands.map((estimand) => {
      assert.equal(estimand.impactQuestionId, impact.id)
      assert.equal(estimand.referenceComparatorId, bau[0].id)
      assert.notEqual(estimand.treatmentComparatorId, estimand.referenceComparatorId)
      assert.equal(estimand.identificationState, 'NOT-ASSESSED')
      assert.equal(estimand.estimate, null)
      assert.equal(estimand.uncertainty, null)
      assert.equal(estimand.causalStatus, 'NOT-CLAIMED')
      return `${estimand.treatmentComparatorId}\0${estimand.outcomeMeasureId}`
    }).sort()
    assert.deepEqual(actual, required)
    assert.equal(design.estimands.length, expected.estimands)
  }
})

test('all measures are used, none is a target, and outcomes have gaming hazards and guardrails', () => {
  for (const design of buildSnapshot().designs) {
    const used = new Set(design.evaluationQuestions.flatMap((question) => question.measureIds))
    assert.deepEqual([...used].sort(), design.measures.map((measure) => measure.id).sort())
    const guardrails = new Set(design.guardrails.map((guardrail) => guardrail.id))
    for (const measure of design.measures) {
      assert.equal(measure.value, null)
      assert.equal(measure.targetStatus, 'NOT-A-TARGET')
      assert.equal(measure.definitionFrozen, false)
      assert.deepEqual(measure.sourceRefs, [])
      assert.equal(measure.authorityEffect, 'NONE')
      if (measure.role === 'outcome') {
        assert.equal(measure.gamingHazardIds.length > 0, true)
        assert.equal(measure.guardrailIds.length > 0, true)
        assert.equal(measure.guardrailIds.every((id) => guardrails.has(id)), true)
      }
    }
  }
})

test('guardrails cover every negative pathway and stop interpretation without thresholds or results', () => {
  for (const design of buildSnapshot().designs) {
    assert.deepEqual([...new Set(design.guardrails.flatMap((guardrail) => guardrail.protectsAgainst))].sort(),
      [...design.transformationBinding.negativePathwayNodeIds].sort())
    assert.equal(design.guardrails.every((guardrail) => guardrail.threshold === null && guardrail.result === null
      && guardrail.breachState === 'NOT-OBSERVED' && guardrail.stopsInterpretation), true)
  }
})

test('distribution and missingness preserve territory, subgroup harm and missing-not-zero rules', () => {
  for (const design of buildSnapshot().designs) {
    const distribution = design.distributionPlan
    assert.equal(distribution.aggregateCanOverrideHarm, false)
    assert.equal(distribution.weightedCanReplaceUnweighted, false)
    assert.equal(distribution.missingOrHarmCanBeAveragedAway, false)
    assert.equal(distribution.smallCellPolicy, 'SUPPRESS-NOT-INFER')
    assert.deepEqual(distribution.results, [])
    for (const dimension of ['access-needs', 'digital-exclusion', 'language']) {
      assert.equal(distribution.dimensions.some((entry) => entry.includes(dimension)), true)
    }
    if (design.id.startsWith('design:four-nation')) {
      assert.deepEqual([...distribution.territories].sort(), ['England', 'Northern Ireland', 'Scotland', 'Wales'])
    }
    const missing = design.missingnessPlan
    assert.equal(missing.missingNotZero, true)
    assert.equal(missing.missingNotNoEffect, true)
    assert.equal(missing.completeCaseDefault, false)
    assert.equal(missing.stopIfCriticalClassUnobserved, true)
    assert.deepEqual(missing.results, [])
  }
})

test('process, impact and economic plans remain drafts with no result, attribution, VFM or spending authority', () => {
  for (const design of buildSnapshot().designs) {
    assert.equal(design.processEvaluationPlan.state, 'DESIGN-DRAFT')
    assert.equal(design.processEvaluationPlan.canEstablishImpact, false)
    assert.equal(design.processEvaluationPlan.canEstablishCausality, false)
    assert.equal(design.processEvaluationPlan.result, null)
    assert.equal(design.impactEvaluationPlan.state, 'DESIGN-DRAFT')
    assert.equal(design.impactEvaluationPlan.methodSelected, false)
    assert.equal(design.impactEvaluationPlan.canClaimAttribution, false)
    assert.equal(design.impactEvaluationPlan.result, null)
    assert.equal(design.economicEvaluationPlan.state, 'DESIGN-DRAFT')
    assert.equal(Object.values(design.economicEvaluationPlan.amounts).every((amount) => amount === null), true)
    assert.equal(design.economicEvaluationPlan.benefitCostRatio, null)
    assert.equal(design.economicEvaluationPlan.netPresentValue, null)
    assert.equal(design.economicEvaluationPlan.valueForMoneyConclusion, false)
    assert.equal(design.economicEvaluationPlan.spendingAuthority, false)
    assert.equal(design.economicEvaluationPlan.result, null)
  }
})

test('data, privacy, affected-party and QA plans contain no records, participants, approval or engagement claims', () => {
  for (const design of buildSnapshot().designs) {
    assert.deepEqual(design.dataPlan.datasetRefs, [])
    for (const field of ['administrativeData', 'monitoringData', 'surveyData', 'qualitativeData', 'dataCollection', 'linkage']) {
      assert.equal(design.dataPlan[field], false)
    }
    const privacy = design.privacyEthicsPlan
    assert.equal(privacy.personalData, false)
    assert.equal(privacy.specialCategoryData, false)
    assert.equal(privacy.criminalOffenceData, false)
    assert.equal(privacy.humanParticipants, false)
    assert.equal(privacy.dpiaState, 'NOT-STARTED')
    assert.equal(privacy.ethicsState, 'REQUIRED-NOT-COMPLETED')
    const affected = design.affectedPartyPlan
    assert.equal(affected.state, 'MAPPED-NOT-ENGAGED')
    assert.deepEqual(affected.participantRecords, [])
    assert.deepEqual(affected.contactRecords, [])
    assert.deepEqual(affected.engagementRecords, [])
    assert.equal(affected.participationIsRepresentation, false)
    assert.equal(affected.participationIsConsent, false)
    assert.equal(affected.participationIsEndorsement, false)
    assert.equal(affected.silenceIsAcceptance, false)
    assert.equal(affected.classes.every((entry) => entry.personalRecords === false && entry.dissentPreserved), true)
    assert.equal(design.qualityAssurancePlan.analystAndAssurerDistinct, true)
    assert.notEqual(design.qualityAssurancePlan.analystRole, design.qualityAssurancePlan.assurerRole)
    assert.equal(design.qualityAssurancePlan.qualityAssuranceIsApproval, false)
    assert.deepEqual(design.qualityAssurancePlan.records, [])
  }
})

test('negative, null and inconclusive findings stay in scope while governed withholding remains outcome-neutral', () => {
  const grounds = ['confidentiality', 'legal-restriction', 'privacy-and-data-protection', 'rights-and-licensing', 'risk-of-harm', 'security']
  for (const design of buildSnapshot().designs) {
    const publication = design.publicationPlan
    assert.equal(publication.protocolRegistered, false)
    assert.equal(publication.resultsExist, false)
    assert.deepEqual(publication.resultRoutes, [])
    assert.equal(publication.negativeAndNullResultsInScope, true)
    const withholding = publication.withholdingPolicy
    assert.deepEqual(withholding.allowedGrounds, grounds)
    assert.equal(withholding.outcomeDirectionIsAllowedGround, false)
    assert.equal(withholding.reasonAndScopeMustBeRecorded, true)
    assert.equal(withholding.minimumNecessaryWithholding, true)
    assert.equal(withholding.redactionAggregationOrPartialPublicationMustBeConsidered, true)
    assert.equal(withholding.rawDataPublished, false)
    assert.equal(withholding.humanReviewCompleted, false)
    const policy = design.nullResultPolicy
    assert.equal(policy.outcomeBasedSuppressionAllowed, false)
    assert.equal(policy.negativeOrNullOutcomeAloneCannotJustifySuppression, true)
    assert.equal(policy.selectiveOutcomeReportingForbidden, true)
    assert.equal(policy.restrictedMaterialCannotBeReplacedByMisleadingPositiveSummary, true)
    assert.equal(policy.noResultIsNullResult, false)
    assert.equal(policy.nullIsNoEffect, false)
    assert.equal(policy.nullIsFailure, false)
    assert.equal(policy.nullIsSuccess, false)
    assert.equal(policy.equivalenceRequiresMarginAndDesign, true)
    assert.equal(policy.inconclusivePreserved, true)
  }
})

test('Trial Chamber separation is negative and related resources are navigation-only', () => {
  const snapshot = buildSnapshot()
  assert.deepEqual(snapshot.trialChamberSeparation.trialChamberPlanRefs, [])
  assert.equal(snapshot.trialChamberSeparation.duplicatesTrialPlan, false)
  assert.equal(snapshot.trialChamberSeparation.trialChamberCompatibility, 'not-applicable')
  assert.equal(snapshot.trialChamberSeparation.forbiddenTrialPlanFields.length, 14)
  assert.deepEqual(snapshot.relatedResources.map((resource) => resource.id), ['related:transformation-engine', 'related:trial-chamber'])
  assert.equal(snapshot.relatedResources.every((resource) => resource.navigationOnly && !resource.evidence
    && !resource.authority && !resource.contentProjected && !resource.duplicatedContent), true)
  assert.equal(canonicalJson(snapshot).includes('reality-influence'), false)
  assert.equal(canonicalJson(snapshot).includes('j-space'), false)
})

test('method sources are exact link-only guidance and can support no empirical or authority claim', () => {
  const snapshot = buildSnapshot()
  assert.equal(snapshot.sources.length, 10)
  assert.equal(new Set(snapshot.sources.map((source) => source.url)).size, 10)
  for (const source of snapshot.sources) {
    assert.equal(new URL(source.url).protocol, 'https:')
    assert.equal(['www.gov.uk', 'ico.org.uk'].includes(new URL(source.url).hostname), true)
    assert.equal(source.role, 'method-or-governance-orientation-only')
    assert.equal(source.bodyReceipt, null)
    assert.equal(source.bodyRetained, false)
    assert.equal(source.exactTextHumanReviewed, false)
    assert.equal(source.genericOfficialHostIsEvidence, false)
    assert.equal(source.rightsOrReuseInferred, false)
    assert.equal(source.supportsDossierOutcome, false)
    assert.equal(source.supportsEstimand, false)
    assert.equal(source.supportsResult, false)
    assert.equal(source.supportsAuthority, false)
  }
})

test('freshness and exact publication route family make the immutable/mutable distinction explicit', () => {
  const snapshot = buildSnapshot()
  assert.equal(snapshot.asOf, '2026-08-23')
  assert.equal(snapshot.freshness.nextReviewDue, '2026-09-21')
  assert.equal(snapshot.freshness.readerClockEmbedded, false)
  assert.equal(snapshot.freshness.historicalStateAfterDeadline, 'HISTORICAL-DESIGN-ONLY')
  assert.equal(snapshot.freshness.releaseGateRequired, true)
  assert.equal(snapshot.freshness.mutableAliasPolicy, 'REPLACE-OR-RETIRE')
  assert.equal(canonicalJson(snapshot.urls), canonicalJson({
    canonical: 'https://thekingdom.dev/evaluation/uk-government-transformation-evaluation-covenants-2026-08-23.json',
    guide: 'https://thekingdom.dev/EVALUATION-COVENANT-v0.1.md',
    human: 'https://thekingdom.dev/evaluation-covenant/',
    mutableAlias: 'https://thekingdom.dev/evaluation-covenants.json',
    producer: 'https://github.com/cambridgetcg/kingdom-evaluation-covenant/tree/v0.1.0',
    repository: 'https://github.com/cambridgetcg/kingdom-evaluation-covenant',
    schema: 'https://thekingdom.dev/evaluation/schemas/v0.1/public-snapshot.schema.json',
  }))
})

test('checked-in output is the exact deterministic canonical build', () => {
  const snapshot = buildSnapshot()
  const bytes = readFileSync(PUBLIC_SNAPSHOT)
  assert.equal(bytes.toString('utf8'), prettyCanonicalJson(snapshot))
  assert.equal(bytes.byteLength, 127_383)
  assert.equal(sha256Bytes(bytes), SNAPSHOT_BYTE_RECEIPT)
  assert.equal(sha256Json(snapshot), SNAPSHOT_CANONICAL_RECEIPT)
  assert.equal(validateCheckedInSnapshot().current, true)
  assert.equal(canonicalJson(readJson(PUBLIC_SNAPSHOT)), canonicalJson(snapshot))
  assert.equal(snapshot.buildProvenance.deterministic, true)
  assert.equal(snapshot.buildProvenance.offline, true)
  assert.equal(snapshot.buildProvenance.networkUsed, false)
  assert.equal(snapshot.buildProvenance.clockRead, false)
  assert.equal(snapshot.buildProvenance.schemaByteReceipt, expectedReceipts.schemaByte)
  assert.equal(snapshot.buildProvenance.schemaCanonicalReceipt, expectedReceipts.schemaCanonical)
})

test('guide and README disclose Draft/Unsealed/Unregistered/No Run/No Result and no authority', () => {
  const guide = readFileSync(join(ROOT, 'EVALUATION-COVENANT-v0.1.md'), 'utf8')
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  for (const text of [guide, readme]) {
    assert.match(text, /Draft/u)
    assert.match(text, /Unsealed/u)
    assert.match(text, /Unregistered/u)
    assert.match(text, /No Run/u)
    assert.match(text, /No Result/u)
    assert.match(text, /not government|Not government/u)
    assert.match(text, /no authority|authority outside|does not create authority/u)
  }
  assert.match(guide, /Reality Influence/u)
  assert.match(guide, /not imported, bound, projected, evidence or authority/u)
})
