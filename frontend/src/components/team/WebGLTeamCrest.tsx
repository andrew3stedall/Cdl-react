import { useEffect, useRef, useState } from 'react';
import { teamCrestAsset, type TeamCrestTeam } from './TeamCrest';

export function WebGLTeamCrest({ team, accent, className = '' }: { team: TeamCrestTeam; accent: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const asset = teamCrestAsset(team);
  const src = asset ? `/team-crests/${asset}-${asset === 'sporting-lesbians' ? 'mesh' : 'light'}.svg` : undefined;
  const sceneKey = `${src}|${accent}`;
  const ready = readyKey === sceneKey;

  useEffect(() => {
    setReadyKey(null);
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
      else if (cleanup) { dispose = cleanup; setReadyKey(sceneKey); }
    }).catch(() => { if (!controller.signal.aborted) setReadyKey(null); });
    return () => { controller.abort(); dispose?.(); };
  }, [accent, src, sceneKey]);

  return <div aria-hidden="true" className={`webgl-team-crest ${className}`} data-ready={ready}>
    {src ? <img alt="" className="webgl-team-crest__fallback" src={src} /> : null}
    <canvas className="webgl-team-crest__canvas" key={asset} ref={canvasRef} />
  </div>;
}
