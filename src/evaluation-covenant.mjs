import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  PUBLIC_SNAPSHOT,
  ROOT,
  atomicWritePublicSnapshot,
  canonicalJson,
  parseJsonBytes,
  prettyCanonicalJson,
  readBoundedBytes,
  readJson,
  sha256Bytes,
  sha256Json,
} from './io.mjs'
import { loadSchema, schemaDocumentIssues, validateWithSchema } from './schema-validator.mjs'

const CONFIG_RECEIPT = 'sha256:bd52d71c4379069bc406905e6b6329dac14fc8ed04dee5ca73ce59188876f6fa'
const SOURCES_RECEIPT = 'sha256:11fd6a9a7880826a563aadad1b9bbaa841daea263ade337c044b65cb83684688'
const DESIGNS_RECEIPT = 'sha256:15eb662adcdfe3fa0ad9f0f9a643792cb5f46b64a75338fc8a68a30cf07caa93'

const TRANSFORMATION_PATH = join(ROOT, 'vendor', 'transformation-engine', 'transformations-2026-08-21.json')
const TRANSFORMATION_SCHEMA_PATH = join(ROOT, 'vendor', 'transformation-engine', 'public-snapshot.schema.json')
const TRANSFORMATION_GUIDE_PATH = join(ROOT, 'vendor', 'transformation-engine', 'UK-GOVERNMENT-TRANSFORMATION-ENGINE-v0.1.md')
const GOVERNMENT_PATH = join(ROOT, 'vendor', 'government-engine', 'government-2026-08-21.json')
const SCHEMA_PATH = join(ROOT, 'schemas', 'v0.1', 'public-snapshot.schema.json')

export const RECEIPTS = Object.freeze({
  transformationByte: 'sha256:fef3ca1719cb7fd02c09c558db6f239cad29a173b921763a10a59e042a4cdf00',
  transformationCanonical: 'sha256:7d9df6d5b6292b46abfbc076847f7e033b8d889be7a868dcbeac5d901b75c715',
  transformationSchemaByte: 'sha256:9949457e87db784c734b195195c7f3cdc2afb138ada400f61583ebd0a6cf7be6',
  transformationSchemaCanonical: 'sha256:b7118c1cd2f226b276b02f21bb080d3e3e5aae6aa26bc03e74277a5d1844c5c9',
  transformationGuideByte: 'sha256:cf025c3ed0baaca5ef08dc5ba5187f50ae1aa8596878f1a28e34be7d62a1d9c8',
  governmentByte: 'sha256:1751b2ac331d6a1283cbf57b5b6961d9071f528298f97589fcbd7cf36407e139',
  governmentCanonical: 'sha256:cc2c22e356cef0160ed5da1e2fd756bad5801f574c4cb064dec157b9207b9739',
  configCanonical: CONFIG_RECEIPT,
  sourcesCanonical: SOURCES_RECEIPT,
  designsCanonical: DESIGNS_RECEIPT,
  schemaByte: 'sha256:aa737bf4c9efa8bbdf477dae5347d9bd28677565e7903b3942f22844574e0a6c',
  schemaCanonical: 'sha256:264acc2f3e0075b1952768b1ecf810fa4e3204d37a178d6fcd87ad26a78615f1',
})

const EXPECTED_BYTES = Object.freeze({
  transformation: 83_915,
  transformationSchema: 47_800,
  transformationGuide: 6_770,
  government: 196_005,
})

const DESIGN_IDS = Object.freeze([
  'design:four-nation-information-orientation',
  'design:hmrc-notice-route-orientation',
  'design:public-money-category-orientation',
])
const DOSSIER_IDS = Object.freeze([
  'dossier:four-nation-public-service-information',
  'dossier:hmrc-decision-notice-explanatory-content',
  'dossier:public-money-transparency-information-service',
])
const SOURCE_URLS = Object.freeze([
  'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-by-design-and-by-default/',
  'https://www.gov.uk/guidance/guidance-on-using-the-evaluation-registry',
  'https://www.gov.uk/guidance/the-aqua-book',
  'https://www.gov.uk/government/publications/consultation-principles-guidance/consultation-principles-2018',
  'https://www.gov.uk/government/publications/data-ethics-framework/data-and-ai-ethics-framework',
  'https://www.gov.uk/government/publications/government-social-research-publication-protocols',
  'https://www.gov.uk/government/publications/the-green-book-appraisal-and-evaluation-in-central-government/the-green-book-2026',
  'https://www.gov.uk/government/publications/the-magenta-book/magenta-book-central-government-guidance-on-evaluation-html',
  'https://www.gov.uk/government/publications/the-magenta-book/quality-in-policy-impact-evaluation-qpie-html',
  'https://www.gov.uk/government/publications/the-magenta-book/transparency-in-government-evaluation-research-t-i-g-e-r-html',
])
const SOURCE_HOSTS = Object.freeze(['ico.org.uk', 'www.gov.uk'])
const QUESTION_TYPES = Object.freeze(['economic', 'impact', 'process'])
const MEASURE_ROLES = new Set(['economic', 'outcome', 'process', 'qualitative'])
const FORBIDDEN_TRIAL_FIELDS = new Set([
  'artifact', 'artifactPin', 'criterionRules', 'evaluationPlanId', 'evaluationRequestId', 'execution', 'fixtures',
  'passingEffect', 'preflight', 'referralId', 'resourceEnvelope', 'runner', 'trialAuthority', 'trialRun',
])
const POSSIBLE_PERSONAL_KEYS = /(?:^|_)(?:email|name|nationalInsurance|niNumber|nino|postcode|testimony|utr|username|handle|caseId|contact)(?:$|_)/iu
const POSSIBLE_PERSONAL_VALUES = /(?:\b[A-Z]{2}\d{6}[A-D]\b|\b\d{10}\b|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b|mailto:|@[a-z0-9_.-]+)/iu

const STATE = Object.freeze({
  adoptionEffect: 'NONE',
  approvalState: 'NOT-APPROVED',
  designState: 'DRAFT',
  registrationState: 'UNREGISTERED',
  resultState: 'NO-RESULT',
  runState: 'NO-RUN',
  sealState: 'UNSEALED',
  useAuthorityEffect: 'NONE',
})

function compareAscii(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortedStrings(values) {
  return [...values].sort(compareAscii)
}

function exactValue(value, expected) {
  return canonicalJson(value) === canonicalJson(expected)
}

function semantic(message) {
  return `semantic: ${message}`
}

function uniqueIds(records, label, issues) {
  if (!Array.isArray(records)) {
    issues.push(semantic(`${label} must be an array`))
    return new Set()
  }
  const ids = records.map((record) => record?.id)
  if (ids.some((id) => typeof id !== 'string' || id.length < 3)) issues.push(semantic(`${label} contains an invalid ID`))
  if (new Set(ids).size !== ids.length) issues.push(semantic(`${label} IDs must be unique`))
  return new Set(ids)
}

function normalize(value) {
  if (Array.isArray(value)) {
    const children = value.map((child) => normalize(child))
    if (children.every((child) => typeof child === 'string')) return sortedStrings(children)
    if (children.every((child) => child !== null && typeof child === 'object' && typeof child.id === 'string')) {
      return children.sort((left, right) => compareAscii(left.id, right.id))
    }
    return children
  }
  if (value === null || typeof value !== 'object') return value
  const output = Object.create(null)
  for (const [key, child] of Object.entries(value)) output[key] = normalize(child)
  return output
}

function scanForbiddenTrialFields(value, path = '$', issues = []) {
  if (value === null || typeof value !== 'object') return issues
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanForbiddenTrialFields(child, `${path}/${index}`, issues))
    return issues
  }
  for (const [key, child] of Object.entries(value)) {
    const isFalseBoundary = path.endsWith('/boundaries') && child === false
    const isDeclaredForbiddenName = path.endsWith('/trialChamberSeparation/forbiddenTrialPlanFields')
    if (FORBIDDEN_TRIAL_FIELDS.has(key) && !isFalseBoundary && !isDeclaredForbiddenName) {
      issues.push(semantic(`${path}/${key}: Trial Chamber plan field is forbidden`))
    }
    scanForbiddenTrialFields(child, `${path}/${key}`, issues)
  }
  return issues
}

function scanPersonalRecordShapes(value, path = '$', issues = []) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return issues
  if (typeof value === 'string') {
    if (POSSIBLE_PERSONAL_VALUES.test(value)) issues.push(semantic(`${path}: possible personal identifier is forbidden`))
    return issues
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanPersonalRecordShapes(child, `${path}/${index}`, issues))
    return issues
  }
  for (const [key, child] of Object.entries(value)) {
    const explicitNegative = child === false && ['personalData', 'personalDataCollection', 'personalRecords'].includes(key)
    if (POSSIBLE_PERSONAL_KEYS.test(key) && !explicitNegative) issues.push(semantic(`${path}/${key}: personal-record-shaped key is forbidden`))
    scanPersonalRecordShapes(child, `${path}/${key}`, issues)
  }
  return issues
}

function exactBytes(label, bytes, expectedBytes, expectedReceipt, issues) {
  if (bytes.byteLength !== expectedBytes) issues.push(semantic(`${label} byte length mismatch`))
  if (sha256Bytes(bytes) !== expectedReceipt) issues.push(semantic(`${label} byte receipt mismatch`))
}

export function loadInputs() {
  const config = readJson(join(ROOT, 'data', 'config.json'))
  const sources = readJson(join(ROOT, 'data', 'sources.json'))
  const designs = readJson(join(ROOT, 'data', 'designs.json'))
  const transformationBytes = readBoundedBytes(TRANSFORMATION_PATH)
  const transformation = parseJsonBytes(transformationBytes, 'frozen Transformation snapshot')
  const transformationSchemaBytes = readBoundedBytes(TRANSFORMATION_SCHEMA_PATH)
  const transformationSchema = parseJsonBytes(transformationSchemaBytes, 'frozen Transformation schema')
  const transformationGuideBytes = readBoundedBytes(TRANSFORMATION_GUIDE_PATH)
  const governmentBytes = readBoundedBytes(GOVERNMENT_PATH)
  const government = parseJsonBytes(governmentBytes, 'frozen Government snapshot')
  if (!Array.isArray(sources)) throw new TypeError('data/sources.json must contain an array')
  if (!Array.isArray(designs)) throw new TypeError('data/designs.json must contain an array')
  return {
    config,
    sources,
    designs,
    transformation,
    transformationBytes,
    transformationSchema,
    transformationSchemaBytes,
    transformationGuideBytes,
    government,
    governmentBytes,
  }
}

function lineageIssues(inputs) {
  const {
    config, transformation, transformationBytes, transformationSchema, transformationSchemaBytes,
    transformationGuideBytes, government, governmentBytes,
  } = inputs
  const issues = []
  exactBytes('Transformation snapshot', transformationBytes, EXPECTED_BYTES.transformation, RECEIPTS.transformationByte, issues)
  exactBytes('Transformation schema', transformationSchemaBytes, EXPECTED_BYTES.transformationSchema, RECEIPTS.transformationSchemaByte, issues)
  exactBytes('Transformation guide', transformationGuideBytes, EXPECTED_BYTES.transformationGuide, RECEIPTS.transformationGuideByte, issues)
  exactBytes('Government snapshot', governmentBytes, EXPECTED_BYTES.government, RECEIPTS.governmentByte, issues)
  if (sha256Json(transformation) !== RECEIPTS.transformationCanonical) issues.push(semantic('Transformation canonical receipt mismatch'))
  if (sha256Json(transformationSchema) !== RECEIPTS.transformationSchemaCanonical) issues.push(semantic('Transformation schema canonical receipt mismatch'))
  if (sha256Json(government) !== RECEIPTS.governmentCanonical) issues.push(semantic('Government canonical receipt mismatch'))
  if (transformation.schema !== 'kingdom.government-transformation-orientation-public-snapshot/0.1'
    || transformation.contractVersion !== '0.1.0' || transformation.asOf !== '2026-08-21') {
    issues.push(semantic('Transformation identity mismatch'))
  }
  if (transformationSchema.$schema !== 'https://json-schema.org/draft/2020-12/schema'
    || transformationSchema.$id !== 'https://thekingdom.dev/government/transformations/schemas/v0.1/public-snapshot.schema.json') {
    issues.push(semantic('Transformation schema identity mismatch'))
  }
  if (government.schema !== 'kingdom.government-engine-public-snapshot/0.1'
    || government.contractVersion !== '0.1.0' || government.asOf !== '2026-08-21') {
    issues.push(semantic('Government identity mismatch'))
  }
  if (transformation.baseSnapshot?.byteReceipt !== RECEIPTS.governmentByte
    || transformation.baseSnapshot?.canonicalReceipt !== RECEIPTS.governmentCanonical
    || transformation.baseSnapshot?.bytes !== EXPECTED_BYTES.government
    || transformation.baseSnapshot?.asOf !== government.asOf
    || transformation.baseSnapshot?.schema !== government.schema) {
    issues.push(semantic('Transformation to Government transitive receipt binding mismatch'))
  }
  if (config.freshness?.nextReviewDue !== transformation.freshness?.nextReviewDue
    || config.freshness?.nextReviewDue !== government.freshness?.nextReviewDue
    || config.freshness?.reviewDeadlineInheritedFromTransformation !== true) {
    issues.push(semantic('review deadline must inherit exact Transformation and Government deadline'))
  }
  const dossierIds = transformation.dossiers?.map((dossier) => dossier.id)
  if (!exactValue(dossierIds, DOSSIER_IDS)) issues.push(semantic('frozen Transformation dossier order or inventory mismatch'))
  const configBindings = config.lineage?.dossierBindings ?? []
  if (!exactValue(configBindings.map((binding) => binding.dossierId), DOSSIER_IDS)) issues.push(semantic('lineage dossier binding order mismatch'))
  for (const binding of configBindings) {
    const dossier = transformation.dossiers.find((candidate) => candidate.id === binding.dossierId)
    if (dossier === undefined) continue
    if (sha256Json(dossier) !== binding.dossierCanonicalReceipt) issues.push(semantic(`${binding.dossierId}: dossier canonical receipt mismatch`))
    if (dossier.proposition?.canonicalReceipt !== binding.propositionCanonicalReceipt) issues.push(semantic(`${binding.dossierId}: proposition receipt mismatch`))
    if (!exactValue(dossier.options.map((option) => option.id), binding.optionIds)) issues.push(semantic(`${binding.dossierId}: option order or inventory mismatch`))
    if (dossier.options.some((option) => option.selected !== false)) issues.push(semantic(`${binding.dossierId}: upstream option selection must remain false`))
    if (dossier.desiredOutcomes?.length !== 1 || dossier.desiredOutcomes[0].id !== binding.outcomeId) {
      issues.push(semantic(`${binding.dossierId}: desired outcome mismatch`))
      continue
    }
    const outcome = dossier.desiredOutcomes[0]
    if (!exactValue(outcome.assumptionNodeIds, binding.assumptionNodeIds)
      || !exactValue(outcome.negativePathwayNodeIds, binding.negativePathwayNodeIds)
      || !exactValue(outcome.evaluationNeedNodeIds, [binding.evaluationNeedNodeId])) {
      issues.push(semantic(`${binding.dossierId}: assumption, negative pathway or evaluation-need binding mismatch`))
    }
    if (!exactValue(dossier.humanGates.map((gate) => gate.id), binding.gateIds)
      || dossier.humanGates.some((gate) => gate.required !== true || gate.completed !== false || gate.authorityOutsideSystem !== true)) {
      issues.push(semantic(`${binding.dossierId}: inherited human gate binding mismatch`))
    }
  }
  if (config.lineage?.mode !== 'exact-synthetic-design-context-only' || config.lineage?.useAsEvidence !== false
    || config.lineage?.baseGovernment?.contextMode !== 'transitive-validation-context-only'
    || config.lineage?.baseGovernment?.useAsEvidence !== false) {
    issues.push(semantic('lineage evidence firewall mismatch'))
  }
  return issues
}

function sourceIssues(sources) {
  const issues = []
  uniqueIds(sources, 'sources', issues)
  if (sources.length !== 10) issues.push(semantic('source ledger must contain exactly ten method/governance sources'))
  if (!exactValue(sortedStrings(sources.map((source) => source.url)), sortedStrings(SOURCE_URLS))) issues.push(semantic('source URL allowlist mismatch'))
  for (const source of sources) {
    let url
    try { url = new URL(source.url) } catch { issues.push(semantic(`${source.id}: invalid source URL`)); continue }
    if (url.protocol !== 'https:' || !SOURCE_HOSTS.includes(url.hostname)) issues.push(semantic(`${source.id}: source host is outside the exact HTTPS allowlist`))
    if (source.role !== 'method-or-governance-orientation-only' || source.bodyReceipt !== null || source.bodyRetained !== false
      || source.exactTextHumanReviewed !== false || source.genericOfficialHostIsEvidence !== false
      || source.rightsOrReuseInferred !== false || source.supportsAuthority !== false
      || source.supportsDossierOutcome !== false || source.supportsEstimand !== false || source.supportsResult !== false) {
      issues.push(semantic(`${source.id}: method-source firewall mismatch`))
    }
    if (source.checkedOn !== '2026-08-23' || !source.caveat.includes('not an exact-text review')) {
      issues.push(semantic(`${source.id}: URL observation caveat mismatch`))
    }
  }
  return issues
}

function expectedLineage(config, dossierId) {
  return config.lineage.dossierBindings.find((binding) => binding.dossierId === dossierId)
}

function designSourceIssues(design, config, transformation) {
  const issues = []
  const questions = uniqueIds(design.evaluationQuestions, `${design.id}.evaluationQuestions`, issues)
  const comparators = uniqueIds(design.comparators, `${design.id}.comparators`, issues)
  const estimands = uniqueIds(design.estimands, `${design.id}.estimands`, issues)
  const measures = uniqueIds(design.measures, `${design.id}.measures`, issues)
  const guardrails = uniqueIds(design.guardrails, `${design.id}.guardrails`, issues)
  const classes = uniqueIds(design.affectedPartyClasses, `${design.id}.affectedPartyClasses`, issues)
  uniqueIds(design.stopRules, `${design.id}.stopRules`, issues)
  uniqueIds(design.humanGates, `${design.id}.humanGates`, issues)

  const binding = design.transformationBinding ?? {}
  const expected = expectedLineage(config, binding.dossierId)
  if (expected === undefined) {
    issues.push(semantic(`${design.id}: unknown Transformation dossier binding`))
    return issues
  }
  const expectedDesignBinding = {
    assumptionNodeIds: expected.assumptionNodeIds,
    dossierCanonicalReceipt: expected.dossierCanonicalReceipt,
    dossierId: expected.dossierId,
    evaluationNeedNodeId: expected.evaluationNeedNodeId,
    humanGateIds: expected.gateIds,
    negativePathwayNodeIds: expected.negativePathwayNodeIds,
    optionIds: expected.optionIds,
    propositionCanonicalReceipt: expected.propositionCanonicalReceipt,
    transformationOutcomeId: expected.outcomeId,
    useAsEvidence: false,
  }
  if (!exactValue(binding, expectedDesignBinding)) issues.push(semantic(`${design.id}: exact Transformation binding mismatch`))
  const dossier = transformation.dossiers.find((candidate) => candidate.id === binding.dossierId)
  if (dossier === undefined) return issues

  if (design.evaluationQuestions.length !== 3
    || !exactValue(sortedStrings(design.evaluationQuestions.map((question) => question.type)), QUESTION_TYPES)) {
    issues.push(semantic(`${design.id}: exactly one process, impact and economic question is required`))
  }
  const questionById = new Map(design.evaluationQuestions.map((question) => [question.id, question]))
  const measureById = new Map(design.measures.map((measure) => [measure.id, measure]))
  for (const question of design.evaluationQuestions) {
    if (question.answerState !== 'NOT-ANSWERED' || question.result !== null || question.authorityEffect !== 'NONE') {
      issues.push(semantic(`${question.id}: question must remain unanswered, resultless and non-authoritative`))
    }
    if (!exactValue(question.transformationOutcomeIds, [binding.transformationOutcomeId])) issues.push(semantic(`${question.id}: exact outcome coverage mismatch`))
    if (question.measureIds.length < 1 || question.measureIds.some((id) => !measures.has(id))) issues.push(semantic(`${question.id}: measure reference mismatch`))
    if (question.affectedPartyClassIds.length < 1 || question.affectedPartyClassIds.some((id) => !classes.has(id))) issues.push(semantic(`${question.id}: affected-party reference mismatch`))
    const roles = new Set(question.measureIds.map((id) => measureById.get(id)?.role))
    if (question.type === 'process' && [...roles].some((role) => !['process', 'qualitative'].includes(role))) issues.push(semantic(`${question.id}: process question uses an impact or economic measure`))
    if (question.type === 'impact' && [...roles].some((role) => role !== 'outcome')) issues.push(semantic(`${question.id}: impact question must use outcome measures only`))
    if (question.type === 'economic' && [...roles].some((role) => role !== 'economic')) issues.push(semantic(`${question.id}: economic question must use economic measures only`))
  }

  if (design.comparators.length !== 3 || design.comparators.filter((comparator) => comparator.role === 'business-as-usual').length !== 1
    || design.comparators.filter((comparator) => comparator.role === 'candidate-alternative').length !== 2
    || !exactValue(design.comparators.map((comparator) => comparator.transformationOptionId), binding.optionIds)) {
    issues.push(semantic(`${design.id}: exact BAU and alternative comparator inventory mismatch`))
  }
  if (design.comparators.some((comparator) => comparator.selected !== false || comparator.assigned !== false
    || comparator.implemented !== false || comparator.exposureState !== 'NONE')) {
    issues.push(semantic(`${design.id}: comparators must remain unselected, unassigned, unimplemented and unexposed`))
  }

  const theory = design.theoryBinding ?? {}
  if (theory.desiredOutcomeId !== binding.transformationOutcomeId || theory.evaluationNeedNodeId !== binding.evaluationNeedNodeId
    || !exactValue(theory.assumptionNodeIds, binding.assumptionNodeIds)
    || !exactValue(theory.negativePathwayNodeIds, binding.negativePathwayNodeIds)
    || theory.claimsCausalTruth !== false || theory.tested !== false || theory.theoryValidated !== false || theory.copiedNarrative !== false) {
    issues.push(semantic(`${design.id}: theory binding or causal-truth boundary mismatch`))
  }
  const upstreamEdges = new Map(dossier.causalChangeHypothesisGraph.edges.map((edge) => [edge.id, edge]))
  if (theory.optionToOutputEdges?.length !== 3) issues.push(semantic(`${design.id}: exactly three option-to-output edges are required`))
  for (const edge of theory.optionToOutputEdges ?? []) {
    const upstream = upstreamEdges.get(edge.edgeId)
    if (upstream === undefined || upstream.fromId !== edge.fromId || upstream.toId !== edge.toId
      || upstream.type !== 'hypothesises-contribution') issues.push(semantic(`${design.id}: option-to-output edge direction mismatch`))
  }

  const usedMeasureIds = new Set(design.evaluationQuestions.flatMap((question) => question.measureIds))
  if (!exactValue(sortedStrings([...usedMeasureIds]), sortedStrings([...measures]))) issues.push(semantic(`${design.id}: every measure must be used by a question`))
  for (const measure of design.measures) {
    if (!MEASURE_ROLES.has(measure.role) || measure.value !== null || measure.targetStatus !== 'NOT-A-TARGET'
      || measure.definitionFrozen !== false || measure.authorityEffect !== 'NONE' || measure.sourceRefs.length !== 0
      || measure.numeratorDefinition !== null || measure.denominatorDefinition !== null) {
      issues.push(semantic(`${measure.id}: measure state, target, value, definition or source firewall mismatch`))
    }
    if (measure.questionIds.length < 1 || measure.questionIds.some((id) => !questions.has(id))) issues.push(semantic(`${measure.id}: question reference mismatch`))
    if (measure.role === 'outcome' && (measure.gamingHazardIds.length < 1 || measure.guardrailIds.length < 1
      || measure.guardrailIds.some((id) => !guardrails.has(id)))) {
      issues.push(semantic(`${measure.id}: outcome measure requires gaming hazards and guardrails`))
    }
  }

  const impact = design.evaluationQuestions.find((question) => question.type === 'impact')
  const bau = design.comparators.find((comparator) => comparator.role === 'business-as-usual')
  const alternatives = design.comparators.filter((comparator) => comparator.role === 'candidate-alternative')
  const requiredPairs = new Set(alternatives.flatMap((alternative) => (impact?.measureIds ?? []).map((measureId) => `${alternative.id}\u0000${measureId}`)))
  const actualPairs = new Set()
  for (const estimand of design.estimands) {
    if (impact === undefined || bau === undefined || estimand.impactQuestionId !== impact.id || estimand.referenceComparatorId !== bau.id
      || !comparators.has(estimand.treatmentComparatorId) || estimand.treatmentComparatorId === estimand.referenceComparatorId
      || !impact.measureIds.includes(estimand.outcomeMeasureId) || estimand.identificationState !== 'NOT-ASSESSED'
      || estimand.estimate !== null || estimand.uncertainty !== null || estimand.causalStatus !== 'NOT-CLAIMED') {
      issues.push(semantic(`${estimand.id}: malformed or promoted estimand`))
    }
    actualPairs.add(`${estimand.treatmentComparatorId}\u0000${estimand.outcomeMeasureId}`)
  }
  if (!exactValue(sortedStrings([...actualPairs]), sortedStrings([...requiredPairs])) || estimands.size !== requiredPairs.size) {
    issues.push(semantic(`${design.id}: each alternative and outcome-measure pair needs one explicit estimand against BAU`))
  }

  const coveredNegativePathways = new Set()
  const measuresWithGuardrails = new Set()
  for (const guardrail of design.guardrails) {
    if (guardrail.threshold !== null || guardrail.result !== null || guardrail.breachState !== 'NOT-OBSERVED'
      || guardrail.stopsInterpretation !== true || guardrail.linkedMeasureIds.length < 1
      || guardrail.linkedMeasureIds.some((id) => !measures.has(id))) {
      issues.push(semantic(`${guardrail.id}: guardrail state or measure reference mismatch`))
    }
    for (const id of guardrail.protectsAgainst) coveredNegativePathways.add(id)
    for (const id of guardrail.linkedMeasureIds) measuresWithGuardrails.add(id)
  }
  if (!exactValue(sortedStrings([...coveredNegativePathways]), sortedStrings(binding.negativePathwayNodeIds))) {
    issues.push(semantic(`${design.id}: every and only bound negative pathway must be guardrail-covered`))
  }
  for (const measure of design.measures.filter((candidate) => candidate.role === 'outcome')) {
    if (!measuresWithGuardrails.has(measure.id)) issues.push(semantic(`${measure.id}: outcome measure lacks a guardrail`))
  }

  const propositionTerritories = dossier.proposition.affectedTerritories
  if (!exactValue(design.distribution.territories, propositionTerritories)
    || !exactValue(sortedStrings(design.distribution.affectedPartyClassIds), sortedStrings([...classes]))) {
    issues.push(semantic(`${design.id}: distribution territory or affected-party coverage mismatch`))
  }
  const requiredDimensions = ['access-needs', 'digital-exclusion', 'language']
  if (requiredDimensions.some((dimension) => !design.distribution.dimensions.some((entry) => entry.includes(dimension)))) {
    issues.push(semantic(`${design.id}: distribution must preserve access, digital-exclusion and language dimensions`))
  }
  for (const affected of design.affectedPartyClasses) {
    if (affected.representationState !== 'MAPPED-NOT-ENGAGED' || affected.engagementState !== 'NOT-DESIGNED'
      || affected.accessibilityState !== 'NOT-ASSESSED' || affected.languageState !== 'NOT-ASSESSED'
      || affected.burdenState !== 'NOT-ASSESSED' || affected.compensationState !== 'NOT-ASSESSED'
      || affected.dissentPreserved !== true || affected.personalRecords !== false) {
      issues.push(semantic(`${affected.id}: affected-party Phase-0 state mismatch`))
    }
  }
  if (design.stopRules.some((rule) => rule.observed !== false || rule.automatic !== false
    || rule.authorityEffect !== 'NONE' || rule.owner !== 'OUTSIDE-SYSTEM' || rule.correctionOrWithdrawalState !== 'NOT-ACTIVATED')) {
    issues.push(semantic(`${design.id}: stop rules cannot be observed, automatic or system-authoritative`))
  }
  const inheritedGates = design.humanGates.filter((gate) => gate.kind === 'inherited-transformation-domain-gate')
  if (design.humanGates.length !== 6 || !exactValue(inheritedGates.map((gate) => gate.id), binding.humanGateIds)
    || design.humanGates.some((gate) => gate.required !== true || gate.completed !== false
      || gate.authorityOutsideSystem !== true || gate.authorityEffect !== 'NONE')) {
    issues.push(semantic(`${design.id}: exact incomplete outside-system human gate inventory mismatch`))
  }
  issues.push(...scanForbiddenTrialFields(design, `$/designSource/${design.id}`))
  issues.push(...scanPersonalRecordShapes(design.affectedPartyClasses, `$/designSource/${design.id}/affectedPartyClasses`))
  return issues
}

export function semanticIssues(inputs) {
  const { config, sources, designs, transformation } = inputs
  const issues = []
  if (sha256Json(config) !== CONFIG_RECEIPT) issues.push(semantic('config differs from exact reviewed canonical receipt'))
  if (sha256Json(sources) !== SOURCES_RECEIPT) issues.push(semantic('sources differ from exact reviewed canonical receipt'))
  if (sha256Json(designs) !== DESIGNS_RECEIPT) issues.push(semantic('designs differ from exact reviewed canonical receipt'))
  issues.push(...lineageIssues(inputs))
  issues.push(...sourceIssues(sources))
  if (config.protocol !== 'kingdom.evaluation-covenant-public-snapshot/0.1' || config.contractVersion !== '0.1.0'
    || config.title !== 'KINGDOM Evaluation Covenant: Synthetic Transformation Designs'
    || !exactValue(config.phase, { id: '0-static-synthetic-design', scope: 'evaluation-design-only' })
    || !exactValue(config.covenantState, STATE)) issues.push(semantic('product identity, phase or covenant state mismatch'))
  if (Object.values(config.boundaries ?? {}).some((value) => value !== false)) issues.push(semantic('all boundaries must be exact false'))
  if (config.urls?.human !== 'https://thekingdom.dev/evaluation-covenant/'
    || config.urls?.mutableAlias !== 'https://thekingdom.dev/evaluation-covenants.json'
    || config.urls?.canonical !== 'https://thekingdom.dev/evaluation/uk-government-transformation-evaluation-covenants-2026-08-23.json'
    || config.urls?.schema !== 'https://thekingdom.dev/evaluation/schemas/v0.1/public-snapshot.schema.json'
    || config.urls?.guide !== 'https://thekingdom.dev/EVALUATION-COVENANT-v0.1.md'
    || config.urls?.producer !== 'https://github.com/cambridgetcg/kingdom-evaluation-covenant/tree/v0.1.0') {
    issues.push(semantic('exact five-route family or producer-tag URL mismatch'))
  }
  if (config.trialChamberSeparation?.trialChamberCompatibility !== 'not-applicable'
    || config.trialChamberSeparation?.duplicatesTrialPlan !== false
    || config.trialChamberSeparation?.trialChamberPlanRefs?.length !== 0
    || !exactValue(sortedStrings(config.trialChamberSeparation?.forbiddenTrialPlanFields ?? []), sortedStrings([...FORBIDDEN_TRIAL_FIELDS]))) {
    issues.push(semantic('Trial Chamber ownership separation mismatch'))
  }
  if (config.relatedResources?.length !== 2 || config.relatedResources.some((resource) => resource.navigationOnly !== true
    || resource.evidence !== false || resource.authority !== false || resource.contentProjected !== false || resource.duplicatedContent !== false)) {
    issues.push(semantic('related resources must remain navigation-only, non-evidential and non-authoritative'))
  }
  if (/(?:reality[- ]influence|j-space)/iu.test(canonicalJson({
    lineage: config.lineage,
    relatedResources: config.relatedResources,
    sources,
    designs,
  }))) {
    issues.push(semantic('Reality Influence and J-space must not enter lineage, sources, designs or related resources'))
  }
  if (!exactValue(designs.map((design) => design.id), DESIGN_IDS)) issues.push(semantic('exact design order or inventory mismatch'))
  if (!exactValue(designs.map((design) => design.transformationBinding.dossierId), DOSSIER_IDS)) issues.push(semantic('design-to-dossier one-to-one order mismatch'))
  for (const design of designs) issues.push(...designSourceIssues(design, config, transformation))
  return [...new Set(issues)].sort()
}

function commonEvaluationTypeContract() {
  return {
    distinctQuestionTypes: ['economic', 'impact', 'process'],
    economicCannotSatisfyImpact: true,
    impactCannotEstablishValueForMoney: true,
    oneTypeCannotSatisfyAnother: true,
    processCannotEstablishCausality: true,
    processCannotEstablishImpact: true,
  }
}

function distributionPlan(source) {
  return {
    unit: source.unit,
    territories: source.territories,
    affectedPartyClassIds: source.affectedPartyClassIds,
    dimensions: source.dimensions,
    protectedCharacteristicAnalysisState: 'NOT-DESIGNED',
    intersectionalAnalysisState: 'NOT-DESIGNED',
    aggregateCanOverrideHarm: false,
    weightedCanReplaceUnweighted: false,
    missingOrHarmCanBeAveragedAway: false,
    smallCellPolicy: 'SUPPRESS-NOT-INFER',
    coverageState: 'PLANNED-ONLY',
    results: [],
  }
}

function missingnessPlan() {
  return {
    expectedSources: ['future-authorized-aggregate-protocol-only'],
    kinds: ['attrition', 'measurement-failure', 'non-response', 'not-covered', 'suppressed-for-privacy', 'unknown'],
    missingNotZero: true,
    missingNotNoEffect: true,
    completeCaseDefault: false,
    imputationState: 'NOT-DESIGNED',
    sensitivityAnalysisState: 'NOT-DESIGNED',
    stopIfCriticalClassUnobserved: true,
    results: [],
  }
}

function processPlan(design) {
  return {
    state: 'DESIGN-DRAFT',
    domains: ['accessibility', 'comprehension', 'fidelity', 'implementation', 'reach'],
    measureIds: design.measures.filter((measure) => ['process', 'qualitative'].includes(measure.role)).map((measure) => measure.id),
    canEstablishImpact: false,
    canEstablishCausality: false,
    result: null,
  }
}

function impactPlan(design) {
  return {
    state: 'DESIGN-DRAFT',
    estimandIds: design.estimands.map((estimand) => estimand.id),
    candidateMethods: ['experimental-comparison', 'quasi-experimental-comparison', 'theory-based-contribution-analysis'],
    methodSelected: false,
    comparatorFeasibility: 'UNKNOWN',
    assignmentFeasibility: 'UNKNOWN',
    spilloverAndInterferenceState: 'NOT-ASSESSED',
    identificationAssumptionsState: 'NOT-ASSESSED',
    unintendedOutcomeGuardrailIds: design.guardrails.map((guardrail) => guardrail.id),
    canClaimAttribution: false,
    result: null,
  }
}

function economicPlan() {
  return {
    state: 'DESIGN-DRAFT',
    categories: ['distribution', 'maintenance', 'resource-use', 'uncertainty', 'unmonetisable-benefit', 'unmonetisable-harm', 'user-burden'],
    amounts: {
      benefits: null,
      costs: null,
      maintenance: null,
      userBurden: null,
    },
    benefitCostRatio: null,
    netPresentValue: null,
    valueForMoneyConclusion: false,
    spendingAuthority: false,
    result: null,
  }
}

function dataPlan(design) {
  return {
    datasetRefs: [],
    administrativeData: false,
    monitoringData: false,
    surveyData: false,
    qualitativeData: false,
    dataCollection: false,
    linkage: false,
    retentionState: 'NOT-DESIGNED',
    futureRequirements: [
      'Any future data proposal requires a new major contract and separate authority.',
      'Any future protocol must define access, quality, provenance, retention and deletion before collection.',
    ],
    qualityRisks: [
      'coverage and missingness are unknown',
      'measurement definitions remain unsealed',
      `no dataset exists for ${design.id}`,
    ],
  }
}

function privacyEthicsPlan() {
  return {
    personalData: false,
    specialCategoryData: false,
    criminalOffenceData: false,
    humanParticipants: false,
    lawfulBasisState: 'NOT-ASSESSED',
    purposeCompatibilityState: 'NOT-ASSESSED',
    dpiaState: 'NOT-STARTED',
    ethicsState: 'REQUIRED-NOT-COMPLETED',
    consentState: 'NOT-APPLICABLE-PHASE-0',
    reidentificationRiskState: 'NOT-ASSESSED',
    publicMicrodata: false,
    rawFeedback: false,
    futureChangeRequiresNewMajorContract: true,
  }
}

function affectedPartyPlan(classes) {
  return {
    state: 'MAPPED-NOT-ENGAGED',
    classes,
    participantRecords: [],
    contactRecords: [],
    engagementRecords: [],
    participationIsRepresentation: false,
    participationIsConsent: false,
    participationIsEndorsement: false,
    silenceIsAcceptance: false,
  }
}

function qualityAssurancePlan() {
  return {
    state: 'NOT-PERFORMED',
    analystRole: 'FUTURE-UNASSIGNED',
    assurerRole: 'FUTURE-INDEPENDENT-UNASSIGNED',
    analystAndAssurerDistinct: true,
    reproducibilityPlanState: 'NOT-DESIGNED',
    peerReviewState: 'NOT-PERFORMED',
    signOffState: 'NOT-PERFORMED',
    qualityAssuranceIsApproval: false,
    records: [],
  }
}

function designInterpretationRules(globalRules, designId) {
  const domainRules = {
    'design:four-nation-information-orientation': [
      'territory-branch-is-not-competence-answer',
      'comparison-matrix-is-not-equivalence',
      'missing-territory-is-not-no-difference',
    ],
    'design:hmrc-notice-route-orientation': [
      'route-distinction-is-not-route-recommendation',
      'uncertainty-label-is-not-deadline-assurance',
      'synthetic-notice-is-not-advice-or-case-handling',
    ],
    'design:public-money-category-orientation': [
      'category-link-is-not-authority-chain',
      'payment-or-settlement-is-not-liability-or-spending',
      'representation-cannot-trace-a-labelled-pound',
    ],
  }
  return {
    globalRuleIds: globalRules,
    domainRuleIds: domainRules[designId],
    automaticDecisionEffect: 'NONE',
  }
}

function withholdingPolicy() {
  return {
    phase0ResultsExist: false,
    rawDataPublished: false,
    withholdingDecisionState: 'NOT-APPLICABLE-NO-RESULT',
    allowedGrounds: [
      'confidentiality',
      'legal-restriction',
      'privacy-and-data-protection',
      'rights-and-licensing',
      'risk-of-harm',
      'security',
    ],
    outcomeDirectionIsAllowedGround: false,
    reasonAndScopeMustBeRecorded: true,
    minimumNecessaryWithholding: true,
    redactionAggregationOrPartialPublicationMustBeConsidered: true,
    decisionAuthority: 'OUTSIDE-SYSTEM',
    humanReviewRequired: true,
    humanReviewCompleted: false,
    publicNoticeState: 'NOT-APPLICABLE-PHASE-0',
  }
}

function publicationPlan() {
  return {
    state: 'PHASE-0-DESIGN-ONLY',
    protocolRegistered: false,
    resultsExist: false,
    resultRoutes: [],
    technicalAnnexRequired: true,
    methodDeviationsRequired: true,
    uncertaintyRequired: true,
    distributionRequired: true,
    negativeAndNullResultsInScope: true,
    publicationAuthority: 'OUTSIDE-SYSTEM',
    publicationDecisionRecords: [],
    withholdingPolicy: withholdingPolicy(),
  }
}

function nullResultPolicy() {
  return {
    outcomeBasedSuppressionAllowed: false,
    negativeOrNullOutcomeAloneCannotJustifySuppression: true,
    selectiveOutcomeReportingForbidden: true,
    publicationSubjectToGovernedWithholding: true,
    privacyRightsLegalSecurityPrecedence: true,
    restrictedMaterialCannotBeReplacedByMisleadingPositiveSummary: true,
    noResultIsNullResult: false,
    nullIsNoEffect: false,
    nullIsFailure: false,
    nullIsSuccess: false,
    equivalenceRequiresMarginAndDesign: true,
    inconclusivePreserved: true,
    interpretationRequiresHumanReview: true,
  }
}

function threatModel() {
  return {
    hostilePromptTextInert: true,
    htmlTextInert: true,
    urlTextInert: true,
    consumerMustEscapeUntrustedText: true,
    sourceUrlAllowlistEnforced: true,
    forbiddenTrialFieldScannerApplied: true,
    actionSurface: 'NONE',
    threats: [
      'authority-laundering',
      'category-collapse',
      'hostile-text-execution',
      'missingness-erasure',
      'outcome-selective-publication',
      'participant-or-data-scope-creep',
      'scalar-score-collapse',
      'trial-plan-duplication',
    ],
  }
}

function enrichDesign(source, config) {
  const withoutReceipt = normalize({
    id: source.id,
    title: source.title,
    synthetic: true,
    state: STATE,
    transformationBinding: source.transformationBinding,
    purpose: source.purpose,
    evaluationQuestions: source.evaluationQuestions,
    theoryBinding: source.theoryBinding,
    evaluationTypeContract: commonEvaluationTypeContract(),
    comparators: source.comparators,
    estimands: source.estimands,
    measures: source.measures,
    guardrails: source.guardrails,
    distributionPlan: distributionPlan(source.distribution),
    missingnessPlan: missingnessPlan(),
    processEvaluationPlan: processPlan(source),
    impactEvaluationPlan: impactPlan(source),
    economicEvaluationPlan: economicPlan(),
    dataPlan: dataPlan(source),
    privacyEthicsPlan: privacyEthicsPlan(),
    affectedPartyPlan: affectedPartyPlan(source.affectedPartyClasses),
    qualityAssurancePlan: qualityAssurancePlan(),
    deviations: [],
    interpretationRules: designInterpretationRules(config.interpretationRules, source.id),
    stopRules: source.stopRules,
    publicationPlan: publicationPlan(),
    nullResultPolicy: nullResultPolicy(),
    humanGates: source.humanGates,
    threatModel: threatModel(),
    boundaries: config.boundaries,
  })
  return normalize({ ...withoutReceipt, canonicalReceipt: sha256Json(withoutReceipt) })
}

function sourceProjectionFromExpanded(design) {
  return {
    id: design.id,
    title: design.title,
    transformationBinding: design.transformationBinding,
    purpose: design.purpose,
    evaluationQuestions: design.evaluationQuestions,
    theoryBinding: design.theoryBinding,
    comparators: design.comparators,
    estimands: design.estimands,
    measures: design.measures,
    guardrails: design.guardrails,
    distribution: {
      unit: design.distributionPlan?.unit,
      territories: design.distributionPlan?.territories,
      affectedPartyClassIds: design.distributionPlan?.affectedPartyClassIds,
      dimensions: design.distributionPlan?.dimensions,
    },
    affectedPartyClasses: design.affectedPartyPlan?.classes,
    stopRules: design.stopRules,
    humanGates: design.humanGates,
  }
}

function outputDesignIssues(design, config, transformation) {
  const issues = []
  issues.push(...designSourceIssues(sourceProjectionFromExpanded(design), config, transformation))
  if (!exactValue(design.state, STATE) || design.synthetic !== true || !exactValue(design.boundaries, config.boundaries)) {
    issues.push(semantic(`${design.id}: expanded state, synthetic marker or boundaries mismatch`))
  }
  if (!exactValue(design.evaluationTypeContract, commonEvaluationTypeContract())) {
    issues.push(semantic(`${design.id}: evaluation-type separation contract mismatch`))
  }
  if (design.deviations.length !== 0) issues.push(semantic(`${design.id}: Phase-0 deviations must remain exactly empty`))
  if (design.processEvaluationPlan.state !== 'DESIGN-DRAFT'
    || !exactValue(design.processEvaluationPlan.domains, ['accessibility', 'comprehension', 'fidelity', 'implementation', 'reach'])
    || design.processEvaluationPlan.canEstablishImpact !== false || design.processEvaluationPlan.canEstablishCausality !== false
    || design.impactEvaluationPlan.state !== 'DESIGN-DRAFT'
    || design.impactEvaluationPlan.methodSelected !== false || design.impactEvaluationPlan.canClaimAttribution !== false
    || design.impactEvaluationPlan.comparatorFeasibility !== 'UNKNOWN'
    || design.impactEvaluationPlan.assignmentFeasibility !== 'UNKNOWN'
    || design.economicEvaluationPlan.state !== 'DESIGN-DRAFT'
    || design.economicEvaluationPlan.valueForMoneyConclusion !== false || design.economicEvaluationPlan.spendingAuthority !== false) {
    issues.push(semantic(`${design.id}: evaluation-type claim firewall mismatch`))
  }
  if (Object.values(design.economicEvaluationPlan.amounts).some((value) => value !== null)
    || design.economicEvaluationPlan.benefitCostRatio !== null || design.economicEvaluationPlan.netPresentValue !== null
    || design.economicEvaluationPlan.result !== null || design.processEvaluationPlan.result !== null
    || design.impactEvaluationPlan.result !== null) issues.push(semantic(`${design.id}: plan result or economic amount is present`))
  if (design.distributionPlan.aggregateCanOverrideHarm !== false || design.distributionPlan.weightedCanReplaceUnweighted !== false
    || design.distributionPlan.missingOrHarmCanBeAveragedAway !== false || design.distributionPlan.results.length !== 0
    || design.distributionPlan.protectedCharacteristicAnalysisState !== 'NOT-DESIGNED'
    || design.distributionPlan.intersectionalAnalysisState !== 'NOT-DESIGNED'
    || design.distributionPlan.smallCellPolicy !== 'SUPPRESS-NOT-INFER'
    || design.distributionPlan.coverageState !== 'PLANNED-ONLY'
    || design.missingnessPlan.missingNotZero !== true || design.missingnessPlan.missingNotNoEffect !== true
    || design.missingnessPlan.completeCaseDefault !== false || design.missingnessPlan.stopIfCriticalClassUnobserved !== true
    || design.missingnessPlan.imputationState !== 'NOT-DESIGNED'
    || design.missingnessPlan.sensitivityAnalysisState !== 'NOT-DESIGNED'
    || design.missingnessPlan.results.length !== 0) {
    issues.push(semantic(`${design.id}: distribution or missingness firewall mismatch`))
  }
  if (Object.values(design.dataPlan).filter((value) => typeof value === 'boolean').some((value) => value !== false)
    || design.dataPlan.datasetRefs.length !== 0 || design.affectedPartyPlan.participantRecords.length !== 0
    || design.affectedPartyPlan.contactRecords.length !== 0 || design.affectedPartyPlan.engagementRecords.length !== 0) {
    issues.push(semantic(`${design.id}: data or participant records must remain absent`))
  }
  const privacy = design.privacyEthicsPlan
  if (privacy.personalData !== false || privacy.specialCategoryData !== false || privacy.criminalOffenceData !== false
    || privacy.humanParticipants !== false || privacy.dpiaState !== 'NOT-STARTED'
    || privacy.lawfulBasisState !== 'NOT-ASSESSED' || privacy.purposeCompatibilityState !== 'NOT-ASSESSED'
    || privacy.ethicsState !== 'REQUIRED-NOT-COMPLETED' || privacy.consentState !== 'NOT-APPLICABLE-PHASE-0'
    || privacy.reidentificationRiskState !== 'NOT-ASSESSED' || privacy.publicMicrodata !== false
    || privacy.rawFeedback !== false || privacy.futureChangeRequiresNewMajorContract !== true) {
    issues.push(semantic(`${design.id}: privacy/ethics Phase-0 boundary mismatch`))
  }
  const affected = design.affectedPartyPlan
  if (affected.state !== 'MAPPED-NOT-ENGAGED' || affected.participantRecords.length !== 0
    || affected.contactRecords.length !== 0 || affected.engagementRecords.length !== 0
    || affected.participationIsRepresentation !== false || affected.participationIsConsent !== false
    || affected.participationIsEndorsement !== false || affected.silenceIsAcceptance !== false) {
    issues.push(semantic(`${design.id}: affected-party participation and representation contract mismatch`))
  }
  const qa = design.qualityAssurancePlan
  if (qa.state !== 'NOT-PERFORMED' || qa.analystAndAssurerDistinct !== true
    || qa.reproducibilityPlanState !== 'NOT-DESIGNED' || qa.peerReviewState !== 'NOT-PERFORMED'
    || qa.signOffState !== 'NOT-PERFORMED' || qa.qualityAssuranceIsApproval !== false || qa.records.length !== 0
    || qa.analystRole === qa.assurerRole) {
    issues.push(semantic(`${design.id}: independent analytical quality-assurance contract mismatch`))
  }
  const publication = design.publicationPlan
  const withholding = publication.withholdingPolicy
  if (publication.resultsExist !== false || publication.protocolRegistered !== false || publication.resultRoutes.length !== 0
    || publication.technicalAnnexRequired !== true || publication.methodDeviationsRequired !== true
    || publication.uncertaintyRequired !== true || publication.distributionRequired !== true
    || publication.negativeAndNullResultsInScope !== true || publication.publicationAuthority !== 'OUTSIDE-SYSTEM'
    || publication.publicationDecisionRecords.length !== 0 || withholding.phase0ResultsExist !== false
    || withholding.rawDataPublished !== false || withholding.outcomeDirectionIsAllowedGround !== false
    || withholding.reasonAndScopeMustBeRecorded !== true || withholding.minimumNecessaryWithholding !== true
    || withholding.redactionAggregationOrPartialPublicationMustBeConsidered !== true
    || withholding.humanReviewRequired !== true || withholding.humanReviewCompleted !== false
    || withholding.decisionAuthority !== 'OUTSIDE-SYSTEM'
    || withholding.withholdingDecisionState !== 'NOT-APPLICABLE-NO-RESULT'
    || withholding.publicNoticeState !== 'NOT-APPLICABLE-PHASE-0'
    || !exactValue(withholding.allowedGrounds, [
      'confidentiality', 'legal-restriction', 'privacy-and-data-protection',
      'rights-and-licensing', 'risk-of-harm', 'security',
    ])) {
    issues.push(semantic(`${design.id}: publication or governed-withholding contract mismatch`))
  }
  const nulls = design.nullResultPolicy
  if (nulls.outcomeBasedSuppressionAllowed !== false || nulls.negativeOrNullOutcomeAloneCannotJustifySuppression !== true
    || nulls.selectiveOutcomeReportingForbidden !== true || nulls.publicationSubjectToGovernedWithholding !== true
    || nulls.privacyRightsLegalSecurityPrecedence !== true || nulls.restrictedMaterialCannotBeReplacedByMisleadingPositiveSummary !== true
    || nulls.noResultIsNullResult !== false || nulls.nullIsNoEffect !== false || nulls.nullIsFailure !== false
    || nulls.nullIsSuccess !== false || nulls.equivalenceRequiresMarginAndDesign !== true || nulls.inconclusivePreserved !== true
    || nulls.interpretationRequiresHumanReview !== true) {
    issues.push(semantic(`${design.id}: null-result and outcome-neutral transparency contract mismatch`))
  }
  if (design.humanGates.length !== 6 || design.humanGates.some((gate) => gate.required !== true
    || gate.completed !== false || gate.authorityOutsideSystem !== true || gate.authorityEffect !== 'NONE')) {
    issues.push(semantic(`${design.id}: human gates must remain required, incomplete and outside-system`))
  }
  if (design.threatModel.hostilePromptTextInert !== true || design.threatModel.htmlTextInert !== true
    || design.threatModel.urlTextInert !== true || design.threatModel.consumerMustEscapeUntrustedText !== true
    || design.threatModel.sourceUrlAllowlistEnforced !== true || design.threatModel.forbiddenTrialFieldScannerApplied !== true
    || design.threatModel.actionSurface !== 'NONE') {
    issues.push(semantic(`${design.id}: inert-content threat model mismatch`))
  }
  const { canonicalReceipt, ...receiptTarget } = design
  if (sha256Json(receiptTarget) !== canonicalReceipt) issues.push(semantic(`${design.id}: canonical design receipt mismatch`))
  issues.push(...scanForbiddenTrialFields(design, `$/designs/${design.id}`))
  issues.push(...scanPersonalRecordShapes(design, `$/designs/${design.id}`))
  return issues
}

export function expandedDesignIssues(design, inputs = loadInputs()) {
  return [...new Set(outputDesignIssues(design, inputs.config, inputs.transformation))].sort()
}

function countsFor(designs, sources) {
  const sum = (selector) => designs.reduce((count, design) => count + selector(design).length, 0)
  return {
    affectedPartyClasses: sum((design) => design.affectedPartyPlan.classes),
    comparators: sum((design) => design.comparators),
    designs: designs.length,
    deviations: sum((design) => design.deviations),
    estimands: sum((design) => design.estimands),
    evaluationQuestions: sum((design) => design.evaluationQuestions),
    guardrails: sum((design) => design.guardrails),
    humanGates: sum((design) => design.humanGates),
    measures: sum((design) => design.measures),
    methodSources: sources.length,
    stopRules: sum((design) => design.stopRules),
  }
}

export function schemaReceiptIssues(schema = loadSchema(), bytes = readBoundedBytes(SCHEMA_PATH)) {
  const issues = []
  if (sha256Bytes(bytes) !== RECEIPTS.schemaByte) issues.push('schema byte receipt differs from the frozen contract')
  if (sha256Json(schema) !== RECEIPTS.schemaCanonical) issues.push('schema canonical receipt differs from the frozen contract')
  return issues
}

export function buildSnapshot() {
  const inputs = loadInputs()
  const issues = semanticIssues(inputs)
  if (issues.length !== 0) throw new Error(`evaluation covenant input validation failed:\n- ${issues.join('\n- ')}`)
  const { config, sources } = inputs
  const designs = inputs.designs.map((design) => enrichDesign(design, config))
  for (const design of designs) issues.push(...outputDesignIssues(design, config, inputs.transformation))
  if (issues.length !== 0) throw new Error(`evaluation covenant expansion validation failed:\n- ${[...new Set(issues)].sort().join('\n- ')}`)
  const snapshot = normalize({
    schema: config.protocol,
    contractVersion: config.contractVersion,
    title: config.title,
    asOf: config.asOf,
    urls: config.urls,
    authorship: config.authorship,
    phase: config.phase,
    covenantState: config.covenantState,
    freshness: config.freshness,
    lineage: config.lineage,
    trialChamberSeparation: config.trialChamberSeparation,
    interpretationRules: config.interpretationRules,
    boundaries: config.boundaries,
    sourceLedgerPolicy: config.sourceLedgerPolicy,
    sources,
    designs,
    counts: countsFor(designs, sources),
    buildProvenance: {
      deterministic: true,
      offline: true,
      networkUsed: false,
      clockRead: false,
      exactInputCanonicalReceipts: {
        config: CONFIG_RECEIPT,
        designs: DESIGNS_RECEIPT,
        sources: SOURCES_RECEIPT,
      },
      schemaByteReceipt: RECEIPTS.schemaByte,
      schemaCanonicalReceipt: RECEIPTS.schemaCanonical,
      transformationSnapshotByteReceipt: RECEIPTS.transformationByte,
      transformationSnapshotCanonicalReceipt: RECEIPTS.transformationCanonical,
      transformationSchemaByteReceipt: RECEIPTS.transformationSchemaByte,
      transformationGuideByteReceipt: RECEIPTS.transformationGuideByte,
      governmentSnapshotByteReceipt: RECEIPTS.governmentByte,
      governmentSnapshotCanonicalReceipt: RECEIPTS.governmentCanonical,
    },
    relatedResources: config.relatedResources,
  })
  const schema = loadSchema()
  const receiptIssues = schemaReceiptIssues(schema)
  if (receiptIssues.length !== 0) throw new Error(`schema receipt validation failed:\n- ${receiptIssues.join('\n- ')}`)
  const schemaIssues = schemaDocumentIssues(schema)
  if (schemaIssues.length !== 0) throw new Error(`schema contract validation failed:\n- ${schemaIssues.join('\n- ')}`)
  const validationIssues = validateWithSchema(snapshot, schema)
  if (validationIssues.length !== 0) throw new Error(`public snapshot schema validation failed:\n- ${validationIssues.join('\n- ')}`)
  return snapshot
}

export function writeSnapshot() {
  const snapshot = buildSnapshot()
  const text = prettyCanonicalJson(snapshot)
  atomicWritePublicSnapshot(text)
  const bytes = readBoundedBytes(PUBLIC_SNAPSHOT)
  return {
    path: PUBLIC_SNAPSHOT,
    snapshot,
    bytes: bytes.byteLength,
    byteReceipt: sha256Bytes(bytes),
    canonicalReceipt: sha256Json(snapshot),
  }
}

export function validateCheckedInSnapshot() {
  const snapshot = buildSnapshot()
  const expected = prettyCanonicalJson(snapshot)
  if (!existsSync(PUBLIC_SNAPSHOT)) return { current: false, snapshot }
  const bytes = readBoundedBytes(PUBLIC_SNAPSHOT)
  const checked = parseJsonBytes(bytes, 'checked-in evaluation covenant snapshot')
  const validationIssues = validateWithSchema(checked)
  if (validationIssues.length !== 0) throw new Error(`checked-in snapshot schema validation failed:\n- ${validationIssues.join('\n- ')}`)
  return {
    current: bytes.equals(Buffer.from(expected, 'utf8')),
    snapshot,
    bytes: bytes.byteLength,
    byteReceipt: sha256Bytes(bytes),
    canonicalReceipt: sha256Json(checked),
  }
}

export const expectedReceipts = RECEIPTS
