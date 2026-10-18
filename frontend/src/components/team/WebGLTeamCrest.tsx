import { useEffect, useRef, useState } from 'react';
import { teamCrestAsset, type TeamCrestTeam } from './TeamCrest';

export function WebGLTeamCrest({ team, accent, className = '' }: { team: TeamCrestTeam; accent: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const asset = teamCrestAsset(team);
  const src = asset ? `/team-crests/${asset}-${asset === 'sporting-lesbians' ? 'mesh' : 'light'}.svg` : undefined;

  useEffect(() => {
    setReady(false);
    const canvas = canvasRef.current;
    if (!canvas || !src || !('WebGL2RenderingContext' in window)) return;
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    // Load the 3D engine only when the Teams view is opened.
    void import('./crest-scene').then(({ createCrestScene }) => {
      if (controller.signal.aborted) return undefined;
      return createCrestScene(canvas, src, accent, controller.signal);
    }).then((cleanup) => {
      if (controller.signal.aborted) cleanup?.();
      else if (cleanup) { dispose = cleanup; setReady(true); }
    }).catch(() => { if (!controller.signal.aborted) setReady(false); });
    return () => { controller.abort(); dispose?.(); };
  }, [accent, src]);

  return <div aria-hidden="true" className={`webgl-team-crest ${className}`} data-ready={ready}>
    {src ? <img alt="" className="webgl-team-crest__fallback" src={src} /> : null}
    <canvas className="webgl-team-crest__canvas" key={asset} ref={canvasRef} />
  </div>;
}
