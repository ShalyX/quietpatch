import type { DemoState, ReportDraft, ReportRecord, ReportStatus, Severity } from './types';

export function createInitialState(now = Date.now()): DemoState {
  return {
    bounty: {
      id: 'QP-BTY-001',
      title: 'Midnight contract review',
      component: 'quietpatch-demo-contract',
      minimumSeverity: 4,
      rewardAmount: 250,
      deadline: new Date(now + 1000 * 60 * 60 * 72).toISOString(),
      maintainerAddress: 'mn_addr_demo_maintainer_7f2'
    },
    report: null,
    bundle: null
  };
}

export const initialState: DemoState = createInitialState();

export function loadState(): DemoState {
  const stored = localStorage.getItem('quietpatch:demo-state');
  if (!stored) return createInitialState();
  try {
    return JSON.parse(stored) as DemoState;
  } catch {
    return createInitialState();
  }
}

export function saveState(state: DemoState): void {
  localStorage.setItem('quietpatch:demo-state', JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem('quietpatch:demo-state');
}

export function submitReport(
  state: DemoState,
  proof: { commitment: string; reportDigest: string; severity: Severity; submittedAt: string },
  bundle: DemoState['bundle']
): DemoState {
  if (state.report) throw new Error('This demo already has a report. Reset it to submit another.');
  if (proof.severity < state.bounty.minimumSeverity) {
    throw new Error('The private severity is below this bounty threshold.');
  }

  const report: ReportRecord = {
    id: 'QP-RPT-001',
    commitment: proof.commitment,
    reportDigest: proof.reportDigest,
    status: 'SUBMITTED',
    severityPass: true,
    submittedAt: proof.submittedAt
  };

  return { ...state, report, bundle };
}

function moveReport(state: DemoState, status: ReportStatus): DemoState {
  if (!state.report) throw new Error('No report has been submitted.');
  return { ...state, report: { ...state.report, status } };
}

export function acceptReport(state: DemoState): DemoState {
  if (state.report?.status !== 'SUBMITTED') throw new Error('Only submitted reports can be accepted.');
  return moveReport(state, 'ACCEPTED');
}

export function rejectReport(state: DemoState): DemoState {
  if (state.report?.status !== 'SUBMITTED') throw new Error('Only submitted reports can be rejected.');
  return moveReport(state, 'REJECTED');
}

export function claimPayout(state: DemoState): DemoState {
  if (state.report?.status !== 'ACCEPTED') throw new Error('Only accepted reports can be paid.');
  return {
    ...state,
    report: { ...state.report, status: 'PAID', payoutClaimedAt: new Date().toISOString() }
  };
}

export function disclose(state: DemoState, summary: string): DemoState {
  if (!state.report || !['ACCEPTED', 'PAID'].includes(state.report.status)) {
    throw new Error('The report must be accepted before disclosure.');
  }
  if (!summary.trim()) throw new Error('Add a safe summary before publishing.');
  return {
    ...state,
    report: {
      ...state.report,
      status: 'DISCLOSED',
      disclosureDigest: `0x${Array.from(new TextEncoder().encode(summary.trim()))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 64)}`,
      disclosureSummary: summary.trim()
    }
  };
}
