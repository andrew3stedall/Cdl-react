import type { PageRouteKey } from './navigation';

type DataScope = 'squad' | 'lineup' | 'interest' | 'trade' | 'draw' | 'league' | 'alerts' | 'global';

interface InvalidationDetail {
  scopes: DataScope[];
  sourceRoute?: PageRouteKey;
}

let activeRoute: PageRouteKey | null = null;

const affectedRoutes: Record<DataScope, PageRouteKey[]> = {
  squad: ['squad', 'market', 'league', 'desk', 'player-profile'],
  lineup: ['squad', 'market', 'league', 'desk', 'player-profile'],
  interest: ['market', 'squad', 'desk'],
  trade: ['market', 'squad', 'desk', 'league'],
  draw: ['market', 'desk'],
  league: ['league', 'desk'],
  alerts: ['desk', 'squad', 'market', 'league', 'profile', 'rules', 'fdr', 'analytics', 'modernisation', 'player-profile'],
  global: ['desk', 'squad', 'market', 'league', 'profile', 'rules', 'fdr', 'analytics', 'modernisation', 'player-profile'],
};

export function activateDataRoute(routeKey: PageRouteKey): void {
  activeRoute = routeKey;
  document.dispatchEvent(new CustomEvent<PageRouteKey>('cdl:route-activated', { detail: routeKey }));
}

export function invalidateData(scopes: DataScope[], sourceRoute?: PageRouteKey): void {
  if (!scopes.length) return;
  const expandedScopes = scopes.some((scope) => ['squad', 'lineup', 'interest', 'trade', 'league'].includes(scope))
    ? [...new Set([...scopes, 'alerts' as const])]
    : scopes;
  document.dispatchEvent(new CustomEvent<InvalidationDetail>('cdl:data-invalidated', { detail: { scopes: expandedScopes, sourceRoute } }));
}

export function subscribeDataFreshness(
  routeKey: PageRouteKey,
  scopes: DataScope[],
  onRefresh: () => void,
  skipInitialActivation = true,
): () => void {
  let initialActivation = skipInitialActivation;
  const refreshIfActive = () => {
    if (activeRoute === routeKey) onRefresh();
  };
  const onRoute = (event: Event) => {
    const nextRoute = (event as CustomEvent<PageRouteKey>).detail;
    activeRoute = nextRoute;
    if (nextRoute !== routeKey) return;
    if (initialActivation) {
      initialActivation = false;
      return;
    }
    onRefresh();
  };
  const onResume = () => {
    if (document.visibilityState === 'visible') refreshIfActive();
  };
  const refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') refreshIfActive();
  }, 60_000);
  const onInvalidation = (event: Event) => {
    const detail = (event as CustomEvent<InvalidationDetail>).detail;
    if (detail?.sourceRoute !== routeKey && detail?.scopes.some((scope) => scopes.includes(scope)) && activeRoute === routeKey) onRefresh();
  };
  document.addEventListener('cdl:route-activated', onRoute);
  document.addEventListener('cdl:data-invalidated', onInvalidation);
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('online', onResume);
  return () => {
    document.removeEventListener('cdl:route-activated', onRoute);
    document.removeEventListener('cdl:data-invalidated', onInvalidation);
    document.removeEventListener('visibilitychange', onResume);
    window.removeEventListener('online', onResume);
    window.clearInterval(refreshTimer);
  };
}

export function subscribeScopedDataFreshness(
  scopes: DataScope[],
  onRefresh: () => void,
): () => void {
  let initialActivation = true;
  const onRoute = (event: Event) => {
    activeRoute = (event as CustomEvent<PageRouteKey>).detail;
    if (!initialActivation && scopes.some((scope) => affectedRoutes[scope].includes(activeRoute as PageRouteKey))) onRefresh();
    initialActivation = false;
  };
  const onResume = () => {
    const currentRoute = activeRoute;
    if (document.visibilityState === 'visible' && currentRoute && scopes.some((scope) => affectedRoutes[scope].includes(currentRoute))) onRefresh();
  };
  const onInvalidation = (event: Event) => {
    const detail = (event as CustomEvent<InvalidationDetail>).detail;
    if (detail?.scopes.some((scope) => scopes.includes(scope))) onRefresh();
  };
  document.addEventListener('cdl:route-activated', onRoute);
  document.addEventListener('cdl:data-invalidated', onInvalidation);
  document.addEventListener('visibilitychange', onResume);
  window.addEventListener('online', onResume);
  return () => {
    document.removeEventListener('cdl:route-activated', onRoute);
    document.removeEventListener('cdl:data-invalidated', onInvalidation);
    document.removeEventListener('visibilitychange', onResume);
    window.removeEventListener('online', onResume);
  };
}
