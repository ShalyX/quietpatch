export type Role = 'observer' | 'researcher' | 'maintainer';

export type ReportStatus =
  | 'NONE'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PAID'
  | 'DISCLOSED';

export type Severity = 1 | 2 | 3 | 4 | 5;

export interface Bounty {
  id: string;
  title: string;
  component: string;
  minimumSeverity: Severity;
  rewardAmount: number;
  deadline: string;
  maintainerAddress: string;
}

export interface ReportDraft {
  title: string;
  component: string;
  affectedVersion: string;
  severity: Severity;
  summary: string;
  reproduction: string;
  impact: string;
  suggestedFix: string;
}

export interface EncryptedBundle {
  iv: string;
  ciphertext: string;
  reportDigest: string;
  commitment: string;
  submittedAt: string;
  apiReportId?: string;
}

export interface ReportRecord {
  id: string;
  commitment: string;
  reportDigest: string;
  status: ReportStatus;
  severityPass: boolean;
  submittedAt: string;
  payoutClaimedAt?: string;
  disclosureDigest?: string;
  disclosureSummary?: string;
}

export interface DemoState {
  bounty: Bounty;
  report: ReportRecord | null;
  bundle: EncryptedBundle | null;
}
