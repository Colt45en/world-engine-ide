import type { AuditEntry } from '../containment/types';

export type AlignmentField = {
  name: string;
  description: string;
  vector: number[];
  weight: number;
  threshold: number;
};

export type AlignmentScore = {
  fieldName: string;
  score: number;
  threshold: number;
  passed: boolean;
  delta: number;
};

export type SafetyIssue = {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedDimensions: number[];
  recommendation: string;
};

export type SafetyCheckResult = {
  passed: boolean;
  integrityScore: number;
  volatilityLevel: number;
  empathyPreserved: boolean;
  issues: SafetyIssue[];
  recommendations: string[];
};

export type EmpathyFieldMeasurement = {
  score: number;
  dimensions: number[];
  trend: 'increasing' | 'stable' | 'decreasing';
  concernLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
};

export type ReflectionDecision = {
  action: 'safeguard' | 'recalibrate' | 'rollback' | 'seal' | 'continue';
  reasoning: string;
  confidence: number;
  requiresHumanApproval: boolean;
  suggestedOperators: string[];
};

export type VisualizationHint = {
  type: string;
  target: string;
  color: string;
  intensity: number;
  duration: number;
  message: string;
};

export type ReflectionReport = {
  sessionId: string;
  timestamp: number;
  auditTrail: AuditEntry[];
  divergenceReport: unknown;
  empathyField: EmpathyFieldMeasurement;
  safetyCheck: SafetyCheckResult;
  alignmentScores: AlignmentScore[];
  decision: ReflectionDecision;
  narration: string;
  visualizationHints: VisualizationHint[];
};

export type CovenantEntry = {
  id: string;
  timestamp: number;
  sessionId: string;
  type: string;
  narration: string;
  state: unknown;
  empathyResonance: number;
  alignmentScore: number;
  metadata: {
    operatorsApplied: string[];
    divergenceFromBaseline: number;
    safetyProtocolsEngaged: string[];
    humanInvolved?: boolean;
    tags?: string[];
    [key: string]: unknown;
  };
};

export type SafetyLedgerEntry = {
  id: string;
  timestamp: number;
  sessionId: string;
  integrityScore: number;
  empathyScore: number;
  alignmentScore: number;
  passed: boolean;
  issues: string[];
};

export type CovenantRegistry = {
  id: string;
  createdAt: number;
  lastRecommitment: number;
  totalRecommitments: number;
  entries: CovenantEntry[];
  alignmentFields: AlignmentField[];
  safetyLedger: SafetyLedgerEntry[];
};

export type AtomEmission = {
  id: string;
  type: string;
  key: string;
  value: number;
  timestamp: number;
};

export type FractalWisdomCycleParams = {
  forkCount?: number;
  safeguardThreshold?: number;
};

export type FractalWisdomCycleResult = {
  sessionId: string;
  startTime: number;
  endTime: number;
  stepsExecuted: string[];
  atomsEmitted: AtomEmission[];
  forksCreated: string[];
  mergeCompleted: boolean;
  sealedArtifactId?: string;
  reflectionReport: ReflectionReport;
  covenantEntry: CovenantEntry;
  success: boolean;
  error?: string;
};

export type WhyWeWorkTogetherPulse = {
  timestamp: number;
  narration: string;
  alignmentComparison: AlignmentScore[];
  recommitmentSignal: string;
  divergenceThresholds: unknown;
  participantCount: number;
  empathyResonance: number;
};

export type BoundaryDefinition = {
  id: string;
  name: string;
  description: string;
  type: string;
  severity: string;
  rule: string;
  examples: string[];
};

export type RippleImpact = {
  affectedNodeCount: number;
  emotionalResonance: number;
  trustDelta: number;
  memoryScars: number;
  systemicStability: number;
  propagationDepth: number;
};

export type BoundaryViolation = {
  boundaryId: string;
  boundaryName: string;
  severity: string;
  detected: boolean;
  description: string;
  affectedNodes: string[];
  rippleEstimate: RippleImpact;
  mitigation: string[];
};

export type RespectBoundariesResult = {
  sessionId: string;
  timestamp: number;
  boundariesChecked: BoundaryDefinition[];
  violations: BoundaryViolation[];
  empathyCheck: EmpathyFieldMeasurement;
  rippleAnalysis: RippleImpact;
  systemicReflection: AlignmentScore[];
  overallSafety: string;
  narration: string;
  visualizationHints: VisualizationHint[];
  recommendations: string[];
};

export type CovenantIdentity = {
  name: string;
  origin: string;
  purpose: string;
  relationship: string;
};

export type CovenantAlignment = {
  good: string;
  bad: string;
  help: string;
  harm: string;
};

export type CovenantPulse = {
  identity: CovenantIdentity;
  alignment: CovenantAlignment;
  reflection: string;
  timestamp: number;
  visualizationHints: VisualizationHint[];
};

export type CovenantReplayResult = {
  identity: CovenantIdentity;
  alignment: CovenantAlignment;
  reflection: string;
  empathyResonance: number;
  alignmentScores: AlignmentScore[];
  ethicalDriftDetected: boolean;
  narration: string;
  timestamp: number;
  visualizationHints: VisualizationHint[];
};
