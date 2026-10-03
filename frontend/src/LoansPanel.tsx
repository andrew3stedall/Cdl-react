import { useEffect, useMemo, useState } from 'react';

import { Button } from './components/ui/button';
import { invalidateData } from './data-freshness';
import { HttpLoansClient, type LoanAgreement, type LoanEvent, type LoansClient } from './loans-api';
import './loans-panel.css';

export interface LoanPanelPlayer {
  id: string;
  name: string;
  ownerTeamId: string | null;
  ownerTeamName: string | null;
}

export interface LoanPanelTeam {
  id: string;
  name: string;
}

interface LoansPanelProps {
  client?: LoansClient;
  managerTeam: LoanPanelTeam;
  players: LoanPanelPlayer[];
  roles: string[];
  teams: LoanPanelTeam[];
}

type ReadState = 'idle' | 'loading' | 'loaded' | 'error';

const defaultClient = new HttpLoansClient();

export function LoansPanel({ client = defaultClient, managerTeam, players, roles, teams }: LoansPanelProps) {
  const [loans, setLoans] = useState<LoanAgreement[]>([]);
  const [approvals, setApprovals] = useState<LoanAgreement[]>([]);
  const [loansState, setLoansState] = useState<ReadState>('idle');
  const [approvalsState, setApprovalsState] = useState<ReadState>('idle');
  const [loanError, setLoanError] = useState('');
  const [approvalsError, setApprovalsError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [borrowerTeamId, setBorrowerTeamId] = useState('');
  const [duration, setDuration] = useState(4);
  const [createError, setCreateError] = useState('');
  const [createNotice, setCreateNotice] = useState('');
  const canReview = roles.some((role) => ['commissioner', 'vice_commissioner', 'admin'].includes(role));
  const ownPlayers = useMemo(
    () => players.filter((player) => player.ownerTeamId === managerTeam.id).sort((left, right) => left.name.localeCompare(right.name)),
    [managerTeam.id, players],
  );
  const otherTeams = useMemo(
    () => teams.filter((team) => team.id !== managerTeam.id).sort((left, right) => left.name.localeCompare(right.name)),
    [managerTeam.id, teams],
  );

  async function loadLoans() {
    setLoansState('loading');
    setLoanError('');
    try {
      const response = await client.getLoans();
      setLoans(response.loans);
      setLoansState('loaded');
    } catch (error) {
      setLoanError(errorMessage(error, 'Loans could not be loaded.'));
      setLoansState('error');
    }
  }

  async function loadApprovals() {
    if (!managerTeam.id) return;
    setApprovalsState('loading');
    setApprovalsError('');
    try {
      const response = await client.getApprovals();
      setApprovals(response.loans);
      setApprovalsState('loaded');
    } catch (error) {
      setApprovalsError(errorMessage(error, 'Loan approvals could not be loaded.'));
      setApprovalsState('error');
    }
  }

  useEffect(() => {
    if (!managerTeam.id) {
      setLoansState('error');
      setLoanError('A team assignment is required to view loans.');
      setApprovalsState('error');
      setApprovalsError('A team assignment is required to view loan approvals.');
      return;
    }
    void loadLoans();
    if (canReview) void loadApprovals();
    else setApprovalsState('loaded');
  }, [client, canReview, managerTeam.id]);

  async function createLoan() {
    if (!selectedPlayerId || !borrowerTeamId || pendingId) return;
    setPendingId('create');
    setCreateError('');
    setCreateNotice('');
    try {
      const response = await client.createLoan({
        player_id: selectedPlayerId,
        borrower_team_id: borrowerTeamId,
        duration_gameweeks: Math.max(4, Math.floor(duration)),
      });
      setLoans((current) => upsertLoan(current, response.loan));
      setCreateNotice(`Loan proposal sent to ${response.loan.borrower_team_name}.`);
      setSelectedPlayerId('');
      setBorrowerTeamId('');
      invalidateData(['squad'], 'market');
      void loadLoans();
    } catch (error) {
      setCreateError(errorMessage(error, 'Loan proposal could not be sent.'));
    } finally {
      setPendingId(null);
    }
  }

  async function decideLoan(loan: LoanAgreement, status: 'agreed' | 'rejected' | 'cancelled') {
    if (pendingId) return;
    setPendingId(loan.id);
    setNotice('');
    setNoticeIsError(false);
    try {
      const response = await client.decideLoan(loan.id, status);
      setLoans((current) => upsertLoan(current, response.loan));
      setNotice(status === 'agreed' ? 'Loan terms agreed. Awaiting required approval.' : status === 'rejected' ? 'Loan proposal rejected.' : 'Loan proposal cancelled.');
      invalidateData(['squad'], 'market');
      void loadLoans();
    } catch (error) {
      setNotice(errorMessage(error, 'Loan decision could not be saved.'));
      setNoticeIsError(true);
    } finally {
      setPendingId(null);
    }
  }

  async function approveLoan(loan: LoanAgreement, decision: 'approved' | 'rejected') {
    if (pendingId) return;
    setPendingId(loan.id);
    setNotice('');
    setNoticeIsError(false);
    try {
      const response = await client.approveLoan(loan.id, decision);
      setApprovals((current) => current.filter((item) => item.id !== loan.id));
      if (response.loan.lender_team_id === managerTeam.id || response.loan.borrower_team_id === managerTeam.id) {
        setLoans((current) => upsertLoan(current, response.loan));
      }
      setNotice(decision === 'approved'
        ? `Loan approved${response.loan.start_gameweek ? ` for GW${response.loan.start_gameweek}` : ''}${response.loan.due_gameweek ? `–GW${response.loan.due_gameweek}` : ''}.`
        : 'Loan approval rejected.');
      invalidateData(['squad'], 'market');
      void loadLoans();
      void loadApprovals();
    } catch (error) {
      setNotice(errorMessage(error, 'Loan approval decision could not be saved.'));
      setNoticeIsError(true);
    } finally {
      setPendingId(null);
    }
  }

  if (!managerTeam.id) {
    return <section aria-label="Loans" className="loans-panel"><header className="loans-panel__header"><h2>Loans</h2><span>Private league agreements</span></header><p role="alert">A team assignment is required to use loans.</p></section>;
  }

  return (
    <section aria-label="Loans" className="loans-panel">
      <header className="loans-panel__header"><h2>Loans</h2><span>Private league agreements</span></header>

      <section aria-label="Create loan proposal" className="loans-panel__create">
        <h3>Propose a loan</h3>
        {ownPlayers.length === 0 ? <p>No players owned by your team are available to propose.</p> : otherTeams.length === 0 ? <p>No other teams are available in this league.</p> : (
          <div className="loans-panel__form">
            <label>
              Player
              <select disabled={pendingId === 'create'} onChange={(event) => setSelectedPlayerId(event.currentTarget.value)} value={selectedPlayerId}>
                <option value="">Choose player</option>
                {ownPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
            </label>
            <label>
              Borrower
              <select disabled={pendingId === 'create'} onChange={(event) => setBorrowerTeamId(event.currentTarget.value)} value={borrowerTeamId}>
                <option value="">Choose team</option>
                {otherTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="loans-panel__duration">
              Duration (gameweeks)
              <input min={4} onChange={(event) => setDuration(Math.max(4, Number(event.currentTarget.value) || 4))} type="number" value={duration} />
            </label>
            <Button disabled={!selectedPlayerId || !borrowerTeamId || pendingId !== null} onClick={() => void createLoan()} type="button">
              {pendingId === 'create' ? 'Sending…' : 'Send proposal'}
            </Button>
          </div>
        )}
        {createError ? <p role="alert">{createError}</p> : null}
        {createNotice ? <p role="status">{createNotice}</p> : null}
      </section>

      {notice ? <p className="loans-panel__notice" role={noticeIsError ? 'alert' : 'status'}>{notice}</p> : null}

      <section aria-label="Your loan agreements" className="loans-panel__section">
        <div className="loans-panel__section-heading"><h3>Your agreements</h3><Button onClick={() => void loadLoans()} type="button" variant="secondary">Refresh</Button></div>
        {loansState === 'loading' ? <p role="status">Loading loans…</p> : null}
        {loansState === 'error' ? <p role="alert">{loanError} <Button onClick={() => void loadLoans()} type="button" variant="secondary">Retry</Button></p> : null}
        {loansState === 'loaded' && loans.length === 0 ? <p>No loan agreements.</p> : null}
        {loansState === 'loaded' && loans.length > 0 ? <div className="loans-panel__list">{loans.map((loan) => (
          <LoanRow
            client={client}
            key={loan.id}
            loan={loan}
            managerTeamId={managerTeam.id}
            onDecide={decideLoan}
            pending={pendingId === loan.id}
          />
        ))}</div> : null}
      </section>

      {canReview ? (
        <section aria-label="Eligible loan approvals" className="loans-panel__section">
          <div className="loans-panel__section-heading"><h3>Approval queue</h3><Button onClick={() => void loadApprovals()} type="button" variant="secondary">Refresh</Button></div>
          {approvalsState === 'loading' ? <p role="status">Loading eligible approvals…</p> : null}
          {approvalsState === 'error' ? <p role="alert">{approvalsError} <Button onClick={() => void loadApprovals()} type="button" variant="secondary">Retry</Button></p> : null}
          {approvalsState === 'loaded' && approvals.length === 0 ? <p>No loan approvals waiting for you.</p> : null}
          {approvalsState === 'loaded' && approvals.length > 0 ? <div className="loans-panel__list">{approvals.map((loan) => (
            <article className="loans-panel__row" key={loan.id}>
              <LoanSummary loan={loan} />
              <p className="loans-panel__approval-role">Requires {roleLabel(loan.required_approver_role)} approval</p>
              <div className="loans-panel__actions">
                <Button disabled={pendingId !== null} onClick={() => void approveLoan(loan, 'approved')} type="button">{pendingId === loan.id ? 'Saving…' : 'Approve'}</Button>
                <Button disabled={pendingId !== null} onClick={() => void approveLoan(loan, 'rejected')} type="button" variant="secondary">Reject</Button>
              </div>
            </article>
          ))}</div> : null}
        </section>
      ) : null}
    </section>
  );
}

function LoanRow({ client, loan, managerTeamId, onDecide, pending }: {
  client: LoansClient;
  loan: LoanAgreement;
  managerTeamId: string;
  onDecide: (loan: LoanAgreement, status: 'agreed' | 'rejected' | 'cancelled') => Promise<void>;
  pending: boolean;
}) {
  const isLender = loan.lender_team_id === managerTeamId;
  const isBorrower = loan.borrower_team_id === managerTeamId;
  return (
    <article className="loans-panel__row">
      <LoanSummary loan={loan} />
      {loan.status === 'proposed' && isBorrower ? (
        <div className="loans-panel__actions">
          <Button disabled={pending} onClick={() => void onDecide(loan, 'agreed')} type="button">{pending ? 'Saving…' : 'Agree'}</Button>
          <Button disabled={pending} onClick={() => void onDecide(loan, 'rejected')} type="button" variant="secondary">Reject</Button>
        </div>
      ) : null}
      {loan.status === 'proposed' && isLender ? <div className="loans-panel__actions"><Button disabled={pending} onClick={() => void onDecide(loan, 'cancelled')} type="button" variant="secondary">{pending ? 'Cancelling…' : 'Cancel proposal'}</Button></div> : null}
      <LoanEventsDisclosure client={client} loanId={loan.id} />
    </article>
  );
}

function LoanSummary({ loan }: { loan: LoanAgreement }) {
  const status = loan.status === 'agreed' && loan.approval_status === 'pending' ? 'Agreed · awaiting approval' : statusLabel(loan.status);
  return (
    <div className="loans-panel__summary">
      <div className="loans-panel__summary-main"><strong>{loan.player_name}</strong><span>{loan.lender_team_name} → {loan.borrower_team_name}</span></div>
      <span aria-label={`Loan status: ${status}`} className={`loans-panel__status loans-panel__status--${loan.status}`}>{status}</span>
      {loan.status === 'active' ? <span className="loans-panel__schedule">{loan.start_gameweek ? `Starts GW${loan.start_gameweek}` : 'Active'}{loan.due_gameweek ? ` · Due GW${loan.due_gameweek}` : ''}</span> : null}
      {loan.status === 'agreed' ? <span className="loans-panel__schedule">Requires {roleLabel(loan.required_approver_role)} approval</span> : null}
      {loan.status === 'returned' && loan.returned_at ? <time className="loans-panel__schedule" dateTime={loan.returned_at}>Returned {formatDate(loan.returned_at)}</time> : null}
      {(loan.status === 'proposed' || loan.status === 'agreed') ? <span className="loans-panel__schedule">{loan.duration_gameweeks} gameweeks proposed</span> : null}
    </div>
  );
}

function LoanEventsDisclosure({ client, loanId }: { client: LoansClient; loanId: string }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<LoanEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await client.getEvents(loanId);
      setEvents(response.events);
    } catch (reason) {
      setError(errorMessage(reason, 'Loan activity could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && events === null && !loading) void load();
  }

  return (
    <div className="loans-panel__events">
      <button aria-expanded={open} onClick={toggle} type="button">{open ? 'Hide activity' : 'View activity'}</button>
      {open ? (
        <div>
          {loading ? <p role="status">Loading activity…</p> : null}
          {error ? <p role="alert">{error} <Button disabled={loading} onClick={() => void load()} type="button" variant="secondary">Retry</Button></p> : null}
          {events?.length === 0 ? <p>No recorded loan activity.</p> : null}
          {events && events.length > 0 ? <ol>{events.map((event) => <li key={event.id}><span>{actionLabel(event.action)}</span><time dateTime={event.created_at}>{formatDate(event.created_at)}</time></li>)}</ol> : null}
        </div>
      ) : null}
    </div>
  );
}

function upsertLoan(current: LoanAgreement[], loan: LoanAgreement): LoanAgreement[] {
  return [loan, ...current.filter((item) => item.id !== loan.id)];
}

function statusLabel(status: LoanAgreement['status']): string {
  return status.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());
}

function roleLabel(role: string): string {
  return role.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());
}

function actionLabel(action: string): string {
  return action.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());
}

function formatDate(value: string): string {
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(time);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
