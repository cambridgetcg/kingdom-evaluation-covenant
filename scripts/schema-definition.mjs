import { prettyCanonicalJson } from '../src/io.mjs'

const ref = (name) => ({ $ref: `#/$defs/${name}` })
const string = (options = {}) => ({ type: 'string', minLength: 1, maxLength: 4096, ...options })
const constant = (value) => ({ type: typeof value, const: value })
const booleanConstant = (value) => ({ type: 'boolean', const: value })
const nullValue = () => ({ type: 'null', const: null })
const nullableString = () => ({ type: ['string', 'null'], maxLength: 4096 })
const integer = (minimum = 0, maximum = 1_000_000) => ({ type: 'integer', minimum, maximum })
const array = (items, minimum = 0, maximum = 256, unique = false) => ({
  type: 'array',
  items,
  minItems: minimum,
  maxItems: maximum,
  ...(unique ? { uniqueItems: true } : {}),
})
const strings = (minimum = 0, maximum = 256) => array(string(), minimum, maximum, true)
const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
const id = () => string({ pattern: '^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+$', maxLength: 160 })
const receipt = () => string({ pattern: '^sha256:[0-9a-f]{64}$', maxLength: 71 })
const uri = () => string({ format: 'uri', maxLength: 2048 })
const date = () => string({ format: 'date', maxLength: 10 })

const state = object({
  adoptionEffect: constant('NONE'),
  approvalState: constant('NOT-APPROVED'),
  designState: constant('DRAFT'),
  registrationState: constant('UNREGISTERED'),
  resultState: constant('NO-RESULT'),
  runState: constant('NO-RUN'),
  sealState: constant('UNSEALED'),
  useAuthorityEffect: constant('NONE'),
})

const boundaries = object({
  acceptsFreeText: booleanConstant(false),
  accountAccess: booleanConstant(false),
  adoption: booleanConstant(false),
  advice: booleanConstant(false),
  approval: booleanConstant(false),
  artifactAcquisition: booleanConstant(false),
  artifactExecution: booleanConstant(false),
  automatedAction: booleanConstant(false),
  automatedDecision: booleanConstant(false),
  automaticProgression: booleanConstant(false),
  causalClaim: booleanConstant(false),
  credentialAccess: booleanConstant(false),
  credentialCollection: booleanConstant(false),
  dataCollection: booleanConstant(false),
  datasetAcquisition: booleanConstant(false),
  decisionAuthority: booleanConstant(false),
  deployment: booleanConstant(false),
  economicConclusion: booleanConstant(false),
  eligibilityDetermination: booleanConstant(false),
  ethicsApproval: booleanConstant(false),
  evaluationRegistration: booleanConstant(false),
  evaluationResult: booleanConstant(false),
  evaluationRun: booleanConstant(false),
  externalEffects: booleanConstant(false),
  filing: booleanConstant(false),
  governmentAffiliation: booleanConstant(false),
  identityAccess: booleanConstant(false),
  identityCollection: booleanConstant(false),
  legalAdvice: booleanConstant(false),
  legalConclusion: booleanConstant(false),
  liabilityDetermination: booleanConstant(false),
  liveData: booleanConstant(false),
  llmRuntime: booleanConstant(false),
  mcpExposure: booleanConstant(false),
  networkAtBuildOrRuntime: booleanConstant(false),
  officialEndorsement: booleanConstant(false),
  optionSelection: booleanConstant(false),
  participantRecruitment: booleanConstant(false),
  payment: booleanConstant(false),
  personalData: booleanConstant(false),
  personalDataCollection: booleanConstant(false),
  preferredOption: booleanConstant(false),
  procurement: booleanConstant(false),
  publicForm: booleanConstant(false),
  ranking: booleanConstant(false),
  recommendation: booleanConstant(false),
  runtimeFetch: booleanConstant(false),
  scalarScore: booleanConstant(false),
  sealCreated: booleanConstant(false),
  spending: booleanConstant(false),
  submission: booleanConstant(false),
  taxAdvice: booleanConstant(false),
  taxConclusion: booleanConstant(false),
  transaction: booleanConstant(false),
  trialAuthority: booleanConstant(false),
  trialPlanCreated: booleanConstant(false),
  trialRun: booleanConstant(false),
  useAuthority: booleanConstant(false),
  valueForMoneyConclusion: booleanConstant(false),
})

const transformationBinding = object({
  assumptionNodeIds: array(id(), 1, 8, true),
  dossierCanonicalReceipt: receipt(),
  dossierId: id(),
  evaluationNeedNodeId: id(),
  humanGateIds: array(id(), 2, 8, true),
  negativePathwayNodeIds: array(id(), 1, 8, true),
  optionIds: array(id(), 3, 3, true),
  propositionCanonicalReceipt: receipt(),
  transformationOutcomeId: id(),
  useAsEvidence: booleanConstant(false),
})

const question = object({
  affectedPartyClassIds: array(id(), 1, 16, true),
  answerState: constant('NOT-ANSWERED'),
  authorityEffect: constant('NONE'),
  id: id(),
  measureIds: array(id(), 1, 16, true),
  result: nullValue(),
  text: string(),
  transformationOutcomeIds: array(id(), 1, 4, true),
  type: string({ enum: ['process', 'impact', 'economic'], maxLength: 8 }),
})

const theoryEdge = object({
  edgeId: id(),
  fromId: id(),
  toId: id(),
})

const theoryBinding = object({
  assumptionNodeIds: array(id(), 1, 8, true),
  claimsCausalTruth: booleanConstant(false),
  copiedNarrative: booleanConstant(false),
  desiredOutcomeId: id(),
  evaluationNeedNodeId: id(),
  negativePathwayNodeIds: array(id(), 1, 8, true),
  optionToOutputEdges: array(theoryEdge, 3, 3, true),
  tested: booleanConstant(false),
  theoryValidated: booleanConstant(false),
})

const evaluationTypeContract = object({
  distinctQuestionTypes: array(string({ enum: ['economic', 'impact', 'process'], maxLength: 8 }), 3, 3, true),
  economicCannotSatisfyImpact: booleanConstant(true),
  impactCannotEstablishValueForMoney: booleanConstant(true),
  oneTypeCannotSatisfyAnother: booleanConstant(true),
  processCannotEstablishCausality: booleanConstant(true),
  processCannotEstablishImpact: booleanConstant(true),
})

const comparator = object({
  assigned: booleanConstant(false),
  description: string(),
  exposureState: constant('NONE'),
  id: id(),
  implemented: booleanConstant(false),
  role: string({ enum: ['business-as-usual', 'candidate-alternative'], maxLength: 24 }),
  selected: booleanConstant(false),
  transformationOptionId: id(),
})

const estimand = object({
  causalStatus: constant('NOT-CLAIMED'),
  contrast: string(),
  estimate: nullValue(),
  id: id(),
  identificationState: constant('NOT-ASSESSED'),
  impactQuestionId: id(),
  interferenceAssumption: constant('NOT-ASSESSED'),
  label: string(),
  outcomeMeasureId: id(),
  population: string(),
  referenceComparatorId: id(),
  timeHorizon: constant('NOT-DESIGNED'),
  treatmentComparatorId: id(),
  uncertainty: nullValue(),
  unitOfAnalysis: constant('NOT-DESIGNED'),
})

const measure = object({
  authorityEffect: constant('NONE'),
  collectionMethodState: string({ enum: ['NOT-DESIGNED', 'SYNTHETIC-PROTOCOL-ONLY'], maxLength: 24 }),
  construct: string(),
  definition: string(),
  definitionFrozen: booleanConstant(false),
  denominatorDefinition: nullValue(),
  gamingHazardIds: array(id(), 0, 16, true),
  guardrailIds: array(id(), 0, 16, true),
  id: id(),
  label: string(),
  limitations: string(),
  numeratorDefinition: nullValue(),
  population: string(),
  questionIds: array(id(), 1, 8, true),
  role: string({ enum: ['process', 'outcome', 'economic', 'qualitative'], maxLength: 11 }),
  sourceRefs: array(id(), 0, 0, true),
  targetStatus: constant('NOT-A-TARGET'),
  unit: string(),
  value: nullValue(),
  window: constant('NOT-DESIGNED'),
})

const guardrail = object({
  breachState: constant('NOT-OBSERVED'),
  forbiddenInference: string(),
  id: id(),
  linkedMeasureIds: array(id(), 1, 16, true),
  observationRule: string(),
  protectsAgainst: array(id(), 1, 8, true),
  result: nullValue(),
  stopsInterpretation: booleanConstant(true),
  threshold: nullValue(),
})

const distributionPlan = object({
  affectedPartyClassIds: array(id(), 1, 16, true),
  aggregateCanOverrideHarm: booleanConstant(false),
  coverageState: constant('PLANNED-ONLY'),
  dimensions: strings(4, 16),
  intersectionalAnalysisState: constant('NOT-DESIGNED'),
  missingOrHarmCanBeAveragedAway: booleanConstant(false),
  protectedCharacteristicAnalysisState: constant('NOT-DESIGNED'),
  results: array(object({}), 0, 0),
  smallCellPolicy: constant('SUPPRESS-NOT-INFER'),
  territories: strings(1, 4),
  unit: string(),
  weightedCanReplaceUnweighted: booleanConstant(false),
})

const missingnessPlan = object({
  completeCaseDefault: booleanConstant(false),
  expectedSources: strings(1, 8),
  imputationState: constant('NOT-DESIGNED'),
  kinds: array(string({ enum: ['non-response', 'attrition', 'not-covered', 'suppressed-for-privacy', 'measurement-failure', 'unknown'], maxLength: 24 }), 6, 6, true),
  missingNotNoEffect: booleanConstant(true),
  missingNotZero: booleanConstant(true),
  results: array(object({}), 0, 0),
  sensitivityAnalysisState: constant('NOT-DESIGNED'),
  stopIfCriticalClassUnobserved: booleanConstant(true),
})

const processEvaluationPlan = object({
  canEstablishCausality: booleanConstant(false),
  canEstablishImpact: booleanConstant(false),
  domains: strings(5, 5),
  measureIds: array(id(), 1, 16, true),
  result: nullValue(),
  state: constant('DESIGN-DRAFT'),
})

const impactEvaluationPlan = object({
  assignmentFeasibility: constant('UNKNOWN'),
  canClaimAttribution: booleanConstant(false),
  candidateMethods: strings(3, 3),
  comparatorFeasibility: constant('UNKNOWN'),
  estimandIds: array(id(), 2, 16, true),
  identificationAssumptionsState: constant('NOT-ASSESSED'),
  methodSelected: booleanConstant(false),
  result: nullValue(),
  spilloverAndInterferenceState: constant('NOT-ASSESSED'),
  state: constant('DESIGN-DRAFT'),
  unintendedOutcomeGuardrailIds: array(id(), 1, 16, true),
})

const economicAmounts = object({
  benefits: nullValue(),
  costs: nullValue(),
  maintenance: nullValue(),
  userBurden: nullValue(),
})

const economicEvaluationPlan = object({
  amounts: economicAmounts,
  benefitCostRatio: nullValue(),
  categories: strings(7, 7),
  netPresentValue: nullValue(),
  result: nullValue(),
  spendingAuthority: booleanConstant(false),
  state: constant('DESIGN-DRAFT'),
  valueForMoneyConclusion: booleanConstant(false),
})

const dataPlan = object({
  administrativeData: booleanConstant(false),
  dataCollection: booleanConstant(false),
  datasetRefs: array(id(), 0, 0, true),
  futureRequirements: strings(2, 8),
  linkage: booleanConstant(false),
  monitoringData: booleanConstant(false),
  qualitativeData: booleanConstant(false),
  qualityRisks: strings(3, 8),
  retentionState: constant('NOT-DESIGNED'),
  surveyData: booleanConstant(false),
})

const privacyEthicsPlan = object({
  consentState: constant('NOT-APPLICABLE-PHASE-0'),
  criminalOffenceData: booleanConstant(false),
  dpiaState: constant('NOT-STARTED'),
  ethicsState: constant('REQUIRED-NOT-COMPLETED'),
  futureChangeRequiresNewMajorContract: booleanConstant(true),
  humanParticipants: booleanConstant(false),
  lawfulBasisState: constant('NOT-ASSESSED'),
  personalData: booleanConstant(false),
  publicMicrodata: booleanConstant(false),
  purposeCompatibilityState: constant('NOT-ASSESSED'),
  rawFeedback: booleanConstant(false),
  reidentificationRiskState: constant('NOT-ASSESSED'),
  specialCategoryData: booleanConstant(false),
})

const affectedPartyClass = object({
  accessibilityState: constant('NOT-ASSESSED'),
  burdenState: constant('NOT-ASSESSED'),
  compensationState: constant('NOT-ASSESSED'),
  digitalExclusionRisk: string(),
  dissentPreserved: booleanConstant(true),
  engagementState: constant('NOT-DESIGNED'),
  howAffectedHypothesis: string(),
  id: id(),
  languageState: constant('NOT-ASSESSED'),
  personalRecords: booleanConstant(false),
  representationState: constant('MAPPED-NOT-ENGAGED'),
  roleClass: string(),
  unrepresentedRisk: string(),
})

const affectedPartyPlan = object({
  classes: array(affectedPartyClass, 3, 8, true),
  contactRecords: array(object({}), 0, 0),
  engagementRecords: array(object({}), 0, 0),
  participantRecords: array(object({}), 0, 0),
  participationIsConsent: booleanConstant(false),
  participationIsEndorsement: booleanConstant(false),
  participationIsRepresentation: booleanConstant(false),
  silenceIsAcceptance: booleanConstant(false),
  state: constant('MAPPED-NOT-ENGAGED'),
})

const qualityAssurancePlan = object({
  analystAndAssurerDistinct: booleanConstant(true),
  analystRole: constant('FUTURE-UNASSIGNED'),
  assurerRole: constant('FUTURE-INDEPENDENT-UNASSIGNED'),
  peerReviewState: constant('NOT-PERFORMED'),
  qualityAssuranceIsApproval: booleanConstant(false),
  records: array(object({}), 0, 0),
  reproducibilityPlanState: constant('NOT-DESIGNED'),
  signOffState: constant('NOT-PERFORMED'),
  state: constant('NOT-PERFORMED'),
})

const designInterpretationRules = object({
  automaticDecisionEffect: constant('NONE'),
  domainRuleIds: strings(3, 8),
  globalRuleIds: strings(14, 14),
})

const stopRule = object({
  automatic: booleanConstant(false),
  authorityEffect: constant('NONE'),
  correctionOrWithdrawalState: constant('NOT-ACTIVATED'),
  effect: string({ enum: ['STOP-INTERPRETATION', 'PAUSE-FUTURE-DESIGN-REVIEW'], maxLength: 26 }),
  id: id(),
  observed: booleanConstant(false),
  owner: constant('OUTSIDE-SYSTEM'),
  trigger: string(),
})

const withholdingPolicy = object({
  allowedGrounds: array(string({ enum: ['privacy-and-data-protection', 'rights-and-licensing', 'legal-restriction', 'security', 'confidentiality', 'risk-of-harm'], maxLength: 27 }), 6, 6, true),
  decisionAuthority: constant('OUTSIDE-SYSTEM'),
  humanReviewCompleted: booleanConstant(false),
  humanReviewRequired: booleanConstant(true),
  minimumNecessaryWithholding: booleanConstant(true),
  outcomeDirectionIsAllowedGround: booleanConstant(false),
  phase0ResultsExist: booleanConstant(false),
  publicNoticeState: constant('NOT-APPLICABLE-PHASE-0'),
  rawDataPublished: booleanConstant(false),
  reasonAndScopeMustBeRecorded: booleanConstant(true),
  redactionAggregationOrPartialPublicationMustBeConsidered: booleanConstant(true),
  withholdingDecisionState: constant('NOT-APPLICABLE-NO-RESULT'),
})

const publicationPlan = object({
  distributionRequired: booleanConstant(true),
  methodDeviationsRequired: booleanConstant(true),
  negativeAndNullResultsInScope: booleanConstant(true),
  protocolRegistered: booleanConstant(false),
  publicationAuthority: constant('OUTSIDE-SYSTEM'),
  publicationDecisionRecords: array(object({}), 0, 0),
  resultRoutes: array(uri(), 0, 0, true),
  resultsExist: booleanConstant(false),
  state: constant('PHASE-0-DESIGN-ONLY'),
  technicalAnnexRequired: booleanConstant(true),
  uncertaintyRequired: booleanConstant(true),
  withholdingPolicy,
})

const nullResultPolicy = object({
  equivalenceRequiresMarginAndDesign: booleanConstant(true),
  inconclusivePreserved: booleanConstant(true),
  interpretationRequiresHumanReview: booleanConstant(true),
  negativeOrNullOutcomeAloneCannotJustifySuppression: booleanConstant(true),
  noResultIsNullResult: booleanConstant(false),
  nullIsFailure: booleanConstant(false),
  nullIsNoEffect: booleanConstant(false),
  nullIsSuccess: booleanConstant(false),
  outcomeBasedSuppressionAllowed: booleanConstant(false),
  privacyRightsLegalSecurityPrecedence: booleanConstant(true),
  publicationSubjectToGovernedWithholding: booleanConstant(true),
  restrictedMaterialCannotBeReplacedByMisleadingPositiveSummary: booleanConstant(true),
  selectiveOutcomeReportingForbidden: booleanConstant(true),
})

const humanGate = object({
  authorityEffect: constant('NONE'),
  authorityOutsideSystem: booleanConstant(true),
  completed: booleanConstant(false),
  id: id(),
  kind: string({ enum: ['independent-design-reviewer', 'analytical-qa-assurer-distinct-from-analyst', 'privacy-ethics-rights-review', 'affected-party-accessibility-distribution-review', 'inherited-transformation-domain-gate'], maxLength: 50 }),
  required: booleanConstant(true),
})

const threatModel = object({
  actionSurface: constant('NONE'),
  consumerMustEscapeUntrustedText: booleanConstant(true),
  forbiddenTrialFieldScannerApplied: booleanConstant(true),
  hostilePromptTextInert: booleanConstant(true),
  htmlTextInert: booleanConstant(true),
  sourceUrlAllowlistEnforced: booleanConstant(true),
  threats: strings(8, 8),
  urlTextInert: booleanConstant(true),
})

const design = object({
  affectedPartyPlan,
  boundaries,
  canonicalReceipt: receipt(),
  comparators: array(comparator, 3, 3, true),
  dataPlan,
  deviations: array(object({}), 0, 0),
  distributionPlan,
  economicEvaluationPlan,
  estimands: array(estimand, 2, 16, true),
  evaluationQuestions: array(question, 3, 3, true),
  evaluationTypeContract,
  guardrails: array(guardrail, 1, 16, true),
  humanGates: array(humanGate, 6, 6, true),
  id: id(),
  impactEvaluationPlan,
  interpretationRules: designInterpretationRules,
  measures: array(measure, 4, 8, true),
  missingnessPlan,
  nullResultPolicy,
  privacyEthicsPlan,
  processEvaluationPlan,
  publicationPlan,
  purpose: string(),
  qualityAssurancePlan,
  state,
  stopRules: array(stopRule, 3, 8, true),
  synthetic: booleanConstant(true),
  theoryBinding,
  threatModel,
  title: string(),
  transformationBinding,
})

const source = object({
  bodyReceipt: nullValue(),
  bodyRetained: booleanConstant(false),
  caveat: string(),
  checkedOn: date(),
  exactTextHumanReviewed: booleanConstant(false),
  genericOfficialHostIsEvidence: booleanConstant(false),
  id: id(),
  jurisdiction: string(),
  publisher: string(),
  rightsOrReuseInferred: booleanConstant(false),
  role: constant('method-or-governance-orientation-only'),
  sourceClass: string(),
  supportsAuthority: booleanConstant(false),
  supportsDossierOutcome: booleanConstant(false),
  supportsEstimand: booleanConstant(false),
  supportsResult: booleanConstant(false),
  title: string(),
  url: uri(),
})

const baseGovernmentLineage = object({
  asOf: date(),
  byteReceipt: receipt(),
  bytes: integer(196_005, 196_005),
  canonicalReceipt: receipt(),
  canonicalUrl: uri(),
  contextMode: constant('transitive-validation-context-only'),
  path: constant('vendor/government-engine/government-2026-08-21.json'),
  schema: constant('kingdom.government-engine-public-snapshot/0.1'),
  useAsEvidence: booleanConstant(false),
})

const dossierBinding = object({
  assumptionNodeIds: array(id(), 1, 8, true),
  dossierCanonicalReceipt: receipt(),
  dossierId: id(),
  evaluationNeedNodeId: id(),
  gateIds: array(id(), 2, 8, true),
  negativePathwayNodeIds: array(id(), 1, 8, true),
  optionIds: array(id(), 3, 3, true),
  outcomeId: id(),
  propositionCanonicalReceipt: receipt(),
})

const guideLineage = object({
  byteReceipt: receipt(),
  bytes: integer(6_770, 6_770),
  path: constant('vendor/transformation-engine/UK-GOVERNMENT-TRANSFORMATION-ENGINE-v0.1.md'),
  url: uri(),
})

const schemaLineage = object({
  byteReceipt: receipt(),
  bytes: integer(47_800, 47_800),
  canonicalReceipt: receipt(),
  path: constant('vendor/transformation-engine/public-snapshot.schema.json'),
  url: uri(),
})

const transformationLineage = object({
  asOf: date(),
  byteReceipt: receipt(),
  bytes: integer(83_915, 83_915),
  canonicalReceipt: receipt(),
  canonicalUrl: uri(),
  path: constant('vendor/transformation-engine/transformations-2026-08-21.json'),
  producerTag: uri(),
  schema: constant('kingdom.government-transformation-orientation-public-snapshot/0.1'),
})

const lineage = object({
  baseGovernment: baseGovernmentLineage,
  dossierBindings: array(dossierBinding, 3, 3, true),
  mode: constant('exact-synthetic-design-context-only'),
  transformationGuide: guideLineage,
  transformationSchema: schemaLineage,
  transformationSnapshot: transformationLineage,
  useAsEvidence: booleanConstant(false),
})

const relatedResource = object({
  authority: booleanConstant(false),
  contentProjected: booleanConstant(false),
  duplicatedContent: booleanConstant(false),
  evidence: booleanConstant(false),
  id: id(),
  navigationOnly: booleanConstant(true),
  relationship: string(),
  url: { type: ['string', 'null'] },
})

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://thekingdom.dev/evaluation/schemas/v0.1/public-snapshot.schema.json',
  title: 'KINGDOM Evaluation Covenant v0.1 public snapshot',
  ...object({
    schema: constant('kingdom.evaluation-covenant-public-snapshot/0.1'),
    contractVersion: constant('0.1.0'),
    title: constant('KINGDOM Evaluation Covenant: Synthetic Transformation Designs'),
    asOf: date(),
    urls: object({
      canonical: uri(),
      guide: uri(),
      human: uri(),
      mutableAlias: uri(),
      producer: uri(),
      repository: uri(),
      schema: uri(),
    }),
    authorship: object({
      compiledBy: constant('codex-assisted-publication'),
      exactTextHumanReviewed: booleanConstant(false),
      humanDirectionRecorded: booleanConstant(true),
      humanReviewCompleted: booleanConstant(false),
      humanReviewRequired: booleanConstant(true),
      origin: constant('maintainer-authorized-assisted-publication'),
    }),
    phase: object({
      id: constant('0-static-synthetic-design'),
      scope: constant('evaluation-design-only'),
    }),
    covenantState: state,
    freshness: object({
      historicalStateAfterDeadline: constant('HISTORICAL-DESIGN-ONLY'),
      mutableAliasPolicy: constant('REPLACE-OR-RETIRE'),
      nextReviewDue: date(),
      readerClockEmbedded: booleanConstant(false),
      releaseGateRequired: booleanConstant(true),
      reviewDeadlineInheritedFromTransformation: booleanConstant(true),
      stateAtPublication: constant('WITHIN-REVIEW-WINDOW'),
    }),
    lineage,
    trialChamberSeparation: object({
      duplicatesTrialPlan: booleanConstant(false),
      evaluationCovenantOwns: constant('intervention-level-evaluation-design-only'),
      forbiddenTrialPlanFields: strings(14, 14),
      trialChamberCompatibility: constant('not-applicable'),
      trialChamberOwns: constant('artifact-and-source-trial-planning'),
      trialChamberPlanRefs: array(id(), 0, 0, true),
    }),
    interpretationRules: strings(14, 14),
    boundaries,
    sourceLedgerPolicy: object({
      bodyOrRawHashRetained: booleanConstant(false),
      checkedDateProvesCurrentLegalEffect: booleanConstant(false),
      contentCopied: booleanConstant(false),
      exactTextHumanReviewed: booleanConstant(false),
      genericOfficialHostIsEvidence: booleanConstant(false),
      methodOrGovernanceOrientationOnly: booleanConstant(true),
      rightsOrReuseInferred: booleanConstant(false),
      sourceCanSupportAuthority: booleanConstant(false),
      sourceCanSupportDossierOutcome: booleanConstant(false),
      sourceCanSupportEstimand: booleanConstant(false),
      sourceCanSupportResult: booleanConstant(false),
      sourceCannotSupplyEmpiricalEstimandOrIdentification: booleanConstant(true),
      sourceMayOrientEstimandSpecification: booleanConstant(true),
      urlObservationProvesEndorsement: booleanConstant(false),
    }),
    sources: array(source, 10, 10, true),
    designs: array(design, 3, 3, true),
    counts: object({
      affectedPartyClasses: integer(10, 10),
      comparators: integer(9, 9),
      designs: integer(3, 3),
      deviations: integer(0, 0),
      estimands: integer(10, 10),
      evaluationQuestions: integer(9, 9),
      guardrails: integer(9, 9),
      humanGates: integer(18, 18),
      measures: integer(14, 14),
      methodSources: integer(10, 10),
      stopRules: integer(10, 10),
    }),
    buildProvenance: object({
      clockRead: booleanConstant(false),
      deterministic: booleanConstant(true),
      exactInputCanonicalReceipts: object({
        config: receipt(),
        designs: receipt(),
        sources: receipt(),
      }),
      governmentSnapshotByteReceipt: receipt(),
      governmentSnapshotCanonicalReceipt: receipt(),
      networkUsed: booleanConstant(false),
      offline: booleanConstant(true),
      schemaByteReceipt: receipt(),
      schemaCanonicalReceipt: receipt(),
      transformationGuideByteReceipt: receipt(),
      transformationSchemaByteReceipt: receipt(),
      transformationSnapshotByteReceipt: receipt(),
      transformationSnapshotCanonicalReceipt: receipt(),
    }),
    relatedResources: array(relatedResource, 2, 2, true),
  }),
  $defs: {
    affectedPartyClass,
    affectedPartyPlan,
    boundaries,
    comparator,
    dataPlan,
    design,
    designInterpretationRules,
    distributionPlan,
    economicEvaluationPlan,
    estimand,
    evaluationTypeContract,
    guardrail,
    humanGate,
    impactEvaluationPlan,
    lineage,
    measure,
    missingnessPlan,
    nullResultPolicy,
    privacyEthicsPlan,
    processEvaluationPlan,
    publicationPlan,
    qualityAssurancePlan,
    question,
    source,
    state,
    stopRule,
    theoryBinding,
    threatModel,
    transformationBinding,
    withholdingPolicy,
  },
}

export { schema }

if (process.argv[1] === new URL(import.meta.url).pathname) process.stdout.write(prettyCanonicalJson(schema))
