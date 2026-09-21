import { useEffect, useState } from 'react';

import { Check, CircleAlert, LoaderCircle } from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { LeagueClient, LeagueInvitePreview, LeagueJoinResult } from './league-api';
import { HttpLeagueClient } from './league-api';
import type { SessionState } from './contracts';
import './league-page.css';

const defaultLeagueClient = new HttpLeagueClient();

interface LeagueInvitePageProps {
  currentPath: string;
  leagueClient?: LeagueClient;
  onNavigate: (href: string) => void;
  session: SessionState;
}

export function LeagueInvitePage({ currentPath, leagueClient = defaultLeagueClient, onNavigate, session }: LeagueInvitePageProps) {
  const token = currentPath.replace(/^\/join\//, '').split('/')[0];
  const [preview, setPreview] = useState<LeagueInvitePreview | null>(null);
  const [joinResult, setJoinResult] = useState<LeagueJoinResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'joined' | 'error'>('loading');

  useEffect(() => {
    if (!token || !leagueClient.previewLeagueInvite) {
      setStatus('error');
      return;
    }
    let active = true;
    setStatus('loading');
    void leagueClient.previewLeagueInvite(decodeURIComponent(token))
      .then((result) => {
        if (active) {
          setPreview(result);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [leagueClient, token]);

  async function joinLeague() {
    if (!leagueClient.acceptLeagueInvite) return;
    setStatus('joining');
    try {
      const result = await leagueClient.acceptLeagueInvite(decodeURIComponent(token));
      setJoinResult(result);
      setStatus('joined');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    if (status !== 'ready' || !preview || !session.isAuthenticated) return;
    void joinLeague();
  }, [preview, session.isAuthenticated, status]);

  const displayName = session.user?.displayName || 'Manager';
  return (
    <main aria-labelledby="league-invite-title" className="league-invite-page">
      <Card className="league-invite-card">
        {status === 'loading' ? (
          <div className="league-invite-card__state" role="status"><LoaderCircle aria-hidden="true" className="league-invite-card__spinner" size={21} />Loading invite…</div>
        ) : null}
        {status === 'error' ? (
          <div className="league-invite-card__state" role="alert"><CircleAlert aria-hidden="true" size={21} /><div><h1 id="league-invite-title">Invite unavailable</h1><p>This invite link is invalid, expired, or the league is full.</p><Button onClick={() => onNavigate('/league')} type="button" variant="secondary">Open league</Button></div></div>
        ) : null}
        {status === 'ready' && preview ? (
          <div className="league-invite-card__state"><p className="eyebrow">Castle Draft League</p><h1 id="league-invite-title">Join {preview.leagueName}</h1><p>You’re invited to manage <strong>{preview.teamName}</strong>.</p><span className="league-invite-card__places">{preview.availableTeamCount} open {preview.availableTeamCount === 1 ? 'place' : 'places'}</span>{session.isAuthenticated ? <p role="status">Assigning {preview.teamName} to your account…</p> : <Button disabled={preview.availableTeamCount === 0} onClick={() => void joinLeague()} type="button">Join league</Button>}<p className="league-invite-card__signed-in">{session.isAuthenticated ? `Signed in as ${displayName}` : 'Sign in with Google to create your manager account.'}</p></div>
        ) : null}
        {status === 'joining' ? (
          <div className="league-invite-card__state" role="status"><LoaderCircle aria-hidden="true" className="league-invite-card__spinner" size={21} />Joining league…</div>
        ) : null}
        {status === 'joined' && joinResult ? (
          <div className="league-invite-card__state"><Check aria-hidden="true" className="league-invite-card__success" size={28} /><p className="eyebrow">You’re in</p><h1 id="league-invite-title">{joinResult.leagueName}</h1><p>{joinResult.alreadyMember ? 'You already belong to this league.' : `Your team is ${joinResult.teamName}.`}</p><Button onClick={() => onNavigate('/league')} type="button">Open league</Button></div>
        ) : null}
      </Card>
    </main>
  );
}
