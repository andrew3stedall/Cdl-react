export type LoanStatus = 'proposed' | 'agreed' | 'active' | 'returned' | 'rejected' | 'cancelled';
export type LoanApprovalStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export interface LoanAgreement {
  id: string;
  season_id: string;
  player_id: string;
  player_name: string;
  lender_team_id: string;
  lender_team_name: string;
  borrower_team_id: string;
  borrower_team_name: string;
  status: LoanStatus;
  approval_status: LoanApprovalStatus;
  required_approver_role: string;
  duration_gameweeks: number;
  start_gameweek: number | null;
  due_gameweek: number | null;
  approved_by_manager_id: string | null;
  approved_at: string | null;
  returned_at: string | null;
  created_at: string;
}

export interface LoanEvent {
  id: string;
  loan_id: string;
  action: string;
  actor_manager_id: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface LoansClient {
  getLoans(): Promise<{ loans: LoanAgreement[] }>;
  getApprovals(): Promise<{ loans: LoanAgreement[] }>;
  createLoan(input: { player_id: string; borrower_team_id: string; duration_gameweeks: number }): Promise<{ loan: LoanAgreement }>;
  decideLoan(loanId: string, status: 'agreed' | 'rejected' | 'cancelled'): Promise<{ loan: LoanAgreement }>;
  approveLoan(loanId: string, decision: 'approved' | 'rejected', note?: string): Promise<{ loan: LoanAgreement }>;
  getEvents(loanId: string): Promise<{ events: LoanEvent[] }>;
}

export class LoanApiError extends Error {
  constructor(message: string, readonly status: number, readonly detail?: unknown) {
    super(message);
    this.name = 'LoanApiError';
  }
}

export class HttpLoansClient implements LoansClient {
  constructor(private readonly baseUrl = '/api') {}

  getLoans(): Promise<{ loans: LoanAgreement[] }> {
    return this.request('/loans');
  }

  getApprovals(): Promise<{ loans: LoanAgreement[] }> {
    return this.request('/loans/approvals');
  }

  createLoan(input: { player_id: string; borrower_team_id: string; duration_gameweeks: number }): Promise<{ loan: LoanAgreement }> {
    return this.request('/loans', { method: 'POST', body: JSON.stringify(input) });
  }

  decideLoan(loanId: string, status: 'agreed' | 'rejected' | 'cancelled'): Promise<{ loan: LoanAgreement }> {
    return this.request(`/loans/${encodeURIComponent(loanId)}`, { method: 'PUT', body: JSON.stringify({ status }) });
  }

  approveLoan(loanId: string, decision: 'approved' | 'rejected', note?: string): Promise<{ loan: LoanAgreement }> {
    return this.request(`/loans/${encodeURIComponent(loanId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decision, ...(note ? { note } : {}) }),
    });
  }

  getEvents(loanId: string): Promise<{ events: LoanEvent[] }> {
    return this.request(`/loans/${encodeURIComponent(loanId)}/events`);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
      });
    } catch (error) {
      throw new LoanApiError(error instanceof Error ? error.message : 'Network request failed.', 0, error);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : undefined;
      const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : describeDetail(detail) ?? `Loan request failed (${response.status}).`;
      throw new LoanApiError(message, response.status, detail);
    }
    return payload as T;
  }
}

function describeDetail(detail: unknown): string | undefined {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item && typeof item === 'object' && 'msg' in item ? String(item.msg) : String(item)).join(' · ');
  }
  if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string') return detail.message;
  return undefined;
}
