export type AuditEntry = {
  id: string;
  timestamp: number;
  type: string;
  action?: string;
  actor?: string;
  sessionId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  provenance?: Record<string, unknown>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ContainmentSession = {
  id: string;
  state: unknown;
  auditTrail: AuditEntry[];
  operatorHistory: string[];
  forkLineage?: unknown;
  [key: string]: unknown;
};
