import { useState } from 'react';

import { Button } from './components/ui/button';
import {
  type CdlOwnershipPeriod,
  type PlayerProfileDataClient,
  type PrivateScoutingRecord,
} from './player-profile-data-api';

export function PrivateScoutingPanel({ client, playerId }: { client: PlayerProfileDataClient; playerId: string }) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<PrivateScoutingRecord | null>(null);
  const [watchlisted, setWatchlisted] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [failedAction, setFailedAction] = useState<'load' | 'save'>('load');

  async function load() {
    setLoading(true);
    setError(null);
    setSaved(false);
    setFailedAction('load');
    try {
      const next = await client.getScoutingRecord(playerId);
      setRecord(next);
      setWatchlisted(next.watchlisted);
      setNote(next.note ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Private scouting details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && record === null && !loading) await load();
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    setFailedAction('save');
    try {
      const updated = await client.saveScoutingRecord(playerId, { watchlisted, note });
      setRecord(updated);
      setWatchlisted(updated.watchlisted);
      setNote(updated.note ?? '');
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Private scouting details could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const dirty = record !== null && (record.watchlisted !== watchlisted || record.note !== note);
  return (
    <section aria-label="Private scouting" className="player-profile__support-panel">
      <button aria-expanded={open} className="player-profile__support-toggle" onClick={() => void toggleOpen()} type="button">
        <span>Private scouting</span>
        <span className="player-profile__support-toggle-meta">{record?.watchlisted ? 'Watchlisted' : 'Private'}</span>
      </button>
      {open ? (
        <div className="player-profile__support-content">
          {loading ? <p aria-live="polite" className="player-profile__support-status">Loading private scouting…</p> : null}
          {error ? <div className="player-profile__support-feedback" role="alert"><span>{error}</span><Button className="player-profile__small-button" disabled={loading || saving} onClick={() => void (failedAction === 'save' ? save() : load())} type="button" variant="secondary">Retry</Button></div> : null}
          {record ? (
            <>
              <label className="player-profile__watchlist-control">
                <input checked={watchlisted} onChange={(event) => { setWatchlisted(event.currentTarget.checked); setSaved(false); }} type="checkbox" />
                <span>Keep on my private watchlist</span>
              </label>
              <label className="player-profile__note-control">
                <span>Private note</span>
                <textarea maxLength={4000} onChange={(event) => { setNote(event.currentTarget.value); setSaved(false); }} rows={3} value={note} />
              </label>
              <div className="player-profile__support-footer">
                <span aria-live="polite" className="player-profile__support-status">
                  {saved ? 'Saved privately' : `${note.length}/4000`}
                </span>
                <Button className="player-profile__small-button" disabled={!dirty || saving || note.length > 4000} onClick={() => void save()} type="button">
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function OwnershipHistoryPanel({ client, playerId }: { client: PlayerProfileDataClient; playerId: string }) {
  const [open, setOpen] = useState(false);
  const [periods, setPeriods] = useState<CdlOwnershipPeriod[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await client.getOwnershipHistory(playerId);
      setPeriods([...response.periods].sort((left, right) => Date.parse(right.started_at) - Date.parse(left.started_at)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ownership history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && periods === null && !loading) await load();
  }

  return (
    <section aria-label="CDL ownership history" className="player-profile__support-panel">
      <button aria-expanded={open} className="player-profile__support-toggle" onClick={() => void toggleOpen()} type="button">
        <span>CDL ownership history</span>
        <span className="player-profile__support-toggle-meta">League seasons</span>
      </button>
      {open ? (
        <div className="player-profile__support-content">
          {loading ? <p aria-live="polite" className="player-profile__support-status">Loading ownership history…</p> : null}
          {error ? <div className="player-profile__support-feedback" role="alert"><span>{error}</span><Button className="player-profile__small-button" disabled={loading} onClick={() => void load()} type="button" variant="secondary">Retry</Button></div> : null}
          {periods?.length === 0 ? <p className="player-profile__support-status">No recorded CDL ownership history.</p> : null}
          {periods && periods.length > 0 ? (
            <ol className="player-profile__ownership-list">
              {periods.map((period) => (
                <li key={period.id}>
                  <span className="player-profile__ownership-team">{period.team_name}</span>
                  <span>{period.season_name}</span>
                  <time dateTime={period.started_at}>{formatOwnershipDate(period.started_at)}</time>
                  <span aria-label={period.ended_at ? `Ended ${formatOwnershipDate(period.ended_at)}` : 'Current owner'} className="player-profile__support-status">
                    {period.ended_at ? `Until ${formatOwnershipDate(period.ended_at)}` : 'Current'}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatOwnershipDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(timestamp);
}
