import { ArrowLeft } from 'lucide-react';

import { GlobalPageHeader } from './components/ui/global-notifications';
import { ResultColourSettings } from './ResultColourSettings';
import { useThemePreset } from './theme-preset-provider';

export function ResultColourProfilePage({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { resultColours, saveStatus, setResultColours } = useThemePreset();

  return (
    <main aria-labelledby="result-colours-title" className="feature-screen profile-page profile-page--subpage">
      <GlobalPageHeader className="profile-page__header profile-page__header--subpage" onNavigate={onNavigate}>
        <button className="profile-subpage-back" onClick={() => onNavigate('/profile')} type="button">
          <ArrowLeft aria-hidden="true" size={17} />
          Profile
        </button>
        <p className="eyebrow">Profile</p>
        <h1 id="result-colours-title">Result colours</h1>
      </GlobalPageHeader>
      <ResultColourSettings colours={resultColours} onChange={setResultColours} saveStatus={saveStatus} />
    </main>
  );
}
