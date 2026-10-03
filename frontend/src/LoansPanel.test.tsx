import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test } from 'vitest';

import { LoansPanel, type LoanPanelPlayer, type LoanPanelTeam } from './LoansPanel';
import type { LoanAgreement, LoanEvent, LoansClient } from './loans-api';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const managerTeam: LoanPanelTeam = { id: 'team-lender', name: 'Harbour' };
const teams: LoanPanelTeam[] = [managerTeam, { id: 'team-borrower', name: 'Castle' }, { id: 'team-third', name: 'United' }];
const players: LoanPanelPlayer[] = [
  { id: 'player-1', name: 'A. Player', ownerTeamId: managerTeam.id, ownerTeamName: managerTeam.name },
  { id: 'player-2', name: 'B. Player', ownerTeamId: 'team-borrower', ownerTeamName: 'Castle' },
];

function loan(overrides: Partial<LoanAgreement> = {}): LoanAgreement {
  return {
    id: 'loan-1',
    season_id: 'season-1',
    player_id: 'player-1',
    player_name: 'A. Player',
    lender_team_id: 'team-lender',
    lender_team_name: 'Harbour',
    borrower_team_id: 'team-borrower',
    borrower_team_name: 'Castle',
    status: 'proposed',
    approval_status: 'not_submitted',
    required_approver_role: 'commissioner',
    duration_gameweeks: 4,
    start_gameweek: null,
    due_gameweek: null,
    approved_by_manager_id: null,
    approved_at: null,
    returned_at: null,
    created_at: '2026-10-01T12:00:00Z',
    ...overrides,
  };
}

class MemoryLoansClient implements LoansClient {
  loans: LoanAgreement[] = [];
  approvals: LoanAgreement[] = [];
  events: LoanEvent[] = [];
  getLoansCalls = 0;
  getApprovalsCalls = 0;
  createCalls: Array<{ player_id: string; borrower_team_id: string; duration_gameweeks: number }> = [];
  eventReads = 0;

  async getLoans() { this.getLoansCalls += 1; return { loans: [...this.loans] }; }
  async getApprovals() { this.getApprovalsCalls += 1; return { loans: [...this.approvals] }; }
  async createLoan(input: { player_id: string; borrower_team_id: string; duration_gameweeks: number }) {
    this.createCalls.push(input);
    const created = loan({ player_id: input.player_id, borrower_team_id: input.borrower_team_id, borrower_team_name: 'Castle', duration_gameweeks: input.duration_gameweeks });
    this.loans = [created, ...this.loans];
    return { loan: created };
  }
  async decideLoan(loanId: string, status: 'agreed' | 'rejected' | 'cancelled') {
    const updated = loan({ ...this.loans.find((item) => item.id === loanId), status, approval_status: status === 'agreed' ? 'pending' : 'not_submitted' });
    this.loans = [updated, ...this.loans.filter((item) => item.id !== loanId)];
    return { loan: updated };
  }
  async approveLoan(loanId: string, decision: 'approved' | 'rejected') {
    const updated = loan({
      ...this.approvals.find((item) => item.id === loanId),
      status: decision === 'approved' ? 'active' : 'rejected',
      approval_status: decision,
      start_gameweek: decision === 'approved' ? 7 : null,
      due_gameweek: decision === 'approved' ? 10 : null,
    });
    this.approvals = this.approvals.filter((item) => item.id !== loanId);
    this.loans = [updated, ...this.loans.filter((item) => item.id !== loanId)];
    return { loan: updated };
  }
  async getEvents() { this.eventReads += 1; return { events: [...this.events] }; }
}

function renderPanel(client: LoansClient, overrides: Partial<{ currentTeam: LoanPanelTeam; roles: string[]; players: LoanPanelPlayer[]; teams: LoanPanelTeam[] }> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(<LoansPanel client={client} managerTeam={overrides.currentTeam ?? managerTeam} players={overrides.players ?? players} roles={overrides.roles ?? ['manager']} teams={overrides.teams ?? teams} />));
  return { container, root };
}

async function settle() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function choose(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
  act(() => select.dispatchEvent(new Event('change', { bubbles: true })));
}

afterEach(() => { document.body.innerHTML = ''; });

describe('LoansPanel', () => {
  test('waits for an assigned team before reading the loan API', async () => {
    const client = new MemoryLoansClient();
    const { container, root } = renderPanel(client, { currentTeam: { id: '', name: 'Your team' } });
    await settle();

    expect(container.textContent).toContain('A team assignment is required to use loans.');
    expect(client.getLoansCalls).toBe(0);
    expect(client.getApprovalsCalls).toBe(0);
    root.unmount();
  });

  test('creates a loan proposal from player and team names without entering IDs', async () => {
    const client = new MemoryLoansClient();
    const { container, root } = renderPanel(client);
    await settle();
    const selects = container.querySelectorAll('select');
    choose(selects[0]!, 'player-1');
    choose(selects[1]!, 'team-borrower');
    click(container, 'Send proposal');
    await settle();

    expect(client.createCalls).toEqual([{ player_id: 'player-1', borrower_team_id: 'team-borrower', duration_gameweeks: 4 }]);
    expect(container.textContent).toContain('Loan proposal sent to Castle.');
    expect(container.textContent).toContain('A. Player');
    expect(container.textContent).toContain('Proposed');
    expect(client.getLoansCalls).toBeGreaterThan(1);
    root.unmount();
  });

  test('lets only the borrower agree and shows the pending approval state', async () => {
    const client = new MemoryLoansClient();
    client.loans = [loan()];
    const { container, root } = renderPanel(client, { currentTeam: { id: 'team-borrower', name: 'Castle' } });
    await settle();
    expect(container.textContent).toContain('Agree');
    expect(container.textContent).not.toContain('Cancel proposal');
    click(container, 'Agree');
    await settle();

    expect(container.textContent).toContain('Loan terms agreed. Awaiting required approval.');
    expect(container.textContent).toContain('Agreed · awaiting approval');
    expect(container.textContent).toContain('Requires Commissioner approval');
    root.unmount();
  });

  test('shows only eligible approval actions and expands participant audit on demand', async () => {
    const client = new MemoryLoansClient();
    const pending = loan({ id: 'loan-pending', lender_team_id: 'team-third', lender_team_name: 'United', status: 'agreed', approval_status: 'pending' });
    const active = loan({ id: 'loan-active', status: 'active', approval_status: 'approved', start_gameweek: 7, due_gameweek: 10 });
    const returned = loan({ id: 'loan-returned', status: 'returned', approval_status: 'approved', returned_at: '2026-09-28T12:00:00Z' });
    client.approvals = [pending];
    client.loans = [active, returned];
    client.events = [{ id: 'evt-1', loan_id: active.id, action: 'loan_approved', actor_manager_id: 'manager-1', created_at: '2026-09-01T12:00:00Z', metadata: {} }];
    const { container, root } = renderPanel(client, { roles: ['commissioner'] });
    await settle();

    expect(container.textContent).toContain('Due GW10');
    expect(container.textContent).toContain('Returned');
    expect(container.textContent).toContain('Approval queue');
    expect(container.textContent).toContain('Requires Commissioner approval');
    expect(container.textContent).not.toContain('loan_approved');
    expect(client.eventReads).toBe(0);

    const activities = [...container.querySelectorAll('button')].filter((button) => button.textContent === 'View activity');
    act(() => activities[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await settle();
    expect(client.eventReads).toBe(1);
    expect(container.textContent).toContain('Loan approved');

    click(container, 'Approve');
    await settle();
    expect(container.textContent).toContain('Loan approved for GW7–GW10.');
    expect(client.approvals).toHaveLength(0);
    expect([...container.querySelectorAll('button')].filter((button) => button.textContent === 'View activity')).toHaveLength(2);
    root.unmount();
  });
});
