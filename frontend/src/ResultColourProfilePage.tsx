import { ArrowLeft } from 'lucide-react';

import { ResultColourSettings } from './ResultColourSettings';
import { useThemePreset } from './theme-preset-provider';

export function ResultColourProfilePage({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { resultColours, saveStatus, setResultColours } = useThemePreset();

  return (
    <main aria-labelledby="result-colours-title" className="feature-screen profile-page profile-page--subpage">
      <header className="profile-page__header profile-page__header--subpage">
        <button className="profile-subpage-back" onClick={() => onNavigate('/account')} type="button">
          <ArrowLeft aria-hidden="true" size={17} />
          Account
        </button>
        <p className="eyebrow">Account</p>
        <h1 id="result-colours-title">Result colours</h1>
      </header>
      <ResultColourSettings colours={resultColours} onChange={setResultColours} saveStatus={saveStatus} />
    </main>
  );
}
