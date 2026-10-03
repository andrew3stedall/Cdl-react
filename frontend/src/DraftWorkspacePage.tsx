import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Clock3, RotateCw, ShieldCheck, Users } from 'lucide-react';

import { Button } from './components/ui/button';
import { PageHero } from './components/ui/page-hero';
import type { ThemePreset } from './contracts';
import './draft-workspace-page.css';

type DraftMode = 'random_repeat' | 'snake' | 'manual';
interface DraftTeam { id: string; name: string }
interface DraftPlayer { id: string; name: string; position: string; cost: number | null }
interface DraftPick {
  pick_number: number; round_number: number; team_id: string; team_name: string;
  player_id: string; player_name: string; source: string; picked_at: string;
  seconds_taken: number | null;
}
interface DraftRoom {
  id: string; status: string; mode: DraftMode; rounds: number;
  my_team_id?: string | null; can_commission?: boolean;
  pick_number: number | null; current_team_id: string | null; current_team_name: string | null;
  clock_enabled: boolean; pick_seconds: number | null; clock_started_at: string | null;
  clock_deadline_at: string | null; picks: DraftPick[]; available_players: DraftPlayer[];
  my_queue: string[]; events: Array<{ id: string; type: string; team_id: string | null; details?: Record<string, unknown> }>;
}

interface DraftWorkspacePageProps {
  preset: ThemePreset;
  teamId?: string | null;
  canCommission?: boolean;
  onNavigate?: (href: string) => void;
  apiBase?: string;
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/live-draft${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Draft request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function DraftWorkspacePage({ preset, teamId = null, canCommission = false, onNavigate, apiBase = '/api' }: DraftWorkspacePageProps) {
  const [room, setRoom] = useState<DraftRoom | null>(null);
  const [teams, setTeams] = useState<DraftTeam[]>([]);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [mode, setMode] = useState<DraftMode>('random_repeat');
  const [clockEnabled, setClockEnabled] = useState(false);
  const [pickSeconds, setPickSeconds] = useState(90);
  const [queue, setQueue] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [correctionPick, setCorrectionPick] = useState<number | null>(null);
  const [correctionPlayer, setCorrectionPlayer] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [, setClockTick] = useState(0);

  const refresh = useCallback(async () => {
    const state = await request<DraftRoom | null>(apiBase, '');
    setRoom(state);
    setQueue(state?.my_queue ?? []);
  }, [apiBase]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [state, teamRows] = await Promise.all([
          request<DraftRoom | null>(apiBase, ''),
          request<DraftTeam[]>(apiBase, '/teams'),
        ]);
        if (!alive) return;
        setRoom(state);
        setTeams(teamRows);
        setManualOrder(teamRows.map((team) => team.id));
        setQueue(state?.my_queue ?? []);
        setError(null);
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Draft room could not be loaded.');
      }
    };
    void load();
    const timer = window.setInterval(() => { void refresh().catch(() => undefined); }, 5000);
    const clockTimer = window.setInterval(() => setClockTick((tick) => tick + 1), 1000);
    return () => { alive = false; window.clearInterval(timer); window.clearInterval(clockTimer); };
  }, [apiBase, refresh]);

  const run = async (path: string, body?: unknown, method = 'POST') => {
    setBusy(true);
    setError(null);
    try {
      await request(apiBase, path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Draft action failed.');
    } finally {
      setBusy(false);
    }
  };

  const pick = (playerId: string) => {
    if (!room?.current_team_id) return;
    const payload = { player_id: playerId, idempotency_key: crypto.randomUUID() };
    const path = commissionerAllowed && room.current_team_id !== activeTeamId
      ? `/commissioner-pick/${encodeURIComponent(room.current_team_id)}`
      : '/pick';
    void run(path, payload);
  };

  const filteredPlayers = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (room?.available_players ?? []).filter((player) =>
      !needle || `${player.name} ${player.position}`.toLowerCase().includes(needle));
  }, [filter, room?.available_players]);

  const reorder = (index: number, direction: -1 | 1) => {
    setManualOrder((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const currentClock = room?.clock_deadline_at
    ? Math.max(0, Math.ceil((new Date(room.clock_deadline_at).getTime() - Date.now()) / 1000))
    : null;
  const activeTeamId = room?.my_team_id ?? teamId;
  const commissionerAllowed = room?.can_commission ?? canCommission;
  const canCompleteDraft = Boolean(room && teams.length > 0 && room.picks.length === room.rounds * teams.length);
  const canCorrectPicks = room?.status === 'active' || room?.status === 'paused';

  return (
    <main className="feature-screen draft-workspace" data-theme-preset={preset.name}>
      <PageHero
        title="Live draft"
        titleId="live-draft-title"
        actionsLabel="Draft actions"
        onNavigate={onNavigate}
        actions={<Button variant="secondary" onClick={() => void refresh()} aria-label="Refresh draft room">
          <RotateCw size={16} /> Refresh
        </Button>}
      />

      {error && <p className="draft-workspace__error" role="alert">{error}</p>}
      {!room && commissionerAllowed && (
        <section className="draft-workspace__setup" aria-labelledby="draft-setup-title">
          <h2 id="draft-setup-title">Set up the draft</h2>
          <div className="draft-workspace__controls">
            <label>Order mode
              <select value={mode} onChange={(event) => setMode(event.target.value as DraftMode)}>
                <option value="random_repeat">Random repeated</option>
                <option value="snake">Snake</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="draft-workspace__check">
              <input type="checkbox" checked={clockEnabled} onChange={(event) => setClockEnabled(event.target.checked)} />
              Enable pick clock
            </label>
            {clockEnabled && <label>Seconds per pick
              <input type="number" min={10} max={3600} value={pickSeconds} onChange={(event) => setPickSeconds(Number(event.target.value))} />
            </label>}
          </div>
          {mode === 'manual' && <ol className="draft-workspace__manual-order" aria-label="Manual draft order">
            {manualOrder.map((id, index) => {
              const teamName = teams.find((team) => team.id === id)?.name ?? id;
              return <li key={id}>
                <span>{teamName}</span>
                <Button variant="secondary" aria-label={`Move ${teamName} up`} disabled={index === 0} onClick={() => reorder(index, -1)}><ArrowUp size={14} /></Button>
                <Button variant="secondary" aria-label={`Move ${teamName} down`} disabled={index === manualOrder.length - 1} onClick={() => reorder(index, 1)}><ArrowDown size={14} /></Button>
              </li>;
            })}
          </ol>}
          <Button disabled={busy || teams.length === 0} onClick={() => void run('', {
            mode, rounds: 20, clock_enabled: clockEnabled, pick_seconds: clockEnabled ? pickSeconds : null,
            manual_team_order: mode === 'manual' ? manualOrder : null,
          })}>Create draft room</Button>
        </section>
      )}
      {!room && !commissionerAllowed && <p className="draft-workspace__empty">The commissioner has not created a draft room.</p>}

      {room && <>
        <section className="draft-workspace__turn" aria-label="Current pick">
          <div className="draft-workspace__turn-icon"><Users size={20} /></div>
          <div><span className="draft-workspace__eyebrow">{room.status === 'active' ? `Pick ${room.pick_number}` : room.status}</span>
            <h2>{room.current_team_name ?? (room.status === 'complete' ? 'Draft complete' : 'Draft paused')}</h2>
          </div>
          {room.clock_enabled && room.status === 'active' && <div className="draft-workspace__clock" aria-live="polite">
            <Clock3 size={17} /><span>{currentClock === null ? '—' : `${currentClock}s`}</span>
          </div>}
          {commissionerAllowed && <div className="draft-workspace__admin">
            {room.status === 'setup' && <Button disabled={busy} onClick={() => void run('/control/start')}>Start</Button>}
            {room.status === 'active' && <Button variant="secondary" disabled={busy} onClick={() => void run('/control/pause')}>Pause</Button>}
            {room.status === 'paused' && <Button disabled={busy} onClick={() => void run('/control/resume')}>Resume</Button>}
            {canCompleteDraft && room.status !== 'complete' && room.status !== 'setup' && <Button variant="secondary" disabled={busy} onClick={() => void run('/control/complete')}>Complete</Button>}
            <span><ShieldCheck size={15} /> Commissioner</span>
          </div>}
        </section>

        <div className="draft-workspace__grid">
          <section className="draft-workspace__pool">
            <div className="draft-workspace__section-title"><h2>Available players</h2><span>{filteredPlayers.length}</span></div>
            <label className="draft-workspace__search">Find a player<input value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
            <div className="draft-workspace__player-list">
              {filteredPlayers.slice(0, 300).map((player) => {
                const isOnClock = room.status === 'active' && (room.current_team_id === activeTeamId || commissionerAllowed);
                return <article key={player.id} className="draft-workspace__player">
                  <div><strong>{player.name}</strong><span>{player.position} · {player.cost == null ? 'Cost unavailable' : `£${(player.cost / 10).toFixed(1)}m`}</span></div>
                  <div className="draft-workspace__player-actions">
                    <Button variant="secondary" aria-pressed={queue.includes(player.id)} onClick={() => setQueue((current) => current.includes(player.id) ? current.filter((id) => id !== player.id) : [...current, player.id])}>
                      {queue.includes(player.id) ? `Queued ${queue.indexOf(player.id) + 1}` : 'Queue'}
                    </Button>
                    <Button disabled={busy || !isOnClock || room.current_team_id == null} onClick={() => pick(player.id)}>
                      {commissionerAllowed && room.current_team_id !== activeTeamId ? 'Pick for team' : 'Pick'}
                    </Button>
                  </div>
                </article>;
              })}
              {filteredPlayers.length === 0 && <p className="draft-workspace__empty">No available players match.</p>}
            </div>
            {activeTeamId && <Button variant="secondary" disabled={busy} onClick={() => void run('/queue', { player_ids: queue }, 'PUT')}>Save my queue ({queue.length})</Button>}
            {activeTeamId && room.status === 'active' && room.current_team_id === activeTeamId && <Button variant="secondary" disabled={busy} onClick={() => void run('/auto-pick', { idempotency_key: crypto.randomUUID() })}>Auto-pick from my queue</Button>}
          </section>

          <aside className="draft-workspace__board">
            <div className="draft-workspace__section-title"><h2>Draft board</h2><span>{room.picks.length}</span></div>
            {room.picks.length === 0 ? <p className="draft-workspace__empty">Picks will appear here as the draft progresses.</p> :
              <ol className="draft-workspace__picks">{room.picks.map((pick) => <li key={pick.pick_number}>
                <span className="draft-workspace__pick-number">{pick.pick_number}</span>
                <div><strong>{pick.player_name}</strong><span>{pick.team_name} · Round {pick.round_number}</span></div>
                {(pick.source === 'commissioner_on_behalf' || pick.source === 'commissioner_correction') && <span className="draft-workspace__badge">{pick.source === 'commissioner_correction' ? 'Corrected' : 'Commissioner'}</span>}
                {commissionerAllowed && canCorrectPicks && <Button variant="ghost" onClick={() => {
                  setCorrectionPick(correctionPick === pick.pick_number ? null : pick.pick_number);
                  setCorrectionPlayer('');
                  setCorrectionReason('');
                }}>Correct</Button>}
                {commissionerAllowed && canCorrectPicks && correctionPick === pick.pick_number && <div className="draft-workspace__correction">
                  <label>Replacement player
                    <select value={correctionPlayer} onChange={(event) => setCorrectionPlayer(event.target.value)}>
                      <option value="">Choose a player</option>
                      {room.available_players.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position}</option>)}
                    </select>
                  </label>
                  <label>Reason
                    <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} minLength={5} maxLength={512} />
                  </label>
                  <Button disabled={busy || !correctionPlayer || correctionReason.trim().length < 5} onClick={() => void run(`/correction/${pick.pick_number}`, { player_id: correctionPlayer, reason: correctionReason })}>Save correction</Button>
                </div>}
              </li>)}</ol>}
            <h3>Recent activity</h3>
            <ul className="draft-workspace__events">{room.events.slice(0, 8).map((event) => <li key={event.id}>{event.type.replaceAll('_', ' ')}</li>)}</ul>
          </aside>
        </div>
      </>}
    </main>
  );
}

export default DraftWorkspacePage;
